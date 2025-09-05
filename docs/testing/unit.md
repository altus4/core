---
title: Unit Testing Guide
description: Comprehensive guide to writing effective unit tests for Altus 4 services, controllers, and utilities.
---

# Unit Testing Guide

Comprehensive Unit Testing for Altus 4

This guide covers unit testing strategies, patterns, and best practices for testing individual components in isolation with proper mocking and test organization.

## Testing Philosophy

### Unit Testing Principles

1. **Isolation**: Test components in complete isolation from dependencies
2. **Fast Execution**: Unit tests should run quickly (< 1ms per test)
3. **Deterministic**: Tests should produce consistent results
4. **Single Responsibility**: Each test should verify one specific behavior
5. **Clear Intent**: Test names should clearly describe what is being tested

### Test Structure (AAA Pattern)

```typescript
describe('ComponentName', () => {
  describe('methodName', () => {
    it('should do something when condition is met', () => {
      // Arrange - Set up test data and mocks
      const input = 'test input';
      const expectedOutput = 'expected result';

      // Act - Execute the code under test
      const result = component.methodName(input);

      // Assert - Verify the results
      expect(result).toBe(expectedOutput);
    });
  });
});
```

## Testing Setup

### Jest Configuration

```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['<rootDir>/tests/unit/**/*.test.ts', '<rootDir>/src/**/__tests__/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/**/__tests__/**', '!src/index.ts'],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
```

### Test Setup File

```typescript
// tests/setup.ts
import 'jest-extended';

// Global test configuration
beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error';
});

// Mock external dependencies globally
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn(),
  },
}));

// Custom matchers
expect.extend({
  toBeValidUUID(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);

    return {
      message: () => `expected ${received} to be a valid UUID`,
      pass,
    };
  },
});
```

## Service Testing

### Testing SearchService

