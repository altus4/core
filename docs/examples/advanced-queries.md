---
title: Advanced Query Examples
description: Master complex search patterns, filters, and optimization techniques with Altus 4's advanced query capabilities.
---

# Advanced Query Examples

Master Complex Search Patterns and Optimization

This guide covers advanced search techniques, complex query patterns, and optimization strategies for power users of Altus 4.

## Prerequisites

- Familiarity with [Basic Search](./basic-search.md) concepts
- Understanding of MySQL FULLTEXT search syntax
- API key with appropriate permissions

## Complex Boolean Queries

### Advanced Boolean Operators

Boolean mode provides precise control over search matching:

```bash
# Complex boolean query with multiple operators
curl -X POST https://api.altus4.com/api/v1/search \
  -H "Authorization: Bearer altus4_sk_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "query": "+(mysql database) +(performance optimization) -\"slow query\" -(deprecated legacy)",
    "databases": ["tech_docs_db"],
    "searchMode": "boolean",
    "limit": 25
  }'
```

**Query Breakdown:**

- `+(mysql database)` - Must contain either "mysql" OR "database"
- `+(performance optimization)` - Must contain either "performance" OR "optimization"
- `-"slow query"` - Must NOT contain the exact phrase "slow query"
- `-(deprecated legacy)` - Must NOT contain either "deprecated" OR "legacy"

### Proximity and Phrase Matching

```javascript
const advancedBooleanQueries = [
  {
    name: 'Exact phrase with context',
    query: '"database optimization" +(mysql postgresql)',
    description: "Exact phrase 'database optimization' with either mysql or postgresql",
  },
  {
    name: 'Word proximity',
    query: 'performance NEAR/5 optimization',
    description: "Words 'performance' and 'optimization' within 5 words of each other",
  },
  {
    name: 'Wildcard matching',
    query: 'optim* +database -slow*',
    description:
      "Words starting with 'optim', must have 'database', exclude words starting with 'slow'",
  },
];

async function executeAdvancedSearch(queryConfig) {
  const response = await fetch('https://api.altus4.com/api/v1/search', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: queryConfig.query,
      databases: ['tech_db'],
      searchMode: 'boolean',
      limit: 20,
    }),
  });

  const results = await response.json();
  console.log(`${queryConfig.name}: ${results.data.totalCount} results`);
  return results;
}

// Execute all advanced queries
for (const queryConfig of advancedBooleanQueries) {
  await executeAdvancedSearch(queryConfig);
}
```

## Multi-Database Federation

### Cross-Database Search Strategies

