---
title: Code Standards & Guidelines
description: Comprehensive coding standards, style guidelines, and best practices for Altus 4 development.
---

# Code Standards & Guidelines

Comprehensive Development Standards for Altus 4

This document outlines the coding standards, style guidelines, and best practices that all contributors to Altus 4 must follow to ensure code quality, maintainability, and consistency.

## General Principles

### 1. Code Quality Principles

- **Readability First**: Code is read more often than it's written
- **Consistency**: Follow established patterns throughout the codebase
- **Simplicity**: Prefer simple, clear solutions over clever ones
- **Documentation**: Code should be self-documenting with clear naming
- **Testing**: All code must be thoroughly tested

### 2. SOLID Principles

- **Single Responsibility**: Each class/function should have one reason to change
- **Open/Closed**: Open for extension, closed for modification
- **Liskov Substitution**: Derived classes must be substitutable for base classes
- **Interface Segregation**: Clients shouldn't depend on interfaces they don't use
- **Dependency Inversion**: Depend on abstractions, not concretions

## TypeScript Standards

### File Organization

```
src/
├── controllers/          # HTTP request handlers
├── services/            # Business logic layer
├── middleware/          # Express middleware
├── routes/             # Route definitions
├── types/              # Type definitions
├── utils/              # Utility functions
├── config/             # Configuration files
└── __tests__/          # Test files
```

### Naming Conventions

```typescript
// Classes: PascalCase
class SearchService {
  // Private properties: underscore prefix
  private _connectionPool: ConnectionPool;

  // Public properties: camelCase
  public isConnected: boolean;

  // Methods: camelCase with descriptive names
  async executeFullTextSearch(query: string): Promise<SearchResult[]> {
    // Implementation
  }

  // Private methods: underscore prefix
  private _validateQuery(query: string): boolean {
    // Implementation
  }
}

// Interfaces: PascalCase with 'I' prefix for internal interfaces
interface ISearchService {
  search(query: string): Promise<SearchResult[]>;
}

// Types: PascalCase
type SearchMode = 'natural' | 'boolean' | 'semantic';

// Constants: SCREAMING_SNAKE_CASE
const MAX_SEARCH_RESULTS = 100;
const DEFAULT_TIMEOUT = 30000;

// Variables and functions: camelCase
const searchResults = await searchService.executeSearch(query);
const isValidQuery = validateSearchQuery(query);

// File names: kebab-case
// search-service.ts
// database-connection.ts
// api-key-middleware.ts
```

### Type Definitions

```typescript
// Always use explicit types for public APIs
interface SearchRequest {
  query: string;
  databases: string[];
  searchMode?: SearchMode;
  limit?: number;
  offset?: number;
}

// Use strict typing for responses
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta: {
    timestamp: Date;
    requestId: string;
    version: string;
  };
}

// Use branded types for IDs to prevent mixing
type UserId = string & { readonly brand: unique symbol };
type DatabaseId = string & { readonly brand: unique symbol };

// Use discriminated unions for complex types
type SearchResult =
  | { type: 'document'; content: string; title: string }
  | { type: 'image'; url: string; alt: string }
  | { type: 'video'; url: string; duration: number };

// Use utility types appropriately
type PartialSearchRequest = Partial<SearchRequest>;
type RequiredSearchRequest = Required<SearchRequest>;
type SearchRequestKeys = keyof SearchRequest;
```

### Error Handling

```typescript
// Custom error classes with proper inheritance
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR',
    public isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    public field?: string
  ) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class DatabaseError extends AppError {
  constructor(
    message: string,
    public query?: string
  ) {
    super(message, 500, 'DATABASE_ERROR');
  }
}

// Proper error handling in services
export class SearchService {
  async search(request: SearchRequest): Promise<SearchResponse> {
    try {
      // Validate input
      this.validateSearchRequest(request);

      // Execute search
      const results = await this.executeSearch(request);

      return {
        success: true,
        data: results,
      };
    } catch (error) {
      // Log error with context
      this.logger.error('Search failed', {
        request,
        error: error.message,
        stack: error.stack,
      });

      // Re-throw with proper error type
      if (error instanceof ValidationError) {
        throw error;
      }

      throw new AppError('Search operation failed', 500, 'SEARCH_ERROR');
    }
  }

  private validateSearchRequest(request: SearchRequest): void {
    if (!request.query?.trim()) {
      throw new ValidationError('Query cannot be empty', 'query');
    }

    if (!request.databases?.length) {
      throw new ValidationError('At least one database must be specified', 'databases');
    }
  }
}
```

