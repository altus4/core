/**
 * AIService
 *
 * Integrates with OpenAI to provide AI-powered features such as query optimization, suggestions, and insights.
 * Handles initialization, availability checks, and communication with the OpenAI API.
 *
 * Usage:
 *   - Instantiate and use isAvailable() to check if AI features are enabled
 *   - Use processSearchQuery() to optimize search queries using AI
 */
import { config } from '@/config';
import type {
  AIInsight,
  Category,
  OptimizationSuggestion,
  QuerySuggestion,
  SearchResult,
} from '@/types';
import { logger } from '@/utils/logger';
import { OpenAIProxy } from '@/services/proxies/openai-proxy';

export class AIService {
  /**
   * OpenAI proxy instance with automatic timeout, or null if not initialized.
   */
  private openai: OpenAIProxy | null = null;

  /**
   * Indicates whether AI features are enabled and available.
   */
  private isEnabled: boolean = false;

  /**
   * Create a new AIService instance and initialize OpenAI client.
   */
  constructor() {
    this.initializeOpenAI();
  }

  /**
   * Initialize the OpenAI client using configuration.
   * Sets isEnabled to true if successful, false otherwise.
   */
  private initializeOpenAI(): void {
    try {
      if (config.openai.apiKey && config.openai.apiKey.startsWith('sk-')) {
        this.openai = new OpenAIProxy();
        this.isEnabled = true;
        logger.info('OpenAI service initialized successfully');
      } else {
        logger.warn('OpenAI API key not provided or invalid - AI features disabled');
        this.isEnabled = false;
      }
    } catch (error) {
      logger.error('Failed to initialize OpenAI service:', error);
      this.isEnabled = false;
    }
  }

  /**
   * Check if AI service is available and initialized.
   *
   * @returns true if AI features are enabled and OpenAI client is ready
   */
  public isAvailable(): boolean {
    return this.isEnabled && this.openai !== null;
  }

  /**
   * Process and optimize a search query using AI.
   *
   * @param query - The search query to optimize
   * @returns An object containing the optimized query and context
   */
  public async processSearchQuery(query: string): Promise<{
    optimizedQuery: string;
    context: any;
  }> {
    if (!this.isAvailable()) {
      return { optimizedQuery: query, context: null };
    }

    const completion = await this.openai!.chat.completions.create({
      model: config.openai.model,
      messages: [
        {
          role: 'system',
          content: `You are a database search query optimizer. Your task is to:
          1. Improve the search query for better full-text search results
          2. Extract key concepts and context
          3. Suggest synonyms and related terms

          Return a JSON response with:
          - optimizedQuery: improved version of the query
          - concepts: array of key concepts extracted
          - synonyms: array of synonyms for better matching
          - searchIntent: the likely intent behind the search`,
        },
        {
          role: 'user',
          content: `Optimize this search query: "${query}"`,
        },
      ],
      temperature: 0.3,
      max_tokens: 300,
    });

    const response = completion.choices[0]?.message?.content;
    if (response) {
      try {
        const parsed = JSON.parse(response);
        return {
          optimizedQuery: parsed.optimizedQuery || query,
          context: {
            concepts: parsed.concepts || [],
            synonyms: parsed.synonyms || [],
            searchIntent: parsed.searchIntent || 'general_search',
          },
        };
      } catch (_parseError) {
        logger.warn('Failed to parse OpenAI response, using original query');
        return { optimizedQuery: query, context: null };
      }
    }

    return { optimizedQuery: query, context: null };
  }

  /**
   * Categorize search results using AI
   */
  public async categorizeResults(results: SearchResult[]): Promise<Category[]> {
    if (!this.isAvailable() || results.length === 0) {
      return [];
    }

    // Extract sample data for categorization
    const sampleData = results.slice(0, 10).map(result => ({
      table: result.table,
      database: result.database,
      data: Object.keys(result.data).slice(0, 5), // Just column names
    }));

    const completion = await this.openai!.chat.completions.create({
      model: config.openai.model,
      messages: [
        {
          role: 'system',
          content: `Analyze search results and categorize them. Return a JSON array of categories with:
          - name: category name
          - count: estimated number of results in this category
          - confidence: confidence score (0-1)

          Categories should be meaningful business domains like: Users, Products, Orders, Analytics, Content, etc.`,
        },
        {
          role: 'user',
          content: `Categorize these search results: ${JSON.stringify(sampleData, null, 2)}`,
        },
      ],
      temperature: 0.4,
      max_tokens: 200,
    });

    const response = completion.choices[0]?.message?.content;
    if (response) {
      try {
        const categories = JSON.parse(response);
        return Array.isArray(categories) ? categories : [];
      } catch (_parseError) {
        logger.warn('Failed to parse AI categorization response');
        return [];
      }
    }

    return [];
  }

