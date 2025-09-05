---
title: SearchService Documentation
description: Comprehensive documentation for the SearchService class - the core search orchestration engine of Altus 4.
---

# `SearchService` Documentation

Comprehensive documentation for the SearchService class

The `SearchService` is the core orchestration engine of Altus 4, responsible for coordinating multi-database searches, AI enhancements, caching strategies, and result processing. This document provides detailed explanations of the service's architecture, methods, and implementation patterns.

## Overview

The `SearchService` acts as the central coordinator that:

- Orchestrates searches across multiple MySQL databases
- Integrates AI-powered semantic search and query optimization
- Manages intelligent caching for performance optimization
- Generates search suggestions and analytics insights
- Transforms raw database results into structured, enhanced responses

```typescript
export class SearchService {
  constructor(
    private databaseService: DatabaseService,
    private aiService: AIService,
    private cacheService: CacheService
  ) {}
}
```

## Architecture & Design Patterns

### Dependency Injection

The service uses constructor-based dependency injection for loose coupling and testability:

```typescript
constructor(
  databaseService: DatabaseService,  // MySQL operations
  aiService: AIService,              // OpenAI integration
  cacheService: CacheService        // Redis caching
) {
  this.databaseService = databaseService;
  this.aiService = aiService;
  this.cacheService = cacheService;
}
```

**Benefits:**

- **Testability**: Easy to mock dependencies in unit tests
- **Flexibility**: Can swap implementations without changing the service
- **Separation of Concerns**: Each dependency handles its specific domain

### Orchestration Pattern

The service orchestrates complex workflows involving multiple external systems:

```mermaid
graph TD
    A[Search Service] --> B[Cache Service]
    A --> C[AI Service<br/>OpenAI]
    A --> D[Database Service]

    style A fill:#e8f5e8
    style B fill:#e1f5fe
    style C fill:#f3e5f5
    style D fill:#fff3e0
```

## Core Methods

### 1. `search(request: SearchRequest): Promise<SearchResponse>`

**Purpose**: The main search orchestration method that coordinates all search operations.

**Flow Diagram**:

```mermaid
graph LR
    A[Request] --> B[Cache Check]
    B --> C[AI Processing]
    C --> D[Database Search]
    D --> E[Result Enhancement]
    E --> F[Caching]
    F --> G[Response]
```

**Implementation Breakdown**:

```typescript
public async search(request: SearchRequest): Promise<SearchResponse> {
  const startTime = Date.now();
  logger.info(`Search request: ${request.query} by user ${request.userId}`);

  try {
    // 1. Generate cache key for this specific search
    const cacheKey = this.generateCacheKey(request);

    // 2. Check cache (skip if analytics requested)
    if (!request.includeAnalytics) {
      const cachedResult = await this.cacheService.get<SearchResponse>(cacheKey);
      if (cachedResult) {
        logger.info(`Cache hit for query: ${request.query}`);
        return cachedResult;
      }
    }

    // 3. Process query with AI if semantic search enabled
    let processedQuery = request.query;
    if (request.searchMode === 'semantic' && this.aiService.isAvailable()) {
      const aiProcessing = await this.aiService.processSearchQuery(request.query);
      processedQuery = aiProcessing.optimizedQuery || request.query;
    }

    // 4. Execute searches across all databases in parallel
    const searchPromises = (request.databases || []).map(async dbId => {
      return this.executeSearchOnDatabase(dbId, processedQuery, request);
    });

    const databaseResults = await Promise.allSettled(searchPromises);

    // 5. Process results and handle failures gracefully
    const allResults: SearchResult[] = [];
    const failedDatabases: string[] = [];

    databaseResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        allResults.push(...result.value);
      } else {
        failedDatabases.push(request.databases![index]);
        logger.error(`Search failed for database ${request.databases![index]}:`, result.reason);
      }
    });

    // 6. Sort by relevance and apply pagination
    allResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
    const paginatedResults = allResults.slice(
      request.offset || 0,
      (request.offset || 0) + (request.limit || 20)
    );

    // 7. Enhance results with categories and suggestions
    const categories = await this.generateCategories(paginatedResults);
    const suggestions = await this.getSearchSuggestions(request);

    // 8. Build comprehensive response
    const response: SearchResponse = {
      results: paginatedResults,
      categories,
      suggestions,
      totalCount: allResults.length,
      executionTime: Date.now() - startTime,
      // ... other fields
    };

    // 9. Cache result for future requests
    if (!request.includeAnalytics) {
      await this.cacheService.set(cacheKey, response, 300); // 5 min TTL
    }

    // 10. Log analytics
    await this.logSearchAnalytics(request, response);

    return response;
  } catch (error) {
    logger.error('Search execution failed:', error);
    throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
```

