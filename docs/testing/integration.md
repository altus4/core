---
title: Integration Testing Guide
description: Comprehensive guide to integration testing in Altus 4 covering API testing, database integration, and service interaction testing.
---

# Integration Testing Guide

Comprehensive Integration Testing for Altus 4

Integration tests verify that different components of Altus 4 work correctly together, including API endpoints, database interactions, and service integrations. This guide covers strategies, patterns, and best practices for effective integration testing.

## Integration Testing Philosophy

### What to Test

Integration tests focus on:

- **API Endpoints**: Complete request/response cycles
- **Database Operations**: Real database interactions
- **Service Integration**: How services work together
- **External Dependencies**: Third-party API integrations
- **Authentication Flow**: End-to-end auth processes
- **Error Handling**: System behavior under failure conditions

### Integration vs Unit Tests

| Aspect           | Unit Tests         | Integration Tests     |
| ---------------- | ------------------ | --------------------- |
| **Scope**        | Single component   | Multiple components   |
| **Speed**        | Very fast (<1ms)   | Moderate (10-100ms)   |
| **Dependencies** | Mocked             | Real or test doubles  |
| **Environment**  | Isolated           | Test environment      |
| **Purpose**      | Logic verification | Component interaction |

## Test Environment Setup

### Test Database Configuration

```typescript
// tests/config/database.ts
import mysql from 'mysql2/promise';

export class TestDatabaseManager {
  private connection: mysql.Connection | null = null;

  async setupTestDatabase(): Promise<void> {
    this.connection = await mysql.createConnection({
      host: process.env.TEST_DB_HOST || 'localhost',
      port: parseInt(process.env.TEST_DB_PORT || '3306'),
      user: process.env.TEST_DB_USER || 'altus4_test',
      password: process.env.TEST_DB_PASSWORD || 'test_password',
      database: process.env.TEST_DB_NAME || 'altus4_test',
      multipleStatements: true,
    });

    // Create test schema
    await this.createTestSchema();

    // Seed initial data
    await this.seedTestData();
  }

  async cleanupTestDatabase(): Promise<void> {
    if (this.connection) {
      await this.clearTestData();
      await this.connection.end();
      this.connection = null;
    }
  }

  private async createTestSchema(): Promise<void> {
    const schema = `
      CREATE TABLE IF NOT EXISTS test_articles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        author VARCHAR(100),
        published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FULLTEXT KEY ft_title_content (title, content),
        FULLTEXT KEY ft_title (title)
      );

      CREATE TABLE IF NOT EXISTS test_products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        price DECIMAL(10,2),
        FULLTEXT KEY ft_name_description (name, description)
      );
    `;

    await this.connection!.execute(schema);
  }

  private async seedTestData(): Promise<void> {
    const articles = [
      {
        title: 'MySQL Performance Optimization Guide',
        content:
          'Comprehensive guide to optimizing MySQL database performance including indexing strategies, query optimization, and server configuration.',
        author: 'Database Expert',
      },
      {
        title: 'Advanced Database Indexing',
        content:
          'Learn about B-tree indexes, composite indexes, and full-text search optimization techniques for better query performance.',
        author: 'Index Specialist',
      },
      {
        title: 'Query Performance Tuning',
        content:
          'Best practices for writing efficient SQL queries, avoiding common pitfalls, and using EXPLAIN to analyze query execution plans.',
        author: 'SQL Expert',
      },
    ];

    for (const article of articles) {
      await this.connection!.execute(
        'INSERT INTO test_articles (title, content, author) VALUES (?, ?, ?)',
        [article.title, article.content, article.author]
      );
    }

    const products = [
      {
        name: 'Gaming Laptop Pro',
        description: 'High-performance gaming laptop with RTX graphics and fast SSD storage',
        category: 'Electronics',
        price: 1299.99,
      },
      {
        name: 'Wireless Gaming Mouse',
        description: 'Precision wireless mouse designed for competitive gaming',
        category: 'Accessories',
        price: 79.99,
      },
    ];

    for (const product of products) {
      await this.connection!.execute(
        'INSERT INTO test_products (name, description, category, price) VALUES (?, ?, ?, ?)',
        [product.name, product.description, product.category, product.price]
      );
    }
  }

  private async clearTestData(): Promise<void> {
    await this.connection!.execute('DELETE FROM test_articles');
    await this.connection!.execute('DELETE FROM test_products');
  }

  async getConnection(): Promise<mysql.Connection> {
    if (!this.connection) {
      throw new Error('Test database not initialized');
    }
    return this.connection;
  }
}

// Global test database instance
export const testDb = new TestDatabaseManager();
```

