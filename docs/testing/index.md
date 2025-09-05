---
title: Testing Guide
description: Comprehensive testing documentation for Altus 4 covering unit tests, integration tests, and performance testing.
---

# Testing Guide

Comprehensive testing documentation for Altus 4

This guide covers all aspects of testing in Altus 4, from unit tests to performance testing, with examples and best practices.

## Testing Philosophy

Altus 4 follows a comprehensive testing strategy based on the testing pyramid:

```mermaid
graph TB
    E2E[E2E Tests<br/>Manual & Automated<br/>Few, high-value]
    INT[Integration Tests<br/>API Endpoints & Service Integration<br/>Some, API focused]
    UNIT[Unit Tests<br/>Services, Utils, Business Logic<br/>Many, fast]

    E2E -.-> INT
    INT -.-> UNIT

    style E2E fill:#ffebee
    style INT fill:#e8f5e8
    style UNIT fill:#e3f2fd
```

### Testing Principles

1. **Fast Feedback**: Tests should run quickly to enable rapid development
2. **Reliable**: Tests should be deterministic and not flaky
3. **Independent**: Tests should not depend on each other
4. **Maintainable**: Tests should be easy to understand and modify
5. **Comprehensive**: Critical paths should have high test coverage

## Test Types

### 1. Unit Tests

Test individual functions, classes, and components in isolation.

**Location**: `src/**/*.test.ts`
**Framework**: Jest with TypeScript
**Coverage Target**: 90%+

### 2. Integration Tests

Test API endpoints and service interactions with mocked external dependencies.

**Location**: `tests/integration/**/*.test.ts`
**Framework**: Jest + Supertest
**Coverage Target**: Key API endpoints

### 3. Performance Tests

Test system performance under load and measure response times.

**Location**: `tests/performance/**/*.test.ts`
**Framework**: Jest + Custom benchmarking
**Coverage Target**: Critical search operations

### 4. End-to-End Tests

Test complete user workflows from client to database.

**Location**: `tests/e2e/**/*.test.ts`
**Framework**: Jest + Real services
**Coverage Target**: Primary user flows

## Test Configuration

### Jest Configuration

Our Jest setup (`jest.config.js`) includes:

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.test.ts', '<rootDir>/tests/**/*.test.ts'],
  setupFiles: ['<rootDir>/tests/env-setup.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts', '!src/index.ts'],
  coverageReporters: ['text', 'lcov', 'html'],
  coverageDirectory: 'coverage',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
  },
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/src/**/*.test.ts'],
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
    },
    {
      displayName: 'performance',
      testMatch: ['<rootDir>/tests/performance/**/*.test.ts'],
    },
  ],
};
```

### Environment Setup

**Test Environment Variables** (`.env.test`):

```bash
NODE_ENV=test
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=test
DB_PASSWORD=test
DB_DATABASE=altus4_test
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
JWT_SECRET=test-secret-key-for-testing-only  # For testing legacy endpoints
OPENAI_API_KEY=test-key
LOG_LEVEL=error
BCRYPT_ROUNDS=4
ENABLE_QUERY_LOGGING=false
ENABLE_PERFORMANCE_MONITORING=false
```

**Global Test Setup** (`tests/setup.ts`):

```typescript
import { logger } from '@/utils/logger';

// Set test environment
process.env.NODE_ENV = 'test';

// Configure logger for testing
logger.level = 'error';

// Global test timeout
jest.setTimeout(30000);

// Mock external services
jest.mock('../src/services/AIService', () => ({
  AIService: jest.fn().mockImplementation(() => ({
    isAvailable: jest.fn(() => false),
    processSearchQuery: jest.fn(),
    categorizeResults: jest.fn(() => []),
    getQuerySuggestions: jest.fn(() => []),
    analyzeQuery: jest.fn(() => ({ recommendations: [], optimizations: [] })),
    generateInsights: jest.fn(() => ({ insights: [], performance: [] })),
  })),
}));

// Global error handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
```

## Writing Tests

### Unit Test Examples

#### Service Testing with Mocks

```typescript
// src/services/SearchService.test.ts
import { SearchService } from './SearchService';

