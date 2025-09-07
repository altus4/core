import { config } from '@/config';
import type { DatabaseConnection, User } from '@/types';
import bcrypt from 'bcrypt';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import type { Connection } from 'mysql2/promise';
import { createConnection } from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';

export class TestHelpers {
  private static dbConnection: Connection | null = null;
  private static redisConnection: Redis | null = null;

  /**
   * Get test database connection
   */
  public static async getDbConnection(): Promise<Connection> {
    if (!this.dbConnection) {
      this.dbConnection = await createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306'),
        user: process.env.DB_USERNAME || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_DATABASE || 'altus4_test',
      });
    }
    return this.dbConnection;
  }

  /**
   * Get test Redis connection
   */
  public static async getRedisConnection(): Promise<Redis> {
    if (!this.redisConnection) {
      this.redisConnection = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_TEST_DB || '1'),
      });
    }
    return this.redisConnection;
  }

  /**
   * Create a test user
   */
  public static async createTestUser(
    override: Partial<User> = {}
  ): Promise<User & { password: string }> {
    const password = 'testpassword123';
    const hashedPassword = await bcrypt.hash(password, 10);

    const user: User = {
      id: uuidv4(),
      email: `test-${Date.now()}@example.com`,
      name: 'Test User',
      role: 'user',
      connectedDatabases: [],
      createdAt: new Date(),
      lastActive: new Date(),
      ...override,
    };

    const connection = await this.getDbConnection();
    await connection.execute(
      `INSERT INTO users (id, email, name, password_hash, role, created_at, last_active, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        user.email,
        user.name,
        hashedPassword,
        user.role,
        user.createdAt,
        user.lastActive,
        true,
      ]
    );

    return { ...user, password };
  }

  /**
   * Create a test database connection
   */
  public static async createTestDatabaseConnection(
    userId: string,
    override: Partial<DatabaseConnection> = {}
  ): Promise<DatabaseConnection> {
    const dbConnection: DatabaseConnection = {
      id: uuidv4(),
      name: `Test Database ${Date.now()}`,
      host: 'localhost',
      port: 3306,
      database: 'altus4_test',
      username: 'root',
      password: '',
      ssl: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      ...override,
    };

    const connection = await this.getDbConnection();
    await connection.execute(
      `INSERT INTO database_connections (id, user_id, name, host, port, database_name, username, password, ssl_enabled, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dbConnection.id,
        userId,
        dbConnection.name,
        dbConnection.host,
        dbConnection.port,
        dbConnection.database,
        dbConnection.username,
        dbConnection.password, // Use actual password for test
        dbConnection.ssl,
        dbConnection.isActive,
        dbConnection.createdAt,
        dbConnection.updatedAt,
      ]
    );

    return dbConnection;
  }

  /**
   * Generate JWT token for testing
   */
  public static generateTestToken(user: User): string {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      config.jwtSecret,
      { expiresIn: '1h' }
    );
  }

  /**
   * Clean up test data
   */
  public static async cleanupTestData(): Promise<void> {
    const connection = await this.getDbConnection();
    const redis = await this.getRedisConnection();

    // Clean database tables
    await connection.execute('DELETE FROM search_analytics');
    await connection.execute('DELETE FROM database_connections');
    await connection.execute('DELETE FROM api_keys');
    await connection.execute('DELETE FROM users');

    // Clean Redis
    await redis.flushdb();
  }

  /**
   * Insert test search data
   */
  public static async insertTestContent(
    content: Array<{
      title: string;
      content: string;
      category?: string;
    }>
  ): Promise<void> {
    const connection = await this.getDbConnection();

    // Create test_content table if it doesn't exist
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS test_content (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        category VARCHAR(100) DEFAULT 'general',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FULLTEXT(title, content)
      ) ENGINE=InnoDB
    `);

    for (const item of content) {
      await connection.execute(
        'INSERT INTO test_content (title, content, category) VALUES (?, ?, ?)',
        [item.title, item.content, item.category || 'general']
      );
    }
  }

  /**
   * Wait for async operations
   */
  public static async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Close test connections
   */
  public static async closeConnections(): Promise<void> {
    if (this.dbConnection) {
      await this.dbConnection.end();
      this.dbConnection = null;
    }
    if (this.redisConnection) {
      await this.redisConnection.disconnect();
      this.redisConnection = null;
    }
  }

  /**
   * Mock Express request object
   */
  public static mockRequest(overrides: any = {}): any {
    return {
      body: {},
      params: {},
      query: {},
      headers: {},
      get: jest.fn(),
      ...overrides,
    };
  }

  /**
   * Mock Express response object
   */
  public static mockResponse(): any {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.end = jest.fn().mockReturnValue(res);
    return res;
  }

  /**
   * Assert response structure
   */
  public static assertApiResponse(response: any, expectedData?: any): void {
    expect(response).toHaveProperty('success');
    expect(typeof response.success).toBe('boolean');

    if (response.success) {
      expect(response).toHaveProperty('data');
      if (expectedData) {
        expect(response.data).toMatchObject(expectedData);
      }
    } else {
      expect(response).toHaveProperty('error');
      expect(response.error).toHaveProperty('code');
      expect(response.error).toHaveProperty('message');
    }
  }

  /**
   * Create mock database service
   */
  public static createMockDatabaseService(): any {
    return {
      addConnection: jest.fn(),
      removeConnection: jest.fn(),
      testConnection: jest.fn().mockResolvedValue(true),
      discoverSchema: jest.fn().mockResolvedValue([]),
      executeFullTextSearch: jest.fn().mockResolvedValue([]),
      getSearchSuggestions: jest.fn().mockResolvedValue([]),
      analyzeQueryPerformance: jest.fn().mockResolvedValue([]),
      closeAllConnections: jest.fn(),
      getConnectionStatuses: jest.fn().mockResolvedValue({}),
    };
  }

  /**
   * Create mock cache service
   */
  public static createMockCacheService(): any {
    return {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      getPopularQueries: jest.fn().mockResolvedValue([]),
      getTopQueries: jest.fn().mockResolvedValue([]),
      getQueryVolume: jest.fn().mockResolvedValue(0),
      getAverageResponseTime: jest.fn().mockResolvedValue(0),
      getPopularCategories: jest.fn().mockResolvedValue([]),
      logSearchAnalytics: jest.fn(),
      getSearchHistory: jest.fn().mockResolvedValue([]),
    };
  }

  /**
   * Performance measurement
   */
  public static async measurePerformance<T>(
    operation: () => Promise<T>
  ): Promise<{ result: T; duration: number; memoryUsage: NodeJS.MemoryUsage }> {
    const startTime = process.hrtime.bigint();
    const startMemory = process.memoryUsage();

    const result = await operation();

    const endTime = process.hrtime.bigint();
    const endMemory = process.memoryUsage();

    const duration = Number(endTime - startTime) / 1e6; // Convert to milliseconds

    return {
      result,
      duration,
      memoryUsage: {
        rss: endMemory.rss - startMemory.rss,
        heapTotal: endMemory.heapTotal - startMemory.heapTotal,
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        external: endMemory.external - startMemory.external,
        arrayBuffers: endMemory.arrayBuffers - startMemory.arrayBuffers,
      },
    };
  }
}
