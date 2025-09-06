import { OpenAI } from 'openai';
import { config } from '@/config';
import { OpenAIProxy } from './openai-proxy';

// Mock dependencies
jest.mock('openai');
jest.mock('@/config');

const MockOpenAI = OpenAI as jest.MockedClass<typeof OpenAI>;
const mockConfig = config as jest.Mocked<typeof config>;

describe('OpenAIProxy', () => {
  let proxy: OpenAIProxy;
  let mockOpenAIInstance: jest.Mocked<OpenAI>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup config mock
    mockConfig.openai = {
      apiKey: 'sk-test-key',
      model: 'gpt-3.5-turbo',
    };
    mockConfig.timeout = {
      openai: 30000,
    };

    // Setup OpenAI mock
    mockOpenAIInstance = {
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
      embeddings: {
        create: jest.fn(),
      },
      images: {
        generate: jest.fn(),
      },
    } as any;

    MockOpenAI.mockImplementation(() => mockOpenAIInstance);

    proxy = new OpenAIProxy();
  });

  describe('chat completions', () => {
    it('should create chat completion successfully', async () => {
      // Arrange
      const expectedResponse = {
        choices: [{ message: { content: 'Test response' } }],
      };

      // Mock the OpenAI method to return a resolved promise
      (mockOpenAIInstance.chat.completions.create as jest.Mock).mockImplementation(() =>
        Promise.resolve(expectedResponse)
      );

      const params = {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user' as const, content: 'Test message' }],
      };

      // Act
      const result = await proxy.chat.completions.create(params);

      // Assert
      expect(result).toBe(expectedResponse);
      expect(mockOpenAIInstance.chat.completions.create).toHaveBeenCalledWith(params);
    });

    it('should handle timeout errors in chat completions', async () => {
      // Arrange
      // Mock the OpenAI method to return a slow promise
      (mockOpenAIInstance.chat.completions.create as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({}), 100))
      );

      const params = {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user' as const, content: 'Test message' }],
      };

      // Act & Assert - using very short timeout
      await expect(proxy.chat.completions.create(params, { timeout: 1 })).rejects.toThrow(
        'Operation timed out after 1ms for OpenAI API chat.completions.create'
      );
    });
  });

  describe('embeddings', () => {
    it('should create embeddings successfully', async () => {
      // Arrange
      const expectedResponse = {
        data: [{ embedding: [0.1, 0.2, 0.3] }],
      };

      (mockOpenAIInstance.embeddings.create as jest.Mock).mockImplementation(() =>
        Promise.resolve(expectedResponse)
      );

      const params = {
        model: 'text-embedding-ada-002',
        input: 'Test text',
      };

      // Act
      const result = await proxy.embeddings.create(params);

      // Assert
      expect(result).toBe(expectedResponse);
      expect(mockOpenAIInstance.embeddings.create).toHaveBeenCalledWith(params);
    });

    it('should handle timeout errors in embeddings', async () => {
      // Arrange
      (mockOpenAIInstance.embeddings.create as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({}), 100))
      );

      const params = {
        model: 'text-embedding-ada-002',
        input: 'Test text',
      };

      // Act & Assert
      await expect(proxy.embeddings.create(params, { timeout: 1 })).rejects.toThrow(
        'Operation timed out after 1ms for OpenAI API embeddings.create'
      );
    });
  });

  describe('images', () => {
    it('should generate images successfully', async () => {
      // Arrange
      const expectedResponse = {
        data: [{ url: 'https://example.com/image.jpg' }],
      };

      (mockOpenAIInstance.images.generate as jest.Mock).mockImplementation(() =>
        Promise.resolve(expectedResponse)
      );

      const params = {
        prompt: 'A test image',
        n: 1,
        size: '1024x1024' as const,
      };

      // Act
      const result = await proxy.images.generate(params);

      // Assert
      expect(result).toBe(expectedResponse);
      expect(mockOpenAIInstance.images.generate).toHaveBeenCalledWith(params);
    });

    it('should handle timeout errors in image generation', async () => {
      // Arrange
      (mockOpenAIInstance.images.generate as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({}), 100))
      );

      const params = {
        prompt: 'A test image',
        n: 1,
        size: '1024x1024' as const,
      };

      // Act & Assert
      await expect(proxy.images.generate(params, { timeout: 1 })).rejects.toThrow(
        'Operation timed out after 1ms for OpenAI API images.generate'
      );
    });
  });
});
