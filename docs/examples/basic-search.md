---
title: Basic Search Examples
description: Learn how to perform basic searches with Altus 4 using simple examples and code snippets.
---

# Basic Search Examples

Simple Search Operations with Altus 4

This guide provides practical examples of basic search operations using Altus 4's API. Perfect for getting started with search functionality.

## Prerequisites

Before running these examples, ensure you have:

- **Altus 4 API Key** - Get one from the [Quick Start Guide](../setup/quickstart.md)
- **Database Connection** - At least one connected MySQL database
- **HTTP Client** - cURL, Postman, or your preferred programming language

## Basic Search Request

### Simple Text Search

The most basic search operation - finding content that matches your query:

```bash
curl -X POST https://api.altus4.com/api/v1/search \
  -H "Authorization: Bearer altus4_sk_live_abc123def456..." \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mysql performance",
    "databases": ["db-uuid-1"],
    "searchMode": "natural",
    "limit": 10
  }'
```

**Response:**

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "id": "db-uuid-1_articles_0",
        "database": "db-uuid-1",
        "table": "articles",
        "relevanceScore": 0.95,
        "snippet": "MySQL performance optimization techniques...",
        "data": {
          "id": 123,
          "title": "MySQL Performance Optimization Guide",
          "content": "Learn how to optimize MySQL performance...",
          "author": "John Doe",
          "published_at": "2024-01-15T10:30:00Z"
        },
        "matchedColumns": ["title", "content"]
      }
    ],
    "totalCount": 1,
    "executionTime": 45,
    "page": 1,
    "limit": 10
  }
}
```

## Search Modes

### 1. Natural Language Search (Default)

Best for human-readable queries:

```javascript
const searchRequest = {
  query: 'how to optimize database performance',
  databases: ['db-uuid-1'],
  searchMode: 'natural',
  limit: 20,
};

const response = await fetch('https://api.altus4.com/api/v1/search', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(searchRequest),
});

const results = await response.json();
console.log(`Found ${results.data.totalCount} results`);
```

### 2. Boolean Search

Use operators for precise control:

```python
import requests

# Boolean search with operators
search_data = {
    "query": "+mysql +performance -slow",  # Must have mysql AND performance, NOT slow
    "databases": ["db-uuid-1"],
    "searchMode": "boolean",
    "limit": 15
}

response = requests.post(
    'https://api.altus4.com/api/v1/search',
    headers={
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    },
    json=search_data
)

results = response.json()
for result in results['data']['results']:
    print(f"Title: {result['data']['title']}")
    print(f"Score: {result['relevanceScore']}")
```

**Boolean Operators:**

- `+word` - Must contain word
- `-word` - Must not contain word
- `"exact phrase"` - Exact phrase match
- `word1 word2` - Contains either word
- `(word1 word2)` - Grouping

### 3. Semantic Search (AI-Powered)

Understands meaning and context:

```go
package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "net/http"
)

type SearchRequest struct {
    Query      string   `json:"query"`
    Databases  []string `json:"databases"`
    SearchMode string   `json:"searchMode"`
    Limit      int      `json:"limit"`
}

func main() {
    searchReq := SearchRequest{
        Query:      "articles about improving database speed",
        Databases:  []string{"db-uuid-1"},
        SearchMode: "semantic", // AI understands "speed" relates to "performance"
        Limit:      10,
    }

    jsonData, _ := json.Marshal(searchReq)

    req, _ := http.NewRequest("POST", "https://api.altus4.com/api/v1/search", bytes.NewBuffer(jsonData))
    req.Header.Set("Authorization", "Bearer " + apiKey)
    req.Header.Set("Content-Type", "application/json")

    client := &http.Client{}
    resp, _ := client.Do(req)
    defer resp.Body.Close()

    // Process response...
}
```

## Filtering and Pagination

### Table and Column Filtering

Search specific tables or columns:

```bash
curl -X POST https://api.altus4.com/api/v1/search \
  -H "Authorization: Bearer altus4_sk_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "query": "user authentication",
    "databases": ["db-uuid-1"],
    "tables": ["articles", "documentation"],
    "columns": ["title", "content", "tags"],
    "searchMode": "natural",
    "limit": 25
  }'
```

### Pagination

Handle large result sets with pagination:

```javascript
async function searchWithPagination(query, databases, pageSize = 20) {
  let allResults = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch('https://api.altus4.com/api/v1/search', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        databases,
        limit: pageSize,
        offset: offset,
      }),
    });

    const data = await response.json();
    const results = data.data.results;

    allResults.push(...results);

    // Check if there are more results
    hasMore = results.length === pageSize;
    offset += pageSize;

    console.log(`Fetched ${results.length} results (total: ${allResults.length})`);
  }

  return allResults;
}

