/**
 * Authentication Routes
 *
 * Defines endpoints for user registration, login, profile updates, and password changes.
 * Uses Zod schemas for request validation and delegates logic to AuthController.
 *
 * Usage:
 *   - Mount this router at /api/v1/auth in the main server
 */
import { AuthController } from '@/controllers/AuthController';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { authenticate } from '@/middleware/auth';
import { validateRequest } from '@/middleware/validation';
import type { ApiResponse, User } from '@/types';
import { Router } from 'express';
import { z } from 'zod';

const router = Router();
const authController = new AuthController();

// Validation schemas for registration, login, profile update, and password change
const registerSchema = z.object({
  email: z.string().email('Invalid email format').toLowerCase(),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  name: z.string().min(2, 'Name must be at least 2 characters long').trim(),
  role: z.enum(['admin', 'user']).optional().default('user'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

const updateProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters long').trim().optional(),
  email: z.string().email('Invalid email format').toLowerCase().optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters long'),
});

/**
 * POST /api/v1/auth/register
 * Register a new user
 * Validates request body and delegates to AuthController.register()
 */
router.post('/register', validateRequest({ body: registerSchema }), async (req, res) => {
  try {
    const result = await authController.register(req.body);

    const response: ApiResponse<{ user: User; token: string }> = {
      success: true,
      data: result,
      meta: {
        timestamp: new Date(),
        requestId: req.get('X-Request-ID') || 'unknown',
        version: process.env.npm_package_version || '0.3.0',
      },
    };

    res.status(201).json(response);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: {
        code: 'REGISTRATION_FAILED',
        message: error instanceof Error ? error.message : 'Registration failed',
      },
    } as ApiResponse);
  }
});

/**
 * POST /api/v1/auth/login
 * Authenticate user
 */
router.post('/login', validateRequest({ body: loginSchema }), async (req, res) => {
  try {
    const result = await authController.login(req.body);

    const response: ApiResponse<{ user: User; token: string }> = {
      success: true,
      data: result,
      meta: {
        timestamp: new Date(),
        requestId: req.get('X-Request-ID') || 'unknown',
        version: process.env.npm_package_version || '0.3.0',
      },
    };

    res.json(response);
  } catch (error) {
    res.status(401).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_FAILED',
        message: error instanceof Error ? error.message : 'Authentication failed',
      },
    } as ApiResponse);
  }
});

/**
 * GET /api/v1/auth/profile
 * Get current user profile
 */
router.get('/profile', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await authController.getProfile(req.user!.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      } as ApiResponse);
    }

    const response: ApiResponse<User> = {
      success: true,
      data: user,
      meta: {
        timestamp: new Date(),
        requestId: req.get('X-Request-ID') || 'unknown',
        version: process.env.npm_package_version || '0.3.0',
      },
    };

    return res.json(response);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: {
        code: 'PROFILE_RETRIEVAL_FAILED',
        message: error instanceof Error ? error.message : 'Failed to retrieve profile',
      },
    } as ApiResponse);
  }
});

/**
 * PUT /api/v1/auth/profile
 * Update user profile
 */
router.put(
  '/profile',
  authenticate,
  validateRequest({ body: updateProfileSchema }),
  async (req: AuthenticatedRequest, res) => {
    try {
      const user = await authController.updateProfile(req.user!.id, req.body);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          },
        } as ApiResponse);
      }

      const response: ApiResponse<User> = {
        success: true,
        data: user,
        meta: {
          timestamp: new Date(),
          requestId: req.get('X-Request-ID') || 'unknown',
          version: process.env.npm_package_version || '0.3.0',
        },
      };

      return res.json(response);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'PROFILE_UPDATE_FAILED',
          message: error instanceof Error ? error.message : 'Failed to update profile',
        },
      } as ApiResponse);
    }
  }
);

/**
 * POST /api/v1/auth/change-password
 * Change user password
 */
router.post(
  '/change-password',
  authenticate,
  validateRequest({ body: changePasswordSchema }),
  async (req: AuthenticatedRequest, res) => {
    try {
      const success = await authController.changePassword(req.user!.id, req.body);

      const response: ApiResponse<{ success: boolean }> = {
        success: true,
        data: { success },
        meta: {
          timestamp: new Date(),
          requestId: req.get('X-Request-ID') || 'unknown',
          version: process.env.npm_package_version || '0.3.0',
        },
      };

      res.json(response);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'PASSWORD_CHANGE_FAILED',
          message: error instanceof Error ? error.message : 'Failed to change password',
        },
      } as ApiResponse);
    }
  }
);

/**
 * POST /api/v1/auth/refresh
 * Refresh JWT token
 */
router.post('/refresh', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'NO_TOKEN',
          message: 'Token not provided',
        },
      } as ApiResponse);
    }

    const result = await authController.refreshToken(token);

    const response: ApiResponse<{ user: User; token: string }> = {
      success: true,
      data: result,
      meta: {
        timestamp: new Date(),
        requestId: req.get('X-Request-ID') || 'unknown',
        version: process.env.npm_package_version || '0.3.0',
      },
    };

    return res.json(response);
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'TOKEN_REFRESH_FAILED',
        message: error instanceof Error ? error.message : 'Failed to refresh token',
      },
    } as ApiResponse);
  }
});

/**
 * POST /api/v1/auth/logout
 * Logout user
 */
router.post('/logout', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    await authController.logout(req.user!.id);

    const response: ApiResponse<{ success: boolean }> = {
      success: true,
      data: { success: true },
      meta: {
        timestamp: new Date(),
        requestId: req.get('X-Request-ID') || 'unknown',
        version: process.env.npm_package_version || '0.3.0',
      },
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'LOGOUT_FAILED',
        message: error instanceof Error ? error.message : 'Logout failed',
      },
    } as ApiResponse);
  }
});

/**
 * DELETE /api/v1/auth/account
 * Deactivate user account
 */
router.delete('/account', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const success = await authController.deactivateAccount(req.user!.id);

    const response: ApiResponse<{ success: boolean }> = {
      success: true,
      data: { success },
      meta: {
        timestamp: new Date(),
        requestId: req.get('X-Request-ID') || 'unknown',
        version: process.env.npm_package_version || '0.3.0',
      },
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'ACCOUNT_DEACTIVATION_FAILED',
        message: error instanceof Error ? error.message : 'Failed to deactivate account',
      },
    } as ApiResponse);
  }
});

export { router as authRoutes };
