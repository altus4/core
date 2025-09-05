---
title: Getting Started Guide
description: Comprehensive guide to getting started with Altus 4, from setup to your first search operations with practical examples.
---

# Getting Started Guide

This comprehensive guide will walk you through setting up Altus 4 and performing your first search operations.

## Prerequisites

- Node.js 18+ installed
- MySQL 8.0+ database with FULLTEXT indexes
- Redis server (optional, for caching)
- OpenAI API key (optional, for AI features)

## Step 1: Account Registration

First, create an account and get your API key:

```bash
curl -X POST https://api.altus4.com/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "password": "secure-password",
    "name": "Your Name"
  }'
```

Response:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-123",
      "email": "your-email@example.com",
      "tier": "free"
    },
    "message": "Registration successful"
  }
}
```

## Step 2: Login and Create API Key

Login to get a JWT token for API key creation:

```bash
curl -X POST https://api.altus4.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "password": "secure-password"
  }'
```

Response:

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "user-123",
      "email": "your-email@example.com"
    }
  }
}
```

Now create your API key:

```bash
curl -X POST https://api.altus4.com/api/v1/api-keys \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -d '{
    "name": "My First API Key",
    "permissions": ["search", "database:read"]
  }'
```

Response:

```json
{
  "success": true,
  "data": {
    "id": "key-456",
    "key": "altus4_live_abc123def456...",
    "name": "My First API Key",
    "tier": "free",
    "permissions": ["search", "database:read"]
  }
}
```

**Important:** Save this API key securely. You won't be able to see it again.

## Step 3: Connect Your Database

Add your MySQL database to Altus 4:

```bash
curl -X POST https://api.altus4.com/api/v1/databases \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer altus4_live_abc123def456..." \
  -d '{
    "name": "My Blog Database",
    "host": "localhost",
    "port": 3306,
    "username": "blog_user",
    "password": "blog_password",
    "database_name": "blog_db"
  }'
```

Response:

```json
{
  "success": true,
  "data": {
    "id": "db-789",
    "name": "My Blog Database",
    "host": "localhost",
    "database_name": "blog_db",
    "status": "connected",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

## Step 4: Discover Database Schema

Let Altus 4 analyze your database structure:

```bash
curl -X GET https://api.altus4.com/api/v1/databases/db-789/schema \
  -H "Authorization: Bearer altus4_live_abc123def456..."
```

Response:

```json
{
  "success": true,
  "data": {
    "database_id": "db-789",
    "tables": [
      {
        "name": "articles",
        "columns": [
          { "name": "id", "type": "int", "searchable": false },
          { "name": "title", "type": "varchar", "searchable": true },
          { "name": "content", "type": "text", "searchable": true },
          { "name": "created_at", "type": "datetime", "searchable": false }
        ],
        "fulltextIndexes": [
          {
            "name": "ft_article_content",
            "columns": ["title", "content"]
          }
        ]
      }
    ],
    "recommendations": [
      "Table 'articles' has FULLTEXT index on 'title, content' - optimal for search",
      "Consider adding FULLTEXT index on 'tags' column if available"
    ]
  }
}
```

## Step 5: Perform Your First Search

Now you can search across your database:

```bash
curl -X POST https://api.altus4.com/api/v1/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer altus4_live_abc123def456..." \
  -d '{
    "query": "machine learning artificial intelligence",
    "databases": ["db-789"],
    "mode": "natural",
    "limit": 10
  }'
```

Response:

```json
{
  "success": true,
  "data": [
    {
      "id": "result-1",
      "title": "Introduction to Machine Learning",
      "content": "Machine learning is a subset of artificial intelligence...",
      "relevance": 0.95,
      "source": {
        "database_id": "db-789",
        "table": "articles",
        "record_id": "123"
      },
      "metadata": {
        "match_type": "fulltext",
        "matched_fields": ["title", "content"]
      }
    }
  ],
  "metadata": {
    "total": 25,
    "page": 1,
    "limit": 10,
    "query_time_ms": 45,
    "databases_searched": 1
  }
}
```

## Step 6: Advanced Search Features

### Boolean Search

Use boolean operators for precise queries:

```bash
curl -X POST https://api.altus4.com/api/v1/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer altus4_live_abc123def456..." \
  -d '{
    "query": "+machine +learning -basics",
    "databases": ["db-789"],
    "mode": "boolean"
  }'
