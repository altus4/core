---
title: SDK Usage Examples
description: Learn how to use official Altus 4 SDKs for popular programming languages with comprehensive examples and best practices.
---

# SDK Usage Examples

Official SDKs for Popular Programming Languages

This guide demonstrates how to use official Altus 4 SDKs to integrate search functionality into your applications with type safety, error handling, and best practices.

## Available SDKs

Currently, Altus 4 provides SDKs for:

- **JavaScript/TypeScript** - For Node.js and browser applications
- **Python** - For Python 3.8+ applications
- **Go** - For Go 1.19+ applications
- **Java** - For Java 11+ applications
- **PHP** - For PHP 8.0+ applications

## JavaScript/TypeScript SDK

### Installation

```bash
npm install @altus4/sdk
# or
yarn add @altus4/sdk
```

### Basic Usage

```typescript
import { Altus4Client } from '@altus4/sdk';

// Initialize client
const client = new Altus4Client({
  apiKey: 'altus4_sk_live_abc123def456...',
  baseUrl: 'https://api.altus4.com', // Optional, defaults to production
  timeout: 30000, // Optional, 30 second timeout
  retries: 3, // Optional, retry failed requests
});

// Basic search
async function basicSearch() {
  try {
    const results = await client.search({
      query: 'mysql performance optimization',
      databases: ['tech-docs-db'],
      searchMode: 'semantic',
      limit: 20,
    });

    console.log(`Found ${results.totalCount} results`);
    results.results.forEach(result => {
      console.log(`- ${result.data.title} (${result.relevanceScore})`);
    });

    return results;
  } catch (error) {
    console.error('Search failed:', error.message);
    throw error;
  }
}
```

### Advanced Features

```typescript
import { Altus4Client, SearchMode, ApiError } from '@altus4/sdk';

class AdvancedSearchService {
  private client: Altus4Client;

  constructor(apiKey: string) {
    this.client = new Altus4Client({
      apiKey,
      // Enable request/response logging in development
      debug: process.env.NODE_ENV === 'development',
      // Custom retry configuration
      retryConfig: {
        retries: 5,
        retryDelay: attempt => Math.pow(2, attempt) * 1000, // Exponential backoff
        retryCondition: error => error.status >= 500 || error.status === 429,
      },
    });
  }

  async searchWithFallback(query: string, databases: string[]) {
    // Try semantic search first, fallback to natural language
    const searchModes: SearchMode[] = ['semantic', 'natural', 'boolean'];

    for (const mode of searchModes) {
      try {
        const results = await this.client.search({
          query,
          databases,
          searchMode: mode,
          limit: 25,
        });

        if (results.totalCount > 0) {
          return { ...results, searchMode: mode };
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 429) {
          // Rate limited, wait and retry
          await this.waitForRateLimit(error);
          continue;
        }

        console.warn(`Search with ${mode} mode failed:`, error.message);
      }
    }

    throw new Error('All search modes failed');
  }

  async searchWithAnalytics(query: string, databases: string[]) {
    const [searchResults, suggestions, trends] = await Promise.allSettled([
      this.client.search({ query, databases, limit: 20 }),
      this.client.getSearchSuggestions({ query, databases }),
      this.client.getUserTrends({ period: '7d' }),
    ]);

    return {
      results: searchResults.status === 'fulfilled' ? searchResults.value : null,
      suggestions: suggestions.status === 'fulfilled' ? suggestions.value : [],
      trends: trends.status === 'fulfilled' ? trends.value : null,
      errors: [searchResults, suggestions, trends]
        .filter(result => result.status === 'rejected')
        .map(result => result.reason),
    };
  }

  async batchSearch(queries: string[], databases: string[]) {
    // Execute multiple searches concurrently
    const searchPromises = queries.map(query =>
      this.client
        .search({
          query,
          databases,
          searchMode: 'semantic',
          limit: 10,
        })
        .catch(error => ({ error: error.message, query }))
    );

    const results = await Promise.all(searchPromises);

    return {
      successful: results.filter(result => !result.error),
      failed: results.filter(result => result.error),
      totalQueries: queries.length,
    };
  }

  private async waitForRateLimit(error: ApiError) {
    const resetTime = error.headers?.['x-ratelimit-reset'];
    if (resetTime) {
      const waitTime = new Date(resetTime).getTime() - Date.now();
      if (waitTime > 0 && waitTime < 60000) {
        // Wait max 1 minute
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
}

// Usage
const searchService = new AdvancedSearchService(process.env.ALTUS4_API_KEY!);

// Search with fallback modes
const results = await searchService.searchWithFallback('database performance issues', [
  'docs-db',
  'community-db',
]);

// Search with analytics
const analyticsResults = await searchService.searchWithAnalytics('mysql optimization', [
  'tech-docs-db',
]);

// Batch search
const batchResults = await searchService.batchSearch(
  ['mysql performance', 'database indexing', 'query optimization'],
  ['docs-db']
);
```

