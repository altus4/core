import request from 'supertest';
import { createApp } from '@/app';
import { seedSuite, userPayload } from '@tests/helpers/factories';

describe('Analytics Integration (SuperTest + JWT)', () => {
  const app = createApp();

  beforeAll(() => {
    seedSuite(202505);
  });

  async function register(role: 'admin' | 'user' = 'user') {
    const user = userPayload({ role });
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: user.email, name: user.name, password: user.password, role })
      .expect(201);
    return res.body.data.token as string;
  }

  describe('User analytics', () => {
    let token: string;
    beforeAll(async () => {
      token = await register('user');
    });

    it('returns search trends', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/search-trends')
        .set('Authorization', `Bearer ${token}`)
        .query({ period: 'week' })
        .expect(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('returns performance metrics', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/performance')
        .set('Authorization', `Bearer ${token}`)
        .query({ period: 'week' })
        .expect(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.data).toBe('object');
      expect(res.body.data).toHaveProperty('summary');
    });

    it('returns popular queries', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/popular-queries')
        .set('Authorization', `Bearer ${token}`)
        .query({ period: 'week' })
        .expect(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('returns search history (paginated)', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/search-history')
        .set('Authorization', `Bearer ${token}`)
        .query({ period: 'week' })
        .expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('items');
      expect(res.body.data).toHaveProperty('total');
    });

    it('returns insights (AI may be disabled -> empty)', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/insights')
        .set('Authorization', `Bearer ${token}`)
        .query({ period: 'week' })
        .expect(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('returns dashboard data', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/dashboard')
        .set('Authorization', `Bearer ${token}`)
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
    let userToken: string;
    beforeAll(async () => {
      userToken = await register('user');
    });

    it('rejects non-admin for system overview', async () => {
      await request(app)
        .get('/api/v1/analytics/admin/system-overview')
        .set('Authorization', `Bearer ${userToken}`)
        .query({ period: 'week' })
        .expect(403);
    });

    it('rejects non-admin for user activity', async () => {
      await request(app)
        .get('/api/v1/analytics/admin/user-activity')
        .set('Authorization', `Bearer ${userToken}`)
        .query({ period: 'week', limit: 10, offset: 0 })
        .expect(403);
    });

    it('rejects non-admin for system performance metrics', async () => {
      await request(app)
        .get('/api/v1/analytics/admin/performance-metrics')
        .set('Authorization', `Bearer ${userToken}`)
        .query({ period: 'week' })
        .expect(403);
    });
  });

  describe('Pagination and edges', () => {
    let token: string;
    let adminToken: string;
    beforeAll(async () => {
      token = await register('user');
      adminToken = await register('admin');
    });

    it('search history supports pagination', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/search-history')
        .set('Authorization', `Bearer ${token}`)
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
        .set('Authorization', `Bearer ${token}`)
        .query({ period: 'week', limit: 0 })
        .expect(400);
    });

    it('search history validates invalid offset', async () => {
      await request(app)
        .get('/api/v1/analytics/search-history')
        .set('Authorization', `Bearer ${token}`)
        .query({ period: 'week', offset: -1 })
        .expect(400);
    });

    it('user activity supports pagination', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/admin/user-activity')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ period: 'week', limit: 5, offset: 5 })
        .expect(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('user activity validates invalid limit', async () => {
      await request(app)
        .get('/api/v1/analytics/admin/user-activity')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ period: 'week', limit: 0 })
        .expect(400);
    });

    it('user activity validates invalid offset', async () => {
      await request(app)
        .get('/api/v1/analytics/admin/user-activity')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ period: 'week', offset: -1 })
        .expect(400);
    });
  });
  describe('Admin analytics', () => {
    let adminToken: string;
    beforeAll(async () => {
      adminToken = await register('admin');
    });

    it('returns system overview (admin only)', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/admin/system-overview')
        .set('Authorization', `Bearer ${adminToken}`)
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
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ period: 'week' })
        .expect(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('returns performance metrics (admin only)', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/admin/performance-metrics')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ period: 'week' })
        .expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('timeSeriesData');
      expect(res.body.data).toHaveProperty('slowestQueries');
      expect(res.body.data).toHaveProperty('summary');
    });
  });
});
