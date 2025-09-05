---
title: AIService Documentation
description: Complete technical documentation for AIService - OpenAI integration, semantic search, and AI-powered query optimization in Altus 4.
---

# AIService Documentation

Comprehensive AIService Implementation Guide

The AIService integrates OpenAI's API to provide semantic search capabilities, intelligent query optimization, and AI-powered insights. It enhances traditional MySQL full-text search with natural language understanding and contextual relevance.

## Service Overview

### Responsibilities

The AIService handles:

- **Semantic Search** - Convert queries into embeddings for concept-based matching
- **Query Optimization** - AI-powered query refinement and expansion
- **Result Enhancement** - Categorization and contextual enrichment of search results
- **Insights Generation** - AI-driven analytics and trend analysis
- **Natural Language Processing** - Understanding user intent and query context

### Architecture

```typescript
export class AIService {
  constructor(
    private openaiClient: OpenAI,
    private cacheService: CacheService,
    private logger: Logger,
    private config: AIConfig
  ) {}

  // Core Methods
  async processQuery(query: string, mode: SearchMode): Promise<ProcessedQuery>;
  async generateEmbedding(text: string): Promise<number[]>;
  async enhanceResults(results: SearchResult[], query: string): Promise<EnhancedResult[]>;
  async generateInsights(data: AnalyticsData): Promise<AIInsights>;
  async optimizeQuery(query: string, context?: QueryContext): Promise<OptimizedQuery>;

  // Utility Methods
  private async callOpenAI(messages: ChatMessage[], options?: OpenAIOptions): Promise<string>;
  private async handleRateLimit(error: OpenAIError): Promise<void>;
  private validateQuery(query: string): boolean;
}
```

## Core Functionality

### Semantic Search Implementation

#### Query Processing and Embedding Generation

The service converts text queries into vector embeddings for semantic search:

```typescript
interface ProcessedQuery {
  originalQuery: string
  optimizedQuery: string
  embedding: number[]
  intent: QueryIntent
  categories: string[]
  confidence: number
  suggestions: string[]
}

interface QueryIntent {
  type: 'search' | 'question' | 'command'
  domain: string
  specificity: 'broad' | 'specific' | 'targeted'
  complexity: 'simple' | 'moderate' | 'complex'
}

async processQuery(query: string, mode: SearchMode): Promise<ProcessedQuery> {
  const startTime = Date.now()

  try {
    // Validate and sanitize query
    if (!this.validateQuery(query)) {
      throw new AppError('INVALID_QUERY', 'Query validation failed')
    }

    // Check cache first
    const cacheKey = `query_processing:${query}:${mode}`
    const cached = await this.cacheService.get(cacheKey)
    if (cached) {
      return cached
    }

    // Generate embedding for semantic search
    const embedding = await this.generateEmbedding(query)

    // Analyze query intent and characteristics
    const intent = await this.analyzeQueryIntent(query)

    // Optimize query based on intent and mode
    const optimizedQuery = await this.optimizeQuery(query, { mode, intent })

    // Generate related suggestions
    const suggestions = await this.generateQuerySuggestions(query, intent)

    // Categorize query
    const categories = await this.categorizeQuery(query, intent)

    const processed: ProcessedQuery = {
      originalQuery: query,
      optimizedQuery: optimizedQuery.query,
      embedding,
      intent,
      categories,
      confidence: optimizedQuery.confidence,
      suggestions
    }

    // Cache result
    await this.cacheService.set(cacheKey, processed, 300000) // 5 minutes

    const processingTime = Date.now() - startTime
    this.logger.info('Query processed successfully', {
      originalQuery: query,
      processingTime,
      confidence: processed.confidence,
      categories: categories.join(', ')
    })

    return processed

  } catch (error) {
    const processingTime = Date.now() - startTime
    this.logger.error('Query processing failed', {
      error,
      query,
      processingTime
    })

    // Fallback to basic processing
    return this.fallbackProcessing(query, mode)
  }
}

async generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await this.openaiClient.embeddings.create({
      model: this.config.embeddingModel || 'text-embedding-3-small',
      input: text.substring(0, 8191), // Token limit
      encoding_format: 'float'
    })

    this.logger.debug('Embedding generated', {
      textLength: text.length,
      embeddingDimensions: response.data[0].embedding.length
    })

    return response.data[0].embedding

  } catch (error) {
    if (this.isRateLimitError(error)) {
      await this.handleRateLimit(error)
      return this.generateEmbedding(text) // Retry
    }

    this.logger.error('Embedding generation failed', { error, textLength: text.length })
    throw new AppError('AI_EMBEDDING_FAILED', error.message)
  }
}

private async analyzeQueryIntent(query: string): Promise<QueryIntent> {
  const prompt = `
    Analyze the following search query and determine:
    1. Intent type (search, question, or command)
    2. Domain/topic area
    3. Specificity level (broad, specific, or targeted)
    4. Complexity level (simple, moderate, or complex)

    Query: "${query}"

    Respond in JSON format:
    {
      "type": "search|question|command",
      "domain": "topic area",
      "specificity": "broad|specific|targeted",
      "complexity": "simple|moderate|complex"
    }
  `

  try {
    const response = await this.callOpenAI([
      { role: 'system', content: 'You are a query analysis expert. Respond only with valid JSON.' },
      { role: 'user', content: prompt }
    ])

    return JSON.parse(response)

  } catch (error) {
    this.logger.warn('Intent analysis failed, using defaults', { error, query })

    // Fallback to basic heuristics
    return {
      type: query.includes('?') ? 'question' : 'search',
      domain: 'general',
      specificity: query.length < 20 ? 'broad' : 'specific',
      complexity: query.split(' ').length > 10 ? 'complex' : 'simple'
    }
  }
}
```