// Usage
const allResults = await searchWithPagination('database optimization', ['db-uuid-1', 'db-uuid-2']);
```

## Working with Results

### Processing Search Results

```python
def process_search_results(results_data):
    """Process and display search results"""
    results = results_data['data']['results']

    print(f"Found {results_data['data']['totalCount']} results")
    print(f"Search took {results_data['data']['executionTime']}ms")
    print("-" * 50)

    for i, result in enumerate(results, 1):
        print(f"{i}. {result['data'].get('title', 'No Title')}")
        print(f"   Database: {result['database']}")
        print(f"   Table: {result['table']}")
        print(f"   Relevance: {result['relevanceScore']:.2f}")
        print(f"   Snippet: {result.get('snippet', 'No snippet')[:100]}...")
        print()

# Example usage
search_response = requests.post(
    'https://api.altus4.com/api/v1/search',
    headers={'Authorization': f'Bearer {api_key}'},
    json={
        'query': 'mysql indexing strategies',
        'databases': ['db-uuid-1'],
        'limit': 10
    }
)

process_search_results(search_response.json())
```

### Extracting Specific Data

```javascript
function extractArticleData(searchResults) {
  return searchResults.data.results.map(result => ({
    id: result.data.id,
    title: result.data.title,
    author: result.data.author,
    publishedDate: result.data.published_at,
    relevance: result.relevanceScore,
    preview: result.snippet,
    source: {
      database: result.database,
      table: result.table,
    },
  }));
}

// Usage
const response = await searchAPI('database performance tuning');
const articles = extractArticleData(response);

articles.forEach(article => {
  console.log(`${article.title} by ${article.author}`);
  console.log(`Relevance: ${article.relevance}`);
  console.log(`Preview: ${article.preview}`);
  console.log('---');
});
```

## Error Handling

### Robust Error Handling

```python
import requests
from typing import Optional, Dict, Any

class AltusSearchClient:
    def __init__(self, api_key: str, base_url: str = "https://api.altus4.com"):
        self.api_key = api_key
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        })

    def search(self, query: str, databases: list, **kwargs) -> Optional[Dict[Any, Any]]:
        """Perform search with comprehensive error handling"""
        search_data = {
            'query': query,
            'databases': databases,
            **kwargs
        }

        try:
            response = self.session.post(
                f'{self.base_url}/api/v1/search',
                json=search_data,
                timeout=30
            )

            # Check for HTTP errors
            if response.status_code == 401:
                raise Exception("Invalid API key or authentication failed")
            elif response.status_code == 403:
                raise Exception("Insufficient permissions for this operation")
            elif response.status_code == 429:
                raise Exception("Rate limit exceeded. Please try again later")
            elif response.status_code >= 400:
                error_data = response.json()
                raise Exception(f"API Error: {error_data.get('error', {}).get('message', 'Unknown error')}")

            response.raise_for_status()

            # Parse and validate response
            data = response.json()
            if not data.get('success'):
                raise Exception(f"Search failed: {data.get('error', {}).get('message', 'Unknown error')}")

            return data

        except requests.exceptions.Timeout:
            raise Exception("Search request timed out")
        except requests.exceptions.ConnectionError:
            raise Exception("Failed to connect to Altus 4 API")
        except requests.exceptions.RequestException as e:
            raise Exception(f"Request failed: {str(e)}")
        except Exception as e:
            raise Exception(f"Search error: {str(e)}")

# Usage with error handling
client = AltusSearchClient(api_key)

try:
    results = client.search(
        query="mysql optimization",
        databases=["db-uuid-1"],
        searchMode="natural",
        limit=20
    )

    print(f"Search successful! Found {results['data']['totalCount']} results")

except Exception as e:
    print(f"Search failed: {e}")
```

## Performance Tips

### 1. Optimize Query Performance

```javascript
// Good: Specific, focused queries
const goodQuery = 'mysql index optimization b-tree';

// Avoid: Overly broad queries
const broadQuery = 'database';

// Good: Use appropriate limits
const searchRequest = {
  query: goodQuery,
  databases: ['db-uuid-1'],
  limit: 20, // Don't request more than you need
  searchMode: 'natural',
};
```

### 2. Batch Multiple Searches

```python
import asyncio
import aiohttp

async def batch_search(queries, databases, api_key):
    """Perform multiple searches concurrently"""
    async with aiohttp.ClientSession() as session:
        tasks = []

        for query in queries:
            task = search_async(session, query, databases, api_key)
            tasks.append(task)

        results = await asyncio.gather(*tasks, return_exceptions=True)
        return results

