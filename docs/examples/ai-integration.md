---
title: AI Integration Examples
description: Harness the power of AI-enhanced search with semantic understanding, intelligent categorization, and query optimization.
---

# AI Integration Examples

Harness AI-Enhanced Search Capabilities

This guide demonstrates how to leverage Altus 4's AI-powered features including semantic search, intelligent query optimization, and automated result enhancement.

## Prerequisites

- **OpenAI API Key** configured in your Altus 4 instance
- Understanding of [Basic Search](./basic-search.md) concepts
- API key with `search` and `analytics` permissions

## Semantic Search

### Understanding Semantic vs Keyword Search

Semantic search understands meaning and context, not just keywords:

```javascript
// Compare different search modes
const searchModes = [
  {
    mode: 'natural',
    query: 'mysql performance',
    description: 'Traditional keyword matching',
  },
  {
    mode: 'semantic',
    query: 'improve database speed',
    description: 'AI understands "speed" relates to "performance"',
  },
  {
    mode: 'semantic',
    query: 'how to make queries faster',
    description: 'Natural language understanding',
  },
];

async function compareSearchModes(apiKey, databases) {
  const results = {};

  for (const config of searchModes) {
    const response = await fetch('https://api.altus4.com/api/v1/search', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: config.query,
        databases,
        searchMode: config.mode,
        limit: 10,
      }),
    });

    const data = await response.json();
    results[config.mode] = {
      query: config.query,
      resultCount: data.data?.totalCount || 0,
      topResult: data.data?.results[0]?.data?.title || 'No results',
      executionTime: data.data?.executionTime || 0,
    };
  }

  return results;
}

// Usage
const comparison = await compareSearchModes(apiKey, ['tech_docs_db']);
console.log('Search mode comparison:', comparison);
```

### Semantic Query Expansion

AI automatically expands queries with related concepts:

```python
import asyncio
import aiohttp
from typing import List, Dict

class SemanticSearchClient:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.altus4.com/api/v1"

    async def semantic_search_with_expansion(
        self,
        query: str,
        databases: List[str],
        expansion_level: str = "moderate"
    ) -> Dict:
        """
        Perform semantic search with query expansion

        expansion_level: 'conservative', 'moderate', 'aggressive'
        """
        async with aiohttp.ClientSession() as session:
            # First, get query expansion suggestions
            expansion_response = await session.post(
                f"{self.base_url}/ai/expand-query",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={
                    "query": query,
                    "expansionLevel": expansion_level,
                    "includeContext": True
                }
            )

            expansion_data = await expansion_response.json()

            # Use the expanded query for semantic search
            expanded_query = expansion_data.get("data", {}).get("expandedQuery", query)

            search_response = await session.post(
                f"{self.base_url}/search",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={
                    "query": expanded_query,
                    "databases": databases,
                    "searchMode": "semantic",
                    "includeAnalytics": True,
                    "limit": 25
                }
            )

            search_data = await search_response.json()

            # Combine results with expansion metadata
            return {
                "originalQuery": query,
                "expandedQuery": expanded_query,
                "expansionConcepts": expansion_data.get("data", {}).get("concepts", []),
                "results": search_data.get("data", {}),
                "semanticContext": expansion_data.get("data", {}).get("context", {})
            }

# Usage examples
async def semantic_search_examples():
    client = SemanticSearchClient(api_key)

    # Example 1: Technical documentation search
    tech_results = await client.semantic_search_with_expansion(
        "optimize database performance",
        ["tech_docs_db"],
        "moderate"
    )

    print(f"Original: {tech_results['originalQuery']}")
    print(f"Expanded: {tech_results['expandedQuery']}")
    print(f"Concepts: {tech_results['expansionConcepts']}")

    # Example 2: Product search with aggressive expansion
    product_results = await client.semantic_search_with_expansion(
        "fast laptop for gaming",
        ["ecommerce_db"],
        "aggressive"
    )

    return tech_results, product_results

# Run examples
tech_results, product_results = await semantic_search_examples()
```

## AI-Powered Query Optimization

### Automatic Query Enhancement

```bash
# Get AI suggestions for query improvement
curl -X POST https://api.altus4.com/api/v1/search/optimize \
  -H "Authorization: Bearer altus4_sk_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "query": "database slow",
    "databases": ["tech_db"],
    "includeAlternatives": true,
    "optimizationGoals": ["relevance", "performance"]
  }'
```

