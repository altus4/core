# Testing Patterns & Best Practices

## Testing Strategy Overview

The Altus 4 testing strategy follows a pyramid approach:

- **Unit Tests**: Test individual services and utilities in isolation
- **Integration Tests**: Test API endpoints with real dependencies
- **Performance Tests**: Test system performance under load
- **Security Tests**: Test authentication and authorization

## Unit Testing Patterns

### Service Testing with Dependency Injection

```typescript
// DatabaseService.test.ts
describe('DatabaseService', () => {
  let service: DatabaseService;
  let mockConnectionManager: jest.Mocked<ConnectionManager>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockConnectionManager = createMockConnectionManager();
    mockLogger = createMockLogger();

    service = new DatabaseService({
      connectionManager: mockConnectionManager,
      logger: mockLogger,
      config: testConfig,
    });
  });

  describe('executeQuery', () => {
    it('should execute query and return results', async () => {
      const mockResults = [{ id: 1, name: 'test' }];
      mockConnectionManager.execute.mockResolvedValue([mockResults]);

      const results = await service.executeQuery('SELECT * FROM test', []);

      expect(results).toEqual(mockResults);
      expect(mockConnectionManager.execute).toHaveBeenCalledWith('SELECT * FROM test', []);
    });

    it('should handle connection errors gracefully', async () => {
      const connectionError = new Error('Connection failed');
      mockConnectionManager.execute.mockRejectedValue(connectionError);

      await expect(service.executeQuery('SELECT * FROM test', [])).rejects.toThrow(AppError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Query execution failed',
        expect.objectContaining({ error: connectionError })
      );
    });
  });
});
```

### Mock Factory Patterns

```typescript
// tests/helpers/mocks/database.mock.ts
export function createMockDatabaseService(): jest.Mocked<DatabaseService> {
  return {
    executeQuery: jest.fn(),
    getConnection: jest.fn(),
    releaseConnection: jest.fn(),
    healthCheck: jest.fn(),
    discoverSchema: jest.fn(),
    createConnectionPool: jest.fn(),
    closeConnectionPool: jest.fn(),
  };
}

// tests/helpers/mocks/search.mock.ts
export function createMockSearchService(): jest.Mocked<SearchService> {
  return {
    search: jest.fn(),
    searchAcrossDatabases: jest.fn(),
    getSuggestions: jest.fn(),
    analyzeQuery: jest.fn(),
    getSearchHistory: jest.fn(),
    getTrends: jest.fn(),
  };
}
```

### Testing Async Operations

```typescript
describe('SearchService', () => {
  it('should handle concurrent searches properly', async () => {
    const mockDatabases = [
      { id: 'db1', name: 'Database 1' },
      { id: 'db2', name: 'Database 2' },
    ];

    const searchPromises = mockDatabases.map(db => service.searchInDatabase('test query', db));

    const results = await Promise.allSettled(searchPromises);

    expect(results).toHaveLength(2);
    expect(results.every(r => r.status === 'fulfilled')).toBe(true);
  });
});
```

## Integration Testing Patterns

### API Endpoint Testing

```typescript
// tests/integration/search.test.ts
describe('Search API Integration', () => {
  let app: Express;
  let testDatabase: TestDatabase;
  let testApiKey: string;

  beforeAll(async () => {
    app = await createTestApp();
    testDatabase = await setupTestDatabase();
    testApiKey = await createTestApiKey();
  });

  afterAll(async () => {
    await cleanupTestDatabase(testDatabase);
    await cleanupTestApp(app);
  });

  beforeEach(async () => {
    await seedTestData(testDatabase);
  });

  afterEach(async () => {
    await clearTestData(testDatabase);
  });

  describe('POST /api/v1/search', () => {
    it('should return search results for authenticated request', async () => {
      const searchRequest = {
        query: 'machine learning',
        databases: [testDatabase.id],
        mode: 'natural',
      };

      const response = await request(app)
        .post('/api/v1/search')
        .set('Authorization', `Bearer ${testApiKey}`)
        .send(searchRequest)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            title: expect.any(String),
            content: expect.any(String),
            relevance: expect.any(Number),
          }),
        ]),
        metadata: expect.objectContaining({
          total: expect.any(Number),
          page: expect.any(Number),
          limit: expect.any(Number),
        }),
      });
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await request(app)
        .post('/api/v1/search')
        .send({ query: 'test' })
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          code: 'AUTHENTICATION_REQUIRED',
        }),
      });
    });

    it('should return 400 for invalid search query', async () => {
      const response = await request(app)
        .post('/api/v1/search')
        .set('Authorization', `Bearer ${testApiKey}`)
        .send({ query: '' }) // Invalid empty query
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          code: 'VALIDATION_ERROR',
        }),
      });
    });
  });
});
```

