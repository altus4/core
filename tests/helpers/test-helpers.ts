import type { DatabaseConnection, User } from '@/types';
import Redis from 'ioredis';
import type { Connection } from 'mysql2/promise';
import jwt from 'jsonwebtoken';
import { faker } from '@faker-js/faker';

export class TestHelpers {
  private static dbConnection: Connection | null = null;
  private static redisConnection: Redis | null = null;

  /**
   * Get test database connection
   */
  static async getDbConnection(): Promise<Connection> {
    if (!this.dbConnection) {
      // This would be implemented with actual test DB connection
      throw new Error('Test database connection not implemented');
    }
    return this.dbConnection;
  }

  /**
   * Get test Redis connection
   */
  static async getRedisConnection(): Promise<Redis> {
    if (!this.redisConnection) {
      // This would be implemented with actual test Redis connection
      this.redisConnection = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        maxRetriesPerRequest: 1,
      });
    }
    return this.redisConnection;
  }

  /**
   * Create a test user
   */
  static async createTestUser(override?: Partial<User>): Promise<User & { password: string }> {
    const password = faker.internet.password({ length: 12 });
    return {
      id: faker.string.uuid(),
      email: faker.internet.email().toLowerCase(),
      name: faker.person.fullName(),
      role: 'user',
      connectedDatabases: [],
      createdAt: new Date(),
      lastActive: new Date(),
      password,
      ...override,
    };
  }

  /**
   * Create a test database connection
   */
  static async createTestDatabaseConnection(
    userId: string,
    override?: Partial<DatabaseConnection>
  ): Promise<DatabaseConnection> {
    return {
      id: faker.string.uuid(),
      name: faker.database.engine(),
      host: faker.internet.ip(),
      port: faker.internet.port(),
      database: faker.database.engine(),
      username: faker.internet.username(),
      password: faker.internet.password(),
      ssl: faker.datatype.boolean(),
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      ...override,
    };
  }

  /**
   * Generate JWT token for testing
   */
  static generateTestToken(user: User): string {
    const secret = process.env.JWT_SECRET || 'test-secret-key';
    return jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
      },
      secret,
      { expiresIn: '1h' }
    );
  }

  /**
   * Clean up test data
   */
  static async cleanupTestData(): Promise<void> {
    // Implementation would clean up test data
    console.log('Cleaning up test data...');
  }

  /**
   * Insert test search data
   */
  static async insertTestContent(
    content: Array<{
      title: string;
      content: string;
      category?: string;
    }>
  ): Promise<void> {
    // Implementation would insert test data
    console.log(`Inserting ${content.length} test content items...`);
  }

  /**
   * Wait for async operations
   */
  static async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Close test connections
   */
  static async closeConnections(): Promise<void> {
    if (this.dbConnection) {
      await this.dbConnection.end();
      this.dbConnection = null;
    }
    if (this.redisConnection) {
      await this.redisConnection.quit();
      this.redisConnection = null;
    }
  }

  /**
   * Mock Express request object
   */
  static mockRequest(overrides: any = {}): any {
    return {
      body: {},
      params: {},
      query: {},
      headers: {},
      user: null,
      apiKey: null,
      ...overrides,
    };
  }

  /**
   * Mock Express response object
   */
  static mockResponse(): any {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.end = jest.fn().mockReturnValue(res);
    res.setHeader = jest.fn().mockReturnValue(res);
    return res;
  }

  /**
   * Assert response structure
   */
  static assertApiResponse(response: any, expectedData?: any): void {
    expect(response).toHaveProperty('success');
    expect(response).toHaveProperty('data');
    if (expectedData) {
      expect(response.data).toMatchObject(expectedData);
    }
  }

  /**
   * Create mock database service
   */
  static createMockDatabaseService(): any {
    return {
      addConnection: jest.fn().mockResolvedValue(true),
      removeConnection: jest.fn().mockResolvedValue(true),
      testConnection: jest.fn().mockResolvedValue(true),
      executeFullTextSearch: jest.fn().mockResolvedValue([]),
      discoverSchema: jest.fn().mockResolvedValue([]),
    };
  }

  /**
   * Create mock cache service
   */
  static createMockCacheService(): any {
    return {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(true),
      del: jest.fn().mockResolvedValue(true),
      exists: jest.fn().mockResolvedValue(false),
    };
  }

  /**
   * Performance measurement
   */
  static async measurePerformance<T>(operation: () => Promise<T>): Promise<{
    result: T;
    duration: number;
    memoryUsage: NodeJS.MemoryUsage;
  }> {
    const startTime = process.hrtime.bigint();
    const startMemory = process.memoryUsage();

    const result = await operation();

    const endTime = process.hrtime.bigint();
    const endMemory = process.memoryUsage();

    const duration = Number(endTime - startTime) / 1_000_000; // Convert to ms

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
