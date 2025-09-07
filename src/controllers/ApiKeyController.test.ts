import type { ApiKey } from '@/services/ApiKeyService';
import { ApiKeyService } from '@/services/ApiKeyService';
import { ApiKeyController } from './ApiKeyController';

// Mock the ApiKeyService
jest.mock('@/services/ApiKeyService');
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('ApiKeyController', () => {
  let apiKeyController: ApiKeyController;
  let mockApiKeyService: jest.Mocked<ApiKeyService>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mocked ApiKeyService instance
    mockApiKeyService = {
      generateApiKey: jest.fn(),
      validateApiKey: jest.fn(),
      getUserApiKeys: jest.fn(),
      updateApiKey: jest.fn(),
      revokeApiKey: jest.fn(),
      getApiKeyUsage: jest.fn(),
      close: jest.fn(),
    } as any;

    // Mock the ApiKeyService constructor
    (ApiKeyService as jest.MockedClass<typeof ApiKeyService>).mockImplementation(
      () => mockApiKeyService
    );

    apiKeyController = new ApiKeyController();
  });

  describe('constructor', () => {
    it('should create ApiKeyController instance', () => {
      expect(apiKeyController).toBeDefined();
      expect(apiKeyController.createApiKey).toBeInstanceOf(Function);
      expect(apiKeyController.listApiKeys).toBeInstanceOf(Function);
      expect(apiKeyController.updateApiKey).toBeInstanceOf(Function);
      expect(apiKeyController.revokeApiKey).toBeInstanceOf(Function);
      expect(apiKeyController.regenerateApiKey).toBeInstanceOf(Function);
      expect(apiKeyController.getApiKeyUsage).toBeInstanceOf(Function);
    });

    it('should initialize with ApiKeyService', () => {
      expect(ApiKeyService).toHaveBeenCalledTimes(1);
    });
  });

  describe('method existence', () => {
    it('should have all required methods', () => {
      expect(typeof apiKeyController.createApiKey).toBe('function');
      expect(typeof apiKeyController.listApiKeys).toBe('function');
      expect(typeof apiKeyController.updateApiKey).toBe('function');
      expect(typeof apiKeyController.revokeApiKey).toBe('function');
      expect(typeof apiKeyController.regenerateApiKey).toBe('function');
      expect(typeof apiKeyController.getApiKeyUsage).toBe('function');
    });
  });

  describe('createApiKey', () => {
    const mockReq = {
      body: {
        name: 'Test API Key',
        permissions: ['search'],
        rateLimitTier: 'free',
        environment: 'test',
      },
      user: { id: 'user-123', role: 'user' },
      get: jest.fn().mockReturnValue(undefined),
    } as any;

    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any;

    beforeEach(() => {
      mockRes.status.mockClear();
      mockRes.json.mockClear();
    });

    it('should create API key successfully', async () => {
      // Arrange
      const mockApiKey: ApiKey = {
        id: 'key-123',
        userId: 'user-123',
        name: 'Test API Key',
        keyPrefix: 'altus4_sk_test_abc123',
        permissions: ['search'],
        rateLimitTier: 'free',
        environment: 'test',
        isActive: true,
        usageCount: 0,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        expiresAt: undefined,
        lastUsed: undefined,
        rateLimitCustom: undefined,
      };

      const expectedResult = {
        apiKey: mockApiKey,
        secretKey: 'altus4_sk_test_abc123def456',
      };

      mockApiKeyService.generateApiKey.mockResolvedValue(expectedResult);

      // Act
      await apiKeyController.createApiKey(mockReq, mockRes);

      // Assert
      expect(mockApiKeyService.generateApiKey).toHaveBeenCalledWith({
        userId: 'user-123',
        name: 'Test API Key',
        environment: 'test',
        permissions: ['search'],
        rateLimitTier: 'free',
        expiresAt: undefined,
      });
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          apiKey: {
            id: expectedResult.apiKey.id,
            name: expectedResult.apiKey.name,
            keyPrefix: expectedResult.apiKey.keyPrefix,
            environment: expectedResult.apiKey.environment,
            permissions: expectedResult.apiKey.permissions,
            rateLimitTier: expectedResult.apiKey.rateLimitTier,
            isActive: expectedResult.apiKey.isActive,
            expiresAt: expectedResult.apiKey.expiresAt,
            createdAt: expectedResult.apiKey.createdAt,
          },
          secretKey: expectedResult.secretKey,
          warning:
            'This is the only time the full API key will be shown. Please store it securely.',
        },
        meta: {
          timestamp: expect.any(Date),
          requestId: 'unknown',
          version: '0.2.1',
        },
      });
    });

    it('should handle invalid permissions', async () => {
      // Arrange
      const invalidReq = {
        ...mockReq,
        body: { ...mockReq.body, permissions: ['invalid-permission'] },
      };

      // Act
      await apiKeyController.createApiKey(invalidReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_PERMISSIONS',
          message: 'Invalid permissions. Valid options: search, analytics, admin',
        },
      });
    });

    it('should handle service errors', async () => {
      // Arrange
      mockApiKeyService.generateApiKey.mockRejectedValue(new Error('Database error'));

      // Act
      await apiKeyController.createApiKey(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create API key',
        },
      });
    });
  });

  describe('listApiKeys', () => {
    const mockReq = {
      user: { id: 'user-123' },
      get: jest.fn().mockReturnValue(undefined),
    } as any;

    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any;

    beforeEach(() => {
      mockRes.status.mockClear();
      mockRes.json.mockClear();
      mockReq.get.mockClear();
    });

    it('should list API keys successfully', async () => {
      // Arrange
      const mockApiKeys: ApiKey[] = [
        {
          id: 'key-123',
          userId: 'user-123',
          name: 'Test API Key',
          keyPrefix: 'altus4_sk_test_abc123',
          permissions: ['search'],
          rateLimitTier: 'free',
          environment: 'test',
          isActive: true,
          usageCount: 5,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          expiresAt: undefined,
          lastUsed: new Date('2024-01-02'),
          rateLimitCustom: undefined,
        },
      ];

      mockApiKeyService.getUserApiKeys.mockResolvedValue(mockApiKeys);

      // Act
      await apiKeyController.listApiKeys(mockReq, mockRes);

      // Assert
      expect(mockApiKeyService.getUserApiKeys).toHaveBeenCalledWith('user-123');
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          apiKeys: [
            {
              id: mockApiKeys[0].id,
              name: mockApiKeys[0].name,
              keyPrefix: mockApiKeys[0].keyPrefix,
              environment: mockApiKeys[0].environment,
              permissions: mockApiKeys[0].permissions,
              rateLimitTier: mockApiKeys[0].rateLimitTier,
              expiresAt: mockApiKeys[0].expiresAt,
              lastUsed: mockApiKeys[0].lastUsed,
              usageCount: mockApiKeys[0].usageCount,
              isActive: mockApiKeys[0].isActive,
              createdAt: mockApiKeys[0].createdAt,
              updatedAt: mockApiKeys[0].updatedAt,
            },
          ],
          total: 1,
        },
        meta: {
          timestamp: expect.any(Date),
          requestId: 'unknown',
          version: '0.2.1',
        },
      });
    });

    it('should handle service errors', async () => {
      // Arrange
      mockApiKeyService.getUserApiKeys.mockRejectedValue(new Error('Database error'));

      // Act
      await apiKeyController.listApiKeys(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve API keys',
        },
      });
    });
  });

  describe('updateApiKey', () => {
    const mockReq = {
      params: { keyId: 'key-123' },
      body: { name: 'Updated Name', permissions: ['search', 'analytics'] },
      user: { id: 'user-123', role: 'user' },
      get: jest.fn().mockReturnValue(undefined),
    } as any;

    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any;

    beforeEach(() => {
      mockRes.status.mockClear();
      mockRes.json.mockClear();
      mockReq.get.mockClear();
    });

    it('should update API key successfully', async () => {
      // Arrange
      const mockUpdatedApiKey: ApiKey = {
        id: 'key-123',
        userId: 'user-123',
        name: 'Updated Name',
        keyPrefix: 'altus4_sk_test_abc123',
        permissions: ['search', 'analytics'],
        rateLimitTier: 'free',
        environment: 'test',
        isActive: true,
        usageCount: 5,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        expiresAt: undefined,
        lastUsed: new Date('2024-01-02'),
        rateLimitCustom: undefined,
      };

      mockApiKeyService.updateApiKey.mockResolvedValue(mockUpdatedApiKey);

      // Act
      await apiKeyController.updateApiKey(mockReq, mockRes);

      // Assert
      expect(mockApiKeyService.updateApiKey).toHaveBeenCalledWith(
        'key-123',
        'user-123',
        mockReq.body
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          apiKey: {
            id: mockUpdatedApiKey.id,
            name: mockUpdatedApiKey.name,
            keyPrefix: mockUpdatedApiKey.keyPrefix,
            environment: mockUpdatedApiKey.environment,
            permissions: mockUpdatedApiKey.permissions,
            rateLimitTier: mockUpdatedApiKey.rateLimitTier,
            expiresAt: mockUpdatedApiKey.expiresAt,
            lastUsed: mockUpdatedApiKey.lastUsed,
            usageCount: mockUpdatedApiKey.usageCount,
            isActive: mockUpdatedApiKey.isActive,
            createdAt: mockUpdatedApiKey.createdAt,
            updatedAt: mockUpdatedApiKey.updatedAt,
          },
        },
        meta: {
          timestamp: expect.any(Date),
          requestId: 'unknown',
          version: '0.2.1',
        },
      });
    });

    it('should handle invalid permissions', async () => {
      // Arrange
      const invalidReq = {
        ...mockReq,
        body: { ...mockReq.body, permissions: ['invalid-permission'] },
      };

      // Act
      await apiKeyController.updateApiKey(invalidReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_PERMISSIONS',
          message: 'Invalid permissions. Valid options: search, analytics, admin',
        },
      });
    });

    it('should handle non-existent API key', async () => {
      // Arrange
      mockApiKeyService.updateApiKey.mockResolvedValue(null);

      // Act
      await apiKeyController.updateApiKey(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'API_KEY_NOT_FOUND',
          message: 'API key not found or access denied',
        },
      });
    });

    it('should handle service errors', async () => {
      // Arrange
      mockApiKeyService.updateApiKey.mockRejectedValue(new Error('Database error'));

      // Act
      await apiKeyController.updateApiKey(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update API key',
        },
      });
    });
  });

  describe('revokeApiKey', () => {
    const mockReq = {
      params: { keyId: 'key-123' },
      user: { id: 'user-123', role: 'user' },
      get: jest.fn().mockReturnValue(undefined),
    } as any;

    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any;

    beforeEach(() => {
      mockRes.status.mockClear();
      mockRes.json.mockClear();
      mockReq.get.mockClear();
    });

    it('should revoke API key successfully', async () => {
      // Arrange
      mockApiKeyService.revokeApiKey.mockResolvedValue(true);

      // Act
      await apiKeyController.revokeApiKey(mockReq, mockRes);

      // Assert
      expect(mockApiKeyService.revokeApiKey).toHaveBeenCalledWith('key-123', 'user-123');
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          message: 'API key revoked successfully',
          keyId: 'key-123',
        },
        meta: {
          timestamp: expect.any(Date),
          requestId: 'unknown',
          version: '0.2.1',
        },
      });
    });

    it('should handle non-existent API key', async () => {
      // Arrange
      mockApiKeyService.revokeApiKey.mockResolvedValue(false);

      // Act
      await apiKeyController.revokeApiKey(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'API_KEY_NOT_FOUND',
          message: 'API key not found or access denied',
        },
      });
    });

    it('should handle service errors', async () => {
      // Arrange
      mockApiKeyService.revokeApiKey.mockRejectedValue(new Error('Database error'));

      // Act
      await apiKeyController.revokeApiKey(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to revoke API key',
        },
      });
    });
  });

  describe('regenerateApiKey', () => {
    const mockReq = {
      params: { keyId: 'key-123' },
      user: { id: 'user-123', role: 'user' },
      get: jest.fn().mockReturnValue(undefined),
    } as any;

    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any;

    beforeEach(() => {
      mockRes.status.mockClear();
      mockRes.json.mockClear();
    });

    it('should regenerate API key successfully', async () => {
      // Arrange
      const oldApiKey: ApiKey = {
        id: 'key-123',
        userId: 'user-123',
        name: 'Test API Key',
        keyPrefix: 'altus4_sk_test_abc123',
        permissions: ['search'],
        rateLimitTier: 'free',
        environment: 'test',
        isActive: true,
        usageCount: 5,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        expiresAt: undefined,
        lastUsed: new Date('2024-01-02'),
        rateLimitCustom: undefined,
      };

      const newApiKey: ApiKey = {
        ...oldApiKey,
        keyPrefix: 'altus4_sk_test_xyz789',
        updatedAt: new Date('2024-01-03'),
      };

      const expectedResult = {
        apiKey: newApiKey,
        secretKey: 'altus4_sk_test_xyz789def456',
      };

      mockApiKeyService.getUserApiKeys.mockResolvedValue([oldApiKey]);
      mockApiKeyService.revokeApiKey.mockResolvedValue(true);
      mockApiKeyService.generateApiKey.mockResolvedValue(expectedResult);

      // Act
      await apiKeyController.regenerateApiKey(mockReq, mockRes);

      // Assert
      expect(mockApiKeyService.getUserApiKeys).toHaveBeenCalledWith('user-123');
      expect(mockApiKeyService.revokeApiKey).toHaveBeenCalledWith('key-123', 'user-123');
      expect(mockApiKeyService.generateApiKey).toHaveBeenCalledWith({
        userId: 'user-123',
        name: oldApiKey.name,
        permissions: oldApiKey.permissions,
        rateLimitTier: oldApiKey.rateLimitTier,
        environment: oldApiKey.environment,
        expiresAt: oldApiKey.expiresAt,
      });
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          apiKey: {
            id: expectedResult.apiKey.id,
            name: expectedResult.apiKey.name,
            keyPrefix: expectedResult.apiKey.keyPrefix,
            environment: expectedResult.apiKey.environment,
            permissions: expectedResult.apiKey.permissions,
            rateLimitTier: expectedResult.apiKey.rateLimitTier,
            expiresAt: expectedResult.apiKey.expiresAt,
            createdAt: expectedResult.apiKey.createdAt,
          },
          secretKey: expectedResult.secretKey,
          warning:
            'This is the only time the full API key will be shown. Please store it securely.',
          oldKeyId: 'key-123',
        },
        meta: {
          timestamp: expect.any(Date),
          requestId: 'unknown',
          version: '0.2.1',
        },
      });
    });

    it('should handle non-existent API key', async () => {
      // Arrange
      mockApiKeyService.getUserApiKeys.mockResolvedValue([]);

      // Act
      await apiKeyController.regenerateApiKey(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'API_KEY_NOT_FOUND',
          message: 'API key not found or access denied',
        },
      });
    });

    it('should handle service errors', async () => {
      // Arrange
      mockApiKeyService.getUserApiKeys.mockRejectedValue(new Error('Database error'));

      // Act
      await apiKeyController.regenerateApiKey(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to regenerate API key',
        },
      });
    });
  });

  describe('getApiKeyUsage', () => {
    const mockReq = {
      params: { keyId: 'key-123' },
      user: { id: 'user-123', role: 'user' },
      get: jest.fn().mockReturnValue(undefined),
    } as any;

    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any;

    beforeEach(() => {
      mockRes.status.mockClear();
      mockRes.json.mockClear();
      mockReq.get.mockClear();
    });

    it('should get API key usage successfully', async () => {
      // Arrange
      const mockUsage = {
        apiKeyId: 'key-123',
        requestCount: 150,
        lastUsed: new Date('2024-01-02'),
        rateLimitStatus: {
          tier: 'free',
          remaining: 850,
          resetTime: new Date('2024-01-03'),
        },
      };

      mockApiKeyService.getApiKeyUsage.mockResolvedValue(mockUsage);

      // Act
      await apiKeyController.getApiKeyUsage(mockReq, mockRes);

      // Assert
      expect(mockApiKeyService.getApiKeyUsage).toHaveBeenCalledWith('key-123', 'user-123');
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          usage: mockUsage,
        },
        meta: {
          timestamp: expect.any(Date),
          requestId: 'unknown',
          version: '0.2.1',
        },
      });
    });

    it('should handle non-existent API key', async () => {
      // Arrange
      mockApiKeyService.getApiKeyUsage.mockResolvedValue(null);

      // Act
      await apiKeyController.getApiKeyUsage(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'API_KEY_NOT_FOUND',
          message: 'API key not found or access denied',
        },
      });
    });

    it('should handle service errors', async () => {
      // Arrange
      mockApiKeyService.getApiKeyUsage.mockRejectedValue(new Error('Database error'));

      // Act
      await apiKeyController.getApiKeyUsage(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve API key usage',
        },
      });
    });
  });
});
