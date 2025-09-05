import { TestHelpers } from '@tests/utils/test-helpers';
import jwt from 'jsonwebtoken';
import { authenticate, type AuthenticatedRequest, requireRole } from './auth';

describe('Auth Middleware', () => {
  // Auth tests require MySQL to be running
  let mockReq: any;
  let mockRes: any;
  let nextFunction: jest.Mock;
  let testUser: any;

  beforeEach(async () => {
    mockReq = TestHelpers.mockRequest();
    mockRes = TestHelpers.mockResponse();
    nextFunction = jest.fn();

    testUser = await TestHelpers.createTestUser({
      email: 'auth@example.com',
      name: 'Auth Test User',
    });
  });

  afterEach(async () => {
    await TestHelpers.cleanupTestData();
  });

  describe('Valid Token', () => {
    it('should allow access with valid JWT token', async () => {
      // Arrange
      const validToken = TestHelpers.generateTestToken(testUser);
      mockReq.headers = {
        authorization: `Bearer ${validToken}`,
      };

      // Act
      await authenticate(mockReq, mockRes, nextFunction);

      // Assert
      expect(nextFunction).toHaveBeenCalled();
      expect(mockReq.user).toBeDefined();
      expect(mockReq.user.id).toBe(testUser.id);
      expect(mockReq.user.email).toBe(testUser.email);
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should extract user information correctly from token', async () => {
      // Arrange
      const validToken = TestHelpers.generateTestToken({
        ...testUser,
        role: 'admin',
      });
      mockReq.headers = {
        authorization: `Bearer ${validToken}`,
      };

      // Act
      await authenticate(mockReq, mockRes, nextFunction);

      // Assert
      expect(mockReq.user).toEqual(
        expect.objectContaining({
          id: testUser.id,
          email: testUser.email,
          role: 'admin',
        })
      );
      expect(nextFunction).toHaveBeenCalled();
    });
  });

  describe('Invalid Token', () => {
    it('should reject request with invalid token', async () => {
      // Arrange
      mockReq.headers = {
        authorization: 'Bearer invalid.token.here',
      };

      // Act
      await authenticate(mockReq, mockRes, nextFunction);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: expect.any(String),
        },
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should reject expired token', async () => {
      // Arrange
      const expiredToken = jwt.sign(
        { id: testUser.id, email: testUser.email },
        process.env.JWT_SECRET || 'test_secret',
        { expiresIn: '-1h' } // Expired 1 hour ago
      );
      mockReq.headers = {
        authorization: `Bearer ${expiredToken}`,
      };

      // Act
      await authenticate(mockReq, mockRes, nextFunction);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: expect.any(String),
        },
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should reject malformed token', async () => {
      // Arrange
      mockReq.headers = {
        authorization: 'Bearer malformed.token',
      };

      // Act
      await authenticate(mockReq, mockRes, nextFunction);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: expect.any(String),
        },
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('Missing Token', () => {
    it('should reject request with no authorization header', async () => {
      // Arrange - no authorization header set

      // Act
      await authenticate(mockReq, mockRes, nextFunction);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NO_TOKEN',
          message: expect.any(String),
        },
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should reject request with invalid authorization format', async () => {
      // Arrange
      mockReq.headers = {
        authorization: 'InvalidFormat token_here',
      };

      // Act
      await authenticate(mockReq, mockRes, nextFunction);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_AUTH_FORMAT',
          message: expect.any(String),
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
      await authenticate(mockReq, mockRes, nextFunction);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NO_TOKEN',
          message: expect.any(String),
        },
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle case-insensitive Bearer prefix', async () => {
      // Arrange
      const validToken = TestHelpers.generateTestToken(testUser);
      mockReq.headers = {
        authorization: `bearer ${validToken}`, // lowercase 'bearer'
      };

      // Act
      await authenticate(mockReq, mockRes, nextFunction);

      // Assert
      expect(nextFunction).toHaveBeenCalled();
      expect(mockReq.user).toBeDefined();
    });

    it('should handle extra whitespace in authorization header', async () => {
      // Arrange
      const validToken = TestHelpers.generateTestToken(testUser);
      mockReq.headers = {
        authorization: `  Bearer   ${validToken}  `, // extra whitespace
      };

      // Act
      await authenticate(mockReq, mockRes, nextFunction);

      // Assert
      expect(nextFunction).toHaveBeenCalled();
      expect(mockReq.user).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should process valid tokens quickly', async () => {
      // Arrange
      const validToken = TestHelpers.generateTestToken(testUser);
      mockReq.headers = {
        authorization: `Bearer ${validToken}`,
      };

      // Act & Assert
      const { duration } = await TestHelpers.measurePerformance(async () => {
        await authenticate(mockReq, mockRes, nextFunction);
      });

      expect(duration).toBeLessThan(50); // Should be very fast (< 50ms)
      expect(nextFunction).toHaveBeenCalled();
    });
  });

  describe('requireRole', () => {
    describe('requireRole middleware', () => {
      it('should allow access for admin role when admin is required', async () => {
        // Arrange
        const mockReq = {
          ...TestHelpers.mockRequest(),
          user: { id: '1', email: 'admin@test.com', name: 'Admin User', role: 'admin' as const },
        } as AuthenticatedRequest;
        const mockRes = TestHelpers.mockResponse();
        const nextFunction = jest.fn();

        const requireAdminMiddleware = requireRole('admin');

        // Act
        requireAdminMiddleware(mockReq, mockRes, nextFunction);

        // Assert
        expect(nextFunction).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
        expect(mockRes.json).not.toHaveBeenCalled();
      });

      it('should allow access for admin role when user role is required', async () => {
        // Arrange
        const mockReq = {
          ...TestHelpers.mockRequest(),
          user: { id: '1', email: 'admin@test.com', name: 'Admin User', role: 'admin' as const },
        } as AuthenticatedRequest;
        const mockRes = TestHelpers.mockResponse();
        const nextFunction = jest.fn();

        const requireUserMiddleware = requireRole('user');

        // Act
        requireUserMiddleware(mockReq, mockRes, nextFunction);

        // Assert
        expect(nextFunction).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
        expect(mockRes.json).not.toHaveBeenCalled();
      });

      it('should allow access for user role when user is required', async () => {
        // Arrange
        const mockReq = {
          ...TestHelpers.mockRequest(),
          user: { id: '1', email: 'user@test.com', name: 'Regular User', role: 'user' as const },
        } as AuthenticatedRequest;
        const mockRes = TestHelpers.mockResponse();
        const nextFunction = jest.fn();

        const requireUserMiddleware = requireRole('user');

        // Act
        requireUserMiddleware(mockReq, mockRes, nextFunction);

        // Assert
        expect(nextFunction).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
        expect(mockRes.json).not.toHaveBeenCalled();
      });

      it('should deny access for user role when admin is required', async () => {
        // Arrange
        const mockReq = {
          ...TestHelpers.mockRequest(),
          user: { id: '1', email: 'user@test.com', name: 'Regular User', role: 'user' as const },
        } as AuthenticatedRequest;
        const mockRes = TestHelpers.mockResponse();
        const nextFunction = jest.fn();

        const requireAdminMiddleware = requireRole('admin');

        // Act
        requireAdminMiddleware(mockReq, mockRes, nextFunction);

        // Assert
        expect(nextFunction).not.toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'admin role required',
          },
        });
      });

      it('should deny access when no user is authenticated', async () => {
        // Arrange
        const mockReq = {
          ...TestHelpers.mockRequest(),
          user: undefined,
        } as AuthenticatedRequest;
        const mockRes = TestHelpers.mockResponse();
        const nextFunction = jest.fn();

        const requireUserMiddleware = requireRole('user');

        // Act
        requireUserMiddleware(mockReq, mockRes, nextFunction);

        // Assert
        expect(nextFunction).not.toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
      });

      it('should create different middleware instances for different roles', () => {
        // Act
        const adminMiddleware = requireRole('admin');
        const userMiddleware = requireRole('user');

        // Assert
        expect(adminMiddleware).toBeInstanceOf(Function);
        expect(userMiddleware).toBeInstanceOf(Function);
        expect(adminMiddleware).not.toBe(userMiddleware);
      });
    });
  });
});
