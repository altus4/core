/**
 * Search Integration Tests
 *
 * Tests all search endpoints including executing searches, getting suggestions,
 * analyzing queries, retrieving trends, and accessing search history.
 */

import type { DatabaseConnection, User } from '@/types';
import { testDatabase } from '../test-database';
import { TestHelpers } from '../utils/test-helpers';
import type { TestServer } from './test-server';
import {
  createAuthenticatedRequest,
  setupTestEnvironment,
  teardownTestEnvironment,
} from './test-server';

describe('Search Integration Tests', () => {
  let server: TestServer;
  let testUser: User & { password: string };
  let authToken: string;
  let apiKey: string;
  let testConnection: DatabaseConnection;

  beforeAll(async () => {
    const { server: testServer } = await setupTestEnvironment();
    server = testServer;
  });

  afterAll(async () => {
    await teardownTestEnvironment();
  });

  beforeEach(async () => {
    await testDatabase.cleanup();
    testUser = await TestHelpers.createTestUser();
    authToken = TestHelpers.generateTestToken(testUser);

    // Create API key for search operations (search routes require API key auth)
    const apiKeyResponse = await server
      .request()
      .post('/api/v1/keys')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Search Test API Key',
        environment: 'test',
        permissions: ['search', 'analytics'],
        rateLimitTier: 'free',
      })
      .expect(201);

    apiKey = apiKeyResponse.body.data.secretKey;
    testConnection = await TestHelpers.createTestDatabaseConnection(testUser.id, {
      name: 'Test Search Database',
      database: 'altus4_test', // Use the test database
    });
  });

  describe('POST /api/v1/search', () => {
    it('should execute a natural language search successfully', async () => {
      const searchRequest = {
        query: 'MySQL database tutorial',
        databases: [testConnection.id],
        searchMode: 'natural',
        limit: 10,
        offset: 0,
      };

      const response = await server
        .request()
        .post('/api/v1/search')
        .set('Authorization', `Bearer ${apiKey}`)
        .send(searchRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('results');
      expect(response.body.data).toHaveProperty('totalCount');
      expect(response.body.data).toHaveProperty('executionTime');
      expect(response.body.data).toHaveProperty('searchId');
      expect(Array.isArray(response.body.data.results)).toBe(true);
      expect(typeof response.body.data.totalCount).toBe('number');
      expect(typeof response.body.data.executionTime).toBe('number');
    });

    it('should execute a boolean search successfully', async () => {
      const searchRequest = {
        query: '+MySQL +database -tutorial',
        databases: [testConnection.id],
        searchMode: 'boolean',
        limit: 5,
      };

      const response = await server
        .request()
        .post('/api/v1/search')
        .set('Authorization', `Bearer ${apiKey}`)
        .send(searchRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('results');
      expect(response.body.data.results.length).toBeLessThanOrEqual(5);
    });

    it('should execute a semantic search successfully', async () => {
      const searchRequest = {
        query: 'database management system',
        databases: [testConnection.id],
        searchMode: 'semantic',
        includeAnalytics: true,
      };

      const response = await server
        .request()
        .post('/api/v1/search')
        .set('Authorization', `Bearer ${apiKey}`)
        .send(searchRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('results');
      expect(response.body.data).toHaveProperty('analytics');
    });

    it('should search across specific tables when specified', async () => {
      const searchRequest = {
        query: 'programming',
        databases: [testConnection.id],
        tables: ['test_articles'],
        searchMode: 'natural',
      };

      const response = await server
        .request()
        .post('/api/v1/search')
        .set('Authorization', `Bearer ${apiKey}`)
        .send(searchRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('results');
    });

    it('should search across specific columns when specified', async () => {
      const searchRequest = {
        query: 'TypeScript',
        databases: [testConnection.id],
        tables: ['test_articles'],
        columns: ['title', 'content'],
        searchMode: 'natural',
      };

      const response = await server
        .request()
        .post('/api/v1/search')
        .set('Authorization', `Bearer ${apiKey}`)
        .send(searchRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('results');
    });

    it('should handle pagination correctly', async () => {
      const searchRequest = {
        query: 'database',
        databases: [testConnection.id],
        limit: 2,
        offset: 0,
      };

      const firstPage = await server
        .request()
        .post('/api/v1/search')
        .set('Authorization', `Bearer ${apiKey}`)
        .send(searchRequest)
        .expect(200);

      expect(firstPage.body.data.results.length).toBeLessThanOrEqual(2);

      const secondPage = await server
        .request()
        .post('/api/v1/search')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({ ...searchRequest, offset: 2 })
        .expect(200);

      expect(secondPage.body.success).toBe(true);
      // Results should be different if there are more than 2 results
      if (firstPage.body.data.totalCount > 2) {
        expect(secondPage.body.data.results).not.toEqual(firstPage.body.data.results);
      }
    });

    it('should reject empty search query', async () => {
      const searchRequest = {
        query: '',
        databases: [testConnection.id],
      };

      const response = await server
        .request()
        .post('/api/v1/search')
        .set('Authorization', `Bearer ${apiKey}`)
        .send(searchRequest)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Query cannot be empty');
    });

    it('should reject query that is too long', async () => {
      const searchRequest = {
        query: 'a'.repeat(501), // Exceeds 500 character limit
        databases: [testConnection.id],
      };

      const response = await server
        .request()
        .post('/api/v1/search')
        .set('Authorization', `Bearer ${apiKey}`)
        .send(searchRequest)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Query too long');
    });

    it('should reject invalid search mode', async () => {
      const searchRequest = {
        query: 'test query',
        databases: [testConnection.id],
        searchMode: 'invalid_mode',
      };

      const response = await server
        .request()
        .post('/api/v1/search')
        .set('Authorization', `Bearer ${apiKey}`)
        .send(searchRequest)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should require authentication', async () => {
      const searchRequest = {
        query: 'test query',
        databases: [testConnection.id],
      };

      const response = await server
        .request()
        .post('/api/v1/search')
        .send(searchRequest)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NO_TOKEN');
    });

    it('should validate limit bounds', async () => {
      const searchRequest = {
        query: 'test query',
        databases: [testConnection.id],
        limit: 101, // Exceeds maximum of 100
      };

      const response = await server
        .request()
        .post('/api/v1/search')
        .set('Authorization', `Bearer ${apiKey}`)
        .send(searchRequest)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/search/suggestions', () => {
    it('should get search suggestions successfully', async () => {
      const response = await server
        .request()
        .get('/api/v1/search/suggestions')
        .set('Authorization', `Bearer ${apiKey}`)
        .query({
          query: 'MyS',
          databases: [testConnection.id],
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('suggestions');
      expect(Array.isArray(response.body.data.suggestions)).toBe(true);
    });

    it('should filter suggestions by tables when specified', async () => {
      const response = await server
        .request()
        .get('/api/v1/search/suggestions')
        .set('Authorization', `Bearer ${apiKey}`)
        .query({
          query: 'prog',
          databases: [testConnection.id],
          tables: ['test_articles'],
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('suggestions');
    });

    it('should reject empty query for suggestions', async () => {
      const response = await server
        .request()
        .get('/api/v1/search/suggestions')
        .set('Authorization', `Bearer ${apiKey}`)
        .query({
          query: '',
          databases: [testConnection.id],
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should limit suggestion query length', async () => {
      const response = await server
        .request()
        .get('/api/v1/search/suggestions')
        .set('Authorization', `Bearer ${apiKey}`)
        .query({
          query: 'a'.repeat(101), // Exceeds 100 character limit
          databases: [testConnection.id],
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/search/analyze', () => {
    it('should analyze search query successfully', async () => {
      const analyzeRequest = {
        query:
          'SELECT * FROM test_articles WHERE MATCH(title, content) AGAINST("database" IN NATURAL LANGUAGE MODE)',
        databases: [testConnection.id],
      };

      const response = await server
        .request()
        .post('/api/v1/search/analyze')
        .set('Authorization', `Bearer ${apiKey}`)
        .send(analyzeRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('performance');
      expect(response.body.data).toHaveProperty('suggestions');
      expect(response.body.data).toHaveProperty('optimizations');
    });

    it('should require at least one database for analysis', async () => {
      const analyzeRequest = {
        query: 'test query',
        databases: [],
      };

      const response = await server
        .request()
        .post('/api/v1/search/analyze')
        .set('Authorization', `Bearer ${apiKey}`)
        .send(analyzeRequest)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('At least one database required');
    });

    it('should reject empty query for analysis', async () => {
      const analyzeRequest = {
        query: '',
        databases: [testConnection.id],
      };

      const response = await server
        .request()
        .post('/api/v1/search/analyze')
        .set('Authorization', `Bearer ${apiKey}`)
        .send(analyzeRequest)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/search/trends', () => {
    beforeEach(async () => {
      // Insert some search history for testing trends
      await testDatabase.query(
        `INSERT INTO searches (id, userId, query, searchMode, databases, resultCount, executionTime)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          'search-1',
          testUser.id,
          'database tutorial',
          'natural',
          JSON.stringify([testConnection.id]),
          5,
          120,
        ]
      );
      await testDatabase.query(
        `INSERT INTO searches (id, userId, query, searchMode, databases, resultCount, executionTime)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          'search-2',
          testUser.id,
          'MySQL performance',
          'boolean',
          JSON.stringify([testConnection.id]),
          3,
          89,
        ]
      );
    });

    it('should get user search trends successfully', async () => {
      const response = await server
        .request()
        .get('/api/v1/search/trends')
        .set('Authorization', `Bearer ${apiKey}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalSearches');
      expect(response.body.data).toHaveProperty('averageResponseTime');
      expect(response.body.data).toHaveProperty('popularQueries');
      expect(response.body.data).toHaveProperty('searchModeDistribution');
      expect(typeof response.body.data.totalSearches).toBe('number');
    });

    it('should return empty trends for new user', async () => {
      const newUser = await TestHelpers.createTestUser({
        email: 'newuser@example.com',
      });
      const newUserToken = TestHelpers.generateTestToken(newUser);
      const newUserRequest = createAuthenticatedRequest(server, newUserToken);

      const response = await newUserRequest.get('/api/v1/search/trends').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalSearches).toBe(0);
    });
  });

  describe('GET /api/v1/search/history', () => {
    beforeEach(async () => {
      // Insert search history for testing
      for (let i = 1; i <= 25; i++) {
        await testDatabase.query(
          `INSERT INTO search_analytics (id, user_id, query_text, search_mode, database_id, result_count, execution_time_ms)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            `search-${i}`,
            testUser.id,
            `test query ${i}`,
            'natural',
            testConnection.id,
            i * 2,
            100 + i,
          ]
        );
      }
    });

    it('should get search history with default pagination', async () => {
      const response = await server
        .request()
        .get('/api/v1/search/history')
        .set('Authorization', `Bearer ${apiKey}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('searches');
      expect(response.body.data).toHaveProperty('totalCount');
      expect(response.body.data).toHaveProperty('hasMore');
      expect(Array.isArray(response.body.data.searches)).toBe(true);
      expect(response.body.data.searches.length).toBeLessThanOrEqual(20);
      expect(response.body.data.totalCount).toBe(25);
    });

    it('should handle pagination parameters', async () => {
      const response = await server
        .request()
        .get('/api/v1/search/history')
        .set('Authorization', `Bearer ${apiKey}`)
        .query({ limit: 5, offset: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.searches.length).toBeLessThanOrEqual(5);
    });

    it('should return empty history for new user', async () => {
      const newUser = await TestHelpers.createTestUser({
        email: 'emptyhistory@example.com',
      });
      const newUserToken = TestHelpers.generateTestToken(newUser);
      const newUserRequest = createAuthenticatedRequest(server, newUserToken);

      const response = await newUserRequest.get('/api/v1/search/history').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.searches).toEqual([]);
      expect(response.body.data.totalCount).toBe(0);
    });

    it('should order search history by most recent first', async () => {
      const response = await server
        .request()
        .get('/api/v1/search/history')
        .set('Authorization', `Bearer ${apiKey}`)
        .query({ limit: 3 })
        .expect(200);

      expect(response.body.success).toBe(true);
      const { searches } = response.body.data;

      // Should be ordered by creation date descending (most recent first)
      for (let i = 0; i < searches.length - 1; i++) {
        const current = new Date(searches[i].createdAt);
        const next = new Date(searches[i + 1].createdAt);
        expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
      }
    });
  });

  describe('Search Performance', () => {
    it('should complete searches within acceptable time limits', async () => {
      const searchRequest = {
        query: 'performance test',
        databases: [testConnection.id],
        searchMode: 'natural',
        limit: 20,
      };

      const startTime = Date.now();
      const response = await server
        .request()
        .post('/api/v1/search')
        .set('Authorization', `Bearer ${apiKey}`)
        .send(searchRequest)
        .expect(200);
      const endTime = Date.now();

      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(response.body.data.executionTime).toBeLessThan(2000); // DB execution should be under 2 seconds
    });

    it('should handle concurrent search requests', async () => {
      const searchRequest = {
        query: 'concurrent test',
        databases: [testConnection.id],
        searchMode: 'natural',
      };

      const promises = Array.from({ length: 5 }, () =>
        server
          .request()
          .post('/api/v1/search')
          .set('Authorization', `Bearer ${apiKey}`)
          .send(searchRequest)
          .expect(200)
      );

      const responses = await Promise.all(promises);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });
});