```python
import asyncio
import aiohttp
from typing import List, Dict, Any

class MultiDatabaseSearcher:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.altus4.com/api/v1"

    async def federated_search(
        self,
        query: str,
        database_configs: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Perform federated search across multiple databases with different strategies
        """
        async with aiohttp.ClientSession() as session:
            # Execute searches in parallel
            tasks = []
            for config in database_configs:
                task = self._search_database(session, query, config)
                tasks.append(task)

            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Aggregate and rank results
            return self._aggregate_results(results, database_configs)

    async def _search_database(
        self,
        session: aiohttp.ClientSession,
        query: str,
        config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Search a single database with specific configuration"""
        search_payload = {
            "query": query,
            "databases": [config["database_id"]],
            "searchMode": config.get("search_mode", "natural"),
            "tables": config.get("tables"),
            "columns": config.get("columns"),
            "limit": config.get("limit", 50)
        }

        async with session.post(
            f"{self.base_url}/search",
            headers={"Authorization": f"Bearer {self.api_key}"},
            json=search_payload
        ) as response:
            data = await response.json()

            # Add database metadata to results
            if data.get("success"):
                for result in data["data"]["results"]:
                    result["database_name"] = config.get("name", "Unknown")
                    result["database_weight"] = config.get("weight", 1.0)

            return data

    def _aggregate_results(
        self,
        results: List[Dict[str, Any]],
        configs: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Aggregate and rank results from multiple databases"""
        all_results = []
        total_execution_time = 0
        successful_databases = 0

        for i, result in enumerate(results):
            if isinstance(result, Exception):
                print(f"Database {configs[i]['name']} failed: {result}")
                continue

            if result.get("success"):
                successful_databases += 1
                total_execution_time += result["data"]["executionTime"]

                # Apply database weighting to relevance scores
                weight = configs[i].get("weight", 1.0)
                for item in result["data"]["results"]:
                    item["weighted_relevance"] = item["relevanceScore"] * weight
                    all_results.append(item)

        # Sort by weighted relevance
        all_results.sort(key=lambda x: x["weighted_relevance"], reverse=True)

        return {
            "success": True,
            "data": {
                "results": all_results,
                "totalCount": len(all_results),
                "executionTime": total_execution_time,
                "databasesSearched": successful_databases,
                "aggregationStrategy": "weighted_relevance"
            }
        }

# Usage example
async def main():
    searcher = MultiDatabaseSearcher(api_key)

    # Configure different databases with different strategies
    database_configs = [
        {
            "database_id": "primary_docs_db",
            "name": "Primary Documentation",
            "search_mode": "semantic",
            "tables": ["articles", "tutorials"],
            "weight": 1.5,  # Higher weight for primary docs
            "limit": 30
        },
        {
            "database_id": "community_db",
            "name": "Community Content",
            "search_mode": "natural",
            "tables": ["forum_posts", "user_content"],
            "weight": 0.8,  # Lower weight for community content
            "limit": 20
        },
        {
            "database_id": "legacy_db",
            "name": "Legacy Documentation",
            "search_mode": "boolean",
            "tables": ["old_docs"],
            "weight": 0.5,  # Lowest weight for legacy content
            "limit": 10
        }
    ]

    results = await searcher.federated_search(
        "database performance optimization",
        database_configs
    )

    print(f"Found {results['data']['totalCount']} results across {results['data']['databasesSearched']} databases")

# Run the federated search
asyncio.run(main())
```

### Database-Specific Optimization

```javascript
class DatabaseOptimizer {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.databaseProfiles = new Map();
  }

  async profileDatabase(databaseId) {
    // Get database schema information
    const schemaResponse = await fetch(
      `https://api.altus4.com/api/v1/databases/${databaseId}/schema`,
      {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      }
    );
    const schema = await schemaResponse.json();

    // Analyze table structures and indexes
    const profile = {
      databaseId,
      tables: schema.data.tables.map(table => ({
        name: table.name,
        fulltextColumns: table.fulltextIndexes.flatMap(idx => idx.columns),
        estimatedRows: table.estimatedRows,
        searchWeight: this.calculateTableWeight(table),
      })),
      totalRows: schema.data.tables.reduce((sum, table) => sum + table.estimatedRows, 0),
      lastProfiled: new Date(),
    };

    this.databaseProfiles.set(databaseId, profile);
    return profile;
  }

  calculateTableWeight(table) {
    // Weight tables based on size and index quality
    const sizeWeight = Math.log10(table.estimatedRows + 1) / 10;
    const indexWeight = table.fulltextIndexes.length * 0.2;
    return Math.min(sizeWeight + indexWeight, 2.0);
  }

  async optimizedSearch(query, databaseIds, options = {}) {
    // Profile databases if not already done
    for (const dbId of databaseIds) {
      if (!this.databaseProfiles.has(dbId)) {
        await this.profileDatabase(dbId);
      }
    }

    // Create optimized search strategy for each database
    const searchPromises = databaseIds.map(async dbId => {
      const profile = this.databaseProfiles.get(dbId);
      const optimizedRequest = this.createOptimizedRequest(query, profile, options);

      return fetch('https://api.altus4.com/api/v1/search', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(optimizedRequest),
      }).then(r => r.json());
    });

    const results = await Promise.allSettled(searchPromises);
    return this.mergeOptimizedResults(results, databaseIds);
  }

  createOptimizedRequest(query, profile, options) {
    // Optimize search parameters based on database profile
    const request = {
      query,
      databases: [profile.databaseId],
      searchMode: options.searchMode || 'natural',
      limit: Math.min(options.limit || 20, 100),
    };

    // Focus on tables with good FULLTEXT indexes
    const goodTables = profile.tables
      .filter(table => table.fulltextColumns.length > 0)
      .sort((a, b) => b.searchWeight - a.searchWeight)
      .slice(0, 5) // Top 5 tables
      .map(table => table.name);

    if (goodTables.length > 0) {
      request.tables = goodTables;
    }

    // Adjust limit based on database size
    if (profile.totalRows > 1000000) {
      request.limit = Math.min(request.limit, 50); // Limit for large databases
    }

    return request;
  }

  mergeOptimizedResults(results, databaseIds) {
    const merged = {
      success: true,
      data: {
        results: [],
        totalCount: 0,
        executionTime: 0,
        optimizationApplied: true,
      },
    };

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.success) {
        const data = result.value.data;
        merged.data.results.push(...data.results);
        merged.data.totalCount += data.totalCount;
        merged.data.executionTime += data.executionTime;
      }
    });

    // Sort by relevance
    merged.data.results.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return merged;
  }
}

