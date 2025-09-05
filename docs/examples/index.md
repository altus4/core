---
title: Code Examples & Tutorials
description: Practical examples and tutorials for using Altus 4's AI-enhanced MySQL search capabilities.
---

# Code Examples & Tutorials

Practical examples and tutorials for using Altus 4

This section provides comprehensive code examples, tutorials, and real-world use cases to help you get the most out of Altus 4's AI-enhanced MySQL search capabilities.

## Quick Start Examples

### Basic Search Implementation

**Simple search with API key authentication:**

```javascript
// Basic search example with API key
const API_BASE = 'http://localhost:3000/api';
let apiKey = '';

// 1. Setup API key (one-time setup)
async function setupApiKey() {
  // First, register and login to get initial JWT
  const registerResponse = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'developer@example.com',
      password: 'SecurePassword123!',
      name: 'Developer User',
    }),
  });

  let jwtToken;
  if (registerResponse.status === 409) {
    // User already exists, just login
    const loginResponse = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'developer@example.com',
        password: 'SecurePassword123!',
      }),
    });
    const loginData = await loginResponse.json();
    jwtToken = loginData.data.token;
  } else {
    const registerData = await registerResponse.json();
    jwtToken = registerData.data.token;
  }

  // Create API key using JWT token (one-time setup)
  const apiKeyResponse = await fetch(`${API_BASE}/management/setup`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwtToken}` },
  });

  const apiKeyData = await apiKeyResponse.json();
  apiKey = apiKeyData.data.secretKey; // Save this securely

  console.log('API key created successfully:', apiKey.substring(0, 20) + '...');
}

// 2. Add database connection
async function addDatabase() {
  const response = await fetch(`${API_BASE}/databases`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'My Application Database',
      host: 'localhost',
      port: 3306,
      database: 'my_app_db',
      username: 'db_user',
      password: 'db_password',
    }),
  });

  const data = await response.json();
  return data.data.id; // Database ID for searches
}

// 3. Execute search
async function searchDatabase(databaseId, query) {
  const response = await fetch(`${API_BASE}/search`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: query,
      databases: [databaseId],
      searchMode: 'natural',
      limit: 10,
      includeAnalytics: false,
    }),
  });

  const data = await response.json();
  return data.data;
}

// Usage
async function main() {
  try {
    // One-time setup (save API key for future use)
    if (!apiKey) {
      await setupApiKey();
      // In production, save apiKey securely and load it
      // localStorage.setItem('altus4ApiKey', apiKey);
    }

    const databaseId = await addDatabase();
    const results = await searchDatabase(databaseId, 'user authentication');

    console.log('Search Results:');
    results.results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.table} - Score: ${result.relevanceScore}`);
      console.log(`   Snippet: ${result.snippet}`);
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
```

### Node.js Express Integration

**Building a search API with Express:**

```javascript
// server.js
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// Altus 4 configuration
const ALTUS_API = 'http://localhost:3000/api';
let altusToken = '';

// Initialize Altus connection
async function initializeAltus() {
  try {
    // Login to Altus 4
    const loginResponse = await axios.post(`${ALTUS_API}/auth/login`, {
      email: process.env.ALTUS_EMAIL,
      password: process.env.ALTUS_PASSWORD,
    });

    altusToken = loginResponse.data.data.token;
    console.log('Connected to Altus 4');
  } catch (error) {
    console.error('Failed to connect to Altus 4:', error.message);
    process.exit(1);
  }
}

// Search endpoint
app.post('/search', async (req, res) => {
  try {
    const { query, searchMode = 'natural', limit = 20 } = req.body;

    if (!query) {
      return res.status(400).json({
        error: 'Search query is required',
      });
    }

    // Execute search via Altus 4
    const searchResponse = await axios.post(
      `${ALTUS_API}/search`,
      {
        query,
        databases: [process.env.DATABASE_ID], // Your database ID
        searchMode,
        limit,
        includeAnalytics: true,
      },
      {
        headers: { Authorization: `Bearer ${altusToken}` },
      }
    );

    const searchData = searchResponse.data.data;

    // Transform results for your application
    const transformedResults = searchData.results.map(result => ({
      id: result.id,
      title: result.data.title || 'No title',
      content: result.snippet,
      relevance: result.relevanceScore,
      source: result.table,
      categories: result.categories,
    }));

    res.json({
      success: true,
      query: query,
      results: transformedResults,
      total: searchData.totalCount,
      executionTime: searchData.executionTime,
      suggestions: searchData.suggestions,
    });
  } catch (error) {
    console.error('Search error:', error.message);
    res.status(500).json({
      error: 'Search failed',
      details: error.message,
    });
  }
});

// Get search suggestions
app.get('/suggestions', async (req, res) => {
  try {
    const { q: partialQuery } = req.query;

    const response = await axios.get(`${ALTUS_API}/search/suggestions`, {
      params: { query: partialQuery },
      headers: { Authorization: `Bearer ${altusToken}` },
    });

    res.json({
      success: true,
      suggestions: response.data.data,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get suggestions',
      details: error.message,
    });
  }
});

// Start server
async function startServer() {
  await initializeAltus();

  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Search API server running on port ${PORT}`);
    console.log(
      `Try: curl -X POST http://localhost:${PORT}/search -H "Content-Type: application/json" -d '{"query":"your search"}'`
    );
  });
}

startServer();
```

## Advanced Search Examples

### Semantic Search with AI

**Using AI-powered semantic search:**

```javascript
// Semantic search implementation
class SemanticSearchClient {
  constructor(altusBaseUrl, credentials) {
    this.baseUrl = altusBaseUrl;
    this.credentials = credentials;
    this.token = null;
  }

  async authenticate() {
    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.credentials),
    });

    const data = await response.json();
    this.token = data.data.token;
  }

  async semanticSearch(query, options = {}) {
    const searchRequest = {
      query: query,
      databases: options.databases || [],
      searchMode: 'semantic', // Enable AI processing
      limit: options.limit || 20,
      includeAnalytics: options.includeAnalytics || true,
      // Semantic search specific options
      tables: options.tables || [], // Specific tables to search
      columns: options.columns || [], // Specific columns to search
      categories: options.categories || [], // Filter by categories
    };

    const response = await fetch(`${this.baseUrl}/search`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(searchRequest),
    });

    const data = await response.json();
    return this.processSemanticResults(data.data);
  }

  processSemanticResults(results) {
    return {
      // Main search results
      results: results.results.map(result => ({
        ...result,
        // Enhanced relevance with AI scoring
        aiRelevance: result.relevanceScore,
        semanticContext: this.extractSemanticContext(result),
      })),

      // AI-generated categories
      categories: results.categories.map(cat => ({
        name: cat.name,
        count: cat.count,
        confidence: cat.confidence || 0.8,
        relatedTerms: cat.relatedTerms || [],
      })),

      // AI-powered suggestions
      suggestions: results.suggestions.map(suggestion => ({
        text: suggestion.text,
        type: suggestion.type, // 'semantic', 'popular', 'related'
        score: suggestion.score,
        reasoning: suggestion.reasoning, // Why this was suggested
      })),

      // Search insights
      insights: {
        totalResults: results.totalCount,
        executionTime: results.executionTime,
        cacheHit: results.fromCache || false,
        aiProcessingTime: results.aiProcessingTime || 0,
      },
    };
  }

  extractSemanticContext(result) {
    // Extract semantic meaning from AI processing
    return {
      topics: result.topics || [],
      concepts: result.concepts || [],
      entities: result.entities || [],
      sentiment: result.sentiment || 'neutral',
    };
  }

  async getRelatedQueries(originalQuery) {
    const response = await fetch(`${this.baseUrl}/search/related`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: originalQuery,
        maxSuggestions: 10,
      }),
    });

    const data = await response.json();
    return data.data.relatedQueries;
  }
}

