/**
 * Analytics Integration Tests
 *
 * Tests all analytics endpoints including search trends, performance metrics,
 * popular queries, search history, insights, dashboard data, and admin endpoints.
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

describe('Analytics Integration Tests', () => {
  let server: TestServer;
  let testUser: User & { password: string };
  let adminUser: User & { password: string };
  let authToken: string;
  let adminToken: string;
  let authenticatedRequest: ReturnType<typeof createAuthenticatedRequest>;
  let adminRequest: ReturnType<typeof createAuthenticatedRequest>;
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

    // Create regular test user
    testUser = await TestHelpers.createTestUser();
    authToken = TestHelpers.generateTestToken(testUser);

    // Analytics routes use JWT authentication, not API key authentication
    authenticatedRequest = createAuthenticatedRequest(server, authToken);

    // Create admin user
    adminUser = await TestHelpers.createTestUser({
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'admin',
    });
    adminToken = TestHelpers.generateTestToken(adminUser);

    // Create API key for admin operations
    const adminApiKeyResponse = await server
      .request()
      .post('/api/v1/keys')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Admin Analytics API Key',
        environment: 'test',
        permissions: ['search', 'analytics'],
        rateLimitTier: 'free',
      })
      .expect(201);

    const adminApiKey = adminApiKeyResponse.body.data.secretKey;
    adminRequest = createAuthenticatedRequest(server, adminApiKey);

    testConnection = await TestHelpers.createTestDatabaseConnection(testUser.id, {
      name: 'Test Analytics Database',
    });

    // Insert sample analytics data
    await setupAnalyticsTestData();
  });

  const setupAnalyticsTestData = async () => {
    // Insert search history for analytics testing
    const searches = [
      {
        id: 'search-1',
        query: 'database tutorial',
        mode: 'natural',
        resultCount: 15,
        execTime: 120,
      },
      { id: 'search-2', query: 'MySQL performance', mode: 'boolean', resultCount: 8, execTime: 95 },
      {
        id: 'search-3',
        query: 'full-text search',
        mode: 'natural',
        resultCount: 22,
        execTime: 145,
      },
      {
        id: 'search-4',
        query: 'database optimization',
        mode: 'semantic',
        resultCount: 12,
        execTime: 180,
      },
      { id: 'search-5', query: 'SQL queries', mode: 'natural', resultCount: 31, execTime: 78 },
    ];

    for (const search of searches) {
      await testDatabase.query(
        `INSERT INTO search_analytics (id, user_id, query_text, search_mode, database_id, result_count, execution_time_ms, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW() - INTERVAL FLOOR(RAND() * 30) DAY)`,
        [
          search.id,
          testUser.id,
          search.query,
          search.mode,
          testConnection.id,
          search.resultCount,
          search.execTime,
        ]
      );
    }

    // Insert analytics events
    const events = [
      { id: 'event-1', type: 'search_executed', data: { query: 'database', results: 15 } },
      { id: 'event-2', type: 'database_connected', data: { connectionId: testConnection.id } },
      { id: 'event-3', type: 'user_login', data: { timestamp: new Date() } },
    ];

    for (const event of events) {
      await testDatabase.query(
        `INSERT INTO analytics (id, userId, eventType, eventData, createdAt)
         VALUES (?, ?, ?, ?, NOW() - INTERVAL FLOOR(RAND() * 30) DAY)`,
        [event.id, testUser.id, event.type, JSON.stringify(event.data)]
      );
    }
  };

  describe('GET /api/v1/analytics/search-trends', () => {
    it('should get search trends with default time range', async () => {
      const response = await authenticatedRequest
        .get('/api/v1/analytics/search-trends')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      const trend = response.body.data[0];
      expect(trend).toHaveProperty('period');
      expect(trend).toHaveProperty('queryVolume');
      expect(trend).toHaveProperty('avgResponseTime');
      expect(trend).toHaveProperty('topQueries');
      expect(trend).toHaveProperty('popularCategories');
      expect(typeof trend.queryVolume).toBe('number');
      expect(typeof trend.avgResponseTime).toBe('number');
    });

    it('should filter trends by date range', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      const endDate = new Date();

      const response = await authenticatedRequest
        .get('/api/v1/analytics/search-trends')
        .query({
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should accept different time periods', async () => {
      const periods = ['day', 'week', 'month', '3months', '6months', 'year'];

      for (const period of periods) {
        const response = await authenticatedRequest
          .get('/api/v1/analytics/search-trends')
          .query({ period })
          .expect(200);

        expect(response.body.success).toBe(true);
      }
    });

    it('should validate date format', async () => {
      const response = await authenticatedRequest
        .get('/api/v1/analytics/search-trends')
        .query({
          startDate: 'invalid-date-format',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Invalid date format');
    });

    it('should require authentication', async () => {
      const response = await server.request().get('/api/v1/analytics/search-trends').expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NO_TOKEN');
    });
  });

  describe('GET /api/v1/analytics/performance', () => {
    it('should get performance metrics successfully', async () => {
      const response = await authenticatedRequest.get('/api/v1/analytics/performance').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('averageQueryTime');
      expect(response.body.data).toHaveProperty('slowestQueries');
      expect(response.body.data).toHaveProperty('fastestQueries');
      expect(response.body.data).toHaveProperty('queryTimeDistribution');
      expect(response.body.data).toHaveProperty('performanceByDatabase');
    });

    it('should handle empty performance data', async () => {
      const emptyUser = await TestHelpers.createTestUser({
        email: 'empty@example.com',
      });
      const emptyToken = TestHelpers.generateTestToken(emptyUser);
      const emptyRequest = createAuthenticatedRequest(server, emptyToken);

      const response = await emptyRequest.get('/api/v1/analytics/performance').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.averageQueryTime).toBe(0);
    });
  });

  describe('GET /api/v1/analytics/popular-queries', () => {
    it('should get popular queries successfully', async () => {
      const response = await authenticatedRequest
        .get('/api/v1/analytics/popular-queries')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('queries');
      expect(Array.isArray(response.body.data.queries)).toBe(true);

      if (response.body.data.queries.length > 0) {
        const query = response.body.data.queries[0];
        expect(query).toHaveProperty('query');
        expect(query).toHaveProperty('count');
        expect(query).toHaveProperty('averageResults');
        expect(query).toHaveProperty('averageTime');
      }
    });

    it('should limit results appropriately', async () => {
      const response = await authenticatedRequest
        .get('/api/v1/analytics/popular-queries')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.queries.length).toBeLessThanOrEqual(50); // Default limit
    });
  });

  describe('GET /api/v1/analytics/search-history', () => {
    it('should get detailed search history with pagination', async () => {
      const response = await authenticatedRequest
        .get('/api/v1/analytics/search-history')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('searches');
      expect(response.body.data).toHaveProperty('totalCount');
      expect(response.body.data).toHaveProperty('hasMore');
      expect(Array.isArray(response.body.data.searches)).toBe(true);
    });

    it('should handle pagination parameters', async () => {
      const response = await authenticatedRequest
        .get('/api/v1/analytics/search-history')
        .query({ limit: 3, offset: 1 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.searches.length).toBeLessThanOrEqual(3);
    });

    it('should filter by date range', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);

      const response = await authenticatedRequest
        .get('/api/v1/analytics/search-history')
        .query({
          startDate: startDate.toISOString().split('T')[0],
          limit: 10,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should validate limit bounds', async () => {
      const response = await authenticatedRequest
        .get('/api/v1/analytics/search-history')
        .query({ limit: 1001 }) // Exceeds maximum
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/analytics/insights', () => {
    it('should get AI-powered insights successfully', async () => {
      const response = await authenticatedRequest.get('/api/v1/analytics/insights').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('performanceInsights');
      expect(response.body.data).toHaveProperty('usagePatterns');
      expect(response.body.data).toHaveProperty('recommendations');
      expect(response.body.data).toHaveProperty('trendsAnalysis');
    });

    it('should handle different time periods for insights', async () => {
      const response = await authenticatedRequest
        .get('/api/v1/analytics/insights')
        .query({ period: 'month' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should provide meaningful insights when data is available', async () => {
      const response = await authenticatedRequest.get('/api/v1/analytics/insights').expect(200);

      expect(response.body.success).toBe(true);

      if (response.body.data.recommendations.length > 0) {
        const recommendation = response.body.data.recommendations[0];
        expect(recommendation).toHaveProperty('type');
        expect(recommendation).toHaveProperty('message');
        expect(recommendation).toHaveProperty('priority');
      }
    });
  });

  describe('GET /api/v1/analytics/dashboard', () => {
    it('should get comprehensive dashboard data', async () => {
      const response = await authenticatedRequest.get('/api/v1/analytics/dashboard').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('overview');
      expect(response.body.data).toHaveProperty('recentActivity');
      expect(response.body.data).toHaveProperty('topQueries');
      expect(response.body.data).toHaveProperty('performanceMetrics');
      expect(response.body.data).toHaveProperty('connectedDatabases');

      // Verify overview structure
      expect(response.body.data.overview).toHaveProperty('totalSearches');
      expect(response.body.data.overview).toHaveProperty('avgResponseTime');
      expect(response.body.data.overview).toHaveProperty('totalConnections');
    });

    it('should include time-filtered dashboard data', async () => {
      const response = await authenticatedRequest
        .get('/api/v1/analytics/dashboard')
        .query({ period: 'week' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('overview');
    });
  });

  describe('Admin Analytics Endpoints', () => {
    describe('GET /api/v1/analytics/admin/system-overview', () => {
      it('should get system-wide analytics for admin users', async () => {
        const response = await adminRequest
          .get('/api/v1/analytics/admin/system-overview')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('totalUsers');
        expect(response.body.data).toHaveProperty('totalSearches');
        expect(response.body.data).toHaveProperty('systemPerformance');
        expect(response.body.data).toHaveProperty('databaseConnections');
        expect(response.body.data).toHaveProperty('popularQueries');
      });

      it('should deny access to regular users', async () => {
        const response = await authenticatedRequest
          .get('/api/v1/analytics/admin/system-overview')
          .expect(403);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
      });

      it('should filter by time period', async () => {
        const response = await adminRequest
          .get('/api/v1/analytics/admin/system-overview')
          .query({ period: 'month' })
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });

    describe('GET /api/v1/analytics/admin/user-activity', () => {
      it('should get user activity analytics for admin users', async () => {
        const response = await adminRequest
          .get('/api/v1/analytics/admin/user-activity')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('activeUsers');
        expect(response.body.data).toHaveProperty('userRegistrations');
        expect(response.body.data).toHaveProperty('userEngagement');
        expect(response.body.data).toHaveProperty('topUsers');
        expect(Array.isArray(response.body.data.activeUsers)).toBe(true);
      });

      it('should deny access to regular users', async () => {
        const response = await authenticatedRequest
          .get('/api/v1/analytics/admin/user-activity')
          .expect(403);

        expect(response.body.success).toBe(false);
      });

      it('should handle pagination for user activity', async () => {
        const response = await adminRequest
          .get('/api/v1/analytics/admin/user-activity')
          .query({ limit: 5, offset: 0 })
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });

    describe('GET /api/v1/analytics/admin/performance-metrics', () => {
      it('should get system performance metrics for admin users', async () => {
        const response = await adminRequest
          .get('/api/v1/analytics/admin/performance-metrics')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('systemLoad');
        expect(response.body.data).toHaveProperty('responseTimeTrends');
        expect(response.body.data).toHaveProperty('errorRates');
        expect(response.body.data).toHaveProperty('resourceUtilization');
      });

      it('should deny access to regular users', async () => {
        const response = await authenticatedRequest
          .get('/api/v1/analytics/admin/performance-metrics')
          .expect(403);

        expect(response.body.success).toBe(false);
      });

      it('should provide historical performance data', async () => {
        const response = await adminRequest
          .get('/api/v1/analytics/admin/performance-metrics')
          .query({ period: '3months' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('responseTimeTrends');
      });
    });
  });

  describe('Analytics Security', () => {
    it('should not expose sensitive user data in analytics', async () => {
      const response = await authenticatedRequest
        .get('/api/v1/analytics/search-trends')
        .expect(200);

      expect(response.body.success).toBe(true);

      // Ensure no sensitive data is exposed
      const dataString = JSON.stringify(response.body.data);
      expect(dataString).not.toContain('password');
      expect(dataString).not.toContain('hash');
      expect(dataString).not.toContain('secret');
    });

    it('should properly isolate user analytics data', async () => {
      // Create another user with different search history
      const otherUser = await TestHelpers.createTestUser({
        email: 'other@example.com',
      });

      // Add search data for other user
      await testDatabase.query(
        `INSERT INTO searches (id, userId, query, searchMode, databases, resultCount, executionTime)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['other-search', otherUser.id, 'other user query', 'natural', '[]', 5, 100]
      );

      // Current user should not see other user's data
      const response = await authenticatedRequest
        .get('/api/v1/analytics/search-trends')
        .expect(200);

      expect(response.body.success).toBe(true);
      // The response should not contain data from the other user
      const dataString = JSON.stringify(response.body.data);
      expect(dataString).not.toContain('other user query');
    });
  });

  describe('Analytics Performance', () => {
    it('should respond to analytics requests within acceptable time', async () => {
      const startTime = Date.now();

      const response = await authenticatedRequest.get('/api/v1/analytics/dashboard').expect(200);

      const responseTime = Date.now() - startTime;

      expect(response.body.success).toBe(true);
      expect(responseTime).toBeLessThan(3000); // Should respond within 3 seconds
    });

    it('should handle concurrent analytics requests', async () => {
      const requests = [
        authenticatedRequest.get('/api/v1/analytics/search-trends'),
        authenticatedRequest.get('/api/v1/analytics/performance'),
        authenticatedRequest.get('/api/v1/analytics/popular-queries'),
      ];

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });
});