### React Integration

```tsx
import React, { useState, useCallback, useEffect } from 'react';
import { Altus4Client } from '@altus4/sdk';
import type { SearchResult, SearchResponse } from '@altus4/sdk';

const client = new Altus4Client({
  apiKey: process.env.REACT_APP_ALTUS4_API_KEY!,
});

interface SearchComponentProps {
  databases: string[];
  placeholder?: string;
}

export const SearchComponent: React.FC<SearchComponentProps> = ({
  databases,
  placeholder = 'Search...',
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Debounced search
  const debouncedSearch = useCallback(
    debounce(async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await client.search({
          query: searchQuery,
          databases,
          searchMode: 'semantic',
          limit: 20,
        });

        setResults(response.results);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed');
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300),
    [databases]
  );

  // Get suggestions as user types
  const getSuggestions = useCallback(
    debounce(async (searchQuery: string) => {
      if (searchQuery.length < 2) {
        setSuggestions([]);
        return;
      }

      try {
        const response = await client.getSearchSuggestions({
          query: searchQuery,
          databases,
          limit: 5,
        });

        setSuggestions(response.suggestions.map(s => s.text));
      } catch (err) {
        console.warn('Failed to get suggestions:', err);
      }
    }, 150),
    [databases]
  );

  useEffect(() => {
    debouncedSearch(query);
    getSuggestions(query);
  }, [query, debouncedSearch, getSuggestions]);

  return (
    <div className='search-component'>
      <div className='search-input-container'>
        <input
          type='text'
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={placeholder}
          className='search-input'
        />

        {suggestions.length > 0 && (
          <div className='suggestions'>
            {suggestions.map((suggestion, index) => (
              <button key={index} onClick={() => setQuery(suggestion)} className='suggestion-item'>
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && <div className='loading'>Searching...</div>}

      {error && <div className='error'>Error: {error}</div>}

      <div className='results'>
        {results.map(result => (
          <div key={result.id} className='result-item'>
            <h3>{result.data.title}</h3>
            <p>{result.snippet}</p>
            <div className='result-meta'>
              <span>Relevance: {Math.round(result.relevanceScore * 100)}%</span>
              <span>Source: {result.database}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Utility function
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
```

## Python SDK

### Installation

```bash
pip install altus4-sdk
```

### Basic Usage

```python
from altus4 import Altus4Client
from altus4.exceptions import Altus4Error, RateLimitError
import asyncio

# Initialize client
client = Altus4Client(
    api_key="altus4_sk_live_abc123def456...",
    base_url="https://api.altus4.com",  # Optional
    timeout=30.0,  # Optional
    max_retries=3  # Optional
)

async def basic_search():
    """Basic search example"""
    try:
        results = await client.search(
            query="mysql performance optimization",
            databases=["tech-docs-db"],
            search_mode="semantic",
            limit=20
        )

        print(f"Found {results.total_count} results")
        for result in results.results:
            print(f"- {result.data.get('title', 'No title')} ({result.relevance_score:.2f})")

        return results
    except Altus4Error as e:
        print(f"Search failed: {e}")
        raise

# Run async function
results = asyncio.run(basic_search())
```

### Advanced Features

