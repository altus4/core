/**
 * Setup for Integration Tests
 *
 * This setup file is used specifically for integration tests and mocks
 * external services to prevent connection issues.
 */

import { logger } from '@/utils/logger';

// Set test environment
process.env.NODE_ENV = 'test';

// Configure logger for testing
logger.level = 'error'; // Only show errors during tests

// Suppress expected auth errors to keep test output clean
const originalLoggerError = logger.error.bind(logger);
logger.error = ((message: any, ...meta: any[]) => {
  const text = typeof message === 'string' ? message : `${message}`;
  if (
    text.includes('User registration failed: User with this email already exists') ||
    text.includes('User login failed: Invalid email or password') ||
    text.includes('Failed to change password for user')
  ) {
    // Swallow expected validation/auth errors during tests
    return undefined as any;
  }
  return (originalLoggerError as any)(message, ...meta);
}) as any;

// Global test timeout
jest.setTimeout(60000);

// Mock MySQL connections to prevent connection issues
jest.mock('mysql2/promise', () => {
  // In-memory storage for test data
  const mockData = {
    users: new Map(),
    apiKeys: new Map(),
    databaseConnections: new Map(),
    searchAnalytics: [] as any[],
  };

  const mockConnection = {
    config: { database: 'altus4_test' },
    execute: jest.fn().mockImplementation((query: string, params: any[] = []) => {
      // Handle user registration/creation
      if (query.includes('INSERT INTO users')) {
        if (params.length >= 5) {
          const [id, email, name, passwordHash, role] = params;
          const user = {
            id,
            email,
            name,
            password_hash: passwordHash,
            role,
            is_active: 1,
            created_at: new Date(),
            updated_at: new Date(),
            last_active: new Date(),
          };
          mockData.users.set(email, user);
          mockData.users.set(id, user);
        }
        return Promise.resolve([{ insertId: params[0], affectedRows: 1 }, {}]);
      }

      // Handle user login lookup
      if (query.includes('SELECT') && query.includes('FROM users WHERE email')) {
        const email = params[0];
        const user = mockData.users.get(email);
        return Promise.resolve([user ? [user] : [], {}]);
      }

      // Handle user lookup by ID
      if (query.includes('FROM users WHERE id') && query.includes('is_active = true')) {
        const id = params[0];
        const user =
          mockData.users.get(id) || Array.from(mockData.users.values()).find(u => u.id === id);
        return Promise.resolve([user ? [user] : [], {}]);
      }

      // Handle password hash lookup for password change
      if (query.includes('SELECT password_hash FROM users WHERE id = ?')) {
        const id = params[0];
        const user =
          mockData.users.get(id) || Array.from(mockData.users.values()).find(u => u.id === id);
        return Promise.resolve([user ? [{ password_hash: user.password_hash }] : [], {}]);
      }

      // Handle API key creation
      if (query.includes('INSERT INTO api_keys')) {
        const [
          id,
          userId,
          keyPrefix,
          keyHash,
          name,
          environment,
          permissions,
          rateLimitTier,
          expiresAt,
          isActive,
          createdAt,
          updatedAt,
        ] = params;
        const apiKey = {
          id,
          user_id: userId,
          key_prefix: keyPrefix,
          key_hash: keyHash,
          name,
          environment,
          permissions: Array.isArray(permissions) ? JSON.stringify(permissions) : permissions,
          rate_limit_tier: rateLimitTier,
          expires_at: expiresAt,
          is_active: isActive,
          created_at: createdAt || new Date(),
          updated_at: updatedAt || new Date(),
          usage_count: 0,
        };
        mockData.apiKeys.set(id, apiKey);
        return Promise.resolve([{ insertId: id, affectedRows: 1 }, {}]);
      }

      // Handle listing user's API keys
      if (
        query.includes('SELECT * FROM api_keys') &&
        query.includes('WHERE user_id = ?') &&
        query.includes('is_active = true')
      ) {
        const userId = params[0];
        const rows = Array.from(mockData.apiKeys.values())
          .filter((k: any) => k.user_id === userId && k.is_active)
          .map((k: any) => ({
            ...k,
          }));
        return Promise.resolve([rows, {}]);
      }

      // Handle selecting API key by id and user for update/return
      if (
        query.includes('SELECT * FROM api_keys') &&
        query.includes('WHERE id = ?') &&
        query.includes('user_id = ?')
      ) {
        const [keyId, userId] = params;
        const key = mockData.apiKeys.get(keyId);
        if (key && key.user_id === userId) {
          return Promise.resolve([[{ ...key }], {}]);
        }
        return Promise.resolve([[], {}]);
      }

      // Handle API key usage query
      if (
        query.includes('SELECT id, usage_count, last_used, rate_limit_tier FROM api_keys') &&
        query.includes('WHERE id = ?') &&
        query.includes('user_id = ?')
      ) {
        const [keyId, userId] = params;
        const key = mockData.apiKeys.get(keyId);
        if (key && key.user_id === userId) {
          const row = {
            id: key.id,
            usage_count: key.usage_count || 0,
            last_used: key.last_used || new Date(),
            rate_limit_tier: key.rate_limit_tier,
          };
          return Promise.resolve([[row], {}]);
        }
        return Promise.resolve([[], {}]);
      }

      // Handle API key revoke (deactivate)
      if (
        query.includes('UPDATE api_keys SET is_active = false') &&
        query.includes('WHERE id = ?') &&
        query.includes('user_id = ?')
      ) {
        const [updatedAt, keyId, userId] = params;
        const key = mockData.apiKeys.get(keyId);
        if (key && key.user_id === userId) {
          key.is_active = 0;
          key.updated_at = updatedAt || new Date();
          mockData.apiKeys.set(keyId, key);
          return Promise.resolve([{ affectedRows: 1 }, {}]);
        }
        return Promise.resolve([{ affectedRows: 0 }, {}]);
      }

      // Handle API key property updates (name/permissions/rate_limit_tier/expires_at)
      if (query.includes('UPDATE api_keys SET') && query.includes('WHERE id = ? AND user_id = ?')) {
        const keyId = params[params.length - 2];
        const userId = params[params.length - 1];
        const key = mockData.apiKeys.get(keyId);
        if (key && key.user_id === userId) {
          // Apply updates based on included fields
          let paramIdx = 0;
          if (query.includes('name = ?')) {
            key.name = params[paramIdx++];
          }
          if (query.includes('permissions = ?')) {
            const perms = params[paramIdx++];
            key.permissions = Array.isArray(perms) ? JSON.stringify(perms) : perms;
          }
          if (query.includes('rate_limit_tier = ?')) {
            key.rate_limit_tier = params[paramIdx++];
          }
          if (query.includes('expires_at = ?')) {
            key.expires_at = params[paramIdx++] || null;
          }
          if (query.includes('updated_at = ?')) {
            key.updated_at = params[paramIdx++] || new Date();
          }
          mockData.apiKeys.set(keyId, key);
          return Promise.resolve([{ affectedRows: 1 }, {}]);
        }
        return Promise.resolve([{ affectedRows: 0 }, {}]);
      }

      // Handle API key last_used update during validation
      if (
        query.includes('UPDATE api_keys SET last_used = ?') &&
        query.includes('usage_count = usage_count + 1') &&
        query.includes('WHERE id = ?')
      ) {
        const [lastUsed, keyId] = params;
        const key = mockData.apiKeys.get(keyId);
        if (key) {
          key.last_used = lastUsed || new Date();
          key.usage_count = (key.usage_count || 0) + 1;
          mockData.apiKeys.set(keyId, key);
          return Promise.resolve([{ affectedRows: 1 }, {}]);
        }
        return Promise.resolve([{ affectedRows: 0 }, {}]);
      }

      // Handle API key validation
      if (query.includes('FROM api_keys ak') && query.includes('JOIN users')) {
        const [, keyHash] = params;
        // Validate by hash only to avoid prefix length coupling in tests
        const apiKey = Array.from(mockData.apiKeys.values()).find(
          (k: any) => k.key_hash === keyHash && k.is_active
        );
        if (!apiKey) {
          return Promise.resolve([[], {}]);
        }
        const user = mockData.users.get((apiKey as any).user_id);
        const row = {
          ...apiKey,
          email: user?.email || 'user@example.com',
          name: user?.name || 'User',
          role: user?.role || 'user',
        };
        return Promise.resolve([[row], {}]);
      }

      // Handle user profile updates
      if (query.includes('UPDATE users SET') && query.includes('WHERE id = ?')) {
        const userId = params[params.length - 1]; // Last parameter is the user ID
        const user =
          mockData.users.get(userId) ||
          Array.from(mockData.users.values()).find(u => u.id === userId);
        if (user) {
          // Update user fields based on what's provided
          if (query.includes('name = ?')) {
            const nameIndex = params.findIndex(
              p => typeof p === 'string' && p.length > 1 && !p.includes('@')
            );
            if (nameIndex >= 0) {
              user.name = params[nameIndex];
            }
          }
          if (query.includes('email = ?')) {
            const emailIndex = params.findIndex(p => typeof p === 'string' && p.includes('@'));
            if (emailIndex >= 0) {
              user.email = params[emailIndex];
            }
          }
          user.updated_at = new Date();
          return Promise.resolve([{ affectedRows: 1 }, {}]);
        }
        return Promise.resolve([{ affectedRows: 0 }, {}]);
      }

      // Handle password changes
      if (query.includes('UPDATE users SET password_hash') && query.includes('WHERE id = ?')) {
        const [newPasswordHash, userId] = params;
        const user =
          mockData.users.get(userId) ||
          Array.from(mockData.users.values()).find(u => u.id === userId);
        if (user) {
          user.password_hash = newPasswordHash;
          user.updated_at = new Date();
          return Promise.resolve([{ affectedRows: 1 }, {}]);
        }
        return Promise.resolve([{ affectedRows: 0 }, {}]);
      }

      // Handle user deactivation
      if (query.includes('UPDATE users SET is_active = false') && query.includes('WHERE id = ?')) {
        const userId = params[0];
        const user =
          mockData.users.get(userId) ||
          Array.from(mockData.users.values()).find(u => u.id === userId);
        if (user) {
          user.is_active = 0;
          user.updated_at = new Date();
          return Promise.resolve([{ affectedRows: 1 }, {}]);
        }
        return Promise.resolve([{ affectedRows: 0 }, {}]);
      }

      // ===== Database connections handling =====
      // Insert database connection
      if (query.includes('INSERT INTO database_connections')) {
        const [
          id,
          userId,
          name,
          host,
          port,
          databaseName,
          username,
          passwordEncrypted,
          sslEnabled,
          isActive,
          createdAt,
          updatedAt,
          connectionStatus,
        ] = params;
        const row = {
          id,
          user_id: userId,
          name,
          host,
          port,
          database_name: databaseName,
          username,
          password: passwordEncrypted,
          password_encrypted: passwordEncrypted,
          ssl_enabled: !!sslEnabled,
          is_active: isActive,
          created_at: createdAt || new Date(),
          updated_at: updatedAt || new Date(),
          connection_status: connectionStatus || 'connected',
        };
        mockData.databaseConnections.set(id, row);
        return Promise.resolve([{ insertId: id, affectedRows: 1 }, {}]);
      }

      // List database connections for user
      if (
        query.includes(
          'SELECT id, name, host, port, database_name, username, ssl_enabled, is_active, created_at, updated_at FROM database_connections'
        ) &&
        query.includes('WHERE user_id = ?')
      ) {
        const userId = params[0];
        const rows = Array.from(mockData.databaseConnections.values())
          .filter((c: any) => c.user_id === userId && (c.is_active ?? true))
          .sort((a: any, b: any) => (b.created_at as any) - (a.created_at as any))
          .map((c: any) => ({ ...c }));
        return Promise.resolve([rows, {}]);
      }

      // Get a specific connection by id and user
      if (
        query.includes('SELECT * FROM database_connections') &&
        query.includes('WHERE id = ? AND user_id = ?')
      ) {
        const [id, userId] = params;
        const c = mockData.databaseConnections.get(id);
        if (c && c.user_id === userId && (c.is_active ?? true)) {
          return Promise.resolve([[{ ...c }], {}]);
        }
        return Promise.resolve([[], {}]);
      }

      // Hydration query used by DatabaseService.getConnection
      if (
        query.includes('SELECT id, name, host, port, database_name, username,') &&
        query.includes('FROM database_connections') &&
        query.includes('WHERE id = ?')
      ) {
        const [id] = params;
        const c = mockData.databaseConnections.get(id);
        if (c && (c.is_active ?? true)) {
          return Promise.resolve([[{ ...c }], {}]);
        }
        return Promise.resolve([[], {}]);
      }

      // Update database connection fields
      if (
        query.includes('UPDATE database_connections SET') &&
        query.includes('WHERE id = ? AND user_id = ?')
      ) {
        const id = params[params.length - 2];
        const userId = params[params.length - 1];
        const c = mockData.databaseConnections.get(id);
        if (!c || c.user_id !== userId) {
          return Promise.resolve([{ affectedRows: 0 }, {}]);
        }
        let idx = 0;
        if (query.includes('is_active = false')) {
          c.is_active = 0;
        }
        if (query.includes('name = ?')) {
          c.name = params[idx++];
        }
        if (query.includes('host = ?')) {
          c.host = params[idx++];
        }
        if (query.includes('port = ?')) {
          c.port = params[idx++];
        }
        if (query.includes('database_name = ?')) {
          c.database_name = params[idx++];
        }
        if (query.includes('username = ?')) {
          c.username = params[idx++];
        }
        if (query.includes('password_encrypted = ?')) {
          const p = params[idx++];
          c.password_encrypted = p;
          c.password = p;
        }
        if (query.includes('ssl_enabled = ?')) {
          c.ssl_enabled = params[idx++];
        }
        if (query.includes('updated_at = ?')) {
          c.updated_at = params[idx++];
        }
        mockData.databaseConnections.set(id, c);
        return Promise.resolve([{ affectedRows: 1 }, {}]);
      }

      // Soft delete handled in generic update block above

      // Update last_tested and connection_status
      if (
        query.includes('UPDATE database_connections SET last_tested = ?') &&
        query.includes('connection_status = ?') &&
        query.includes('WHERE id = ?')
      ) {
        const [lastTested, status, id] = params;
        const c = mockData.databaseConnections.get(id);
        if (c) {
          c.last_tested = lastTested || new Date();
          c.connection_status = status;
          mockData.databaseConnections.set(id, c);
          return Promise.resolve([{ affectedRows: 1 }, {}]);
        }
        return Promise.resolve([{ affectedRows: 0 }, {}]);
      }

      // ===== Generic DB execution used by DatabaseService pools =====
      // SHOW TABLES
      if (query.toUpperCase().includes('SHOW TABLES')) {
        return Promise.resolve([[{ Tables_in_db: 'test_content' }], {}]);
      }

      // DESCRIBE ??
      if (query.toUpperCase().startsWith('DESCRIBE')) {
        const columns = [
          { Field: 'id', Type: 'int' },
          { Field: 'title', Type: 'varchar(255)' },
          { Field: 'content', Type: 'text' },
          { Field: 'created_at', Type: 'datetime' },
        ];
        return Promise.resolve([columns as any, {}]);
      }

      // SHOW INDEX FROM ?? WHERE Index_type = ? (FULLTEXT)
      if (query.toUpperCase().includes('SHOW INDEX FROM')) {
        const indexes = [
          { Key_name: 'title_content_ft', Column_name: 'title', Index_type: 'FULLTEXT' },
          { Key_name: 'title_content_ft', Column_name: 'content', Index_type: 'FULLTEXT' },
        ];
        return Promise.resolve([indexes as any, {}]);
      }

      // SELECT TABLE_ROWS FROM information_schema.TABLES ...
      if (query.toUpperCase().includes('SELECT TABLE_ROWS FROM INFORMATION_SCHEMA.TABLES')) {
        return Promise.resolve([[{ TABLE_ROWS: 42 }], {}]);
      }

      // Combined FULLTEXT search queries using MATCH() AGAINST()
      if (query.toUpperCase().includes('MATCH(') && query.toUpperCase().includes('AGAINST(')) {
        const rows = [
          {
            table_name: 'test_content',
            title: 'Test title about databases',
            content: 'This is a test content snippet related to databases and search.',
            relevance_score: 0.87,
          },
          {
            table_name: 'test_content',
            title: 'Another search example',
            content: 'Sample paragraph with search terms and more.',
            relevance_score: 0.65,
          },
        ];
        return Promise.resolve([rows as any, {}]);
      }

      // ===== Analytics queries =====
      // User performance metrics grouped by date
      if (
        query.includes('FROM search_analytics') &&
        query.includes('AVG(execution_time_ms) as avg_response_time') &&
        query.includes('GROUP BY date')
      ) {
        const rows = [
          { date: '2025-09-01', query_count: 10, avg_response_time: 45, max_response_time: 123 },
          { date: '2025-09-02', query_count: 5, avg_response_time: 40, max_response_time: 90 },
        ];
        return Promise.resolve([rows as any, {}]);
      }

      // Popular queries for a user (group by query_text)
      if (query.includes('FROM search_analytics') && query.includes('GROUP BY query_text')) {
        const rows = [
          {
            query_text: 'database',
            frequency: 3,
            avg_time: 50,
            avg_results: 12,
            last_used: new Date(),
          },
          {
            query_text: 'mysql',
            frequency: 2,
            avg_time: 40,
            avg_results: 8,
            last_used: new Date(),
          },
        ];
        return Promise.resolve([rows as any, {}]);
      }

      // Count total items in search history
      if (query.includes('SELECT COUNT(*) as total') && query.includes('FROM search_analytics')) {
        return Promise.resolve([[{ total: 0 }], {}]);
      }

      // Paged search history rows
      if (
        query.includes('SELECT') &&
        query.includes('FROM search_analytics') &&
        query.includes('ORDER BY created_at DESC') &&
        query.includes('LIMIT')
      ) {
        const rows: any[] = [];
        return Promise.resolve([rows, {}]);
      }

      // Admin: system-wide metrics summary
      if (
        query.includes('COUNT(DISTINCT user_id) as active_users') &&
        query.includes('FROM search_analytics') &&
        !query.includes('GROUP BY')
      ) {
        return Promise.resolve([
          [{ active_users: 1, total_queries: 15, avg_response_time: 42, avg_results: 9 }],
          {},
        ]);
      }

      // Admin: user growth grouped by date
      if (query.includes('FROM users') && query.includes('GROUP BY DATE(created_at)')) {
        const rows = [
          { date: '2025-09-01', new_users: 1 },
          { date: '2025-09-02', new_users: 2 },
        ];
        return Promise.resolve([rows as any, {}]);
      }

      // Admin: query volume over time
      if (
        query.includes('FROM search_analytics') &&
        query.includes('COUNT(*) as query_count') &&
        query.includes('GROUP BY DATE(created_at)')
      ) {
        const rows = [
          { date: '2025-09-01', query_count: 10, active_users: 1 },
          { date: '2025-09-02', query_count: 5, active_users: 1 },
        ];
        return Promise.resolve([rows as any, {}]);
      }

      // Admin: slowest queries join users
      if (
        query.includes('FROM search_analytics sa') &&
        query.includes('JOIN users u ON sa.user_id = u.id') &&
        query.includes('ORDER BY execution_time_ms DESC')
      ) {
        const rows = [
          {
            query_text: 'heavy query',
            execution_time_ms: 500,
            result_count: 1,
            created_at: new Date(),
            user_email: 'admin@example.com',
          },
        ];
        return Promise.resolve([rows as any, {}]);
      }

      // Default response for unhandled queries
      return Promise.resolve([[], {}]);
    }),
    end: jest.fn().mockResolvedValue(undefined),
    ping: jest.fn().mockResolvedValue(undefined),
    release: jest.fn(),
  };

  const mockPool = {
    execute: mockConnection.execute,
    query: mockConnection.execute,
    end: jest.fn().mockResolvedValue(undefined),
    getConnection: jest.fn().mockResolvedValue(mockConnection),
  };

  return {
    createConnection: jest.fn().mockResolvedValue(mockConnection),
    createPool: jest.fn().mockReturnValue(mockPool),
  };
});

