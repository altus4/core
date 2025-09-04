import type { ApiKey } from '@/services/ApiKeyService';
import { TestHelpers } from '@tests/utils/test-helpers';

// Mock the logger
jest.mock('@/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Create mock functions that we can control
const mockValidateApiKey = jest.fn();
const mockUpdateLastUsedIp = jest.fn().mockResolvedValue(true);

// Import the middleware directly
import { authenticateApiKey, requirePermission, requireRole } from './apiKeyAuth';

// Import the actual service for spying
import { ApiKeyService } from '@/services/ApiKeyService';

describe('API Key Auth Middleware', () => {
  let mockReq: any;
  let mockRes: any;
  let nextFunction: jest.Mock;

  const mockApiKey: ApiKey = {
    id: 'key-123',
    userId: 'user-456',
    keyPrefix: 'altus4_sk_test_abc123def456',
    name: 'Test API Key',
    environment: 'test',
    permissions: ['search'],
    rateLimitTier: 'free',
    rateLimitCustom: undefined,
    expiresAt: undefined,
    lastUsed: undefined,
    usageCount: 0,
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockUser = {
    id: 'user-456',
    email: 'test@example.com',
    name: 'Test User',
    role: 'user',
  };

  beforeEach(async () => {
    mockReq = TestHelpers.mockRequest();
    mockRes = TestHelpers.mockResponse();
    nextFunction = jest.fn();

    // Add required request properties for IP tracking
    mockReq.ip = '127.0.0.1';
    mockReq.connection = { remoteAddress: '127.0.0.1' };

    // Spy on the module-level service instance methods
    jest.spyOn(ApiKeyService.prototype, 'validateApiKey').mockImplementation(mockValidateApiKey);
    jest
      .spyOn(ApiKeyService.prototype, 'updateLastUsedIp')
      .mockImplementation(mockUpdateLastUsedIp);

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await TestHelpers.cleanupTestData();
    jest.clearAllMocks();
  });

  describe('authenticateApiKey', () => {
    describe('Valid API Key', () => {
      it('should allow access with valid API key', async () => {
        // Arrange
        const validApiKey = 'altus4_sk_test_abc123def456ghi789jkl012mno345pqr678stu';
        mockReq.headers = {
          authorization: `Bearer ${validApiKey}`,
        };
        mockValidateApiKey.mockResolvedValue({ apiKey: mockApiKey, user: mockUser });

        // Act
        await authenticateApiKey(mockReq, mockRes, nextFunction);

        // Assert
        expect(nextFunction).toHaveBeenCalled();
        expect(mockReq.apiKey).toEqual(mockApiKey);
        expect(mockReq.user).toEqual(mockUser);
        expect(mockRes.status).not.toHaveBeenCalled();
        expect(mockValidateApiKey).toHaveBeenCalledWith(validApiKey);
      });

      it('should extract API key information correctly', async () => {
        // Arrange
        const liveApiKey = 'altus4_sk_live_xyz789abc123def456ghi789jkl012mno345pqr678stu';
        const liveKey: ApiKey = {
          ...mockApiKey,
          environment: 'live',
          permissions: ['search', 'analytics'],
          rateLimitTier: 'pro',
        };
        mockReq.headers = {
          authorization: `Bearer ${liveApiKey}`,
        };
        mockValidateApiKey.mockResolvedValue({ apiKey: liveKey, user: mockUser });

        // Act
        await authenticateApiKey(mockReq, mockRes, nextFunction);

        // Assert
        expect(mockReq.apiKey).toEqual(liveKey);
        expect(mockReq.apiKey.environment).toBe('live');
        expect(mockReq.apiKey.permissions).toEqual(['search', 'analytics']);
        expect(mockReq.apiKey.rateLimitTier).toBe('pro');
        expect(nextFunction).toHaveBeenCalled();
      });

      it('should handle enterprise tier with custom limits', async () => {
        // Arrange
        const enterpriseKey: ApiKey = {
          ...mockApiKey,
          rateLimitTier: 'enterprise',
          rateLimitCustom: { requests: 50000, window: 3600 },
        };
        mockReq.headers = {
          authorization: 'Bearer altus4_sk_live_enterprise123def456ghi789jkl012mno345pqr678stu',
        };
        mockValidateApiKey.mockResolvedValue({
          apiKey: enterpriseKey,
          user: mockUser,
        });

        // Act
        await authenticateApiKey(mockReq, mockRes, nextFunction);

        // Assert
        expect(mockReq.apiKey.rateLimitTier).toBe('enterprise');
        expect(mockReq.apiKey.rateLimitCustom).toEqual({ requests: 50000, window: 3600 });
        expect(nextFunction).toHaveBeenCalled();
      });
    });

    describe('Invalid API Key', () => {
      it('should reject request with invalid API key format', async () => {
        // Arrange
        mockReq.headers = {
          authorization: 'Bearer invalid.api.key',
        };

        // Act
        await authenticateApiKey(mockReq, mockRes, nextFunction);

        // Assert
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_API_KEY_FORMAT',
            message: 'API key must start with altus4_sk_',
          },
        });
        expect(nextFunction).not.toHaveBeenCalled();
        expect(mockValidateApiKey).not.toHaveBeenCalled();
      });

      it('should reject request with wrong API key prefix', async () => {
        // Arrange
        mockReq.headers = {
          authorization: 'Bearer wrong_sk_test_abc123def456ghi789jkl012mno345pqr678stu',
        };

        // Act
        await authenticateApiKey(mockReq, mockRes, nextFunction);

        // Assert
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_API_KEY_FORMAT',
            message: 'API key must start with altus4_sk_',
          },
        });
        expect(nextFunction).not.toHaveBeenCalled();
      });

      it('should reject request with non-existent API key', async () => {
        // Arrange
        const nonExistentKey = 'altus4_sk_test_nonexistent123def456ghi789jkl012mno345pqr678stu';
        mockReq.headers = {
          authorization: `Bearer ${nonExistentKey}`,
        };
        mockValidateApiKey.mockResolvedValue(null);

        // Act
        await authenticateApiKey(mockReq, mockRes, nextFunction);

        // Assert
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_API_KEY',
            message: 'Invalid or expired API key',
          },
        });
        expect(nextFunction).not.toHaveBeenCalled();
      });

      it('should reject request with expired API key', async () => {
        // Arrange
        mockReq.headers = {
          authorization: 'Bearer altus4_sk_test_expired123def456ghi789jkl012mno345pqr678stu',
        };
        // validateApiKey should return null for expired keys
        mockValidateApiKey.mockResolvedValue(null);

        // Act
        await authenticateApiKey(mockReq, mockRes, nextFunction);

        // Assert
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_API_KEY',
            message: 'Invalid or expired API key',
          },
        });
        expect(nextFunction).not.toHaveBeenCalled();
      });

      it('should reject request with inactive API key', async () => {
        // Arrange
        mockReq.headers = {
          authorization: 'Bearer altus4_sk_test_inactive123def456ghi789jkl012mno345pqr678stu',
        };
        // validateApiKey should return null for inactive keys
        mockValidateApiKey.mockResolvedValue(null);

        // Act
        await authenticateApiKey(mockReq, mockRes, nextFunction);

        // Assert
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_API_KEY',
            message: 'Invalid or expired API key',
          },
        });
        expect(nextFunction).not.toHaveBeenCalled();
      });
    });

    describe('Missing API Key', () => {
      it('should reject request with no authorization header', async () => {
        // Arrange - no authorization header set

        // Act
        await authenticateApiKey(mockReq, mockRes, nextFunction);

        // Assert
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'NO_API_KEY',
            message: 'Authorization header missing',
          },
        });
        expect(nextFunction).not.toHaveBeenCalled();
      });

      it('should reject request with invalid authorization format', async () => {
        // Arrange
        mockReq.headers = {
          authorization: 'InvalidFormat api_key_here',
        };

        // Act
        await authenticateApiKey(mockReq, mockRes, nextFunction);

        // Assert
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_AUTH_FORMAT',
            message: 'Authorization header must be in format: Bearer <api_key>',
          },
        });
        expect(nextFunction).not.toHaveBeenCalled();
      });

      it('should reject request with empty Bearer token', async () => {
        // Arrange
        mockReq.headers = {
          authorization: 'Bearer ',
        };

        // Act
        await authenticateApiKey(mockReq, mockRes, nextFunction);

        // Assert
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_API_KEY_FORMAT',
            message: 'API key must start with altus4_sk_',
          },
        });
        expect(nextFunction).not.toHaveBeenCalled();
      });
    });

    describe('User Lookup Errors', () => {
      it('should reject request when API key validation fails', async () => {
        // Arrange
        const validApiKey = 'altus4_sk_test_abc123def456ghi789jkl012mno345pqr678stu';
        mockReq.headers = {
          authorization: `Bearer ${validApiKey}`,
        };
        mockValidateApiKey.mockResolvedValue(null);

        // Act
        await authenticateApiKey(mockReq, mockRes, nextFunction);

        // Assert
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_API_KEY',
            message: 'Invalid or expired API key',
          },
        });
        expect(nextFunction).not.toHaveBeenCalled();
      });

      it('should handle database errors gracefully', async () => {
        // Arrange
        const validApiKey = 'altus4_sk_test_abc123def456ghi789jkl012mno345pqr678stu';
        mockReq.headers = {
          authorization: `Bearer ${validApiKey}`,
        };
        mockValidateApiKey.mockRejectedValue(new Error('Database connection failed'));

        // Act
        await authenticateApiKey(mockReq, mockRes, nextFunction);

        // Assert
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'AUTH_ERROR',
            message: 'Authentication failed',
          },
        });
        expect(nextFunction).not.toHaveBeenCalled();
      });
    });

    describe('Edge Cases', () => {
      it('should handle case-insensitive Bearer prefix', async () => {
        // Arrange
        const validApiKey = 'altus4_sk_test_abc123def456ghi789jkl012mno345pqr678stu';
        mockReq.headers = {
          authorization: `bearer ${validApiKey}`, // lowercase 'bearer'
        };
        mockValidateApiKey.mockResolvedValue({ apiKey: mockApiKey, user: mockUser });

        // Act
        await authenticateApiKey(mockReq, mockRes, nextFunction);

        // Assert
        expect(nextFunction).toHaveBeenCalled();
        expect(mockReq.apiKey).toBeDefined();
      });

      it('should handle extra whitespace in authorization header', async () => {
        // Arrange
        const validApiKey = 'altus4_sk_test_abc123def456ghi789jkl012mno345pqr678stu';
        mockReq.headers = {
          authorization: `  Bearer   ${validApiKey}  `, // extra whitespace
        };
        // Clear all previous mock calls and expectations
        jest.clearAllMocks();
        mockValidateApiKey.mockResolvedValue({ apiKey: mockApiKey, user: mockUser });
        mockUpdateLastUsedIp.mockResolvedValue(true);

        // Act
        await authenticateApiKey(mockReq, mockRes, nextFunction);

        // Assert - extra whitespace should be rejected for security
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_AUTH_FORMAT',
            message: 'Authorization header must be in format: Bearer <api_key>',
          },
        });
        expect(nextFunction).not.toHaveBeenCalled();
      });

      it('should track request IP address', async () => {
        // Arrange
        const validApiKey = 'altus4_sk_test_abc123def456ghi789jkl012mno345pqr678stu';
        const clientIP = '192.168.1.100';
        mockReq.headers = {
          authorization: `Bearer ${validApiKey}`,
        };
        mockReq.ip = clientIP;
        mockValidateApiKey.mockResolvedValue({ apiKey: mockApiKey, user: mockUser });

        // Act
        await authenticateApiKey(mockReq, mockRes, nextFunction);

        // Assert
        expect(mockValidateApiKey).toHaveBeenCalledWith(validApiKey);
        expect(mockUpdateLastUsedIp).toHaveBeenCalledWith(mockApiKey.id, clientIP);
        expect(nextFunction).toHaveBeenCalled();
      });
    });
  });

  describe('requirePermission', () => {
    beforeEach(() => {
      // Setup authenticated request with API key
      mockReq.apiKey = mockApiKey;
      mockReq.user = mockUser;
    });

    it('should allow access when API key has required permission', async () => {
      // Arrange
      const middleware = requirePermission('search');
      mockReq.apiKey.permissions = ['search', 'analytics'];

      // Act
      await middleware(mockReq, mockRes, nextFunction);

      // Assert
      expect(nextFunction).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should deny access when API key lacks required permission', async () => {
      // Arrange
      const middleware = requirePermission('admin');
      mockReq.apiKey.permissions = ['search'];

      // Act
      await middleware(mockReq, mockRes, nextFunction);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: "Permission 'admin' required",
          details: {
            required: 'admin',
            available: ['search'],
          },
        },
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should deny access when no API key is present', async () => {
      // Arrange
      const middleware = requirePermission('search');
      mockReq.apiKey = undefined;

      // Act
      await middleware(mockReq, mockRes, nextFunction);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should handle multiple permissions correctly', async () => {
      // Arrange
      const middleware = requirePermission('analytics');
      mockReq.apiKey.permissions = ['search', 'analytics', 'admin'];

      // Act
      await middleware(mockReq, mockRes, nextFunction);

      // Assert
      expect(nextFunction).toHaveBeenCalled();
    });
  });

  describe('requireRole', () => {
    beforeEach(() => {
      // Setup authenticated request
      mockReq.apiKey = mockApiKey;
      mockReq.user = mockUser;
    });

    it('should allow access when user has required role', async () => {
      // Arrange
      const middleware = requireRole('user');
      mockReq.user.role = 'user';

      // Act
      await middleware(mockReq, mockRes, nextFunction);

      // Assert
      expect(nextFunction).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should deny access when user lacks required role', async () => {
      // Arrange
      const middleware = requireRole('admin');
      mockReq.user.role = 'user';

      // Act
      await middleware(mockReq, mockRes, nextFunction);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'admin role required',
          details: {
            required: 'admin',
            current: 'user',
          },
        },
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should deny access when no user is present', async () => {
      // Arrange
      const middleware = requireRole('user');
      mockReq.user = undefined;

      // Act
      await middleware(mockReq, mockRes, nextFunction);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should allow admin access to all roles', async () => {
      // Arrange
      const middleware = requireRole('user');
      mockReq.user.role = 'admin';

      // Act
      await middleware(mockReq, mockRes, nextFunction);

      // Assert
      expect(nextFunction).toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    it('should process valid API keys quickly', async () => {
      // Arrange
      const validApiKey = 'altus4_sk_test_abc123def456ghi789jkl012mno345pqr678stu';
      mockReq.headers = {
        authorization: `Bearer ${validApiKey}`,
      };
      mockValidateApiKey.mockResolvedValue({ apiKey: mockApiKey, user: mockUser });

      // Act & Assert
      const { duration } = await TestHelpers.measurePerformance(async () => {
        await authenticateApiKey(mockReq, mockRes, nextFunction);
      });

      expect(duration).toBeLessThan(100); // Should be fast (< 100ms)
      expect(nextFunction).toHaveBeenCalled();
    });
  });
});