**Response:**

```json
{
  "success": true,
  "data": {
    "originalQuery": "database slow",
    "optimizedQuery": "database performance optimization slow query",
    "improvements": [
      {
        "type": "specificity",
        "description": "Added specific terms for better matching",
        "impact": "high"
      },
      {
        "type": "context",
        "description": "Added context terms to clarify intent",
        "impact": "medium"
      }
    ],
    "alternatives": [
      "mysql performance tuning",
      "database query optimization",
      "slow database troubleshooting"
    ],
    "expectedImprovement": {
      "relevanceIncrease": "35%",
      "resultQuality": "significantly better"
    }
  }
}
```

### Intelligent Query Analysis

```javascript
class QueryIntelligenceEngine {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.queryHistory = [];
  }

  async analyzeQueryIntent(query, context = {}) {
    const response = await fetch('https://api.altus4.com/api/v1/ai/analyze-intent', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        context,
        includeConfidence: true,
        includeSuggestions: true,
      }),
    });

    return await response.json();
  }

  async optimizeForDomain(query, domain, databases) {
    // Domain-specific optimization (e.g., 'technical', 'ecommerce', 'support')
    const optimization = await fetch('https://api.altus4.com/api/v1/ai/optimize-domain', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        domain,
        databases,
        includeTerminology: true,
      }),
    });

    const optimizationData = await optimization.json();

    // Execute optimized search
    const searchResponse = await fetch('https://api.altus4.com/api/v1/search', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: optimizationData.data.optimizedQuery,
        databases,
        searchMode: 'semantic',
        limit: 20,
      }),
    });

    const searchData = await searchResponse.json();

    return {
      optimization: optimizationData.data,
      results: searchData.data,
    };
  }

  async learnFromFeedback(query, results, userFeedback) {
    // Send feedback to improve future AI suggestions
    await fetch('https://api.altus4.com/api/v1/ai/feedback', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        resultIds: results.map(r => r.id),
        feedback: {
          relevanceRating: userFeedback.relevance, // 1-5
          clickedResults: userFeedback.clicked,
          queryIntent: userFeedback.intent,
          suggestions: userFeedback.suggestions,
        },
      }),
    });
  }

  async getPersonalizedSuggestions(userId, recentQueries) {
    const response = await fetch('https://api.altus4.com/api/v1/ai/personalized-suggestions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        recentQueries,
        includeTopics: true,
        includeRelated: true,
      }),
    });

    return await response.json();
  }
}

// Usage examples
const queryEngine = new QueryIntelligenceEngine(apiKey);

// Analyze query intent
const intentAnalysis = await queryEngine.analyzeQueryIntent('how to fix slow database', {
  userRole: 'developer',
  previousQueries: ['mysql optimization'],
});

console.log('Query intent:', intentAnalysis.data.intent);
console.log('Confidence:', intentAnalysis.data.confidence);

// Domain-specific optimization
const techOptimization = await queryEngine.optimizeForDomain('performance issues', 'technical', [
  'tech_docs_db',
]);

console.log('Optimized query:', techOptimization.optimization.optimizedQuery);
console.log('Domain terms added:', techOptimization.optimization.domainTerms);
```

## Intelligent Result Categorization

### Automatic Content Classification