### Async/Await Standards

```typescript
// Always use async/await over Promises
// Good
async function fetchUserData(userId: string): Promise<User> {
  try {
    const user = await userRepository.findById(userId);
    const profile = await profileService.getProfile(userId);

    return { ...user, profile };
  } catch (error) {
    logger.error('Failed to fetch user data', { userId, error });
    throw error;
  }
}

// Avoid - using .then()/.catch()
function fetchUserDataBad(userId: string): Promise<User> {
  return userRepository
    .findById(userId)
    .then(user => profileService.getProfile(userId).then(profile => ({ ...user, profile })))
    .catch(error => {
      logger.error('Failed to fetch user data', { userId, error });
      throw error;
    });
}

// Handle concurrent operations properly
async function fetchMultipleResources(): Promise<CombinedData> {
  // Use Promise.all for concurrent operations
  const [users, databases, analytics] = await Promise.all([
    userService.getAllUsers(),
    databaseService.getAllDatabases(),
    analyticsService.getMetrics(),
  ]);

  return { users, databases, analytics };
}

// Use Promise.allSettled for operations that can fail independently
async function fetchWithPartialFailure(): Promise<PartialResults> {
  const results = await Promise.allSettled([
    riskyOperation1(),
    riskyOperation2(),
    riskyOperation3(),
  ]);

  const successful = results
    .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
    .map(result => result.value);

  const failed = results
    .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    .map(result => result.reason);

  return { successful, failed };
}
```

## Database Standards

### Query Organization

```typescript
// Organize queries in dedicated files
// src/queries/user-queries.ts
export const UserQueries = {
  findById: `
    SELECT id, name, email, created_at, updated_at
    FROM users
    WHERE id = ?
  `,

  findByEmail: `
    SELECT id, name, email, created_at, updated_at
    FROM users
    WHERE email = ? AND is_active = true
  `,

  createUser: `
    INSERT INTO users (id, name, email, password, created_at)
    VALUES (?, ?, ?, ?, NOW())
  `,

  updateUser: `
    UPDATE users
    SET name = ?, email = ?, updated_at = NOW()
    WHERE id = ?
  `,
} as const;

// Use parameterized queries always
export class UserRepository {
  async findById(id: string): Promise<User | null> {
    const [rows] = await this.connection.execute(UserQueries.findById, [id]);

    return rows.length > 0 ? this.mapRowToUser(rows[0]) : null;
  }

  // Never use string concatenation for queries
  // BAD - SQL injection risk
  async findByEmailBad(email: string): Promise<User | null> {
    const query = `SELECT * FROM users WHERE email = '${email}'`;
    // This is vulnerable to SQL injection!
  }
}
```

### Migration Standards

```sql
-- migrations/001_create_users_table.up.sql
-- Always include descriptive comments
-- Use consistent naming conventions

CREATE TABLE users (
  -- Use UUIDs for primary keys
  id CHAR(36) PRIMARY KEY,

  -- Use descriptive column names
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,

  -- Always include audit fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Add indexes for common queries
  INDEX idx_email (email),
  INDEX idx_created_at (created_at)
);

-- Add constraints with descriptive names
ALTER TABLE users
ADD CONSTRAINT chk_email_format
CHECK (email REGEXP '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
```

## API Standards

### Route Organization

```typescript
// src/routes/search.ts
import { Router } from 'express';
import { SearchController } from '../controllers/SearchController';
import { authenticateApiKey } from '../middleware/auth';
import { validateSearchRequest } from '../middleware/validation';
import { rateLimiter } from '../middleware/rateLimiter';

const router = Router();
const searchController = new SearchController();

// Apply middleware in logical order
router.use(authenticateApiKey);
router.use(rateLimiter);

// Use descriptive route names and consistent patterns
router.post('/search', validateSearchRequest, searchController.search.bind(searchController));

router.get('/search/suggestions', searchController.getSuggestions.bind(searchController));

router.get('/search/history', searchController.getHistory.bind(searchController));

export { router as searchRoutes };
```

### Controller Standards

