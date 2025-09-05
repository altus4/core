---
title: Search Operations
description: Complete guide to using Altus 4's powerful search API with natural language, boolean, and AI-enhanced semantic search capabilities.
---

# Search Operations

Comprehensive Search API Documentation

Altus 4 provides powerful search capabilities that enhance MySQL's native full-text search with AI-powered optimizations, semantic understanding, and multi-database federation.

## Search Overview

### Search Modes

Altus 4 supports three distinct search modes:

- **Natural Language** - Human-readable queries with automatic optimization
- **Boolean** - Traditional boolean operators (AND, OR, NOT) with MySQL syntax
- **Semantic** - AI-powered semantic search using OpenAI embeddings

### Search Architecture

```mermaid
graph TD
    A[Search Request] --> B[Query Processing]
    B --> C{Search Mode}
    C -->|Natural| D[Natural Language Processing]
    C -->|Boolean| E[Boolean Query Parser]
    C -->|Semantic| F[AI Semantic Analysis]
    D --> G[Multi-Database Execution]
    E --> G
    F --> G
    G --> H[Result Aggregation]
    H --> I[AI Enhancement]
    I --> J[Cache Storage]
    J --> K[Formatted Response]
```

## Core Search Endpoint

### Execute Search

Perform a search across one or more connected databases with comprehensive options.

**Endpoint**: `POST /api/v1/search`

**Headers**:

```http
Authorization: Bearer <YOUR_API_KEY>
Content-Type: application/json
```

**Request Body**:

```json
{
  "query": "database performance optimization techniques",
  "databases": ["db_uuid_1", "db_uuid_2"],
  "searchMode": "semantic",
  "limit": 20,
  "offset": 0,
  "filters": {
    "tables": ["articles", "documentation"],
    "dateRange": {
      "from": "2024-01-01",
      "to": "2024-12-31"
    },
    "minScore": 0.5
  },
  "options": {
    "includeSchema": true,
    "enableAI": true,
    "cacheResults": true,
    "returnMetadata": true
  }
}
```

**Request Parameters**:

| Parameter    | Type   | Required | Description                                           |
| ------------ | ------ | -------- | ----------------------------------------------------- |
| `query`      | string | Yes      | Search query (1-500 characters)                       |
| `databases`  | array  | Yes      | Array of database UUIDs to search                     |
| `searchMode` | enum   | No       | `natural`, `boolean`, `semantic` (default: `natural`) |
| `limit`      | number | No       | Max results per database (1-100, default: 20)         |
| `offset`     | number | No       | Results offset for pagination (default: 0)            |
| `filters`    | object | No       | Search filters and constraints                        |
| `options`    | object | No       | Additional search options                             |

**Filters Object**:

```json
{
  "tables": ["table1", "table2"], // Specific tables to search
  "columns": ["title", "content", "tags"], // Specific columns to search
  "dateRange": {
    "from": "2024-01-01", // ISO date string
    "to": "2024-12-31" // ISO date string
  },
  "minScore": 0.5, // Minimum relevance score (0-1)
  "exclude": ["archived", "deleted"] // Values to exclude
}
```

**Options Object**:

```json
{
  "includeSchema": true, // Include table/column metadata
  "enableAI": true, // Enable AI enhancements
  "cacheResults": true, // Cache results for performance
  "returnMetadata": true, // Include search metadata
  "highlightMatches": true, // Highlight search terms
  "fuzzyMatching": false // Enable fuzzy text matching
}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "id": "result_abc123",
        "database": {
          "id": "db_uuid_1",
          "name": "Documentation DB"
        },
        "table": "articles",
        "score": 0.95,
        "content": {
          "id": 1001,
          "title": "MySQL Performance Optimization Guide",
          "content": "Complete guide to optimizing MySQL database performance...",
          "created_at": "2024-01-15T10:30:00.000Z",
          "author": "John Doe"
        },
        "highlights": [
          "MySQL <mark>performance</mark> <mark>optimization</mark> techniques",
          "<mark>Database</mark> indexing strategies"
        ],
        "metadata": {
          "tableSchema": {
            "columns": ["id", "title", "content", "created_at", "author"],
            "indexes": ["title", "content"]
          }
        }
      }
    ],
    "summary": {
      "totalResults": 156,
      "totalDatabases": 2,
      "executionTime": 234,
      "cacheHit": false,
      "aiProcessingTime": 89
    },
    "aggregation": {
      "byDatabase": [
        {
          "databaseId": "db_uuid_1",
          "results": 89,
          "averageScore": 0.78
        }
      ],
      "byTable": [
        {
          "table": "articles",
          "results": 45,
          "averageScore": 0.82
        }
      ]
    },
    "aiInsights": {
      "categories": ["Performance", "Optimization", "MySQL"],
      "relatedQueries": [
        "mysql indexing strategies",
        "database query optimization",
        "mysql performance tuning"
      ],
      "summary": "Results focus on MySQL performance optimization techniques..."
    }
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "requestId": "req_abc123",
    "executionTime": 234
  }
}
```

## Search Modes

### Natural Language Search

Process human-readable queries with automatic optimization.

**Example Request**:

```json
{
  "query": "How to improve database query performance?",
  "databases": ["db_uuid_1"],
  "searchMode": "natural",
  "limit": 10
}
```

**Features**:

- Automatic query expansion and optimization
- Synonym detection and matching
- Natural language understanding
- Relevance-based ranking

### Boolean Search

Use traditional boolean operators for precise control.

**Example Request**:

```json
{
  "query": "(mysql OR postgresql) AND performance AND NOT deprecated",
  "databases": ["db_uuid_1"],
  "searchMode": "boolean",
  "limit": 15
}
```

**Supported Operators**:

- `AND` - Both terms must be present
- `OR` - Either term can be present
- `NOT` - Term must not be present
- `()` - Grouping for complex queries
- `""` - Exact phrase matching
- `*` - Wildcard matching

**Boolean Query Examples**:

```bash
# Exact phrase
"database optimization"

# Multiple terms (AND implied)
mysql performance tuning

# Explicit boolean operators
(mysql OR postgresql) AND (performance OR optimization)

# Exclude terms
database optimization NOT deprecated

# Wildcards
optim* AND databas*

# Complex grouping
(mysql AND performance) OR (postgresql AND "query optimization")
```

### Semantic Search

AI-powered search using embeddings for concept matching.

**Example Request**:

```json
{
  "query": "slow database queries",
  "databases": ["db_uuid_1"],
  "searchMode": "semantic",
  "options": {
    "enableAI": true
  }
}
```

**Features**:

- Concept-based matching beyond keywords
- Understanding of context and intent
- Cross-language semantic understanding
- Intelligent query expansion

## Search Suggestions

### Get Search Suggestions

Retrieve intelligent search suggestions based on query and context.

**Endpoint**: `GET /api/v1/search/suggestions`

**Query Parameters**:

- `q` - Partial query string
- `databases` - Comma-separated database IDs
- `limit` - Number of suggestions (default: 5, max: 20)

**Headers**:

```http
Authorization: Bearer <YOUR_API_KEY>
```

**Response**:

```json
{
  "success": true,
  "data": {
    "suggestions": [
      {
        "query": "database performance optimization",
        "score": 0.95,
        "category": "Performance",
        "resultCount": 89,
        "type": "popular"
      },
      {
        "query": "mysql indexing strategies",
        "score": 0.87,
        "category": "MySQL",
        "resultCount": 45,
        "type": "related"
      }
    ],
    "categories": ["Performance", "MySQL", "Optimization"],
    "popularQueries": [
      "database optimization",
      "query performance",
      "mysql tuning"
    ]
  }
}
```

**cURL Example**:

```bash
curl -X GET "https://api.altus4.dev/api/v1/search/suggestions?q=database%20perf&databases=db_uuid_1&limit=5" \
  -H "Authorization: Bearer altus4_sk_live_abc123..."
```

