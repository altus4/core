import { config } from '@/config';
import type { SearchResult } from '@/types';
import { logger } from '@/utils/logger';
import { OpenAI } from 'openai';
import { AIService } from './AIService';

// Explicitly unmock the AIService itself
jest.unmock('./AIService');

// Mock dependencies
jest.mock('@/config');
jest.mock('@/utils/logger');
jest.mock('openai');

const mockConfig = config as jest.Mocked<typeof config>;
const mockLogger = logger as jest.Mocked<typeof logger>;
const MockOpenAI = OpenAI as jest.MockedClass<typeof OpenAI>;

describe('AIService', () => {
  let aiService: AIService;
  let mockOpenAIInstance: jest.Mocked<OpenAI>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock OpenAI instance
    mockOpenAIInstance = {
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    } as any;

    MockOpenAI.mockImplementation(() => mockOpenAIInstance);

    // Mock config
    mockConfig.openai = {
      apiKey: 'sk-test-api-key',
      model: 'gpt-3.5-turbo',
    };
  });

  describe('constructor', () => {
    it('should initialize OpenAI client when valid API key is provided', () => {
      // Act
      aiService = new AIService();

      // Assert
      expect(MockOpenAI).toHaveBeenCalledWith({
        apiKey: 'sk-test-api-key',
      });
      expect(mockLogger.info).toHaveBeenCalledWith('OpenAI service initialized successfully');
    });

    it('should disable AI features when no API key is provided', () => {
      // Arrange
      mockConfig.openai.apiKey = '';

      // Act
      aiService = new AIService();

      // Assert
      expect(MockOpenAI).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'OpenAI API key not provided or invalid - AI features disabled'
      );
    });

    it('should disable AI features when invalid API key is provided', () => {
      // Arrange
      mockConfig.openai.apiKey = 'invalid-key';

      // Act
      aiService = new AIService();

      // Assert
      expect(MockOpenAI).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'OpenAI API key not provided or invalid - AI features disabled'
      );
    });

    it('should handle OpenAI initialization errors', () => {
      // Arrange
      MockOpenAI.mockImplementation(() => {
        throw new Error('OpenAI initialization failed');
      });

      // Act
      aiService = new AIService();

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to initialize OpenAI service:',
        expect.any(Error)
      );
    });
  });

  describe('isAvailable', () => {
    it('should return true when AI service is properly initialized', () => {
      // Arrange
      aiService = new AIService();

      // Act
      const isAvailable = aiService.isAvailable();

      // Assert
      expect(isAvailable).toBe(true);
    });

    it('should return false when AI service initialization failed', () => {
      // Arrange
      mockConfig.openai.apiKey = '';
      aiService = new AIService();

      // Act
      const isAvailable = aiService.isAvailable();

      // Assert
      expect(isAvailable).toBe(false);
    });
  });

  describe('processSearchQuery', () => {
    beforeEach(() => {
      aiService = new AIService();
    });

    it('should process and optimize a search query when AI is available', async () => {
      // Arrange
      const query = 'database optimization tips';
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                optimizedQuery: 'database performance optimization best practices',
                concepts: ['database', 'optimization', 'performance'],
                synonyms: ['db', 'tuning', 'improvement'],
                searchIntent: 'optimization_guidance',
              }),
            },
          },
        ],
      };

      (mockOpenAIInstance.chat.completions.create as jest.Mock).mockResolvedValue(
        mockResponse as any
      );

      // Act
      const result = await aiService.processSearchQuery(query);

      // Assert
      expect(result).toEqual({
        optimizedQuery: 'database performance optimization best practices',
        context: {
          concepts: ['database', 'optimization', 'performance'],
          synonyms: ['db', 'tuning', 'improvement'],
          searchIntent: 'optimization_guidance',
        },
      });

      expect(mockOpenAIInstance.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-3.5-turbo',
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
            content: expect.stringContaining('database search query optimizer'),
          }),
          expect.objectContaining({
            role: 'user',
            content: `Optimize this search query: "${query}"`,
          }),
        ]),
        temperature: 0.3,
        max_tokens: 300,
      });
    });

    it('should return original query when AI is not available', async () => {
      // Arrange
      mockConfig.openai.apiKey = '';
      aiService = new AIService();
      const query = 'test query';

      // Act
      const result = await aiService.processSearchQuery(query);

      // Assert
      expect(result).toEqual({
        optimizedQuery: 'test query',
        context: null,
      });
    });

    it('should handle OpenAI API errors gracefully', async () => {
      // Arrange
      const query = 'test query';
      (mockOpenAIInstance.chat.completions.create as jest.Mock).mockRejectedValue(
        new Error('API rate limit exceeded')
      );

      // Act
      const result = await aiService.processSearchQuery(query);

      // Assert
      expect(result).toEqual({
        optimizedQuery: 'test query',
        context: null,
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'AI query processing failed:',
        expect.any(Error)
      );
    });

    it('should handle invalid JSON response from OpenAI', async () => {
      // Arrange
      const query = 'test query';
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Invalid JSON response',
            },
          },
        ],
      };

      (mockOpenAIInstance.chat.completions.create as jest.Mock).mockResolvedValue(
        mockResponse as any
      );

      // Act
      const result = await aiService.processSearchQuery(query);

      // Assert
      expect(result).toEqual({
        optimizedQuery: 'test query',
        context: null,
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to parse OpenAI response, using original query'
      );
    });

    it('should handle empty response from OpenAI', async () => {
      // Arrange
      const query = 'test query';
      const mockResponse = {
        choices: [
          {
            message: {
              content: null,
            },
          },
        ],
      };

      (mockOpenAIInstance.chat.completions.create as jest.Mock).mockResolvedValue(
        mockResponse as any
      );

      // Act
      const result = await aiService.processSearchQuery(query);

      // Assert
      expect(result).toEqual({
        optimizedQuery: 'test query',
        context: null,
      });
    });
  });

  describe('categorizeResults', () => {
    beforeEach(() => {
      aiService = new AIService();
    });

    const mockResults: SearchResult[] = [
      {
        id: '1',
        table: 'users',
        database: 'app_db',
        relevanceScore: 0.9,
        matchedColumns: ['name', 'email'],
        data: { id: 1, name: 'John Doe', email: 'john@example.com' },
        categories: [],
      },
      {
        id: '2',
        table: 'products',
        database: 'ecommerce_db',
        relevanceScore: 0.8,
        matchedColumns: ['name', 'description'],
        data: { id: 1, name: 'Laptop', description: 'Gaming laptop' },
        categories: [],
      },
    ];

    it('should categorize search results when AI is available', async () => {
      // Arrange
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify([
                { name: 'Users', count: 1, confidence: 0.95 },
                { name: 'Products', count: 1, confidence: 0.9 },
              ]),
            },
          },
        ],
      };

      (mockOpenAIInstance.chat.completions.create as jest.Mock).mockResolvedValue(
        mockResponse as any
      );

      // Act
      const categories = await aiService.categorizeResults(mockResults);

      // Assert
      expect(categories).toEqual([
        { name: 'Users', count: 1, confidence: 0.95 },
        { name: 'Products', count: 1, confidence: 0.9 },
      ]);
    });

    it('should return empty array when no results provided', async () => {
      // Act
      const categories = await aiService.categorizeResults([]);

      // Assert
      expect(categories).toEqual([]);
      expect(mockOpenAIInstance.chat.completions.create).not.toHaveBeenCalled();
    });

    it('should return empty array when AI is not available', async () => {
      // Arrange
      mockConfig.openai.apiKey = '';
      aiService = new AIService();

      // Act
      const categories = await aiService.categorizeResults(mockResults);

      // Assert
      expect(categories).toEqual([]);
    });

    it('should handle API errors gracefully', async () => {
      // Arrange
      (mockOpenAIInstance.chat.completions.create as jest.Mock).mockRejectedValue(
        new Error('API error')
      );

      // Act
      const categories = await aiService.categorizeResults(mockResults);

      // Assert
      expect(categories).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith('AI categorization failed:', expect.any(Error));
    });

    it('should handle invalid JSON response from OpenAI', async () => {
      // Arrange
      const invalidJsonResponse = {
        choices: [
          {
            message: {
              content: 'invalid json response',
            },
          },
        ],
      };

      (mockOpenAIInstance.chat.completions.create as jest.Mock).mockResolvedValue(
        invalidJsonResponse as any
      );

      // Act
      const categories = await aiService.categorizeResults(mockResults);

      // Assert
      expect(categories).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith('Failed to parse AI categorization response');
    });

    it('should handle non-array JSON response from OpenAI', async () => {
      // Arrange
      const nonArrayResponse = {
        choices: [
          {
            message: {
              content: '{"message": "not an array"}',
            },
          },
        ],
      };

      (mockOpenAIInstance.chat.completions.create as jest.Mock).mockResolvedValue(
        nonArrayResponse as any
      );

      // Act
      const categories = await aiService.categorizeResults(mockResults);

      // Assert
      expect(categories).toEqual([]);
    });

    it('should handle empty response content from OpenAI', async () => {
      // Arrange
      const emptyResponse = {
        choices: [
          {
            message: {
              content: '',
            },
          },
        ],
      };

      (mockOpenAIInstance.chat.completions.create as jest.Mock).mockResolvedValue(
        emptyResponse as any
      );

      // Act
      const categories = await aiService.categorizeResults(mockResults);

      // Assert
      expect(categories).toEqual([]);
    });
  });

  describe('getQuerySuggestions', () => {
    beforeEach(() => {
      aiService = new AIService();
    });

    it('should return query suggestions when AI is available', async () => {
      // Arrange
      const query = 'databse';
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify([
                { text: 'database', score: 0.95, type: 'spelling' },
                { text: 'database management', score: 0.85, type: 'semantic' },
                { text: 'database optimization', score: 0.8, type: 'related' },
              ]),
            },
          },
        ],
      };

      (mockOpenAIInstance.chat.completions.create as jest.Mock).mockResolvedValue(
        mockResponse as any
      );

      // Act
      const suggestions = await aiService.getQuerySuggestions(query);

      // Assert
      expect(suggestions).toEqual([
        { text: 'database', score: 0.95, type: 'spelling' },
        { text: 'database management', score: 0.85, type: 'semantic' },
        { text: 'database optimization', score: 0.8, type: 'related' },
      ]);
    });

    it('should return empty array when AI is not available', async () => {
      // Arrange
      mockConfig.openai.apiKey = '';
      aiService = new AIService();

      // Act
      const suggestions = await aiService.getQuerySuggestions('test');

      // Assert
      expect(suggestions).toEqual([]);
    });

    it('should handle invalid JSON response from OpenAI', async () => {
      // Arrange
      const invalidJsonResponse = {
        choices: [
          {
            message: {
              content: 'invalid json response',
            },
          },
        ],
      };

      (mockOpenAIInstance.chat.completions.create as jest.Mock).mockResolvedValue(
        invalidJsonResponse as any
      );

      // Act
      const suggestions = await aiService.getQuerySuggestions('test');

      // Assert
      expect(suggestions).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith('Failed to parse AI suggestions response');
    });

    it('should handle API errors gracefully', async () => {
      // Arrange
      (mockOpenAIInstance.chat.completions.create as jest.Mock).mockRejectedValue(
        new Error('API error')
      );

      // Act
      const suggestions = await aiService.getQuerySuggestions('test');

      // Assert
      expect(suggestions).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'AI query suggestions failed:',
        expect.any(Error)
      );
    });

    it('should handle empty response content from OpenAI', async () => {
      // Arrange
      const emptyResponse = {
        choices: [
          {
            message: {
              content: '',
            },
          },
        ],
      };

      (mockOpenAIInstance.chat.completions.create as jest.Mock).mockResolvedValue(
        emptyResponse as any
      );

      // Act
      const suggestions = await aiService.getQuerySuggestions('test');

      // Assert
      expect(suggestions).toEqual([]);
    });
  });

  describe('getOptimizationSuggestions', () => {
    beforeEach(() => {
      aiService = new AIService();
    });

    it('should return optimization suggestions when AI is available', async () => {
      // Arrange
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify([
                {
                  type: 'index',
                  description: 'Consider adding a full-text index on the content column',
                  impact: 'high',
                  sqlSuggestion: 'ALTER TABLE posts ADD FULLTEXT(content)',
                },
              ]),
            },
          },
        ],
      };

      (mockOpenAIInstance.chat.completions.create as jest.Mock).mockResolvedValue(
        mockResponse as any
      );

      // Act
      const suggestions = await aiService.getOptimizationSuggestions(
        'SELECT * FROM posts',
        1500,
        100
      );

      // Assert
      expect(suggestions).toEqual([
        {
          type: 'index',
          description: 'Consider adding a full-text index on the content column',
          impact: 'high',
          sqlSuggestion: 'ALTER TABLE posts ADD FULLTEXT(content)',
        },
      ]);
    });

    it('should return empty array when AI is not available', async () => {
      // Arrange
      mockConfig.openai.apiKey = '';
      aiService = new AIService();

      // Act
      const suggestions = await aiService.getOptimizationSuggestions(
        'SELECT * FROM posts',
        1500,
        100
      );

      // Assert
      expect(suggestions).toEqual([]);
    });
  });

  describe('analyzeQuery', () => {
    beforeEach(() => {
      aiService = new AIService();
    });

    it('should analyze query and return recommendations when AI is available', async () => {
      // Arrange
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                recommendations: [
                  'Use more specific search terms',
                  'Consider using boolean operators',
                ],
                optimizations: [
                  {
                    type: 'query',
                    description: 'Query could be more specific',
                    impact: 'medium',
                  },
                ],
              }),
            },
          },
        ],
      };

      (mockOpenAIInstance.chat.completions.create as jest.Mock).mockResolvedValue(
        mockResponse as any
      );

      // Act
      const analysis = await aiService.analyzeQuery(
        'SELECT * FROM posts WHERE title LIKE "%test%"'
      );

      // Assert
      expect(analysis).toEqual({
        recommendations: ['Use more specific search terms', 'Consider using boolean operators'],
        optimizations: [
          {
            type: 'query',
            description: 'Query could be more specific',
            impact: 'medium',
          },
        ],
      });
    });

    it('should return empty arrays when AI is not available', async () => {
      // Arrange
      mockConfig.openai.apiKey = '';
      aiService = new AIService();

      // Act
      const analysis = await aiService.analyzeQuery('test query');

      // Assert
      expect(analysis).toEqual({
        recommendations: [],
        optimizations: [],
      });
    });
  });

  describe('generateInsights', () => {
    beforeEach(() => {
      aiService = new AIService();
    });

    it('should generate insights from search patterns when AI is available', async () => {
      // Arrange
      const queries = ['database optimization', 'mysql performance', 'index tuning'];
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify([
                {
                  type: 'trend_analysis',
                  confidence: 0.85,
                  description: 'Users are frequently searching for performance optimization topics',
                  actionable: true,
                  data: { trend: 'performance_focus', queries: 3 },
                },
              ]),
            },
          },
        ],
      };

      (mockOpenAIInstance.chat.completions.create as jest.Mock).mockResolvedValue(
        mockResponse as any
      );

      // Act
      const insights = await aiService.generateInsights(queries, 'week');

      // Assert
      expect(insights).toEqual([
        {
          type: 'trend_analysis',
          confidence: 0.85,
          description: 'Users are frequently searching for performance optimization topics',
          actionable: true,
          data: { trend: 'performance_focus', queries: 3 },
        },
      ]);
    });

    it('should return empty array when no queries provided', async () => {
      // Act
      const insights = await aiService.generateInsights([], 'week');

      // Assert
      expect(insights).toEqual([]);
      expect(mockOpenAIInstance.chat.completions.create).not.toHaveBeenCalled();
    });

    it('should return empty array when AI is not available', async () => {
      // Arrange
      mockConfig.openai.apiKey = '';
      aiService = new AIService();

      // Act
      const insights = await aiService.generateInsights(['test query'], 'week');

      // Assert
      expect(insights).toEqual([]);
    });

    it('should handle API errors gracefully', async () => {
      // Arrange
      (mockOpenAIInstance.chat.completions.create as jest.Mock).mockRejectedValue(
        new Error('API error')
      );

      // Act
      const insights = await aiService.generateInsights(['test query'], 'week');

      // Assert
      expect(insights).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'AI insights generation failed:',
        expect.any(Error)
      );
    });

    it('should handle invalid JSON response from OpenAI', async () => {
      // Arrange
      const invalidJsonResponse = {
        choices: [
          {
            message: {
              content: 'invalid json response',
            },
          },
        ],
      };

      (mockOpenAIInstance.chat.completions.create as jest.Mock).mockResolvedValue(
        invalidJsonResponse as any
      );

      // Act
      const insights = await aiService.generateInsights(['test query'], 'week');

      // Assert
      expect(insights).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith('Failed to parse AI insights response');
    });
  });
});
