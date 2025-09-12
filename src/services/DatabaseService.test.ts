/**
 * DatabaseService Unit Tests
 *
 * Comprehensive test suite for DatabaseService using isolated test utilities
 * to ensure proper test isolation and prevent mock interference.
 */

import { EncryptionUtil } from '@/utils/encryption';
import { logger } from '@/utils/logger';
import { DatabaseTestUtils } from '../../tests/helpers/database-test-utils';
import { DatabaseService } from './DatabaseService';

// Mock dependencies
jest.mock('@/utils/logger');
jest.mock('@/utils/encryption');
jest.mock('mysql2/promise');

const mockLogger = logger as jest.Mocked<typeof logger>;
const mockEncryptionUtil = EncryptionUtil as jest.Mocked<typeof EncryptionUtil>;

describe('DatabaseService', () => {
  afterAll(() => {
    DatabaseTestUtils.cleanup();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create DatabaseService instance', () => {
      const { service, cleanup } = DatabaseTestUtils.createIsolatedService();
      expect(service).toBeInstanceOf(DatabaseService);
      cleanup();
    });
  });

  describe('addConnection', () => {
    it('should successfully add a database connection', async () => {
      const { service, mocks, cleanup } = DatabaseTestUtils.createIsolatedService({
        connectionId: 'test-conn',
        skipConnectionSetup: true, // We want to test the actual addConnection method
      });

      const dbConfig = DatabaseTestUtils.createTestConnectionConfig({
        id: 'test-conn',
        name: 'Test Connection',
      });

      await service.addConnection(dbConfig);

      expect(mocks.pool.getConnection).toHaveBeenCalled();
      expect(mocks.connection.ping).toHaveBeenCalled();
      expect(mocks.connection.release).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Database connection added: Test Connection (test-conn)'
      );

      cleanup();
    });

    it('should configure SSL based on environment (development)', async () => {
      const { service, mocks, cleanup } = DatabaseTestUtils.createIsolatedService({
        connectionId: 'ssl-conn',
        skipConnectionSetup: true,
      });

      const dbConfig = DatabaseTestUtils.createTestConnectionConfig({
        id: 'ssl-conn',
      });

      await service.addConnection(dbConfig);

      // In test/development environment, SSL should not be configured
      expect(mocks.mysql.createPool).toHaveBeenCalledWith(
        expect.not.objectContaining({
          ssl: expect.anything(),
        })
      );

      cleanup();
    });

    it('should configure SSL for production environment', async () => {
      // Mock production environment by temporarily overriding the config environment
      const { service, mocks, cleanup } = DatabaseTestUtils.createIsolatedService({
        connectionId: 'production-ssl-conn',
        skipConnectionSetup: true,
      });

      // Mock the getSSLConfig method to return production SSL config
      const originalGetSSLConfig = (service as any).getSSLConfig;
      (service as any).getSSLConfig = () => ({
        rejectUnauthorized: false,
      });

      const dbConfig = DatabaseTestUtils.createTestConnectionConfig({
        id: 'production-ssl-conn',
      });

      await service.addConnection(dbConfig);

      expect(mocks.mysql.createPool).toHaveBeenCalledWith(
        expect.objectContaining({
          ssl: {
            rejectUnauthorized: false,
          },
        })
      );

      // Restore original method
      (service as any).getSSLConfig = originalGetSSLConfig;
      cleanup();
    });

    it('should handle connection errors and throw meaningful error', async () => {
      const { service, cleanup } = DatabaseTestUtils.createIsolatedService({
        connectionId: 'fail-conn',
        skipConnectionSetup: true,
        mockResponses: {
          shouldPingFail: true,
        },
      });

      const dbConfig = DatabaseTestUtils.createTestConnectionConfig({
        id: 'fail-conn',
        name: 'Failing Connection',
      });

      await expect(service.addConnection(dbConfig)).rejects.toThrow(
        'Database connection failed: Ping failed'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to add database connection Failing Connection:',
        expect.any(Error)
      );

      cleanup();
    });
  });

  describe('removeConnection', () => {
    it('should remove existing connection', async () => {
      const { service, mocks, cleanup } = DatabaseTestUtils.createIsolatedService({
        connectionId: 'remove-test',
      });

      await service.removeConnection('remove-test');

      expect(mocks.pool.end).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Database connection removed: remove-test');

      cleanup();
    });

    it('should handle non-existing connection gracefully', async () => {
      const { service, cleanup } = DatabaseTestUtils.createIsolatedService();

      // Should not throw error or log warnings for non-existent connections
      await expect(service.removeConnection('non-existent')).resolves.toBeUndefined();

      // No warning should be logged for non-existent connections
      expect(mockLogger.warn).not.toHaveBeenCalled();

      cleanup();
    });
  });

  describe('testConnection', () => {
    it('should return true for successful connection test', async () => {
      const { service, cleanup } = DatabaseTestUtils.createIsolatedService({
        connectionId: 'test-success',
      });

      const result = await service.testConnection('test-success');

      expect(result).toBe(true);

      cleanup();
    });

    it('should return false for failed connection test', async () => {
      const { service, cleanup } = DatabaseTestUtils.createIsolatedService({
        connectionId: 'test-fail',
        mockResponses: {
          shouldPingFail: true,
        },
      });

      const result = await service.testConnection('test-fail');

      expect(result).toBe(false);

      cleanup();
    });

    it('should return false for non-existing connection', async () => {
      const { service, cleanup } = DatabaseTestUtils.createIsolatedService();

      const result = await service.testConnection('non-existent');

      expect(result).toBe(false);

      cleanup();
    });
  });

  describe('executeFullTextSearch', () => {
    it('should execute full-text search successfully', async () => {
      const responses = DatabaseTestUtils.createMockResponses();
      const { service, mocks, cleanup } = DatabaseTestUtils.createIsolatedService({
        connectionId: 'search-db',
        mockResponses: {
          executeResponses: [responses.fulltextIndexes, responses.searchResults],
        },
      });

      const results = await service.executeFullTextSearch(
        'search-db',
        'test query',
        ['posts'],
        ['content', 'title']
      );

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        table_name: 'posts',
        content: 'Test content here',
        title: 'Test title',
        relevance_score: 0.95,
      });
      expect(mocks.connection.release).toHaveBeenCalled();

      cleanup();
    });

    it('should handle tables with no full-text indexes', async () => {
      const responses = DatabaseTestUtils.createMockResponses();
      const { service, mocks, cleanup } = DatabaseTestUtils.createIsolatedService({
        connectionId: 'no-indexes-db',
        mockResponses: {
          executeResponses: [responses.empty], // No indexes found
        },
      });

      const results = await service.executeFullTextSearch('no-indexes-db', 'test query', ['posts']);

      expect(results).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith('No full-text indexes found for table: posts');
      expect(mocks.connection.release).toHaveBeenCalled();

      cleanup();
    });

    it('should skip columns not in filter and return empty if nothing to search', async () => {
      const { service, mocks, cleanup } = DatabaseTestUtils.createIsolatedService({
        connectionId: 'filter-test-db',
        mockResponses: {
          executeResponses: [
            // Return indexes that don't match the column filter
            [[{ Column_name: 'content', Key_name: 'idx' }], []],
          ],
        },
      });

      const results = await service.executeFullTextSearch(
        'filter-test-db',
        'query',
        ['table1'],
        ['title'] // Filter for 'title' but indexes only have 'content'
      );

      expect(results).toEqual([]);
      expect(mocks.connection.release).toHaveBeenCalled();

      cleanup();
    });
  });

  describe('getSearchSuggestions', () => {
    it('should return search suggestions', async () => {
      const responses = DatabaseTestUtils.createMockResponses();
      const { service, mocks, cleanup } = DatabaseTestUtils.createIsolatedService({
        connectionId: 'suggestions-db',
        mockResponses: {
          executeResponses: [
            [[{ Column_name: 'title' }], []], // Index query
            responses.suggestions, // Suggestions query
          ],
        },
      });

      const suggestions = await service.getSearchSuggestions(
        'suggestions-db',
        'datab',
        ['posts'],
        5
      );

      expect(suggestions).toEqual(['database design', 'database optimization']);
      expect(mocks.connection.release).toHaveBeenCalled();

      cleanup();
    });
  });

  describe('discoverSchema', () => {
    it('should discover table schemas successfully', async () => {
      const responses = DatabaseTestUtils.createMockResponses();
      const { service, mocks, cleanup } = DatabaseTestUtils.createIsolatedService({
        connectionId: 'schema-db',
        mockResponses: {
          executeResponses: [
            responses.tables, // SHOW TABLES
            responses.columns, // DESCRIBE table
            responses.fulltextIndexes, // SHOW INDEX FROM table WHERE Index_type = 'FULLTEXT'
            [[{ TABLE_ROWS: 42 }], []], // SELECT TABLE_ROWS from information_schema.TABLES
          ],
        },
      });

      const schema = await service.discoverSchema('schema-db');

      expect(schema).toHaveLength(1);
      expect(schema[0]).toMatchObject({
        database: 'test_db',
        table: 'posts',
        columns: expect.arrayContaining([
          expect.objectContaining({ name: 'id', type: 'int' }),
          expect.objectContaining({ name: 'title', type: 'varchar(255)' }),
          expect.objectContaining({ name: 'content', type: 'text' }),
        ]),
        fullTextIndexes: expect.any(Array),
        estimatedRows: 42,
        lastAnalyzed: expect.any(Date),
      });
      expect(mocks.connection.release).toHaveBeenCalled();

      cleanup();
    });

    it('should handle database errors during schema discovery', async () => {
      const { service, cleanup } = DatabaseTestUtils.createIsolatedService({
        connectionId: 'schema-error-db',
        mockResponses: {
          shouldExecuteFail: true,
        },
      });

      await expect(service.discoverSchema('schema-error-db')).rejects.toThrow('Execute failed');

      cleanup();
    });
  });

  describe('analyzeQueryPerformance', () => {
    it('should analyze query performance using EXPLAIN', async () => {
      const responses = DatabaseTestUtils.createMockResponses();
      const { service, mocks, cleanup } = DatabaseTestUtils.createIsolatedService({
        connectionId: 'performance-db',
        mockResponses: {
          executeResponses: [responses.explainResult],
        },
      });

      const analysis = await service.analyzeQueryPerformance(
        'performance-db',
        'SELECT * FROM posts'
      );

      // Should return raw EXPLAIN results
      expect(analysis).toEqual([
        { id: 1, select_type: 'SIMPLE', table: 'posts', type: 'fulltext' },
      ]);
      expect(mocks.connection.release).toHaveBeenCalled();

      cleanup();
    });
  });

  describe('closeAllConnections', () => {
    it('should close all database connections', async () => {
      const { service, cleanup } = DatabaseTestUtils.createIsolatedService();

      // Add multiple connections
      const pool1 = { end: jest.fn().mockResolvedValue(undefined) };
      const pool2 = { end: jest.fn().mockResolvedValue(undefined) };
      (service as any).connections.set('db1', pool1);
      (service as any).connections.set('db2', pool2);

      await service.closeAllConnections();

      expect(pool1.end).toHaveBeenCalled();
      expect(pool2.end).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('All database connections closed');

      cleanup();
    });
  });

  describe('getConnectionStatuses', () => {
    it('should return connection statuses for all databases', async () => {
      const { service, cleanup } = DatabaseTestUtils.createIsolatedService({
        connectionId: 'status-db',
      });

      const statuses = await service.getConnectionStatuses();

      // Should return a Record<string, boolean> format
      expect(statuses).toEqual({
        'status-db': true,
      });

      cleanup();
    });
  });

  describe('encryption fallback', () => {
    it('should fall back to empty password if decryption fails', async () => {
      // Mock EncryptionUtil.decrypt to throw an error
      mockEncryptionUtil.decrypt = jest.fn().mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      const { service, mocks, cleanup } = DatabaseTestUtils.createIsolatedService({
        connectionId: 'encryption-test',
        skipConnectionSetup: true,
      });

      // Mock metaConnection to return connection with encrypted password
      const mockMetaConn = {
        execute: jest.fn().mockResolvedValue([
          [
            {
              id: 'encryption-test',
              host: 'localhost',
              port: 3306,
              username: 'user',
              database_name: 'db',
              password: null,
              password_encrypted: 'invalid:tag:cipher',
              ssl_enabled: 0,
              is_active: 1,
            },
          ],
          [],
        ]),
      };

      // Override the metaConnection property
      Object.defineProperty(service, 'metaConnection', {
        get: () => Promise.resolve(mockMetaConn),
        configurable: true,
      });

      // Mock createPool to verify empty password is used
      mocks.mysql.createPool = jest.fn().mockImplementation((config: any) => {
        expect(config.password).toBe('');
        return mocks.pool;
      });

      const result = await service.testConnection('encryption-test');
      expect(result).toBe(true);
      expect(mockEncryptionUtil.decrypt).toHaveBeenCalledWith('invalid:tag:cipher');

      cleanup();
    });
  });
});