**Key Design Decisions**:

1. **Cache-First Strategy**: Check cache before expensive operations
2. **Graceful Failure Handling**: Use `Promise.allSettled` to handle partial failures
3. **Parallel Execution**: Search multiple databases simultaneously for performance
4. **AI Integration**: Optional semantic enhancement based on request mode
5. **Comprehensive Logging**: Track performance and errors for monitoring

### 2. `executeSearchOnDatabase(databaseId, query, request)`

**Purpose**: Execute search on a single database with result transformation.

```typescript
private async executeSearchOnDatabase(
  databaseId: string,
  query: string,
  request: SearchRequest
): Promise<SearchResult[]> {
  try {
    // Execute full-text search with specified parameters
    const rawResults = await this.databaseService.executeFullTextSearch(
      databaseId,
      query,
      request.tables || [],
      request.columns,
      request.limit || 20,
      request.offset || 0
    );

    // Transform raw database rows into SearchResult objects
    return rawResults.map((row, index) => ({
      id: `${databaseId}_${row.table}_${index}`,
      database: databaseId,
      table: row.table,
      data: row,
      relevanceScore: this.calculateRelevanceScore(row, query),
      snippet: this.generateSnippet(row, query),
      matchedColumns: Object.keys(row),
      categories: [], // Will be populated later by AI categorization
    }));
  } catch (error) {
    logger.error(`Database search failed for ${databaseId}:`, error);
    throw error;
  }
}
```

**Result Transformation**:

- Converts raw database rows to structured `SearchResult` objects
- Generates unique IDs for each result
- Calculates relevance scores based on text matching
- Creates search snippets highlighting matched terms

### 3. `getSearchSuggestions(request: SearchRequest)`

**Purpose**: Generate intelligent search suggestions combining AI and popular queries.

```typescript
public async getSearchSuggestions(request: SearchRequest): Promise<QuerySuggestion[]> {
  const suggestions: QuerySuggestion[] = [];

  try {
    // Get AI-powered suggestions if available
    if (this.aiService.isAvailable()) {
      const aiSuggestions = await this.aiService.getQuerySuggestions(request.query);
      suggestions.push(...aiSuggestions);
    }

    // Get popular queries from cache analytics
    const popularSuggestions = await this.cacheService.getPopularQueries(request.query);
    suggestions.push(
      ...popularSuggestions.map(query => ({
        text: query,
        score: 0.8,
        type: 'popular' as const,
      }))
    );

    // Remove duplicates and sort by score
    const uniqueSuggestions = suggestions.filter(
      (suggestion, index, self) =>
        index === self.findIndex(s => s.text === suggestion.text)
    );

    return uniqueSuggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

  } catch (error) {
    logger.error('Failed to get search suggestions:', error);
    return [];
  }
}
```

**Suggestion Sources**:

1. **AI Suggestions**: Semantic understanding and query expansion
2. **Popular Queries**: Based on user search patterns and analytics
3. **Deduplication**: Ensures unique suggestions with highest scores
4. **Ranking**: Combines multiple scoring mechanisms

### 4. `generateCacheKey(request: SearchRequest)`

**Purpose**: Create deterministic cache keys for search requests.

```typescript
private generateCacheKey(request: SearchRequest): string {
  const keyData = {
    query: request.query.toLowerCase().trim(),
    databases: [...(request.databases || [])].sort(),
    tables: [...(request.tables || [])].sort(),
    columns: request.columns?.sort(),
    searchMode: request.searchMode || 'natural',
    limit: request.limit || 20,
    offset: request.offset || 0,
  };

  return `search:${Buffer.from(JSON.stringify(keyData)).toString('base64')}`;
}
```