### Test Server Setup

```typescript
// tests/helpers/test-server.ts
import { app } from '@/app';
import { Server } from 'http';
import { testDb } from '../config/database';

export class TestServer {
  private server: Server | null = null;
  private port: number;

  constructor(port: number = 0) {
    this.port = port;
  }

  async start(): Promise<void> {
    // Setup test database
    await testDb.setupTestDatabase();

    // Start server
    return new Promise((resolve, reject) => {
      this.server = app.listen(this.port, (err?: Error) => {
        if (err) {
          reject(err);
        } else {
          const address = this.server!.address();
          if (typeof address === 'object' && address) {
            this.port = address.port;
          }
          resolve();
        }
      });
    });
  }

  async stop(): Promise<void> {
    // Cleanup database
    await testDb.cleanupTestDatabase();

    // Stop server
    if (this.server) {
      return new Promise(resolve => {
        this.server!.close(() => {
          this.server = null;
          resolve();
        });
      });
    }
  }

  getPort(): number {
    return this.port;
  }

  getBaseUrl(): string {
    return `http://localhost:${this.port}`;
  }
}
```

## API Integration Testing

### Authentication Testing

```typescript
// tests/integration/auth/authentication.test.ts
import request from 'supertest';
import { TestServer } from '../../helpers/test-server';
import { createTestUser, createTestApiKey } from '../../helpers/auth-helpers';

describe('Authentication Integration', () => {
  let testServer: TestServer;
  let baseUrl: string;

  beforeAll(async () => {
    testServer = new TestServer();
    await testServer.start();
    baseUrl = testServer.getBaseUrl();
  });

  afterAll(async () => {
    await testServer.stop();
  });

  describe('User Registration', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'securePassword123',
      };

      const response = await request(baseUrl)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          user: {
            id: expect.any(String),
            name: userData.name,
            email: userData.email,
            role: 'user',
          },
        },
      });

      // Verify user was created in database
      const connection = await testDb.getConnection();
      const [users] = await connection.execute('SELECT * FROM users WHERE email = ?', [
        userData.email,
      ]);

      expect(users).toHaveLength(1);
      expect((users as any[])[0].email).toBe(userData.email);
    });

    it('should reject duplicate email registration', async () => {
      const userData = {
        name: 'Test User',
        email: 'duplicate@example.com',
        password: 'securePassword123',
      };

      // First registration
      await request(baseUrl).post('/api/v1/auth/register').send(userData).expect(201);

      // Duplicate registration
      const response = await request(baseUrl)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'EMAIL_EXISTS',
          message: expect.stringContaining('email'),
        },
      });
    });

    it('should validate required fields', async () => {
      const invalidData = {
        name: 'Test User',
        // Missing email and password
      };

      const response = await request(baseUrl)
        .post('/api/v1/auth/register')
        .send(invalidData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('User Login', () => {
    let testUser: any;

    beforeEach(async () => {
      testUser = await createTestUser({
        email: 'login-test@example.com',
        password: 'testPassword123',
        name: 'Login Test User',
      });
    });

    it('should login with valid credentials', async () => {
      const response = await request(baseUrl)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'testPassword123',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          token: expect.any(String),
          user: {
            id: testUser.id,
            email: testUser.email,
            name: testUser.name,
          },
        },
      });

      // Verify JWT token structure
      const token = response.body.data.token;
      expect(token).toMatch(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/);
    });

    it('should reject invalid credentials', async () => {
      const response = await request(baseUrl)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongPassword',
        })
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: expect.any(String),
        },
      });
    });
  });

  describe('API Key Management', () => {
    let testUser: any;
    let authToken: string;

    beforeEach(async () => {
      testUser = await createTestUser();

      // Get auth token
      const loginResponse = await request(baseUrl).post('/api/v1/auth/login').send({
        email: testUser.email,
        password: 'testPassword123',
      });

      authToken = loginResponse.body.data.token;
    });

    it('should create first API key via setup endpoint', async () => {
      const response = await request(baseUrl)
        .post('/api/v1/management/setup')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          apiKey: {
            id: expect.any(String),
            key: expect.stringMatching(/^altus4_sk_test_/),
            name: 'Default API Key',
            environment: 'test',
            permissions: ['search'],
          },
        },
      });
    });

    it('should create additional API keys', async () => {
      // First create initial API key
      const setupResponse = await request(baseUrl)
        .post('/api/v1/management/setup')
        .set('Authorization', `Bearer ${authToken}`);

      const firstApiKey = setupResponse.body.data.apiKey.key;

      // Create additional API key
      const response = await request(baseUrl)
        .post('/api/v1/keys')
        .set('Authorization', `Bearer ${firstApiKey}`)
        .send({
          name: 'Production API Key',
          environment: 'live',
          permissions: ['search', 'analytics'],
        })
        .expect(201);

      expect(response.body.data.apiKey.key).toMatch(/^altus4_sk_live_/);
      expect(response.body.data.apiKey.permissions).toEqual(['search', 'analytics']);
    });
  });
});
```

### Search API Integration Testing

```typescript
// tests/integration/api/search.test.ts
import request from 'supertest';
import { TestServer } from '../../helpers/test-server';
import { createTestUser, createTestApiKey, createTestDatabase } from '../../helpers/auth-helpers';