describe('SearchService', () => {
  let searchService: SearchService;
  let mockDatabaseService: jest.Mocked<DatabaseService>;
  let mockAIService: jest.Mocked<AIService>;
  let mockCacheService: jest.Mocked<CacheService>;

  beforeEach(() => {
    // Create mocked dependencies
    mockDatabaseService = {
      executeFullTextSearch: jest.fn(),
      getSearchSuggestions: jest.fn(),
      analyzeQueryPerformance: jest.fn(),
      testConnection: jest.fn(),
      close: jest.fn(),
    };

    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      getPopularQueries: jest.fn(() => []),
      logSearchAnalytics: jest.fn(),
      close: jest.fn(),
    };

    mockAIService = {
      isAvailable: jest.fn(() => false),
      processSearchQuery: jest.fn(),
      categorizeResults: jest.fn(() => []),
      getQuerySuggestions: jest.fn(() => []),
    };

    // Initialize service with mocks
    searchService = new SearchService(mockDatabaseService, mockAIService, mockCacheService);
  });

  describe('performSearch', () => {
    it('should return cached results when available', async () => {
      // Arrange
      const cachedResponse = {
        results: [{ id: 'cached', title: 'Cached Result', score: 0.95 }],
        totalCount: 1,
        executionTime: 2,
      };
      mockCacheService.get.mockResolvedValue(cachedResponse);

      // Act
      const result = await searchService.performSearch('test query');

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual(cachedResponse);
      expect(mockDatabaseService.executeFullTextSearch).not.toHaveBeenCalled();
    });

    it('should handle database search when cache misses', async () => {
      // Arrange
      const rawResults = [{ id: 1, title: 'Test Result', content: 'Test content', score: 0.9 }];
      mockCacheService.get.mockResolvedValue(null);
      mockDatabaseService.executeFullTextSearch.mockResolvedValue(rawResults);

      // Act
      const result = await searchService.performSearch('test query', {
        databases: ['db-1'],
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.data.results).toHaveLength(1);
      expect(result.data.results[0].data).toEqual(rawResults[0]);
    });

    it('should handle search errors gracefully', async () => {
      // Arrange
      mockCacheService.set.mockRejectedValue(new Error('Cache failed'));
      mockDatabaseService.executeFullTextSearch.mockResolvedValue([]);

      // Act
      const result = await searchService.performSearch('test', {
        databases: ['db-1'],
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('SEARCH_FAILED');
    });
  });
});
```

#### Utility Function Testing

```typescript
// src/utils/encryption.test.ts
import { EncryptionUtil } from './encryption';

describe('EncryptionUtil', () => {
  describe('password hashing', () => {
    it('should hash passwords securely', async () => {
      const password = 'testPassword123';
      const hashedPassword = await EncryptionUtil.hashPassword(password);

      expect(hashedPassword).toBeDefined();
      expect(hashedPassword).not.toBe(password);
      expect(hashedPassword.length).toBeGreaterThan(50);
    });

    it('should verify correct passwords', async () => {
      const password = 'testPassword123';
      const hashedPassword = await EncryptionUtil.hashPassword(password);

      const isValid = await EncryptionUtil.comparePassword(password, hashedPassword);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect passwords', async () => {
      const password = 'testPassword123';
      const wrongPassword = 'wrongPassword';
      const hashedPassword = await EncryptionUtil.hashPassword(password);

      const isValid = await EncryptionUtil.comparePassword(wrongPassword, hashedPassword);
      expect(isValid).toBe(false);
    });
  });

  describe('data encryption', () => {
    it('should encrypt and decrypt data correctly', () => {
      const data = 'sensitive information';
      const encrypted = EncryptionUtil.encrypt(data);
      const decrypted = EncryptionUtil.decrypt(encrypted);

      expect(encrypted).not.toBe(data);
      expect(decrypted).toBe(data);
    });

    it('should produce different encrypted values for same input', () => {
      const data = 'test data';
      const encrypted1 = EncryptionUtil.encrypt(data);
      const encrypted2 = EncryptionUtil.encrypt(data);

      expect(encrypted1).not.toBe(encrypted2);
      expect(EncryptionUtil.decrypt(encrypted1)).toBe(data);
      expect(EncryptionUtil.decrypt(encrypted2)).toBe(data);
    });
  });
});
```

### Integration Test Examples

#### API Endpoint Testing

```typescript
// tests/integration/auth.integration.test.ts
import request from 'supertest';
import { TestHelpers } from '@tests/utils/test-helpers';
import app from '@/index';

describe('Authentication API', () => {
  beforeAll(async () => {
    await TestHelpers.setupTestDatabase();
  });

  afterAll(async () => {
    await TestHelpers.cleanupTestDatabase();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'SecurePassword123!',
        name: 'Test User',
      };

      const response = await request(app).post('/api/auth/register').send(userData).expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.user.name).toBe(userData.name);
      expect(response.body.data.token).toBeDefined();
    });

    it('should reject registration with invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'SecurePassword123!',
        name: 'Test User',
      };

      const response = await request(app).post('/api/auth/register').send(userData).expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject duplicate email registration', async () => {
      const userData = {
        email: 'duplicate@example.com',
        password: 'SecurePassword123!',
        name: 'Test User',
      };

      // First registration
      await request(app).post('/api/auth/register').send(userData).expect(201);

      // Duplicate registration
      const response = await request(app).post('/api/auth/register').send(userData).expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('USER_ALREADY_EXISTS');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await TestHelpers.createTestUser({
        email: 'login-test@example.com',
        password: 'TestPassword123!',
        name: 'Login Test User',
      });
    });

    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login-test@example.com',
          password: 'TestPassword123!',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user.email).toBe('login-test@example.com');
    });

    it('should reject login with invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login-test@example.com',
          password: 'WrongPassword',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });
});
```

#### Service Integration Testing

```typescript
// tests/integration/search.service.integration.test.ts
import { SearchService } from '@/services/SearchService';
import { DatabaseService } from '@/services/DatabaseService';
import { CacheService } from '@/services/CacheService';
import { AIService } from '@/services/AIService';
import { TestHelpers } from '@tests/utils/test-helpers';

