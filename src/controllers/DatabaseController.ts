/**
 * DatabaseController
 *
 * Handles database connection management, schema retrieval, and metadata operations for users.
 * Integrates with DatabaseService for connection pooling and query execution.
 * Manages its own database connection for direct queries and encryption utilities.
 *
 * Usage:
 *   - Instantiate and use getUserConnections() to retrieve user database connections
 *   - Use other methods for schema and metadata management
 */
import { config } from '@/config';
import { DatabaseService } from '@/services/DatabaseService';
import type { DatabaseConnection, TableSchema } from '@/types';
import { EncryptionUtil } from '@/utils/encryption';
import { logger } from '@/utils/logger';
import type { RowDataPacket } from 'mysql2/promise';
import { createConnection } from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';

export class DatabaseController {
  /**
   * DatabaseService instance for connection pooling and query execution.
   */
  private databaseService: DatabaseService;

  /**
   * MySQL connection promise for direct database operations.
   */
  private connection = createConnection({
    host: config.database.host,
    port: config.database.port,
    user: config.database.username,
    password: config.database.password,
    database: config.database.database,
  });

  /**
   * Initialize the DatabaseController and its dependencies.
   */
  constructor() {
    this.databaseService = new DatabaseService();
    this.initializeConnection();
  }

  /**
   * Establish and test the database connection for user operations.
   * Logs success or failure.
   */
  private async initializeConnection(): Promise<void> {
    try {
      const conn = await this.connection;
      await conn.ping();
      logger.info('DatabaseController connection established');
    } catch (error) {
      logger.error('Failed to establish DatabaseController connection:', error);
    }
  }