describe('Search API Integration', () => {
  let testServer: TestServer;
  let baseUrl: string;
  let testUser: any;
  let testApiKey: string;
  let testDatabaseId: string;

  beforeAll(async () => {
    testServer = new TestServer();
    await testServer.start();
    baseUrl = testServer.getBaseUrl();

    // Setup test user and API key
    testUser = await createTestUser();
    testApiKey = await createTestApiKey(testUser.id, {
      permissions: ['search', 'analytics'],
      environment: 'test',
    });

    // Create test database connection
    testDatabaseId = await createTestDatabase(testUser.id, {
      name: 'Test Database',
      host: 'localhost',
      database: 'altus4_test',
      tables: ['test_articles', 'test_products'],
    });
  });

  afterAll(async () => {
    await testServer.stop();
  });

  describe('POST /api/v1/search', () => {
    it('should execute basic search successfully', async () => {
      const response = await request(baseUrl)
        .post('/api/v1/search')
        .set('Authorization', `Bearer ${testApiKey}`)
        .send({
          query: 'mysql performance',
          databases: [testDatabaseId],
          searchMode: 'natural',
          limit: 10,
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          results: expect.any(Array),
          totalCount: expect.any(Number),
          executionTime: expect.any(Number),
          categories: expect.any(Array),
          suggestions: expect.any(Array),
        },
        meta: {
          timestamp: expect.any(String),
          requestId: expect.any(String),
          version: expect.any(String),
        },
      });

      // Verify search results structure
      if (response.body.data.results.length > 0) {
        const result = response.body.data.results[0];
        expect(result).toMatchObject({
          id: expect.any(String),
          database: testDatabaseId,
          table: expect.any(String),
          data: expect.any(Object),
          relevanceScore: expect.any(Number),
          snippet: expect.any(String),
          matchedColumns: expect.any(Array),
        });
      }
    });

    it('should handle semantic search mode', async () => {
      const response = await request(baseUrl)
        .post('/api/v1/search')
        .set('Authorization', `Bearer ${testApiKey}`)
        .send({
          query: 'database optimization techniques',
          databases: [testDatabaseId],
          searchMode: 'semantic',
          limit: 15,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toBeInstanceOf(Array);
    });

    it('should handle boolean search mode', async () => {
      const response = await request(baseUrl)
        .post('/api/v1/search')
        .set('Authorization', `Bearer ${testApiKey}`)
        .send({
          query: '+mysql +performance -slow',
          databases: [testDatabaseId],
          searchMode: 'boolean',
          limit: 20,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should support table filtering', async () => {
      const response = await request(baseUrl)
        .post('/api/v1/search')
        .set('Authorization', `Bearer ${testApiKey}`)
        .send({
          query: 'performance',
          databases: [testDatabaseId],
          tables: ['test_articles'],
          limit: 10,
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      // All results should be from the specified table
      response.body.data.results.forEach((result: any) => {
        expect(result.table).toBe('test_articles');
      });
    });

    it('should support column filtering', async () => {
      const response = await request(baseUrl)
        .post('/api/v1/search')
        .set('Authorization', `Bearer ${testApiKey}`)
        .send({
          query: 'mysql',
          databases: [testDatabaseId],
          columns: ['title'],
          limit: 10,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle pagination correctly', async () => {
      // First page
      const page1Response = await request(baseUrl)
        .post('/api/v1/search')
        .set('Authorization', `Bearer ${testApiKey}`)
        .send({
          query: 'database',
          databases: [testDatabaseId],
          limit: 2,
          offset: 0,
        })
        .expect(200);

      // Second page
      const page2Response = await request(baseUrl)
        .post('/api/v1/search')
        .set('Authorization', `Bearer ${testApiKey}`)
        .send({
          query: 'database',
          databases: [testDatabaseId],
          limit: 2,
          offset: 2,
        })
        .expect(200);

      expect(page1Response.body.success).toBe(true);
      expect(page2Response.body.success).toBe(true);

      // Results should be different (assuming more than 2 total results)
      if (page1Response.body.data.totalCount > 2) {
        const page1Ids = page1Response.body.data.results.map((r: any) => r.id);
        const page2Ids = page2Response.body.data.results.map((r: any) => r.id);

        expect(page1Ids).not.toEqual(page2Ids);
      }
    });

    it('should validate request parameters', async () => {
      // Empty query
      const emptyQueryResponse = await request(baseUrl)
        .post('/api/v1/search')
        .set('Authorization', `Bearer ${testApiKey}`)
        .send({
          query: '',
          databases: [testDatabaseId],
        })
        .expect(400);

      expect(emptyQueryResponse.body.error.code).toBe('VALIDATION_ERROR');

      // No databases
      const noDatabasesResponse = await request(baseUrl)
        .post('/api/v1/search')
        .set('Authorization', `Bearer ${testApiKey}`)
        .send({
          query: 'test query',
          databases: [],
        })
        .expect(400);

      expect(noDatabasesResponse.body.error.code).toBe('VALIDATION_ERROR');

      // Invalid limit
      const invalidLimitResponse = await request(baseUrl)
        .post('/api/v1/search')
        .set('Authorization', `Bearer ${testApiKey}`)
        .send({
          query: 'test query',
          databases: [testDatabaseId],
          limit: 500, // Exceeds maximum
        })
        .expect(400);

      expect(invalidLimitResponse.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle authentication errors', async () => {
      // No API key
      await request(baseUrl)
        .post('/api/v1/search')
        .send({
          query: 'test query',
          databases: [testDatabaseId],
        })
        .expect(401);

      // Invalid API key
      await request(baseUrl)
        .post('/api/v1/search')
        .set('Authorization', 'Bearer invalid_key')
        .send({
          query: 'test query',
          databases: [testDatabaseId],
        })
        .expect(401);
    });

    it('should handle permission errors', async () => {
      // Create API key without search permission
      const limitedApiKey = await createTestApiKey(testUser.id, {
        permissions: ['analytics'], // No search permission
        environment: 'test',
      });

      const response = await request(baseUrl)
        .post('/api/v1/search')
        .set('Authorization', `Bearer ${limitedApiKey}`)
        .send({
          query: 'test query',
          databases: [testDatabaseId],
        })
        .expect(403);

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });
  });

  describe('GET /api/v1/search/suggestions', () => {
    it('should return search suggestions', async () => {
      const response = await request(baseUrl)
        .get('/api/v1/search/suggestions')
        .set('Authorization', `Bearer ${testApiKey}`)
        .query({
          query: 'mysql perf',
          databases: testDatabaseId,
          limit: 5,
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          suggestions: expect.any(Array),
        },
      });

      // Verify suggestion structure
      if (response.body.data.suggestions.length > 0) {
        const suggestion = response.body.data.suggestions[0];
        expect(suggestion).toMatchObject({
          text: expect.any(String),
          score: expect.any(Number),
          type: expect.any(String),
        });
      }
    });
  });

  describe('GET /api/v1/search/history', () => {
    it('should return user search history', async () => {
      // Perform a search first to create history
      await request(baseUrl)
        .post('/api/v1/search')
        .set('Authorization', `Bearer ${testApiKey}`)
        .send({
          query: 'mysql optimization',
          databases: [testDatabaseId],
        });

      // Get search history
      const response = await request(baseUrl)
        .get('/api/v1/search/history')
        .set('Authorization', `Bearer ${testApiKey}`)
        .query({ limit: 10 })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          searches: expect.any(Array),
          totalCount: expect.any(Number),
        },
      });

      // Verify history entry structure
      if (response.body.data.searches.length > 0) {
        const historyEntry = response.body.data.searches[0];
        expect(historyEntry).toMatchObject({
          id: expect.any(String),
          query: expect.any(String),
          searchMode: expect.any(String),
          resultCount: expect.any(Number),
          executionTime: expect.any(Number),
          createdAt: expect.any(String),
        });
      }
    });
  });
});
```

### Database Integration Testing

```typescript
// tests/integration/database/database-operations.test.ts
import { DatabaseService } from '@/services/DatabaseService';
import { testDb } from '../../config/database';
import { createTestUser, createTestDatabase } from '../../helpers/auth-helpers';

describe('Database Operations Integration', () => {
  let databaseService: DatabaseService;
  let testUser: any;
  let testDatabaseId: string;

  beforeAll(async () => {
    await testDb.setupTestDatabase();
    databaseService = new DatabaseService();

    testUser = await createTestUser();
    testDatabaseId = await createTestDatabase(testUser.id);
  });

  afterAll(async () => {
    await testDb.cleanupTestDatabase();
  });

  describe('Full-text Search Operations', () => {
    it('should execute natural language search', async () => {
      const results = await databaseService.executeFullTextSearch(
        testDatabaseId,
        'mysql performance optimization',
        ['test_articles'],
        ['title', 'content'],
        10,
        0
      );

      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeGreaterThan(0);

      // Verify result structure
      const result = results[0];
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('table', 'test_articles');
    });

    it('should execute boolean search', async () => {
      const results = await databaseService.executeFullTextSearch(
        testDatabaseId,
        '+mysql +performance -slow',
        ['test_articles'],
        ['title', 'content'],
        10,
        0,
        'boolean'
      );

      expect(results).toBeInstanceOf(Array);

      // All results should contain 'mysql' and 'performance' but not 'slow'
      results.forEach(result => {
        const text = `${result.title} ${result.content}`.toLowerCase();
        expect(text).toMatch(/mysql/);
        expect(text).toMatch(/performance/);
        expect(text).not.toMatch(/slow/);
      });
    });

    it('should handle empty search results', async () => {
      const results = await databaseService.executeFullTextSearch(
        testDatabaseId,
        'nonexistent query terms xyz123',
        ['test_articles'],
        ['title', 'content'],
        10,
        0
      );

      expect(results).toBeInstanceOf(Array);
      expect(results).toHaveLength(0);
    });

    it('should support pagination', async () => {
      // Get first page
      const page1 = await databaseService.executeFullTextSearch(
        testDatabaseId,
        'database',
        ['test_articles'],
        ['title', 'content'],
        2,
        0
      );

      // Get second page
      const page2 = await databaseService.executeFullTextSearch(
        testDatabaseId,
        'database',
        ['test_articles'],
        ['title', 'content'],
        2,
        2
      );

      expect(page1).toBeInstanceOf(Array);
      expect(page2).toBeInstanceOf(Array);

      // Results should be different (if there are enough total results)
      if (page1.length === 2 && page2.length > 0) {
        const page1Ids = page1.map(r => r.id);
        const page2Ids = page2.map(r => r.id);
        expect(page1Ids).not.toEqual(page2Ids);
      }
    });

    it('should handle multiple tables', async () => {
      const results = await databaseService.executeFullTextSearch(
        testDatabaseId,
        'gaming',
        ['test_articles', 'test_products'],
        ['title', 'content', 'name', 'description'],
        10,
        0
      );

      expect(results).toBeInstanceOf(Array);

      // Results should include entries from both tables
      const tables = [...new Set(results.map(r => r.table))];
      expect(tables.length).toBeGreaterThan(0);
    });
  });

  describe('Connection Management', () => {
    it('should test database connection', async () => {
      const connectionConfig = {
        host: 'localhost',
        port: 3306,
        database: 'altus4_test',
        username: process.env.TEST_DB_USER || 'altus4_test',
        password: process.env.TEST_DB_PASSWORD || 'test_password',
      };

      const result = await databaseService.testConnection(connectionConfig);

      expect(result).toMatchObject({
        success: true,
        message: expect.any(String),
        responseTime: expect.any(Number),
      });
    });

    it('should handle connection failures', async () => {
      const invalidConfig = {
        host: 'invalid-host',
        port: 9999,
        database: 'nonexistent',
        username: 'invalid',
        password: 'invalid',
      };

      const result = await databaseService.testConnection(invalidConfig);

      expect(result).toMatchObject({
        success: false,
        error: expect.any(String),
      });
    });
  });

  describe('Schema Discovery', () => {
    it('should discover database schema', async () => {
      const schema = await databaseService.discoverSchema(testDatabaseId);

      expect(schema).toMatchObject({
        database: expect.any(String),
        tables: expect.any(Array),
      });

      // Should include our test tables
      const tableNames = schema.tables.map(t => t.name);
      expect(tableNames).toContain('test_articles');
      expect(tableNames).toContain('test_products');

      // Verify table structure
      const articlesTable = schema.tables.find(t => t.name === 'test_articles');
      expect(articlesTable).toMatchObject({
        name: 'test_articles',
        columns: expect.any(Array),
        fulltextIndexes: expect.any(Array),
        estimatedRows: expect.any(Number),
      });

      // Should have FULLTEXT indexes
      expect(articlesTable.fulltextIndexes.length).toBeGreaterThan(0);
    });
  });
});
```

## Service Integration Testing

### Multi-Service Integration

```typescript
// tests/integration/services/search-integration.test.ts
import { SearchService } from '@/services/SearchService';
import { DatabaseService } from '@/services/DatabaseService';
import { AIService } from '@/services/AIService';
import { CacheService } from '@/services/CacheService';
import { testDb } from '../../config/database';
import { createTestUser, createTestDatabase } from '../../helpers/auth-helpers';

describe('Search Service Integration', () => {
  let searchService: SearchService;
  let databaseService: DatabaseService;
  let aiService: AIService;
  let cacheService: CacheService;
  let testUser: any;
  let testDatabaseId: string;

  beforeAll(async () => {
    await testDb.setupTestDatabase();

    // Initialize real services
    databaseService = new DatabaseService();
    aiService = new AIService();
    cacheService = new CacheService();
    searchService = new SearchService(databaseService, aiService, cacheService);

    testUser = await createTestUser();
    testDatabaseId = await createTestDatabase(testUser.id);
  });

  afterAll(async () => {
    await testDb.cleanupTestDatabase();
  });

  describe('End-to-End Search Flow', () => {
    it('should execute complete search workflow', async () => {
      const searchRequest = {
        query: 'mysql performance optimization',
        databases: [testDatabaseId],
        userId: testUser.id,
        searchMode: 'natural' as const,
        limit: 10,
      };

      const result = await searchService.search(searchRequest);

      expect(result).toMatchObject({
        results: expect.any(Array),
        totalCount: expect.any(Number),
        executionTime: expect.any(Number),
        categories: expect.any(Array),
        suggestions: expect.any(Array),
      });

      // Verify search results structure
      if (result.results.length > 0) {
        const searchResult = result.results[0];
        expect(searchResult).toMatchObject({
          id: expect.any(String),
          database: testDatabaseId,
          table: expect.any(String),
          data: expect.any(Object),
          relevanceScore: expect.any(Number),
          snippet: expect.any(String),
          matchedColumns: expect.any(Array),
        });
      }
    });

    it('should cache search results', async () => {
      const searchRequest = {
        query: 'database indexing strategies',
        databases: [testDatabaseId],
        userId: testUser.id,
        searchMode: 'natural' as const,
        limit: 10,
      };

      // First search - should hit database
      const startTime1 = Date.now();
      const result1 = await searchService.search(searchRequest);
      const executionTime1 = Date.now() - startTime1;

      // Second search - should hit cache
      const startTime2 = Date.now();
      const result2 = await searchService.search(searchRequest);
      const executionTime2 = Date.now() - startTime2;

      // Results should be identical
      expect(result1.results).toEqual(result2.results);
      expect(result1.totalCount).toBe(result2.totalCount);

      // Second search should be faster (cached)
      expect(executionTime2).toBeLessThan(executionTime1);
    });

    it('should handle AI enhancement when available', async () => {
      // Skip if AI service is not available
      if (!aiService.isAvailable()) {
        console.log('Skipping AI test - service not available');
        return;
      }

      const searchRequest = {
        query: 'improve database speed',
        databases: [testDatabaseId],
        userId: testUser.id,
        searchMode: 'semantic' as const,
        limit: 10,
      };

      const result = await searchService.search(searchRequest);

      expect(result).toMatchObject({
        results: expect.any(Array),
        totalCount: expect.any(Number),
        executionTime: expect.any(Number),
      });

      // AI-enhanced search might have categories
      if (result.categories && result.categories.length > 0) {
        expect(result.categories[0]).toMatchObject({
          name: expect.any(String),
          count: expect.any(Number),
        });
      }
    });

    it('should handle multiple database search', async () => {
      // Create second test database
      const testDatabase2Id = await createTestDatabase(testUser.id, {
        name: 'Test Database 2',
      });

      const searchRequest = {
        query: 'database performance',
        databases: [testDatabaseId, testDatabase2Id],
        userId: testUser.id,
        searchMode: 'natural' as const,
        limit: 20,
      };

      const result = await searchService.search(searchRequest);

      expect(result).toMatchObject({
        results: expect.any(Array),
        totalCount: expect.any(Number),
        executionTime: expect.any(Number),
      });

      // Results should potentially come from both databases
      if (result.results.length > 0) {
        const databases = [...new Set(result.results.map(r => r.database))];
        expect(databases.length).toBeGreaterThan(0);
      }
    });

    it('should handle database failures gracefully', async () => {
      // Create database with invalid configuration
      const invalidDatabaseId = await createTestDatabase(testUser.id, {
        name: 'Invalid Database',
        host: 'invalid-host',
        port: 9999,
      });

      const searchRequest = {
        query: 'test query',
        databases: [testDatabaseId, invalidDatabaseId],
        userId: testUser.id,
        searchMode: 'natural' as const,
        limit: 10,
      };

      // Should not throw error, but handle failure gracefully
      const result = await searchService.search(searchRequest);

      expect(result).toMatchObject({
        results: expect.any(Array),
        totalCount: expect.any(Number),
        executionTime: expect.any(Number),
      });

      // Should still have results from valid database
      if (result.results.length > 0) {
        result.results.forEach(r => {
          expect(r.database).toBe(testDatabaseId);
        });
      }
    });
  });

  describe('Search Analytics Integration', () => {
    it('should log search analytics', async () => {
      const searchRequest = {
        query: 'analytics test query',
        databases: [testDatabaseId],
        userId: testUser.id,
        searchMode: 'natural' as const,
        limit: 10,
      };

      await searchService.search(searchRequest);

      // Verify analytics were logged
      const connection = await testDb.getConnection();
      const [searches] = await connection.execute(
        'SELECT * FROM searches WHERE user_id = ? AND query = ?',
        [testUser.id, searchRequest.query]
      );

      expect(searches).toHaveLength(1);
      const searchLog = (searches as any[])[0];
      expect(searchLog).toMatchObject({
        user_id: testUser.id,
        query: searchRequest.query,
        search_mode: searchRequest.searchMode,
        result_count: expect.any(Number),
        execution_time_ms: expect.any(Number),
      });
    });
  });
});
```

## Performance Integration Testing

```typescript
// tests/integration/performance/api-performance.test.ts
import request from 'supertest';
import { TestServer } from '../../helpers/test-server';
import { createTestUser, createTestApiKey, createTestDatabase } from '../../helpers/auth-helpers';
import { performance } from 'perf_hooks';

describe('API Performance Integration', () => {
  let testServer: TestServer;
  let baseUrl: string;
  let testApiKey: string;
  let testDatabaseId: string;

  beforeAll(async () => {
    testServer = new TestServer();
    await testServer.start();
    baseUrl = testServer.getBaseUrl();

    const testUser = await createTestUser();
    testApiKey = await createTestApiKey(testUser.id);
    testDatabaseId = await createTestDatabase(testUser.id);
  });

  afterAll(async () => {
    await testServer.stop();
  });

  describe('Search Performance', () => {
    it('should handle concurrent search requests', async () => {
      const concurrentRequests = 10;
      const searchPromises = Array.from({ length: concurrentRequests }, (_, i) =>
        request(baseUrl)
          .post('/api/v1/search')
          .set('Authorization', `Bearer ${testApiKey}`)
          .send({
            query: `performance test query ${i}`,
            databases: [testDatabaseId],
            limit: 10,
          })
      );

      const startTime = performance.now();
      const results = await Promise.all(searchPromises);
      const endTime = performance.now();

      const totalTime = endTime - startTime;
      const averageTime = totalTime / concurrentRequests;

      // All requests should succeed
      results.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Performance assertions
      expect(averageTime).toBeLessThan(1000); // Average < 1 second
      expect(totalTime).toBeLessThan(5000); // Total < 5 seconds
    });

    it('should maintain performance under load', async () => {
      const requestCount = 50;
      const batchSize = 10;
      const batches = Math.ceil(requestCount / batchSize);

      const allResults = [];
      const executionTimes = [];

      for (let batch = 0; batch < batches; batch++) {
        const batchPromises = Array.from({ length: batchSize }, (_, i) => {
          const startTime = performance.now();

          return request(baseUrl)
            .post('/api/v1/search')
            .set('Authorization', `Bearer ${testApiKey}`)
            .send({
              query: 'load test query',
              databases: [testDatabaseId],
              limit: 10,
            })
            .then(response => {
              const endTime = performance.now();
              executionTimes.push(endTime - startTime);
              return response;
            });
        });

        const batchResults = await Promise.all(batchPromises);
        allResults.push(...batchResults);

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // All requests should succeed
      const successfulRequests = allResults.filter(r => r.status === 200).length;
      const successRate = (successfulRequests / requestCount) * 100;

      expect(successRate).toBeGreaterThan(95); // 95% success rate

      // Performance metrics
      const averageTime = executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length;
      const p95Time = executionTimes.sort((a, b) => a - b)[
        Math.floor(executionTimes.length * 0.95)
      ];

      expect(averageTime).toBeLessThan(500); // Average < 500ms
      expect(p95Time).toBeLessThan(1000); // P95 < 1 second
    });
  });
});
```

## Test Configuration

### Jest Integration Config

```javascript
// jest.integration.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/integration'],
  testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/integration-setup.ts'],
  testTimeout: 30000, // 30 seconds for integration tests
  maxWorkers: 1, // Run tests sequentially to avoid database conflicts
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/**/__tests__/**'],
  coverageDirectory: 'coverage/integration',
  globalSetup: '<rootDir>/tests/global-setup.ts',
  globalTeardown: '<rootDir>/tests/global-teardown.ts',
};
```

### Integration Test Setup

```typescript
// tests/integration-setup.ts
import { testDb } from './config/database';

// Global setup for integration tests
beforeAll(async () => {
  // Setup test database
  await testDb.setupTestDatabase();

  // Set environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error';
  process.env.CACHE_ENABLED = 'true';
  process.env.AI_ENABLED = 'false'; // Disable AI for most tests
}, 60000); // 60 second timeout

afterAll(async () => {
  // Cleanup test database
  await testDb.cleanupTestDatabase();
}, 30000);

// Clean up between tests
afterEach(async () => {
  // Clear cache
  if (global.cacheService) {
    await global.cacheService.flushAll();
  }
});
```

## Best Practices

### Integration Test Guidelines

1. **Use Real Dependencies**: Test with actual database, cache, and external services
2. **Isolate Tests**: Each test should be independent and not affect others
3. **Test Happy Path**: Verify normal operation flows
4. **Test Error Conditions**: Verify error handling and recovery
5. **Performance Aware**: Monitor test execution time and system resources
6. **Data Management**: Use fixtures and cleanup between tests
7. **Environment Consistency**: Use consistent test environment setup

### Common Patterns

```typescript
// Pattern: Test setup and cleanup
describe('Feature Integration', () => {
  let testData: any;

  beforeEach(async () => {
    testData = await setupTestData();
  });

  afterEach(async () => {
    await cleanupTestData(testData);
  });

  it('should work correctly', async () => {
    // Test implementation
  });
});

// Pattern: Error handling verification
it('should handle service failures gracefully', async () => {
  // Simulate service failure
  jest.spyOn(externalService, 'method').mockRejectedValue(new Error('Service down'));

  // Verify graceful handling
  const result = await serviceUnderTest.operation();
  expect(result.success).toBe(false);
  expect(result.error).toBeDefined();
});

// Pattern: Performance assertions
it('should meet performance requirements', async () => {
  const startTime = performance.now();

  await operationUnderTest();

  const executionTime = performance.now() - startTime;
  expect(executionTime).toBeLessThan(1000); // < 1 second
});
```

## Related Documentation

- **[Unit Testing Guide](./unit.md)** - Unit testing strategies and patterns
- **[Performance Testing Guide](./performance.md)** - Performance testing implementation
- **[Testing Overview](./index.md)** - Complete testing strategy
- **[Development Standards](../development/standards.md)** - Code quality standards

---

**Integration tests ensure that Altus 4 components work correctly together in realistic scenarios. Follow these patterns to build comprehensive integration test suites that verify system behavior and catch integration issues early.**
