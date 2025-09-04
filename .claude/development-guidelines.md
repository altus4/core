# Development Guidelines

## TypeScript Guidelines

### Type Definitions

- Always use explicit return types for public methods
- Prefer interfaces over types for object shapes
- Use strict mode with all TypeScript compiler checks enabled
- Create custom types for domain-specific concepts

```typescript
// Good
interface SearchResult {
  id: string;
  title: string;
  content: string;
  relevance: number;
  metadata?: Record<string, any>;
}

async function searchDatabase(query: string): Promise<SearchResult[]> {
  // Implementation
}

// Avoid
function searchDatabase(query: any): Promise<any> {
  // Implementation
}
```

### Error Handling

- Use custom AppError class for all application errors
- Include error codes for programmatic error handling
- Log errors with appropriate context

```typescript
// Good
if (!database) {
  throw new AppError('Database not found', 404, 'DATABASE_NOT_FOUND', { databaseId });
}

// Avoid
if (!database) {
  throw new Error('Database not found');
}
```

## Service Development

### Service Constructor Pattern

```typescript
class MyService {
  private readonly logger: Logger;
  private readonly config: ServiceConfig;

  constructor(
    private readonly dependencies: {
      database: DatabaseService;
      cache: CacheService;
    },
    config: ServiceConfig
  ) {
    this.logger = logger.child({ service: 'MyService' });
    this.config = config;
  }
}
```

### Async/Await Best Practices

- Always use async/await instead of promises
- Handle errors at the appropriate level
- Use Promise.allSettled for concurrent operations that shouldn't fail together

```typescript
// Good
async function processMultipleDatabases(databases: Database[]): Promise<Result[]> {
  const promises = databases.map(db => this.processDatabase(db));
  const results = await Promise.allSettled(promises);
  return results.filter(result => result.status === 'fulfilled').map(result => result.value);
}

// Avoid
async function processMultipleDatabases(databases: Database[]): Promise<Result[]> {
  const promises = databases.map(db => this.processDatabase(db));
  return Promise.all(promises); // Will fail if any database fails
}
```

## Database Patterns

### Connection Management

- Always use connection pools
- Release connections in finally blocks
- Implement health checks for connection pools

```typescript
async executeQuery(sql: string, params: any[]): Promise<any> {
  const connection = await this.pool.getConnection();
  try {
    const [results] = await connection.execute(sql, params);
    return results;
  } finally {
    connection.release();
  }
}
```

### Query Security

- Always use parameterized queries
- Validate and sanitize user inputs
- Implement query logging for debugging

```typescript
// Good
const query = 'SELECT * FROM users WHERE id = ?';
const results = await connection.execute(query, [userId]);

// NEVER do this
const query = `SELECT * FROM users WHERE id = ${userId}`;
const results = await connection.execute(query);
```

## API Development

### Request Validation

- Use Zod schemas for all input validation
- Validate at the route level before controller processing
- Return structured validation errors

```typescript
const CreateDatabaseSchema = z.object({
  name: z.string().min(1).max(100),
  host: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(1),
  database_name: z.string().min(1),
});

app.post('/databases', validate(CreateDatabaseSchema), async (req, res) => {
  // req.body is now typed and validated
});
```

### Response Structure

- Use consistent response formats
- Include metadata for paginated responses
- Handle errors with appropriate HTTP status codes

```typescript
// Success response
res.json({
  success: true,
  data: results,
  metadata: {
    total: totalCount,
    page: currentPage,
    limit: pageSize,
  },
});

// Error response
res.status(400).json({
  success: false,
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Invalid input provided',
    details: validationErrors,
  },
});
```

## Logging Standards

### Structured Logging

- Use JSON format for all logs
- Include relevant context in log messages
- Use appropriate log levels

```typescript
// Good
logger.info('Search completed', {
  userId: user.id,
  query: searchQuery,
  resultCount: results.length,
  duration: endTime - startTime,
  databases: searchedDatabases.map(db => ({ id: db.id, name: db.name })),
});

// Avoid
logger.info(`Search completed for user ${user.id} with ${results.length} results`);
```

### Log Levels

- **error**: System errors, exceptions, failures
- **warn**: Recoverable errors, deprecated features, high resource usage
- **info**: Business logic events, API requests, service state changes
- **debug**: Detailed debugging information (development only)

## Testing Guidelines

### Unit Tests

- Test services in isolation with mocked dependencies
- Use descriptive test names that explain the behavior
- Follow AAA pattern: Arrange, Act, Assert