  /**
   * Get all database connections for a user.
   * Queries the database and returns sanitized connection objects.
   *
   * @param userId - ID of the user
   * @returns Array of DatabaseConnection objects
   */
  public async getUserConnections(userId: string): Promise<DatabaseConnection[]> {
    try {
      const conn = await this.connection;

      const [connections] = await conn.execute<RowDataPacket[]>(
        `SELECT id, name, host, port, database_name, username, ssl_enabled, is_active,
                created_at, updated_at, last_tested, connection_status
         FROM database_connections
         WHERE user_id = ? AND is_active = true
         ORDER BY created_at DESC`,
        [userId]
      );

      return connections.map(row => ({
        id: row.id,
        name: row.name,
        host: row.host,
        port: row.port,
        database: row.database_name,
        username: row.username,
        password: '', // Don't return password in API responses
        ssl: row.ssl_enabled,
        isActive: row.is_active,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      }));
    } catch (error) {
      logger.error(`Failed to get connections for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get a specific database connection
   */
  public async getConnection(
    userId: string,
    connectionId: string
  ): Promise<DatabaseConnection | null> {
    try {
      const conn = await this.connection;

      const [connections] = await conn.execute<RowDataPacket[]>(
        `SELECT id, name, host, port, database_name, username, ssl_enabled, is_active,
                created_at, updated_at, last_tested, connection_status
         FROM database_connections
         WHERE id = ? AND user_id = ? AND is_active = true`,
        [connectionId, userId]
      );

      if (connections.length === 0) {
        return null;
      }

      const row = connections[0];
      return {
        id: row.id,
        name: row.name,
        host: row.host,
        port: row.port,
        database: row.database_name,
        username: row.username,
        password: '', // Don't return password
        ssl: row.ssl_enabled,
        isActive: row.is_active,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      };
    } catch (error) {
      logger.error(`Failed to get connection ${connectionId} for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Add a new database connection
   */
  public async addConnection(
    userId: string,
    connectionData: Omit<DatabaseConnection, 'id' | 'createdAt' | 'updatedAt' | 'isActive'>
  ): Promise<DatabaseConnection> {
    try {
      // First test the connection
      await this.testConnectionData(connectionData);

      const conn = await this.connection;
      const connectionId = uuidv4();
      const now = new Date();

      // Encrypt the password
      const encryptedPassword = EncryptionUtil.encrypt(connectionData.password);

      await conn.execute(
        `INSERT INTO database_connections
         (id, user_id, name, host, port, database_name, username, password,
          ssl_enabled, is_active, created_at, updated_at, connection_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          connectionId,
          userId,
          connectionData.name,
          connectionData.host,
          connectionData.port,
          connectionData.database,
          connectionData.username,
          encryptedPassword,
          connectionData.ssl || false,
          true,
          now,
          now,
          'connected',
        ]
      );

      // Add to DatabaseService connection pool
      const dbConnection: DatabaseConnection = {
        id: connectionId,
        name: connectionData.name,
        host: connectionData.host,
        port: connectionData.port,
        database: connectionData.database,
        username: connectionData.username,
        password: connectionData.password,
        ssl: connectionData.ssl || false,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };

      await this.databaseService.addConnection(dbConnection);

      logger.info(`Database connection added: ${connectionData.name} for user ${userId}`);

      // Return connection without password
      return {
        ...dbConnection,
        password: '',
      };
    } catch (error) {
      logger.error(`Failed to add connection for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Update a database connection
   */
  public async updateConnection(
    userId: string,
    connectionId: string,
    updates: Partial<Omit<DatabaseConnection, 'id' | 'createdAt' | 'updatedAt' | 'isActive'>>
  ): Promise<DatabaseConnection | null> {
    try {
      const conn = await this.connection;

      // Get current connection
      const current = await this.getConnection(userId, connectionId);
      if (!current) {
        return null;
      }

      // Test the updated connection if critical fields changed
      if (
        updates.host ||
        updates.port ||
        updates.database ||
        updates.username ||
        updates.password
      ) {
        const testData = {
          ...current,
          ...updates,
          password: updates.password || 'current_password', // Use placeholder if not updating password
        };

        if (updates.password) {
          await this.testConnectionData(testData);
        }
      }

      const updateFields: string[] = [];
      const updateValues: any[] = [];

      if (updates.name) {
        updateFields.push('name = ?');
        updateValues.push(updates.name);
      }

      if (updates.host) {
        updateFields.push('host = ?');
        updateValues.push(updates.host);
      }

      if (updates.port) {
        updateFields.push('port = ?');
        updateValues.push(updates.port);
      }

      if (updates.database) {
        updateFields.push('database_name = ?');
        updateValues.push(updates.database);
      }

      if (updates.username) {
        updateFields.push('username = ?');
        updateValues.push(updates.username);
      }

      if (updates.password) {
        updateFields.push('password_encrypted = ?');
        updateValues.push(EncryptionUtil.encrypt(updates.password));
      }

      if (updates.ssl !== undefined) {
        updateFields.push('ssl_enabled = ?');
        updateValues.push(updates.ssl);
      }

      if (updateFields.length === 0) {
        return current;
      }

      updateFields.push('updated_at = ?');
      updateValues.push(new Date());
      updateValues.push(connectionId);
      updateValues.push(userId);

      await conn.execute(
        `UPDATE database_connections SET ${updateFields.join(', ')}
         WHERE id = ? AND user_id = ?`,
        updateValues
      );

      logger.info(`Database connection updated: ${connectionId} for user ${userId}`);
      return await this.getConnection(userId, connectionId);
    } catch (error) {
      logger.error(`Failed to update connection ${connectionId} for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Remove a database connection
   */
  public async removeConnection(userId: string, connectionId: string): Promise<boolean> {
    try {
      const conn = await this.connection;

      const [result] = await conn.execute(
        'UPDATE database_connections SET is_active = false, updated_at = ? WHERE id = ? AND user_id = ?',
        [new Date(), connectionId, userId]
      );

      // Remove from DatabaseService pool
      await this.databaseService.removeConnection(connectionId);

      logger.info(`Database connection removed: ${connectionId} for user ${userId}`);
      return (result as any).affectedRows > 0;
    } catch (error) {
      logger.error(`Failed to remove connection ${connectionId} for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Test a database connection
   */
  public async testConnection(
    userId: string,
    connectionId: string
  ): Promise<{ connected: boolean; message?: string }> {
    try {
      const connected = await this.databaseService.testConnection(connectionId);

      // Update last tested timestamp
      const conn = await this.connection;
      await conn.execute(
        'UPDATE database_connections SET last_tested = ?, connection_status = ? WHERE id = ? AND user_id = ?',
        [new Date(), connected ? 'active' : 'error', connectionId, userId]
      );

      return {
        connected,
        message: connected ? 'Connection successful' : 'Connection failed',
      };
    } catch (error) {
      logger.error(`Connection test failed for ${connectionId}:`, error);
      return {
        connected: false,
        message: error instanceof Error ? error.message : 'Connection test failed',
      };
    }
  }

  /**
   * Test connection with provided data (before saving)
   */
  private async testConnectionData(connectionData: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    ssl?: boolean;
  }): Promise<void> {
    const connectionConfig: any = {
      host: connectionData.host,
      port: connectionData.port,
      user: connectionData.username,
      password: connectionData.password,
      database: connectionData.database,
      connectTimeout: 10000,
    };

    // Add SSL configuration only if needed
    if (connectionData.ssl) {
      connectionConfig.ssl = 'Amazon RDS';
    }

    const testConnection = await createConnection(connectionConfig);

    try {
      await testConnection.ping();
      await testConnection.end();
    } catch (error) {
      await testConnection.end().catch(() => {}); // Ignore cleanup errors
      throw new Error(
        `Database connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Discover schema for a database connection
   */
  public async discoverSchema(userId: string, connectionId: string): Promise<TableSchema[]> {
    try {
      // Verify user owns this connection
      const connection = await this.getConnection(userId, connectionId);
      if (!connection) {
        throw new Error('Connection not found');
      }

      const schemas = await this.databaseService.discoverSchema(connectionId);

      logger.info(`Schema discovered for connection ${connectionId}: ${schemas.length} tables`);
      return schemas;
    } catch (error) {
      logger.error(`Failed to discover schema for connection ${connectionId}:`, error);
      throw error;
    }
  }

  /**
   * Get connection statuses for all user connections
   */
  public async getConnectionStatuses(userId: string): Promise<Record<string, boolean>> {
    try {
      const connections = await this.getUserConnections(userId);
      const statuses: Record<string, boolean> = {};

      // Test each connection
      await Promise.all(
        connections.map(async connection => {
          const result = await this.testConnection(userId, connection.id);
          statuses[connection.id] = result.connected;
        })
      );

      return statuses;
    } catch (error) {
      logger.error(`Failed to get connection statuses for user ${userId}:`, error);
      throw error;
    }
  }
}