// Usage example
async function demonstrateSemanticSearch() {
  const client = new SemanticSearchClient('http://localhost:3000/api', {
    email: 'user@example.com',
    password: 'password123',
  });

  await client.authenticate();

  // Natural language query
  const query = 'How to improve application performance and reduce latency?';

  const results = await client.semanticSearch(query, {
    databases: ['production-db', 'knowledge-base'],
    limit: 15,
    includeAnalytics: true,
  });

  console.log('\n=== SEMANTIC SEARCH RESULTS ===');
  console.log(`Query: "${query}"`);
  console.log(`Found ${results.results.length} results in ${results.insights.executionTime}ms`);

  // Display top results with semantic context
  results.results.slice(0, 5).forEach((result, index) => {
    console.log(`\n${index + 1}. ${result.table} (Relevance: ${result.aiRelevance.toFixed(3)})`);
    console.log(`   Topics: ${result.semanticContext.topics.join(', ')}`);
    console.log(`   Snippet: ${result.snippet}`);
  });

  // Show AI-generated categories
  console.log('\n=== AI CATEGORIES ===');
  results.categories.forEach(category => {
    console.log(
      `${category.name}: ${category.count} results (${category.confidence.toFixed(2)} confidence)`
    );
  });

  // Show intelligent suggestions
  console.log('\n=== AI SUGGESTIONS ===');
  results.suggestions.forEach(suggestion => {
    console.log(`"${suggestion.text}" (${suggestion.type}, score: ${suggestion.score.toFixed(2)})`);
  });

  // Get related queries
  const relatedQueries = await client.getRelatedQueries(query);
  console.log('\n=== RELATED QUERIES ===');
  relatedQueries.forEach(related => {
    console.log(`"${related.query}" (similarity: ${related.similarity.toFixed(2)})`);
  });
}

demonstrateSemanticSearch().catch(console.error);
```

### Multi-Database Search

**Searching across multiple databases:**

```javascript
// Multi-database search orchestrator
class MultiDatabaseSearcher {
  constructor(altusClient) {
    this.altus = altusClient;
    this.databases = new Map(); // Store database metadata
  }

  async registerDatabase(dbConfig) {
    try {
      const response = await this.altus.post('/databases', dbConfig);
      const dbId = response.data.data.id;

      // Store database metadata
      this.databases.set(dbId, {
        ...dbConfig,
        id: dbId,
        schema: await this.discoverSchema(dbId),
        performance: { avgResponseTime: 0, successRate: 1.0 },
      });

      console.log(`Database "${dbConfig.name}" registered with ID: ${dbId}`);
      return dbId;
    } catch (error) {
      console.error(`Failed to register database ${dbConfig.name}:`, error.message);
      throw error;
    }
  }

  async discoverSchema(databaseId) {
    try {
      const response = await this.altus.get(`/databases/${databaseId}/schema`);
      return response.data.data.schema;
    } catch (error) {
      console.warn(`Could not discover schema for database ${databaseId}`);
      return {};
    }
  }

  async searchAcrossDatabases(query, options = {}) {
    const {
      databases = Array.from(this.databases.keys()), // All databases by default
      searchMode = 'natural',
      aggregateResults = true,
      parallelSearch = true,
      maxConcurrency = 5,
    } = options;

    console.log(`Searching across ${databases.length} databases for: "${query}"`);

    if (parallelSearch && databases.length > 1) {
      return this.parallelMultiSearch(query, databases, options);
    } else {
      return this.sequentialMultiSearch(query, databases, options);
    }
  }

  async parallelMultiSearch(query, databaseIds, options) {
    const searchPromises = databaseIds.map(async dbId => {
      const startTime = Date.now();
      try {
        const response = await this.altus.post('/search', {
          query,
          databases: [dbId], // Single database per request
          searchMode: options.searchMode || 'natural',
          limit: options.limitPerDatabase || 20,
          tables: this.getRelevantTables(dbId, query),
          includeAnalytics: true,
        });

        const executionTime = Date.now() - startTime;
        this.updatePerformanceMetrics(dbId, executionTime, true);

        return {
          databaseId: dbId,
          databaseName: this.databases.get(dbId)?.name || 'Unknown',
          success: true,
          results: response.data.data.results,
          categories: response.data.data.categories,
          executionTime,
          totalCount: response.data.data.totalCount,
        };
      } catch (error) {
        const executionTime = Date.now() - startTime;
        this.updatePerformanceMetrics(dbId, executionTime, false);

        console.error(`Search failed for database ${dbId}:`, error.message);
        return {
          databaseId: dbId,
          databaseName: this.databases.get(dbId)?.name || 'Unknown',
          success: false,
          error: error.message,
          executionTime,
        };
      }
    });

    const results = await Promise.allSettled(searchPromises);
    return this.aggregateMultiDatabaseResults(
      query,
      results.map(r => (r.status === 'fulfilled' ? r.value : r.reason)),
      options
    );
  }

  async sequentialMultiSearch(query, databaseIds, options) {
    const results = [];

    for (const dbId of databaseIds) {
      const startTime = Date.now();
      try {
        const response = await this.altus.post('/search', {
          query,
          databases: [dbId],
          searchMode: options.searchMode || 'natural',
          limit: options.limitPerDatabase || 20,
        });

        const executionTime = Date.now() - startTime;
        this.updatePerformanceMetrics(dbId, executionTime, true);

        results.push({
          databaseId: dbId,
          databaseName: this.databases.get(dbId)?.name || 'Unknown',
          success: true,
          results: response.data.data.results,
          executionTime,
          totalCount: response.data.data.totalCount,
        });
      } catch (error) {
        const executionTime = Date.now() - startTime;
        this.updatePerformanceMetrics(dbId, executionTime, false);

        results.push({
          databaseId: dbId,
          databaseName: this.databases.get(dbId)?.name || 'Unknown',
          success: false,
          error: error.message,
          executionTime,
        });
      }
    }

    return this.aggregateMultiDatabaseResults(query, results, options);
  }