```typescript
// src/controllers/SearchController.ts
export class SearchController {
  constructor(
    private searchService: SearchService,
    private logger: Logger
  ) {}

  // Use consistent method signatures
  async search(req: ApiKeyAuthenticatedRequest, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      // Extract and validate request data
      const searchRequest = this.extractSearchRequest(req);

      // Execute business logic
      const results = await this.searchService.search(searchRequest);

      // Log successful operations
      this.logger.info('Search completed', {
        userId: req.user.id,
        query: searchRequest.query,
        resultCount: results.totalCount,
        executionTime: Date.now() - startTime,
      });

      // Return consistent response format
      res.json({
        success: true,
        data: results,
        meta: {
          timestamp: new Date(),
          requestId: req.id,
          version: process.env.API_VERSION || '1.0.0',
          executionTime: Date.now() - startTime,
        },
      });
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private extractSearchRequest(req: ApiKeyAuthenticatedRequest): SearchRequest {
    return {
      query: req.body.query,
      databases: req.body.databases || [],
      searchMode: req.body.searchMode || 'natural',
      limit: Math.min(req.body.limit || 20, 100),
      offset: req.body.offset || 0,
      userId: req.user.id,
    };
  }

  private handleError(error: Error, req: Request, res: Response): void {
    // Log error with context
    this.logger.error('Search request failed', {
      error: error.message,
      stack: error.stack,
      userId: (req as any).user?.id,
      body: req.body,
    });

    // Return appropriate error response
    if (error instanceof ValidationError) {
      res.status(400).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          field: error.field,
        },
      });
    } else if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    } else {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
      });
    }
  }
}
```

## Testing Standards

### Test Organization

```
tests/
├── unit/                 # Unit tests
│   ├── services/
│   ├── controllers/
│   └── utils/
├── integration/          # Integration tests
│   ├── api/
│   └── database/
├── performance/          # Performance tests
├── fixtures/            # Test data
└── helpers/             # Test utilities
```

### Unit Test Standards

```typescript
// tests/unit/services/SearchService.test.ts
import { SearchService } from '../../../src/services/SearchService';
import { DatabaseService } from '../../../src/services/DatabaseService';
import { AIService } from '../../../src/services/AIService';
import { CacheService } from '../../../src/services/CacheService';

describe('SearchService', () => {
  let searchService: SearchService;
  let mockDatabaseService: jest.Mocked<DatabaseService>;
  let mockAIService: jest.Mocked<AIService>;
  let mockCacheService: jest.Mocked<CacheService>;

  beforeEach(() => {
    // Create mocks
    mockDatabaseService = {
      executeFullTextSearch: jest.fn(),
      getUserDatabases: jest.fn(),
      testConnection: jest.fn(),
    } as any;

    mockAIService = {
      isAvailable: jest.fn(),
      processSearchQuery: jest.fn(),
      enhanceResults: jest.fn(),
    } as any;

    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    } as any;

    // Initialize service with mocks
    searchService = new SearchService(mockDatabaseService, mockAIService, mockCacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('search', () => {
    it('should return cached results when available', async () => {
      // Arrange
      const searchRequest = {
        query: 'test query',
        databases: ['db1'],
        userId: 'user1',
      };
      const cachedResults = {
        results: [{ id: '1', title: 'Cached Result' }],
        totalCount: 1,
      };

      mockCacheService.get.mockResolvedValue(cachedResults);

      // Act
      const result = await searchService.search(searchRequest);

      // Assert
      expect(result).toBe(cachedResults);
      expect(mockCacheService.get).toHaveBeenCalledWith(expect.stringContaining('search:'));
      expect(mockDatabaseService.executeFullTextSearch).not.toHaveBeenCalled();
    });

    it('should execute database search when cache miss', async () => {
      // Arrange
      const searchRequest = {
        query: 'test query',
        databases: ['db1'],
        userId: 'user1',
      };
      const dbResults = [{ id: '1', title: 'DB Result', content: 'Content' }];

      mockCacheService.get.mockResolvedValue(null);
      mockDatabaseService.executeFullTextSearch.mockResolvedValue(dbResults);
      mockAIService.isAvailable.mockReturnValue(false);

      // Act
      const result = await searchService.search(searchRequest);

      // Assert
      expect(result.results).toHaveLength(1);
      expect(result.results[0].data.title).toBe('DB Result');
      expect(mockDatabaseService.executeFullTextSearch).toHaveBeenCalledWith(
        'db1',
        'test query',
        [],
        undefined,
        20,
        0
      );
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      const searchRequest = {
        query: 'test query',
        databases: ['db1'],
        userId: 'user1',
      };

      mockCacheService.get.mockResolvedValue(null);
      mockDatabaseService.executeFullTextSearch.mockRejectedValue(
        new Error('Database connection failed')
      );

      // Act & Assert
      await expect(searchService.search(searchRequest)).rejects.toThrow('Search failed');
    });
  });

  describe('generateCacheKey', () => {
    it('should generate consistent cache keys', () => {
      // Arrange
      const request1 = {
        query: 'test query',
        databases: ['db1', 'db2'],
        searchMode: 'natural' as const,
        limit: 20,
      };
      const request2 = {
        query: 'test query',
        databases: ['db2', 'db1'], // Different order
        searchMode: 'natural' as const,
        limit: 20,
      };

      // Act
      const key1 = (searchService as any).generateCacheKey(request1);
      const key2 = (searchService as any).generateCacheKey(request2);

      // Assert
      expect(key1).toBe(key2); // Should be same despite different order
      expect(key1).toMatch(/^search:/);
    });
  });
});
```