```typescript
// tests/unit/services/SearchService.test.ts
import { SearchService } from '@/services/SearchService';
import { DatabaseService } from '@/services/DatabaseService';
import { AIService } from '@/services/AIService';
import { CacheService } from '@/services/CacheService';
import { Logger } from 'winston';

// Mock all dependencies
jest.mock('@/services/DatabaseService');
jest.mock('@/services/AIService');
jest.mock('@/services/CacheService');

describe('SearchService', () => {
  let searchService: SearchService;
  let mockDatabaseService: jest.Mocked<DatabaseService>;
  let mockAIService: jest.Mocked<AIService>;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    // Create typed mocks
    mockDatabaseService = {
      executeFullTextSearch: jest.fn(),
      getUserDatabases: jest.fn(),
      testConnection: jest.fn(),
      getConnectionPool: jest.fn(),
    } as any;

    mockAIService = {
      isAvailable: jest.fn(),
      processSearchQuery: jest.fn(),
      enhanceResults: jest.fn(),
      categorizeResults: jest.fn(),
    } as any;

    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      logSearchAnalytics: jest.fn(),
    } as any;

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;

    // Initialize service with mocks
    searchService = new SearchService(
      mockDatabaseService,
      mockAIService,
      mockCacheService,
      mockLogger
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('search', () => {
    const validSearchRequest = {
      query: 'mysql performance optimization',
      databases: ['db-uuid-1'],
      userId: 'user-uuid-1',
      searchMode: 'natural' as const,
      limit: 20,
      offset: 0,
    };

    it('should return cached results when available', async () => {
      // Arrange
      const cachedResults = {
        results: [
          {
            id: 'result-1',
            database: 'db-uuid-1',
            table: 'articles',
            data: { title: 'Cached Article', content: 'Content' },
            relevanceScore: 0.95,
            snippet: 'Cached snippet',
          },
        ],
        totalCount: 1,
        executionTime: 50,
      };

      mockCacheService.get.mockResolvedValue(cachedResults);

      // Act
      const result = await searchService.search(validSearchRequest);

      // Assert
      expect(result).toBe(cachedResults);
      expect(mockCacheService.get).toHaveBeenCalledWith(expect.stringMatching(/^search:/));
      expect(mockDatabaseService.executeFullTextSearch).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Cache hit for query: mysql performance optimization'
      );
    });

    it('should execute database search when cache miss', async () => {
      // Arrange
      const dbResults = [
        {
          id: 1,
          title: 'MySQL Performance Guide',
          content: 'Comprehensive guide to MySQL optimization',
          table: 'articles',
        },
      ];

      mockCacheService.get.mockResolvedValue(null);
      mockDatabaseService.executeFullTextSearch.mockResolvedValue(dbResults);
      mockAIService.isAvailable.mockReturnValue(false);

      // Act
      const result = await searchService.search(validSearchRequest);

      // Assert
      expect(result.results).toHaveLength(1);
      expect(result.results[0]).toMatchObject({
        id: 'db-uuid-1_articles_0',
        database: 'db-uuid-1',
        table: 'articles',
        data: dbResults[0],
        relevanceScore: expect.any(Number),
        snippet: expect.any(String),
      });

      expect(mockDatabaseService.executeFullTextSearch).toHaveBeenCalledWith(
        'db-uuid-1',
        'mysql performance optimization',
        [],
        undefined,
        20,
        0
      );

      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.stringMatching(/^search:/),
        expect.objectContaining({
          results: expect.any(Array),
          totalCount: 1,
        }),
        300
      );
    });

    it('should use AI processing when semantic mode is enabled', async () => {
      // Arrange
      const semanticRequest = {
        ...validSearchRequest,
        searchMode: 'semantic' as const,
      };

      const processedQuery = {
        optimizedQuery: 'mysql database performance optimization tuning',
        confidence: 0.9,
      };

      mockCacheService.get.mockResolvedValue(null);
      mockAIService.isAvailable.mockReturnValue(true);
      mockAIService.processSearchQuery.mockResolvedValue(processedQuery);
      mockDatabaseService.executeFullTextSearch.mockResolvedValue([]);

      // Act
      await searchService.search(semanticRequest);

      // Assert
      expect(mockAIService.processSearchQuery).toHaveBeenCalledWith(
        'mysql performance optimization'
      );
      expect(mockDatabaseService.executeFullTextSearch).toHaveBeenCalledWith(
        'db-uuid-1',
        'mysql database performance optimization tuning',
        [],
        undefined,
        20,
        0
      );
    });

    it('should handle multiple databases in parallel', async () => {
      // Arrange
      const multiDbRequest = {
        ...validSearchRequest,
        databases: ['db-uuid-1', 'db-uuid-2', 'db-uuid-3'],
      };

      mockCacheService.get.mockResolvedValue(null);
      mockAIService.isAvailable.mockReturnValue(false);

      // Mock different results for each database
      mockDatabaseService.executeFullTextSearch
        .mockResolvedValueOnce([{ id: 1, title: 'Result 1', table: 'articles' }])
        .mockResolvedValueOnce([{ id: 2, title: 'Result 2', table: 'posts' }])
        .mockResolvedValueOnce([{ id: 3, title: 'Result 3', table: 'docs' }]);

      // Act
      const result = await searchService.search(multiDbRequest);

      // Assert
      expect(result.results).toHaveLength(3);
      expect(mockDatabaseService.executeFullTextSearch).toHaveBeenCalledTimes(3);

      // Verify parallel execution (all calls should have been made)
      expect(mockDatabaseService.executeFullTextSearch).toHaveBeenNthCalledWith(
        1,
        'db-uuid-1',
        expect.any(String),
        [],
        undefined,
        20,
        0
      );
      expect(mockDatabaseService.executeFullTextSearch).toHaveBeenNthCalledWith(
        2,
        'db-uuid-2',
        expect.any(String),
        [],
        undefined,
        20,
        0
      );
      expect(mockDatabaseService.executeFullTextSearch).toHaveBeenNthCalledWith(
        3,
        'db-uuid-3',
        expect.any(String),
        [],
        undefined,
        20,
        0
      );
    });

    it('should handle database failures gracefully', async () => {
      // Arrange
      const multiDbRequest = {
        ...validSearchRequest,
        databases: ['db-uuid-1', 'db-uuid-2'],
      };

      mockCacheService.get.mockResolvedValue(null);
      mockAIService.isAvailable.mockReturnValue(false);

      // First database succeeds, second fails
      mockDatabaseService.executeFullTextSearch
        .mockResolvedValueOnce([{ id: 1, title: 'Success', table: 'articles' }])
        .mockRejectedValueOnce(new Error('Database connection failed'));

      // Act
      const result = await searchService.search(multiDbRequest);

      // Assert
      expect(result.results).toHaveLength(1);
      expect(result.results[0].data.title).toBe('Success');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Search failed for database db-uuid-2:',
        expect.any(Error)
      );
    });

    it('should validate search request parameters', async () => {
      // Arrange
      const invalidRequest = {
        query: '', // Empty query
        databases: [],
        userId: 'user-uuid-1',
      };

      // Act & Assert
      await expect(searchService.search(invalidRequest as any)).rejects.toThrow('Search failed');

      expect(mockLogger.error).toHaveBeenCalledWith('Search execution failed:', expect.any(Error));
    });

    it('should generate consistent cache keys', () => {
      // Arrange
      const request1 = {
        query: 'test query',
        databases: ['db1', 'db2'],
        searchMode: 'natural' as const,
        limit: 20,
        offset: 0,
      };

      const request2 = {
        query: 'TEST QUERY', // Different case
        databases: ['db2', 'db1'], // Different order
        searchMode: 'natural' as const,
        limit: 20,
        offset: 0,
      };

      // Act
      const key1 = (searchService as any).generateCacheKey(request1);
      const key2 = (searchService as any).generateCacheKey(request2);

      // Assert
      expect(key1).toBe(key2); // Should be identical
      expect(key1).toMatch(/^search:/);
    });
  });

  describe('calculateRelevanceScore', () => {
    it('should calculate higher scores for exact phrase matches', () => {
      // Arrange
      const row = {
        title: 'MySQL Performance Optimization Guide',
        content: 'This guide covers mysql performance optimization techniques',
      };
      const query = 'mysql performance optimization';

      // Act
      const score = (searchService as any).calculateRelevanceScore(row, query);

      // Assert
      expect(score).toBeGreaterThan(0.5);
      expect(score).toBeLessThanOrEqual(1.0);
    });

    it('should give bonus points for title matches', () => {
      // Arrange
      const rowWithTitleMatch = {
        title: 'MySQL Performance Guide',
        content: 'Database content',
      };

      const rowWithContentMatch = {
        title: 'Database Guide',
        content: 'MySQL Performance content',
      };

      const query = 'mysql performance';

      // Act
      const titleScore = (searchService as any).calculateRelevanceScore(rowWithTitleMatch, query);
      const contentScore = (searchService as any).calculateRelevanceScore(
        rowWithContentMatch,
        query
      );

      // Assert
      expect(titleScore).toBeGreaterThan(contentScore);
    });

    it('should return 0 for no matches', () => {
      // Arrange
      const row = {
        title: 'Unrelated Title',
        content: 'Completely different content',
      };
      const query = 'mysql performance';

      // Act
      const score = (searchService as any).calculateRelevanceScore(row, query);

      // Assert
      expect(score).toBe(0);
    });
  });

  describe('generateSnippet', () => {
    it('should generate snippet from content containing query terms', () => {
      // Arrange
      const row = {
        title: 'Database Guide',
        content:
          'This comprehensive guide covers MySQL performance optimization techniques including indexing, query optimization, and server configuration. Learn how to improve your database performance.',
      };
      const query = 'mysql performance';

      // Act
      const snippet = (searchService as any).generateSnippet(row, query);

      // Assert
      expect(snippet).toContain('MySQL performance optimization');
      expect(snippet.length).toBeLessThanOrEqual(203); // 200 + '...'
    });

    it('should fallback to first text field when no matches', () => {
      // Arrange
      const row = {
        title: 'Database Guide',
        content: 'Some content without the search terms',
        description: 'A description field',
      };
      const query = 'nonexistent terms';

      // Act
      const snippet = (searchService as any).generateSnippet(row, query);

      // Assert
      expect(snippet).toBe('Database Guide');
    });

    it('should return empty string for empty row', () => {
      // Arrange
      const row = {};
      const query = 'any query';

      // Act
      const snippet = (searchService as any).generateSnippet(row, query);

      // Assert
      expect(snippet).toBe('');
    });
  });
});
```

