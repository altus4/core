/**
 * Setup for Integration Tests
 *
 * This setup file is used specifically for integration tests and does not
 * mock external services like the main setup.ts does.
 */

import { logger } from '@/utils/logger';

// Set test environment
process.env.NODE_ENV = 'test';

// Configure logger for testing
logger.level = 'error'; // Only show errors during tests

// Global test timeout
jest.setTimeout(60000);

// Mock external services to prevent connection issues and charset errors

// Mock MySQL connections to prevent charset and connection issues
jest.mock('mysql2/promise', () => {
  // In-memory storage for test data
  const mockData = {
    users: new Map(),
    apiKeys: new Map(),
    databaseConnections: new Map(),
    // Ensure TypeScript does not infer `never[]` under strict mode
    searchAnalytics: [] as any[],
  };

  const mockConnection = {
    execute: jest.fn().mockImplementation((query: string, params: any[] = []) => {
      // Handle user registration/creation
      if (query.includes('INSERT INTO users')) {
        // Handle both registration and test user creation
        if (params.length === 5) {
          // Registration: [id, email, name, passwordHash, role]
          const [id, email, name, passwordHash, role] = params;
          mockData.users.set(email, {
            id,
            email,
            name,
            password_hash: passwordHash,
            role,
            is_active: 1,
            created_at: new Date(),
            updated_at: new Date(),
          });
          mockData.users.set(id, mockData.users.get(email)); // Also store by ID
        } else if (params.length === 8) {
          // Test user creation: [id, email, name, passwordHash, role, createdAt, lastActive, isActive]
          const [id, email, name, passwordHash, role, createdAt, lastActive, isActive] = params;
          const user = {
            id,
            email,
            name,
            password_hash: passwordHash,
            role,
            is_active: isActive ? 1 : 0,
            created_at: createdAt,
            updated_at: createdAt,
            last_active: lastActive,
          };
          mockData.users.set(email, user);
          mockData.users.set(id, user); // Also store by ID
        }
        return Promise.resolve([{ insertId: params[0], affectedRows: 1 }, {}]);
      }

      // Handle user login lookup
      if (query.includes('SELECT') && query.includes('FROM users WHERE email')) {
        const email = params[0];
        const user = mockData.users.get(email);
        if (user) {
          return Promise.resolve([[user], {}]);
        }
        return Promise.resolve([[], {}]);
      }

      // Handle user lookup by ID
      if (query.includes('SELECT * FROM users WHERE id')) {
        const id = params[0];
        const user =
          mockData.users.get(id) || Array.from(mockData.users.values()).find(u => u.id === id);
        if (user) {
          return Promise.resolve([[user], {}]);
        }
        return Promise.resolve([[], {}]);
      }

      // Handle API key creation (matches ApiKeyService.insert order)
      if (query.includes('INSERT INTO api_keys')) {
        // (id, user_id, key_prefix, key_hash, name, environment,
        //  permissions, rate_limit_tier, expires_at, is_active, created_at, updated_at)
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

      // Handle API key lookup by hash
      if (query.includes('SELECT * FROM api_keys WHERE key_hash')) {
        const keyHash = params[0];
        const apiKey = Array.from(mockData.apiKeys.values()).find(k => k.key_hash === keyHash);
        if (apiKey) {
          return Promise.resolve([[apiKey], {}]);
        }
        return Promise.resolve([[], {}]);
      }

      // Handle API key validation query with prefix and hash join
      if (query.includes('FROM api_keys ak') && query.includes('JOIN users')) {
        const [keyPrefix, keyHash] = params;
        const apiKey = Array.from(mockData.apiKeys.values()).find(
          (k: any) => k.key_prefix === keyPrefix && k.key_hash === keyHash && k.is_active
        );
        if (!apiKey) {
          return Promise.resolve([[], {}]);
        }
        // Attach user fields
        const user = mockData.users.get(apiKey.user_id);
        const row = {
          ...apiKey,
          email: user?.email || 'user@example.com',
          name: user?.name || 'User',
          role: user?.role || 'user',
        };
        return Promise.resolve([[row], {}]);
      }

      // Handle API key lookup by ID
      if (query.includes('SELECT * FROM api_keys WHERE id')) {
        const id = params[0];
        const apiKey = mockData.apiKeys.get(id);
        if (apiKey) {
          return Promise.resolve([[apiKey], {}]);
        }
        return Promise.resolve([[], {}]);
      }

      // Handle API key listing by user
      if (query.includes('SELECT') && query.includes('FROM api_keys WHERE user_id')) {
        const userId = params[0];
        const userApiKeys = Array.from(mockData.apiKeys.values()).filter(k => k.user_id === userId);
        return Promise.resolve([userApiKeys, {}]);
      }

      // Handle API key updates
      if (query.includes('UPDATE api_keys')) {
        return Promise.resolve([{ affectedRows: 1 }, {}]);
      }

      // Handle API key deletion
      if (query.includes('DELETE FROM api_keys')) {
        return Promise.resolve([{ affectedRows: 1 }, {}]);
      }

      // Handle database connection creation
      if (query.includes('INSERT INTO database_connections')) {
        const [id, userId, name, host, port, database, username, password, ssl] = params;
        const connection = {
          id,
          user_id: userId,
          name,
          host,
          port,
          database,
          username,
          password,
          ssl,
          connection_status: 'active',
          created_at: new Date(),
          updated_at: new Date(),
        };
        mockData.databaseConnections.set(id, connection);
        return Promise.resolve([{ insertId: id, affectedRows: 1 }, {}]);
      }

      // Handle database connection queries by ID (check this before user_id to avoid substring collisions)
      if (query.includes('SELECT') && query.includes('FROM database_connections WHERE id')) {
        const id = params[0];
        const connection = mockData.databaseConnections.get(id);
        if (connection) {
          return Promise.resolve([[connection], {}]);
        }
        return Promise.resolve([[], {}]);
      }

      // Handle database connection queries by user
      if (query.includes('SELECT') && query.includes('FROM database_connections WHERE user_id')) {
        const userId = params[0];
        const userConnections = Array.from(mockData.databaseConnections.values()).filter(
          c => c.user_id === userId
        );
        return Promise.resolve([userConnections, {}]);
      }

      // Handle user updates (last_active, etc.)
      if (query.includes('UPDATE users')) {
        const userId = params[params.length - 1]; // Usually the last parameter is the WHERE clause ID
        const user = mockData.users.get(userId);
        if (user) {
          // Update the user data
          if (query.includes('is_active')) {
            user.is_active = params[0];
          }
          if (query.includes('last_active')) {
            user.last_active = params[0];
          }
        }
        return Promise.resolve([{ affectedRows: 1 }, {}]);
      }

      // Handle user profile updates
      if (query.includes('UPDATE users SET')) {
        return Promise.resolve([{ affectedRows: 1 }, {}]);
      }

      // Handle password changes
      if (query.includes('UPDATE users') && query.includes('password_hash')) {
        return Promise.resolve([{ affectedRows: 1 }, {}]);
      }

      // Handle search analytics insertion
      if (query.includes('INSERT INTO search_analytics')) {
        // Expect params: [id, user_id, query_text, search_mode, database_id, result_count, execution_time_ms]
        const [id, userId, queryText, searchMode, databaseId, resultCount, execTime] = params;
        mockData.searchAnalytics.push({
          id: id || String(Date.now()),
          user_id: userId,
          query_text: queryText,
          search_mode: searchMode,
          database_id: databaseId,
          result_count: resultCount ?? 0,
          execution_time_ms: execTime ?? 0,
          created_at: new Date(),
        });
        return Promise.resolve([{ insertId: id || Date.now(), affectedRows: 1 }, {}]);
      }

      // Handle search analytics queries
      if (query.includes('SELECT') && query.includes('FROM search_analytics')) {
        // Popular queries (GROUP BY query_text)
        if (query.includes('GROUP BY query_text')) {
          const [userId, start, end] = params;
          const startDate = new Date(start);
          const endDate = new Date(end);
          const filtered = mockData.searchAnalytics.filter(
            (r: any) =>
              (!userId || r.user_id === userId) &&
              r.created_at >= startDate &&
              r.created_at <= endDate
          );
          const map: Record<string, any> = {};
          for (const r of filtered) {
            if (!map[r.query_text]) {
              map[r.query_text] = {
                query_text: r.query_text,
                frequency: 0,
                avg_time_sum: 0,
                avg_results_sum: 0,
                count: 0,
                last_used: r.created_at,
              };
            }
            const m = map[r.query_text];
            m.frequency += 1;
            m.avg_time_sum += r.execution_time_ms || 0;
            m.avg_results_sum += r.result_count || 0;
            m.count += 1;
            if (r.created_at > m.last_used) {
              m.last_used = r.created_at;
            }
          }
          const rows = Object.values(map).map((m: any) => ({
            query_text: m.query_text,
            frequency: m.frequency,
            avg_time: m.count ? m.avg_time_sum / m.count : 0,
            avg_results: m.count ? m.avg_results_sum / m.count : 0,
            last_used: m.last_used,
          }));
          return Promise.resolve([rows, {}]);
        }

        // Count total
        if (query.includes('COUNT(*) as total')) {
          const [userId, start, end] = params;
          const startDate = new Date(start);
          const endDate = new Date(end);
          const count = mockData.searchAnalytics.filter(
            (r: any) => r.user_id === userId && r.created_at >= startDate && r.created_at <= endDate
          ).length;
          return Promise.resolve([[{ total: count }], {}]);
        }

        // History rows for a user
        if (query.includes('query_text as query') && query.includes('ORDER BY created_at DESC')) {
          const [userId, start, end] = params;
          const startDate = new Date(start);
          const endDate = new Date(end);
          const limitMatch = query.match(/LIMIT\s+(\d+)/i);
          const offsetMatch = query.match(/OFFSET\s+(\d+)/i);
          const limit = limitMatch ? parseInt(limitMatch[1]) : 100;
          const offset = offsetMatch ? parseInt(offsetMatch[1]) : 0;

          const rows = mockData.searchAnalytics
            .filter(
              (r: any) =>
                r.user_id === userId && r.created_at >= startDate && r.created_at <= endDate
            )
            .sort((a: any, b: any) => b.created_at.getTime() - a.created_at.getTime())
            .slice(offset, offset + limit)
            .map((r: any) => ({
              id: r.id,
              query: r.query_text,
              search_mode: r.search_mode,
              resultCount: r.result_count,
              executionTime: r.execution_time_ms,
              database: r.database_id,
              timestamp: r.created_at,
            }));
          return Promise.resolve([rows, {}]);
        }

        // Time series and performance for user
        if (query.includes('AVG(execution_time_ms) as avg_response_time')) {
          const [userId, start, end] = params;
          const startDate = new Date(start);
          const endDate = new Date(end);
          const filtered = mockData.searchAnalytics.filter(
            (r: any) => r.user_id === userId && r.created_at >= startDate && r.created_at <= endDate
          );
          const totalQueries = filtered.length;
          const avgResponseTime = totalQueries
            ? filtered.reduce((s: number, r: any) => s + (r.execution_time_ms || 0), 0) /
              totalQueries
            : 0;
          const maxResponseTime = filtered.reduce(
            (m: number, r: any) => Math.max(m, r.execution_time_ms || 0),
            0
          );
          const minResponseTime = filtered.reduce(
            (m: number, r: any) => Math.min(m, r.execution_time_ms || 0),
            totalQueries ? filtered[0].execution_time_ms || 0 : 0
          );
          const avgResults = totalQueries
            ? filtered.reduce((s: number, r: any) => s + (r.result_count || 0), 0) / totalQueries
            : 0;
          // First query returns a single summary row
          return Promise.resolve([
            [
              {
                avg_response_time: avgResponseTime || 0,
                max_response_time: maxResponseTime || 0,
                min_response_time: totalQueries ? minResponseTime : 0,
                total_queries: totalQueries,
                avg_results: avgResults || 0,
              },
            ],
            {},
          ]);
        }
        if (query.includes('GROUP BY DATE(created_at)')) {
          const [userId, start, end] = params;
          const startDate = new Date(start);
          const endDate = new Date(end);
          const filtered = mockData.searchAnalytics.filter(
            (r: any) => r.user_id === userId && r.created_at >= startDate && r.created_at <= endDate
          );
          const byDate: Record<string, any> = {};
          for (const r of filtered) {
            const d = r.created_at.toISOString().split('T')[0];
            if (!byDate[d]) {
              byDate[d] = { date: d, query_count: 0, avg_response_time: 0 };
            }
            byDate[d].query_count += 1;
          }
          const rows = Object.values(byDate);
          return Promise.resolve([rows, {}]);
        }

        // Admin system overview: without user filter
        if (query.includes('COUNT(DISTINCT user_id) as active_users')) {
          return Promise.resolve([
            [
              {
                active_users: mockData.users.size,
                total_queries: mockData.searchAnalytics.length,
                avg_response_time: mockData.searchAnalytics.length
                  ? mockData.searchAnalytics.reduce(
                      (s: number, r: any) => s + (r.execution_time_ms || 0),
                      0
                    ) / mockData.searchAnalytics.length
                  : 0,
                avg_results: mockData.searchAnalytics.length
                  ? mockData.searchAnalytics.reduce(
                      (s: number, r: any) => s + (r.result_count || 0),
                      0
                    ) / mockData.searchAnalytics.length
                  : 0,
              },
            ],
            {},
          ]);
        }
        if (
          query.includes('COUNT(*) as query_count') &&
          query.includes('GROUP BY DATE(created_at)')
        ) {
          // System query volume by day
          const byDate: Record<string, any> = {};
          for (const r of mockData.searchAnalytics) {
            const d = r.created_at.toISOString().split('T')[0];
            if (!byDate[d]) {
              byDate[d] = { date: d, query_count: 0, active_users: 1 };
            }
            byDate[d].query_count += 1;
          }
          return Promise.resolve([Object.values(byDate), {}]);
        }

        // Slowest queries list
        if (query.includes('ORDER BY execution_time_ms DESC')) {
          const rows = [...mockData.searchAnalytics]
            .sort((a: any, b: any) => (b.execution_time_ms || 0) - (a.execution_time_ms || 0))
            .slice(0, 10)
            .map((r: any) => ({
              query_text: r.query_text,
              execution_time_ms: r.execution_time_ms,
              result_count: r.result_count,
              created_at: r.created_at,
              user_email: (Array.from(mockData.users.values()).find(u => u.id === r.user_id) || {})
                .email,
            }));
          return Promise.resolve([rows, {}]);
        }

        // Default empty
        return Promise.resolve([[], {}]);
      }

      // Handle CREATE TABLE, DELETE, ALTER TABLE, etc.
      if (
        query.includes('CREATE TABLE') ||
        query.includes('DELETE FROM') ||
        query.includes('ALTER TABLE') ||
        query.includes('INSERT IGNORE')
      ) {
        return Promise.resolve([{ affectedRows: 0 }, {}]);
      }

      // Default empty response
      return Promise.resolve([[], {}]);
    }),
    query: jest.fn().mockImplementation((query: string, params: any[] = []) => {
      // Handle the same queries as execute for compatibility
      return mockConnection.execute(query, params);
    }),
    end: jest.fn(),
    ping: jest.fn().mockResolvedValue(true),
    release: jest.fn(), // Add release method for database service
  };

  const mockPool = {
    execute: mockConnection.execute,
    query: mockConnection.query,
    end: jest.fn(),
    getConnection: jest.fn().mockResolvedValue({
      ...mockConnection,
      release: jest.fn(), // Ensure the connection returned by getConnection has release method
    }),
  };

  return {
    createConnection: jest.fn().mockResolvedValue(mockConnection),
    createPool: jest.fn().mockReturnValue(mockPool),
  };
});

// Mock Redis to prevent connection leaks
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(true),
    disconnect: jest.fn().mockResolvedValue(true),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    incr: jest.fn(),
    zadd: jest.fn(),
    zrange: jest.fn().mockResolvedValue([]),
    expire: jest.fn(),
    quit: jest.fn().mockResolvedValue(true),
    flushdb: jest.fn().mockResolvedValue('OK'), // Add flushdb method
    on: jest.fn(), // Add event handler support
    off: jest.fn(),
    emit: jest.fn(),
  }));
});

// Mock rate limiter to prevent 429 errors in tests
jest.mock('../src/middleware/rateLimiter', () => {
  return {
    rateLimiter: (req: any, res: any, next: any) => next(),
    authRateLimiter: (req: any, res: any, next: any) => next(),
    searchRateLimiter: (req: any, res: any, next: any) => next(),
  };
});
// But we need to configure them properly to avoid charset issues

// Global error handler for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  // eslint-disable-next-line no-console
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Global cleanup
afterAll(async () => {
  // Close any remaining connections
  await new Promise(resolve => setTimeout(resolve, 100));
});