## Search Analytics

### Analyze Query Performance

Get detailed performance analysis for a search query.

**Endpoint**: `POST /api/v1/search/analyze`

**Request Body**:

```json
{
  "query": "database optimization techniques",
  "databases": ["db_uuid_1", "db_uuid_2"],
  "searchMode": "natural"
}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "analysis": {
      "queryComplexity": "medium",
      "estimatedResults": 150,
      "optimizationSuggestions": [
        {
          "type": "query_refinement",
          "suggestion": "Consider using 'mysql optimization' for more specific results",
          "impact": "high"
        }
      ],
      "indexRecommendations": [
        {
          "database": "db_uuid_1",
          "table": "articles",
          "column": "content",
          "reason": "Full-text search performance"
        }
      ],
      "performanceMetrics": {
        "estimatedExecutionTime": 180,
        "cacheHitProbability": 0.3,
        "aiProcessingRequired": true
      }
    }
  }
}
```

### Search History

Retrieve user's search history with analytics.

**Endpoint**: `GET /api/v1/search/history`

**Query Parameters**:

- `limit` - Number of history entries (default: 50, max: 500)
- `offset` - Pagination offset
- `from` - Start date (ISO string)
- `to` - End date (ISO string)
- `databases` - Filter by specific databases

**Response**:

```json
{
  "success": true,
  "data": {
    "history": [
      {
        "id": "search_abc123",
        "query": "database performance optimization",
        "searchMode": "semantic",
        "databases": ["db_uuid_1"],
        "resultCount": 89,
        "executionTime": 234,
        "timestamp": "2024-01-15T10:30:00.000Z"
      }
    ],
    "summary": {
      "totalSearches": 1250,
      "averageResultCount": 67,
      "averageExecutionTime": 198,
      "mostUsedMode": "natural",
      "topQueries": [
        "database optimization",
        "mysql performance",
        "query tuning"
      ]
    }
  }
}
```

### Search Trends

Get user's search trends and pattern insights.

**Endpoint**: `GET /api/v1/search/trends`

**Query Parameters**:

- `period` - `day`, `week`, `month` (default: `week`)
- `databases` - Filter by specific databases

**Response**:

```json
{
  "success": true,
  "data": {
    "trends": {
      "period": "week",
      "searchVolume": [
        {
          "date": "2024-01-15",
          "searches": 45,
          "uniqueQueries": 23
        }
      ],
      "topCategories": [
        {
          "category": "Performance",
          "searches": 234,
          "growth": 15.2
        }
      ],
      "searchModes": {
        "natural": 60.5,
        "semantic": 25.3,
        "boolean": 14.2
      },
      "emergingQueries": [
        {
          "query": "mysql 8.0 optimization",
          "growth": 45.2,
          "searches": 12
        }
      ]
    }
  }
}
```

## Code Examples

### JavaScript/Node.js

```javascript
const altus4 = {
  apiKey: 'altus4_sk_live_abc123...',
  baseUrl: 'https://api.altus4.dev',
};

// Basic search
const searchResults = async (query, databases) => {
  const response = await fetch(`${altus4.baseUrl}/api/v1/search`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${altus4.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      databases,
      searchMode: 'natural',
      limit: 20,
      options: {
        enableAI: true,
        highlightMatches: true,
      },
    }),
  });

  const data = await response.json();
  return data.data.results;
};

// Search with advanced options
const advancedSearch = async searchParams => {
  const response = await fetch(`${altus4.baseUrl}/api/v1/search`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${altus4.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: searchParams.query,
      databases: searchParams.databases,
      searchMode: searchParams.mode || 'semantic',
      limit: searchParams.limit || 20,
      filters: {
        tables: searchParams.tables,
        dateRange: searchParams.dateRange,
        minScore: 0.7,
      },
      options: {
        enableAI: true,
        includeSchema: true,
        highlightMatches: true,
      },
    }),
  });

  return await response.json();
};

// Usage examples
const results = await searchResults('database performance optimization', [
  'db_uuid_1',
  'db_uuid_2',
]);

const advancedResults = await advancedSearch({
  query: 'mysql indexing strategies',
  databases: ['db_uuid_1'],
  mode: 'semantic',
  limit: 15,
  tables: ['articles', 'documentation'],
  dateRange: {
    from: '2024-01-01',
    to: '2024-12-31',
  },
});
```

