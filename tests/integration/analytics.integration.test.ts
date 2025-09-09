import { createApp } from '@/app';
import { apiKeyPayload, seedSuite, userPayload } from '@tests/helpers/factories';
import request from 'supertest';

describe('Analytics Integration (SuperTest + API Key)', () => {
  const app = createApp();

  beforeAll(() => {
    seedSuite(202505);
  });

  async function createUserAndApiKey(role: 'admin' | 'user' = 'user') {
    const user = userPayload({ role });
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: user.email, name: user.name, password: user.password, role })
      .expect(201);
    const jwtToken = res.body.data.token as string;

    // Create API key with analytics permissions
    const permissions = role === 'admin' ? ['analytics', 'admin'] : ['analytics'];
    const keyReq = apiKeyPayload({ permissions, environment: 'test', rateLimitTier: 'free' });
    const createKey = await request(app)
      .post('/api/v1/keys')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send(keyReq)
      .expect(201);
    const secretKey = createKey.body.data.secretKey as string;

    return { secretKey, jwtToken };
  }

  describe('User analytics', () => {
    let apiKey: string;
    beforeAll(async () => {
      const { secretKey } = await createUserAndApiKey('user');
      apiKey = secretKey;
    });

    it('returns search trends', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/search-trends')
        .set('Authorization', `Bearer ${apiKey}`)
        .query({ period: 'week' })
        .expect(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('returns performance metrics', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/performance')
        .set('Authorization', `Bearer ${apiKey}`)
        .query({ period: 'week' })
        .expect(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.data).toBe('object');
      expect(res.body.data).toHaveProperty('summary');
    });

    it('returns popular queries', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/popular-queries')
        .set('Authorization', `Bearer ${apiKey}`)
        .query({ period: 'week' })
        .expect(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('returns search history (paginated)', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/search-history')
        .set('Authorization', `Bearer ${apiKey}`)
        .query({ period: 'week' })
        .expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('items');
      expect(res.body.data).toHaveProperty('total');
    });

    it('returns insights (AI may be disabled -> empty)', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/insights')
        .set('Authorization', `Bearer ${apiKey}`)
        .query({ period: 'week' })
        .expect(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('returns dashboard data', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/dashboard')
        .set('Authorization', `Bearer ${apiKey}`)
        .query({ period: 'week' })
        .expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('trends');
      expect(res.body.data).toHaveProperty('performance');
      expect(res.body.data).toHaveProperty('popularQueries');
      expect(res.body.data).toHaveProperty('insights');
      expect(res.body.data).toHaveProperty('summary');
    });
  });

  describe('Permissions (negative cases)', () => {
    let userApiKey: string;
    beforeAll(async () => {
      const { secretKey } = await createUserAndApiKey('user');
      userApiKey = secretKey;
    });

    it('rejects non-admin for system overview', async () => {
      await request(app)
        .get('/api/v1/analytics/admin/system-overview')
        .set('Authorization', `Bearer ${userApiKey}`)
        .query({ period: 'week' })
        .expect(403);
    });

    it('rejects non-admin for user activity', async () => {
      await request(app)
        .get('/api/v1/analytics/admin/user-activity')
        .set('Authorization', `Bearer ${userApiKey}`)
        .query({ period: 'week', limit: 10, offset: 0 })
        .expect(403);
    });

    it('rejects non-admin for system performance metrics', async () => {
      await request(app)
        .get('/api/v1/analytics/admin/performance-metrics')
        .set('Authorization', `Bearer ${userApiKey}`)
        .query({ period: 'week' })
        .expect(403);
    });
  });

  describe('Pagination and edges', () => {
    let userApiKey: string;
    let adminApiKey: string;
    beforeAll(async () => {
      const { secretKey: userKey } = await createUserAndApiKey('user');
      const { secretKey: adminKey } = await createUserAndApiKey('admin');
      userApiKey = userKey;
      adminApiKey = adminKey;
    });

    it('search history supports pagination', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/search-history')
        .set('Authorization', `Bearer ${userApiKey}`)
        .query({ period: 'week', limit: 5, offset: 10 })
        .expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('items');
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data).toHaveProperty('total');
    });

    it('search history validates invalid limit', async () => {
      await request(app)
        .get('/api/v1/analytics/search-history')
        .set('Authorization', `Bearer ${userApiKey}`)
        .query({ period: 'week', limit: 0 })
        .expect(400);
    });

    it('search history validates invalid offset', async () => {
      await request(app)
        .get('/api/v1/analytics/search-history')
        .set('Authorization', `Bearer ${userApiKey}`)
        .query({ period: 'week', offset: -1 })
        .expect(400);
    });

    it('user activity supports pagination', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/admin/user-activity')
        .set('Authorization', `Bearer ${adminApiKey}`)
        .query({ period: 'week', limit: 5, offset: 5 })
        .expect(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('user activity validates invalid limit', async () => {
      await request(app)
        .get('/api/v1/analytics/admin/user-activity')
        .set('Authorization', `Bearer ${adminApiKey}`)
        .query({ period: 'week', limit: 0 })
        .expect(400);
    });

    it('user activity validates invalid offset', async () => {
      await request(app)
        .get('/api/v1/analytics/admin/user-activity')
        .set('Authorization', `Bearer ${adminApiKey}`)
        .query({ period: 'week', offset: -1 })
        .expect(400);
    });
  });
  describe('Admin analytics', () => {
    let adminApiKey: string;
    beforeAll(async () => {
      const { secretKey } = await createUserAndApiKey('admin');
      adminApiKey = secretKey;
    });

    it('returns system overview (admin only)', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/admin/system-overview')
        .set('Authorization', `Bearer ${adminApiKey}`)
        .query({ period: 'week' })
        .expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('summary');
      expect(res.body.data).toHaveProperty('userGrowth');
      expect(res.body.data).toHaveProperty('queryVolume');
    });

    it('returns user activity (admin only)', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/admin/user-activity')
        .set('Authorization', `Bearer ${adminApiKey}`)
        .query({ period: 'week' })
        .expect(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('returns performance metrics (admin only)', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/admin/performance-metrics')
        .set('Authorization', `Bearer ${adminApiKey}`)
        .query({ period: 'week' })
        .expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('timeSeriesData');
      expect(res.body.data).toHaveProperty('slowestQueries');
      expect(res.body.data).toHaveProperty('summary');
    });
  });
});