describe('SearchService Integration', () => {
  let searchService: SearchService;
  let databaseService: DatabaseService;
  let cacheService: CacheService;
  let aiService: AIService;

  beforeAll(async () => {
    // Use real services for integration testing
    databaseService = new DatabaseService();
    cacheService = new CacheService();
    aiService = new AIService();

    searchService = new SearchService(databaseService, aiService, cacheService);

    await TestHelpers.setupTestData();
  });

  afterAll(async () => {
    await TestHelpers.cleanupTestData();
    await databaseService.close();
    await cacheService.close();
  });

  it('should perform end-to-end search with caching', async () => {
    const searchRequest = {
      query: 'test search query',
      userId: 'integration-test-user',
      databases: ['test-db-id'],
      searchMode: 'natural' as const,
      limit: 10,
    };

    // First search should hit database
    const firstResult = await searchService.search(searchRequest);
    expect(firstResult.results).toBeDefined();
    expect(firstResult.executionTime).toBeGreaterThan(0);

    // Second search should hit cache (faster)
    const secondResult = await searchService.search(searchRequest);
    expect(secondResult.results).toEqual(firstResult.results);
    expect(secondResult.executionTime).toBeLessThan(firstResult.executionTime);
  });

  it('should handle database failures gracefully', async () => {
    const searchRequest = {
      query: 'test query',
      userId: 'test-user',
      databases: ['non-existent-db-id'],
      searchMode: 'natural' as const,
    };

    await expect(searchService.search(searchRequest)).rejects.toThrow();
  });
});
```

### Performance Test Examples

```typescript
// tests/performance/search.performance.test.ts
import { SearchService } from '@/services/SearchService';
import { TestHelpers } from '@tests/utils/test-helpers';

