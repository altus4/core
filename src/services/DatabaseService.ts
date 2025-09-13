/**
 * DatabaseService
 *
 * Manages connections to multiple MySQL databases using connection pools.
 * Provides methods to add, remove, and interact with database connections.
 * Handles connection pooling, timeouts, and SSL configuration.
 *
 * Usage:
 *   - Add a new connection with addConnection()
 *   - Remove a connection with removeConnection()
 *   - Interact with databases using other service methods
 */
import { config } from '@/config';
import type { ColumnInfo, DatabaseConnection, FullTextIndex, TableSchema } from '@/types';
import { EncryptionUtil } from '@/utils/encryption';
import { logger } from '@/utils/logger';
import { escape, escapeId } from 'mysql2';
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import mysql, { createConnection } from 'mysql2/promise';

export class DatabaseService {
  /**
   * Map of database connection pools, keyed by connection ID.
   */
  private connections: Map<string, Pool> = new Map();

  /**
   * Maximum number of connections per database pool.
   */
  private readonly maxConnections = 5;

  /**
   * Timeout (ms) for acquiring a connection from the pool.
   */
  private readonly acquireTimeout = 60000;

  /**
   * Timeout (ms) for establishing a new connection.
   */
  private readonly connectionTimeout = 60000;

  /**
   * Metadata connection to hydrate pools on-demand from stored records.
   */
  private metaConnection = createConnection({
    host: config.database.host,
    port: config.database.port,
    user: config.database.username,
    password: config.database.password,
    database: config.database.database,
    ssl: this.getSSLConfig(),
    connectTimeout: this.connectionTimeout,
  });

  /**
   * Get SSL configuration for database connections.
   * Heroku/AWS RDS requires SSL for security.
   */
  private getSSLConfig() {
    // In production (Heroku), we need SSL
    if (config.environment === 'production') {
      return {
        rejectUnauthorized: false, // ClearDB uses self-signed certificates
      };
    }
    // In development/test, SSL is typically not needed
    return undefined;
  }