// Usage
const optimizer = new DatabaseOptimizer(apiKey);
const results = await optimizer.optimizedSearch('mysql performance tuning', ['db1', 'db2', 'db3'], {
  searchMode: 'semantic',
  limit: 30,
});
```

## Advanced Filtering and Faceting

### Dynamic Filter Construction

```python
class AdvancedSearchBuilder:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_query = {}
        self.filters = []
        self.facets = []

    def query(self, text: str, mode: str = "natural"):
        """Set the main search query"""
        self.base_query.update({
            "query": text,
            "searchMode": mode
        })
        return self

    def in_databases(self, database_ids: List[str]):
        """Specify databases to search"""
        self.base_query["databases"] = database_ids
        return self

    def in_tables(self, table_names: List[str]):
        """Limit search to specific tables"""
        self.base_query["tables"] = table_names
        return self

    def in_columns(self, column_names: List[str]):
        """Limit search to specific columns"""
        self.base_query["columns"] = column_names
        return self

    def add_date_filter(self, column: str, start_date: str, end_date: str):
        """Add date range filter"""
        self.filters.append({
            "type": "date_range",
            "column": column,
            "start": start_date,
            "end": end_date
        })
        return self

    def add_category_filter(self, column: str, values: List[str]):
        """Add category filter"""
        self.filters.append({
            "type": "category",
            "column": column,
            "values": values
        })
        return self

    def add_numeric_range(self, column: str, min_val: float, max_val: float):
        """Add numeric range filter"""
        self.filters.append({
            "type": "numeric_range",
            "column": column,
            "min": min_val,
            "max": max_val
        })
        return self

    def add_facet(self, column: str, limit: int = 10):
        """Add facet for result aggregation"""
        self.facets.append({
            "column": column,
            "limit": limit
        })
        return self

    def build_query(self):
        """Build the final search query with filters"""
        query = self.base_query.copy()

        if self.filters:
            # Convert filters to query modifications
            query = self._apply_filters(query)

        if self.facets:
            query["includeFacets"] = True
            query["facets"] = self.facets

        return query

    def _apply_filters(self, query):
        """Apply filters to the search query"""
        # For demonstration - in practice, this would modify the query
        # or use post-processing filters
        filter_conditions = []

        for filter_config in self.filters:
            if filter_config["type"] == "date_range":
                condition = f"{filter_config['column']} BETWEEN '{filter_config['start']}' AND '{filter_config['end']}'"
                filter_conditions.append(condition)
            elif filter_config["type"] == "category":
                values = "', '".join(filter_config["values"])
                condition = f"{filter_config['column']} IN ('{values}')"
                filter_conditions.append(condition)

        if filter_conditions:
            query["additionalFilters"] = filter_conditions

        return query

    async def execute(self):
        """Execute the built search query"""
        query = self.build_query()

        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://api.altus4.com/api/v1/search",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json=query
            ) as response:
                return await response.json()

