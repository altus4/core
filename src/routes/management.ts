/**
 * Management Routes
 *
 * Provides initial setup and management endpoints for bootstrapping API keys.
 * Uses JWT authentication for the initial API key creation, then transitions to API key auth.
 *
 * Routes:
 *   - POST /api/v1/management/setup - Initial API key creation using JWT
 *   - GET /api/v1/management/health - Health check with auth status
 */
import { ApiKeyController } from '@/controllers/ApiKeyController';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { authenticate } from '@/middleware/auth';
import { rateLimiter } from '@/middleware/rateLimiter';
import type { ApiResponse } from '@/types';
import { Router } from 'express';

const router = Router();
const apiKeyController = new ApiKeyController();

// Apply rate limiting to all management routes
router.use(rateLimiter);

/**
 * @route POST /api/v1/management/setup
 * @desc Bootstrap initial API key creation using JWT authentication
 * @access Private (requires JWT token)
 */
router.post('/setup', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      } as ApiResponse);
      return;
    }

    // Create initial API key with default settings
    const mockApiKeyRequest = {
      ...req,
      body: {
        name: 'Initial API Key',
        environment: 'test',
        permissions: ['search'],
        rateLimitTier: 'free',
      },
      user: req.user,
      apiKey: undefined,
      get: (header: string) => req.get(header),
    };

    await apiKeyController.createApiKey(mockApiKeyRequest as any, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SETUP_FAILED',
        message: 'Failed to create initial API key',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    } as ApiResponse);
  }
});

/**
 * @route GET /api/v1/management/health
 * @desc Health check with authentication status
 * @access Public
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.3.0',
      uptime: process.uptime(),
      authenticationMethods: ['jwt', 'api-key'],
    },
    meta: {
      timestamp: new Date(),
      requestId: req.get('X-Request-ID') || 'unknown',
      version: process.env.npm_package_version || '0.3.0',
    },
  } as ApiResponse);
});

/**
 * @route GET /api/v1/management/migration-status
 * @desc Check if user has migrated to API keys
 * @access Private (requires JWT token)
 */
router.get('/migration-status', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      } as ApiResponse);
      return;
    }

    // This is a placeholder - you might want to implement actual logic
    // to check if the user has any API keys
    res.json({
      success: true,
      data: {
        userId: req.user.id,
        hasMigrated: false, // Would check if user has any API keys
        recommendedAction: 'Create your first API key using the /setup endpoint',
        documentation: 'https://docs.altus4.dev/authentication',
      },
      meta: {
        timestamp: new Date(),
        requestId: req.get('X-Request-ID') || 'unknown',
        version: process.env.npm_package_version || '0.3.0',
      },
    } as ApiResponse);
  } catch (_error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'STATUS_CHECK_FAILED',
        message: 'Failed to check migration status',
      },
    } as ApiResponse);
  }
});

export default router;
