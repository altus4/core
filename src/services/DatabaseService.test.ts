import type { DatabaseConnection } from '@/types';
import { DatabaseError } from '@/utils/database-errors';
import { logger } from '@/utils/logger';
import type { Pool, PoolConnection } from 'mysql2/promise';
import mysql from 'mysql2/promise';
import { DatabaseService } from './DatabaseService';

// Explicitly unmock the DatabaseService itself
jest.unmock('./DatabaseService');

// Mock dependencies
jest.mock('mysql2/promise');
jest.mock('@/utils/logger');

const mockMysql = mysql as jest.Mocked<typeof mysql>;
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('DatabaseService', () => {
  let databaseService: DatabaseService;
  let mockPool: jest.Mocked<Pool>;
  let mockConnection: jest.Mocked<PoolConnection>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mock connection
    mockConnection = {
      ping: jest.fn(),
      release: jest.fn(),
      execute: jest.fn(),
      config: { database: 'test_db' },
    } as any;

    // Create mock pool
    mockPool = {
      getConnection: jest.fn().mockResolvedValue(mockConnection),
      end: jest.fn(),
    } as any;

    // Mock mysql createPool
    mockMysql.createPool.mockReturnValue(mockPool);

    databaseService = new DatabaseService();
  });

  describe('addConnection', () => {
    const testDbConfig: DatabaseConnection = {
      id: 'test-db-1',
      name: 'Test Database',
      host: 'localhost',
      port: 3306,
      database: 'test_db',
      username: 'test_user',
      password: 'test_password',
      ssl: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
    };

    it('should successfully add a database connection', async () => {
      // Arrange
      mockConnection.ping.mockResolvedValue();

      // Act
      await databaseService.addConnection(testDbConfig);

      // Assert
      expect(mockMysql.createPool).toHaveBeenCalledWith({
        host: 'localhost',
        port: 3306,
        user: 'test_user',
        password: 'test_password',
        database: 'test_db',
        connectionLimit: 5,
        acquireTimeout: 60000,
        timeout: 60000,
        reconnect: true,
      });
      expect(mockPool.getConnection).toHaveBeenCalled();
      expect(mockConnection.ping).toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Database connection added: Test Database (test-db-1)'
      );
    });

    it('should configure SSL when ssl is true', async () => {
      // Arrange
      const sslConfig = { ...testDbConfig, ssl: true };
      mockConnection.ping.mockResolvedValue();

      // Act
      await databaseService.addConnection(sslConfig);

      // Assert
      expect(mockMysql.createPool).toHaveBeenCalledWith(
        expect.objectContaining({
          ssl: 'Amazon RDS',
        })
      );
    });

    it('should configure SSL when ssl is enabled', async () => {
      // Arrange
      const sslConfig = { ...testDbConfig, ssl: true };
      mockConnection.ping.mockResolvedValue();

      // Act
      await databaseService.addConnection(sslConfig);

      // Assert
      expect(mockMysql.createPool).toHaveBeenCalledWith(
        expect.objectContaining({
          ssl: 'Amazon RDS',
        })
      );
    });

    it('should handle connection errors and throw meaningful error', async () => {
      // Arrange
      const connectionError = { code: 'ECONNREFUSED', message: 'Connection refused' };
      mockPool.getConnection.mockRejectedValue(connectionError);

      // Act & Assert
      await expect(databaseService.addConnection(testDbConfig)).rejects.toThrow(DatabaseError);
      await expect(databaseService.addConnection(testDbConfig)).rejects.toThrow(
        'Unable to connect to the database server'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to add database connection Test Database:',
        expect.objectContaining({
          connectionId: testDbConfig.id,
          connectionName: testDbConfig.name,
          host: testDbConfig.host,
          code: 'CONNECTION_REFUSED',
          message: 'Unable to connect to the database server',
          suggestions: expect.arrayContaining(['Verify the database server is running']),
        })
      );
    });

    it('should handle ping errors and throw meaningful error', async () => {
      // Arrange
      const pingError = { code: 'ER_ACCESS_DENIED_ERROR', errno: 1045, message: 'Access denied' };
      mockConnection.ping.mockRejectedValue(pingError);

      // Act & Assert
      await expect(databaseService.addConnection(testDbConfig)).rejects.toThrow(DatabaseError);
      await expect(databaseService.addConnection(testDbConfig)).rejects.toThrow(
        'Database authentication failed'
      );
    });

    it('should handle authentication errors with specific suggestions', async () => {
      // Arrange
      const authError = {
        code: 'ER_ACCESS_DENIED_ERROR',
        errno: 1045,
        message: "Access denied for user 'testuser'@'localhost' (using password: YES)",
      };
      mockPool.getConnection.mockRejectedValue(authError);

      // Act & Assert
      await expect(databaseService.addConnection(testDbConfig)).rejects.toMatchObject({
        code: 'AUTHENTICATION_FAILED',
        message: 'Database authentication failed',
        statusCode: 401,
        suggestions: expect.arrayContaining([
          'Verify the username and password are correct',
          'Check if the user has permission to connect from this host',
        ]),
      });
    });

    it('should handle host not found errors', async () => {
      // Arrange
      const hostError = {
        code: 'ENOTFOUND',
        hostname: 'invalid-host.example.com',
        message: 'getaddrinfo ENOTFOUND invalid-host.example.com',
      };
      mockPool.getConnection.mockRejectedValue(hostError);

      // Act & Assert
      await expect(databaseService.addConnection(testDbConfig)).rejects.toMatchObject({
        code: 'HOST_NOT_FOUND',
        message: 'Database host could not be resolved: invalid-host.example.com',
        statusCode: 404,
        suggestions: expect.arrayContaining(['Check the hostname spelling in your configuration']),
      });
    });

    it('should handle database not found errors', async () => {
      // Arrange
      const dbError = {
        code: 'ER_BAD_DB_ERROR',
        errno: 1049,
        database: 'nonexistent_db',
        message: "Unknown database 'nonexistent_db'",
      };
      mockPool.getConnection.mockRejectedValue(dbError);

      // Act & Assert
      await expect(databaseService.addConnection(testDbConfig)).rejects.toMatchObject({
        code: 'DATABASE_NOT_FOUND',
        message: 'Database does not exist: nonexistent_db',
        statusCode: 404,
      });
    });

    it('should never log sensitive information', async () => {
      // Arrange
      const sensitiveError = {
        code: 'ER_ACCESS_DENIED_ERROR',
        message: "Access denied for user 'admin'@'localhost' (using password: YES)",
        password: 'super-secret-password',
        host: 'internal-server.company.com',
      };
      mockPool.getConnection.mockRejectedValue(sensitiveError);

      // Act
      await expect(databaseService.addConnection(testDbConfig)).rejects.toThrow();

      // Assert - check that sensitive data is not in logs
      const logCalls = mockLogger.error.mock.calls;
      const logData = JSON.stringify(logCalls);

      expect(logData).not.toContain('super-secret-password');
      expect(logData).not.toContain('internal-server.company.com');

      // Verify the logger was called with connection details but not sensitive error data
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to add database connection Test Database:'),
        expect.objectContaining({
          connectionName: 'Test Database',
          username: 'test_user',
          database: 'test_db',
        })
      );
    });
  });

  describe('removeConnection', () => {
    it('should remove existing connection', async () => {
      // Arrange - First add a connection
      const testDbConfig: DatabaseConnection = {
        id: 'test-db-1',
        name: 'Test Database',
        host: 'localhost',
        port: 3306,
        database: 'test_db',
        username: 'test_user',
        password: 'test_password',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
      };

      mockConnection.ping.mockResolvedValue();
      await databaseService.addConnection(testDbConfig);

      // Act
      await databaseService.removeConnection('test-db-1');

      // Assert
      expect(mockPool.end).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Database connection removed: test-db-1');
    });

    it('should handle non-existing connection gracefully', async () => {
      // Act
      await databaseService.removeConnection('non-existing-id');

      // Assert - should not call end or log anything
      expect(mockPool.end).not.toHaveBeenCalled();
    });
  });

  describe('testConnection', () => {
    it('should return true for successful connection test', async () => {
      // Arrange
      const testDbConfig: DatabaseConnection = {
        id: 'test-db-1',
        name: 'Test Database',
        host: 'localhost',
        port: 3306,
        database: 'test_db',
        username: 'test_user',
        password: 'test_password',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
      };

      mockConnection.ping.mockResolvedValue();
      await databaseService.addConnection(testDbConfig);

      // Act
      const result = await databaseService.testConnection('test-db-1');

      // Assert
      expect(result).toBe(true);
      expect(mockConnection.ping).toHaveBeenCalledTimes(2); // Once during add, once during test
    });

    it('should return false for failed connection test', async () => {
      // Arrange
      const testDbConfig: DatabaseConnection = {
        id: 'test-db-1',
        name: 'Test Database',
        host: 'localhost',
        port: 3306,
        database: 'test_db',
        username: 'test_user',
        password: 'test_password',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
      };

      // Add connection successfully
      mockConnection.ping.mockResolvedValue();
      await databaseService.addConnection(testDbConfig);

      // Make ping fail for the test
      mockConnection.ping.mockRejectedValue(new Error('Connection lost'));

      // Act
      const result = await databaseService.testConnection('test-db-1');

      // Assert
      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Connection test failed for test-db-1:',
        expect.objectContaining({
          connectionId: 'test-db-1',
          code: 'UNKNOWN',
          message: 'Database error: Connection lost',
        })
      );
    });

    it('should return false for non-existing connection', async () => {
      // Act
      const result = await databaseService.testConnection('non-existing-id');

      // Assert
      expect(result).toBe(false);
    });

    it('should handle getConnection errors with structured logging', async () => {
      // Arrange - add a connection first
      const testDbConfig: DatabaseConnection = {
        id: 'test-db-1',
        name: 'Test Database',
        host: 'localhost',
        port: 3306,
        database: 'test_db',
        username: 'test_user',
        password: 'test_password',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
      };

      mockConnection.ping.mockResolvedValue();
      await databaseService.addConnection(testDbConfig);

      // Make getConnection fail with a specific error
      const poolError = { code: 'ETIMEDOUT', message: 'Connection pool timeout' };
      mockPool.getConnection.mockRejectedValue(poolError);

      // Act
      const result = await databaseService.testConnection('test-db-1');

      // Assert
      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get connection for test-db-1:',
        expect.objectContaining({
          connectionId: 'test-db-1',
          code: 'TIMEOUT',
          message: 'Connection to database timed out',
          isRetryable: true,
        })
      );
    });
  });

  describe('discoverSchema', () => {
    it('should discover table schemas successfully', async () => {
      // Arrange
      const testDbConfig: DatabaseConnection = {
        id: 'test-db-1',
        name: 'Test Database',
        host: 'localhost',
        port: 3306,
        database: 'test_db',
        username: 'test_user',
        password: 'test_password',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
      };

      mockConnection.ping.mockResolvedValue();
      await databaseService.addConnection(testDbConfig);

      // Mock table discovery
      const mockTables = [{ Tables_in_test_db: 'users' }, { Tables_in_test_db: 'posts' }];
      const mockColumns = [
        { Field: 'id', Type: 'int(11)' },
        { Field: 'name', Type: 'varchar(255)' },
        { Field: 'content', Type: 'text' },
      ];
      const mockIndexes = [
        { Key_name: 'content_idx', Column_name: 'content', Index_type: 'FULLTEXT' },
      ];
      const mockRowCount = [{ TABLE_ROWS: 1000 }];

      mockConnection.execute
        .mockResolvedValueOnce([mockTables, []] as any) // SHOW TABLES
        .mockResolvedValueOnce([mockColumns, []] as any) // DESCRIBE users
        .mockResolvedValueOnce([mockIndexes, []] as any) // SHOW INDEX FROM users
        .mockResolvedValueOnce([mockRowCount, []] as any) // SELECT TABLE_ROWS
        .mockResolvedValueOnce([mockColumns, []] as any) // DESCRIBE posts
        .mockResolvedValueOnce([[], []] as any) // SHOW INDEX FROM posts (no indexes)
        .mockResolvedValueOnce([mockRowCount, []] as any); // SELECT TABLE_ROWS

      // Act
      const schemas = await databaseService.discoverSchema('test-db-1');

      // Assert
      expect(schemas).toHaveLength(2);
      expect(schemas[0]).toMatchObject({
        database: 'test_db',
        table: 'users',
        columns: expect.arrayContaining([
          expect.objectContaining({
            name: 'content',
            type: 'text',
            isFullTextIndexed: true,
            isSearchable: true,
          }),
        ]),
        fullTextIndexes: [
          {
            name: 'content_idx',
            columns: ['content'],
            type: 'FULLTEXT',
          },
        ],
        estimatedRows: 1000,
      });

      expect(mockConnection.release).toHaveBeenCalled();
    });

    it('should handle database errors during schema discovery', async () => {
      // Arrange
      const testDbConfig: DatabaseConnection = {
        id: 'test-db-1',
        name: 'Test Database',
        host: 'localhost',
        port: 3306,
        database: 'test_db',
        username: 'test_user',
        password: 'test_password',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
      };

      mockConnection.ping.mockResolvedValue();
      await databaseService.addConnection(testDbConfig);

      const dbError = new Error('Access denied');
      mockConnection.execute.mockRejectedValue(dbError);

      // Act & Assert
      await expect(databaseService.discoverSchema('test-db-1')).rejects.toThrow('Access denied');
      expect(mockConnection.release).toHaveBeenCalled();
    });
  });

  describe('executeFullTextSearch', () => {
    it('should execute full-text search successfully', async () => {
      // Arrange
      const testDbConfig: DatabaseConnection = {
        id: 'test-db-1',
        name: 'Test Database',
        host: 'localhost',
        port: 3306,
        database: 'test_db',
        username: 'test_user',
        password: 'test_password',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
      };

      mockConnection.ping.mockResolvedValue();
      await databaseService.addConnection(testDbConfig);

      // Mock indexes and search results
      const mockIndexes = [
        { Key_name: 'content_idx', Column_name: 'content', Index_type: 'FULLTEXT' },
        { Key_name: 'content_idx', Column_name: 'title', Index_type: 'FULLTEXT' },
      ];
      const mockSearchResults = [
        {
          table_name: 'posts',
          content: 'Test content here',
          title: 'Test title',
          relevance_score: 0.95,
        },
      ];

      mockConnection.execute
        .mockResolvedValueOnce([mockIndexes, []] as any) // SHOW INDEX
        .mockResolvedValueOnce([mockSearchResults, []] as any); // Search query

      // Act
      const results = await databaseService.executeFullTextSearch(
        'test-db-1',
        'test query',
        ['posts'],
        ['content', 'title'],
        20,
        0
      );

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        table_name: 'posts',
        content: 'Test content here',
        title: 'Test title',
        relevance_score: 0.95,
      });
      expect(mockConnection.release).toHaveBeenCalled();
    });

    it('should handle tables with no full-text indexes', async () => {
      // Arrange
      const testDbConfig: DatabaseConnection = {
        id: 'test-db-1',
        name: 'Test Database',
        host: 'localhost',
        port: 3306,
        database: 'test_db',
        username: 'test_user',
        password: 'test_password',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
      };

      mockConnection.ping.mockResolvedValue();
      await databaseService.addConnection(testDbConfig);

      // Mock empty indexes
      mockConnection.execute.mockResolvedValue([[], []] as any);

      // Act
      const results = await databaseService.executeFullTextSearch('test-db-1', 'test query', [
        'posts',
      ]);

      // Assert
      expect(results).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith('No full-text indexes found for table: posts');
    });
  });

  describe('getSearchSuggestions', () => {
    it('should return search suggestions', async () => {
      // Arrange
      const testDbConfig: DatabaseConnection = {
        id: 'test-db-1',
        name: 'Test Database',
        host: 'localhost',
        port: 3306,
        database: 'test_db',
        username: 'test_user',
        password: 'test_password',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
      };

      mockConnection.ping.mockResolvedValue();
      await databaseService.addConnection(testDbConfig);

      const mockIndexes = [{ Column_name: 'title' }];
      const mockSuggestions = [{ title: 'database design' }, { title: 'database optimization' }];

      mockConnection.execute
        .mockResolvedValueOnce([mockIndexes, []] as any) // SHOW INDEX
        .mockResolvedValueOnce([mockSuggestions, []] as any); // Suggestions query

      // Act
      const suggestions = await databaseService.getSearchSuggestions(
        'test-db-1',
        'datab',
        ['posts'],
        5
      );

      // Assert
      expect(suggestions).toEqual(['database design', 'database optimization']);
      expect(mockConnection.release).toHaveBeenCalled();
    });
  });

  describe('analyzeQueryPerformance', () => {
    it('should analyze query performance using EXPLAIN', async () => {
      // Arrange
      const testDbConfig: DatabaseConnection = {
        id: 'test-db-1',
        name: 'Test Database',
        host: 'localhost',
        port: 3306,
        database: 'test_db',
        username: 'test_user',
        password: 'test_password',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
      };

      mockConnection.ping.mockResolvedValue();
      await databaseService.addConnection(testDbConfig);

      const mockExplanation = [
        { id: 1, select_type: 'SIMPLE', table: 'posts', type: 'fulltext', key: 'content_idx' },
      ];

      mockConnection.execute.mockResolvedValue([mockExplanation, []] as any);

      // Act
      const explanation = await databaseService.analyzeQueryPerformance(
        'test-db-1',
        'SELECT * FROM posts'
      );

      // Assert
      expect(explanation).toEqual(mockExplanation);
      expect(mockConnection.execute).toHaveBeenCalledWith('EXPLAIN SELECT * FROM posts');
      expect(mockConnection.release).toHaveBeenCalled();
    });
  });

  describe('closeAllConnections', () => {
    it('should close all database connections', async () => {
      // Arrange - Add two connections
      const testDbConfig1: DatabaseConnection = {
        id: 'test-db-1',
        name: 'Test Database 1',
        host: 'localhost',
        port: 3306,
        database: 'test_db1',
        username: 'test_user',
        password: 'test_password',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
      };

      const testDbConfig2: DatabaseConnection = {
        id: 'test-db-2',
        name: 'Test Database 2',
        host: 'localhost',
        port: 3306,
        database: 'test_db2',
        username: 'test_user',
        password: 'test_password',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
      };

      const mockPool2 = {
        getConnection: jest.fn().mockResolvedValue(mockConnection),
        end: jest.fn(),
      } as any;

      mockMysql.createPool.mockReturnValueOnce(mockPool).mockReturnValueOnce(mockPool2);

      mockConnection.ping.mockResolvedValue();
      await databaseService.addConnection(testDbConfig1);
      await databaseService.addConnection(testDbConfig2);

      // Act
      await databaseService.closeAllConnections();

      // Assert
      expect(mockPool.end).toHaveBeenCalled();
      expect(mockPool2.end).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('All database connections closed');
    });
  });

  describe('getConnectionStatuses', () => {
    it('should return connection statuses for all databases', async () => {
      // Arrange
      const testDbConfig1: DatabaseConnection = {
        id: 'test-db-1',
        name: 'Test Database 1',
        host: 'localhost',
        port: 3306,
        database: 'test_db1',
        username: 'test_user',
        password: 'test_password',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
      };

      const testDbConfig2: DatabaseConnection = {
        id: 'test-db-2',
        name: 'Test Database 2',
        host: 'localhost',
        port: 3306,
        database: 'test_db2',
        username: 'test_user',
        password: 'test_password',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
      };

      mockConnection.ping.mockResolvedValue();
      await databaseService.addConnection(testDbConfig1);
      await databaseService.addConnection(testDbConfig2);

      // Act
      const statuses = await databaseService.getConnectionStatuses();

      // Assert
      expect(statuses).toEqual({
        'test-db-1': true,
        'test-db-2': true,
      });
    });
  });
});