### Testing Utilities and Helpers

```typescript
// tests/unit/utils/encryption.test.ts
import { EncryptionService } from '@/utils/encryption';
import crypto from 'crypto';

// Mock crypto module
jest.mock('crypto');

describe('EncryptionService', () => {
  let encryptionService: EncryptionService;
  let mockCrypto: jest.Mocked<typeof crypto>;

  beforeEach(() => {
    mockCrypto = crypto as jest.Mocked<typeof crypto>;
    encryptionService = new EncryptionService();

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('encrypt', () => {
    it('should encrypt data with random salt and IV', async () => {
      // Arrange
      const plaintext = 'sensitive data';
      const mockSalt = Buffer.from('mock-salt-32-bytes-long-for-test');
      const mockIV = Buffer.from('mock-iv-16-bytes');
      const mockKey = Buffer.from('mock-key-32-bytes-long-for-test');
      const mockEncrypted = Buffer.from('encrypted-data');
      const mockAuthTag = Buffer.from('auth-tag');

      const mockCipher = {
        update: jest.fn().mockReturnValue(Buffer.from('partial')),
        final: jest.fn().mockReturnValue(Buffer.from('final')),
        getAuthTag: jest.fn().mockReturnValue(mockAuthTag),
      };

      mockCrypto.randomBytes.mockReturnValueOnce(mockSalt).mockReturnValueOnce(mockIV);

      mockCrypto.pbkdf2Sync.mockReturnValue(mockKey);
      mockCrypto.createCipher.mockReturnValue(mockCipher as any);

      // Act
      const result = await encryptionService.encrypt(plaintext);

      // Assert
      expect(result).toMatchObject({
        encryptedData: expect.any(String),
        salt: expect.any(String),
        iv: expect.any(String),
        authTag: expect.any(String),
        algorithm: 'aes-256-gcm',
      });

      expect(mockCrypto.randomBytes).toHaveBeenCalledWith(32); // salt
      expect(mockCrypto.randomBytes).toHaveBeenCalledWith(16); // IV
      expect(mockCrypto.pbkdf2Sync).toHaveBeenCalledWith(
        expect.any(String), // master key
        mockSalt,
        100000,
        32,
        'sha256'
      );
    });

    it('should handle encryption errors', async () => {
      // Arrange
      const plaintext = 'test data';
      mockCrypto.randomBytes.mockImplementation(() => {
        throw new Error('Crypto error');
      });

      // Act & Assert
      await expect(encryptionService.encrypt(plaintext)).rejects.toThrow('Encryption failed');
    });
  });

  describe('decrypt', () => {
    it('should decrypt data with correct parameters', async () => {
      // Arrange
      const encryptedData = {
        encryptedData: Buffer.from('encrypted').toString('base64'),
        salt: Buffer.from('salt').toString('base64'),
        iv: Buffer.from('iv').toString('base64'),
        authTag: Buffer.from('tag').toString('base64'),
        algorithm: 'aes-256-gcm',
      };

      const mockKey = Buffer.from('mock-key');
      const mockDecipher = {
        setAuthTag: jest.fn(),
        update: jest.fn().mockReturnValue(Buffer.from('decrypted')),
        final: jest.fn().mockReturnValue(Buffer.from('data')),
      };

      mockCrypto.pbkdf2Sync.mockReturnValue(mockKey);
      mockCrypto.createDecipher.mockReturnValue(mockDecipher as any);

      // Act
      const result = await encryptionService.decrypt(encryptedData);

      // Assert
      expect(result).toBe('decrypteddata');
      expect(mockDecipher.setAuthTag).toHaveBeenCalledWith(Buffer.from('tag', 'base64'));
    });

    it('should handle decryption errors', async () => {
      // Arrange
      const invalidData = {
        encryptedData: 'invalid',
        salt: 'invalid',
        iv: 'invalid',
        authTag: 'invalid',
        algorithm: 'aes-256-gcm',
      };

      mockCrypto.pbkdf2Sync.mockImplementation(() => {
        throw new Error('Invalid data');
      });

      // Act & Assert
      await expect(encryptionService.decrypt(invalidData)).rejects.toThrow('Decryption failed');
    });
  });
});
```