```python
import asyncio
import logging
from typing import List, Dict, Any, Optional
from altus4 import Altus4Client
from altus4.types import SearchResult, SearchMode
from altus4.exceptions import Altus4Error, RateLimitError, ValidationError

class AdvancedSearchService:
    def __init__(self, api_key: str):
        self.client = Altus4Client(
            api_key=api_key,
            # Enable debug logging
            debug=True,
            # Custom retry configuration
            retry_config={
                'max_retries': 5,
                'backoff_factor': 2.0,
                'status_forcelist': [429, 500, 502, 503, 504]
            }
        )
        self.logger = logging.getLogger(__name__)

    async def search_with_fallback(
        self,
        query: str,
        databases: List[str]
    ) -> Dict[str, Any]:
        """Search with multiple fallback strategies"""

        search_modes = ['semantic', 'natural', 'boolean']

        for mode in search_modes:
            try:
                results = await self.client.search(
                    query=query,
                    databases=databases,
                    search_mode=mode,
                    limit=25
                )

                if results.total_count > 0:
                    return {
                        'results': results,
                        'search_mode': mode,
                        'success': True
                    }

            except RateLimitError as e:
                self.logger.warning(f"Rate limited, waiting {e.retry_after} seconds")
                await asyncio.sleep(e.retry_after)
                continue
            except ValidationError as e:
                self.logger.error(f"Validation error with {mode} mode: {e}")
                continue
            except Altus4Error as e:
                self.logger.warning(f"Search with {mode} mode failed: {e}")

        return {'results': None, 'success': False, 'error': 'All search modes failed'}

    async def parallel_database_search(
        self,
        query: str,
        databases: List[str],
        max_concurrent: int = 5
    ) -> Dict[str, Any]:
        """Search multiple databases in parallel"""

        semaphore = asyncio.Semaphore(max_concurrent)

        async def search_database(db_id: str) -> Dict[str, Any]:
            async with semaphore:
                try:
                    result = await self.client.search(
                        query=query,
                        databases=[db_id],
                        search_mode='semantic',
                        limit=20
                    )
                    return {'database': db_id, 'results': result, 'success': True}
                except Exception as e:
                    return {'database': db_id, 'error': str(e), 'success': False}

        # Execute searches in parallel
        tasks = [search_database(db_id) for db_id in databases]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Process results
        successful = [r for r in results if isinstance(r, dict) and r.get('success')]
        failed = [r for r in results if isinstance(r, dict) and not r.get('success')]

        # Aggregate successful results
        all_results = []
        for result in successful:
            all_results.extend(result['results'].results)

        # Sort by relevance
        all_results.sort(key=lambda x: x.relevance_score, reverse=True)

        return {
            'results': all_results,
            'successful_databases': len(successful),
            'failed_databases': len(failed),
            'total_results': len(all_results)
        }

    async def search_with_analytics(
        self,
        query: str,
        databases: List[str]
    ) -> Dict[str, Any]:
        """Search with comprehensive analytics"""

        # Execute multiple operations concurrently
        search_task = self.client.search(
            query=query,
            databases=databases,
            search_mode='semantic',
            limit=20,
            include_analytics=True
        )

        suggestions_task = self.client.get_search_suggestions(
            query=query,
            databases=databases,
            limit=5
        )

        trends_task = self.client.get_user_trends(period='7d')

        # Wait for all operations
        results = await asyncio.gather(
            search_task,
            suggestions_task,
            trends_task,
            return_exceptions=True
        )

        return {
            'search_results': results[0] if not isinstance(results[0], Exception) else None,
            'suggestions': results[1] if not isinstance(results[1], Exception) else [],
            'trends': results[2] if not isinstance(results[2], Exception) else None,
            'errors': [str(r) for r in results if isinstance(r, Exception)]
        }

    async def cached_search(
        self,
        query: str,
        databases: List[str],
        cache_ttl: int = 300
    ) -> Dict[str, Any]:
        """Search with local caching"""

        import hashlib
        import json
        import time

        # Generate cache key
        cache_data = {
            'query': query.lower().strip(),
            'databases': sorted(databases)
        }
        cache_key = hashlib.md5(json.dumps(cache_data, sort_keys=True).encode()).hexdigest()

        # Check cache (implement your preferred caching solution)
        cached_result = await self.get_from_cache(cache_key)
        if cached_result and time.time() - cached_result['timestamp'] < cache_ttl:
            self.logger.info(f"Cache hit for query: {query}")
            return cached_result['data']

        # Execute search
        try:
            results = await self.client.search(
                query=query,
                databases=databases,
                search_mode='semantic',
                limit=20
            )

            # Cache results
            cache_data = {
                'data': {
                    'results': results,
                    'cached': False,
                    'cache_key': cache_key
                },
                'timestamp': time.time()
            }
            await self.set_cache(cache_key, cache_data)

            return cache_data['data']

        except Exception as e:
            self.logger.error(f"Search failed: {e}")
            raise

    async def get_from_cache(self, key: str) -> Optional[Dict[str, Any]]:
        """Get data from cache - implement with your preferred cache"""
        # Implement with Redis, Memcached, or in-memory cache
        return None

    async def set_cache(self, key: str, data: Dict[str, Any]) -> None:
        """Set data in cache - implement with your preferred cache"""
        # Implement with Redis, Memcached, or in-memory cache
        pass

# Usage examples
async def main():
    service = AdvancedSearchService("altus4_sk_live_abc123...")

    # Search with fallback
    fallback_results = await service.search_with_fallback(
        "database performance issues",
        ["docs-db", "community-db"]
    )

    # Parallel database search
    parallel_results = await service.parallel_database_search(
        "mysql optimization",
        ["tech-docs-db", "community-db", "legacy-db"],
        max_concurrent=3
    )

    # Search with analytics
    analytics_results = await service.search_with_analytics(
        "query optimization techniques",
        ["tech-docs-db"]
    )

    print(f"Fallback search success: {fallback_results['success']}")
    print(f"Parallel search found {parallel_results['total_results']} results")
    print(f"Analytics search errors: {len(analytics_results['errors'])}")

# Run the examples
asyncio.run(main())
```