// Mock ioredis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(0),
    ttl: jest.fn().mockResolvedValue(-1),
    expire: jest.fn().mockResolvedValue(1),
    flushdb: jest.fn().mockResolvedValue('OK'),
    quit: jest.fn().mockResolvedValue('OK'),
    disconnect: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    status: 'ready',
    ping: jest.fn().mockResolvedValue('PONG'),
  }));
});

// Mock rate-limiter-flexible to always allow in tests
jest.mock('rate-limiter-flexible', () => {
  class RateLimiterRedis {
    // Mimic constructor signature but ignore args
    constructor(..._args: any[]) {
      // Constructor args intentionally unused in mock
      void _args;
    }
    async consume(_key: string) {
      // Key parameter intentionally unused in mock
      void _key;
      return { remainingPoints: 9999, msBeforeNext: 100, totalHits: 0 };
    }
  }
  return { RateLimiterRedis };
});

// Mock @faker-js/faker to avoid ESM issues
jest.mock('@faker-js/faker', () => ({
  faker: {
    string: {
      uuid: jest.fn(() => 'mock-uuid-12345'),
      alphanumeric: jest.fn(() => 'mockString123'),
    },
    internet: {
      email: jest.fn(() => 'test@example.com'),
      username: jest.fn(() => 'testuser'),
      password: jest.fn(() => 'testpass123'),
    },
    person: {
      fullName: jest.fn(() => 'Test User'),
    },
    commerce: {
      productName: jest.fn(() => 'Test Product'),
    },
    word: {
      words: jest.fn(() => 'alpha beta'),
    },
    database: {
      engine: jest.fn(() => 'testdb'),
    },
    datatype: {
      boolean: jest.fn(() => true),
    },
    helpers: {
      arrayElement: jest.fn((arr: any[]) => (Array.isArray(arr) && arr.length ? arr[0] : null)),
    },
    date: {
      soon: jest.fn(() => new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)),
    },
    seed: jest.fn(),
  },
}));

// Integration tests complete - external services mocked above