## Controller Testing

### Testing Express Controllers

```typescript
// tests/unit/controllers/SearchController.test.ts
import { SearchController } from '@/controllers/SearchController';
import { SearchService } from '@/services/SearchService';
import { Request, Response } from 'express';
import { Logger } from 'winston';

describe('SearchController', () => {
  let searchController: SearchController;
  let mockSearchService: jest.Mocked<SearchService>;
  let mockLogger: jest.Mocked<Logger>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockSearchService = {
      search: jest.fn(),
      getSuggestions: jest.fn(),
    } as any;

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;

    mockRequest = {
      body: {},
      user: { id: 'user-uuid-1', email: 'test@example.com' },
      apiKey: { id: 'key-uuid-1', permissions: ['search'] },
      id: 'req-uuid-1',
    };

    mockResponse = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    searchController = new SearchController(mockSearchService, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('search', () => {
    it('should return search results for valid request', async () => {
      // Arrange
      mockRequest.body = {
        query: 'mysql performance',
        databases: ['db-uuid-1'],
        searchMode: 'natural',
        limit: 20,
      };

      const mockResults = {
        results: [
          {
            id: 'result-1',
            data: { title: 'MySQL Guide' },
            relevanceScore: 0.9,
          },
        ],
        totalCount: 1,
        executionTime: 150,
      };

      mockSearchService.search.mockResolvedValue(mockResults);

      // Act
      await searchController.search(mockRequest as any, mockResponse as any);

      // Assert
      expect(mockSearchService.search).toHaveBeenCalledWith({
        query: 'mysql performance',
        databases: ['db-uuid-1'],
        searchMode: 'natural',
        limit: 20,
        offset: 0,
        userId: 'user-uuid-1',
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockResults,
        meta: {
          timestamp: expect.any(Date),
          requestId: 'req-uuid-1',
          version: expect.any(String),
          executionTime: expect.any(Number),
        },
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Search completed',
        expect.objectContaining({
          userId: 'user-uuid-1',
          query: 'mysql performance',
          resultCount: 1,
        })
      );
    });

    it('should handle validation errors', async () => {
      // Arrange
      mockRequest.body = {
        query: '', // Invalid empty query
        databases: ['db-uuid-1'],
      };

      const validationError = new ValidationError('Query cannot be empty', 'query');
      mockSearchService.search.mockRejectedValue(validationError);

      // Act
      await searchController.search(mockRequest as any, mockResponse as any);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Query cannot be empty',
          field: 'query',
        },
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Search request failed',
        expect.objectContaining({
          error: 'Query cannot be empty',
          userId: 'user-uuid-1',
        })
      );
    });

    it('should handle service errors', async () => {
      // Arrange
      mockRequest.body = {
        query: 'valid query',
        databases: ['db-uuid-1'],
      };

      const serviceError = new Error('Database connection failed');
      mockSearchService.search.mockRejectedValue(serviceError);

      // Act
      await searchController.search(mockRequest as any, mockResponse as any);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
      });
    });

    it('should apply default values for optional parameters', async () => {
      // Arrange
      mockRequest.body = {
        query: 'test query',
        databases: ['db-uuid-1'],
        // No searchMode, limit, or offset
      };

      mockSearchService.search.mockResolvedValue({
        results: [],
        totalCount: 0,
        executionTime: 50,
      });

      // Act
      await searchController.search(mockRequest as any, mockResponse as any);

      // Assert
      expect(mockSearchService.search).toHaveBeenCalledWith({
        query: 'test query',
        databases: ['db-uuid-1'],
        searchMode: 'natural', // Default value
        limit: 20, // Default value
        offset: 0, // Default value
        userId: 'user-uuid-1',
      });
    });

    it('should enforce maximum limit', async () => {
      // Arrange
      mockRequest.body = {
        query: 'test query',
        databases: ['db-uuid-1'],
        limit: 500, // Exceeds maximum
      };

      mockSearchService.search.mockResolvedValue({
        results: [],
        totalCount: 0,
        executionTime: 50,
      });

      // Act
      await searchController.search(mockRequest as any, mockResponse as any);

      // Assert
      expect(mockSearchService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 100, // Should be capped at maximum
        })
      );
    });
  });
});
```

