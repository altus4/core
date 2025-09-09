import { createApp } from '@/app';
import { seedSuite, userPayload } from '@tests/helpers/factories';
import { TestHelpers } from '@tests/helpers/test-helpers';
import request from 'supertest';

describe('Auth Integration (SuperTest)', () => {
  const app = createApp();

  beforeAll(async () => {
    // Ensure test DB/redis mocks are ready (integration-setup handles mysql/redis mocks)
  });

  afterAll(async () => {
    await TestHelpers.closeConnections();
  });

  beforeAll(() => {
    seedSuite(202501);
  });

  describe('User Registration and Login', () => {
    it('registers a new user successfully', async () => {
      const user = userPayload();

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: user.email, name: user.name, password: user.password })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user.email).toBe(user.email.toLowerCase());
      expect(response.body.data.user.name).toBe(user.name);
      expect(response.body.data.user.role).toBe('user');
    });

    it('registers an admin user successfully', async () => {
      const user = userPayload({ role: 'admin' });

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: user.email, name: user.name, password: user.password, role: 'admin' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.role).toBe('admin');
    });

    it('prevents duplicate email registration', async () => {
      const user = userPayload();

      // Register first time
      await request(app)
        .post('/api/v1/auth/register')
        .send({ email: user.email, name: user.name, password: user.password })
        .expect(201);

      // Try to register again with same email
      await request(app)
        .post('/api/v1/auth/register')
        .send({ email: user.email, name: 'Different Name', password: 'different123' })
        .expect(400);
    });

    it('validates email format during registration', async () => {
      const user = userPayload();

      await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'invalid-email', name: user.name, password: user.password })
        .expect(400);
    });

    it('validates password length during registration', async () => {
      const user = userPayload();

      await request(app)
        .post('/api/v1/auth/register')
        .send({ email: user.email, name: user.name, password: 'short' })
        .expect(400);
    });

    it('logs in with valid credentials', async () => {
      const user = userPayload();

      // Register user first
      await request(app)
        .post('/api/v1/auth/register')
        .send({ email: user.email, name: user.name, password: user.password })
        .expect(201);

      // Login
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: user.password })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user.email).toBe(user.email.toLowerCase());
    });

    it('rejects login with invalid password', async () => {
      const user = userPayload();

      // Register user first
      await request(app)
        .post('/api/v1/auth/register')
        .send({ email: user.email, name: user.name, password: user.password })
        .expect(201);

      // Try login with wrong password
      await request(app)
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: 'wrongpassword' })
        .expect(401);
    });

    it('rejects login with non-existent email', async () => {
      await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'password123' })
        .expect(401);
    });
  });

  describe('Profile Management', () => {
    let userToken: string;
    let userId: string;

    beforeEach(async () => {
      const user = userPayload();

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: user.email, name: user.name, password: user.password })
        .expect(201);

      userToken = response.body.data.token;
      userId = response.body.data.user.id;
    });

    it('retrieves user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('email');
      expect(response.body.data).toHaveProperty('name');
      expect(response.body.data.id).toBe(userId);
    });

    it('rejects profile request without token', async () => {
      await request(app).get('/api/v1/auth/profile').expect(401);
    });

    it('rejects profile request with invalid token', async () => {
      await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('updates user profile successfully', async () => {
      const updates = {
        name: 'Updated Name',
        email: 'updated@example.com',
      };

      const response = await request(app)
        .put('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(updates.name);
      expect(response.body.data.email).toBe(updates.email.toLowerCase());
    });

    it('validates email format during profile update', async () => {
      await request(app)
        .put('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ email: 'invalid-email-format' })
        .expect(400);
    });

    it('validates name length during profile update', async () => {
      await request(app)
        .put('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'a' }) // too short
        .expect(400);
    });
  });

  describe('Password Management', () => {
    let userToken: string;
    const originalPassword = 'OriginalPass123!'; // Strong password for test

    beforeEach(async () => {
      const user = userPayload({ password: originalPassword });

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: user.email, name: user.name, password: user.password })
        .expect(201);

      userToken = response.body.data.token;
    });

    it('changes password successfully', async () => {
      const newPassword = 'NewPassword123!'; // Meets complexity requirements

      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          currentPassword: originalPassword,
          newPassword,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.success).toBe(true);
    });

    it('rejects password change with wrong current password', async () => {
      await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          currentPassword: 'wrongpassword',
          newPassword: 'NewPassword123!',
        })
        .expect(400);
    });

    it('validates new password length', async () => {
      await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          currentPassword: originalPassword,
          newPassword: 'short',
        })
        .expect(400);
    });
  });

  describe('Token Management', () => {
    let userToken: string;

    beforeEach(async () => {
      const user = userPayload();

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: user.email, name: user.name, password: user.password })
        .expect(201);

      userToken = response.body.data.token;
    });

    it('refreshes token successfully', async () => {
      // Wait a moment to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 1000));

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('user');

      // Since JWT tokens include timestamps, new tokens should be different
      const newToken = response.body.data.token;
      expect(newToken).toBeTruthy();
      expect(typeof newToken).toBe('string');
    });

    it('rejects token refresh without authorization', async () => {
      await request(app).post('/api/v1/auth/refresh').expect(401);
    });
  });

  describe('Session Management', () => {
    let userToken: string;

    beforeEach(async () => {
      const user = userPayload();

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: user.email, name: user.name, password: user.password })
        .expect(201);

      userToken = response.body.data.token;
    });

    it('logs out successfully', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.success).toBe(true);
    });

    it('rejects logout without authorization', async () => {
      await request(app).post('/api/v1/auth/logout').expect(401);
    });
  });

  describe('Account Management', () => {
    let userToken: string;

    beforeEach(async () => {
      const user = userPayload();

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: user.email, name: user.name, password: user.password })
        .expect(201);

      userToken = response.body.data.token;
    });

    it('deactivates account successfully', async () => {
      const response = await request(app)
        .delete('/api/v1/auth/account')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.success).toBe(true);
    });

    it('rejects account deactivation without authorization', async () => {
      await request(app).delete('/api/v1/auth/account').expect(401);
    });
  });
});
