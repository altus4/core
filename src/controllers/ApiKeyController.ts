/**
 * ApiKeyController
 *
 * Handles API key management operations such as creation, listing, updating, and revocation.
 * Provides endpoints for users to manage their API keys for B2B service integration.
 *
 * Usage:
 *   - Use createApiKey() to generate new API keys
 *   - Use listApiKeys() to retrieve user's API keys
 *   - Use revokeApiKey() to deactivate API keys
 *   - Use updateApiKey() to modify API key properties
 */
import type { ApiKeyAuthenticatedRequest } from '@/middleware/apiKeyAuth';
import { ApiKeyService, type CreateApiKeyRequest } from '@/services/ApiKeyService';
import type { ApiResponse } from '@/types';
import { logger } from '@/utils/logger';
import type { Response } from 'express';

export class ApiKeyController {
  private apiKeyService: ApiKeyService;

  constructor() {
    this.apiKeyService = new ApiKeyService();
  }

  /**
   * Create a new API key for the authenticated user
   */
  public async createApiKey(req: ApiKeyAuthenticatedRequest, res: Response): Promise<void> {
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

      const {
        name,
        environment = 'test',
        permissions = ['search'],
        rateLimitTier = 'free',
        rateLimitCustom,
        expiresAt,
      } = req.body;

      // Validate required fields
      if (!name || typeof name !== 'string' || name.trim().length < 3) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'API key name must be at least 3 characters long',
          },
        } as ApiResponse);
        return;
      }

      // Validate environment
      if (!['test', 'live'].includes(environment)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_ENVIRONMENT',
            message: 'Environment must be either "test" or "live"',
          },
        } as ApiResponse);
        return;
      }

      // Validate permissions
      const validPermissions = ['search', 'analytics', 'admin'];
      if (!Array.isArray(permissions) || !permissions.every(p => validPermissions.includes(p))) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PERMISSIONS',
            message: 'Invalid permissions. Valid options: search, analytics, admin',
          },
        } as ApiResponse);
        return;
      }

      // Validate rate limit tier
      if (!['free', 'pro', 'enterprise'].includes(rateLimitTier)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_RATE_LIMIT_TIER',
            message: 'Rate limit tier must be "free", "pro", or "enterprise"',
          },
        } as ApiResponse);
        return;
      }

      // Check if user can create this tier (prevent privilege escalation)
      if (req.user.role !== 'admin' && rateLimitTier !== 'free') {
        res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_PRIVILEGES',
            message: 'Only admins can create pro or enterprise API keys',
          },
        } as ApiResponse);
        return;
      }

      const createRequest: CreateApiKeyRequest = {
        userId: req.user.id,
        name: name.trim(),
        environment,
        permissions,
        rateLimitTier,
        rateLimitCustom,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      };

      const result = await this.apiKeyService.generateApiKey(createRequest);

      logger.info(`API key created for user ${req.user.id}: ${result.apiKey.name}`);

      res.status(201).json({
        success: true,
        data: {
          apiKey: {
            id: result.apiKey.id,
            name: result.apiKey.name,
            keyPrefix: result.apiKey.keyPrefix,
            environment: result.apiKey.environment,
            permissions: result.apiKey.permissions,
            rateLimitTier: result.apiKey.rateLimitTier,
            isActive: result.apiKey.isActive,
            expiresAt: result.apiKey.expiresAt,
            createdAt: result.apiKey.createdAt,
          },
          secretKey: result.secretKey,
          warning:
            'This is the only time the full API key will be shown. Please store it securely.',
        },
        meta: {
          timestamp: new Date(),
          requestId: req.get('X-Request-ID') || 'unknown',
          version: process.env.npm_package_version || '0.1.0',
        },
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to create API key:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create API key',
        },
      } as ApiResponse);
    }
  }

  /**
   * List all API keys for the authenticated user
   */
  public async listApiKeys(req: ApiKeyAuthenticatedRequest, res: Response): Promise<void> {
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

      const apiKeys = await this.apiKeyService.getUserApiKeys(req.user.id);

      // Filter out sensitive information
      const sanitizedKeys = apiKeys.map(key => ({
        id: key.id,
        name: key.name,
        keyPrefix: key.keyPrefix,
        environment: key.environment,
        permissions: key.permissions,
        rateLimitTier: key.rateLimitTier,
        expiresAt: key.expiresAt,
        lastUsed: key.lastUsed,
        usageCount: key.usageCount,
        isActive: key.isActive,
        createdAt: key.createdAt,
        updatedAt: key.updatedAt,
      }));

      res.json({
        success: true,
        data: {
          apiKeys: sanitizedKeys,
          total: sanitizedKeys.length,
        },
        meta: {
          timestamp: new Date(),
          requestId: req.get('X-Request-ID') || 'unknown',
          version: process.env.npm_package_version || '0.1.0',
        },
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to list API keys:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve API keys',
        },
      } as ApiResponse);
    }
  }

  /**
   * Update an API key's properties
   */
  public async updateApiKey(req: ApiKeyAuthenticatedRequest, res: Response): Promise<void> {
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

      const { keyId } = req.params;
      const { name, permissions, rateLimitTier, expiresAt } = req.body;

      if (!keyId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_KEY_ID',
            message: 'API key ID is required',
          },
        } as ApiResponse);
        return;
      }

      const updates: any = {};

      if (name !== undefined) {
        if (typeof name !== 'string' || name.trim().length < 3) {
          res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_NAME',
              message: 'API key name must be at least 3 characters long',
            },
          } as ApiResponse);
          return;
        }
        updates.name = name.trim();
      }

      if (permissions !== undefined) {
        const validPermissions = ['search', 'analytics', 'admin'];
        if (!Array.isArray(permissions) || !permissions.every(p => validPermissions.includes(p))) {
          res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_PERMISSIONS',
              message: 'Invalid permissions. Valid options: search, analytics, admin',
            },
          } as ApiResponse);
          return;
        }
        updates.permissions = permissions;
      }

      if (rateLimitTier !== undefined) {
        if (!['free', 'pro', 'enterprise'].includes(rateLimitTier)) {
          res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_RATE_LIMIT_TIER',
              message: 'Rate limit tier must be "free", "pro", or "enterprise"',
            },
          } as ApiResponse);
          return;
        }

        // Check if user can set this tier
        if (req.user.role !== 'admin' && rateLimitTier !== 'free') {
          res.status(403).json({
            success: false,
            error: {
              code: 'INSUFFICIENT_PRIVILEGES',
              message: 'Only admins can set pro or enterprise tiers',
            },
          } as ApiResponse);
          return;
        }

        updates.rateLimitTier = rateLimitTier;
      }

      if (expiresAt !== undefined) {
        updates.expiresAt = expiresAt ? new Date(expiresAt) : null;
      }

      const updatedKey = await this.apiKeyService.updateApiKey(keyId, req.user.id, updates);

      if (!updatedKey) {
        res.status(404).json({
          success: false,
          error: {
            code: 'API_KEY_NOT_FOUND',
            message: 'API key not found or access denied',
          },
        } as ApiResponse);
        return;
      }

      logger.info(`API key updated: ${keyId} by user ${req.user.id}`);

      res.json({
        success: true,
        data: {
          apiKey: {
            id: updatedKey.id,
            name: updatedKey.name,
            keyPrefix: updatedKey.keyPrefix,
            environment: updatedKey.environment,
            permissions: updatedKey.permissions,
            rateLimitTier: updatedKey.rateLimitTier,
            expiresAt: updatedKey.expiresAt,
            lastUsed: updatedKey.lastUsed,
            usageCount: updatedKey.usageCount,
            isActive: updatedKey.isActive,
            createdAt: updatedKey.createdAt,
            updatedAt: updatedKey.updatedAt,
          },
        },
        meta: {
          timestamp: new Date(),
          requestId: req.get('X-Request-ID') || 'unknown',
          version: process.env.npm_package_version || '0.1.0',
        },
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to update API key:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update API key',
        },
      } as ApiResponse);
    }
  }

  /**
   * Revoke (deactivate) an API key
   */
  public async revokeApiKey(req: ApiKeyAuthenticatedRequest, res: Response): Promise<void> {
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

      const { keyId } = req.params;

      if (!keyId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_KEY_ID',
            message: 'API key ID is required',
          },
        } as ApiResponse);
        return;
      }

      const success = await this.apiKeyService.revokeApiKey(keyId, req.user.id);

      if (!success) {
        res.status(404).json({
          success: false,
          error: {
            code: 'API_KEY_NOT_FOUND',
            message: 'API key not found or access denied',
          },
        } as ApiResponse);
        return;
      }

      logger.info(`API key revoked: ${keyId} by user ${req.user.id}`);

      res.json({
        success: true,
        data: {
          keyId,
          message: 'API key revoked successfully',
        },
        meta: {
          timestamp: new Date(),
          requestId: req.get('X-Request-ID') || 'unknown',
          version: process.env.npm_package_version || '0.1.0',
        },
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to revoke API key:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to revoke API key',
        },
      } as ApiResponse);
    }
  }

  /**
   * Get API key usage statistics
   */
  public async getApiKeyUsage(req: ApiKeyAuthenticatedRequest, res: Response): Promise<void> {
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

      const { keyId } = req.params;

      if (!keyId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_KEY_ID',
            message: 'API key ID is required',
          },
        } as ApiResponse);
        return;
      }

      // Validate optional days parameter
      const daysParam = (req.query.days as string) || undefined;
      if (daysParam !== undefined) {
        const days = parseInt(daysParam as string, 10);
        if (!Number.isFinite(days) || days < 1) {
          res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'days must be a positive number',
            },
          } as ApiResponse);
          return;
        }
        if (days > 365) {
          res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'days cannot exceed 365',
            },
          } as ApiResponse);
          return;
        }
      }

      const usage = await this.apiKeyService.getApiKeyUsage(keyId, req.user.id);

      if (!usage) {
        res.status(404).json({
          success: false,
          error: {
            code: 'API_KEY_NOT_FOUND',
            message: 'API key not found or access denied',
          },
        } as ApiResponse);
        return;
      }

      res.json({
        success: true,
        data: {
          usage,
        },
        meta: {
          timestamp: new Date(),
          requestId: req.get('X-Request-ID') || 'unknown',
          version: process.env.npm_package_version || '0.1.0',
        },
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to get API key usage:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve API key usage',
        },
      } as ApiResponse);
    }
  }

  /**
   * Regenerate an API key (creates new secret while keeping same metadata)
   */
  public async regenerateApiKey(req: ApiKeyAuthenticatedRequest, res: Response): Promise<void> {
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

      const { keyId } = req.params;

      if (!keyId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_KEY_ID',
            message: 'API key ID is required',
          },
        } as ApiResponse);
        return;
      }

      // Get existing key to preserve metadata
      const existingKeys = await this.apiKeyService.getUserApiKeys(req.user.id);
      const existingKey = existingKeys.find(key => key.id === keyId);

      if (!existingKey) {
        res.status(404).json({
          success: false,
          error: {
            code: 'API_KEY_NOT_FOUND',
            message: 'API key not found or access denied',
          },
        } as ApiResponse);
        return;
      }

      // Revoke the old key
      await this.apiKeyService.revokeApiKey(keyId, req.user.id);

      // Create new key with same properties
      const createRequest: CreateApiKeyRequest = {
        userId: req.user.id,
        name: existingKey.name,
        environment: existingKey.environment,
        permissions: existingKey.permissions,
        rateLimitTier: existingKey.rateLimitTier,
        expiresAt: existingKey.expiresAt,
      };

      const result = await this.apiKeyService.generateApiKey(createRequest);

      logger.info(`API key regenerated: ${keyId} -> ${result.apiKey.id} by user ${req.user.id}`);

      res.json({
        success: true,
        data: {
          apiKey: {
            id: result.apiKey.id,
            name: result.apiKey.name,
            keyPrefix: result.apiKey.keyPrefix,
            environment: result.apiKey.environment,
            permissions: result.apiKey.permissions,
            rateLimitTier: result.apiKey.rateLimitTier,
            expiresAt: result.apiKey.expiresAt,
            createdAt: result.apiKey.createdAt,
          },
          secretKey: result.secretKey,
          warning:
            'This is the only time the full API key will be shown. Please store it securely.',
          oldKeyId: keyId,
        },
        meta: {
          timestamp: new Date(),
          requestId: req.get('X-Request-ID') || 'unknown',
          version: process.env.npm_package_version || '0.1.0',
        },
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to regenerate API key:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to regenerate API key',
        },
      } as ApiResponse);
    }
  }
}