```typescript
describe('SearchService', () => {
  describe('searchAcrossDatabases', () => {
    it('should return aggregated results from multiple databases', async () => {
      // Arrange
      const mockDatabaseService = createMockDatabaseService();
      const searchService = new SearchService({ database: mockDatabaseService });
      const query = 'test query';

      // Act
      const results = await searchService.searchAcrossDatabases(query, databases);

      // Assert
      expect(results).toHaveLength(2);
      expect(results[0].source).toBe('database1');
    });
  });
});
```

### Integration Tests

- Test API endpoints with real database connections
- Use test database that mirrors production schema
- Clean up test data after each test

```typescript
describe('POST /api/v1/search', () => {
  beforeEach(async () => {
    await setupTestDatabase();
  });

  afterEach(async () => {
    await cleanupTestDatabase();
  });

  it('should return search results for valid query', async () => {
    const response = await request(app)
      .post('/api/v1/search')
      .set('Authorization', `Bearer ${testApiKey}`)
      .send({ query: 'test search', databases: [testDatabaseId] });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeInstanceOf(Array);
  });
});
```

## Security Guidelines

### API Key Management

- Hash API keys before storing in database
- Use cryptographically secure random generation
- Implement proper key rotation procedures

```typescript
function generateApiKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}
```

### Input Validation

- Validate all user inputs at API boundaries
- Sanitize data before database operations
- Use allowlists instead of blocklists when possible

```typescript
const sanitizeSearchQuery = (query: string): string => {
  return query
    .replace(/[<>]/g, '') // Remove potential XSS characters
    .replace(/[;'"\\]/g, '') // Remove SQL injection characters
    .trim()
    .substring(0, 1000); // Limit length
};
```

### Rate Limiting

- Implement rate limiting at multiple levels
- Use sliding window approach
- Provide clear rate limit headers

```typescript
const rateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: req => {
    return req.user.tier === 'enterprise' ? 10000 : req.user.tier === 'pro' ? 1000 : 100;
  },
  message: 'Too many requests, please try again later',
});
```

## Performance Guidelines

### Caching Strategy

- Cache expensive operations and frequently accessed data
- Use appropriate TTL values based on data volatility
- Implement cache warming for critical data

```typescript
async getCachedData(key: string, fetcher: () => Promise<any>, ttl: number = 3600): Promise<any> {
  const cached = await this.cache.get(key);
  if (cached) {
    return JSON.parse(cached);
  }

  const data = await fetcher();
  await this.cache.setex(key, ttl, JSON.stringify(data));
  return data;
}
```

### Database Optimization

- Use appropriate indexes for query patterns
- Implement connection pooling with proper limits
- Monitor query performance and optimize slow queries

```typescript
// Add database indexes for common query patterns
CREATE FULLTEXT INDEX idx_content_search ON articles(title, content);
CREATE INDEX idx_user_created ON searches(user_id, created_at);
CREATE INDEX idx_api_key_hash ON api_keys(key_hash, is_active);
```

## Documentation Guidelines

### Code Documentation

- Document all public methods with JSDoc
- Include parameter and return type descriptions
- Provide usage examples for complex functions

````typescript
/**
 * Searches across multiple user databases for the given query
 *
 * @param query - The search query string
 * @param databases - Array of database IDs to search
 * @param options - Search options including mode and pagination
 * @returns Promise resolving to search results with metadata
 *
 * @example
 * ```typescript
 * const results = await searchService.searchAcrossDatabases(
 *   'machine learning',
 *   ['db1', 'db2'],
 *   { mode: 'semantic', limit: 20 }
 * );
 * ```
 */
async searchAcrossDatabases(
  query: string,
  databases: string[],
  options: SearchOptions = {}
): Promise<SearchResults> {
  // Implementation
}
````

### API Documentation

- Keep OpenAPI/Swagger definitions up to date
- Include request/response examples
- Document error codes and their meanings

## Git Workflow

### Branch Naming

- `feature/` - New features
- `bugfix/` - Bug fixes
- `hotfix/` - Critical production fixes
- `refactor/` - Code refactoring
- `docs/` - Documentation updates

### Commit Messages

Use conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

Examples:

- `feat(search): add semantic search capability`
- `fix(auth): resolve API key validation issue`
- `docs(api): update search endpoint documentation`

### Pull Request Guidelines

- Include description of changes and motivation
- Reference related issues
- Ensure all tests pass
- Request appropriate reviewers
- Update documentation if needed