describe('Search Performance Tests', () => {
  let searchService: SearchService;

  beforeAll(async () => {
    searchService = await TestHelpers.createSearchService();
    await TestHelpers.setupPerformanceTestData();
  });

  afterAll(async () => {
    await TestHelpers.cleanupTestData();
  });

  it('should handle single search query within acceptable time', async () => {
    const startTime = Date.now();

    const result = await searchService.performSearch('performance test query');

    const executionTime = Date.now() - startTime;

    expect(result.success).toBe(true);
    expect(executionTime).toBeLessThan(500); // 500ms threshold
  });

  it('should handle concurrent search queries efficiently', async () => {
    const concurrentRequests = 10;
    const queries = Array.from({ length: concurrentRequests }, (_, i) =>
      searchService.performSearch(`concurrent query ${i}`)
    );

    const startTime = Date.now();
    const results = await Promise.all(queries);
    const totalTime = Date.now() - startTime;

    expect(results.every(r => r.success)).toBe(true);
    expect(totalTime).toBeLessThan(2000); // Should complete within 2 seconds
  });

  it('should handle high-volume search requests', async () => {
    const requestCount = 100;
    const batchSize = 10;
    const batches = [];

    // Process in batches to avoid overwhelming the system
    for (let i = 0; i < requestCount; i += batchSize) {
      const batch = Array.from({ length: Math.min(batchSize, requestCount - i) }, (_, j) =>
        searchService.performSearch(`volume test ${i + j}`)
      );
      batches.push(Promise.all(batch));
    }

    const startTime = Date.now();
    const allResults = await Promise.all(batches);
    const totalTime = Date.now() - startTime;

    const flatResults = allResults.flat();
    expect(flatResults).toHaveLength(requestCount);
    expect(flatResults.every(r => r.success)).toBe(true);
    expect(totalTime).toBeLessThan(10000); // 10 seconds for 100 requests
  });

  it('should demonstrate cache performance improvement', async () => {
    const query = 'cache performance test';

    // First request (cache miss)
    const startTime1 = Date.now();
    await searchService.performSearch(query);
    const firstRequestTime = Date.now() - startTime1;

    // Second request (cache hit)
    const startTime2 = Date.now();
    await searchService.performSearch(query);
    const secondRequestTime = Date.now() - startTime2;

    expect(secondRequestTime).toBeLessThan(firstRequestTime * 0.5); // 50% faster
  });
});
```

## Test Helpers

### Test Helper Utilities

```typescript
// tests/utils/test-helpers.ts
import { createConnection, Connection } from 'mysql2/promise';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

export class TestHelpers {
  private static dbConnection: Connection;