```python
class AIResultCategorizer:
    def __init__(self, api_key: str):
        self.api_key = api_key

    async def categorize_results(
        self,
        search_results: dict,
        category_types: List[str] = None
    ) -> dict:
        """
        Automatically categorize search results using AI

        category_types: ['topic', 'content_type', 'difficulty', 'audience', 'format']
        """
        if not category_types:
            category_types = ['topic', 'content_type', 'difficulty']

        async with aiohttp.ClientSession() as session:
            response = await session.post(
                "https://api.altus4.com/api/v1/ai/categorize",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={
                    "results": search_results["data"]["results"],
                    "categoryTypes": category_types,
                    "includeConfidence": True,
                    "maxCategories": 8
                }
            )

            categorization = await response.json()

            # Enhance original results with categories
            enhanced_results = search_results.copy()

            for result in enhanced_results["data"]["results"]:
                result_categories = next(
                    (cat for cat in categorization["data"]["categorizations"]
                     if cat["resultId"] == result["id"]),
                    None
                )

                if result_categories:
                    result["aiCategories"] = result_categories["categories"]
                    result["categoryConfidence"] = result_categories["confidence"]

            # Add category summaries
            enhanced_results["data"]["categoryBreakdown"] = categorization["data"]["summary"]

            return enhanced_results

    async def create_category_facets(self, categorized_results: dict) -> dict:
        """Create faceted navigation from categorized results"""
        facets = {}

        for result in categorized_results["data"]["results"]:
            if "aiCategories" not in result:
                continue

            for category_type, categories in result["aiCategories"].items():
                if category_type not in facets:
                    facets[category_type] = {}

                for category in categories:
                    category_name = category["name"]
                    if category_name not in facets[category_type]:
                        facets[category_type][category_name] = {
                            "count": 0,
                            "results": [],
                            "avgConfidence": 0
                        }

                    facets[category_type][category_name]["count"] += 1
                    facets[category_type][category_name]["results"].append(result["id"])
                    facets[category_type][category_name]["avgConfidence"] += category["confidence"]

        # Calculate average confidence
        for category_type in facets:
            for category_name in facets[category_type]:
                count = facets[category_type][category_name]["count"]
                facets[category_type][category_name]["avgConfidence"] /= count

        return facets

    async def filter_by_category(
        self,
        categorized_results: dict,
        category_filters: dict
    ) -> dict:
        """Filter results by AI-generated categories"""
        filtered_results = []

        for result in categorized_results["data"]["results"]:
            if "aiCategories" not in result:
                continue

            matches_filter = True

            for filter_type, filter_values in category_filters.items():
                if filter_type not in result["aiCategories"]:
                    matches_filter = False
                    break

                category_names = [cat["name"] for cat in result["aiCategories"][filter_type]]

                if not any(filter_val in category_names for filter_val in filter_values):
                    matches_filter = False
                    break

            if matches_filter:
                filtered_results.append(result)

        # Create filtered response
        filtered_response = categorized_results.copy()
        filtered_response["data"]["results"] = filtered_results
        filtered_response["data"]["totalCount"] = len(filtered_results)
        filtered_response["data"]["filteredBy"] = category_filters

        return filtered_response

# Usage examples
async def categorization_examples():
    categorizer = AIResultCategorizer(api_key)

    # Perform initial search
    search_response = await aiohttp.ClientSession().post(
        "https://api.altus4.com/api/v1/search",
        headers={"Authorization": f"Bearer {api_key}"},
        json={
            "query": "machine learning algorithms",
            "databases": ["tech_docs_db"],
            "searchMode": "semantic",
            "limit": 30
        }
    )

    search_results = await search_response.json()

    # Categorize results
    categorized = await categorizer.categorize_results(
        search_results,
        ["topic", "content_type", "difficulty", "audience"]
    )

    print("Category breakdown:", categorized["data"]["categoryBreakdown"])

    # Create facets for navigation
    facets = await categorizer.create_category_facets(categorized)
    print("Available facets:", list(facets.keys()))

    # Filter by categories
    filtered = await categorizer.filter_by_category(
        categorized,
        {
            "difficulty": ["beginner", "intermediate"],
            "content_type": ["tutorial", "guide"]
        }
    )

    print(f"Filtered results: {filtered['data']['totalCount']} items")

    return categorized, facets, filtered

# Run categorization examples
categorized, facets, filtered = await categorization_examples()
```

## Smart Query Suggestions

### Context-Aware Suggestions

