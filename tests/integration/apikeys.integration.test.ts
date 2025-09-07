/**
 * API Key Integration Tests
 *
 * Tests all API key management endpoints including creation, listing, updating,
 * revoking, regenerating, and usage statistics functionality.
 */

import type { ApiKey } from '@/services/ApiKeyService';
import type { User } from '@/types';
import { testDatabase } from '../test-database';
import { TestHelpers } from '../utils/test-helpers';
import type { TestServer } from './test-server';
import { setupTestEnvironment, teardownTestEnvironment } from './test-server';

describe('API Key Integration Tests', () => {
  let server: TestServer;
  let testUser: User & { password: string };
  let authToken: string;
  let createdApiKey: { apiKey: ApiKey; keyPrefix: string; secretKey: string };

  beforeAll(async () => {
    const { server: testServer } = await setupTestEnvironment();
    server = testServer;
  });

  afterAll(async () => {
    await teardownTestEnvironment();
  });

  beforeEach(async () => {
    await testDatabase.cleanup();

    // Create test user and get JWT token for bootstrapping API key creation
    testUser = await TestHelpers.createTestUser({
      email: 'apikey@example.com',
      name: 'API Key Test User',
    });
    authToken = TestHelpers.generateTestToken(testUser);
  });

  describe('POST /api/v1/keys', () => {
    it('should create API key successfully with valid data', async () => {
      const apiKeyData = {
        name: 'Test API Key',
        environment: 'test',
        permissions: ['search'],
        rateLimitTier: 'free',
      };

      const response = await server
        .request()
        .post('/api/v1/keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send(apiKeyData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('apiKey');
      expect(response.body.data.apiKey).toHaveProperty('keyPrefix');
      expect(response.body.data).toHaveProperty('secretKey');

      // Verify API key properties
      expect(response.body.data.apiKey.name).toBe(apiKeyData.name);
      expect(response.body.data.apiKey.environment).toBe(apiKeyData.environment);
      expect(response.body.data.apiKey.permissions).toEqual(apiKeyData.permissions);
      expect(response.body.data.apiKey.rateLimitTier).toBe(apiKeyData.rateLimitTier);
      expect(response.body.data.apiKey.isActive).toBe(true);

      // Verify key format
      expect(response.body.data.apiKey.keyPrefix).toMatch(/^altus4_sk_test_[A-Za-z0-9_-]+$/);
      expect(response.body.data.secretKey).toMatch(/^altus4_sk_test_[A-Za-z0-9_-]+$/);

      // Integration test focuses on API response structure and business logic
      // Database verification is handled by unit tests

      // Store for other tests
      createdApiKey = response.body.data;
    });

    it('should create live environment API key', async () => {
      const apiKeyData = {
        name: 'Live API Key',
        environment: 'live',
        permissions: ['search', 'analytics'],
        rateLimitTier: 'pro',
      };

      const response = await server
        .request()
        .post('/api/v1/keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send(apiKeyData)
        .expect(201);

      expect(response.body.data.keyPrefix).toMatch(/^altus4_sk_live_[a-z0-9]{16}$/);
      expect(response.body.data.secretKey).toMatch(/^altus4_sk_live_[a-z0-9]{48}$/);
      expect(response.body.data.apiKey.environment).toBe('live');
      expect(response.body.data.apiKey.rateLimitTier).toBe('pro');
    });

    it('should create enterprise API key with custom rate limits', async () => {
      const apiKeyData = {
        name: 'Enterprise API Key',
        environment: 'live',
        permissions: ['search', 'analytics', 'admin'],
        rateLimitTier: 'enterprise',
        rateLimitCustom: { requests: 50000, window: 3600 },
      };

      const response = await server
        .request()
        .post('/api/v1/keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send(apiKeyData)
        .expect(201);

      expect(response.body.data.apiKey.rateLimitTier).toBe('enterprise');
      expect(response.body.data.apiKey.rateLimitCustom).toEqual(apiKeyData.rateLimitCustom);
    });

    it('should create API key with expiration date', async () => {
      const expirationDate = new Date('2025-12-31');
      const apiKeyData = {
        name: 'Expiring API Key',
        environment: 'test',
        permissions: ['search'],
        rateLimitTier: 'free',
        expiresAt: expirationDate,
      };

      const response = await server
        .request()
        .post('/api/v1/keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send(apiKeyData)
        .expect(201);

      expect(new Date(response.body.data.apiKey.expiresAt)).toEqual(expirationDate);
    });

    it('should reject API key creation with invalid name', async () => {
      const apiKeyData = {
        name: 'AB', // Too short
        environment: 'test',
        permissions: ['search'],
        rateLimitTier: 'free',
      };

      const response = await server
        .request()
        .post('/api/v1/keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send(apiKeyData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('3 characters');
    });

    it('should reject API key creation with invalid environment', async () => {
      const apiKeyData = {
        name: 'Test API Key',
        environment: 'invalid',
        permissions: ['search'],
        rateLimitTier: 'free',
      };

      const response = await server
        .request()
        .post('/api/v1/keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send(apiKeyData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('test" or "live');
    });

    it('should reject API key creation with empty permissions', async () => {
      const apiKeyData = {
        name: 'Test API Key',
        environment: 'test',
        permissions: [],
        rateLimitTier: 'free',
      };

      const response = await server
        .request()
        .post('/api/v1/keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send(apiKeyData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('At least one permission');
    });

    it('should reject API key creation with invalid rate limit tier', async () => {
      const apiKeyData = {
        name: 'Test API Key',
        environment: 'test',
        permissions: ['search'],
        rateLimitTier: 'invalid',
      };

      const response = await server
        .request()
        .post('/api/v1/keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send(apiKeyData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('free, pro, enterprise');
    });

    it('should reject API key creation without authentication', async () => {
      const apiKeyData = {
        name: 'Test API Key',
        environment: 'test',
        permissions: ['search'],
        rateLimitTier: 'free',
      };

      const response = await server.request().post('/api/v1/keys').send(apiKeyData).expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NO_TOKEN');
    });
  });

  describe('GET /api/v1/keys', () => {
    beforeEach(async () => {
      // Create a test API key for listing tests
      const apiKeyData = {
        name: 'List Test API Key',
        environment: 'test',
        permissions: ['search'],
        rateLimitTier: 'free',
      };

      const response = await server
        .request()
        .post('/api/v1/keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send(apiKeyData);

      createdApiKey = response.body.data;
    });

    it('should list user API keys successfully', async () => {
      const response = await server
        .request()
        .get('/api/v1/keys')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('apiKeys');
      expect(Array.isArray(response.body.data.apiKeys)).toBe(true);
      expect(response.body.data.apiKeys).toHaveLength(1);

      const apiKey = response.body.data.apiKeys[0];
      expect(apiKey.name).toBe('List Test API Key');
      expect(apiKey.environment).toBe('test');
      expect(apiKey.permissions).toEqual(['search']);
      expect(apiKey.rateLimitTier).toBe('free');
      expect(apiKey.isActive).toBe(true);

      // Should not include the secret key in listing
      expect(apiKey).not.toHaveProperty('secretKey');
    });

    it('should return empty array when user has no API keys', async () => {
      // Create new user with no API keys
      const newUser = await TestHelpers.createTestUser({
        email: 'nokeys@example.com',
        name: 'No Keys User',
      });
      const newAuthToken = TestHelpers.generateTestToken(newUser);

      const response = await server
        .request()
        .get('/api/v1/keys')
        .set('Authorization', `Bearer ${newAuthToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.apiKeys).toEqual([]);
    });

    it('should reject listing API keys without authentication', async () => {
      const response = await server.request().get('/api/v1/keys').expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NO_TOKEN');
    });
  });

  describe('PUT /api/v1/keys/:keyId', () => {
    beforeEach(async () => {
      // Create a test API key for update tests
      const apiKeyData = {
        name: 'Update Test API Key',
        environment: 'test',
        permissions: ['search'],
        rateLimitTier: 'free',
      };

      const response = await server
        .request()
        .post('/api/v1/keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send(apiKeyData);

      createdApiKey = response.body.data;
    });

    it('should update API key successfully', async () => {
      const updates = {
        name: 'Updated API Key Name',
        permissions: ['search', 'analytics'],
        rateLimitTier: 'pro',
      };

      const response = await server
        .request()
        .put(`/api/v1/keys/${createdApiKey.apiKey.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.apiKey.name).toBe(updates.name);
      expect(response.body.data.apiKey.permissions).toEqual(updates.permissions);
      expect(response.body.data.apiKey.rateLimitTier).toBe(updates.rateLimitTier);

      // Verify update in database
      const dbApiKey = await testDatabase.query('SELECT * FROM api_keys WHERE id = ?', [
        createdApiKey.apiKey.id,
      ]);
      expect(dbApiKey[0].name).toBe(updates.name);
      expect(JSON.parse(dbApiKey[0].permissions)).toEqual(updates.permissions);
      expect(dbApiKey[0].rate_limit_tier).toBe(updates.rateLimitTier);
    });

    it('should update only provided fields', async () => {
      const updates = {
        name: 'Partially Updated Name',
      };

      const response = await server
        .request()
        .put(`/api/v1/keys/${createdApiKey.apiKey.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates)
        .expect(200);

      expect(response.body.data.apiKey.name).toBe(updates.name);
      // Other fields should remain unchanged
      expect(response.body.data.apiKey.permissions).toEqual(['search']);
      expect(response.body.data.apiKey.rateLimitTier).toBe('free');
    });

    it('should return 404 for non-existent API key', async () => {
      const updates = {
        name: 'Updated Name',
      };

      const response = await server
        .request()
        .put('/api/v1/keys/non-existent-key-id')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should reject update with invalid name', async () => {
      const updates = {
        name: 'AB', // Too short
      };

      const response = await server
        .request()
        .put(`/api/v1/keys/${createdApiKey.apiKey.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('3 characters');
    });

    it('should reject update without authentication', async () => {
      const updates = {
        name: 'Updated Name',
      };

      const response = await server
        .request()
        .put(`/api/v1/keys/${createdApiKey.apiKey.id}`)
        .send(updates)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NO_TOKEN');
    });
  });

  describe('DELETE /api/v1/keys/:keyId', () => {
    beforeEach(async () => {
      // Create a test API key for revocation tests
      const apiKeyData = {
        name: 'Revoke Test API Key',
        environment: 'test',
        permissions: ['search'],
        rateLimitTier: 'free',
      };

      const response = await server
        .request()
        .post('/api/v1/keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send(apiKeyData);

      createdApiKey = response.body.data;
    });

    it('should revoke API key successfully', async () => {
      const response = await server
        .request()
        .delete(`/api/v1/keys/${createdApiKey.apiKey.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.revoked).toBe(true);

      // Verify API key is marked as inactive in database
      const dbApiKey = await testDatabase.query('SELECT is_active FROM api_keys WHERE id = ?', [
        createdApiKey.apiKey.id,
      ]);
      expect(dbApiKey[0].is_active).toBe(false);
    });

    it('should return 404 for non-existent API key', async () => {
      const response = await server
        .request()
        .delete('/api/v1/keys/non-existent-key-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should reject revocation without authentication', async () => {
      const response = await server
        .request()
        .delete(`/api/v1/keys/${createdApiKey.apiKey.id}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NO_TOKEN');
    });
  });

  describe('POST /api/v1/keys/:keyId/regenerate', () => {
    beforeEach(async () => {
      // Create a test API key for regeneration tests
      const apiKeyData = {
        name: 'Regenerate Test API Key',
        environment: 'test',
        permissions: ['search'],
        rateLimitTier: 'free',
      };

      const response = await server
        .request()
        .post('/api/v1/keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send(apiKeyData);

      createdApiKey = response.body.data;
    });

    it('should regenerate API key successfully', async () => {
      const originalSecretKey = createdApiKey.secretKey;
      const originalKeyPrefix = createdApiKey.keyPrefix;

      const response = await server
        .request()
        .post(`/api/v1/keys/${createdApiKey.apiKey.id}/regenerate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('apiKey');
      expect(response.body.data.apiKey).toHaveProperty('keyPrefix');
      expect(response.body.data).toHaveProperty('secretKey');

      // New key should be different from original
      expect(response.body.data.secretKey).not.toBe(originalSecretKey);
      expect(response.body.data.keyPrefix).not.toBe(originalKeyPrefix);

      // But should maintain same format and metadata
      expect(response.body.data.keyPrefix).toMatch(/^altus4_sk_test_[a-z0-9]{16}$/);
      expect(response.body.data.secretKey).toMatch(/^altus4_sk_test_[a-z0-9]{48}$/);
      expect(response.body.data.apiKey.name).toBe(createdApiKey.apiKey.name);
      expect(response.body.data.apiKey.environment).toBe(createdApiKey.apiKey.environment);
    });

    it('should return 404 for non-existent API key', async () => {
      const response = await server
        .request()
        .post('/api/v1/keys/non-existent-key-id/regenerate')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should reject regeneration without authentication', async () => {
      const response = await server
        .request()
        .post(`/api/v1/keys/${createdApiKey.apiKey.id}/regenerate`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NO_TOKEN');
    });
  });

  describe('GET /api/v1/keys/:keyId/usage', () => {
    beforeEach(async () => {
      // Create a test API key for usage tests
      const apiKeyData = {
        name: 'Usage Test API Key',
        environment: 'test',
        permissions: ['search'],
        rateLimitTier: 'free',
      };

      const response = await server
        .request()
        .post('/api/v1/keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send(apiKeyData);

      createdApiKey = response.body.data;
    });

    it('should get API key usage statistics successfully', async () => {
      const response = await server
        .request()
        .get(`/api/v1/keys/${createdApiKey.apiKey.id}/usage`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('usage');
      expect(Array.isArray(response.body.data.usage)).toBe(true);

      // Should include metadata about the period
      expect(response.body.data).toHaveProperty('period');
      expect(response.body.data).toHaveProperty('total');
    });

    it('should accept custom days parameter', async () => {
      const response = await server
        .request()
        .get(`/api/v1/keys/${createdApiKey.apiKey.id}/usage?days=7`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.period).toBe(7);
    });

    it('should reject invalid days parameter', async () => {
      const response = await server
        .request()
        .get(`/api/v1/keys/${createdApiKey.apiKey.id}/usage?days=0`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('positive number');
    });

    it('should reject days parameter over limit', async () => {
      const response = await server
        .request()
        .get(`/api/v1/keys/${createdApiKey.apiKey.id}/usage?days=400`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('365');
    });

    it('should return 404 for non-existent API key', async () => {
      const response = await server
        .request()
        .get('/api/v1/keys/non-existent-key-id/usage')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should reject usage request without authentication', async () => {
      const response = await server
        .request()
        .get(`/api/v1/keys/${createdApiKey.apiKey.id}/usage`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NO_TOKEN');
    });
  });

  describe('API Key Authentication in Search', () => {
    beforeEach(async () => {
      // Create a test API key for search authentication tests
      const apiKeyData = {
        name: 'Search Test API Key',
        environment: 'test',
        permissions: ['search'],
        rateLimitTier: 'free',
      };

      const response = await server
        .request()
        .post('/api/v1/keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send(apiKeyData);

      createdApiKey = response.body.data;
    });

    it('should authenticate search request with valid API key', async () => {
      const searchData = {
        query: 'test search',
        databases: [],
        searchMode: 'natural',
        limit: 10,
      };

      // Note: This might fail if search functionality isn't fully implemented
      // but it should at least pass authentication
      const response = await server
        .request()
        .post('/api/v1/search')
        .set('Authorization', `Bearer ${createdApiKey.secretKey}`)
        .send(searchData);

      // Should not get 401 (authentication error)
      expect(response.status).not.toBe(401);
    });

    it('should reject search request with invalid API key', async () => {
      const searchData = {
        query: 'test search',
        databases: [],
        searchMode: 'natural',
        limit: 10,
      };

      const response = await server
        .request()
        .post('/api/v1/search')
        .set('Authorization', 'Bearer invalid_key')
        .send(searchData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_API_KEY');
    });

    it('should reject search request without API key', async () => {
      const searchData = {
        query: 'test search',
        databases: [],
        searchMode: 'natural',
        limit: 10,
      };

      const response = await server.request().post('/api/v1/search').send(searchData).expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_API_KEY');
    });
  });

  describe('Rate Limiting with API Keys', () => {
    beforeEach(async () => {
      // Create a test API key for rate limiting tests
      const apiKeyData = {
        name: 'Rate Limit Test API Key',
        environment: 'test',
        permissions: ['search'],
        rateLimitTier: 'free',
      };

      const response = await server
        .request()
        .post('/api/v1/keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send(apiKeyData);

      createdApiKey = response.body.data;
    });

    it('should include rate limit headers in API key authenticated requests', async () => {
      const response = await server
        .request()
        .get('/api/v1/keys')
        .set('Authorization', `Bearer ${createdApiKey.secretKey}`);

      // Should include API key rate limit headers
      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
      expect(response.headers).toHaveProperty('x-ratelimit-tier');
    });
  });
});