## Mock Strategies

### Creating Effective Mocks

```typescript
// tests/helpers/mocks.ts

// Factory functions for creating consistent mocks
export const createMockUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-uuid-1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'user',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
});

export const createMockApiKey = (overrides: Partial<ApiKey> = {}): ApiKey => ({
  id: 'key-uuid-1',
  userId: 'user-uuid-1',
  keyPrefix: 'altus4_sk_test_abc123',
  name: 'Test API Key',
  environment: 'test',
  permissions: ['search'],
  rateLimitTier: 'free',
  isActive: true,
  createdAt: new Date('2024-01-01'),
  ...overrides,
});

export const createMockSearchResult = (overrides: Partial<SearchResult> = {}): SearchResult => ({
  id: 'result-uuid-1',
  database: 'db-uuid-1',
  table: 'articles',
  data: {
    id: 1,
    title: 'Test Article',
    content: 'Test content',
    author: 'Test Author',
  },
  relevanceScore: 0.85,
  snippet: 'Test snippet with highlighted terms',
  matchedColumns: ['title', 'content'],
  categories: [],
  ...overrides,
});

// Mock builders for complex scenarios
export class MockSearchServiceBuilder {
  private mockService: jest.Mocked<SearchService>;

  constructor() {
    this.mockService = {
      search: jest.fn(),
      getSuggestions: jest.fn(),
      analyzeQuery: jest.fn(),
    } as any;
  }

  withSuccessfulSearch(results: SearchResult[] = []) {
    this.mockService.search.mockResolvedValue({
      results,
      totalCount: results.length,
      executionTime: 150,
      categories: [],
      suggestions: [],
    });
    return this;
  }

  withFailedSearch(error: Error) {
    this.mockService.search.mockRejectedValue(error);
    return this;
  }

  withCachedResults() {
    this.mockService.search.mockResolvedValue({
      results: [createMockSearchResult()],
      totalCount: 1,
      executionTime: 25, // Fast execution indicates cache hit
      categories: [],
      suggestions: [],
      cached: true,
    });
    return this;
  }

  build(): jest.Mocked<SearchService> {
    return this.mockService;
  }
}

// Usage in tests
describe('SearchController with Mock Builder', () => {
  it('should handle successful search', async () => {
    // Arrange
    const mockService = new MockSearchServiceBuilder()
      .withSuccessfulSearch([createMockSearchResult()])
      .build();

    const controller = new SearchController(mockService, mockLogger);

    // Act & Assert
    // ... test implementation
  });
});
```

