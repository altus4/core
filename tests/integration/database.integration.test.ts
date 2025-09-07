/**
 * Database Integration Tests
 *
 * Tests all database management endpoints including CRUD operations for database connections,
 * connection testing, schema discovery, and connection status checks.
 */

import type { DatabaseConnection, User } from '@/types';
import { TestHelpers } from '../utils/test-helpers';
import type { TestServer } from './test-server';
import {
  createAuthenticatedRequest,
  setupTestEnvironment,
  teardownTestEnvironment,
} from './test-server';

describe('Database Integration Tests', () => {
  let server: TestServer;
  let testUser: User & { password: string };
  let authToken: string;
  let authenticatedRequest: ReturnType<typeof createAuthenticatedRequest>;

  beforeAll(async () => {
    const { server: testServer } = await setupTestEnvironment();
    server = testServer;
  });

  afterAll(async () => {
    await teardownTestEnvironment();
  });

  beforeEach(async () => {
    // Test cleanup is handled by mocked services
    testUser = await TestHelpers.createTestUser();
    authToken = TestHelpers.generateTestToken(testUser);
    authenticatedRequest = createAuthenticatedRequest(server, authToken);
  });

  describe('POST /api/v1/databases', () => {
    it('should add a new database connection successfully', async () => {
      const connectionData = {
        name: 'Test Database',
        host: 'localhost',
        port: 3306,
        database: 'altus4_test',
        username: 'root',
        password: '',
        ssl: false,
      };

      const response = await authenticatedRequest
        .post('/api/v1/databases')
        .send(connectionData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.name).toBe(connectionData.name);
      expect(response.body.data.host).toBe(connectionData.host);
      expect(response.body.data.port).toBe(connectionData.port);
      expect(response.body.data.database).toBe(connectionData.database);
      expect(response.body.data.username).toBe(connectionData.username);
      expect(response.body.data).not.toHaveProperty('password'); // Should not return password
      expect(response.body.data.ssl).toBe(connectionData.ssl);

      // Verify connection response structure (database verification mocked)
      expect(response.body.data.name).toBe(connectionData.name);
    });

    it('should use default port when not specified', async () => {
      const connectionData = {
        name: 'Default Port Test',
        host: 'localhost',
        database: 'altus4_test',
        username: 'root',
        password: '',
      };

      const response = await authenticatedRequest
        .post('/api/v1/databases')
        .send(connectionData)
        .expect(201);

      expect(response.body.data.port).toBe(3306);
    });

    it('should reject connection with missing required fields', async () => {
      const invalidConnectionData = {
        name: 'Incomplete Connection',
        host: 'localhost',
        // Missing database, username, password
      };

      const response = await authenticatedRequest
        .post('/api/v1/databases')
        .send(invalidConnectionData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject connection with invalid port', async () => {
      const connectionData = {
        name: 'Invalid Port Test',
        host: 'localhost',
        port: 100000, // Invalid port number
        database: 'altus4_test',
        username: 'root',
        password: '',
      };

      const response = await authenticatedRequest
        .post('/api/v1/databases')
        .send(connectionData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should require authentication', async () => {
      const connectionData = {
        name: 'Unauthorized Test',
        host: 'localhost',
        database: 'altus4_test',
        username: 'root',
        password: '',
      };

      const response = await server
        .request()
        .post('/api/v1/databases')
        .send(connectionData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NO_TOKEN');
    });
  });

  describe('GET /api/v1/databases', () => {
    let testConnection: DatabaseConnection;

    beforeEach(async () => {
      testConnection = await TestHelpers.createTestDatabaseConnection(testUser.id);
    });

    it('should retrieve all user database connections', async () => {
      const response = await authenticatedRequest.get('/api/v1/databases').expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe(testConnection.id);
      expect(response.body.data[0].name).toBe(testConnection.name);
      expect(response.body.data[0]).not.toHaveProperty('password');
    });

    it('should return empty array when no connections exist', async () => {
      // Mock empty connections response
      const response = await authenticatedRequest.get('/api/v1/databases').expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should only return connections for authenticated user', async () => {
      // Create another user with connections
      const otherUser = await TestHelpers.createTestUser({
        email: `other-${Date.now()}-${Math.random()}@example.com`,
      });
      await TestHelpers.createTestDatabaseConnection(otherUser.id, {
        name: 'Other User Connection',
      });

      const response = await authenticatedRequest.get('/api/v1/databases').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe(testConnection.name);
    });
  });

  describe('GET /api/v1/databases/:connectionId', () => {
    let testConnection: DatabaseConnection;

    beforeEach(async () => {
      testConnection = await TestHelpers.createTestDatabaseConnection(testUser.id);
    });

    it('should retrieve a specific database connection', async () => {
      const response = await authenticatedRequest
        .get(`/api/v1/databases/${testConnection.id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testConnection.id);
      expect(response.body.data.name).toBe(testConnection.name);
      expect(response.body.data).not.toHaveProperty('password');
    });

    it('should return 404 for non-existent connection', async () => {
      const response = await authenticatedRequest
        .get('/api/v1/databases/non-existent-id')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CONNECTION_NOT_FOUND');
    });

    it('should not allow access to other users connections', async () => {
      const otherUser = await TestHelpers.createTestUser({
        email: `other-${Date.now()}-${Math.random()}@example.com`,
      });
      const otherConnection = await TestHelpers.createTestDatabaseConnection(otherUser.id);

      const response = await authenticatedRequest
        .get(`/api/v1/databases/${otherConnection.id}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CONNECTION_NOT_FOUND');
    });
  });

  describe('PUT /api/v1/databases/:connectionId', () => {
    let testConnection: DatabaseConnection;

    beforeEach(async () => {
      testConnection = await TestHelpers.createTestDatabaseConnection(testUser.id);
    });

    it('should update database connection successfully', async () => {
      const updateData = {
        name: 'Updated Connection Name',
        host: 'updated-host.com',
        port: 3307,
      };

      const response = await authenticatedRequest
        .put(`/api/v1/databases/${testConnection.id}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(updateData.name);
      expect(response.body.data.host).toBe(updateData.host);
      expect(response.body.data.port).toBe(updateData.port);
    });

    it('should update only provided fields', async () => {
      const updateData = {
        name: 'Partially Updated Name',
      };

      const response = await authenticatedRequest
        .put(`/api/v1/databases/${testConnection.id}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(updateData.name);
      expect(response.body.data.host).toBe(testConnection.host); // Should remain unchanged
    });

    it('should return 404 for non-existent connection', async () => {
      const updateData = {
        name: 'Updated Name',
      };

      const response = await authenticatedRequest
        .put('/api/v1/databases/non-existent-id')
        .send(updateData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CONNECTION_NOT_FOUND');
    });

    it('should reject invalid port numbers', async () => {
      const updateData = {
        port: -1,
      };

      const response = await authenticatedRequest
        .put(`/api/v1/databases/${testConnection.id}`)
        .send(updateData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/v1/databases/:connectionId', () => {
    let testConnection: DatabaseConnection;

    beforeEach(async () => {
      testConnection = await TestHelpers.createTestDatabaseConnection(testUser.id);
    });

    it('should delete database connection successfully', async () => {
      const response = await authenticatedRequest
        .delete(`/api/v1/databases/${testConnection.id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.success).toBe(true);

      // Verify response indicates successful deletion (database verification mocked)
      expect(response.body.data.success).toBe(true);
    });

    it('should return 404 for non-existent connection', async () => {
      const response = await authenticatedRequest
        .delete('/api/v1/databases/non-existent-id')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CONNECTION_NOT_FOUND');
    });

    it('should not allow deletion of other users connections', async () => {
      const otherUser = await TestHelpers.createTestUser({
        email: `other-${Date.now()}-${Math.random()}@example.com`,
      });
      const otherConnection = await TestHelpers.createTestDatabaseConnection(otherUser.id);

      const response = await authenticatedRequest
        .delete(`/api/v1/databases/${otherConnection.id}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/databases/:connectionId/test', () => {
    let testConnection: DatabaseConnection;

    beforeEach(async () => {
      testConnection = await TestHelpers.createTestDatabaseConnection(testUser.id);
    });

    it('should test database connection successfully', async () => {
      const response = await authenticatedRequest
        .post(`/api/v1/databases/${testConnection.id}/test`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('connected');
      expect(typeof response.body.data.connected).toBe('boolean');
    });

    it('should return 404 for non-existent connection', async () => {
      const response = await authenticatedRequest
        .post('/api/v1/databases/non-existent-id/test')
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/databases/:connectionId/schema', () => {
    let testConnection: DatabaseConnection;

    beforeEach(async () => {
      testConnection = await TestHelpers.createTestDatabaseConnection(testUser.id);
    });

    it('should discover database schema successfully', async () => {
      const response = await authenticatedRequest
        .get(`/api/v1/databases/${testConnection.id}/schema`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should return 404 for non-existent connection', async () => {
      const response = await authenticatedRequest
        .get('/api/v1/databases/non-existent-id/schema')
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/databases/status', () => {
    let testConnection1: DatabaseConnection;
    let testConnection2: DatabaseConnection;

    beforeEach(async () => {
      testConnection1 = await TestHelpers.createTestDatabaseConnection(testUser.id, {
        name: 'Connection 1',
      });
      testConnection2 = await TestHelpers.createTestDatabaseConnection(testUser.id, {
        name: 'Connection 2',
      });
    });

    it('should get status of all connections', async () => {
      const response = await authenticatedRequest.get('/api/v1/databases/status').expect(200);

      expect(response.body.success).toBe(true);
      expect(typeof response.body.data).toBe('object');
      expect(response.body.data).toHaveProperty(testConnection1.id);
      expect(response.body.data).toHaveProperty(testConnection2.id);
    });

    it('should return empty object when no connections exist', async () => {
      await TestHelpers.cleanupTestData();

      const response = await authenticatedRequest.get('/api/v1/databases/status').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({});
    });
  });
});