### Integration Test Standards

```typescript
// tests/integration/api/search.test.ts
import request from 'supertest';
import { app } from '../../../src/app';
import { setupTestDatabase, cleanupTestDatabase } from '../../helpers/database';
import { createTestUser, createTestApiKey } from '../../helpers/auth';

describe('Search API Integration', () => {
  let testApiKey: string;
  let testDatabaseId: string;

  beforeAll(async () => {
    await setupTestDatabase();

    const user = await createTestUser({
      email: 'test@example.com',
      name: 'Test User',
    });

    testApiKey = await createTestApiKey(user.id);
    testDatabaseId = await createTestDatabase({
      name: 'Test Database',
      userId: user.id,
    });
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('POST /api/search', () => {
    it('should return search results for valid request', async () => {
      const response = await request(app)
        .post('/api/search')
        .set('Authorization', `Bearer ${testApiKey}`)
        .send({
          query: 'test search',
          databases: [testDatabaseId],
          searchMode: 'natural',
          limit: 10,
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          results: expect.any(Array),
          totalCount: expect.any(Number),
          executionTime: expect.any(Number),
        },
        meta: {
          timestamp: expect.any(String),
          requestId: expect.any(String),
          version: expect.any(String),
        },
      });
    });

    it('should return 401 for missing API key', async () => {
      const response = await request(app)
        .post('/api/search')
        .send({
          query: 'test search',
          databases: [testDatabaseId],
        })
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'NO_API_KEY',
          message: expect.any(String),
        },
      });
    });

    it('should return 400 for invalid request data', async () => {
      const response = await request(app)
        .post('/api/search')
        .set('Authorization', `Bearer ${testApiKey}`)
        .send({
          // Missing required query field
          databases: [testDatabaseId],
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: expect.stringContaining('query'),
        },
      });
    });
  });
});
```

## Documentation Standards

### Code Documentation

````typescript
/**
 * Service for executing full-text searches across multiple MySQL databases
 * with AI-powered enhancements and intelligent caching.
 *
 * @example
 * ```typescript
 * const searchService = new SearchService(databaseService, aiService, cacheService)
 *
 * const results = await searchService.search({
 *   query: 'mysql performance optimization',
 *   databases: ['tech-docs-db'],
 *   searchMode: 'semantic',
 *   limit: 20
 * })
 * ```
 */
export class SearchService {
  /**
   * Execute a search across specified databases with optional AI enhancements.
   *
   * @param request - The search request parameters
   * @param request.query - The search query string (1-1000 characters)
   * @param request.databases - Array of database IDs to search
   * @param request.searchMode - Search mode: 'natural', 'boolean', or 'semantic'
   * @param request.limit - Maximum number of results (1-100, default: 20)
   * @param request.offset - Result offset for pagination (default: 0)
   *
   * @returns Promise resolving to search results with metadata
   *
   * @throws {ValidationError} When request parameters are invalid
   * @throws {DatabaseError} When database operations fail
   * @throws {AppError} When search execution fails
   *
   * @example
   * ```typescript
   * const results = await searchService.search({
   *   query: 'database optimization techniques',
   *   databases: ['docs-db', 'community-db'],
   *   searchMode: 'semantic',
   *   limit: 25
   * })
   *
   * console.log(`Found ${results.totalCount} results`)
   * ```
   */
  async search(request: SearchRequest): Promise<SearchResponse> {
    // Implementation
  }