  /**
   * Get query suggestions using AI
   */
  public async getQuerySuggestions(query: string): Promise<QuerySuggestion[]> {
    if (!this.isAvailable()) {
      return [];
    }

    const completion = await this.openai!.chat.completions.create({
      model: config.openai.model,
      messages: [
        {
          role: 'system',
          content: `Generate helpful search query suggestions. Return a JSON array of objects with:
            - text: the suggested query
            - score: relevance score (0-1)
            - type: 'spelling', 'semantic', or 'related'

            Focus on:
            1. Spelling corrections
            2. Semantic alternatives
            3. Related/expanded queries`,
        },
        {
          role: 'user',
          content: `Generate suggestions for query: "${query}"`,
        },
      ],
      temperature: 0.5,
      max_tokens: 250,
    });

    const response = completion.choices[0]?.message?.content;
    if (response) {
      try {
        const suggestions = JSON.parse(response);
        return Array.isArray(suggestions) ? suggestions : [];
      } catch (_parseError) {
        logger.warn('Failed to parse AI suggestions response');
        return [];
      }
    }

    return [];
  }

  /**
   * Get optimization suggestions based on query performance
   */
  public async getOptimizationSuggestions(
    query: string,
    executionTime: number,
    resultCount: number
  ): Promise<OptimizationSuggestion[]> {
    if (!this.isAvailable()) {
      return [];
    }

    const completion = await this.openai!.chat.completions.create({
      model: config.openai.model,
      messages: [
        {
          role: 'system',
          content: `Analyze search performance and provide optimization suggestions. Return a JSON array with:
          - type: 'index', 'query', or 'schema'
          - description: human-readable description
          - impact: 'low', 'medium', or 'high'
          - sqlSuggestion: optional SQL command if applicable`,
        },
        {
          role: 'user',
          content: `Query: "${query}"
          Execution time: ${executionTime}ms
          Results: ${resultCount}

          Provide optimization suggestions.`,
        },
      ],
      temperature: 0.3,
      max_tokens: 400,
    });

    const response = completion.choices[0]?.message?.content;
    if (response) {
      try {
        const suggestions = JSON.parse(response);
        return Array.isArray(suggestions) ? suggestions : [];
      } catch (_parseError) {
        logger.warn('Failed to parse AI optimization response');
        return [];
      }
    }

    return [];
  }

  /**
   * Analyze a query and provide insights
   */
  public async analyzeQuery(query: string): Promise<{
    recommendations: string[];
    optimizations: OptimizationSuggestion[];
  }> {
    if (!this.isAvailable()) {
      return { recommendations: [], optimizations: [] };
    }

    const completion = await this.openai!.chat.completions.create({
      model: config.openai.model,
      messages: [
        {
          role: 'system',
          content: `Analyze a search query and provide insights. Return JSON with:
          - recommendations: array of general recommendations
          - optimizations: array of optimization objects with type, description, impact`,
        },
        {
          role: 'user',
          content: `Analyze this search query: "${query}"`,
        },
      ],
      temperature: 0.3,
      max_tokens: 300,
    });

    const response = completion.choices[0]?.message?.content;
    if (response) {
      try {
        const analysis = JSON.parse(response);
        return {
          recommendations: analysis.recommendations || [],
          optimizations: analysis.optimizations || [],
        };
      } catch (_parseError) {
        logger.warn('Failed to parse AI analysis response');
        return { recommendations: [], optimizations: [] };
      }
    }

    return { recommendations: [], optimizations: [] };
  }

  /**
   * Generate AI insights from search patterns
   */
  public async generateInsights(
    queries: string[],
    timeframe: 'day' | 'week' | 'month'
  ): Promise<AIInsight[]> {
    if (!this.isAvailable() || queries.length === 0) {
      return [];
    }

    const completion = await this.openai!.chat.completions.create({
      model: config.openai.model,
      messages: [
        {
          role: 'system',
          content: `Analyze search patterns and generate business insights. Return JSON array with:
            - type: 'query_optimization', 'trend_analysis', or 'semantic_enhancement'
            - confidence: 0-1
            - description: insight description
            - actionable: boolean
            - data: relevant data object`,
        },
        {
          role: 'user',
          content: `Analyze these search queries from the past ${timeframe}: ${JSON.stringify(queries.slice(0, 20))}`,
        },
      ],
      temperature: 0.4,
      max_tokens: 500,
    }); // Complex analysis with extended timeout

    const response = completion.choices[0]?.message?.content;
    if (response) {
      try {
        const insights = JSON.parse(response);
        return Array.isArray(insights) ? insights : [];
      } catch (_parseError) {
        logger.warn('Failed to parse AI insights response');
        return [];
      }
    }

    return [];
  }
}