```javascript
class SmartSuggestionEngine {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.userContext = {};
  }

  async getSmartSuggestions(partialQuery, context = {}) {
    const response = await fetch('https://api.altus4.com/api/v1/search/suggestions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: partialQuery,
        context: {
          ...this.userContext,
          ...context,
        },
        suggestionTypes: [
          'completion', // Auto-complete current query
          'related', // Related queries
          'trending', // Popular queries
          'corrected', // Spelling corrections
          'semantic', // Semantically similar queries
        ],
        limit: 10,
      }),
    });

    return await response.json();
  }

  async getQueryCorrections(query) {
    const response = await fetch('https://api.altus4.com/api/v1/ai/spell-check', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        includeSuggestions: true,
        contextAware: true,
      }),
    });

    return await response.json();
  }

  async getTrendingSuggestions(timeframe = '7d', category = null) {
    const params = new URLSearchParams({
      timeframe,
      limit: '10',
    });

    if (category) {
      params.append('category', category);
    }

    const response = await fetch(
      `https://api.altus4.com/api/v1/analytics/trending-queries?${params}`,
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      }
    );

    return await response.json();
  }

  updateUserContext(context) {
    this.userContext = { ...this.userContext, ...context };
  }

  async buildSearchInterface(containerId) {
    const container = document.getElementById(containerId);

    // Create search input with real-time suggestions
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search with AI assistance...';
    searchInput.className = 'ai-search-input';

    const suggestionsContainer = document.createElement('div');
    suggestionsContainer.className = 'suggestions-container';

    // Real-time suggestion handling
    let suggestionTimeout;
    searchInput.addEventListener('input', async e => {
      clearTimeout(suggestionTimeout);

      if (e.target.value.length < 2) {
        suggestionsContainer.innerHTML = '';
        return;
      }

      suggestionTimeout = setTimeout(async () => {
        const suggestions = await this.getSmartSuggestions(e.target.value);
        this.renderSuggestions(suggestions, suggestionsContainer);
      }, 300); // Debounce
    });

    container.appendChild(searchInput);
    container.appendChild(suggestionsContainer);

    return { searchInput, suggestionsContainer };
  }

  renderSuggestions(suggestions, container) {
    container.innerHTML = '';

    if (!suggestions.data?.suggestions) return;

    suggestions.data.suggestions.forEach(suggestion => {
      const suggestionElement = document.createElement('div');
      suggestionElement.className = `suggestion suggestion-${suggestion.type}`;
      suggestionElement.innerHTML = `
        <span class="suggestion-text">${suggestion.text}</span>
        <span class="suggestion-type">${suggestion.type}</span>
        <span class="suggestion-score">${Math.round(suggestion.score * 100)}%</span>
      `;

      suggestionElement.addEventListener('click', () => {
        document.querySelector('.ai-search-input').value = suggestion.text;
        container.innerHTML = '';
      });

      container.appendChild(suggestionElement);
    });
  }
}

// Usage
const suggestionEngine = new SmartSuggestionEngine(apiKey);

// Set user context for better suggestions
suggestionEngine.updateUserContext({
  role: 'developer',
  interests: ['database', 'performance', 'optimization'],
  recentQueries: ['mysql indexing', 'query performance'],
});

// Get suggestions for partial query
const suggestions = await suggestionEngine.getSmartSuggestions('mysql perf');
console.log('Smart suggestions:', suggestions.data.suggestions);

// Check for spelling corrections
const corrections = await suggestionEngine.getQueryCorrections('databse performace');
console.log('Corrections:', corrections.data.corrections);

