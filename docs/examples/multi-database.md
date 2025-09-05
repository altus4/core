---
title: Multi-Database Search Examples
description: Learn how to search across multiple databases simultaneously with advanced federation strategies and result aggregation.
---

# Multi-Database Search Examples

Advanced Federation Strategies and Result Aggregation

This guide demonstrates how to perform sophisticated searches across multiple databases simultaneously, with intelligent result aggregation and performance optimization.

## Prerequisites

- Multiple database connections configured in Altus 4
- Understanding of [Basic Search](./basic-search.md) concepts
- API key with appropriate permissions

## Basic Multi-Database Search

### Simple Federation

Search across multiple databases with a single request:

```bash
curl -X POST https://api.altus4.com/api/v1/search \
  -H "Authorization: Bearer altus4_sk_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "query": "database optimization techniques",
    "databases": [
      "primary_docs_db",
      "community_db",
      "legacy_docs_db"
    ],
    "searchMode": "semantic",
    "limit": 30
  }'
```

**Response includes results from all databases:**

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "id": "primary_docs_db_articles_123",
        "database": "primary_docs_db",
        "table": "articles",
        "relevanceScore": 0.95,
        "data": {
          "title": "Advanced MySQL Optimization",
          "content": "Complete guide to database optimization..."
        }
      },
      {
        "id": "community_db_posts_456",
        "database": "community_db",
        "table": "forum_posts",
        "relevanceScore": 0.87,
        "data": {
          "title": "Community Tips for DB Performance",
          "content": "User-contributed optimization strategies..."
        }
      }
    ],
    "totalCount": 45,
    "executionTime": 234,
    "databasesSearched": 3
  }
}
```

## Advanced Federation Strategies

### Weighted Database Search

Assign different weights to databases based on content quality or relevance:

```javascript
class WeightedMultiDatabaseSearch {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.databaseWeights = new Map();
  }

  setDatabaseWeight(databaseId, weight) {
    this.databaseWeights.set(databaseId, weight);
  }

  async weightedSearch(query, databases, options = {}) {
    // Execute searches in parallel
    const searchPromises = databases.map(async dbId => {
      const response = await fetch('https://api.altus4.com/api/v1/search', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          databases: [dbId],
          searchMode: options.searchMode || 'natural',
          limit: options.limit || 50,
        }),
      });

      const data = await response.json();

      // Apply database weight to results
      const weight = this.databaseWeights.get(dbId) || 1.0;
      if (data.success && data.data.results) {
        data.data.results.forEach(result => {
          result.originalRelevance = result.relevanceScore;
          result.relevanceScore = result.relevanceScore * weight;
          result.databaseWeight = weight;
        });
      }

      return data;
    });

    const results = await Promise.allSettled(searchPromises);
    return this.aggregateWeightedResults(results);
  }

  aggregateWeightedResults(results) {
    const allResults = [];
    let totalExecutionTime = 0;
    let successfulDatabases = 0;

    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value.success) {
        allResults.push(...result.value.data.results);
        totalExecutionTime += result.value.data.executionTime;
        successfulDatabases++;
      }
    });

    // Sort by weighted relevance
    allResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return {
      success: true,
      data: {
        results: allResults,
        totalCount: allResults.length,
        executionTime: totalExecutionTime,
        databasesSearched: successfulDatabases,
        aggregationStrategy: 'weighted_relevance',
      },
    };
  }
}

// Usage
const searcher = new WeightedMultiDatabaseSearch(apiKey);

// Set database weights
searcher.setDatabaseWeight('primary_docs_db', 1.5); // Highest quality
searcher.setDatabaseWeight('community_db', 1.0); // Standard weight
searcher.setDatabaseWeight('legacy_docs_db', 0.7); // Lower priority

const results = await searcher.weightedSearch(
  'mysql performance tuning',
  ['primary_docs_db', 'community_db', 'legacy_docs_db'],
  { searchMode: 'semantic', limit: 20 }
);
```

### Database-Specific Query Optimization

Optimize queries for different database types and content:

```python
import asyncio
import aiohttp
from typing import Dict, List, Any