```

### Semantic Search (Pro/Enterprise)

Use AI-powered semantic search:

```bash
curl -X POST https://api.altus4.com/api/v1/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer altus4_live_abc123def456..." \
  -d '{
    "query": "articles about AI and automation",
    "databases": ["db-789"],
    "mode": "semantic",
    "ai_enhance": true
  }'
```

### Multi-Database Search

Search across multiple databases simultaneously:

```bash
curl -X POST https://api.altus4.com/api/v1/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer altus4_live_abc123def456..." \
  -d '{
    "query": "user authentication",
    "databases": ["db-789", "db-890"],
    "mode": "natural"
  }'
```

## Step 7: Get Search Insights

Analyze your search patterns and get recommendations:

```bash
curl -X GET https://api.altus4.com/api/v1/analytics/insights \
  -H "Authorization: Bearer altus4_live_abc123def456..."
```

Response:

```json
{
  "success": true,
  "data": {
    "insights": [
      {
        "type": "query_optimization",
        "message": "Consider using boolean search for more precise results",
        "suggestion": "Use '+machine +learning' instead of 'machine learning'"
      },
      {
        "type": "index_recommendation",
        "message": "Adding FULLTEXT index on 'tags' column could improve search performance",
        "database_id": "db-789",
        "table": "articles"
      }
    ],
    "trends": {
      "popular_queries": ["machine learning", "artificial intelligence", "web development"],
      "search_volume_trend": "increasing",
      "avg_response_time": "52ms"
    }
  }
}
```

## Common Use Cases

### Content Management System

Search across blog posts, pages, and documentation:

```javascript
const searchResults = await fetch('/api/v1/search', {
  method: 'POST',
  headers: {
    Authorization: 'Bearer your-api-key',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    query: userInput,
    databases: ['cms_db'],
    mode: 'natural',
    limit: 20,
  }),
});
```

### E-commerce Product Search

Find products across multiple catalogs:

```python
import requests

response = requests.post('https://api.altus4.com/api/v1/search',
  headers={'Authorization': 'Bearer your-api-key'},
  json={
    'query': 'wireless bluetooth headphones',
    'databases': ['products_db', 'inventory_db'],
    'mode': 'semantic',
    'filters': {
      'price_range': {'min': 50, 'max': 200},
      'category': 'electronics'
    }
  }
)
```

### Knowledge Base Search

Search across documentation and FAQs:

```bash
curl -X POST https://api.altus4.com/api/v1/search \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "how to reset password",
    "databases": ["docs_db", "faq_db"],
    "mode": "natural",
    "ai_enhance": true,
    "include_suggestions": true
  }'
```

## Next Steps

1. **Explore API Reference**: Check out the complete [API documentation](/api/search) for all available endpoints and options.

2. **Optimize Your Database**: Review our [setup guide](../setup/index.md) to improve search performance.

3. **Set up Monitoring**: Configure [monitoring and analytics](/deployment/monitoring) to track search performance and usage patterns.

4. **Upgrade Your Plan**: Consider upgrading to Pro or Enterprise for advanced features like semantic search and higher rate limits.

5. **Integration Examples**: See language-specific integration examples in our [SDK guide](./sdk.md).

## Troubleshooting

### Common Issues

**Connection Refused**

```json
{
  "success": false,
  "error": {
    "code": "DB_CONNECTION_ERROR",
    "message": "Unable to connect to database"
  }
}
```

Solution: Check your database credentials and network connectivity.

**Rate Limit Exceeded**

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests"
  }
}
```

Solution: Implement request throttling or upgrade your plan.

**No Search Results**

- Ensure your database has FULLTEXT indexes
- Check that the search query matches your content
- Try different search modes (natural, boolean, semantic)

### Getting Help

- Check the [setup guide](../setup/index.md) for common questions
- Join our [Discord community](https://discord.gg/altus4)
- Contact support at <support@altus4.com>
