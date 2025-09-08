/**
 * Test Data Fixtures
 *
 * Static test data used across multiple tests.
 * Provides consistent, realistic data for testing various scenarios.
 */

export const testUsers = {
  admin: {
    id: 'admin-test-id',
    email: 'admin@test.com',
    name: 'Test Admin',
    role: 'admin' as const,
    password: 'admin123456',
    connectedDatabases: [],
    createdAt: new Date('2024-01-01'),
    lastActive: new Date(),
  },
  user: {
    id: 'user-test-id',
    email: 'user@test.com',
    name: 'Test User',
    role: 'user' as const,
    password: 'user123456',
    connectedDatabases: [],
    createdAt: new Date('2024-01-01'),
    lastActive: new Date(),
  },
};

export const testDatabaseConnections = {
  local: {
    id: 'db-local-test',
    name: 'Local Test Database',
    host: 'localhost',
    port: 3306,
    database: 'altus4_test',
    username: 'root',
    password: '',
    ssl: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date(),
    isActive: true,
  },
  remote: {
    id: 'db-remote-test',
    name: 'Remote Test Database',
    host: 'test-db.example.com',
    port: 3306,
    database: 'production_db',
    username: 'altus_user',
    password: 'secure_password',
    ssl: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date(),
    isActive: true,
  },
};

export const testApiKeys = {
  free: {
    id: 'key-free-test',
    name: 'Free Tier API Key',
    keyPrefix: 'altus4_sk_test',
    environment: 'test' as const,
    permissions: ['search'],
    rateLimitTier: 'free' as const,
    rateLimitCustom: null,
    expiresAt: new Date('2025-12-31'),
    lastUsed: new Date(),
    usageCount: 42,
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date(),
  },
  pro: {
    id: 'key-pro-test',
    name: 'Pro Tier API Key',
    keyPrefix: 'altus4_sk_test',
    environment: 'test' as const,
    permissions: ['search', 'analytics'],
    rateLimitTier: 'pro' as const,
    rateLimitCustom: null,
    expiresAt: new Date('2025-12-31'),
    lastUsed: new Date(),
    usageCount: 156,
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date(),
  },
  enterprise: {
    id: 'key-enterprise-test',
    name: 'Enterprise API Key',
    keyPrefix: 'altus4_sk_test',
    environment: 'test' as const,
    permissions: ['search', 'analytics', 'database:read', 'database:write'],
    rateLimitTier: 'enterprise' as const,
    rateLimitCustom: { requestsPerMinute: 10000 },
    expiresAt: null,
    lastUsed: new Date(),
    usageCount: 2543,
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date(),
  },
};

export const testSearchQueries = {
  simple: {
    query: 'database tutorial',
    searchMode: 'natural' as const,
    limit: 20,
    offset: 0,
    includeAnalytics: false,
  },
  boolean: {
    query: '+mysql -postgresql',
    searchMode: 'boolean' as const,
    limit: 10,
    offset: 0,
    includeAnalytics: true,
  },
  semantic: {
    query: 'how to optimize database performance',
    searchMode: 'semantic' as const,
    limit: 15,
    offset: 0,
    includeAnalytics: true,
  },
  complex: {
    query: 'full-text search implementation',
    databases: ['db-local-test'],
    tables: ['articles', 'documentation'],
    columns: ['title', 'content'],
    searchMode: 'natural' as const,
    limit: 50,
    offset: 20,
    includeAnalytics: true,
  },
};