### Python

```python
import requests
import json
from datetime import datetime, timedelta

class Altus4Search:
    def __init__(self, api_key):
        self.api_key = api_key
        self.base_url = 'https://api.altus4.dev'
        self.headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }

    def search(self, query, databases, mode='natural', **kwargs):
        """Execute a search with flexible options"""
        payload = {
            'query': query,
            'databases': databases,
            'searchMode': mode,
            'limit': kwargs.get('limit', 20),
            'offset': kwargs.get('offset', 0)
        }

        # Add filters if provided
        if 'filters' in kwargs:
            payload['filters'] = kwargs['filters']

        # Add options if provided
        if 'options' in kwargs:
            payload['options'] = kwargs['options']

        response = requests.post(
            f'{self.base_url}/api/v1/search',
            headers=self.headers,
            json=payload
        )

        return response.json()

    def get_suggestions(self, query, databases, limit=5):
        """Get search suggestions"""
        params = {
            'q': query,
            'databases': ','.join(databases),
            'limit': limit
        }

        response = requests.get(
            f'{self.base_url}/api/v1/search/suggestions',
            headers=self.headers,
            params=params
        )

        return response.json()

    def search_history(self, limit=50, days_back=7):
        """Get search history"""
        from_date = (datetime.now() - timedelta(days=days_back)).isoformat()
        params = {
            'limit': limit,
            'from': from_date
        }

        response = requests.get(
            f'{self.base_url}/api/v1/search/history',
            headers=self.headers,
            params=params
        )

        return response.json()

# Usage
client = Altus4Search('altus4_sk_live_abc123...')

# Basic search
results = client.search(
    query='database optimization techniques',
    databases=['db_uuid_1'],
    mode='semantic'
)

# Advanced search with filters
filtered_results = client.search(
    query='mysql performance',
    databases=['db_uuid_1', 'db_uuid_2'],
    mode='natural',
    limit=25,
    filters={
        'tables': ['articles', 'documentation'],
        'dateRange': {
            'from': '2024-01-01',
            'to': '2024-12-31'
        },
        'minScore': 0.6
    },
    options={
        'enableAI': True,
        'highlightMatches': True,
        'includeSchema': True
    }
)

# Get suggestions
suggestions = client.get_suggestions(
    query='database perf',
    databases=['db_uuid_1'],
    limit=8
)

print(f"Found {results['data']['summary']['totalResults']} results")
for result in results['data']['results']:
    print(f"- {result['content']['title']} (Score: {result['score']})")
```

## Search Best Practices

### Query Optimization

1. **Use Specific Terms**: More specific queries yield better results
2. **Leverage Search Modes**: Choose the right mode for your use case
3. **Apply Filters**: Use filters to narrow down results effectively
4. **Cache Results**: Enable caching for frequently used queries

### Performance Tips

1. **Limit Results**: Use appropriate limits to improve response times
2. **Batch Databases**: Search multiple databases in a single request
3. **Use Pagination**: Implement pagination for large result sets
4. **Monitor Usage**: Track search performance and optimize accordingly

### Error Handling

```javascript
const safeSearch = async (query, databases) => {
  try {
    const response = await fetch('/api/v1/search', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, databases }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Search failed: ${error.error.message}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Search error:', error.message);

    // Fallback to cached results or simplified search
    return await getFallbackResults(query);
  }
};
```

---

**Next Steps**: [Database Management](./database.md) | [Analytics & Insights](./analytics.md)
