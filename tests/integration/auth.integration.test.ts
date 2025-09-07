/**
 * Authentication Integration Tests
 *
 * Tests all authentication endpoints including registration, login, profile management,
 * password changes, and token refresh functionality.
 */

import type { User } from '@/types';
import { testDatabase } from '../test-database';
import { TestHelpers } from '../utils/test-helpers';
import type { TestServer } from './test-server';
import { setupTestEnvironment, teardownTestEnvironment } from './test-server';

describe('Authentication Integration Tests', () => {
  let server: TestServer;
  let testUser: User & { password: string };
  let authToken: string;

  beforeAll(async () => {
    const { server: testServer } = await setupTestEnvironment();
    server = testServer;
  });

  afterAll(async () => {
    await teardownTestEnvironment();
  });

  beforeEach(async () => {
    await testDatabase.cleanup();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'securepassword123',
        name: 'New User',
        role: 'user',
      };

      const response = await server
        .request()
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.user.name).toBe(userData.name);
      expect(response.body.data.user).not.toHaveProperty('password');
      expect(typeof response.body.data.token).toBe('string');

      // Integration test focuses on API response structure and business logic
      // Database verification is handled by unit tests
    });

    it('should reject registration with invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'securepassword123',
        name: 'Test User',
      };

      const response = await server
        .request()
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error.message).toContain('email');
    });

    it('should reject registration with short password', async () => {
      const userData = {
        email: 'test@example.com',
        password: '123',
        name: 'Test User',
      };

      const response = await server
        .request()
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('8 characters');
    });

    it('should reject duplicate email registration', async () => {
      const userData = {
        email: 'duplicate@example.com',
        password: 'securepassword123',
        name: 'First User',
      };

      // First registration should succeed
      await server.request().post('/api/v1/auth/register').send(userData).expect(201);

      // Second registration with same email should fail
      const response = await server
        .request()
        .post('/api/v1/auth/register')
        .send({
          ...userData,
          name: 'Second User',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('REGISTRATION_FAILED');
    });

    it('should default role to user when not specified', async () => {
      const userData = {
        email: 'defaultrole@example.com',
        password: 'securepassword123',
        name: 'Default Role User',
      };

      const response = await server
        .request()
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.data.user.role).toBe('user');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      testUser = await TestHelpers.createTestUser({
        email: 'login@example.com',
        name: 'Login User',
      });
    });

    it('should login with correct credentials', async () => {
      const loginData = {
        email: testUser.email,
        password: testUser.password,
      };

      const response = await server
        .request()
        .post('/api/v1/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user.email).toBe(testUser.email);
      expect(typeof response.body.data.token).toBe('string');

      authToken = response.body.data.token;
    });

    it('should reject login with incorrect password', async () => {
      const loginData = {
        email: testUser.email,
        password: 'wrongpassword',
      };

      const response = await server
        .request()
        .post('/api/v1/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTHENTICATION_FAILED');
    });

    it('should reject login with non-existent email', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'anypassword',
      };

      const response = await server
        .request()
        .post('/api/v1/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTHENTICATION_FAILED');
    });

    it('should normalize email case during login', async () => {
      const loginData = {
        email: testUser.email.toUpperCase(),
        password: testUser.password,
      };

      const response = await server
        .request()
        .post('/api/v1/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/v1/auth/profile', () => {
    beforeEach(async () => {
      testUser = await TestHelpers.createTestUser();
      authToken = TestHelpers.generateTestToken(testUser);
    });

    it('should get user profile with valid token', async () => {
      const response = await server
        .request()
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testUser.id);
      expect(response.body.data.email).toBe(testUser.email);
      expect(response.body.data.name).toBe(testUser.name);
      expect(response.body.data).not.toHaveProperty('password');
    });

    it('should reject request without token', async () => {
      const response = await server.request().get('/api/v1/auth/profile').expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NO_TOKEN');
    });

    it('should reject request with invalid token', async () => {
      const response = await server
        .request()
        .get('/api/v1/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });
  });

  describe('PUT /api/v1/auth/profile', () => {
    beforeEach(async () => {
      testUser = await TestHelpers.createTestUser();
      authToken = TestHelpers.generateTestToken(testUser);
    });

    it('should update user profile successfully', async () => {
      const updateData = {
        name: 'Updated Name',
        email: 'updated@example.com',
      };

      const response = await server
        .request()
        .put('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(updateData.name);
      expect(response.body.data.email).toBe(updateData.email);
    });

    it('should update only provided fields', async () => {
      const updateData = {
        name: 'Only Name Updated',
      };

      const response = await server
        .request()
        .put('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(updateData.name);
      expect(response.body.data.email).toBe(testUser.email); // Should remain unchanged
    });

    it('should reject invalid email format', async () => {
      const updateData = {
        email: 'invalid-email-format',
      };

      const response = await server
        .request()
        .put('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/change-password', () => {
    beforeEach(async () => {
      testUser = await TestHelpers.createTestUser();
      authToken = TestHelpers.generateTestToken(testUser);
    });

    it('should change password successfully', async () => {
      const passwordData = {
        currentPassword: testUser.password,
        newPassword: 'NewSecurePassword123!',
      };

      const response = await server
        .request()
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send(passwordData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.success).toBe(true);
    });

    it('should reject incorrect current password', async () => {
      const passwordData = {
        currentPassword: 'wrongcurrentpassword',
        newPassword: 'NewSecurePassword123!',
      };

      const response = await server
        .request()
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send(passwordData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PASSWORD_CHANGE_FAILED');
    });

    it('should reject weak new password', async () => {
      const passwordData = {
        currentPassword: testUser.password,
        newPassword: '123',
      };

      const response = await server
        .request()
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send(passwordData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('8 characters');
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    beforeEach(async () => {
      testUser = await TestHelpers.createTestUser();
      authToken = TestHelpers.generateTestToken(testUser);
    });

    it('should refresh token successfully', async () => {
      const response = await server
        .request()
        .post('/api/v1/auth/refresh')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.token).not.toBe(authToken); // Should be a new token
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    beforeEach(async () => {
      testUser = await TestHelpers.createTestUser();
      authToken = TestHelpers.generateTestToken(testUser);
    });

    it('should logout successfully', async () => {
      const response = await server
        .request()
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.success).toBe(true);
    });
  });

  describe('DELETE /api/v1/auth/account', () => {
    beforeEach(async () => {
      testUser = await TestHelpers.createTestUser();
      authToken = TestHelpers.generateTestToken(testUser);
    });

    it('should deactivate account successfully', async () => {
      const response = await server
        .request()
        .delete('/api/v1/auth/account')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.success).toBe(true);

      // Verify user is deactivated in database
      const dbUser = await testDatabase.query('SELECT is_active FROM users WHERE id = ?', [
        testUser.id,
      ]);
      expect(dbUser[0].is_active).toBe(0); // MySQL returns 0 for false
    });
  });
});