// Get trending queries
const trending = await suggestionEngine.getTrendingSuggestions('7d', 'database');
console.log('Trending:', trending.data.queries);
```

## AI-Enhanced Analytics

### Intelligent Search Insights

```python
class AIAnalyticsEngine:
    def __init__(self, api_key: str):
        self.api_key = api_key

    async def generate_search_insights(
        self,
        user_id: str,
        time_period: str = "30d"
    ) -> dict:
        """Generate AI-powered insights from search analytics"""
        async with aiohttp.ClientSession() as session:
            # Get raw analytics data
            analytics_response = await session.get(
                f"https://api.altus4.com/api/v1/analytics/user-activity",
                headers={"Authorization": f"Bearer {self.api_key}"},
                params={
                    "userId": user_id,
                    "period": time_period,
                    "includeQueries": True,
                    "includePerformance": True
                }
            )

            analytics_data = await analytics_response.json()

            # Generate AI insights
            insights_response = await session.post(
                f"https://api.altus4.com/api/v1/ai/generate-insights",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={
                    "analyticsData": analytics_data["data"],
                    "insightTypes": [
                        "search_patterns",
                        "performance_trends",
                        "content_gaps",
                        "optimization_opportunities"
                    ],
                    "includeRecommendations": True
                }
            )

            return await insights_response.json()

    async def predict_search_trends(
        self,
        historical_data: dict,
        forecast_days: int = 30
    ) -> dict:
        """Predict future search trends using AI"""
        async with aiohttp.ClientSession() as session:
            response = await session.post(
                f"https://api.altus4.com/api/v1/ai/predict-trends",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={
                    "historicalData": historical_data,
                    "forecastDays": forecast_days,
                    "includeConfidence": True,
                    "includeFactors": True
                }
            )

            return await response.json()

    async def analyze_content_performance(
        self,
        content_results: List[dict]
    ) -> dict:
        """Analyze which content performs best in search"""
        async with aiohttp.ClientSession() as session:
            response = await session.post(
                f"https://api.altus4.com/api/v1/ai/analyze-content",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={
                    "contentResults": content_results,
                    "analysisTypes": [
                        "relevance_factors",
                        "engagement_patterns",
                        "content_quality",
                        "optimization_suggestions"
                    ]
                }
            )

            return await response.json()

    async def generate_search_report(
        self,
        user_id: str,
        report_type: str = "comprehensive"
    ) -> dict:
        """Generate comprehensive AI-powered search report"""
        # Gather data from multiple sources
        insights = await self.generate_search_insights(user_id)

        # Get recent search results for content analysis
        recent_searches = await self.get_recent_searches(user_id, limit=100)
        content_analysis = await self.analyze_content_performance(recent_searches)

        # Compile comprehensive report
        report = {
            "reportType": report_type,
            "generatedAt": datetime.now().isoformat(),
            "userId": user_id,
            "insights": insights["data"],
            "contentAnalysis": content_analysis["data"],
            "recommendations": self.compile_recommendations(insights, content_analysis),
            "actionItems": self.generate_action_items(insights, content_analysis)
        }

        return report

    def compile_recommendations(self, insights: dict, content_analysis: dict) -> List[dict]:
        """Compile actionable recommendations from AI analysis"""
        recommendations = []

        # Add insights-based recommendations
        if insights.get("data", {}).get("recommendations"):
            recommendations.extend(insights["data"]["recommendations"])

        # Add content-based recommendations
        if content_analysis.get("data", {}).get("optimizationSuggestions"):
            recommendations.extend(content_analysis["data"]["optimizationSuggestions"])

        # Sort by impact and feasibility
        recommendations.sort(key=lambda x: (x.get("impact", 0) + x.get("feasibility", 0)), reverse=True)

        return recommendations[:10]  # Top 10 recommendations

    def generate_action_items(self, insights: dict, content_analysis: dict) -> List[dict]:
        """Generate specific action items from analysis"""
        actions = []

        # Performance optimization actions
        if insights.get("data", {}).get("performanceTrends", {}).get("slowQueries"):
            actions.append({
                "category": "performance",
                "action": "Optimize slow-performing queries",
                "priority": "high",
                "effort": "medium",
                "expectedImpact": "Reduce average search time by 30%"
            })

        # Content gap actions
        if content_analysis.get("data", {}).get("contentGaps"):
            actions.append({
                "category": "content",
                "action": "Create content for underserved topics",
                "priority": "medium",
                "effort": "high",
                "expectedImpact": "Improve search satisfaction by 25%"
            })

        return actions

# Usage examples
async def ai_analytics_examples():
    analytics_engine = AIAnalyticsEngine(api_key)

    # Generate insights for a user
    insights = await analytics_engine.generate_search_insights("user-123", "30d")
    print("AI Insights:", insights["data"]["insights"])

    # Generate comprehensive report
    report = await analytics_engine.generate_search_report("user-123", "comprehensive")
    print("Report recommendations:", len(report["recommendations"]))
    print("Action items:", len(report["actionItems"]))

    return insights, report