  static async getDbConnection(): Promise<Connection> {
    if (!this.dbConnection) {
      this.dbConnection = await createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306'),
        user: process.env.DB_USERNAME || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_DATABASE || 'altus4_test',
      });
    }
    return this.dbConnection;
  }

  static async setupTestDatabase(): Promise<void> {
    const connection = await this.getDbConnection();

    // Create test tables
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS test_users (
        id VARCHAR(36) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS test_content (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        category VARCHAR(100),
        FULLTEXT(title, content)
      )
    `);
  }

  static async cleanupTestDatabase(): Promise<void> {
    const connection = await this.getDbConnection();
    await connection.execute('DELETE FROM test_users');
    await connection.execute('DELETE FROM test_content');
  }

  static async createTestUser(userData: {
    email: string;
    password: string;
    name: string;
  }): Promise<any> {
    const connection = await this.getDbConnection();
    const userId = uuidv4();

    await connection.execute(
      'INSERT INTO test_users (id, email, password, name) VALUES (?, ?, ?, ?)',
      [userId, userData.email, userData.password, userData.name]
    );

    return {
      id: userId,
      email: userData.email,
      name: userData.name,
    };
  }

  // Generate JWT token for testing legacy/bootstrap endpoints only
  static generateTestToken(user: any): string {
    return jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  }

  static async insertTestContent(
    contentData: Array<{
      title: string;
      content: string;
      category?: string;
    }>
  ): Promise<void> {
    const connection = await this.getDbConnection();

    for (const item of contentData) {
      await connection.execute(
        'INSERT INTO test_content (title, content, category) VALUES (?, ?, ?)',
        [item.title, item.content, item.category || 'general']
      );
    }
  }

  static async cleanupTestData(): Promise<void> {
    await this.cleanupTestDatabase();
  }

  static async closeConnections(): Promise<void> {
    if (this.dbConnection) {
      await this.dbConnection.end();
    }
  }
}
```

## Running Tests

### Test Scripts

```bash
# Run all tests
npm test

# Run specific test types
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:performance   # Performance tests only

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run tests matching pattern
npm test -- --testNamePattern="SearchService"
npm test -- --testPathPattern="integration"

# Run tests with verbose output
npm test -- --verbose

# Run tests in parallel
npm test -- --maxWorkers=4

# Generate coverage report
npm run test:coverage -- --coverageDirectory=coverage
```

### Test Configuration Options

```bash
# Environment-specific testing
NODE_ENV=test npm test
NODE_ENV=development npm run test:integration

# Database-specific testing
DB_DATABASE=altus4_test npm test

# Debug mode testing
DEBUG=true npm test

# Performance testing with benchmarks
BENCHMARK=true npm run test:performance
```

## Coverage Reports

### Coverage Targets

| Test Type   | Target | Current |
| ----------- | ------ | ------- |
| Unit Tests  | 90%    | 94%     |
| Integration | 80%    | 85%     |
| Overall     | 85%    | 89%     |

### Coverage Commands

```bash
# Generate HTML coverage report
npm run test:coverage

# View coverage in browser
open coverage/lcov-report/index.html

# Check coverage thresholds
npm run coverage:check

# Upload coverage to external service
npm run coverage:upload
```

## Continuous Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: root
          MYSQL_DATABASE: altus4_test
        options: >-
          --health-cmd="mysqladmin ping"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=3

      redis:
        image: redis:7
        options: >-
          --health-cmd="redis-cli ping"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=3

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linting
        run: npm run lint

      - name: Run type checking
        run: npm run type-check

      - name: Run unit tests
        run: npm run test:unit
        env:
          NODE_ENV: test

      - name: Run integration tests
        run: npm run test:integration
        env:
          NODE_ENV: test
          DB_HOST: 127.0.0.1
          DB_PASSWORD: root
          REDIS_HOST: 127.0.0.1

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
```

## Best Practices

### Test Writing Guidelines

1. **AAA Pattern**: Arrange, Act, Assert
2. **Descriptive Names**: Test names should describe the scenario
3. **Single Responsibility**: Each test should verify one behavior
4. **Independent Tests**: Tests should not depend on each other
5. **Fast Execution**: Unit tests should complete in milliseconds

### Mocking Guidelines

1. **Mock External Dependencies**: Database, APIs, file system
2. **Don't Mock What You Don't Own**: Avoid mocking internal classes
3. **Verify Mock Interactions**: Check that mocks are called correctly
4. **Reset Mocks**: Clear mock state between tests

### Common Pitfalls

1. **Testing Implementation Details**: Focus on behavior, not implementation
2. **Overly Complex Tests**: Keep tests simple and focused
3. **Missing Error Cases**: Test both success and failure paths
4. **Flaky Tests**: Avoid tests that randomly fail
5. **Slow Tests**: Keep unit tests fast with proper mocking

## Debugging Tests

### Debug Configuration

```typescript
// Debug Jest tests in VS Code
// .vscode/launch.json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Jest Tests",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": [
    "--runInBand",
    "--no-cache",
    "--testNamePattern=SearchService"
  ],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen",
  "env": {
    "NODE_ENV": "test"
  }
}
```

### Debugging Commands

```bash
# Debug specific test file
node --inspect-brk node_modules/.bin/jest src/services/SearchService.test.ts

# Debug with Chrome DevTools
node --inspect-brk node_modules/.bin/jest --runInBand

# Debug with verbose logging
DEBUG=* npm test

# Run single test with debugging
npm test -- --testNamePattern="should return cached results" --verbose
```

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [Node.js Testing Guide](https://nodejs.org/en/docs/guides/testing/)

---

**With this comprehensive testing strategy, Altus 4 maintains high code quality, reliability, and confidence in all deployments.**