### Testing Async Operations

```typescript
// tests/unit/services/AsyncOperations.test.ts
describe('Async Operations', () => {
  it('should handle concurrent operations', async () => {
    // Arrange
    const mockPromises = [
      Promise.resolve('result1'),
      Promise.resolve('result2'),
      Promise.resolve('result3'),
    ];

    const mockService = {
      operation1: jest.fn().mockResolvedValue('result1'),
      operation2: jest.fn().mockResolvedValue('result2'),
      operation3: jest.fn().mockResolvedValue('result3'),
    };

    // Act
    const results = await Promise.all([
      mockService.operation1(),
      mockService.operation2(),
      mockService.operation3(),
    ]);

    // Assert
    expect(results).toEqual(['result1', 'result2', 'result3']);
    expect(mockService.operation1).toHaveBeenCalledTimes(1);
    expect(mockService.operation2).toHaveBeenCalledTimes(1);
    expect(mockService.operation3).toHaveBeenCalledTimes(1);
  });

  it('should handle partial failures with Promise.allSettled', async () => {
    // Arrange
    const mockService = {
      operation1: jest.fn().mockResolvedValue('success'),
      operation2: jest.fn().mockRejectedValue(new Error('failure')),
      operation3: jest.fn().mockResolvedValue('success'),
    };

    // Act
    const results = await Promise.allSettled([
      mockService.operation1(),
      mockService.operation2(),
      mockService.operation3(),
    ]);

    // Assert
    expect(results).toHaveLength(3);
    expect(results[0]).toMatchObject({ status: 'fulfilled', value: 'success' });
    expect(results[1]).toMatchObject({
      status: 'rejected',
      reason: expect.any(Error),
    });
    expect(results[2]).toMatchObject({ status: 'fulfilled', value: 'success' });
  });

  it('should handle timeouts', async () => {
    // Arrange
    const slowOperation = jest
      .fn()
      .mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), 500)
    );

    // Act & Assert
    await expect(Promise.race([slowOperation(), timeoutPromise])).rejects.toThrow('Timeout');
  });
});
```