class DatabaseSpecificSearcher:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.database_profiles = {}

    def configure_database(self, db_id: str, profile: Dict[str, Any]):
        """Configure database-specific search parameters"""
        self.database_profiles[db_id] = {
            'content_type': profile.get('content_type', 'general'),
            'search_mode': profile.get('search_mode', 'natural'),
            'boost_fields': profile.get('boost_fields', []),
            'query_expansion': profile.get('query_expansion', False),
            'result_limit': profile.get('result_limit', 20)
        }

    async def optimized_multi_search(
        self,
        base_query: str,
        databases: List[str]
    ) -> Dict[str, Any]:
        """Execute optimized searches across multiple databases"""

        search_tasks = []
        for db_id in databases:
            profile = self.database_profiles.get(db_id, {})
            optimized_query = await self.optimize_query_for_database(base_query, profile)

            task = self.search_database(db_id, optimized_query, profile)
            search_tasks.append(task)

        results = await asyncio.gather(*search_tasks, return_exceptions=True)
        return self.merge_optimized_results(results, databases)

    async def optimize_query_for_database(
        self,
        query: str,
        profile: Dict[str, Any]
    ) -> str:
        """Optimize query based on database profile"""

        content_type = profile.get('content_type', 'general')

        # Content-type specific optimizations
        if content_type == 'technical':
            # Add technical terms and expand acronyms
            query = await self.expand_technical_terms(query)
        elif content_type == 'community':
            # Use more casual language variations
            query = await self.add_casual_variations(query)
        elif content_type == 'documentation':
            # Focus on procedural and how-to terms
            query = await self.add_procedural_terms(query)

        return query

    async def expand_technical_terms(self, query: str) -> str:
        """Expand technical terms for better matching"""
        expansions = {
            'db': 'database',
            'perf': 'performance',
            'config': 'configuration',
            'auth': 'authentication'
        }

        expanded_query = query
        for abbrev, full_term in expansions.items():
            if abbrev in query.lower():
                expanded_query += f' {full_term}'

        return expanded_query

    async def add_casual_variations(self, query: str) -> str:
        """Add casual language variations for community content"""
        casual_terms = {
            'optimize': 'speed up improve faster',
            'configure': 'setup set up',
            'troubleshoot': 'fix debug solve'
        }

        expanded_query = query
        for formal, casual in casual_terms.items():
            if formal in query.lower():
                expanded_query += f' {casual}'

        return expanded_query

    async def add_procedural_terms(self, query: str) -> str:
        """Add procedural terms for documentation"""
        procedural_terms = ['how to', 'step by step', 'guide', 'tutorial', 'instructions']

        # Add procedural context if not present
        if not any(term in query.lower() for term in procedural_terms):
            return f'how to {query} guide tutorial'

        return query

    async def search_database(
        self,
        db_id: str,
        query: str,
        profile: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Search a single database with optimized parameters"""

        search_request = {
            'query': query,
            'databases': [db_id],
            'searchMode': profile.get('search_mode', 'natural'),
            'limit': profile.get('result_limit', 20)
        }

        # Add boost fields if specified
        if profile.get('boost_fields'):
            search_request['columns'] = profile['boost_fields']

        async with aiohttp.ClientSession() as session:
            async with session.post(
                'https://api.altus4.com/api/v1/search',
                headers={'Authorization': f'Bearer {self.api_key}'},
                json=search_request
            ) as response:
                return await response.json()

    def merge_optimized_results(
        self,
        results: List[Any],
        databases: List[str]
    ) -> Dict[str, Any]:
        """Merge results with optimization metadata"""

        merged_results = []
        total_time = 0
        successful_dbs = 0

        for i, result in enumerate(results):
            if isinstance(result, Exception):
                continue

            if result.get('success'):
                successful_dbs += 1
                total_time += result['data']['executionTime']

                # Add optimization metadata to each result
                for item in result['data']['results']:
                    item['optimization_applied'] = True
                    item['database_profile'] = self.database_profiles.get(databases[i], {})
                    merged_results.append(item)

        # Sort by relevance
        merged_results.sort(key=lambda x: x['relevanceScore'], reverse=True)

        return {
            'success': True,
            'data': {
                'results': merged_results,
                'totalCount': len(merged_results),
                'executionTime': total_time,
                'databasesSearched': successful_dbs,
                'optimizationStrategy': 'database_specific'
            }
        }

# Usage example
async def database_specific_search_example():
    searcher = DatabaseSpecificSearcher(api_key)

    # Configure different database profiles
    searcher.configure_database('tech_docs_db', {
        'content_type': 'technical',
        'search_mode': 'semantic',
        'boost_fields': ['title', 'summary', 'tags'],
        'result_limit': 25
    })

    searcher.configure_database('community_forum_db', {
        'content_type': 'community',
        'search_mode': 'natural',
        'boost_fields': ['title', 'content'],
        'result_limit': 15
    })

    searcher.configure_database('user_guides_db', {
        'content_type': 'documentation',
        'search_mode': 'semantic',
        'boost_fields': ['title', 'steps', 'description'],
        'result_limit': 20
    })

    # Execute optimized multi-database search
    results = await searcher.optimized_multi_search(
        'mysql performance optimization',
        ['tech_docs_db', 'community_forum_db', 'user_guides_db']
    )

    print(f"Found {results['data']['totalCount']} results across {results['data']['databasesSearched']} databases")
    return results

# Run the example
results = await database_specific_search_example()
```

## Result Aggregation Strategies

### Intelligent Result Merging

Merge results from multiple databases with deduplication and ranking:

```javascript
class IntelligentResultAggregator {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  async aggregateWithDeduplication(searchResults, options = {}) {
    const {
      deduplicationStrategy = 'content_similarity',
      rankingStrategy = 'hybrid',
      maxResults = 50,
    } = options;

    // Flatten all results
    const allResults = searchResults.flatMap(result => (result.success ? result.data.results : []));

    // Apply deduplication
    const deduplicatedResults = await this.deduplicateResults(allResults, deduplicationStrategy);

    // Apply intelligent ranking
    const rankedResults = await this.rankResults(deduplicatedResults, rankingStrategy);

    // Apply result limit
    const finalResults = rankedResults.slice(0, maxResults);

    return {
      success: true,
      data: {
        results: finalResults,
        totalCount: finalResults.length,
        originalCount: allResults.length,
        deduplicationApplied: allResults.length !== deduplicatedResults.length,
        rankingStrategy,
      },
    };
  }

  async deduplicateResults(results, strategy) {
    switch (strategy) {
      case 'content_similarity':
        return await this.deduplicateBySimilarity(results);
      case 'exact_match':
        return this.deduplicateByExactMatch(results);
      case 'title_match':
        return this.deduplicateByTitle(results);
      default:
        return results;
    }
  }

  async deduplicateBySimilarity(results) {
    const uniqueResults = [];
    const similarityThreshold = 0.8;

    for (const result of results) {
      const isDuplicate = await this.checkSimilarity(result, uniqueResults, similarityThreshold);
      if (!isDuplicate) {
        uniqueResults.push(result);
      }
    }

    return uniqueResults;
  }

  async checkSimilarity(newResult, existingResults, threshold) {
    for (const existing of existingResults) {
      const similarity = await this.calculateContentSimilarity(
        newResult.data.title + ' ' + newResult.snippet,
        existing.data.title + ' ' + existing.snippet
      );

      if (similarity > threshold) {
        // Keep the result with higher relevance
        if (newResult.relevanceScore > existing.relevanceScore) {
          const index = existingResults.indexOf(existing);
          existingResults[index] = newResult;
        }
        return true;
      }
    }
    return false;
  }

  async calculateContentSimilarity(text1, text2) {
    // Simple similarity calculation - in production, use more sophisticated methods
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size; // Jaccard similarity
  }

  deduplicateByExactMatch(results) {
    const seen = new Set();
    return results.filter(result => {
      const key = `${result.data.title}-${result.database}-${result.table}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  deduplicateByTitle(results) {
    const titleMap = new Map();

    results.forEach(result => {
      const title = result.data.title?.toLowerCase();
      if (!title) return;

      if (!titleMap.has(title) || result.relevanceScore > titleMap.get(title).relevanceScore) {
        titleMap.set(title, result);
      }
    });

    return Array.from(titleMap.values());
  }

  async rankResults(results, strategy) {
    switch (strategy) {
      case 'relevance_only':
        return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
      case 'database_priority':
        return this.rankByDatabasePriority(results);
      case 'hybrid':
        return await this.hybridRanking(results);
      case 'freshness':
        return this.rankByFreshness(results);
      default:
        return results;
    }
  }

  rankByDatabasePriority(results) {
    const databasePriority = {
      primary_docs_db: 3,
      official_docs_db: 2,
      community_db: 1,
      legacy_db: 0,
    };

    return results.sort((a, b) => {
      const priorityA = databasePriority[a.database] || 0;
      const priorityB = databasePriority[b.database] || 0;

      if (priorityA !== priorityB) {
        return priorityB - priorityA;
      }

      return b.relevanceScore - a.relevanceScore;
    });
  }

  async hybridRanking(results) {
    // Combine multiple ranking factors
    return results
      .map(result => {
        const relevanceScore = result.relevanceScore * 0.4;
        const databaseScore = this.getDatabaseScore(result.database) * 0.3;
        const freshnessScore = this.getFreshnessScore(result.data.updated_at) * 0.2;
        const engagementScore = this.getEngagementScore(result.data) * 0.1;

        result.hybridScore = relevanceScore + databaseScore + freshnessScore + engagementScore;
        return result;
      })
      .sort((a, b) => b.hybridScore - a.hybridScore);
  }

  getDatabaseScore(database) {
    const scores = {
      primary_docs_db: 1.0,
      official_docs_db: 0.8,
      community_db: 0.6,
      legacy_db: 0.3,
    };
    return scores[database] || 0.5;
  }

  getFreshnessScore(updatedAt) {
    if (!updatedAt) return 0;

    const now = new Date();
    const updated = new Date(updatedAt);
    const daysDiff = (now - updated) / (1000 * 60 * 60 * 24);

    // Fresher content gets higher score
    return Math.max(0, 1 - daysDiff / 365); // Decay over a year
  }

  getEngagementScore(data) {
    // Calculate engagement based on available metrics
    const views = data.view_count || 0;
    const likes = data.like_count || 0;
    const comments = data.comment_count || 0;

    return Math.min(1, views * 0.001 + likes * 0.01 + comments * 0.1);
  }
}

// Usage
const aggregator = new IntelligentResultAggregator(apiKey);

// Execute multiple searches
const searchPromises = [
  fetch('https://api.altus4.com/api/v1/search', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      query: 'database optimization',
      databases: ['primary_docs_db'],
      limit: 20,
    }),
  }).then(r => r.json()),

  fetch('https://api.altus4.com/api/v1/search', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      query: 'database optimization',
      databases: ['community_db'],
      limit: 15,
    }),
  }).then(r => r.json()),
];

const searchResults = await Promise.all(searchPromises);

// Aggregate with intelligent deduplication and ranking
const aggregatedResults = await aggregator.aggregateWithDeduplication(searchResults, {
  deduplicationStrategy: 'content_similarity',
  rankingStrategy: 'hybrid',
  maxResults: 30,
});

console.log(
  `Aggregated ${aggregatedResults.data.totalCount} unique results from ${aggregatedResults.data.originalCount} total results`
);
```

## Performance Optimization

### Parallel Search Execution

Optimize performance with intelligent parallel execution:

```python
import asyncio
import aiohttp
import time
from typing import List, Dict, Any

class HighPerformanceMultiSearch:
    def __init__(self, api_key: str, max_concurrent: int = 5):
        self.api_key = api_key
        self.max_concurrent = max_concurrent
        self.performance_metrics = []

    async def parallel_search(
        self,
        query: str,
        databases: List[str],
        options: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Execute searches in parallel with performance optimization"""

        start_time = time.time()

        # Create semaphore to limit concurrent requests
        semaphore = asyncio.Semaphore(self.max_concurrent)

        # Create search tasks
        search_tasks = [
            self.search_with_semaphore(semaphore, query, db_id, options or {})
            for db_id in databases
        ]

        # Execute with timeout
        try:
            results = await asyncio.wait_for(
                asyncio.gather(*search_tasks, return_exceptions=True),
                timeout=30.0  # 30 second timeout
            )
        except asyncio.TimeoutError:
            results = [Exception("Search timeout") for _ in databases]

        # Process results
        successful_results = []
        failed_databases = []

        for i, result in enumerate(results):
            if isinstance(result, Exception):
                failed_databases.append(databases[i])
            elif result.get('success'):
                successful_results.append(result)
            else:
                failed_databases.append(databases[i])

        # Aggregate results
        aggregated = self.aggregate_parallel_results(successful_results)

        # Record performance metrics
        total_time = time.time() - start_time
        self.record_performance_metrics({
            'total_databases': len(databases),
            'successful_databases': len(successful_results),
            'failed_databases': len(failed_databases),
            'total_time': total_time,
            'concurrent_limit': self.max_concurrent
        })

        return {
            **aggregated,
            'performance': {
                'totalTime': total_time,
                'databasesSearched': len(successful_results),
                'failedDatabases': failed_databases,
                'concurrentRequests': min(len(databases), self.max_concurrent)
            }
        }

    async def search_with_semaphore(
        self,
        semaphore: asyncio.Semaphore,
        query: str,
        database_id: str,
        options: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute single search with semaphore control"""

        async with semaphore:
            try:
                async with aiohttp.ClientSession() as session:
                    search_request = {
                        'query': query,
                        'databases': [database_id],
                        'searchMode': options.get('searchMode', 'natural'),
                        'limit': options.get('limit', 20)
                    }

                    async with session.post(
                        'https://api.altus4.com/api/v1/search',
                        headers={'Authorization': f'Bearer {self.api_key}'},
                        json=search_request,
                        timeout=aiohttp.ClientTimeout(total=15)
                    ) as response:
                        return await response.json()

            except Exception as e:
                return {'success': False, 'error': str(e), 'database': database_id}

    def aggregate_parallel_results(self, results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Aggregate results from parallel searches"""

        all_results = []
        total_execution_time = 0

        for result in results:
            if result.get('data', {}).get('results'):
                all_results.extend(result['data']['results'])
                total_execution_time += result['data'].get('executionTime', 0)

        # Sort by relevance
        all_results.sort(key=lambda x: x.get('relevanceScore', 0), reverse=True)

        return {
            'success': True,
            'data': {
                'results': all_results,
                'totalCount': len(all_results),
                'executionTime': total_execution_time,
                'aggregationMethod': 'parallel_merge'
            }
        }

    def record_performance_metrics(self, metrics: Dict[str, Any]):
        """Record performance metrics for analysis"""
        self.performance_metrics.append({
            **metrics,
            'timestamp': time.time()
        })

    def get_performance_analysis(self) -> Dict[str, Any]:
        """Analyze performance metrics"""
        if not self.performance_metrics:
            return {'status': 'no_data'}

        recent_metrics = self.performance_metrics[-10:]  # Last 10 searches

        avg_time = sum(m['total_time'] for m in recent_metrics) / len(recent_metrics)
        avg_success_rate = sum(
            m['successful_databases'] / m['total_databases']
            for m in recent_metrics
        ) / len(recent_metrics)

        return {
            'average_search_time': round(avg_time, 2),
            'average_success_rate': round(avg_success_rate * 100, 1),
            'total_searches': len(self.performance_metrics),
            'concurrent_limit': self.max_concurrent,
            'recommendations': self.generate_performance_recommendations(recent_metrics)
        }

    def generate_performance_recommendations(self, metrics: List[Dict[str, Any]]) -> List[str]:
        """Generate performance optimization recommendations"""
        recommendations = []

        avg_time = sum(m['total_time'] for m in metrics) / len(metrics)
        avg_success_rate = sum(
            m['successful_databases'] / m['total_databases']
            for m in metrics
        ) / len(metrics)

        if avg_time > 5.0:
            recommendations.append("Consider reducing the number of concurrent databases or increasing timeout")

        if avg_success_rate < 0.9:
            recommendations.append("Some databases may be experiencing connectivity issues")

        if self.max_concurrent < 3:
            recommendations.append("Consider increasing concurrent request limit for better performance")

        return recommendations

# Usage example
async def high_performance_search_example():
    searcher = HighPerformanceMultiSearch(api_key, max_concurrent=8)

    # Search across many databases
    databases = [
        'primary_docs_db',
        'community_db',
        'legacy_docs_db',
        'api_docs_db',
        'tutorial_db',
        'faq_db',
        'blog_db',
        'support_db'
    ]

    results = await searcher.parallel_search(
        'mysql performance optimization best practices',
        databases,
        {
            'searchMode': 'semantic',
            'limit': 15
        }
    )

    print(f"Search completed in {results['performance']['totalTime']:.2f} seconds")
    print(f"Found {results['data']['totalCount']} results across {results['performance']['databasesSearched']} databases")

    # Get performance analysis
    analysis = searcher.get_performance_analysis()
    print(f"Average search time: {analysis['average_search_time']} seconds")
    print(f"Success rate: {analysis['average_success_rate']}%")

    return results

# Run the high-performance search
results = await high_performance_search_example()
```

## Best Practices

### 1. Database Selection Strategy

Choose databases intelligently based on query context:

```javascript
class SmartDatabaseSelector {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.databaseProfiles = new Map();
  }

  async selectOptimalDatabases(query, availableDatabases, maxDatabases = 5) {
    // Analyze query to determine optimal database selection
    const queryAnalysis = await this.analyzeQuery(query);

    // Score databases based on query relevance
    const databaseScores = await Promise.all(
      availableDatabases.map(async dbId => {
        const profile = await this.getDatabaseProfile(dbId);
        const score = this.calculateDatabaseRelevance(queryAnalysis, profile);
        return { databaseId: dbId, score, profile };
      })
    );

    // Select top databases
    return databaseScores
      .sort((a, b) => b.score - a.score)
      .slice(0, maxDatabases)
      .map(item => item.databaseId);
  }

  async analyzeQuery(query) {
    // Simple query analysis - in production, use more sophisticated NLP
    const keywords = query.toLowerCase().split(/\s+/);
    const categories = [];

    if (keywords.some(word => ['api', 'endpoint', 'rest'].includes(word))) {
      categories.push('api_documentation');
    }

    if (keywords.some(word => ['tutorial', 'guide', 'how'].includes(word))) {
      categories.push('tutorials');
    }

    if (keywords.some(word => ['error', 'bug', 'issue', 'problem'].includes(word))) {
      categories.push('troubleshooting');
    }

    return { keywords, categories, complexity: keywords.length };
  }

  calculateDatabaseRelevance(queryAnalysis, databaseProfile) {
    let score = 0;

    // Category matching
    const categoryOverlap = queryAnalysis.categories.filter(cat =>
      databaseProfile.categories.includes(cat)
    ).length;
    score += categoryOverlap * 0.4;

    // Content freshness
    const daysSinceUpdate = (Date.now() - databaseProfile.lastUpdated) / (1000 * 60 * 60 * 24);
    score += Math.max(0, 1 - daysSinceUpdate / 365) * 0.3;

    // Database size (more content = higher chance of relevant results)
    score += Math.min(1, databaseProfile.documentCount / 10000) * 0.2;

    // Quality score
    score += databaseProfile.qualityScore * 0.1;

    return score;
  }
}
```

### 2. Error Handling and Resilience

Implement robust error handling for multi-database scenarios:

```python
class ResilientMultiDatabaseSearch:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.retry_config = {
            'max_retries': 3,
            'backoff_factor': 2,
            'timeout': 15
        }

    async def resilient_search(
        self,
        query: str,
        databases: List[str],
        min_successful_databases: int = 1
    ) -> Dict[str, Any]:
        """Execute search with retry logic and graceful degradation"""

        successful_results = []
        failed_databases = []

        for db_id in databases:
            try:
                result = await self.search_with_retry(query, db_id)
                if result.get('success'):
                    successful_results.append(result)
                else:
                    failed_databases.append({'database': db_id, 'error': 'Search failed'})

            except Exception as e:
                failed_databases.append({'database': db_id, 'error': str(e)})

        # Check if we have minimum required successful searches
        if len(successful_results) < min_successful_databases:
            raise Exception(f"Only {len(successful_results)} databases succeeded, minimum required: {min_successful_databases}")

        # Aggregate successful results
        aggregated = self.aggregate_results(successful_results)

        # Add error information
        aggregated['errors'] = failed_databases if failed_databases else None
        aggregated['partial_results'] = len(failed_databases) > 0

        return aggregated

    async def search_with_retry(self, query: str, database_id: str) -> Dict[str, Any]:
        """Search with exponential backoff retry"""

        for attempt in range(self.retry_config['max_retries']):
            try:
                async with aiohttp.ClientSession() as session:
                    timeout = aiohttp.ClientTimeout(total=self.retry_config['timeout'])

                    async with session.post(
                        'https://api.altus4.com/api/v1/search',
                        headers={'Authorization': f'Bearer {self.api_key}'},
                        json={
                            'query': query,
                            'databases': [database_id],
                            'limit': 20
                        },
                        timeout=timeout
                    ) as response:
                        return await response.json()

            except Exception as e:
                if attempt == self.retry_config['max_retries'] - 1:
                    raise e

                # Exponential backoff
                wait_time = self.retry_config['backoff_factor'] ** attempt
                await asyncio.sleep(wait_time)
```

## Next Steps

You've mastered multi-database search strategies! Continue exploring:

- **[SDK Usage](./sdk.md)** - Official SDKs with multi-database support
- **[Performance Guide](../testing/performance.md)** - Advanced optimization techniques
- **[API Reference](../api/search.md)** - Complete multi-database API documentation

---

**Multi-database search unlocks the full potential of federated search across your entire data ecosystem. Use these patterns to build comprehensive search experiences.**