  aggregateMultiDatabaseResults(query, databaseResults, options) {
    const successful = databaseResults.filter(r => r.success);
    const failed = databaseResults.filter(r => !r.success);

    // Combine all results
    let allResults = [];
    let allCategories = [];

    successful.forEach(dbResult => {
      // Add database context to each result
      const enhancedResults = dbResult.results.map(result => ({
        ...result,
        sourceDatabase: {
          id: dbResult.databaseId,
          name: dbResult.databaseName,
        },
        // Boost relevance for better performing databases
        adjustedRelevance:
          result.relevanceScore *
            this.databases.get(dbResult.databaseId)?.performance.successRate || 1.0,
      }));

      allResults = allResults.concat(enhancedResults);
      allCategories = allCategories.concat(dbResult.categories || []);
    });

    // Sort by adjusted relevance
    allResults.sort((a, b) => b.adjustedRelevance - a.adjustedRelevance);

    // Deduplicate and merge categories
    const categoryMap = new Map();
    allCategories.forEach(cat => {
      if (categoryMap.has(cat.name)) {
        categoryMap.get(cat.name).count += cat.count;
      } else {
        categoryMap.set(cat.name, { ...cat });
      }
    });

    // Calculate performance metrics
    const totalExecutionTime = Math.max(...successful.map(r => r.executionTime), 0);
    const averageResponseTime =
      successful.length > 0
        ? successful.reduce((sum, r) => sum + r.executionTime, 0) / successful.length
        : 0;

    return {
      query,
      summary: {
        totalDatabases: databaseResults.length,
        successfulDatabases: successful.length,
        failedDatabases: failed.length,
        totalResults: allResults.length,
        totalExecutionTime,
        averageResponseTime,
      },
      results: allResults.slice(0, options.maxResults || 50),
      categories: Array.from(categoryMap.values()),
      databaseResults: databaseResults,
      performance: {
        fastestDatabase: successful.reduce(
          (prev, curr) => (prev.executionTime < curr.executionTime ? prev : curr),
          successful[0]
        ),
        slowestDatabase: successful.reduce(
          (prev, curr) => (prev.executionTime > curr.executionTime ? prev : curr),
          successful[0]
        ),
      },
      errors: failed.map(f => ({ database: f.databaseName, error: f.error })),
    };
  }

  getRelevantTables(databaseId, query) {
    // Intelligent table selection based on schema and query
    const dbSchema = this.databases.get(databaseId)?.schema;
    if (!dbSchema) return [];

    // Simple relevance scoring for demonstration
    return Object.keys(dbSchema.tables || {})
      .filter(tableName => {
        const table = dbSchema.tables[tableName];
        return (
          table.hasFullTextIndex ||
          tableName.toLowerCase().includes('content') ||
          tableName.toLowerCase().includes('article') ||
          tableName.toLowerCase().includes('post')
        );
      })
      .slice(0, 5); // Limit to 5 most relevant tables
  }

  updatePerformanceMetrics(databaseId, executionTime, success) {
    const db = this.databases.get(databaseId);
    if (db) {
      // Update moving averages
      db.performance.avgResponseTime = db.performance.avgResponseTime * 0.9 + executionTime * 0.1;
      db.performance.successRate = db.performance.successRate * 0.9 + (success ? 0.1 : 0);
    }
  }

  getDatabaseStats() {
    return Array.from(this.databases.entries()).map(([id, db]) => ({
      id,
      name: db.name,
      performance: db.performance,
      tableCount: Object.keys(db.schema?.tables || {}).length,
      hasFullTextIndexes: Object.values(db.schema?.tables || {}).some(
        table => table.hasFullTextIndex
      ),
    }));
  }
}

// Usage example
async function demonstrateMultiDatabaseSearch() {
  const altusClient = axios.create({
    baseURL: 'http://localhost:3000/api',
    headers: { Authorization: `Bearer ${authToken}` },
  });

  const searcher = new MultiDatabaseSearcher(altusClient);

  // Register multiple databases
  const dbConfigs = [
    {
      name: 'Primary Application Database',
      host: 'localhost',
      database: 'app_primary',
      username: 'app_user',
      password: 'app_pass',
    },
    {
      name: 'Analytics Database',
      host: 'analytics.example.com',
      database: 'analytics',
      username: 'readonly_user',
      password: 'readonly_pass',
    },
    {
      name: 'Knowledge Base',
      host: 'knowledge.example.com',
      database: 'knowledge_base',
      username: 'kb_user',
      password: 'kb_pass',
    },
  ];

  console.log('Registering databases...');
  for (const config of dbConfigs) {
    await searcher.registerDatabase(config);
  }

  // Perform multi-database search
  console.log('\n=== MULTI-DATABASE SEARCH ===');
  const results = await searcher.searchAcrossDatabases(
    'user authentication security best practices',
    {
      searchMode: 'semantic',
      maxResults: 30,
      limitPerDatabase: 15,
      parallelSearch: true,
    }
  );

  // Display results
  console.log('\n=== SEARCH SUMMARY ===');
  console.log(`Query: "${results.query}"`);
  console.log(`Searched ${results.summary.totalDatabases} databases`);
  console.log(`Found ${results.summary.totalResults} total results`);
  console.log(`Total execution time: ${results.summary.totalExecutionTime}ms`);
  console.log(`Average response time: ${results.summary.averageResponseTime.toFixed(0)}ms`);

  // Show top results from each database
  console.log('\n=== TOP RESULTS BY DATABASE ===');
  results.databaseResults
    .filter(r => r.success)
    .forEach(dbResult => {
      console.log(`\n${dbResult.databaseName} (${dbResult.executionTime}ms):`);
      dbResult.results.slice(0, 3).forEach((result, i) => {
        console.log(`  ${i + 1}. ${result.table} - ${result.relevanceScore.toFixed(3)}`);
        console.log(`     ${result.snippet}`);
      });
    });

  // Show performance comparison
  console.log('\n=== DATABASE PERFORMANCE ===');
  const stats = searcher.getDatabaseStats();
  stats.forEach(stat => {
    console.log(`${stat.name}:`);
    console.log(`  Avg Response: ${stat.performance.avgResponseTime.toFixed(0)}ms`);
    console.log(`  Success Rate: ${(stat.performance.successRate * 100).toFixed(1)}%`);
    console.log(`  Tables: ${stat.tableCount}`);
  });

  // Show any errors
  if (results.errors.length > 0) {
    console.log('\n=== ERRORS ===');
    results.errors.forEach(error => {
      console.log(`${error.database}: ${error.error}`);
    });
  }
}

demonstrateMultiDatabaseSearch().catch(console.error);
```

## Integration Examples

### React Frontend Integration

**Building a React search interface:**

```jsx
// SearchComponent.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { debounce } from 'lodash';

