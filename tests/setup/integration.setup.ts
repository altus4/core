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

      // Handle API key validation
      if (query.includes('FROM api_keys ak') && query.includes('JOIN users')) {
        const [keyPrefix, keyHash] = params;
        const apiKey = Array.from(mockData.apiKeys.values()).find(
          (k: any) => k.key_prefix === keyPrefix && k.key_hash === keyHash && k.is_active
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
    database: {
      engine: jest.fn(() => 'testdb'),
    },
    datatype: {
      boolean: jest.fn(() => true),
    },
    seed: jest.fn(),
  },
}));

// Integration tests complete - external services mocked above