**Key Properties**:

- **Deterministic**: Same request always generates same key
- **Normalized**: Case-insensitive, sorted arrays for consistency
- **Compact**: Base64 encoding for Redis key efficiency
- **Structured**: Includes all parameters affecting search results

### 5. `calculateRelevanceScore(row, query)`

**Purpose**: Calculate relevance scores for search results.

```typescript
private calculateRelevanceScore(row: any, query: string): number {
  const queryTerms = query.toLowerCase().split(/\s+/);
  let score = 0;

  for (const [key, value] of Object.entries(row)) {
    if (typeof value === 'string') {
      const fieldValue = value.toLowerCase();

      // Exact phrase matches get highest score
      if (fieldValue.includes(query.toLowerCase())) {
        score += 1.0;
      }

      // Individual term matches
      queryTerms.forEach(term => {
        if (fieldValue.includes(term)) {
          score += 0.3;
        }
      });

      // Title/name fields get bonus points
      if (key.includes('title') || key.includes('name')) {
        score *= 1.5;
      }
    }
  }

  return Math.min(score, 1.0); // Cap at 1.0
}
```

**Scoring Algorithm**:

1. **Exact Phrase Matching**: Full query string found = 1.0 points
2. **Term Matching**: Individual terms found = 0.3 points each
3. **Field Weighting**: Title/name fields get 1.5x multiplier
4. **Score Normalization**: Capped at 1.0 for consistency

### 6. `generateSnippet(row, query)`

**Purpose**: Generate search snippets with highlighted matching terms.

```typescript
private generateSnippet(row: any, query: string): string {
  const queryTerms = query.toLowerCase().split(/\s+/);

  // Find the first text field that contains search terms
  for (const [, value] of Object.entries(row)) {
    if (typeof value === 'string' && value.length > 50) {
      const lowerValue = value.toLowerCase();

      // Check if this field contains query terms
      const hasMatch = queryTerms.some(term => lowerValue.includes(term));

      if (hasMatch) {
        // Extract relevant portion and highlight terms
        const snippet = value.substring(0, 200);
        return snippet + (value.length > 200 ? '...' : '');
      }
    }
  }

  // Fallback: return first text field truncated
  for (const [, value] of Object.entries(row)) {
    if (typeof value === 'string') {
      return value.substring(0, 200) + (value.length > 200 ? '...' : '');
    }
  }

  return '';
}
```

**Snippet Logic**:

1. **Relevance Priority**: Prefer fields containing search terms
2. **Length Optimization**: Truncate at 200 characters
3. **Fallback Strategy**: Use any text field if no matches
4. **Future Enhancement**: Could add term highlighting

## Helper Methods

### `logSearchAnalytics(request, response)`

**Purpose**: Log search performance and user behavior for analytics.

```typescript
private async logSearchAnalytics(
  request: SearchRequest,
  response: SearchResponse
): Promise<void> {
  try {
    await this.cacheService.logSearchAnalytics({
      userId: request.userId,
      query: request.query,
      searchMode: request.searchMode || 'natural',
      databases: request.databases || [],
      resultCount: response.totalCount,
      executionTime: response.executionTime,
      timestamp: new Date(),
      categories: response.categories?.map(c => c.name) || [],
    });
  } catch (error) {
    // Don't fail the search if analytics logging fails
    logger.warn('Failed to log search analytics:', error);
  }
}
```

**Analytics Data**:

- User search patterns and preferences
- Query performance metrics
- Popular search terms and categories
- Database usage statistics
- Response time tracking

### `generateCategories(results)`

**Purpose**: Use AI to automatically categorize search results.

```typescript
private async generateCategories(results: SearchResult[]): Promise<Category[]> {
  if (results.length === 0) return [];

  try {
    if (this.aiService.isAvailable()) {
      return await this.aiService.categorizeResults(results);
    }

    // Fallback: Basic categorization by data source
    const categories = new Map<string, SearchResult[]>();

    results.forEach(result => {
      const categoryName = result.database || 'Unknown';
      if (!categories.has(categoryName)) {
        categories.set(categoryName, []);
      }
      categories.get(categoryName)!.push(result);
    });

    return Array.from(categories.entries()).map(([name, items]) => ({
      name,
      count: items.length,
      results: items.slice(0, 3), // Preview results
    }));
  } catch (error) {
    logger.warn('Failed to generate categories:', error);
    return [];
  }
}
```