export const testArticles = [
  {
    id: 1,
    title: 'Getting Started with MySQL',
    content:
      'MySQL is a popular open-source database management system. This comprehensive guide covers installation, basic configuration, and creating your first database schema.',
    category: 'database',
    author: 'John Doe',
    created_at: new Date('2024-01-15'),
  },
  {
    id: 2,
    title: 'Advanced MySQL Queries',
    content:
      'Learn how to write complex queries in MySQL including joins, subqueries, window functions, and performance optimization techniques for large datasets.',
    category: 'database',
    author: 'Jane Smith',
    created_at: new Date('2024-02-01'),
  },
  {
    id: 3,
    title: 'Node.js Best Practices',
    content:
      'Explore the best practices for developing scalable Node.js applications including error handling, performance optimization, security considerations, and testing strategies.',
    category: 'programming',
    author: 'Bob Johnson',
    created_at: new Date('2024-02-15'),
  },
  {
    id: 4,
    title: 'Full-Text Search in MySQL',
    content:
      'MySQL provides powerful full-text search capabilities that can be used to build sophisticated search features. This article covers FULLTEXT indexes, search modes, and optimization.',
    category: 'database',
    author: 'Alice Williams',
    created_at: new Date('2024-03-01'),
  },
  {
    id: 5,
    title: 'TypeScript for Large Applications',
    content:
      'TypeScript brings type safety to JavaScript, making it ideal for large-scale applications and team development. Learn about advanced types, generics, and project organization.',
    category: 'programming',
    author: 'Charlie Brown',
    created_at: new Date('2024-03-15'),
  },
];

export const testSearchResults = {
  natural: [
    {
      id: 'result-1',
      table: 'articles',
      database: 'altus4_test',
      relevanceScore: 0.95,
      matchedColumns: ['title', 'content'],
      data: testArticles[0],
      snippet: 'MySQL is a popular open-source database...',
      categories: ['database'],
    },
    {
      id: 'result-2',
      table: 'articles',
      database: 'altus4_test',
      relevanceScore: 0.87,
      matchedColumns: ['title', 'content'],
      data: testArticles[1],
      snippet: 'Learn how to write complex queries in MySQL...',
      categories: ['database'],
    },
    {
      id: 'result-3',
      table: 'articles',
      database: 'altus4_test',
      relevanceScore: 0.76,
      matchedColumns: ['title', 'content'],
      data: testArticles[3],
      snippet: 'MySQL provides powerful full-text search capabilities...',
      categories: ['database'],
    },
  ],
  boolean: [
    {
      id: 'result-1',
      table: 'articles',
      database: 'altus4_test',
      relevanceScore: 1.0,
      matchedColumns: ['title', 'content'],
      data: testArticles[0],
      snippet: 'MySQL is a popular open-source database...',
      categories: ['database'],
    },
  ],
  semantic: [
    {
      id: 'result-1',
      table: 'articles',
      database: 'altus4_test',
      relevanceScore: 0.91,
      matchedColumns: ['title', 'content'],
      data: testArticles[1],
      snippet: 'performance optimization techniques for large datasets...',
      categories: ['database', 'performance'],
    },
    {
      id: 'result-2',
      table: 'articles',
      database: 'altus4_test',
      relevanceScore: 0.84,
      matchedColumns: ['content'],
      data: testArticles[2],
      snippet: 'performance optimization, security considerations...',
      categories: ['programming', 'performance'],
    },
  ],
};

export const testAnalytics = {
  dashboard: {
    overview: {
      totalSearches: 1245,
      avgResponseTime: 67,
      totalConnections: 3,
    },
    recentActivity: [
      { type: 'search', query: 'mysql tutorial', timestamp: new Date() },
      { type: 'connection', name: 'Added new database', timestamp: new Date() },
    ],
    topQueries: [
      { query: 'database optimization', count: 45 },
      { query: 'mysql queries', count: 38 },
      { query: 'full text search', count: 29 },
    ],
    performanceMetrics: {
      averageQueryTime: 67,
      cacheHitRate: 0.78,
      errorRate: 0.02,
    },
  },
  trends: {
    period: 'week' as const,
    topQueries: ['mysql', 'database', 'optimization'],
    queryVolume: 156,
    avgResponseTime: 67,
    popularCategories: ['database', 'programming'],
  },
  performance: {
    averageQueryTime: 67,
    slowestQueries: [
      { query: 'complex join query', time: 245 },
      { query: 'full table scan', time: 189 },
    ],
    fastestQueries: [
      { query: 'simple select', time: 12 },
      { query: 'cached result', time: 8 },
    ],
    queryTimeDistribution: [
      { range: '0-50ms', count: 89 },
      { range: '50-100ms', count: 45 },
      { range: '100-200ms', count: 23 },
      { range: '200ms+', count: 7 },
    ],
  },
};