### Database Integration Testing

```typescript
describe('Database Integration', () => {
  let databaseService: DatabaseService;
  let testConnection: Connection;

  beforeAll(async () => {
    testConnection = await mysql.createConnection(testDbConfig);
    databaseService = new DatabaseService({ connection: testConnection });
  });

  afterAll(async () => {
    await testConnection.end();
  });

  it('should discover schema correctly', async () => {
    await testConnection.execute(`
      CREATE TABLE test_articles (
        id INT PRIMARY KEY,
        title VARCHAR(255),
        content TEXT,
        FULLTEXT KEY ft_content (title, content)
      )
    `);

    const schema = await databaseService.discoverSchema('test_db');

    expect(schema.tables).toContainEqual(
      expect.objectContaining({
        name: 'test_articles',
        fulltextIndexes: expect.arrayContaining([
          expect.objectContaining({
            columns: ['title', 'content'],
          }),
        ]),
      })
    );

    await testConnection.execute('DROP TABLE test_articles');
  });
});
```

## Test Data Management

### Test Database Setup

```typescript
// tests/helpers/database.helper.ts
export class TestDatabase {
  private connection: Connection;

  constructor(private config: DatabaseConfig) {}

  async setup(): Promise<void> {
    this.connection = await mysql.createConnection(this.config);
    await this.createTestTables();
  }

  async teardown(): Promise<void> {
    await this.dropTestTables();
    await this.connection.end();
  }

  async seed(fixtures: TestFixtures): Promise<void> {
    for (const [table, data] of Object.entries(fixtures)) {
      await this.insertTestData(table, data);
    }
  }

  async clear(): Promise<void> {
    const tables = await this.getTestTables();
    for (const table of tables) {
      await this.connection.execute(`DELETE FROM ${table}`);
    }
  }
}
```

### Test Fixtures

```typescript
// tests/fixtures/search.fixtures.ts
export const searchFixtures = {
  users: [
    {
      id: '1',
      email: 'test@example.com',
      password_hash: await bcrypt.hash('password123', 10),
    },
  ],
  api_keys: [
    {
      id: '1',
      user_id: '1',
      key_hash: 'hashed_key_value',
      tier: 'pro',
      is_active: true,
    },
  ],
  databases: [
    {
      id: '1',
      user_id: '1',
      name: 'Test Database',
      host: 'localhost',
      username: 'test_user',
      password: 'encrypted_password',
      database_name: 'test_db',
    },
  ],
};
```

## Performance Testing Patterns

### Load Testing with Jest

```typescript
describe('Search Performance', () => {
  const CONCURRENT_REQUESTS = 50;
  const REQUEST_TIMEOUT = 5000;

  it('should handle concurrent search requests', async () => {
    const searchRequests = Array(CONCURRENT_REQUESTS)
      .fill(null)
      .map(() =>
        request(app)
          .post('/api/v1/search')
          .set('Authorization', `Bearer ${testApiKey}`)
          .send({ query: 'performance test', databases: [testDbId] })
          .timeout(REQUEST_TIMEOUT)
      );

    const startTime = Date.now();
    const responses = await Promise.allSettled(searchRequests);
    const endTime = Date.now();

    const successfulResponses = responses.filter(r => r.status === 'fulfilled');
    const failedResponses = responses.filter(r => r.status === 'rejected');

    expect(successfulResponses.length).toBeGreaterThan(CONCURRENT_REQUESTS * 0.95); // 95% success rate
    expect(endTime - startTime).toBeLessThan(REQUEST_TIMEOUT * 2); // Reasonable response time
    expect(failedResponses.length).toBeLessThan(CONCURRENT_REQUESTS * 0.05); // Less than 5% failure rate
  });
});
```