### Query Optimization

#### AI-Powered Query Enhancement

The service optimizes queries for better search results:

```typescript
interface OptimizedQuery {
  query: string
  expansions: string[]
  synonyms: string[]
  confidence: number
  reasoning: string
  alternatives: string[]
}

interface QueryContext {
  mode: SearchMode
  intent: QueryIntent
  domain?: string
  userHistory?: string[]
  databaseSchema?: string[]
}

async optimizeQuery(query: string, context?: QueryContext): Promise<OptimizedQuery> {
  try {
    const cacheKey = `query_optimization:${query}:${JSON.stringify(context)}`
    const cached = await this.cacheService.get(cacheKey)
    if (cached) return cached

    const prompt = this.buildOptimizationPrompt(query, context)

    const response = await this.callOpenAI([
      {
        role: 'system',
        content: 'You are a database search optimization expert. Provide detailed query optimization recommendations in JSON format.'
      },
      { role: 'user', content: prompt }
    ], {
      temperature: 0.3,
      maxTokens: 800
    })

    const optimization = JSON.parse(response)

    // Validate and enhance optimization
    const optimized: OptimizedQuery = {
      query: optimization.optimizedQuery || query,
      expansions: optimization.expansions || [],
      synonyms: optimization.synonyms || [],
      confidence: Math.min(optimization.confidence || 0.5, 1.0),
      reasoning: optimization.reasoning || 'AI optimization applied',
      alternatives: optimization.alternatives || []
    }

    // Cache result
    await this.cacheService.set(cacheKey, optimized, 600000) // 10 minutes

    this.logger.info('Query optimized', {
      original: query,
      optimized: optimized.query,
      confidence: optimized.confidence
    })

    return optimized

  } catch (error) {
    this.logger.error('Query optimization failed', { error, query })

    // Return basic optimization
    return {
      query,
      expansions: [],
      synonyms: [],
      confidence: 0.5,
      reasoning: 'Basic optimization due to AI service unavailable',
      alternatives: []
    }
  }
}

private buildOptimizationPrompt(query: string, context?: QueryContext): string {
  let prompt = `
    Optimize this database search query for better results:

    Original Query: "${query}"
  `

  if (context) {
    prompt += `

    Context:
    - Search Mode: ${context.mode}
    - Intent Type: ${context.intent?.type}
    - Domain: ${context.intent?.domain}
    - Complexity: ${context.intent?.complexity}
    `

    if (context.databaseSchema?.length) {
      prompt += `
    - Available Tables: ${context.databaseSchema.join(', ')}`
    }

    if (context.userHistory?.length) {
      prompt += `
    - Recent Queries: ${context.userHistory.slice(-3).join(', ')}`
    }
  }

  prompt += `

    Provide optimization in this JSON format:
    {
      "optimizedQuery": "improved version of the query",
      "expansions": ["related terms to include"],
      "synonyms": ["alternative terms"],
      "confidence": 0.8,
      "reasoning": "explanation of optimizations",
      "alternatives": ["alternative query formulations"]
    }

    Focus on:
    1. Adding relevant synonyms and related terms
    2. Improving query structure for full-text search
    3. Expanding abbreviations and technical terms
    4. Correcting common misspellings
    5. Enhancing semantic clarity
  `

  return prompt
}
```