  /**
   * Add a new database connection to the pool.
   *
   * @param dbConfig - Database connection configuration object
   * @throws Error if connection fails
   */
  public async addConnection(dbConfig: DatabaseConnection): Promise<void> {
    try {
      // Build pool configuration from dbConfig
      const poolConfig: any = {
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.username,
        password: dbConfig.password,
        database: dbConfig.database,
        connectionLimit: this.maxConnections,
        acquireTimeout: this.acquireTimeout,
        timeout: this.connectionTimeout,
        reconnect: true,
      };

      // Add SSL configuration
      const sslConfig = this.getSSLConfig();
      if (sslConfig) {
        poolConfig.ssl = sslConfig;
      }

      // Create a new connection pool
      const pool = mysql.createPool(poolConfig);

      // Test the connection by pinging the database
      const connection = await pool.getConnection();
      await connection.ping();
      connection.release();

      // Store the pool in the connections map
      this.connections.set(dbConfig.id, pool);
      logger.info(`Database connection added: ${dbConfig.name} (${dbConfig.id})`);
    } catch (error) {
      logger.error(`Failed to add database connection ${dbConfig.name}:`, error);
      throw new Error(
        `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Remove a database connection from the pool.
   *
   * @param connectionId - ID of the connection to remove
   */
  public async removeConnection(connectionId: string): Promise<void> {
    const pool = this.connections.get(connectionId);
    if (pool) {
      await pool.end();
      this.connections.delete(connectionId);
      logger.info(`Database connection removed: ${connectionId}`);
    }
  }

  /**
   * Get a connection from the pool
   */
  private async getConnection(connectionId: string): Promise<PoolConnection> {
    let pool = this.connections.get(connectionId);
    if (!pool) {
      // Hydrate from DB if possible
      try {
        const conn = await this.metaConnection;
        const [rows] = await conn.execute<RowDataPacket[]>(
          `SELECT id, name, host, port, database_name, username,
                  password, ssl_enabled, is_active
           FROM database_connections
           WHERE id = ? AND is_active = true`,
          [connectionId]
        );
        if (rows.length === 0) {
          throw new Error(`Database connection not found: ${connectionId}`);
        }
        const row = rows[0] as any;
        let { password } = row;
        try {
          password = EncryptionUtil.decrypt(row.password);
        } catch (e) {
          logger.error('Failed to decrypt stored database password:', e);
          // fall back to empty to avoid crashing; queries will likely fail
          password = '';
        }
        const poolConfig: any = {
          host: row.host,
          port: row.port,
          user: row.username,
          password,
          database: row.database_name ?? row.database,
          connectionLimit: this.maxConnections,
        };

        // Add SSL configuration
        const sslConfig = this.getSSLConfig();
        if (sslConfig) {
          poolConfig.ssl = sslConfig;
        }

        pool = mysql.createPool(poolConfig);
        this.connections.set(connectionId, pool);
      } catch (error) {
        logger.error(`Failed to hydrate connection for ${connectionId}:`, error);
        throw new Error(`Database connection not found: ${connectionId}`);
      }
    }

    try {
      return await pool.getConnection();
    } catch (error) {
      logger.error(`Failed to get connection for ${connectionId}:`, error);
      throw error;
    }
  }

  /**
   * Test database connection
   */
  public async testConnection(connectionId: string): Promise<boolean> {
    try {
      const connection = await this.getConnection(connectionId);
      await connection.ping();
      connection.release();
      return true;
    } catch (error) {
      logger.error(`Connection test failed for ${connectionId}:`, error);
      return false;
    }
  }

  /**
   * Discover table schemas and full-text indexes
   */
  public async discoverSchema(connectionId: string): Promise<TableSchema[]> {
    const connection = await this.getConnection(connectionId);

    try {
      // Get all tables
      const [tables] = await connection.execute<RowDataPacket[]>('SHOW TABLES');

      const schemas: TableSchema[] = [];

      for (const tableRow of tables) {
        const tableName = Object.values(tableRow)[0] as string;

        // Get column information
        const [columns] = await connection.execute<RowDataPacket[]>(
          `DESCRIBE ${escapeId(tableName)}`
        );

        // Get full-text indexes
        const [indexes] = await connection.execute<RowDataPacket[]>(
          `SHOW INDEX FROM ${escapeId(tableName)} WHERE Index_type = ?`,
          ['FULLTEXT']
        );

        // Get estimated row count
        const [rowCount] = await connection.execute<RowDataPacket[]>(
          'SELECT TABLE_ROWS FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
          [tableName]
        );

        const columnInfo: ColumnInfo[] = columns.map(col => ({
          name: col.Field,
          type: col.Type,
          isFullTextIndexed: indexes.some(idx => idx.Column_name === col.Field),
          isSearchable: this.isColumnSearchable(col.Type),
        }));

        const fullTextIndexes: FullTextIndex[] = this.groupIndexesByName(indexes);

        schemas.push({
          database: connection.config.database || 'unknown',
          table: tableName,
          columns: columnInfo,
          fullTextIndexes,
          estimatedRows: rowCount[0]?.TABLE_ROWS || 0,
          lastAnalyzed: new Date(),
        });
      }

      return schemas;
    } finally {
      connection.release();
    }
  }

  /**
   * Execute full-text search query
   */
  public async executeFullTextSearch(
    connectionId: string,
    query: string,
    tables: string[],
    columns?: string[],
    limit: number = 20,
    offset: number = 0
  ): Promise<any[]> {
    const connection = await this.getConnection(connectionId);

    try {
      const searchQueries: string[] = [];
      const fallbackRows: RowDataPacket[] = [];

      for (const table of tables) {
        // Get full-text indexed columns for this table
        const [indexes] = await connection.execute<RowDataPacket[]>(
          `SHOW INDEX FROM ${escapeId(table)} WHERE Index_type = ?`,
          ['FULLTEXT']
        );

        if (indexes.length === 0) {
          logger.warn(
            `No full-text indexes found for table: ${table}, falling back to LIKE search`
          );

          // Fallback: perform a parameterized LIKE search across the requested columns
          const likeColumns =
            columns && columns.length > 0 ? columns.map(col => escapeId(col)) : ['*'];

          // If no specific columns provided, attempt to discover text-like columns
          let fallbackColumns = likeColumns;
          if (likeColumns.length === 1 && likeColumns[0] === '*') {
            // Describe table to find candidate columns
            const [cols] = await connection.execute<RowDataPacket[]>(`DESCRIBE ${escapeId(table)}`);
            fallbackColumns = cols
              .filter((c: any) => /char|text|varchar|blob|longtext|mediumtext/i.test(c.Type))
              .map((c: any) => escapeId(c.Field));
          }

          if (fallbackColumns.length === 0) {
            logger.warn(`No text-like columns found for fallback search on table: ${table}`);
            continue;
          }

          // Build WHERE clauses with LIKE for each column
          const likeClauses = fallbackColumns.map(col => `${col} LIKE ?`).join(' OR ');
          const escapedTable = escapeId(table);
          const sql = `SELECT ${escape(table)} as table_name, ${fallbackColumns.join(
            ', '
          )}, 0 as relevance_score FROM ${escapedTable} WHERE ${likeClauses} LIMIT ${Number(
            limit
          )} OFFSET ${Number(offset)}`;

          const likeParam = `%${query}%`;
          const params = [...Array(fallbackColumns.length).fill(likeParam)];

          const [rows] = await connection.execute<RowDataPacket[]>(sql, params);
          fallbackRows.push(...(rows as RowDataPacket[]));
          continue;
        }

        // Group columns by index name
        const indexGroups = this.groupIndexesByName(indexes);

        for (const index of indexGroups) {
          const columnsToSearch = columns
            ? index.columns.filter(col => columns.includes(col))
            : index.columns;

          if (columnsToSearch.length === 0) {
            continue;
          }

          // Escape column identifiers and table name to avoid SQL syntax errors
          const columnList = columnsToSearch.map(col => escapeId(col)).join(', ');
          const selectColumns = columnsToSearch.map(col => escapeId(col)).join(', ');
          const escapedTable = escapeId(table);

          const escapedQuery = escape(query);
          const searchQuery = `
            SELECT
              ${escape(table)} as table_name,
              ${selectColumns},
              MATCH(${columnList}) AGAINST(${escapedQuery} IN NATURAL LANGUAGE MODE) as relevance_score
            FROM ${escapedTable}
            WHERE MATCH(${columnList}) AGAINST(${escapedQuery} IN NATURAL LANGUAGE MODE)
          `;

          searchQueries.push(searchQuery);
        }
      }

      if (searchQueries.length === 0) {
        if (fallbackRows.length > 0) {
          return fallbackRows;
        }
        return [];
      }

      // Combine all search queries with UNION and order by relevance
      const combinedQuery = `
        ${searchQueries.join(' UNION ALL ')}
        ORDER BY relevance_score DESC
        LIMIT ${Number(limit)} OFFSET ${Number(offset)}
      `;

      const [results] = await connection.execute<RowDataPacket[]>(combinedQuery);

      const resultsArray = (results as RowDataPacket[]).slice();
      if (fallbackRows.length > 0) {
        resultsArray.push(...fallbackRows);
      }

      return resultsArray;
    } finally {
      connection.release();
    }
  }

  /**
   * Get search suggestions based on existing data
   */
  public async getSearchSuggestions(
    connectionId: string,
    partialQuery: string,
    tables: string[],
    limit: number = 5
  ): Promise<string[]> {
    const connection = await this.getConnection(connectionId);

    try {
      const suggestions: Set<string> = new Set();

      for (const table of tables) {
        // Get full-text indexed columns
        const [indexes] = await connection.execute<RowDataPacket[]>(
          `SHOW INDEX FROM ${escapeId(table)} WHERE Index_type = ?`,
          ['FULLTEXT']
        );

        const columns = [...new Set(indexes.map(idx => idx.Column_name))];

        for (const column of columns) {
          const sql = `SELECT DISTINCT ${escapeId(column)} FROM ${escapeId(
            table
          )} WHERE ${escapeId(column)} LIKE ? LIMIT ?`;
          const [results] = await connection.execute<RowDataPacket[]>(sql, [
            `%${partialQuery}%`,
            limit,
          ]);

          results.forEach(row => {
            const value = row[column];
            if (
              typeof value === 'string' &&
              value.toLowerCase().includes(partialQuery.toLowerCase())
            ) {
              suggestions.add(value);
            }
          });
        }
      }

      return Array.from(suggestions).slice(0, limit);
    } finally {
      connection.release();
    }
  }

  /**
   * Analyze query performance and suggest optimizations
   */
  public async analyzeQueryPerformance(connectionId: string, query: string): Promise<any[]> {
    const connection = await this.getConnection(connectionId);

    try {
      // Use EXPLAIN to analyze the query
      const [explanation] = await connection.execute<RowDataPacket[]>(`EXPLAIN ${query}`);

      return explanation;
    } finally {
      connection.release();
    }
  }

  /**
   * Close all connections
   */
  public async closeAllConnections(): Promise<void> {
    const promises = Array.from(this.connections.values()).map(pool => pool.end());
    await Promise.all(promises);
    this.connections.clear();
    logger.info('All database connections closed');
  }

  /**
   * Helper method to determine if a column type is searchable
   */
  private isColumnSearchable(columnType: string): boolean {
    const searchableTypes = ['varchar', 'text', 'char', 'longtext', 'mediumtext', 'tinytext'];
    return searchableTypes.some(type => columnType.toLowerCase().includes(type));
  }

  /**
   * Helper method to group indexes by name
   */
  private groupIndexesByName(indexes: RowDataPacket[]): FullTextIndex[] {
    const grouped = new Map<string, string[]>();

    indexes.forEach(index => {
      const indexName = index.Key_name;
      const columnName = index.Column_name;

      if (!grouped.has(indexName)) {
        grouped.set(indexName, []);
      }
      grouped.get(indexName)!.push(columnName);
    });

    return Array.from(grouped.entries()).map(([name, columns]) => ({
      name,
      columns,
      type: 'FULLTEXT' as const,
    }));
  }

  /**
   * Get connection status for all databases
   */
  public async getConnectionStatuses(): Promise<Record<string, boolean>> {
    const statuses: Record<string, boolean> = {};

    for (const [connectionId] of this.connections) {
      statuses[connectionId] = await this.testConnection(connectionId);
    }

    return statuses;
  }
}