# Usage examples
async def advanced_filtering_examples():
    builder = AdvancedSearchBuilder(api_key)

    # Example 1: Blog post search with date and category filters
    blog_results = await (builder
        .query("machine learning", "semantic")
        .in_databases(["blog_db"])
        .in_tables(["posts", "articles"])
        .add_date_filter("published_at", "2024-01-01", "2024-12-31")
        .add_category_filter("category", ["AI", "Technology", "Data Science"])
        .add_facet("author", 5)
        .add_facet("category", 10)
        .execute())

    # Example 2: Product search with price range
    product_results = await (AdvancedSearchBuilder(api_key)
        .query("gaming laptop", "natural")
        .in_databases(["ecommerce_db"])
        .in_tables(["products"])
        .add_numeric_range("price", 800.0, 2000.0)
        .add_category_filter("brand", ["ASUS", "MSI", "Alienware"])
        .add_facet("brand", 5)
        .add_facet("rating", 5)
        .execute())

    return blog_results, product_results

# Run examples
blog_results, product_results = await advanced_filtering_examples()
```

## Performance Optimization Techniques

### Query Performance Analysis

```javascript
class SearchPerformanceAnalyzer {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.performanceHistory = [];
  }

  async analyzeQuery(query, databases, options = {}) {
    const startTime = Date.now();

    // Execute search with analysis
    const searchRequest = {
      query,
      databases,
      includeAnalytics: true,
      includeQueryAnalysis: true,
      ...options,
    };

    const response = await fetch('https://api.altus4.com/api/v1/search/analyze', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(searchRequest),
    });

    const result = await response.json();
    const totalTime = Date.now() - startTime;

    // Store performance data
    const performanceData = {
      query,
      databases,
      executionTime: result.data?.executionTime || 0,
      totalTime,
      resultCount: result.data?.totalCount || 0,
      timestamp: new Date(),
      analysis: result.data?.queryAnalysis,
    };

    this.performanceHistory.push(performanceData);

    return {
      ...result,
      performanceData,
    };
  }

  getPerformanceInsights() {
    if (this.performanceHistory.length === 0) return null;

    const avgExecutionTime =
      this.performanceHistory.reduce((sum, item) => sum + item.executionTime, 0) /
      this.performanceHistory.length;

    const slowQueries = this.performanceHistory
      .filter(item => item.executionTime > avgExecutionTime * 2)
      .sort((a, b) => b.executionTime - a.executionTime);

    const fastQueries = this.performanceHistory
      .filter(item => item.executionTime < avgExecutionTime * 0.5)
      .sort((a, b) => a.executionTime - b.executionTime);

    return {
      totalQueries: this.performanceHistory.length,
      averageExecutionTime: Math.round(avgExecutionTime),
      slowQueries: slowQueries.slice(0, 5),
      fastQueries: fastQueries.slice(0, 5),
      recommendations: this.generateRecommendations(slowQueries),
    };
  }

  generateRecommendations(slowQueries) {
    const recommendations = [];

    // Analyze slow queries for patterns
    const longQueries = slowQueries.filter(q => q.query.length > 100);
    if (longQueries.length > 0) {
      recommendations.push({
        type: 'query_length',
        message: 'Consider shortening very long queries for better performance',
        examples: longQueries.slice(0, 2).map(q => q.query.substring(0, 50) + '...'),
      });
    }

    const broadQueries = slowQueries.filter(
      q => q.query.split(' ').length < 3 && q.resultCount > 1000
    );
    if (broadQueries.length > 0) {
      recommendations.push({
        type: 'query_specificity',
        message: 'Add more specific terms to broad queries that return many results',
        examples: broadQueries.slice(0, 2).map(q => q.query),
      });
    }

    return recommendations;
  }

  async optimizeQuery(originalQuery, databases) {
    // Get AI-powered query optimization suggestions
    const response = await fetch('https://api.altus4.com/api/v1/search/optimize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: originalQuery,
        databases,
        includeAlternatives: true,
      }),
    });

    return await response.json();
  }
}

