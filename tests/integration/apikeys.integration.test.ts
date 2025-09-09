import { createApp } from '@/app';
import { apiKeyPayload, seedSuite, userPayload } from '@tests/helpers/factories';
import request from 'supertest';

describe('API Keys Integration (SuperTest)', () => {
  const app = createApp();

  beforeAll(() => {
    seedSuite(202502);
  });

  async function registerAndLogin(role: 'admin' | 'user' = 'user') {
    const user = userPayload({ role });

    const registerRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: user.email, name: user.name, password: user.password, role })
      .expect(201);

    const token = registerRes.body.data.token as string;
    const _userId = registerRes.body.data.user.id as string;
    return { token, userId: _userId, user };
  }

  describe('Create and list API keys', () => {
    it('creates a new API key and lists it', async () => {
      const { token } = await registerAndLogin('user');

      const keyReq = apiKeyPayload({
        permissions: ['search'],
        environment: 'test',
        rateLimitTier: 'free',
      });

      const createRes = await request(app)
        .post('/api/v1/keys')
        .set('Authorization', `Bearer ${token}`)
        .send(keyReq)
        .expect(201);

      expect(createRes.body.success).toBe(true);
      expect(createRes.body.data).toHaveProperty('apiKey');
      expect(createRes.body.data).toHaveProperty('secretKey');
      const createdKey = createRes.body.data.apiKey;
      expect(createdKey.environment).toBe('test');
      expect(createdKey.rateLimitTier).toBe('free');
      expect(Array.isArray(createdKey.permissions)).toBe(true);

      const listRes = await request(app)
        .get('/api/v1/keys')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(listRes.body.success).toBe(true);
      expect(Array.isArray(listRes.body.data.apiKeys)).toBe(true);
      expect(listRes.body.data.total).toBeGreaterThanOrEqual(1);
      const found = listRes.body.data.apiKeys.find((k: any) => k.id === createdKey.id);
      expect(found).toBeTruthy();
    });

    it('rejects creating non-free tier for non-admin', async () => {
      const { token } = await registerAndLogin('user');

      const keyReq = apiKeyPayload({ rateLimitTier: 'pro' });
      await request(app)
        .post('/api/v1/keys')
        .set('Authorization', `Bearer ${token}`)
        .send(keyReq)
        .expect(403);
    });
  });

  describe('Update and revoke API key', () => {
    it('updates name and permissions, then revokes the key', async () => {
      const { token } = await registerAndLogin('admin');

      // Create key as admin with pro tier
      const createRes = await request(app)
        .post('/api/v1/keys')
        .set('Authorization', `Bearer ${token}`)
        .send(apiKeyPayload({ rateLimitTier: 'pro', permissions: ['search', 'analytics'] }))
        .expect(201);

      const keyId = createRes.body.data.apiKey.id as string;

      // Update name and downgrade tier
      const updates = { name: 'Updated Key Name', permissions: ['search'], rateLimitTier: 'free' };
      const updateRes = await request(app)
        .put(`/api/v1/keys/${keyId}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updates)
        .expect(200);

      expect(updateRes.body.success).toBe(true);
      expect(updateRes.body.data.apiKey.name).toBe('Updated Key Name');
      expect(updateRes.body.data.apiKey.rateLimitTier).toBe('free');

      // Get usage (should be present from mock with defaults)
      const usageRes = await request(app)
        .get(`/api/v1/keys/${keyId}/usage`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(usageRes.body.success).toBe(true);
      expect(usageRes.body.data.usage.apiKeyId).toBe(keyId);
      expect(usageRes.body.data.usage.rateLimitStatus).toBeTruthy();

      // Revoke
      const revokeRes = await request(app)
        .delete(`/api/v1/keys/${keyId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(revokeRes.body.success).toBe(true);

      // Ensure key no longer appears in list (since is_active=false)
      const listRes = await request(app)
        .get('/api/v1/keys')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const stillThere = listRes.body.data.apiKeys.find((k: any) => k.id === keyId);
      expect(stillThere).toBeFalsy();
    });

    it('prevents non-admin from setting pro/enterprise tier during update', async () => {
      const { token } = await registerAndLogin('user');

      const createRes = await request(app)
        .post('/api/v1/keys')
        .set('Authorization', `Bearer ${token}`)
        .send(apiKeyPayload({ rateLimitTier: 'free', permissions: ['search'] }))
        .expect(201);

      const keyId = createRes.body.data.apiKey.id as string;

      await request(app)
        .put(`/api/v1/keys/${keyId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ rateLimitTier: 'pro' })
        .expect(403);
    });
  });

  describe('Regenerate API key', () => {
    it('regenerates key and returns new secret', async () => {
      const { token } = await registerAndLogin('admin');

      const createRes = await request(app)
        .post('/api/v1/keys')
        .set('Authorization', `Bearer ${token}`)
        .send(apiKeyPayload({ rateLimitTier: 'pro' }))
        .expect(201);

      const keyId = createRes.body.data.apiKey.id as string;

      const regenRes = await request(app)
        .post(`/api/v1/keys/${keyId}/regenerate`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(regenRes.body.success).toBe(true);
      expect(regenRes.body.data).toHaveProperty('secretKey');
      expect(regenRes.body.data).toHaveProperty('oldKeyId', keyId);
      expect(regenRes.body.data.apiKey.id).not.toBe(keyId);
    });
  });
});