  /**
   * Generate a deterministic cache key for search requests.
   *
   * The cache key includes normalized query, sorted database IDs,
   * and search parameters to ensure consistent caching.
   *
   * @private
   * @param request - The search request to generate key for
   * @returns Base64-encoded cache key
   */
  private generateCacheKey(request: SearchRequest): string {
    // Implementation
  }
}
````

### README Standards

Each module should have a comprehensive README:

````markdown
# SearchService

AI-enhanced full-text search service for MySQL databases.

## Overview

The SearchService orchestrates searches across multiple MySQL databases with optional AI enhancements, intelligent caching, and result aggregation.

## Features

- **Multi-database search** - Search across multiple databases simultaneously
- **AI enhancements** - Semantic search and query optimization with OpenAI
- **Intelligent caching** - Redis-based caching with smart TTL
- **Result aggregation** - Merge and rank results from multiple sources
- **Performance monitoring** - Built-in metrics and logging

## Usage

### Basic Search

```typescript
const searchService = new SearchService(databaseService, aiService, cacheService);

const results = await searchService.search({
  query: 'mysql performance optimization',
  databases: ['tech-docs-db'],
  searchMode: 'natural',
  limit: 20,
});
```
````

### Advanced Search with AI

```typescript
const results = await searchService.search({
  query: 'how to improve database performance',
  databases: ['docs-db', 'community-db'],
  searchMode: 'semantic', // AI-powered semantic search
  limit: 30,
  includeAnalytics: true,
});
```

## Configuration

| Option                  | Type    | Default | Description                      |
| ----------------------- | ------- | ------- | -------------------------------- |
| `cacheEnabled`          | boolean | `true`  | Enable Redis caching             |
| `aiEnabled`             | boolean | `true`  | Enable AI enhancements           |
| `maxConcurrentSearches` | number  | `5`     | Max concurrent database searches |
| `defaultTimeout`        | number  | `30000` | Default search timeout (ms)      |

## Error Handling

The service throws specific error types:

- `ValidationError` - Invalid request parameters
- `DatabaseError` - Database connection or query failures
- `AIServiceError` - AI service unavailable or failed
- `CacheError` - Redis connection issues

## Testing

```bash
# Run unit tests
npm test src/services/SearchService.test.ts

# Run integration tests
npm run test:integration -- --grep "SearchService"
```

## Performance

- Average search time: 150ms
- Cache hit rate: 85%
- Supports up to 10 concurrent databases
- Automatic query optimization

## Related

- [DatabaseService](../services/database-service.md) - Database connection management
- [AIService](../services/ai-service.md) - AI integration and enhancements
- [CacheService](../services/cache-service.md) - Redis caching implementation

````

## Code Review Standards

### Review Checklist

- [ ] **Functionality**: Code works as intended
- [ ] **Tests**: Adequate test coverage (>90%)
- [ ] **Performance**: No obvious performance issues
- [ ] **Security**: No security vulnerabilities
- [ ] **Style**: Follows coding standards
- [ ] **Documentation**: Proper documentation and comments
- [ ] **Error Handling**: Comprehensive error handling
- [ ] **Types**: Proper TypeScript typing
- [ ] **Dependencies**: No unnecessary dependencies

### Review Process

1. **Automated Checks**: All CI checks must pass
2. **Self Review**: Author reviews their own code first
3. **Peer Review**: At least one team member review
4. **Testing**: Manual testing for complex features
5. **Documentation**: Update relevant documentation

## Continuous Integration

### Pre-commit Hooks

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged",
      "commit-msg": "commitlint -E HUSKY_GIT_PARAMS"
    }
  },
  "lint-staged": {
    "*.{ts,js}": [
      "eslint --fix",
      "prettier --write",
      "git add"
    ],
    "*.{md,json}": [
      "prettier --write",
      "git add"
    ]
  }
}
````

### Commit Message Format

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Test changes
- `chore`: Build/tooling changes

**Examples:**

```
feat(search): add semantic search mode

Add AI-powered semantic search using OpenAI embeddings
for better query understanding and result relevance.

Closes #123
```

## Related Documentation

- **[Development Guide](./index.md)** - Complete development setup
- **[Git Workflow](./git-workflow.md)** - Git branching and workflow
- **[Testing Guide](../testing/)** - Testing strategies and patterns
- **[API Documentation](../api/)** - API design standards

---

**Following these standards ensures code quality, maintainability, and consistency across the Altus 4 codebase. All contributors must adhere to these guidelines.**
