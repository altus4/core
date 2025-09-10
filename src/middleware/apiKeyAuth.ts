/**
 * API Key Authentication Middleware
 *
 * Provides Express middleware for API key authentication and role-based access control.
 * Replaces JWT authentication for B2B service-to-service authentication.
 * Adds user and API key information to the request object if authentication succeeds.
 *
 * Usage:
 *   - Use authenticateApiKey to protect routes and extract user info from API key
 *   - Use requirePermission to restrict access based on API key permissions
 *   - Use requireRole for role-based access control
 */
import type { ApiKey } from '@/services/ApiKeyService';
import { ApiKeyService } from '@/services/ApiKeyService';
import type { ApiResponse } from '@/types';
import { logger } from '@/utils/logger';
import type { NextFunction, Request, Response } from 'express';

/**
 * Extends Express Request to include authenticated user and API key info.
 */
export interface ApiKeyAuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role: 'admin' | 'user';
  };
  apiKey?: ApiKey;
}

// Initialize API key service
const apiKeyService = new ApiKeyService();

/**
 * Middleware to authenticate requests using API keys.
 * Adds user and API key info to req.user and req.apiKey if valid.
 * Responds with 401 if API key is missing or invalid.
 */
export const authenticateApiKey = async (
  req: ApiKeyAuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    // Check if authorization header exists
    if (!authHeader) {
      res.status(401).json({
        success: false,
        error: {
          code: 'NO_API_KEY',
          message: 'Authorization header missing',
        },
      } as ApiResponse);
      return;
    }

    // Check for Bearer format with API key
    const bearerMatch = authHeader.match(/^bearer\s+(.*)$/i);
    if (!bearerMatch) {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_AUTH_FORMAT',
          message: 'Authorization header must be in format: Bearer <api_key>',
        },
      } as ApiResponse);
      return;
    }

    const apiKey = bearerMatch[1].trim();

    // Validate API key format
    if (!apiKey.startsWith('altus4_sk_')) {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_API_KEY_FORMAT',
          message: 'API key must start with altus4_sk_',
        },
      } as ApiResponse);
      return;
    }

    // Validate API key
    const validationResult = await apiKeyService.validateApiKey(apiKey);

    if (!validationResult) {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_API_KEY',
          message: 'Invalid or expired API key',
        },
      } as ApiResponse);
      return;
    }

    const { apiKey: keyData, user } = validationResult;

    // Update last used IP for security tracking
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    apiKeyService.updateLastUsedIp(keyData.id, clientIp).catch(error => {
      logger.warn('Failed to update last used IP:', error);
    });

    // Add user and API key info to request
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as 'admin' | 'user',
    };

    req.apiKey = keyData;

    logger.debug(`API key authenticated: ${keyData.keyPrefix}... for user ${user.email}`);
    next();
  } catch (error: any) {
    logger.error('API key authentication error:', error);

    res.status(401).json({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: 'Authentication failed',
      },
    } as ApiResponse);
  }
};

/**
 * Middleware to require a specific permission for access.
 * Must be used after authenticateApiKey middleware.
 * Responds with 403 if API key doesn't have required permission.
 *
 * @param permission - Required permission (e.g., 'search', 'analytics', 'admin')
 *
 * @remarks
 * The `permissions` property on the `ApiKey` object is expected to be an array of strings,
 * e.g., ['search', 'analytics', 'admin']. The middleware checks for the presence of the required
 * permission or 'admin' in this array.
 */
export const requirePermission = (permission: string) => {
  return (req: ApiKeyAuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.apiKey) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      } as ApiResponse);
      return;
    }

    if ((req.apiKey.permissions ?? []).includes('admin')) {
      next();
      return;
    }

    if (!Array.isArray(req.apiKey.permissions) || !req.apiKey.permissions.includes(permission)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `Permission '${permission}' required`,
          details: {
            required: permission,
            available: req.apiKey?.permissions,
          },
        },
      } as ApiResponse);
      return;
    }

    next();
  };
};

/**
 * Middleware to require a specific user role for access.
 * Must be used after authenticateApiKey middleware.
 * Responds with 403 if user doesn't have required role.
 *
 * @param role - Required user role ('admin' or 'user')
 */
export const requireRole = (role: 'admin' | 'user') => {
  return (req: ApiKeyAuthenticatedRequest, res: Response, next: NextFunction): void => {
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

    if (req.user.role !== role && req.user.role !== 'admin') {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `${role} role required`,
          details: {
            required: role,
            current: req.user.role,
          },
        },
      } as ApiResponse);
      return;
    }

    next();
  };
};

/**
 * Middleware to check if API key is for a specific environment.
 * Useful for ensuring test keys don't access production features.
 *
 * @param environment - Required environment ('test' or 'live')
 */
export const requireEnvironment = (environment: 'test' | 'live') => {
  return (req: ApiKeyAuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.apiKey) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      } as ApiResponse);
      return;
    }

    if (req.apiKey.environment !== environment) {
      res.status(403).json({
        success: false,
        error: {
          code: 'ENVIRONMENT_MISMATCH',
          message: `${environment} environment API key required`,
          details: {
            required: environment,
            current: req.apiKey.environment,
          },
        },
      } as ApiResponse);
      return;
    }

    next();
  };
};

/**
 * Middleware to validate API key expiration.
 * Already handled in authenticateApiKey, but can be used for additional checks.
 */
export const checkApiKeyExpiration = (
  req: ApiKeyAuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.apiKey) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      },
    } as ApiResponse);
    return;
  }

  if (req.apiKey.expiresAt && req.apiKey.expiresAt < new Date()) {
    res.status(401).json({
      success: false,
      error: {
        code: 'API_KEY_EXPIRED',
        message: 'API key has expired',
        details: {
          expiredAt: req.apiKey.expiresAt.toISOString(),
        },
      },
    } as ApiResponse);
    return;
  }

  next();
};

/**
 * Get rate limit tier from API key for use in rate limiting middleware
 */
export const getApiKeyRateLimitTier = (req: ApiKeyAuthenticatedRequest): string => {
  return req.apiKey?.rateLimitTier || 'free';
};

/**
 * Get API key ID for use in rate limiting (instead of IP)
 */
export const getApiKeyId = (req: ApiKeyAuthenticatedRequest): string => {
  return req.apiKey?.id || req.ip || 'unknown';
};

// Export types for other modules
export type { ApiKey } from '@/services/ApiKeyService';