### Memory Leak Testing

```typescript
describe('Memory Usage', () => {
  it('should not leak memory during repeated operations', async () => {
    const initialMemory = process.memoryUsage().heapUsed;
    const ITERATIONS = 1000;

    for (let i = 0; i < ITERATIONS; i++) {
      await service.performOperation();

      // Force garbage collection periodically
      if (i % 100 === 0 && global.gc) {
        global.gc();
      }
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;
    const maxAcceptableIncrease = 50 * 1024 * 1024; // 50MB

    expect(memoryIncrease).toBeLessThan(maxAcceptableIncrease);
  });
});
```

## Security Testing Patterns

### Authentication Testing

```typescript
describe('Authentication Security', () => {
  it('should reject invalid API keys', async () => {
    const invalidKeys = ['invalid-key', 'expired-key', 'revoked-key', ''];

    for (const key of invalidKeys) {
      const response = await request(app)
        .get('/api/v1/databases')
        .set('Authorization', `Bearer ${key}`)
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_API_KEY');
    }
  });

  it('should enforce rate limiting', async () => {
    const RATE_LIMIT = 100;
    const requests = Array(RATE_LIMIT + 10)
      .fill(null)
      .map(() =>
        request(app).get('/api/v1/databases').set('Authorization', `Bearer ${testApiKey}`)
      );

    const responses = await Promise.allSettled(requests);
    const rateLimitedResponses = responses.filter(
      r => r.status === 'fulfilled' && r.value.status === 429
    );

    expect(rateLimitedResponses.length).toBeGreaterThan(0);
  });
});
```

### Input Validation Testing

```typescript
describe('Input Validation', () => {
  const maliciousInputs = [
    "'; DROP TABLE users; --",
    '<script>alert("XSS")</script>',
    '../../etc/passwd',
    'null\0byte',
    'A'.repeat(10000), // Very long string
  ];

  test.each(maliciousInputs)('should reject malicious input: %s', async maliciousInput => {
    const response = await request(app)
      .post('/api/v1/search')
      .set('Authorization', `Bearer ${testApiKey}`)
      .send({ query: maliciousInput })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
```

## Test Configuration

### Jest Configuration

```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/index.ts'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 10000,
};
```

### Test Environment Setup

```typescript
// tests/setup.ts
beforeAll(async () => {
  // Setup test database
  await setupTestDatabase();

  // Setup test Redis instance
  await setupTestRedis();

  // Initialize test application
  await initializeTestApp();
});

afterAll(async () => {
  // Cleanup resources
  await cleanupTestDatabase();
  await cleanupTestRedis();
  await shutdownTestApp();
});

// Global error handler for tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
```

## Test Utilities

### Assertion Helpers

```typescript
// tests/helpers/assertions.ts
export function expectValidSearchResult(result: any): void {
  expect(result).toEqual(
    expect.objectContaining({
      id: expect.any(String),
      title: expect.any(String),
      content: expect.any(String),
      relevance: expect.any(Number),
      metadata: expect.any(Object),
    })
  );
}

export function expectValidApiResponse(response: any): void {
  expect(response.body).toEqual(
    expect.objectContaining({
      success: expect.any(Boolean),
      data: expect.any(Object),
      metadata: expect.objectContaining({
        timestamp: expect.any(String),
        requestId: expect.any(String),
      }),
    })
  );
}
```

### Test Data Builders

```typescript
// tests/builders/user.builder.ts
export class UserBuilder {
  private user: Partial<User> = {};

  withId(id: string): UserBuilder {
    this.user.id = id;
    return this;
  }

  withEmail(email: string): UserBuilder {
    this.user.email = email;
    return this;
  }

  withTier(tier: UserTier): UserBuilder {
    this.user.tier = tier;
    return this;
  }

  build(): User {
    return {
      id: this.user.id || generateUUID(),
      email: this.user.email || 'test@example.com',
      tier: this.user.tier || 'free',
      created_at: new Date(),
      updated_at: new Date(),
    };
  }
}
```
