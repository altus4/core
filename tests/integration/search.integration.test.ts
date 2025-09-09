import { createApp } from '@/app';
import {
  apiKeyPayload,
  dbConnectionPayload,
  seedSuite,
  userPayload,
} from '@tests/helpers/factories';
import request from 'supertest';

describe('Search Integration (SuperTest + API Key)', () => {
  const app = createApp();

  beforeAll(() => {
    seedSuite(202504);
  });

  async function createUserAndApiKey(withAnalytics = false) {
    // Register user (JWT)
    const user = userPayload();
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: user.email, name: user.name, password: user.password })
      .expect(201);
    const jwtToken = reg.body.data.token as string;

    // Create API key for database operations (admin permission needed)
    const adminPermissions = ['admin'];
    const adminKeyReq = apiKeyPayload({
      permissions: adminPermissions,
      environment: 'test',
      rateLimitTier: 'free',
    });
    const createAdminKey = await request(app)
      .post('/api/v1/keys')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send(adminKeyReq)
      .expect(201);
    const adminApiKey = createAdminKey.body.data.secretKey as string;

    // Create database connection using admin API key
    const dbPayload = dbConnectionPayload({ host: 'localhost', port: 3306 });
    const createDb = await request(app)
      .post('/api/v1/databases')
      .set('Authorization', `Bearer ${adminApiKey}`)
      .send(dbPayload)
      .expect(201);
    const dbId = createDb.body.data.id as string;

    // Create API key for search operations (search permission + optional analytics)
    const permissions = withAnalytics ? ['search', 'analytics'] : ['search'];
    const keyReq = apiKeyPayload({
      permissions,
      environment: 'test',
      rateLimitTier: 'free',
    });
    const createKey = await request(app)
      .post('/api/v1/keys')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send(keyReq)
      .expect(201);
    const secretKey = createKey.body.data.secretKey as string;

    return { secretKey, dbId };
  }

  describe('POST /api/v1/search', () => {
    it('executes a basic search with API key auth', async () => {
      const { secretKey, dbId } = await createUserAndApiKey(false);

      const res = await request(app)
        .post('/api/v1/search')
        .set('Authorization', `Bearer ${secretKey}`)
        .send({ query: 'database', databases: [dbId], tables: ['test_content'], limit: 5 })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('results');
      expect(Array.isArray(res.body.data.results)).toBe(true);
      // Our mysql mock returns some rows for MATCH AGAINST
      // Expect some results when tables are provided (mock returns 2 rows)
      expect(res.body.data.results.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/v1/search/suggestions', () => {
    it('returns suggestions (may be empty with cache disabled)', async () => {
      const { secretKey } = await createUserAndApiKey(false);

      const res = await request(app)
        .get('/api/v1/search/suggestions')
        .set('Authorization', `Bearer ${secretKey}`)
        .query({ query: 'db' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('suggestions');
      expect(Array.isArray(res.body.data.suggestions)).toBe(true);
    });
  });

  describe('POST /api/v1/search/analyze', () => {
    it('analyzes query performance (analytics permission required)', async () => {
      const { secretKey, dbId } = await createUserAndApiKey(true);

      const res = await request(app)
        .post('/api/v1/search/analyze')
        .set('Authorization', `Bearer ${secretKey}`)
        .send({ query: 'select * from test_content', databases: [dbId] })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('performance');
      expect(typeof res.body.data.performance).toBe('object');
    });
  });

  describe('GET /api/v1/search/trends', () => {
    it('returns trend structure (may be empty arrays)', async () => {
      const { secretKey } = await createUserAndApiKey(true);

      const res = await request(app)
        .get('/api/v1/search/trends')
        .set('Authorization', `Bearer ${secretKey}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('GET /api/v1/search/history', () => {
    it('returns user search history (may be empty)', async () => {
      const { secretKey } = await createUserAndApiKey(false);

      const res = await request(app)
        .get('/api/v1/search/history')
        .set('Authorization', `Bearer ${secretKey}`)
        .query({ limit: 10, offset: 0 })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });
});