# Run analytics examples
insights, report = await ai_analytics_examples()
```

## Best Practices for AI Integration

### 1. Fallback Strategies

Always implement fallbacks when AI services are unavailable:

```javascript
class RobustAISearch {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.aiAvailable = true;
  }

  async search(query, databases, options = {}) {
    try {
      // Try AI-enhanced search first
      if (this.aiAvailable && options.useAI !== false) {
        return await this.aiEnhancedSearch(query, databases, options);
      }
    } catch (error) {
      console.warn('AI search failed, falling back to standard search:', error);
      this.aiAvailable = false;

      // Retry AI after 5 minutes
      setTimeout(
        () => {
          this.aiAvailable = true;
        },
        5 * 60 * 1000
      );
    }

    // Fallback to standard search
    return await this.standardSearch(query, databases, options);
  }

  async aiEnhancedSearch(query, databases, options) {
    const response = await fetch('https://api.altus4.com/api/v1/search', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        databases,
        searchMode: 'semantic',
        includeAnalytics: true,
        ...options,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI search failed: ${response.status}`);
    }

    return await response.json();
  }

  async standardSearch(query, databases, options) {
    const response = await fetch('https://api.altus4.com/api/v1/search', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        databases,
        searchMode: 'natural', // Fallback to natural language mode
        ...options,
      }),
    });

    return await response.json();
  }
}
```

### 2. Performance Monitoring

Monitor AI feature performance and costs:

```python
class AIPerformanceMonitor:
    def __init__(self):
        self.metrics = {
            "ai_requests": 0,
            "ai_failures": 0,
            "ai_response_times": [],
            "fallback_usage": 0
        }

    def track_ai_request(self, start_time: float, success: bool):
        self.metrics["ai_requests"] += 1
        self.metrics["ai_response_times"].append(time.time() - start_time)

        if not success:
            self.metrics["ai_failures"] += 1

    def track_fallback_usage(self):
        self.metrics["fallback_usage"] += 1

    def get_performance_report(self) -> dict:
        if not self.metrics["ai_requests"]:
            return {"status": "no_data"}

        avg_response_time = sum(self.metrics["ai_response_times"]) / len(self.metrics["ai_response_times"])
        failure_rate = self.metrics["ai_failures"] / self.metrics["ai_requests"]
        fallback_rate = self.metrics["fallback_usage"] / self.metrics["ai_requests"]

        return {
            "total_requests": self.metrics["ai_requests"],
            "average_response_time": round(avg_response_time, 2),
            "failure_rate": round(failure_rate * 100, 2),
            "fallback_rate": round(fallback_rate * 100, 2),
            "status": "healthy" if failure_rate < 0.05 else "degraded"
        }
```

### 3. Cost Optimization

Optimize AI usage to manage costs:

```javascript
class CostOptimizedAI {
  constructor(apiKey, budget = { daily: 100, monthly: 2000 }) {
    this.apiKey = apiKey;
    this.budget = budget;
    this.usage = { daily: 0, monthly: 0 };
  }

  async smartSearch(query, databases, options = {}) {
    // Check if we should use AI based on budget and query complexity
    const shouldUseAI = this.shouldUseAI(query, options);

    if (shouldUseAI) {
      const result = await this.aiSearch(query, databases, options);
      this.trackUsage('ai_search', this.estimateCost(query, result));
      return result;
    } else {
      return await this.standardSearch(query, databases, options);
    }
  }

  shouldUseAI(query, options) {
    // Don't use AI if over budget
    if (this.usage.daily >= this.budget.daily) return false;

    // Use AI for complex queries
    if (query.length > 50 || options.searchMode === 'semantic') return true;

    // Use AI for important searches
    if (options.priority === 'high') return true;

    // Use AI sparingly for simple queries
    return Math.random() < 0.3; // 30% of simple queries
  }

  estimateCost(query, result) {
    // Estimate cost based on query complexity and result processing
    const baseTokens = query.length / 4; // Rough token estimation
    const resultTokens = (result.data?.results?.length || 0) * 50;
    return (baseTokens + resultTokens) * 0.0001; // Rough cost per token
  }

  trackUsage(operation, cost) {
    this.usage.daily += cost;
    this.usage.monthly += cost;
  }
}
```

## Next Steps

You've mastered AI integration with Altus 4! Continue exploring:

- **[Multi-Database Search](./multi-database.md)** - Advanced federation with AI
- **[SDK Usage](./sdk.md)** - Official SDKs with AI features
- **[API Reference](../api/search.md)** - Complete AI endpoint documentation
- **[Performance Guide](../testing/performance.md)** - Optimizing AI-enhanced searches

---

**AI integration transforms search from keyword matching to intelligent understanding. Experiment with these features to create truly smart search experiences.**