// Usage
const analyzer = new SearchPerformanceAnalyzer(apiKey);

// Analyze multiple queries
const queries = [
  'mysql performance optimization',
  'database',
  'how to improve query speed in mysql database management system',
  'index btree',
];

for (const query of queries) {
  const result = await analyzer.analyzeQuery(query, ['tech_db']);
  console.log(`Query: "${query}" took ${result.performanceData.executionTime}ms`);
}

// Get insights
const insights = analyzer.getPerformanceInsights();
console.log('Performance Insights:', insights);

// Optimize a slow query
const optimization = await analyzer.optimizeQuery(
  'how to improve query speed in mysql database management system',
  ['tech_db']
);
console.log('Optimization suggestions:', optimization.data.suggestions);
```

### Caching Strategies

```python
import hashlib
import json
import time
from typing import Optional, Dict, Any
import redis

class IntelligentSearchCache:
    def __init__(self, redis_client: redis.Redis, default_ttl: int = 300):
        self.redis = redis_client
        self.default_ttl = default_ttl
        self.hit_count = 0
        self.miss_count = 0

    def generate_cache_key(self, query: str, databases: list, options: dict = None) -> str:
        """Generate a deterministic cache key"""
        cache_data = {
            "query": query.lower().strip(),
            "databases": sorted(databases),
            "options": options or {}
        }

        # Create hash of the search parameters
        cache_string = json.dumps(cache_data, sort_keys=True)
        return f"search:{hashlib.md5(cache_string.encode()).hexdigest()}"

    def get_cached_result(self, query: str, databases: list, options: dict = None) -> Optional[Dict[Any, Any]]:
        """Retrieve cached search result"""
        cache_key = self.generate_cache_key(query, databases, options)

        try:
            cached_data = self.redis.get(cache_key)
            if cached_data:
                self.hit_count += 1
                result = json.loads(cached_data)

                # Add cache metadata
                result["cached"] = True
                result["cache_hit_time"] = time.time()

                return result
            else:
                self.miss_count += 1
                return None

        except Exception as e:
            print(f"Cache retrieval error: {e}")
            self.miss_count += 1
            return None

    def cache_result(self, query: str, databases: list, result: dict, options: dict = None, custom_ttl: int = None):
        """Cache search result with intelligent TTL"""
        cache_key = self.generate_cache_key(query, databases, options)
        ttl = custom_ttl or self.calculate_intelligent_ttl(result)

        try:
            # Add cache metadata
            cache_data = {
                **result,
                "cached_at": time.time(),
                "cache_ttl": ttl
            }

            self.redis.setex(
                cache_key,
                ttl,
                json.dumps(cache_data, default=str)
            )

        except Exception as e:
            print(f"Cache storage error: {e}")

    def calculate_intelligent_ttl(self, result: dict) -> int:
        """Calculate TTL based on result characteristics"""
        base_ttl = self.default_ttl

        # Longer TTL for results with many matches (likely stable)
        result_count = result.get("data", {}).get("totalCount", 0)
        if result_count > 100:
            base_ttl *= 2
        elif result_count < 5:
            base_ttl //= 2

        # Shorter TTL for very fast queries (likely simple/cached upstream)
        execution_time = result.get("data", {}).get("executionTime", 0)
        if execution_time < 50:  # Very fast queries
            base_ttl //= 2
        elif execution_time > 1000:  # Slow queries benefit more from caching
            base_ttl *= 3

        return max(60, min(base_ttl, 3600))  # Between 1 minute and 1 hour

    def invalidate_pattern(self, pattern: str):
        """Invalidate cache entries matching a pattern"""
        try:
            keys = self.redis.keys(f"search:*{pattern}*")
            if keys:
                self.redis.delete(*keys)
                return len(keys)
            return 0
        except Exception as e:
            print(f"Cache invalidation error: {e}")
            return 0

    def get_cache_stats(self) -> dict:
        """Get cache performance statistics"""
        total_requests = self.hit_count + self.miss_count
        hit_rate = (self.hit_count / total_requests * 100) if total_requests > 0 else 0

        return {
            "hit_count": self.hit_count,
            "miss_count": self.miss_count,
            "hit_rate": round(hit_rate, 2),
            "total_requests": total_requests
        }