### Django Integration

```python
# settings.py
ALTUS4_CONFIG = {
    'API_KEY': os.environ.get('ALTUS4_API_KEY'),
    'BASE_URL': 'https://api.altus4.com',
    'TIMEOUT': 30.0,
    'DEFAULT_DATABASES': ['docs-db', 'help-db']
}

# services.py
from django.conf import settings
from altus4 import Altus4Client
import asyncio
from asgiref.sync import sync_to_async

class DjangoSearchService:
    def __init__(self):
        self.client = Altus4Client(
            api_key=settings.ALTUS4_CONFIG['API_KEY'],
            base_url=settings.ALTUS4_CONFIG['BASE_URL'],
            timeout=settings.ALTUS4_CONFIG['TIMEOUT']
        )

    async def search_async(self, query: str, databases: List[str] = None):
        """Async search method"""
        databases = databases or settings.ALTUS4_CONFIG['DEFAULT_DATABASES']

        return await self.client.search(
            query=query,
            databases=databases,
            search_mode='semantic',
            limit=20
        )

    def search_sync(self, query: str, databases: List[str] = None):
        """Sync wrapper for async search"""
        return asyncio.run(self.search_async(query, databases))

# views.py
from django.http import JsonResponse
from django.views import View
from .services import DjangoSearchService
import json

class SearchView(View):
    def __init__(self):
        super().__init__()
        self.search_service = DjangoSearchService()

    def post(self, request):
        try:
            data = json.loads(request.body)
            query = data.get('query', '')
            databases = data.get('databases')

            if not query:
                return JsonResponse({'error': 'Query is required'}, status=400)

            # Use sync wrapper in Django view
            results = self.search_service.search_sync(query, databases)

            return JsonResponse({
                'success': True,
                'results': [
                    {
                        'id': result.id,
                        'title': result.data.get('title', ''),
                        'snippet': result.snippet,
                        'relevance': result.relevance_score,
                        'database': result.database
                    }
                    for result in results.results
                ],
                'total_count': results.total_count
            })

        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
```

## Go SDK

### Installation

```bash
go get github.com/altus4/go-sdk
```

### Basic Usage

```go
package main

import (
    "context"
    "fmt"
    "log"
    "time"

    "github.com/altus4/go-sdk"
)

func main() {
    // Initialize client
    client := altus4.NewClient(&altus4.Config{
        APIKey:  "altus4_sk_live_abc123def456...",
        BaseURL: "https://api.altus4.com", // Optional
        Timeout: 30 * time.Second,         // Optional
        Retries: 3,                        // Optional
    })

    // Basic search
    ctx := context.Background()

    results, err := client.Search(ctx, &altus4.SearchRequest{
        Query:      "mysql performance optimization",
        Databases:  []string{"tech-docs-db"},
        SearchMode: altus4.SearchModeSemantic,
        Limit:      20,
    })

    if err != nil {
        log.Fatalf("Search failed: %v", err)
    }

    fmt.Printf("Found %d results\n", results.TotalCount)
    for _, result := range results.Results {
        fmt.Printf("- %s (%.2f)\n",
            result.Data["title"],
            result.RelevanceScore)
    }
}
```

### Advanced Features

