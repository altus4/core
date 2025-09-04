# Service Patterns & Best Practices

## Service Structure Pattern

All services follow a consistent structure:

```typescript
class ServiceName {
  private readonly logger: Logger;
  private readonly config: ServiceConfig;

  constructor(dependencies: ServiceDependencies) {
    this.logger = logger.child({ service: 'ServiceName' });
    // Initialize dependencies
  }

  async publicMethod(params: InputType): Promise<OutputType> {
    try {
      this.logger.info('Operation started', { params });

      // Validation
      await this.validateInput(params);

      // Core logic
      const result = await this.executeOperation(params);

      // Post-processing
      const processedResult = this.processResult(result);

      this.logger.info('Operation completed', { result: processedResult });
      return processedResult;
    } catch (error) {
      this.logger.error('Operation failed', { error, params });
      throw new AppError('Operation failed', 500, 'SERVICE_ERROR');
    }
  }

  private async executeOperation(params: InputType): Promise<RawResult> {
    // Implementation details
  }
}
```

## Database Service Patterns

### Connection Management

```typescript
// Connection pool per user database
const pool = mysql.createPool({
  host: database.host,
  user: database.username,
  password: decryptedPassword,
  database: database.database_name,
  connectionLimit: config.connectionLimit,
  queueLimit: config.queueLimit,
  timeout: config.timeout,
  acquireTimeout: config.acquireTimeout,
});

// Health monitoring
setInterval(async () => {
  await this.checkConnectionHealth(poolId);
}, config.healthCheckInterval);
```

### Query Execution Pattern

```typescript
async executeQuery(query: string, params: any[]): Promise<ResultSet> {
  const connection = await this.getConnection();
  try {
    this.logger.debug('Executing query', { query, params });
    const [results] = await connection.execute(query, params);
    return results as ResultSet;
  } catch (error) {
    this.logger.error('Query execution failed', { error, query });
    throw new AppError('Database query failed', 500, 'DB_QUERY_ERROR');
  } finally {
    connection.release();
  }
}
```

## Search Service Patterns

### Multi-Database Search

```typescript
async searchAcrossDatabases(
  query: SearchQuery,
  databases: Database[]
): Promise<SearchResult[]> {
  const searchPromises = databases.map(db =>
    this.searchInDatabase(query, db)
      .catch(error => {
        this.logger.warn('Database search failed', { error, database: db.id });
        return { results: [], error: error.message };
      })
  );

  const results = await Promise.allSettled(searchPromises);
  return this.aggregateResults(results);
}
```

### Result Processing Pipeline

```typescript
async processSearchResults(
  rawResults: RawResult[],
  query: SearchQuery
): Promise<ProcessedResult[]> {
  return rawResults
    .map(result => this.enhanceResult(result))
    .sort((a, b) => this.calculateRelevance(b, query) - this.calculateRelevance(a, query))
    .slice(0, query.limit);
}
```

## AI Service Patterns

### Fallback Handling

```typescript
async enhanceWithAI(
  query: string,
  results: SearchResult[]
): Promise<EnhancedResult[]> {
  try {
    return await this.callOpenAI(query, results);
  } catch (error) {
    this.logger.warn('AI enhancement failed, using fallback', { error });
    return this.fallbackEnhancement(results);
  }
}
```

### Response Caching

```typescript
async getAIResponse(prompt: string): Promise<AIResponse> {
  const cacheKey = `ai:${hashString(prompt)}`;

  // Check cache first
  const cached = await this.cache.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // Call AI service
  const response = await this.openai.createCompletion({ prompt });

  // Cache response
  await this.cache.setex(cacheKey, 3600, JSON.stringify(response));

  return response;
}
```

## Cache Service Patterns

### Multi-Level Caching

```typescript
async get(key: string): Promise<any> {
  // L1: In-memory cache
  if (this.memoryCache.has(key)) {
    return this.memoryCache.get(key);
  }

  // L2: Redis cache
  const redisValue = await this.redis.get(key);
  if (redisValue) {
    this.memoryCache.set(key, JSON.parse(redisValue));
    return JSON.parse(redisValue);
  }

  return null;
}
```

### Cache Invalidation

```typescript
async invalidatePattern(pattern: string): Promise<void> {
  const keys = await this.redis.keys(pattern);
  if (keys.length > 0) {
    await this.redis.del(...keys);
  }

  // Also clear from memory cache
  for (const key of this.memoryCache.keys()) {
    if (key.match(new RegExp(pattern))) {
      this.memoryCache.delete(key);
    }
  }
}
```

## Error Handling Patterns

### Service-Level Error Handling

```typescript
async serviceMethod(params: any): Promise<Result> {
  try {
    return await this.performOperation(params);
  } catch (error) {
    if (error instanceof ValidationError) {
      throw new AppError('Invalid input', 400, 'VALIDATION_ERROR');
    } else if (error instanceof ConnectionError) {
      throw new AppError('Database unavailable', 503, 'DB_CONNECTION_ERROR');
    } else {
      this.logger.error('Unexpected error', { error });
      throw new AppError('Internal server error', 500, 'INTERNAL_ERROR');
    }
  }
}
```

### Circuit Breaker Pattern

```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime?: Date;

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      throw new AppError('Circuit breaker open', 503, 'CIRCUIT_BREAKER_OPEN');
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private isOpen(): boolean {
    return (
      this.failures >= this.failureThreshold &&
      Date.now() - (this.lastFailureTime?.getTime() || 0) < this.cooldownPeriod
    );
  }
}
```

## Validation Patterns

### Input Validation with Zod

```typescript
const SearchQuerySchema = z.object({
  query: z.string().min(1).max(1000),
  databases: z.array(z.string().uuid()).min(1),
  mode: z.enum(['natural', 'boolean', 'semantic']),
  limit: z.number().min(1).max(100).default(10),
  offset: z.number().min(0).default(0)
});

async validateSearchQuery(input: any): Promise<SearchQuery> {
  try {
    return SearchQuerySchema.parse(input);
  } catch (error) {
    throw new AppError('Invalid search query', 400, 'VALIDATION_ERROR', error.errors);
  }
}
```

## Logging Patterns

### Structured Logging

```typescript
this.logger.info('Search completed', {
  userId: request.user.id,
  query: request.query,
  resultsCount: results.length,
  duration: Date.now() - startTime,
  databases: searchedDatabases.map(db => db.id),
});
```

### Request Tracing

```typescript
// Middleware adds request ID
app.use((req, res, next) => {
  req.requestId = generateRequestId();
  req.logger = logger.child({ requestId: req.requestId });
  next();
});

// Services use request logger
async searchMethod(query: string, logger: Logger): Promise<Results> {
  logger.info('Starting search', { query });
  // ... implementation
}
```

## Testing Patterns

### Service Testing

```typescript
describe('DatabaseService', () => {
  let service: DatabaseService;
  let mockPool: jest.Mocked<mysql.Pool>;

  beforeEach(() => {
    mockPool = createMockPool();
    service = new DatabaseService({ pool: mockPool });
  });

  it('should handle connection failures gracefully', async () => {
    mockPool.execute.mockRejectedValue(new Error('Connection failed'));

    await expect(service.executeQuery('SELECT 1', [])).rejects.toThrow(AppError);
  });
});
```
