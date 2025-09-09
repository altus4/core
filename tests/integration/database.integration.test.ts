import { createApp } from '@/app';
import {
  apiKeyPayload,
  dbConnectionPayload,
  seedSuite,
  userPayload,
} from '@tests/helpers/factories';
import request from 'supertest';

describe('Database Integration (SuperTest)', () => {
  const app = createApp();

  beforeAll(() => {
    seedSuite(202503);
  });

  async function createUserAndApiKey(role: 'admin' | 'user' = 'user') {
    const user = userPayload({ role });
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: user.email, name: user.name, password: user.password, role })
      .expect(201);
    const jwtToken = res.body.data.token as string;

    // Create API key with admin permissions (needed for database operations)
    const permissions = role === 'admin' ? ['admin'] : ['admin']; // Regular users need admin permission for database operations
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

    return secretKey;
  }

  describe('CRUD + test + schema + status', () => {
    it('creates, reads, updates, tests, discovers schema, checks status, and deletes a connection', async () => {
      const apiKey = await createUserAndApiKey('user');

      // Create connection
      const payload = dbConnectionPayload({ host: 'localhost', port: 3306, ssl: false });
      const createRes = await request(app)
        .post('/api/v1/databases')
        .set('Authorization', `Bearer ${apiKey}`)
        .send(payload)
        .expect(201);

      expect(createRes.body.success).toBe(true);
      const connection = createRes.body.data;
      expect(connection).toHaveProperty('id');
      expect(connection).toHaveProperty('name', payload.name);
      expect(connection).not.toHaveProperty('password');
      const id = connection.id as string;

      // List
      const listRes = await request(app)
        .get('/api/v1/databases')
        .set('Authorization', `Bearer ${apiKey}`)
        .expect(200);
      expect(listRes.body.success).toBe(true);
      const listed = listRes.body.data.find((c: any) => c.id === id);
      expect(listed).toBeTruthy();

      // Get one
      const getRes = await request(app)
        .get(`/api/v1/databases/${id}`)
        .set('Authorization', `Bearer ${apiKey}`)
        .expect(200);
      expect(getRes.body.success).toBe(true);
      expect(getRes.body.data.id).toBe(id);

      // Update
      const updates = { name: 'Renamed', ssl: true, port: 3307 };
      const updateRes = await request(app)
        .put(`/api/v1/databases/${id}`)
        .set('Authorization', `Bearer ${apiKey}`)
        .send(updates)
        .expect(200);
      expect(updateRes.body.success).toBe(true);
      expect(updateRes.body.data.name).toBe('Renamed');
      expect(updateRes.body.data.ssl).toBe(true);
      expect(updateRes.body.data.port).toBe(3307);

      // Test connection
      const testRes = await request(app)
        .post(`/api/v1/databases/${id}/test`)
        .set('Authorization', `Bearer ${apiKey}`)
        .expect(200);
      expect(testRes.body.success).toBe(true);
      expect(testRes.body.data.connected).toBe(true);

      // Schema discovery
      const schemaRes = await request(app)
        .get(`/api/v1/databases/${id}/schema`)
        .set('Authorization', `Bearer ${apiKey}`)
        .expect(200);
      expect(schemaRes.body.success).toBe(true);
      expect(Array.isArray(schemaRes.body.data)).toBe(true);
      expect(schemaRes.body.data.length).toBeGreaterThan(0);

      // Status
      const statusRes = await request(app)
        .get('/api/v1/databases/status')
        .set('Authorization', `Bearer ${apiKey}`)
        .expect(200);
      expect(statusRes.body.success).toBe(true);
      expect(statusRes.body.data).toHaveProperty(id);

      // Delete
      const delRes = await request(app)
        .delete(`/api/v1/databases/${id}`)
        .set('Authorization', `Bearer ${apiKey}`)
        .expect(200);
      expect(delRes.body.success).toBe(true);
      expect(delRes.body.data.success).toBe(true);

      // Ensure not present in status map (inactive connections ignored)
      const statusAfter = await request(app)
        .get('/api/v1/databases/status')
        .set('Authorization', `Bearer ${apiKey}`)
        .expect(200);
      expect(statusAfter.body.data[id]).toBeUndefined();

      // Getting it should 404
      await request(app)
        .get(`/api/v1/databases/${id}`)
        .set('Authorization', `Bearer ${apiKey}`)
        .expect(404);
    });
  });
});