```go
package main

import (
    "context"
    "fmt"
    "log"
    "sync"
    "time"

    "github.com/altus4/go-sdk"
    "golang.org/x/sync/errgroup"
)

type AdvancedSearchService struct {
    client *altus4.Client
}

func NewAdvancedSearchService(apiKey string) *AdvancedSearchService {
    client := altus4.NewClient(&altus4.Config{
        APIKey:  apiKey,
        Timeout: 30 * time.Second,
        Retries: 5,
        RetryConfig: &altus4.RetryConfig{
            BackoffFactor: 2.0,
            MaxDelay:      30 * time.Second,
        },
    })

    return &AdvancedSearchService{client: client}
}

func (s *AdvancedSearchService) SearchWithFallback(
    ctx context.Context,
    query string,
    databases []string,
) (*altus4.SearchResponse, error) {
    searchModes := []altus4.SearchMode{
        altus4.SearchModeSemantic,
        altus4.SearchModeNatural,
        altus4.SearchModeBoolean,
    }

    for _, mode := range searchModes {
        results, err := s.client.Search(ctx, &altus4.SearchRequest{
            Query:      query,
            Databases:  databases,
            SearchMode: mode,
            Limit:      25,
        })

        if err != nil {
            log.Printf("Search with %s mode failed: %v", mode, err)
            continue
        }

        if results.TotalCount > 0 {
            return results, nil
        }
    }

    return nil, fmt.Errorf("all search modes failed")
}

func (s *AdvancedSearchService) ParallelDatabaseSearch(
    ctx context.Context,
    query string,
    databases []string,
    maxConcurrent int,
) (*AggregatedResults, error) {
    // Use errgroup for controlled concurrency
    g, ctx := errgroup.WithContext(ctx)
    g.SetLimit(maxConcurrent)

    // Channel to collect results
    resultsChan := make(chan *DatabaseResult, len(databases))

    // Launch searches for each database
    for _, dbID := range databases {
        dbID := dbID // Capture loop variable
        g.Go(func() error {
            result, err := s.client.Search(ctx, &altus4.SearchRequest{
                Query:      query,
                Databases:  []string{dbID},
                SearchMode: altus4.SearchModeSemantic,
                Limit:      20,
            })

            if err != nil {
                resultsChan <- &DatabaseResult{
                    Database: dbID,
                    Error:    err,
                }
                return nil // Don't fail the group
            }

            resultsChan <- &DatabaseResult{
                Database: dbID,
                Results:  result,
            }
            return nil
        })
    }

    // Wait for all searches to complete
    go func() {
        g.Wait()
        close(resultsChan)
    }()

    // Aggregate results
    var allResults []*altus4.SearchResult
    var successful, failed int

    for dbResult := range resultsChan {
        if dbResult.Error != nil {
            failed++
            log.Printf("Database %s failed: %v", dbResult.Database, dbResult.Error)
            continue
        }

        successful++
        allResults = append(allResults, dbResult.Results.Results...)
    }

    // Sort by relevance
    sort.Slice(allResults, func(i, j int) bool {
        return allResults[i].RelevanceScore > allResults[j].RelevanceScore
    })

    return &AggregatedResults{
        Results:             allResults,
        SuccessfulDatabases: successful,
        FailedDatabases:     failed,
        TotalResults:        len(allResults),
    }, nil
}

type DatabaseResult struct {
    Database string
    Results  *altus4.SearchResponse
    Error    error
}

type AggregatedResults struct {
    Results             []*altus4.SearchResult
    SuccessfulDatabases int
    FailedDatabases     int
    TotalResults        int
}

// HTTP handler example
func (s *AdvancedSearchService) SearchHandler(w http.ResponseWriter, r *http.Request) {
    var req struct {
        Query     string   `json:"query"`
        Databases []string `json:"databases"`
    }

    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, "Invalid JSON", http.StatusBadRequest)
        return
    }

    if req.Query == "" {
        http.Error(w, "Query is required", http.StatusBadRequest)
        return
    }

    ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
    defer cancel()

    results, err := s.SearchWithFallback(ctx, req.Query, req.Databases)
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]interface{}{
        "success":     true,
        "results":     results.Results,
        "total_count": results.TotalCount,
    })
}

func main() {
    service := NewAdvancedSearchService("altus4_sk_live_abc123...")

    ctx := context.Background()

    // Search with fallback
    results, err := service.SearchWithFallback(
        ctx,
        "database performance issues",
        []string{"docs-db", "community-db"},
    )
    if err != nil {
        log.Printf("Fallback search failed: %v", err)
    } else {
        fmt.Printf("Fallback search found %d results\n", results.TotalCount)
    }

    // Parallel database search
    aggregated, err := service.ParallelDatabaseSearch(
        ctx,
        "mysql optimization",
        []string{"tech-docs-db", "community-db", "legacy-db"},
        3, // max concurrent
    )
    if err != nil {
        log.Printf("Parallel search failed: %v", err)
    } else {
        fmt.Printf("Parallel search: %d results from %d databases\n",
            aggregated.TotalResults, aggregated.SuccessfulDatabases)
    }
}
```