### Result Enhancement

#### AI-Powered Result Processing

The service enhances search results with AI-generated insights:

```typescript
interface EnhancedResult extends SearchResult {
  categories: string[]
  summary: string
  relevanceExplanation: string
  relatedTopics: string[]
  keyInsights: string[]
  confidenceScore: number
}

interface ResultEnhancement {
  categorization: CategoryResult[]
  summaries: string[]
  insights: InsightResult[]
  relationships: RelationshipResult[]
}

async enhanceResults(results: SearchResult[], query: string): Promise<EnhancedResult[]> {
  if (!results.length) return []

  try {
    const startTime = Date.now()

    // Process results in batches to manage token limits
    const batchSize = 5
    const enhancedBatches = []

    for (let i = 0; i < results.length; i += batchSize) {
      const batch = results.slice(i, i + batchSize)
      const enhanced = await this.enhanceResultBatch(batch, query)
      enhancedBatches.push(...enhanced)
    }

    const processingTime = Date.now() - startTime
    this.logger.info('Results enhanced', {
      resultCount: results.length,
      processingTime,
      averageEnhancementTime: processingTime / results.length
    })

    return enhancedBatches

  } catch (error) {
    this.logger.error('Result enhancement failed', { error, resultCount: results.length })

    // Return results with basic enhancement
    return results.map(result => ({
      ...result,
      categories: ['General'],
      summary: this.generateBasicSummary(result.content),
      relevanceExplanation: 'Content matches search terms',
      relatedTopics: [],
      keyInsights: [],
      confidenceScore: result.score || 0.5
    }))
  }
}

private async enhanceResultBatch(results: SearchResult[], query: string): Promise<EnhancedResult[]> {
  const prompt = `
    Analyze these search results for the query "${query}" and provide enhancements:

    ${results.map((result, index) => `
    Result ${index + 1}:
    Title: ${result.content.title || 'No title'}
    Content: ${this.truncateContent(result.content, 300)}
    Score: ${result.score}
    `).join('\n')}

    For each result, provide:
    1. Categories (2-3 relevant categories)
    2. Brief summary (1-2 sentences)
    3. Relevance explanation (why it matches the query)
    4. Related topics (2-3 related concepts)
    5. Key insights (1-2 main takeaways)
    6. Confidence score (0-1, how relevant to query)

    Respond in JSON format:
    {
      "enhancements": [
        {
          "categories": ["category1", "category2"],
          "summary": "brief summary",
          "relevanceExplanation": "explanation of relevance",
          "relatedTopics": ["topic1", "topic2"],
          "keyInsights": ["insight1", "insight2"],
          "confidenceScore": 0.85
        }
      ]
    }
  `

  try {
    const response = await this.callOpenAI([
      {
        role: 'system',
        content: 'You are an expert at analyzing search results and providing contextual enhancements. Always respond with valid JSON.'
      },
      { role: 'user', content: prompt }
    ], {
      temperature: 0.4,
      maxTokens: 1500
    })

    const enhancement = JSON.parse(response)

    return results.map((result, index) => {
      const enhance = enhancement.enhancements[index] || {}

      return {
        ...result,
        categories: enhance.categories || ['General'],
        summary: enhance.summary || this.generateBasicSummary(result.content),
        relevanceExplanation: enhance.relevanceExplanation || 'Content matches search terms',
        relatedTopics: enhance.relatedTopics || [],
        keyInsights: enhance.keyInsights || [],
        confidenceScore: enhance.confidenceScore || result.score || 0.5
      }
    })

  } catch (error) {
    this.logger.error('Batch enhancement failed', { error, batchSize: results.length })
    throw error
  }
}
```

### Insights Generation

#### AI-Powered Analytics Insights

The service generates intelligent insights from search and usage patterns:

```typescript
interface AIInsights {
  summary: string
  trends: TrendInsight[]
  recommendations: RecommendationInsight[]
  anomalies: AnomalyInsight[]
  predictions: PredictionInsight[]
  confidence: number
  generatedAt: Date
}

interface TrendInsight {
  type: 'increasing' | 'decreasing' | 'stable' | 'cyclical'
  metric: string
  description: string
  significance: 'low' | 'medium' | 'high'
  timeframe: string
}

interface RecommendationInsight {
  category: 'performance' | 'content' | 'user_experience' | 'optimization'
  title: string
  description: string
  impact: 'low' | 'medium' | 'high'
  effort: 'low' | 'medium' | 'high'
  actionable: boolean
}

async generateInsights(data: AnalyticsData): Promise<AIInsights> {
  try {
    const cacheKey = `insights:${data.period}:${data.checksum}`
    const cached = await this.cacheService.get(cacheKey)
    if (cached) return cached

    const prompt = this.buildInsightsPrompt(data)

    const response = await this.callOpenAI([
      {
        role: 'system',
        content: 'You are an expert data analyst specializing in search analytics and user behavior. Provide actionable insights in JSON format.'
      },
      { role: 'user', content: prompt }
    ], {
      temperature: 0.6,
      maxTokens: 2000
    })

    const rawInsights = JSON.parse(response)

    const insights: AIInsights = {
      summary: rawInsights.summary,
      trends: rawInsights.trends || [],
      recommendations: rawInsights.recommendations || [],
      anomalies: rawInsights.anomalies || [],
      predictions: rawInsights.predictions || [],
      confidence: Math.min(rawInsights.confidence || 0.7, 1.0),
      generatedAt: new Date()
    }

    // Cache insights
    await this.cacheService.set(cacheKey, insights, 1800000) // 30 minutes

    this.logger.info('AI insights generated', {
      trendsCount: insights.trends.length,
      recommendationsCount: insights.recommendations.length,
      confidence: insights.confidence
    })

    return insights

  } catch (error) {
    this.logger.error('Insights generation failed', { error })

    // Return basic insights
    return {
      summary: 'Unable to generate detailed insights due to AI service limitations',
      trends: [],
      recommendations: [],
      anomalies: [],
      predictions: [],
      confidence: 0.3,
      generatedAt: new Date()
    }
  }
}

private buildInsightsPrompt(data: AnalyticsData): string {
  return `
    Analyze this search analytics data and provide insights:

    Time Period: ${data.period}
    Total Searches: ${data.totalSearches}
    Unique Queries: ${data.uniqueQueries}
    Average Response Time: ${data.averageResponseTime}ms
    Success Rate: ${data.successRate}%

    Top Queries:
    ${data.topQueries.map(q => `- "${q.query}" (${q.count} times)`).join('\n')}

    Search Modes Usage:
    - Natural Language: ${data.searchModes.natural}%
    - Boolean: ${data.searchModes.boolean}%
    - Semantic: ${data.searchModes.semantic}%

    Performance Metrics:
    - Cache Hit Rate: ${data.cacheHitRate}%
    - Error Rate: ${data.errorRate}%
    - Peak Usage Hour: ${data.peakHour}

    Provide analysis in this JSON format:
    {
      "summary": "Overall summary of findings",
      "trends": [
        {
          "type": "increasing|decreasing|stable|cyclical",
          "metric": "metric name",
          "description": "trend description",
          "significance": "low|medium|high",
          "timeframe": "time period"
        }
      ],
      "recommendations": [
        {
          "category": "performance|content|user_experience|optimization",
          "title": "recommendation title",
          "description": "detailed description",
          "impact": "low|medium|high",
          "effort": "low|medium|high",
          "actionable": true
        }
      ],
      "anomalies": [
        {
          "type": "spike|drop|pattern",
          "metric": "affected metric",
          "description": "anomaly description",
          "severity": "low|medium|high",
          "possibleCauses": ["cause1", "cause2"]
        }
      ],
      "predictions": [
        {
          "metric": "metric name",
          "prediction": "predicted trend or value",
          "timeframe": "prediction timeframe",
          "confidence": 0.8
        }
      ],
      "confidence": 0.85
    }

    Focus on actionable insights that can help improve search performance, user experience, and system optimization.
  `
}
```

### Error Handling and Resilience

#### OpenAI API Error Management

The service implements comprehensive error handling for OpenAI API interactions:

```typescript
interface OpenAIError {
  code: string
  message: string
  type: string
  param?: string
}

enum AIErrorCodes {
  RATE_LIMIT_EXCEEDED = 'AI_RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED = 'AI_QUOTA_EXCEEDED',
  MODEL_UNAVAILABLE = 'AI_MODEL_UNAVAILABLE',
  INVALID_REQUEST = 'AI_INVALID_REQUEST',
  API_ERROR = 'AI_API_ERROR',
  TIMEOUT = 'AI_TIMEOUT'
}

private async callOpenAI(
  messages: ChatMessage[],
  options: OpenAIOptions = {}
): Promise<string> {
  const requestId = `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  try {
    this.logger.debug('OpenAI API request', { requestId, messageCount: messages.length })

    const response = await this.openaiClient.chat.completions.create({
      model: options.model || this.config.chatModel || 'gpt-3.5-turbo',
      messages,
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 1000,
      top_p: options.topP || 1.0,
      frequency_penalty: options.frequencyPenalty || 0,
      presence_penalty: options.presencePenalty || 0,
      ...options.additionalParams
    })

    const result = response.choices[0]?.message?.content
    if (!result) {
      throw new Error('Empty response from OpenAI API')
    }

    this.logger.debug('OpenAI API response received', {
      requestId,
      responseLength: result.length,
      tokensUsed: response.usage?.total_tokens
    })

    // Track usage
    await this.trackUsage({
      requestId,
      model: response.model,
      promptTokens: response.usage?.prompt_tokens || 0,
      completionTokens: response.usage?.completion_tokens || 0,
      totalTokens: response.usage?.total_tokens || 0
    })

    return result

  } catch (error) {
    return this.handleOpenAIError(error, requestId, messages, options)
  }
}

private async handleOpenAIError(
  error: any,
  requestId: string,
  messages: ChatMessage[],
  options: OpenAIOptions
): Promise<string> {
  this.logger.error('OpenAI API error', { error, requestId })

  // Rate limiting
  if (this.isRateLimitError(error)) {
    await this.handleRateLimit(error)
    return this.callOpenAI(messages, options) // Retry
  }

  // Quota exceeded
  if (this.isQuotaError(error)) {
    throw new AppError(AIErrorCodes.QUOTA_EXCEEDED, 'OpenAI API quota exceeded')
  }

  // Model unavailable
  if (this.isModelError(error)) {
    // Try fallback model
    const fallbackOptions = { ...options, model: 'gpt-3.5-turbo' }
    return this.callOpenAI(messages, fallbackOptions)
  }

  // Invalid request
  if (this.isValidationError(error)) {
    throw new AppError(AIErrorCodes.INVALID_REQUEST, `Invalid OpenAI request: ${error.message}`)
  }

  // Generic API error
  throw new AppError(AIErrorCodes.API_ERROR, `OpenAI API error: ${error.message}`)
}

private async handleRateLimit(error: OpenAIError): Promise<void> {
  const retryAfter = this.extractRetryAfter(error) || 60 // Default 60 seconds

  this.logger.warn('Rate limit hit, waiting before retry', { retryAfter })

  // Update rate limit metrics
  await this.updateRateLimitMetrics(retryAfter)

  // Exponential backoff with jitter
  const jitter = Math.random() * 0.1 * retryAfter
  const delay = (retryAfter + jitter) * 1000

  await this.sleep(delay)
}

private isRateLimitError(error: any): boolean {
  return error.status === 429 ||
         error.code === 'rate_limit_exceeded' ||
         error.message?.includes('rate limit')
}

private isQuotaError(error: any): boolean {
  return error.status === 429 &&
         (error.message?.includes('quota') || error.message?.includes('billing'))
}
```

### Performance Optimization

#### Caching Strategy

The service implements intelligent caching to reduce API calls:

```typescript
interface CacheStrategy {
  embeddings: {
    ttl: number // 24 hours
    prefix: string
  }
  queryOptimization: {
    ttl: number // 10 minutes
    prefix: string
  }
  insights: {
    ttl: number // 30 minutes
    prefix: string
  }
}

private cacheStrategy: CacheStrategy = {
  embeddings: {
    ttl: 86400000, // 24 hours - embeddings are stable
    prefix: 'ai:embedding:'
  },
  queryOptimization: {
    ttl: 600000, // 10 minutes - query optimization can change
    prefix: 'ai:optimization:'
  },
  insights: {
    ttl: 1800000, // 30 minutes - insights have moderate freshness needs
    prefix: 'ai:insights:'
  }
}

private generateCacheKey(prefix: string, data: any): string {
  const hash = this.hashData(data)
  return `${prefix}${hash}`
}

private hashData(data: any): string {
  return require('crypto')
    .createHash('md5')
    .update(JSON.stringify(data))
    .digest('hex')
}

private async getCachedResult<T>(
  type: keyof CacheStrategy,
  data: any
): Promise<T | null> {
  const config = this.cacheStrategy[type]
  const key = this.generateCacheKey(config.prefix, data)

  try {
    const cached = await this.cacheService.get(key)
    if (cached) {
      this.logger.debug('Cache hit', { type, key })
      return cached
    }
    return null
  } catch (error) {
    this.logger.warn('Cache retrieval failed', { error, type, key })
    return null
  }
}