class CachedSearchClient:
    def __init__(self, api_key: str, redis_client: redis.Redis):
        self.api_key = api_key
        self.cache = IntelligentSearchCache(redis_client)

    async def search(self, query: str, databases: list, options: dict = None) -> dict:
        """Search with intelligent caching"""
        # Check cache first
        cached_result = self.cache.get_cached_result(query, databases, options)
        if cached_result:
            return cached_result

        # Execute actual search
        search_request = {
            "query": query,
            "databases": databases,
            **(options or {})
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://api.altus4.com/api/v1/search",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json=search_request
            ) as response:
                result = await response.json()

        # Cache the result
        if result.get("success"):
            self.cache.cache_result(query, databases, result, options)

        return result

    def warm_cache(self, common_queries: list, databases: list):
        """Pre-warm cache with common queries"""
        for query in common_queries:
            asyncio.create_task(self.search(query, databases))

# Usage
redis_client = redis.Redis(host='localhost', port=6379, db=0)
cached_client = CachedSearchClient(api_key, redis_client)

# Perform searches with caching
result1 = await cached_client.search("mysql optimization", ["db1"])
result2 = await cached_client.search("mysql optimization", ["db1"])  # Cache hit

# Check cache performance
stats = cached_client.cache.get_cache_stats()
print(f"Cache hit rate: {stats['hit_rate']}%")
```

## Search Result Enhancement

### AI-Powered Result Processing

```javascript
class SearchResultEnhancer {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  async enhanceResults(searchResults, enhancementOptions = {}) {
    const enhancements = [];

    // Add semantic categorization
    if (enhancementOptions.categorize !== false) {
      enhancements.push(this.addSemanticCategories(searchResults));
    }

    // Add relevance explanations
    if (enhancementOptions.explainRelevance) {
      enhancements.push(this.addRelevanceExplanations(searchResults));
    }

    // Add related suggestions
    if (enhancementOptions.relatedSuggestions) {
      enhancements.push(this.addRelatedSuggestions(searchResults));
    }

    // Add content summaries
    if (enhancementOptions.summarize) {
      enhancements.push(this.addContentSummaries(searchResults));
    }

    const enhancedResults = await Promise.all(enhancements);

    // Merge all enhancements
    return this.mergeEnhancements(searchResults, enhancedResults);
  }

