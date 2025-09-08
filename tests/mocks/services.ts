/**
 * Service Mocks for Testing
 *
 * Centralized mock implementations of all services used in tests.
 * Provides consistent mock behavior across unit and integration tests.
 */

import { mockSearchResults } from '@tests/helpers/factories';

export const mockDatabaseService = {
  addConnection: jest.fn().mockResolvedValue(true),
  removeConnection: jest.fn().mockResolvedValue(true),
  testConnection: jest.fn().mockResolvedValue(true),
  discoverSchema: jest.fn().mockResolvedValue([
    {
      database: 'altus4_test',
      table: 'test_content',
      columns: [
        { name: 'id', type: 'int', isFullTextIndexed: false, isSearchable: false },
        { name: 'title', type: 'varchar', isFullTextIndexed: true, isSearchable: true },
        { name: 'content', type: 'text', isFullTextIndexed: true, isSearchable: true },
      ],
      fullTextIndexes: [
        { name: 'title_content_ft', columns: ['title', 'content'], type: 'FULLTEXT' },
      ],
      estimatedRows: 1000,
      lastAnalyzed: new Date(),
    },
  ]),
  executeFullTextSearch: jest
    .fn()
    .mockImplementation(async (dbId, query, tables, columns, limit) => {
      const resultCount = Math.min(limit || 20, 50);
      return mockSearchResults(resultCount);
    }),
  getSearchSuggestions: jest.fn().mockResolvedValue([
    { text: 'database queries', score: 0.9, type: 'semantic' },
    { text: 'mysql tutorial', score: 0.8, type: 'popular' },
  ]),
  analyzeQueryPerformance: jest.fn().mockResolvedValue([
    { metric: 'execution_time', value: 45 },
    { metric: 'result_count', value: 123 },
    { metric: 'cache_hit', value: false },
  ]),
  getConnectionStatuses: jest.fn().mockResolvedValue({}),
  closeAllConnections: jest.fn().mockResolvedValue(undefined),
};

export const mockCacheService = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(true),
  del: jest.fn().mockResolvedValue(true),
  exists: jest.fn().mockResolvedValue(false),
  expire: jest.fn().mockResolvedValue(true),
  getPopularQueries: jest.fn().mockResolvedValue([]),
  getTopQueries: jest.fn().mockResolvedValue([]),
  getQueryVolume: jest.fn().mockResolvedValue(0),
  getAverageResponseTime: jest.fn().mockResolvedValue(50),
  getPopularCategories: jest.fn().mockResolvedValue(['database', 'programming']),
  logSearchAnalytics: jest.fn().mockResolvedValue(true),
  getSearchHistory: jest.fn().mockResolvedValue([]),
  close: jest.fn().mockResolvedValue(undefined),
  isAvailable: jest.fn().mockReturnValue(true),
};

export const mockAIService = {
  isAvailable: jest.fn().mockReturnValue(false), // Default to false for predictable tests
  processSearchQuery: jest.fn().mockResolvedValue('optimized query'),
  categorizeResults: jest.fn().mockResolvedValue([
    { name: 'database', count: 15, confidence: 0.8 },
    { name: 'programming', count: 8, confidence: 0.6 },
  ]),
  getQuerySuggestions: jest.fn().mockResolvedValue([
    { text: 'mysql optimization', score: 0.9, type: 'semantic' },
    { text: 'database indexing', score: 0.7, type: 'semantic' },
  ]),
  getOptimizationSuggestions: jest.fn().mockResolvedValue([
    { type: 'index', description: 'Add index on title column', impact: 'high' },
    { type: 'query', description: 'Use LIMIT clause', impact: 'medium' },
  ]),
  analyzeQuery: jest.fn().mockResolvedValue({
    recommendations: ['Use more specific keywords', 'Try boolean search mode'],
    optimizations: [{ type: 'query', suggestion: 'Use quotation marks for exact phrases' }],
  }),
  generateInsights: jest.fn().mockResolvedValue({
    insights: ['Search patterns show interest in database optimization'],
    performance: ['Average query time is 45ms, which is good'],
  }),
};

export const mockUserService = {
  registerUser: jest.fn(),
  loginUser: jest.fn(),
  getUserById: jest.fn(),
  getUserByEmail: jest.fn(),
  updateUser: jest.fn(),
  changePassword: jest.fn(),
  deactivateUser: jest.fn(),
  generateToken: jest.fn(),
  verifyToken: jest.fn(),
  refreshToken: jest.fn(),
  getAllUsers: jest.fn().mockResolvedValue([]),
  updateUserRole: jest.fn(),
  hashPassword: jest.fn(),
  comparePassword: jest.fn(),
  close: jest.fn().mockResolvedValue(undefined),
};

export const mockApiKeyService = {
  createApiKey: jest.fn(),
  updateApiKey: jest.fn(),
  revokeApiKey: jest.fn(),
  regenerateApiKey: jest.fn(),
  listApiKeys: jest.fn().mockResolvedValue([]),
  validateApiKey: jest.fn(),
  getApiKeyUsage: jest.fn().mockResolvedValue({ requests: 0, lastUsed: null }),
  trackApiKeyUsage: jest.fn(),
  close: jest.fn().mockResolvedValue(undefined),
};

// Redis mock
export const mockRedis = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  exists: jest.fn().mockResolvedValue(0),
  ttl: jest.fn().mockResolvedValue(-1),
  expire: jest.fn().mockResolvedValue(1),
  flushdb: jest.fn().mockResolvedValue('OK'),
  quit: jest.fn().mockResolvedValue('OK'),
  disconnect: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  status: 'ready',
};

// MySQL mock
export const mockMySQLConnection = {
  execute: jest.fn().mockResolvedValue([[], { affectedRows: 1, insertId: 1 }]),
  query: jest.fn().mockResolvedValue([[], { affectedRows: 1 }]),
  end: jest.fn().mockResolvedValue(undefined),
  ping: jest.fn().mockResolvedValue(undefined),
  release: jest.fn(),
};

export const mockMySQLPool = {
  execute: jest.fn().mockResolvedValue([[], { affectedRows: 1, insertId: 1 }]),
  query: jest.fn().mockResolvedValue([[], { affectedRows: 1 }]),
  end: jest.fn().mockResolvedValue(undefined),
  getConnection: jest.fn().mockResolvedValue(mockMySQLConnection),
};