private async setCachedResult<T>(
  type: keyof CacheStrategy,
  data: any,
  result: T
): Promise<void> {
  const config = this.cacheStrategy[type]
  const key = this.generateCacheKey(config.prefix, data)

  try {
    await this.cacheService.set(key, result, config.ttl)
    this.logger.debug('Result cached', { type, key })
  } catch (error) {
    this.logger.warn('Cache storage failed', { error, type, key })
  }
}
```

## Testing and Validation

### Unit Testing

```typescript
describe('AIService', () => {
  let aiService: AIService;
  let mockOpenAI: jest.Mocked<OpenAI>;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
      embeddings: {
        create: jest.fn(),
      },
    };

    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
    };

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
    };

    aiService = new AIService(mockOpenAI, mockCacheService, mockLogger, {
      chatModel: 'gpt-3.5-turbo',
      embeddingModel: 'text-embedding-3-small',
    });
  });

  describe('generateEmbedding', () => {
    it('should generate embedding for text', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4];
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: mockEmbedding }],
      });

      const result = await aiService.generateEmbedding('test query');

      expect(result).toEqual(mockEmbedding);
      expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: 'test query',
        encoding_format: 'float',
      });
    });

    it('should handle rate limiting gracefully', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.status = 429;

      mockOpenAI.embeddings.create
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({ data: [{ embedding: [0.1, 0.2] }] });

      const result = await aiService.generateEmbedding('test query');

      expect(result).toEqual([0.1, 0.2]);
      expect(mockOpenAI.embeddings.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('processQuery', () => {
    it('should process query and return enhanced result', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: [0.1, 0.2, 0.3] }],
      });
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: '{"type": "search", "domain": "database"}' } }],
      });

      const result = await aiService.processQuery('database optimization', 'semantic');

      expect(result).toHaveProperty('originalQuery', 'database optimization');
      expect(result).toHaveProperty('embedding');
      expect(result).toHaveProperty('intent');
      expect(result.embedding).toHaveLength(3);
    });
  });
});
```

### Integration Testing

```typescript
describe('AIService Integration', () => {
  let aiService: AIService;

  beforeAll(async () => {
    // Use real OpenAI client with test API key
    aiService = new AIService(
      new OpenAI({ apiKey: process.env.TEST_OPENAI_API_KEY }),
      new CacheService(),
      logger,
      testConfig
    );
  });

  it('should perform end-to-end AI processing', async () => {
    const query = 'MySQL performance optimization techniques';

    // Process query
    const processed = await aiService.processQuery(query, 'semantic');
    expect(processed.originalQuery).toBe(query);
    expect(processed.embedding).toHaveLength(1536); // text-embedding-3-small dimension

    // Optimize query
    const optimized = await aiService.optimizeQuery(query);
    expect(optimized.query).toBeDefined();
    expect(optimized.confidence).toBeGreaterThan(0);

    // Generate insights (mock data)
    const mockAnalytics = createMockAnalyticsData();
    const insights = await aiService.generateInsights(mockAnalytics);
    expect(insights.summary).toBeDefined();
    expect(insights.trends.length).toBeGreaterThan(0);
  }, 30000); // 30 second timeout for AI operations
});
```

## Configuration and Deployment

### Environment Configuration

```typescript
interface AIConfig {
  openaiApiKey: string;
  chatModel: string;
  embeddingModel: string;
  maxTokens: number;
  temperature: number;
  requestTimeout: number;
  rateLimitBackoff: number;
  enableFallbacks: boolean;
  cacheEnabled: boolean;
}

const defaultConfig: Partial<AIConfig> = {
  chatModel: 'gpt-3.5-turbo',
  embeddingModel: 'text-embedding-3-small',
  maxTokens: 1000,
  temperature: 0.7,
  requestTimeout: 30000,
  rateLimitBackoff: 60000,
  enableFallbacks: true,
  cacheEnabled: true,
};
```

### Best Practices

1. **API Key Security**: Store OpenAI API keys securely, never in code
2. **Rate Limiting**: Implement proper backoff strategies for rate limits
3. **Caching**: Cache expensive operations like embeddings and insights
4. **Error Handling**: Graceful degradation when AI services are unavailable
5. **Cost Management**: Monitor token usage and implement usage limits
6. **Quality Control**: Validate AI responses and implement fallbacks
7. **Performance**: Batch operations when possible to reduce API calls

---

**The AIService provides intelligent capabilities that significantly enhance traditional database search, making Altus 4 a truly AI-powered search platform.**