## Test Data Management

### Fixtures and Test Data

```typescript
// tests/fixtures/search-data.ts
export const searchFixtures = {
  validSearchRequests: [
    {
      query: 'mysql performance optimization',
      databases: ['db-uuid-1'],
      searchMode: 'natural' as const,
      limit: 20,
    },
    {
      query: 'database indexing strategies',
      databases: ['db-uuid-1', 'db-uuid-2'],
      searchMode: 'semantic' as const,
      limit: 15,
    },
  ],

  invalidSearchRequests: [
    {
      query: '', // Empty query
      databases: ['db-uuid-1'],
    },
    {
      query: 'valid query',
      databases: [], // Empty databases
    },
    {
      query: 'a'.repeat(1001), // Too long query
      databases: ['db-uuid-1'],
    },
  ],

  mockDatabaseResults: [
    {
      id: 1,
      title: 'MySQL Performance Tuning Guide',
      content: 'Comprehensive guide to MySQL performance optimization...',
      author: 'Database Expert',
      published_at: '2024-01-15T10:00:00Z',
      table: 'articles',
    },
    {
      id: 2,
      title: 'Advanced Indexing Strategies',
      content: 'Learn about B-tree indexes, composite indexes...',
      author: 'Index Specialist',
      published_at: '2024-01-10T15:30:00Z',
      table: 'tutorials',
    },
  ],
};

// Usage in tests
import { searchFixtures } from '../fixtures/search-data';

describe('SearchService with Fixtures', () => {
  it('should handle valid search requests', async () => {
    const validRequest = searchFixtures.validSearchRequests[0];
    // Use fixture data in test
  });
});
```

## Coverage and Quality

### Coverage Configuration

```javascript
// jest.config.js - Coverage settings
module.exports = {
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/index.ts',
    '!src/config/**', // Exclude configuration files
  ],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    // Per-file thresholds for critical components
    'src/services/SearchService.ts': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
  },
  coverageReporters: ['text', 'lcov', 'html'],
  coverageDirectory: 'coverage',
};
```

### Running Tests

```bash
# Run all unit tests
npm run test:unit

# Run tests with coverage
npm run test:unit -- --coverage

# Run tests in watch mode
npm run test:unit -- --watch

# Run specific test file
npm run test:unit -- SearchService.test.ts

# Run tests matching pattern
npm run test:unit -- --testNamePattern="should handle cache"

# Generate coverage report
npm run test:unit -- --coverage --coverageReporters=html
```

## Best Practices Summary

### Do's

- ✅ Test one thing at a time
- ✅ Use descriptive test names
- ✅ Follow AAA pattern (Arrange, Act, Assert)
- ✅ Mock all external dependencies
- ✅ Use factory functions for test data
- ✅ Test both success and failure scenarios
- ✅ Maintain high test coverage (>90%)
- ✅ Keep tests fast and independent

### Don'ts

- ❌ Test implementation details
- ❌ Write tests that depend on each other
- ❌ Use real external services in unit tests
- ❌ Ignore edge cases and error conditions
- ❌ Write overly complex test setup
- ❌ Test framework code (Express, Jest, etc.)
- ❌ Duplicate test logic across files

## Related Documentation

- **[Integration Testing](./integration.md)** - Testing component interactions
- **[Performance Testing](./performance.md)** - Load and performance testing
- **[Testing Overview](./index.md)** - Complete testing strategy
- **[Development Standards](../development/standards.md)** - Code quality standards

---

**Unit tests form the foundation of code quality in Altus 4. Follow these patterns and practices to ensure reliable, maintainable test suites.**