## Testing Patterns

### Unit Testing with Mocked Dependencies

```typescript
describe('SearchService', () => {
  let searchService: SearchService;
  let mockDatabaseService: jest.Mocked<DatabaseService>;
  let mockAIService: jest.Mocked<AIService>;
  let mockCacheService: jest.Mocked<CacheService>;

  beforeEach(() => {
    mockDatabaseService = {
      executeFullTextSearch: jest.fn(),
      // ... other methods
    };

    mockAIService = {
      isAvailable: jest.fn(() => false),
      processSearchQuery: jest.fn(),
      // ... other methods
    };

    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      // ... other methods
    };

    searchService = new SearchService(mockDatabaseService, mockAIService, mockCacheService);
  });

  it('should return cached results when available', async () => {
    const mockResponse = { results: [], totalCount: 0 };
    mockCacheService.get.mockResolvedValue(mockResponse);

    const result = await searchService.search({
      query: 'test',
      userId: 'user1',
      databases: ['db1'],
    });

    expect(result).toBe(mockResponse);
    expect(mockDatabaseService.executeFullTextSearch).not.toHaveBeenCalled();
  });
});
```

### Integration Testing

```typescript
describe('SearchService Integration', () => {
  let searchService: SearchService;

  beforeAll(async () => {
    // Use real service instances for integration testing
    const databaseService = new DatabaseService();
    const aiService = new AIService();
    const cacheService = new CacheService();

    searchService = new SearchService(databaseService, aiService, cacheService);
  });

  it('should perform end-to-end search', async () => {
    const result = await searchService.search({
      query: 'mysql optimization',
      userId: 'integration-test',
      databases: ['test-db'],
    });

    expect(result.results).toBeDefined();
    expect(result.totalCount).toBeGreaterThanOrEqual(0);
  });
});
```

## Performance Optimizations

### 1. Parallel Database Queries

```typescript
// Execute searches in parallel rather than sequentially
const searchPromises = databases.map(async dbId => {
  return this.executeSearchOnDatabase(dbId, query, request);
});

const results = await Promise.allSettled(searchPromises);
```

### 2. Intelligent Caching Strategy

```typescript
// Cache with appropriate TTL based on content type
const ttl = request.includeAnalytics ? 60 : 300; // Analytics: 1min, Results: 5min
await this.cacheService.set(cacheKey, response, ttl);
```

### 3. Result Streaming for Large Sets

```typescript
// For large result sets, consider streaming responses
if (totalResults > 10000) {
  return this.streamSearchResults(request);
}
```

## Monitoring & Metrics

### Key Performance Indicators

```typescript
// Track these metrics in production
const metrics = {
  averageSearchTime: response.executionTime,
  cacheHitRate: cachedResults / totalRequests,
  aiProcessingTime: aiEndTime - aiStartTime,
  databaseResponseTime: dbEndTime - dbStartTime,
  errorRate: failedRequests / totalRequests,
  concurrentSearches: activSearches.size,
};
```

### Error Monitoring

```typescript
// Categorize and monitor different error types
try {
  // Search logic
} catch (error) {
  const errorType = this.categorizeError(error);
  logger.error(`Search failed [${errorType}]:`, error);

  // Emit metrics for monitoring
  this.metrics.increment(`search.errors.${errorType}`);
  throw error;
}
```

## Related Documentation

- **[DatabaseService](./database-service.md)** - MySQL operations and connection management
- **[AIService](./ai-service.md)** - OpenAI integration and semantic enhancements
- **[CacheService](./cache-service.md)** - Redis caching and analytics storage
- **[API Reference](../api/search.md)** - Search endpoint documentation
- **[Testing Guide](../testing/unit.md)** - Service testing patterns

---

**The SearchService is the heart of Altus 4's search capabilities, orchestrating complex operations while maintaining high performance and reliability through intelligent caching, parallel processing, and graceful error handling.**