const AltusSearchInterface = ({ altusConfig }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchMode, setSearchMode] = useState('natural');
  const [selectedCategories, setSelectedCategories] = useState([]);

  const altusAPI = altusConfig.baseUrl;
  const authToken = altusConfig.token;

  // Debounced function for getting search suggestions
  const getSuggestions = useCallback(
    debounce(async searchQuery => {
      if (searchQuery.length < 3) return;

      try {
        const response = await fetch(
          `${altusAPI}/search/suggestions?query=${encodeURIComponent(searchQuery)}`,
          {
            headers: { Authorization: `Bearer ${authToken}` },
          }
        );

        const data = await response.json();
        if (data.success) {
          setSuggestions(data.data.slice(0, 5));
        }
      } catch (error) {
        console.error('Failed to get suggestions:', error);
      }
    }, 300),
    [altusAPI, authToken]
  );

  // Handle query input changes
  const handleQueryChange = e => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    getSuggestions(newQuery);
  };

  // Execute search
  const executeSearch = async (searchQuery, mode = searchMode) => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setSuggestions([]);

    try {
      const response = await fetch(`${altusAPI}/search`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: searchQuery,
          databases: altusConfig.databases,
          searchMode: mode,
          limit: 20,
          categories: selectedCategories.length > 0 ? selectedCategories : undefined,
          includeAnalytics: true,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setResults(data.data.results);
        setCategories(data.data.categories || []);
      } else {
        console.error('Search failed:', data.error);
        setResults([]);
      }
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle search form submission
  const handleSearch = e => {
    e.preventDefault();
    executeSearch(query);
  };

  // Handle suggestion selection
  const handleSuggestionSelect = suggestion => {
    setQuery(suggestion.text);
    setSuggestions([]);
    executeSearch(suggestion.text);
  };

  // Handle search mode change
  const handleSearchModeChange = mode => {
    setSearchMode(mode);
    if (query.trim()) {
      executeSearch(query, mode);
    }
  };

  // Handle category filter
  const handleCategoryToggle = categoryName => {
    const newSelected = selectedCategories.includes(categoryName)
      ? selectedCategories.filter(c => c !== categoryName)
      : [...selectedCategories, categoryName];

    setSelectedCategories(newSelected);

    if (query.trim()) {
      executeSearch(query);
    }
  };

  return (
    <div className='altus-search-interface'>
      {/* Search Form */}
      <form onSubmit={handleSearch} className='search-form'>
        <div className='search-input-container'>
          <input
            type='text'
            value={query}
            onChange={handleQueryChange}
            placeholder='Search across your databases...'
            className='search-input'
            autoComplete='off'
          />

          {/* Search Suggestions */}
          {suggestions.length > 0 && (
            <div className='suggestions-dropdown'>
              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className='suggestion-item'
                  onClick={() => handleSuggestionSelect(suggestion)}
                >
                  <span className='suggestion-text'>{suggestion.text}</span>
                  <span className={`suggestion-type ${suggestion.type}`}>{suggestion.type}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <button type='submit' disabled={loading} className='search-button'>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {/* Search Mode Selector */}
      <div className='search-modes'>
        {['natural', 'boolean', 'semantic'].map(mode => (
          <label key={mode} className={`mode-option ${searchMode === mode ? 'active' : ''}`}>
            <input
              type='radio'
              name='searchMode'
              value={mode}
              checked={searchMode === mode}
              onChange={() => handleSearchModeChange(mode)}
            />
            {mode.charAt(0).toUpperCase() + mode.slice(1)}
            {mode === 'semantic' && <span className='ai-badge'>AI</span>}
          </label>
        ))}
      </div>

      {/* Category Filters */}
      {categories.length > 0 && (
        <div className='category-filters'>
          <h4>Filter by Category:</h4>
          <div className='category-buttons'>
            {categories.map(category => (
              <button
                key={category.name}
                onClick={() => handleCategoryToggle(category.name)}
                className={`category-button ${
                  selectedCategories.includes(category.name) ? 'selected' : ''
                }`}
              >
                {category.name} ({category.count})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search Results */}
      <div className='search-results'>
        {loading && (
          <div className='loading-indicator'>
            <div className='spinner'></div>
            Searching across databases...
          </div>
        )}

        {!loading && results.length > 0 && (
          <>
            <div className='results-header'>
              <h3>Found {results.length} results</h3>
              {searchMode === 'semantic' && <span className='ai-powered'>AI-Enhanced Results</span>}
            </div>

            <div className='results-list'>
              {results.map((result, index) => (
                <div key={result.id || index} className='result-item'>
                  <div className='result-header'>
                    <h4 className='result-title'>
                      {result.data.title || result.data.name || `Result from ${result.table}`}
                    </h4>
                    <div className='result-metadata'>
                      <span className='source-table'>{result.table}</span>
                      {result.sourceDatabase && (
                        <span className='source-database'>{result.sourceDatabase.name}</span>
                      )}
                      <span className='relevance-score'>
                        {(result.relevanceScore * 100).toFixed(1)}% match
                      </span>
                    </div>
                  </div>

                  <div className='result-snippet'>{result.snippet}</div>

                  {result.categories && result.categories.length > 0 && (
                    <div className='result-categories'>
                      {result.categories.map(category => (
                        <span key={category} className='result-category'>
                          {category}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Show matched columns */}
                  {result.matchedColumns && result.matchedColumns.length > 0 && (
                    <div className='matched-columns'>
                      <small>Matched in: {result.matchedColumns.join(', ')}</small>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {!loading && query && results.length === 0 && (
          <div className='no-results'>
            <h3>No results found</h3>
            <p>Try adjusting your search terms or using a different search mode.</p>
            {searchMode !== 'semantic' && (
              <button onClick={() => handleSearchModeChange('semantic')} className='try-ai-button'>
                Try AI-powered semantic search
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Usage example
const App = () => {
  const [altusConfig, setAltusConfig] = useState(null);

  useEffect(() => {
    // Initialize Altus configuration
    const initializeAltus = async () => {
      try {
        // Get authentication token
        const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: process.env.REACT_APP_ALTUS_EMAIL,
            password: process.env.REACT_APP_ALTUS_PASSWORD,
          }),
        });

        const loginData = await loginResponse.json();

        if (loginData.success) {
          setAltusConfig({
            baseUrl: 'http://localhost:3000/api',
            token: loginData.data.token,
            databases: process.env.REACT_APP_ALTUS_DATABASES?.split(',') || [],
          });
        }
      } catch (error) {
        console.error('Failed to initialize Altus:', error);
      }
    };

    initializeAltus();
  }, []);

  if (!altusConfig) {
    return <div>Connecting to Altus...</div>;
  }

  return (
    <div className='App'>
      <header>
        <h1>Intelligent Database Search</h1>
        <p>Powered by Altus 4 AI-Enhanced MySQL Search</p>
      </header>

      <main>
        <AltusSearchInterface altusConfig={altusConfig} />
      </main>
    </div>
  );
};

export default App;
```

**CSS for the React component:**

```css
/* SearchComponent.css */
.altus-search-interface {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.search-form {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.search-input-container {
  position: relative;
  flex: 1;
}

.search-input {
  width: 100%;
  padding: 12px 16px;
  font-size: 16px;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  outline: none;
  transition: border-color 0.2s;
}

.search-input:focus {
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

.suggestions-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #e1e5e9;
  border-top: none;
  border-radius: 0 0 8px 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 100;
}

.suggestion-item {
  padding: 12px 16px;
  cursor: pointer;
  border-bottom: 1px solid #f1f3f4;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.suggestion-item:hover {
  background-color: #f8f9fa;
}

.suggestion-item:last-child {
  border-bottom: none;
}

.suggestion-text {
  flex: 1;
}

.suggestion-type {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
}

.suggestion-type.semantic {
  background-color: #e3f2fd;
  color: #1565c0;
}

.suggestion-type.popular {
  background-color: #f3e5f5;
  color: #7b1fa2;
}

.suggestion-type.related {
  background-color: #e8f5e8;
  color: #2e7d32;
}

.search-button {
  padding: 12px 24px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.search-button:hover:not(:disabled) {
  background-color: #0056b3;
}

.search-button:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
}

.search-modes {
  display: flex;
  gap: 15px;
  margin-bottom: 20px;
  padding: 15px;
  background-color: #f8f9fa;
  border-radius: 8px;
}

.mode-option {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 6px;
  transition: background-color 0.2s;
}

.mode-option:hover {
  background-color: #e9ecef;
}

.mode-option.active {
  background-color: #007bff;
  color: white;
}

.mode-option input[type='radio'] {
  display: none;
}

.ai-badge {
  background-color: #ff6b35;
  color: white;
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: bold;
  margin-left: 4px;
}

.category-filters {
  margin-bottom: 20px;
  padding: 15px;
  border: 1px solid #e1e5e9;
  border-radius: 8px;
}

.category-filters h4 {
  margin: 0 0 10px 0;
  font-size: 14px;
  color: #6c757d;
}

.category-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.category-button {
  padding: 6px 12px;
  background-color: white;
  border: 1px solid #e1e5e9;
  border-radius: 16px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.category-button:hover {
  border-color: #007bff;
}

.category-button.selected {
  background-color: #007bff;
  color: white;
  border-color: #007bff;
}

.search-results {
  min-height: 200px;
}

.loading-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 40px;
  color: #6c757d;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #e1e5e9;
  border-top: 2px solid #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 1px solid #e1e5e9;
}

.results-header h3 {
  margin: 0;
  color: #343a40;
}

.ai-powered {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.result-item {
  padding: 16px;
  border: 1px solid #e1e5e9;
  border-radius: 8px;
  transition: box-shadow 0.2s;
}

.result-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.result-title {
  margin: 0;
  font-size: 16px;
  color: #007bff;
  flex: 1;
}

.result-metadata {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 12px;
  color: #6c757d;
}

.source-table,
.source-database {
  background-color: #f8f9fa;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.source-database {
  background-color: #e3f2fd;
  color: #1565c0;
}

.relevance-score {
  color: #28a745;
  font-weight: 600;
}

.result-snippet {
  color: #495057;
  line-height: 1.5;
  margin-bottom: 8px;
}

.result-categories {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.result-category {
  background-color: #fff3cd;
  color: #856404;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
}

.matched-columns {
  font-size: 11px;
  color: #6c757d;
  font-style: italic;
}

.no-results {
  text-align: center;
  padding: 40px 20px;
  color: #6c757d;
}

.no-results h3 {
  margin-bottom: 8px;
  color: #495057;
}

.try-ai-button {
  margin-top: 16px;
  padding: 10px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: transform 0.2s;
}

.try-ai-button:hover {
  transform: translateY(-1px);
}

/* Responsive design */
@media (max-width: 768px) {
  .altus-search-interface {
    padding: 15px;
  }

  .search-form {
    flex-direction: column;
  }

  .search-modes {
    flex-direction: column;
    gap: 8px;
  }

  .result-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .result-metadata {
    flex-wrap: wrap;
  }
}
```

## Performance Testing Examples

### Load Testing Script

**Testing search performance under load:**

```javascript
// performance-test.js
const axios = require('axios');
const { performance } = require('perf_hooks');

class AltusLoadTester {
  constructor(baseURL, credentials) {
    this.baseURL = baseURL;
    this.credentials = credentials;
    this.token = null;
    this.metrics = {
      requests: [],
      errors: [],
      responseTimePercentiles: {},
      throughput: 0,
    };
  }

  async initialize() {
    console.log('Initializing load tester...');

    try {
      const response = await axios.post(`${this.baseURL}/auth/login`, this.credentials);
      this.token = response.data.data.token;
      console.log('Authentication successful');
    } catch (error) {
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  async executeSearch(query, options = {}) {
    const startTime = performance.now();

    try {
      const response = await axios.post(
        `${this.baseURL}/search`,
        {
          query,
          databases: options.databases || [],
          searchMode: options.searchMode || 'natural',
          limit: options.limit || 10,
        },
        {
          headers: { Authorization: `Bearer ${this.token}` },
          timeout: options.timeout || 30000,
        }
      );

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      this.metrics.requests.push({
        query,
        responseTime,
        statusCode: response.status,
        resultCount: response.data.data.results.length,
        timestamp: new Date(),
      });

      return {
        success: true,
        responseTime,
        resultCount: response.data.data.results.length,
      };
    } catch (error) {
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      this.metrics.errors.push({
        query,
        error: error.message,
        responseTime,
        statusCode: error.response?.status || 0,
        timestamp: new Date(),
      });

      return {
        success: false,
        error: error.message,
        responseTime,
      };
    }
  }

  async runLoadTest(config) {
    console.log(`Starting load test: ${config.name}`);
    console.log(`Duration: ${config.duration}ms`);
    console.log(`Concurrent users: ${config.concurrentUsers}`);
    console.log(`Queries: ${config.queries.length}`);

    const startTime = Date.now();
    const endTime = startTime + config.duration;

    // Track active requests
    const activeRequests = new Set();
    let requestId = 0;

    // Function to execute a single request
    const executeRequest = async () => {
      const currentRequestId = ++requestId;
      activeRequests.add(currentRequestId);

      try {
        const query = config.queries[Math.floor(Math.random() * config.queries.length)];
        const result = await this.executeSearch(query, config.searchOptions);

        if (config.onRequest) {
          config.onRequest(result);
        }
      } catch (error) {
        console.error(`Request ${currentRequestId} failed:`, error.message);
      } finally {
        activeRequests.delete(currentRequestId);
      }
    };

    // Maintain concurrent users
    const maintainConcurrency = () => {
      const currentTime = Date.now();
      if (currentTime >= endTime) {
        return; // Test duration exceeded
      }

      const activeCount = activeRequests.size;
      const neededRequests = config.concurrentUsers - activeCount;

      for (let i = 0; i < neededRequests; i++) {
        executeRequest();
      }

      // Schedule next concurrency check
      setTimeout(maintainConcurrency, 100);
    };

    // Start the load test
    maintainConcurrency();

    // Wait for test completion
    await new Promise(resolve => {
      const checkCompletion = () => {
        if (Date.now() >= endTime && activeRequests.size === 0) {
          resolve();
        } else {
          setTimeout(checkCompletion, 100);
        }
      };
      checkCompletion();
    });

    console.log('Load test completed');
    return this.generateReport();
  }

  generateReport() {
    const requests = this.metrics.requests;
    const errors = this.metrics.errors;
    const totalRequests = requests.length + errors.length;

    if (totalRequests === 0) {
      return { error: 'No requests completed' };
    }

    // Calculate response time statistics
    const responseTimes = requests.map(r => r.responseTime);
    responseTimes.sort((a, b) => a - b);

    const calculatePercentile = percentile => {
      const index = Math.ceil((percentile / 100) * responseTimes.length) - 1;
      return responseTimes[Math.max(0, index)] || 0;
    };

    // Calculate throughput
    const testDuration =
      (requests[requests.length - 1]?.timestamp.getTime() - requests[0]?.timestamp.getTime()) /
      1000;
    const throughput = requests.length / testDuration;

    const report = {
      summary: {
        totalRequests,
        successfulRequests: requests.length,
        failedRequests: errors.length,
        successRate: (requests.length / totalRequests) * 100,
        testDuration: testDuration,
        throughput: throughput,
      },
      responseTime: {
        average: responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length,
        min: Math.min(...responseTimes),
        max: Math.max(...responseTimes),
        p50: calculatePercentile(50),
        p90: calculatePercentile(90),
        p95: calculatePercentile(95),
        p99: calculatePercentile(99),
      },
      errors: errors.reduce((acc, error) => {
        acc[error.error] = (acc[error.error] || 0) + 1;
        return acc;
      }, {}),
      timeSeriesData: this.generateTimeSeries(),
      recommendations: this.generateRecommendations(),
    };

    return report;
  }

  generateTimeSeries() {
    const requests = this.metrics.requests;
    if (requests.length === 0) return [];

    // Group requests by second
    const timeGroups = {};
    requests.forEach(request => {
      const second = Math.floor(request.timestamp.getTime() / 1000) * 1000;
      if (!timeGroups[second]) {
        timeGroups[second] = [];
      }
      timeGroups[second].push(request);
    });

    return Object.entries(timeGroups).map(([timestamp, reqs]) => ({
      timestamp: parseInt(timestamp),
      requestCount: reqs.length,
      averageResponseTime: reqs.reduce((sum, r) => sum + r.responseTime, 0) / reqs.length,
      errorCount: reqs.filter(r => r.statusCode >= 400).length,
    }));
  }

  generateRecommendations() {
    const requests = this.metrics.requests;
    const errors = this.metrics.errors;
    const recommendations = [];

    // Performance recommendations
    const avgResponseTime = requests.reduce((sum, r) => sum + r.responseTime, 0) / requests.length;
    if (avgResponseTime > 1000) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        message: `Average response time is ${avgResponseTime.toFixed(0)}ms. Consider optimizing database queries or adding more cache layers.`,
      });
    }

    // Error rate recommendations
    const errorRate = (errors.length / (requests.length + errors.length)) * 100;
    if (errorRate > 5) {
      recommendations.push({
        type: 'reliability',
        priority: 'high',
        message: `Error rate is ${errorRate.toFixed(1)}%. Investigate the most common errors and implement retry logic.`,
      });
    }

    // Throughput recommendations
    const throughput =
      requests.length /
      ((requests[requests.length - 1]?.timestamp.getTime() - requests[0]?.timestamp.getTime()) /
        1000);
    if (throughput < 10) {
      recommendations.push({
        type: 'scalability',
        priority: 'medium',
        message: `Throughput is ${throughput.toFixed(1)} requests/sec. Consider horizontal scaling or connection pooling improvements.`,
      });
    }

    return recommendations;
  }

  printReport(report) {
    console.log('\n=== LOAD TEST REPORT ===');

    console.log('\nSummary:');
    console.log(`  Total Requests: ${report.summary.totalRequests}`);
    console.log(
      `  Successful: ${report.summary.successfulRequests} (${report.summary.successRate.toFixed(1)}%)`
    );
    console.log(`  Failed: ${report.summary.failedRequests}`);
    console.log(`  Test Duration: ${report.summary.testDuration.toFixed(1)}s`);
    console.log(`  Throughput: ${report.summary.throughput.toFixed(1)} req/s`);

    console.log('\nResponse Times:');
    console.log(`  Average: ${report.responseTime.average.toFixed(0)}ms`);
    console.log(`  Min: ${report.responseTime.min.toFixed(0)}ms`);
    console.log(`  Max: ${report.responseTime.max.toFixed(0)}ms`);
    console.log(`  50th percentile: ${report.responseTime.p50.toFixed(0)}ms`);
    console.log(`  90th percentile: ${report.responseTime.p90.toFixed(0)}ms`);
    console.log(`  95th percentile: ${report.responseTime.p95.toFixed(0)}ms`);
    console.log(`  99th percentile: ${report.responseTime.p99.toFixed(0)}ms`);

    if (Object.keys(report.errors).length > 0) {
      console.log('\nErrors:');
      Object.entries(report.errors).forEach(([error, count]) => {
        console.log(`  ${error}: ${count}`);
      });
    }

    if (report.recommendations.length > 0) {
      console.log('\nRecommendations:');
      report.recommendations.forEach((rec, i) => {
        console.log(`  ${i + 1}. [${rec.priority.toUpperCase()}] ${rec.message}`);
      });
    }
  }
}

// Usage example
async function runPerformanceTests() {
  const tester = new AltusLoadTester('http://localhost:3000/api', {
    email: 'test@example.com',
    password: 'testpassword',
  });

  await tester.initialize();

  // Test configuration
  const loadTestConfig = {
    name: 'Search Performance Test',
    duration: 60000, // 1 minute
    concurrentUsers: 20,
    queries: [
      'database optimization',
      'user authentication security',
      'API performance tuning',
      'cache invalidation strategies',
      'SQL query optimization',
      'system monitoring alerts',
      'data backup procedures',
      'error handling best practices',
    ],
    searchOptions: {
      databases: ['db-1', 'db-2'],
      searchMode: 'natural',
      limit: 10,
      timeout: 5000,
    },
    onRequest: result => {
      // Optional: Log individual request results
      if (!result.success) {
        console.log(`Request failed: ${result.error}`);
      }
    },
  };

  try {
    const report = await tester.runLoadTest(loadTestConfig);
    tester.printReport(report);

    // Save detailed report to file
    const fs = require('fs');
    fs.writeFileSync(`load-test-report-${Date.now()}.json`, JSON.stringify(report, null, 2));
    console.log('\nDetailed report saved to file');
  } catch (error) {
    console.error('Load test failed:', error);
  }
}

// Run different test scenarios
async function runAllTests() {
  const tester = new AltusLoadTester('http://localhost:3000/api', {
    email: process.env.ALTUS_EMAIL || 'test@example.com',
    password: process.env.ALTUS_PASSWORD || 'testpassword',
  });

  await tester.initialize();

  // Test scenarios
  const scenarios = [
    {
      name: 'Light Load Test',
      duration: 30000, // 30 seconds
      concurrentUsers: 5,
      queries: ['simple query', 'basic search', 'test data'],
    },
    {
      name: 'Medium Load Test',
      duration: 60000, // 1 minute
      concurrentUsers: 20,
      queries: [
        'complex database query optimization',
        'machine learning algorithm performance',
        'distributed system architecture patterns',
        'security vulnerability assessment',
      ],
    },
    {
      name: 'Heavy Load Test',
      duration: 120000, // 2 minutes
      concurrentUsers: 50,
      queries: [
        'enterprise software architecture design patterns implementation',
        'scalable microservices communication protocols optimization',
        'advanced database indexing strategies for high-performance applications',
      ],
    },
    {
      name: 'Semantic Search Load Test',
      duration: 60000,
      concurrentUsers: 15,
      queries: [
        'How can I improve my application performance?',
        'What are the best practices for security?',
        'Explain database optimization techniques',
      ],
      searchOptions: {
        searchMode: 'semantic', // AI-powered search
        limit: 20,
      },
    },
  ];

  for (const scenario of scenarios) {
    console.log(`\n\n${'='.repeat(50)}`);
    console.log(`Running: ${scenario.name}`);
    console.log(`${'='.repeat(50)}`);

    try {
      const report = await tester.runLoadTest({
        ...scenario,
        searchOptions: {
          databases: [process.env.TEST_DATABASE_ID || 'test-db'],
          ...scenario.searchOptions,
        },
      });

      tester.printReport(report);

      // Wait between tests
      console.log('Waiting 10 seconds before next test...');
      await new Promise(resolve => setTimeout(resolve, 10000));
    } catch (error) {
      console.error(`Test failed: ${scenario.name}`, error.message);
    }
  }
}

// Run the tests
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = AltusLoadTester;
```

## Monitoring & Analytics Examples

### Real-time Analytics Dashboard

**Creating a monitoring dashboard:**

```javascript
// analytics-dashboard.js
const EventEmitter = require('events');
const axios = require('axios');

class AltusAnalyticsDashboard extends EventEmitter {
  constructor(altusConfig) {
    super();
    this.altusConfig = altusConfig;
    this.metrics = {
      searchMetrics: new Map(),
      userActivity: new Map(),
      systemHealth: {},
      trends: [],
    };
    this.isRunning = false;
  }

  async initialize() {
    console.log('Initializing Altus Analytics Dashboard...');

    // Authenticate with Altus
    const response = await axios.post(`${this.altusConfig.baseUrl}/auth/login`, {
      email: this.altusConfig.email,
      password: this.altusConfig.password,
    });

    this.token = response.data.data.token;
    console.log('Connected to Altus 4 Analytics API');
  }

  async startMonitoring(intervalMs = 30000) {
    if (this.isRunning) return;

    this.isRunning = true;
    console.log(`Starting analytics monitoring (interval: ${intervalMs}ms)`);

    const collectMetrics = async () => {
      if (!this.isRunning) return;

      try {
        // Collect various metrics in parallel
        await Promise.all([
          this.collectSearchMetrics(),
          this.collectUserActivity(),
          this.collectSystemHealth(),
          this.collectTrendData(),
        ]);

        // Emit updated metrics
        this.emit('metricsUpdated', this.getSnapshot());
      } catch (error) {
        console.error('Error collecting metrics:', error.message);
        this.emit('error', error);
      }

      // Schedule next collection
      setTimeout(collectMetrics, intervalMs);
    };

    // Start collecting
    await collectMetrics();
  }

  stopMonitoring() {
    this.isRunning = false;
    console.log('Analytics monitoring stopped');
  }

  async collectSearchMetrics() {
    try {
      const response = await axios.get(`${this.altusConfig.baseUrl}/analytics/performance`, {
        headers: { Authorization: `Bearer ${this.token}` },
        params: {
          timeFrame: '30m',
          includeBreakdown: true,
        },
      });

      const data = response.data.data;

      // Update search metrics
      this.metrics.searchMetrics.set('totalSearches', data.totalSearches || 0);
      this.metrics.searchMetrics.set('averageResponseTime', data.averageResponseTime || 0);
      this.metrics.searchMetrics.set('successRate', data.successRate || 100);
      this.metrics.searchMetrics.set('cacheHitRate', data.cacheHitRate || 0);
      this.metrics.searchMetrics.set('aiSearchPercentage', data.aiSearchPercentage || 0);

      // Breakdown by search mode
      if (data.searchModeBreakdown) {
        Object.entries(data.searchModeBreakdown).forEach(([mode, stats]) => {
          this.metrics.searchMetrics.set(`${mode}Searches`, stats.count);
          this.metrics.searchMetrics.set(`${mode}AvgTime`, stats.averageTime);
        });
      }
    } catch (error) {
      console.warn('Failed to collect search metrics:', error.message);
    }
  }

  async collectUserActivity() {
    try {
      const response = await axios.get(`${this.altusConfig.baseUrl}/analytics/user-activity`, {
        headers: { Authorization: `Bearer ${this.token}` },
        params: { timeFrame: '1h' },
      });

      const data = response.data.data;

      this.metrics.userActivity.set('activeUsers', data.activeUsers || 0);
      this.metrics.userActivity.set('totalUsers', data.totalUsers || 0);
      this.metrics.userActivity.set('newUsers', data.newUsers || 0);
      this.metrics.userActivity.set('topQueries', data.topQueries || []);
    } catch (error) {
      console.warn('Failed to collect user activity:', error.message);
    }
  }

  async collectSystemHealth() {
    try {
      // Check main system health
      const healthResponse = await axios.get(
        `${this.altusConfig.baseUrl.replace('/api', '')}/health`
      );

      // Check database health
      const dbHealthResponse = await axios.get(
        `${this.altusConfig.baseUrl.replace('/api', '')}/health/db`
      );

      // Check Redis health
      const redisHealthResponse = await axios.get(
        `${this.altusConfig.baseUrl.replace('/api', '')}/health/redis`
      );

      this.metrics.systemHealth = {
        overall: healthResponse.data.status === 'healthy',
        database: dbHealthResponse.data.status === 'healthy',
        redis: redisHealthResponse.data.status === 'healthy',
        uptime: healthResponse.data.uptime || 0,
        lastCheck: new Date(),
      };
    } catch (error) {
      console.warn('Failed to collect system health:', error.message);
      this.metrics.systemHealth = {
        overall: false,
        database: false,
        redis: false,
        uptime: 0,
        lastCheck: new Date(),
        error: error.message,
      };
    }
  }

  async collectTrendData() {
    try {
      const response = await axios.get(`${this.altusConfig.baseUrl}/analytics/trends`, {
        headers: { Authorization: `Bearer ${this.token}` },
        params: {
          timeFrame: '24h',
          includeCategories: true,
        },
      });

      this.metrics.trends = response.data.data.trends || [];
    } catch (error) {
      console.warn('Failed to collect trend data:', error.message);
    }
  }

  getSnapshot() {
    return {
      timestamp: new Date(),
      search: Object.fromEntries(this.metrics.searchMetrics),
      users: Object.fromEntries(this.metrics.userActivity),
      system: this.metrics.systemHealth,
      trends: this.metrics.trends,
      summary: this.generateSummary(),
    };
  }

  generateSummary() {
    const search = this.metrics.searchMetrics;
    const users = this.metrics.userActivity;
    const system = this.metrics.systemHealth;

    return {
      status: system.overall ? 'healthy' : 'degraded',
      totalSearches: search.get('totalSearches') || 0,
      activeUsers: users.get('activeUsers') || 0,
      averageResponseTime: search.get('averageResponseTime') || 0,
      successRate: search.get('successRate') || 100,
      aiUsage: search.get('aiSearchPercentage') || 0,
      cacheEfficiency: search.get('cacheHitRate') || 0,
    };
  }

  // Real-time alerting
  checkAlerts() {
    const alerts = [];
    const search = this.metrics.searchMetrics;
    const system = this.metrics.systemHealth;

    // Performance alerts
    const avgResponseTime = search.get('averageResponseTime') || 0;
    if (avgResponseTime > 2000) {
      alerts.push({
        type: 'performance',
        severity: 'high',
        message: `Average response time is ${avgResponseTime}ms (threshold: 2000ms)`,
        metric: 'response_time',
        value: avgResponseTime,
      });
    }

    // Success rate alerts
    const successRate = search.get('successRate') || 100;
    if (successRate < 95) {
      alerts.push({
        type: 'reliability',
        severity: 'high',
        message: `Search success rate is ${successRate}% (threshold: 95%)`,
        metric: 'success_rate',
        value: successRate,
      });
    }

    // System health alerts
    if (!system.overall || !system.database || !system.redis) {
      alerts.push({
        type: 'infrastructure',
        severity: 'critical',
        message: 'System health check failed',
        details: {
          overall: system.overall,
          database: system.database,
          redis: system.redis,
        },
      });
    }

    // Cache performance alerts
    const cacheHitRate = search.get('cacheHitRate') || 0;
    if (cacheHitRate < 60) {
      alerts.push({
        type: 'performance',
        severity: 'medium',
        message: `Cache hit rate is ${cacheHitRate}% (expected: >60%)`,
        metric: 'cache_hit_rate',
        value: cacheHitRate,
      });
    }

    if (alerts.length > 0) {
      this.emit('alerts', alerts);
    }

    return alerts;
  }

  // Generate reports
  async generateReport(timeframe = '24h') {
    console.log(`Generating analytics report for ${timeframe}...`);

    try {
      const [overviewRes, trendsRes, performanceRes] = await Promise.all([
        axios.get(`${this.altusConfig.baseUrl}/analytics/overview`, {
          headers: { Authorization: `Bearer ${this.token}` },
          params: { timeFrame: timeframe },
        }),
        axios.get(`${this.altusConfig.baseUrl}/analytics/trends`, {
          headers: { Authorization: `Bearer ${this.token}` },
          params: { timeFrame: timeframe },
        }),
        axios.get(`${this.altusConfig.baseUrl}/analytics/performance`, {
          headers: { Authorization: `Bearer ${this.token}` },
          params: { timeFrame: timeframe },
        }),
      ]);

      const report = {
        timeframe,
        generatedAt: new Date(),
        overview: overviewRes.data.data,
        trends: trendsRes.data.data,
        performance: performanceRes.data.data,
        currentSnapshot: this.getSnapshot(),
      };

      return report;
    } catch (error) {
      console.error('Failed to generate report:', error.message);
      throw error;
    }
  }

  // Display real-time console dashboard
  startConsoleDashboard() {
    const displayDashboard = () => {
      // Clear console
      process.stdout.write('\x1B[2J\x1B[0f');

      const snapshot = this.getSnapshot();
      const summary = snapshot.summary;

      console.log('╔══════════════════════════════════════════════════════════════╗');
      console.log('║                    ALTUS 4 ANALYTICS DASHBOARD                ║');
      console.log('╚══════════════════════════════════════════════════════════════╝');
      console.log(`Last Updated: ${snapshot.timestamp.toLocaleString()}\n`);

      // System status
      const statusIcon = summary.status === 'healthy' ? '[OK]' : '[ERROR]';
      console.log(`System Status: ${statusIcon} ${summary.status.toUpperCase()}`);

      if (snapshot.system.uptime) {
        console.log(`Uptime: ${(snapshot.system.uptime / 3600).toFixed(1)} hours`);
      }

      console.log('\nSEARCH METRICS');
      console.log('─'.repeat(50));
      console.log(`Total Searches (30m): ${summary.totalSearches}`);
      console.log(`Average Response Time: ${summary.averageResponseTime.toFixed(0)}ms`);
      console.log(`Success Rate: ${summary.successRate.toFixed(1)}%`);
      console.log(`Cache Hit Rate: ${summary.cacheEfficiency.toFixed(1)}%`);
      console.log(`AI Search Usage: ${summary.aiUsage.toFixed(1)}%`);

      console.log('\n👥 USER ACTIVITY');
      console.log('─'.repeat(50));
      console.log(`Active Users: ${summary.activeUsers}`);
      console.log(`Total Users: ${snapshot.users.totalUsers || 0}`);

      if (snapshot.users.topQueries && snapshot.users.topQueries.length > 0) {
        console.log('\nTOP QUERIES');
        snapshot.users.topQueries.slice(0, 5).forEach((query, i) => {
          console.log(`  ${i + 1}. "${query.text}" (${query.count})`);
        });
      }

      if (snapshot.trends.length > 0) {
        console.log('\nTRENDING TOPICS');
        console.log('─'.repeat(50));
        snapshot.trends.slice(0, 5).forEach(trend => {
          const arrow = trend.growth > 0 ? '↑' : trend.growth < 0 ? '↓' : '→';
          console.log(`  ${arrow} ${trend.category}: ${trend.queries} queries (+${trend.growth}%)`);
        });
      }

      // Check and display alerts
      const alerts = this.checkAlerts();
      if (alerts.length > 0) {
        console.log('\n🚨 ACTIVE ALERTS');
        console.log('─'.repeat(50));
        alerts.forEach(alert => {
          const icon =
            alert.severity === 'critical' ? '🔴' : alert.severity === 'high' ? '🟠' : '🟡';
          console.log(`  ${icon} [${alert.severity.toUpperCase()}] ${alert.message}`);
        });
      }

      console.log('\n' + '═'.repeat(60));
      console.log('Press Ctrl+C to exit dashboard');
    };

    // Update dashboard every 5 seconds
    this.dashboardInterval = setInterval(displayDashboard, 5000);
    displayDashboard(); // Initial display

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      if (this.dashboardInterval) {
        clearInterval(this.dashboardInterval);
      }
      this.stopMonitoring();
      console.log('\n\nDashboard stopped');
      process.exit(0);
    });
  }
}

// Usage example
async function startAnalyticsDashboard() {
  const dashboard = new AltusAnalyticsDashboard({
    baseUrl: 'http://localhost:3000/api',
    email: process.env.ALTUS_EMAIL || 'admin@example.com',
    password: process.env.ALTUS_PASSWORD || 'admin123',
  });

  try {
    await dashboard.initialize();

    // Set up event listeners
    dashboard.on('metricsUpdated', snapshot => {
      // Handle metrics updates
      console.log(`Metrics updated at ${snapshot.timestamp}`);
    });

    dashboard.on('alerts', alerts => {
      // Handle alerts
      console.log(`🚨 ${alerts.length} alerts triggered`);
      alerts.forEach(alert => {
        console.log(`   - [${alert.severity}] ${alert.message}`);
      });
    });

    dashboard.on('error', error => {
      console.error('Dashboard error:', error.message);
    });

    // Start monitoring and console dashboard
    await dashboard.startMonitoring(30000); // Every 30 seconds
    dashboard.startConsoleDashboard();

    // Generate reports periodically
    setInterval(async () => {
      try {
        const report = await dashboard.generateReport('1h');
        console.log('Hourly report generated');

        // Save report to file
        const fs = require('fs');
        fs.writeFileSync(`analytics-report-${Date.now()}.json`, JSON.stringify(report, null, 2));
      } catch (error) {
        console.error('Failed to generate report:', error.message);
      }
    }, 3600000); // Every hour
  } catch (error) {
    console.error('Failed to start analytics dashboard:', error);
    process.exit(1);
  }
}

// Start the dashboard
if (require.main === module) {
  startAnalyticsDashboard();
}

module.exports = AltusAnalyticsDashboard;
```

## Summary

This comprehensive examples guide covers:

- **Basic Integration**: Simple authentication and search
- **Advanced Features**: Semantic search, multi-database operations
- **Frontend Integration**: React components with real-time features
- **Performance Testing**: Load testing and benchmarking
- **Analytics**: Real-time monitoring and reporting

Each example includes complete, working code that you can adapt for your specific use case. The examples demonstrate best practices for error handling, performance optimization, and user experience.

## Next Steps

- **[API Reference](../api/)** - Complete API documentation
- **[Architecture Guide](../architecture/)** - System design details
- **[Testing Guide](../testing/)** - Comprehensive testing strategies
- **[Development Guide](../development/)** - Contributing guidelines

---

**These examples provide a solid foundation for building powerful, AI-enhanced search applications with Altus 4.**