## Best Practices

### 1. Error Handling

Implement comprehensive error handling across all SDKs:

```typescript
// TypeScript
import { ApiError, RateLimitError, ValidationError } from '@altus4/sdk';

try {
  const results = await client.search({ query, databases });
} catch (error) {
  if (error instanceof RateLimitError) {
    // Wait and retry
    await new Promise(resolve => setTimeout(resolve, error.retryAfter * 1000));
    // Retry logic here
  } else if (error instanceof ValidationError) {
    // Handle validation errors
    console.error('Invalid request:', error.details);
  } else if (error instanceof ApiError) {
    // Handle API errors
    console.error('API error:', error.status, error.message);
  } else {
    // Handle unexpected errors
    console.error('Unexpected error:', error);
  }
}
```

### 2. Performance Optimization

Optimize SDK usage for better performance:

```python
# Python - Connection pooling and async
import asyncio
from altus4 import Altus4Client

# Use connection pooling
client = Altus4Client(
    api_key="your-key",
    connection_pool_size=10,  # Reuse connections
    keep_alive=True
)

# Batch operations
async def batch_operations():
    tasks = [
        client.search(query="query1", databases=["db1"]),
        client.search(query="query2", databases=["db2"]),
        client.get_suggestions(query="query3")
    ]

    results = await asyncio.gather(*tasks, return_exceptions=True)
    return results
```

### 3. Configuration Management

Manage SDK configuration properly:

```go
// Go - Configuration with environment variables
package main

import (
    "os"
    "time"
    "github.com/altus4/go-sdk"
)

func NewConfiguredClient() *altus4.Client {
    config := &altus4.Config{
        APIKey:  os.Getenv("ALTUS4_API_KEY"),
        BaseURL: getEnvOrDefault("ALTUS4_BASE_URL", "https://api.altus4.com"),
        Timeout: parseDurationOrDefault(os.Getenv("ALTUS4_TIMEOUT"), 30*time.Second),
        Retries: parseIntOrDefault(os.Getenv("ALTUS4_RETRIES"), 3),
    }

    return altus4.NewClient(config)
}

func getEnvOrDefault(key, defaultValue string) string {
    if value := os.Getenv(key); value != "" {
        return value
    }
    return defaultValue
}
```

### 4. Testing

Test SDK integration properly:

```typescript
// TypeScript - Testing with mocks
import { Altus4Client } from '@altus4/sdk';
import { jest } from '@jest/globals';

// Mock the SDK for testing
jest.mock('@altus4/sdk');

const mockClient = {
  search: jest.fn(),
  getSearchSuggestions: jest.fn(),
} as jest.Mocked<Altus4Client>;

describe('SearchService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle search results', async () => {
    const mockResults = {
      results: [{ id: '1', data: { title: 'Test' }, relevanceScore: 0.9 }],
      totalCount: 1,
    };

    mockClient.search.mockResolvedValue(mockResults);

    const service = new SearchService(mockClient);
    const results = await service.search('test query', ['db1']);

    expect(results.totalCount).toBe(1);
    expect(mockClient.search).toHaveBeenCalledWith({
      query: 'test query',
      databases: ['db1'],
      searchMode: 'semantic',
      limit: 20,
    });
  });
});
```

## Next Steps

You've learned how to use Altus 4 SDKs effectively! Continue exploring:

- **[API Reference](../api/)** - Complete API documentation
- **[Performance Guide](../testing/performance.md)** - SDK optimization techniques
- **[Examples Repository](https://github.com/altus4/examples)** - More SDK examples

---

**Official SDKs provide the best developer experience with type safety, error handling, and performance optimizations. Choose the SDK for your preferred language and start building!**