async def search_async(session, query, databases, api_key):
    """Async search function"""
    async with session.post(
        'https://api.altus4.com/api/v1/search',
        headers={'Authorization': f'Bearer {api_key}'},
        json={
            'query': query,
            'databases': databases,
            'limit': 10
        }
    ) as response:
        return await response.json()

# Usage
queries = [
    "mysql performance",
    "database indexing",
    "query optimization",
    "connection pooling"
]

results = asyncio.run(batch_search(queries, ["db-uuid-1"], api_key))
```

### 3. Cache Results Locally

```javascript
class SearchCache {
  constructor(ttl = 300000) {
    // 5 minutes default TTL
    this.cache = new Map();
    this.ttl = ttl;
  }

  generateKey(query, databases, options = {}) {
    return JSON.stringify({ query, databases, ...options });
  }

  get(query, databases, options) {
    const key = this.generateKey(query, databases, options);
    const cached = this.cache.get(key);

    if (cached && Date.now() - cached.timestamp < this.ttl) {
      return cached.data;
    }

    return null;
  }

  set(query, databases, options, data) {
    const key = this.generateKey(query, databases, options);
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  async search(query, databases, options = {}) {
    // Check cache first
    const cached = this.get(query, databases, options);
    if (cached) {
      console.log('Cache hit!');
      return cached;
    }

    // Perform actual search
    const response = await fetch('https://api.altus4.com/api/v1/search', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        databases,
        ...options,
      }),
    });

    const data = await response.json();

    // Cache the result
    this.set(query, databases, options, data);

    return data;
  }
}

// Usage
const searchCache = new SearchCache();
const results = await searchCache.search('mysql performance', ['db-uuid-1']);
```

## Common Use Cases

### 1. Content Search

```bash
# Search for articles about a specific topic
curl -X POST https://api.altus4.com/api/v1/search \
  -H "Authorization: Bearer altus4_sk_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "query": "machine learning algorithms",
    "databases": ["blog_db"],
    "tables": ["articles", "posts"],
    "searchMode": "semantic",
    "limit": 15
  }'
```

### 2. Product Search

```javascript
async function searchProducts(searchTerm, category = null) {
  const searchRequest = {
    query: searchTerm,
    databases: ['ecommerce_db'],
    tables: ['products'],
    searchMode: 'natural',
    limit: 50,
  };

  // Add category filter if specified
  if (category) {
    searchRequest.filters = { category };
  }

  const response = await fetch('https://api.altus4.com/api/v1/search', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(searchRequest),
  });

  return await response.json();
}

// Usage
const laptops = await searchProducts('gaming laptop', 'electronics');
```

### 3. Documentation Search

```python
def search_documentation(query, docs_database):
    """Search through documentation with semantic understanding"""
    return requests.post(
        'https://api.altus4.com/api/v1/search',
        headers={'Authorization': f'Bearer {api_key}'},
        json={
            'query': query,
            'databases': [docs_database],
            'tables': ['documentation', 'help_articles', 'faqs'],
            'searchMode': 'semantic',  # Better for help/support queries
            'limit': 10
        }
    ).json()

# Find help articles
help_results = search_documentation("how to reset password", "support_db")
```

## Next Steps

Now that you understand basic search operations, explore:

- **[Advanced Queries](./advanced-queries.md)** - Complex search patterns and filters
- **[AI Integration](./ai-integration.md)** - Leveraging semantic search capabilities
- **[Multi-Database Search](./multi-database.md)** - Searching across multiple databases
- **[API Reference](../api/search.md)** - Complete search API documentation

## Troubleshooting

### Common Issues

**Empty Results**

```javascript
// Check if your database has FULLTEXT indexes
const schemaResponse = await fetch(`https://api.altus4.com/api/v1/databases/${databaseId}/schema`, {
  headers: { Authorization: `Bearer ${apiKey}` },
});
const schema = await schemaResponse.json();
console.log('FULLTEXT indexes:', schema.data.fulltextIndexes);
```

**Slow Searches**

```bash
# Use more specific queries
# Good: "mysql index optimization"
# Avoid: "database"

# Limit result count
{
  "query": "specific search term",
  "limit": 10  # Start small
}
```

**Authentication Errors**

```javascript
// Verify API key format
if (!apiKey.startsWith('altus4_sk_')) {
  console.error('Invalid API key format');
}

// Check API key permissions
console.log('API Key permissions:', req.apiKey.permissions);
```

---

**Ready for more advanced search techniques?** Continue with [Advanced Queries](./advanced-queries.md) to learn complex search patterns and optimization strategies.
