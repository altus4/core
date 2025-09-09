/**
 * Database Testing Utilities
 *
 * Provides reusable mock components for testing DatabaseService
 * with proper isolation and configurable behavior.
 */

import mysql from 'mysql2/promise';
import { DatabaseService } from '@/services/DatabaseService';
import type { DatabaseConnection } from '@/types';

export interface MockConnectionConfig {
  executeResponses?: any[][];
  shouldPingFail?: boolean;
  shouldExecuteFail?: boolean;
  customExecuteImpl?: jest.Mock;
}

export interface MockDatabaseConfig {
  connectionId: string;
  mockResponses?: MockConnectionConfig;
  skipConnectionSetup?: boolean;
}

export class DatabaseTestUtils {
  private static originalCreateConnection: any;
  private static originalCreatePool: any;

  /**
   * Create an isolated DatabaseService instance with properly mocked dependencies
   */
  static createIsolatedService(config: MockDatabaseConfig = { connectionId: 'test-db' }): {
    service: DatabaseService;
    mocks: {
      connection: any;
      pool: any;
      mysql: typeof mysql;
    };
    cleanup: () => void;
  } {
    // Store original methods if not already stored
    if (!this.originalCreateConnection) {
      this.originalCreateConnection = mysql.createConnection;
      this.originalCreatePool = mysql.createPool;
    }

    // Create mock connection with configurable behavior
    const mockConnection = {
      ping: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
      execute: config.mockResponses?.customExecuteImpl || jest.fn(),
      config: { database: 'test_db' },
    };

    // Configure connection behavior
    if (config.mockResponses?.shouldPingFail) {
      mockConnection.ping.mockRejectedValue(new Error('Ping failed'));
    }

    if (config.mockResponses?.shouldExecuteFail) {
      mockConnection.execute.mockRejectedValue(new Error('Execute failed'));
    }

    // Set up default execute responses
    if (config.mockResponses?.executeResponses) {
      config.mockResponses.executeResponses.forEach(response => {
        mockConnection.execute.mockResolvedValueOnce(response);
      });
    }

    // Create mock pool
    const mockPool = {
      getConnection: jest.fn().mockResolvedValue(mockConnection),
      end: jest.fn().mockResolvedValue(undefined),
    };

    // Mock MySQL methods
    mysql.createConnection = jest.fn().mockResolvedValue({
      ping: jest.fn().mockResolvedValue(undefined),
      execute: jest.fn(),
    });
    mysql.createPool = jest.fn().mockReturnValue(mockPool);

    // Create service instance
    const service = new DatabaseService();

    // Set up connection in service if requested
    if (!config.skipConnectionSetup) {
      (service as any).connections.set(config.connectionId, mockPool);
    }

    // Return service, mocks, and cleanup function
    return {
      service,
      mocks: {
        connection: mockConnection,
        pool: mockPool,
        mysql,
      },
      cleanup: () => {
        // Restore original MySQL methods
        mysql.createConnection = this.originalCreateConnection;
        mysql.createPool = this.originalCreatePool;
      },
    };
  }

  /**
   * Create a standard database connection config for testing
   */
  static createTestConnectionConfig(
    overrides: Partial<DatabaseConnection> = {}
  ): DatabaseConnection {
    return {
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
      ...overrides,
    };
  }

  /**
   * Create mock responses for common database operations
   */
  static createMockResponses() {
    return {
      // Empty result set
      empty: [[], []],

      // Full-text search indexes
      fulltextIndexes: [
        [
          { Key_name: 'content_idx', Column_name: 'content', Index_type: 'FULLTEXT' },
          { Key_name: 'content_idx', Column_name: 'title', Index_type: 'FULLTEXT' },
        ],
        [],
      ],

      // Search results
      searchResults: [
        [
          {
            table_name: 'posts',
            content: 'Test content here',
            title: 'Test title',
            relevance_score: 0.95,
          },
        ],
        [],
      ],

      // Search suggestions
      suggestions: [[{ title: 'database design' }, { title: 'database optimization' }], []],

      // Schema information (SHOW TABLES format)
      tables: [[{ Tables_in_test_db: 'posts' }], []],
      columns: [
        [
          { Field: 'id', Type: 'int' },
          { Field: 'title', Type: 'varchar(255)' },
          { Field: 'content', Type: 'text' },
        ],
        [],
      ],

      // Performance analysis
      explainResult: [[{ id: 1, select_type: 'SIMPLE', table: 'posts', type: 'fulltext' }], []],

      // Generic success response
      success: [{ affectedRows: 1 }, []],
    };
  }

  /**
   * Clean up all test utilities (call in afterAll)
   */
  static cleanup() {
    if (this.originalCreateConnection) {
      mysql.createConnection = this.originalCreateConnection;
      mysql.createPool = this.originalCreatePool;
      this.originalCreateConnection = null;
      this.originalCreatePool = null;
    }
  }
}