  async addSemanticCategories(searchResults) {
    const response = await fetch('https://api.altus4.com/api/v1/search/categorize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        results: searchResults.data.results.slice(0, 20), // Limit for API efficiency
        categoryTypes: ['topic', 'content_type', 'difficulty_level'],
      }),
    });

    return await response.json();
  }

  async addRelevanceExplanations(searchResults) {
    const explanations = searchResults.data.results.map(result => {
      const factors = [];

      // Analyze relevance factors
      if (result.relevanceScore > 0.8) {
        factors.push('High keyword match in title or content');
      }

      if (result.matchedColumns.includes('title')) {
        factors.push('Query terms found in title');
      }

      if (result.snippet && result.snippet.length > 100) {
        factors.push('Substantial content match');
      }

      return {
        resultId: result.id,
        relevanceFactors: factors,
        scoreBreakdown: {
          keywordMatch: Math.min(result.relevanceScore * 0.6, 0.6),
          titleBoost: result.matchedColumns.includes('title') ? 0.2 : 0,
          contentDepth: Math.min(result.relevanceScore * 0.2, 0.2),
        },
      };
    });

    return { explanations };
  }

  async addRelatedSuggestions(searchResults) {
    // Extract key terms from top results
    const topResults = searchResults.data.results.slice(0, 5);
    const keyTerms = this.extractKeyTerms(topResults);

    const response = await fetch('https://api.altus4.com/api/v1/search/suggestions', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      params: {
        query: keyTerms.join(' '),
        type: 'related',
        limit: 5,
      },
    });

    return await response.json();
  }

  extractKeyTerms(results) {
    const termFrequency = new Map();

    results.forEach(result => {
      const text = `${result.data.title || ''} ${result.snippet || ''}`.toLowerCase();
      const words = text.match(/\b\w{4,}\b/g) || []; // Words with 4+ characters

      words.forEach(word => {
        termFrequency.set(word, (termFrequency.get(word) || 0) + 1);
      });
    });

    // Return top terms
    return Array.from(termFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([term]) => term);
  }

  async addContentSummaries(searchResults) {
    const summaries = await Promise.all(
      searchResults.data.results.slice(0, 10).map(async result => {
        if (!result.data.content || result.data.content.length < 200) {
          return { resultId: result.id, summary: result.snippet };
        }

        // Use AI to generate summary
        const response = await fetch('https://api.altus4.com/api/v1/ai/summarize', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: result.data.content,
            maxLength: 150,
            style: 'informative',
          }),
        });

        const summaryData = await response.json();
        return {
          resultId: result.id,
          summary: summaryData.data?.summary || result.snippet,
        };
      })
    );

    return { summaries };
  }

  mergeEnhancements(originalResults, enhancements) {
    const enhanced = JSON.parse(JSON.stringify(originalResults)); // Deep copy

    enhancements.forEach(enhancement => {
      if (enhancement.explanations) {
        enhancement.explanations.forEach(explanation => {
          const result = enhanced.data.results.find(r => r.id === explanation.resultId);
          if (result) {
            result.relevanceExplanation = explanation;
          }
        });
      }

      if (enhancement.summaries) {
        enhancement.summaries.forEach(summary => {
          const result = enhanced.data.results.find(r => r.id === summary.resultId);
          if (result) {
            result.aiSummary = summary.summary;
          }
        });
      }

      if (enhancement.data?.categories) {
        enhanced.data.categories = enhancement.data.categories;
      }

      if (enhancement.data?.suggestions) {
        enhanced.data.relatedSuggestions = enhancement.data.suggestions;
      }
    });

    return enhanced;
  }
}

// Usage
const enhancer = new SearchResultEnhancer(apiKey);

// Perform search and enhance results
const searchResults = await fetch('https://api.altus4.com/api/v1/search', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    query: 'database performance optimization',
    databases: ['tech_db'],
    limit: 20,
  }),
}).then(r => r.json());

// Enhance the results
const enhancedResults = await enhancer.enhanceResults(searchResults, {
  categorize: true,
  explainRelevance: true,
  relatedSuggestions: true,
  summarize: true,
});

console.log('Enhanced results with AI categorization and summaries:', enhancedResults);
```

## Next Steps

You've mastered advanced query techniques! Continue exploring:

- **[AI Integration](./ai-integration.md)** - Leverage semantic search and AI enhancements
- **[Multi-Database Search](./multi-database.md)** - Advanced federation strategies
- **[SDK Usage](./sdk.md)** - Using official SDKs for your language
- **[API Reference](../api/search.md)** - Complete API documentation

---

**Advanced queries unlock the full power of Altus 4's search capabilities. Experiment with these patterns to build sophisticated search experiences.**
