import { closePool, refreshDatabase } from '../helpers/refresh-database';

// Optional: enable real DB refresh per test by setting USE_REAL_DB=true
const useRealDb = process.env.USE_REAL_DB === 'true';

if (useRealDb) {
  beforeEach(async () => {
    await refreshDatabase();
  });

  afterAll(async () => {
    await closePool();
  });
}
