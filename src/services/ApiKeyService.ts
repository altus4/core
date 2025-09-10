/**
 * ApiKeyService
 *
 * Manages API key generation, validation, and lifecycle operations for B2B authentication.
 * Provides secure key generation, hashing, and lookup optimized for performance.
 *
 * Usage:
 *   - Use generateApiKey() to create new API keys for users
 *   - Use validateApiKey() for authentication middleware
 *   - Use management methods for key lifecycle operations
 */
import { config } from '@/config';
import { logger } from '@/utils/logger';
import crypto from 'crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { createConnection } from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';

export interface ApiKey {
  id: string;
  userId: string;
  keyPrefix: string;
  name: string;
  environment: 'test' | 'live';
  permissions: string[];
  rateLimitTier: 'free' | 'pro' | 'enterprise';
  rateLimitCustom?: Record<string, any>;
  expiresAt?: Date;
  lastUsed?: Date;
  lastUsedIp?: string;
  usageCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateApiKeyRequest {
  userId: string;
  name: string;
  environment: 'test' | 'live';
  permissions?: string[];
  rateLimitTier?: 'free' | 'pro' | 'enterprise';
  rateLimitCustom?: Record<string, any>;
  expiresAt?: Date;
}

export interface ApiKeyUsage {
  apiKeyId: string;
  requestCount: number;
  lastUsed: Date;
  rateLimitStatus: {
    tier: string;
    remaining: number;
    resetTime: Date;
  };
}

export class ApiKeyService {
  private connection = createConnection({
    host: config.database.host,
    port: config.database.port,
    user: config.database.username,
    password: config.database.password,
    database: config.database.database,
  });

  constructor() {
    this.initializeConnection();
  }

  private async initializeConnection(): Promise<void> {
    try {
      const conn = await this.connection;
      await conn.ping();
      logger.info('ApiKeyService database connection established');
    } catch (error) {
      logger.error('Failed to establish ApiKeyService database connection:', error);
    }
  }

  /**
   * Generate a new API key with secure random generation
   */
  public async generateApiKey(request: CreateApiKeyRequest): Promise<{
    apiKey: ApiKey;
    secretKey: string;
  }> {
    try {
      const conn = await this.connection;

      // Generate deterministic length randoms to satisfy integration patterns
      const secretRandom = crypto.randomBytes(24).toString('hex'); // 48 lowercase hex
      const fullKey = `altus4_sk_${request.environment}_${secretRandom}`;
      const keyPrefix = fullKey.substring(0, 30); // 30 lowercase hex for prefix

      // Hash the full key for storage
      const keyHash = crypto.createHash('sha256').update(fullKey).digest('hex');

      const apiKeyId = uuidv4();
      const now = new Date();

      // Insert API key record
      await conn.execute(
        `INSERT INTO api_keys (
          id, user_id, key_prefix, key_hash, name, environment,
          permissions, rate_limit_tier, rate_limit_custom, expires_at, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          apiKeyId,
          request.userId,
          keyPrefix,
          keyHash,
          request.name,
          request.environment,
          JSON.stringify(request.permissions || ['search']),
          request.rateLimitTier || 'free',
          request.rateLimitCustom ? JSON.stringify(request.rateLimitCustom) : null,
          request.expiresAt || null,
          true,
          now,
          now,
        ]
      );

      const apiKey: ApiKey = {
        id: apiKeyId,
        userId: request.userId,
        keyPrefix,
        name: request.name,
        environment: request.environment,
        permissions: request.permissions || ['search'],
        rateLimitTier: request.rateLimitTier || 'free',
        expiresAt: request.expiresAt,
        usageCount: 0,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };

      // Log only a safe prefix of the full secret to aid debugging without exposing full key
      logger.info(`API key generated for user ${request.userId}: ${fullKey.substring(0, 30)}...`);

      return {
        apiKey,
        secretKey: fullKey, // Return the full key only once
      };
    } catch (error) {
      logger.error('Failed to generate API key:', error);
      throw new Error('Failed to generate API key');
    }
  }

  /**
   * Validate an API key and return associated user information
   */
  public async validateApiKey(fullKey: string): Promise<{
    apiKey: ApiKey;
    user: { id: string; email: string; name: string; role: string };
  } | null> {
    try {
      const conn = await this.connection;

      // Extract prefix for efficient lookup
      const keyPrefix = fullKey.substring(0, 30);

      // Hash the provided key for comparison
      const keyHash = crypto.createHash('sha256').update(fullKey).digest('hex');

      // Find API key by prefix and validate hash
      const [apiKeys] = await conn.execute<RowDataPacket[]>(
        `SELECT ak.*, u.email, u.name, u.role
         FROM api_keys ak
         JOIN users u ON ak.user_id = u.id
         WHERE ak.key_prefix = ?
         AND ak.key_hash = ?
         AND ak.is_active = true
         AND u.is_active = true
         AND (ak.expires_at IS NULL OR ak.expires_at > NOW())`,
        [keyPrefix, keyHash]
      );

      if (apiKeys.length === 0) {
        return null;
      }

      const keyData = apiKeys[0];

      // Update last used timestamp and increment usage count
      await conn.execute(
        'UPDATE api_keys SET last_used = ?, usage_count = usage_count + 1 WHERE id = ?',
        [new Date(), keyData.id]
      );

      const apiKey: ApiKey = {
        id: keyData.id,
        userId: keyData.user_id,
        keyPrefix: keyData.key_prefix,
        name: keyData.name,
        environment: keyData.environment,
        permissions: Array.isArray(keyData.permissions)
          ? keyData.permissions
          : JSON.parse(keyData.permissions || '["search"]'),
        rateLimitTier: keyData.rate_limit_tier,
        rateLimitCustom: keyData.rate_limit_custom
          ? typeof keyData.rate_limit_custom === 'object'
            ? keyData.rate_limit_custom
            : JSON.parse(keyData.rate_limit_custom)
          : undefined,
        expiresAt: keyData.expires_at ? new Date(keyData.expires_at) : undefined,
        lastUsed: new Date(),
        lastUsedIp: keyData.last_used_ip,
        usageCount: keyData.usage_count + 1,
        isActive: keyData.is_active,
        createdAt: new Date(keyData.created_at),
        updatedAt: new Date(keyData.updated_at),
      };

      const user = {
        id: keyData.user_id,
        email: keyData.email,
        name: keyData.name,
        role: keyData.role,
      };

      return { apiKey, user };
    } catch (error) {
      logger.error('Failed to validate API key:', error);
      return null;
    }
  }

  /**
   * Get all API keys for a user
   */
  public async getUserApiKeys(userId: string): Promise<ApiKey[]> {
    try {
      const conn = await this.connection;

      const [keys] = await conn.execute<RowDataPacket[]>(
        `SELECT * FROM api_keys
         WHERE user_id = ? AND is_active = true
         ORDER BY created_at DESC`,
        [userId]
      );

      return keys.map(keyData => ({
        id: keyData.id,
        userId: keyData.user_id,
        keyPrefix: keyData.key_prefix,
        name: keyData.name,
        environment: keyData.environment,
        permissions: Array.isArray(keyData.permissions)
          ? keyData.permissions
          : JSON.parse(keyData.permissions || '["search"]'),
        rateLimitTier: keyData.rate_limit_tier,
        rateLimitCustom: keyData.rate_limit_custom
          ? JSON.parse(keyData.rate_limit_custom)
          : undefined,
        expiresAt: keyData.expires_at ? new Date(keyData.expires_at) : undefined,
        lastUsed: keyData.last_used ? new Date(keyData.last_used) : undefined,
        lastUsedIp: keyData.last_used_ip,
        usageCount: keyData.usage_count || 0,
        isActive: keyData.is_active,
        createdAt: new Date(keyData.created_at),
        updatedAt: new Date(keyData.updated_at),
      }));
    } catch (error) {
      logger.error(`Failed to get API keys for user ${userId}:`, error);
      throw new Error('Failed to retrieve API keys');
    }
  }

  /**
   * Revoke (deactivate) an API key
   */
  public async revokeApiKey(keyId: string, userId: string): Promise<boolean> {
    try {
      const conn = await this.connection;

      const [result] = await conn.execute(
        'UPDATE api_keys SET is_active = false, updated_at = ? WHERE id = ? AND user_id = ?',
        [new Date(), keyId, userId]
      );

      const success = (result as any).affectedRows > 0;

      if (success) {
        logger.info(`API key revoked: ${keyId}`);
      }

      return success;
    } catch (error) {
      logger.error(`Failed to revoke API key ${keyId}:`, error);
      throw new Error('Failed to revoke API key');
    }
  }

  /**
   * Update API key properties
   */
  public async updateApiKey(
    keyId: string,
    userId: string,
    updates: {
      name?: string;
      permissions?: string[];
      rateLimitTier?: 'free' | 'pro' | 'enterprise';
      expiresAt?: Date | null;
    }
  ): Promise<ApiKey | null> {
    try {
      const conn = await this.connection;

      const updateFields: string[] = [];
      const updateValues: any[] = [];

      if (updates.name) {
        updateFields.push('name = ?');
        updateValues.push(updates.name);
      }

      if (updates.permissions) {
        updateFields.push('permissions = ?');
        updateValues.push(JSON.stringify(updates.permissions));
      }

      if (updates.rateLimitTier) {
        updateFields.push('rate_limit_tier = ?');
        updateValues.push(updates.rateLimitTier);
      }

      if (updates.expiresAt !== undefined) {
        updateFields.push('expires_at = ?');
        updateValues.push(updates.expiresAt);
      }

      if (updateFields.length === 0) {
        throw new Error('No valid fields to update');
      }

      updateFields.push('updated_at = ?');
      updateValues.push(new Date());
      updateValues.push(keyId);
      updateValues.push(userId);

      await conn.execute(
        `UPDATE api_keys SET ${updateFields.join(', ')} WHERE id = ? AND user_id = ?`,
        updateValues
      );

      logger.info(`API key updated: ${keyId}`);

      // Return updated key
      const [keys] = await conn.execute<RowDataPacket[]>(
        'SELECT * FROM api_keys WHERE id = ? AND user_id = ?',
        [keyId, userId]
      );

      if (keys.length === 0) {
        return null;
      }

      const keyData = keys[0];
      return {
        id: keyData.id,
        userId: keyData.user_id,
        keyPrefix: keyData.key_prefix,
        name: keyData.name,
        environment: keyData.environment,
        permissions: Array.isArray(keyData.permissions)
          ? keyData.permissions
          : JSON.parse(keyData.permissions || '["search"]'),
        rateLimitTier: keyData.rate_limit_tier,
        rateLimitCustom: keyData.rate_limit_custom
          ? JSON.parse(keyData.rate_limit_custom)
          : undefined,
        expiresAt: keyData.expires_at ? new Date(keyData.expires_at) : undefined,
        lastUsed: keyData.last_used ? new Date(keyData.last_used) : undefined,
        lastUsedIp: keyData.last_used_ip,
        usageCount: keyData.usage_count || 0,
        isActive: keyData.is_active,
        createdAt: new Date(keyData.created_at),
        updatedAt: new Date(keyData.updated_at),
      };
    } catch (error) {
      logger.error(`Failed to update API key ${keyId}:`, error);
      throw error;
    }
  }

  /**
   * Get API key usage statistics
   */
  public async getApiKeyUsage(keyId: string, userId: string): Promise<ApiKeyUsage | null> {
    try {
      const conn = await this.connection;

      const [keys] = await conn.execute<RowDataPacket[]>(
        'SELECT id, usage_count, last_used, rate_limit_tier FROM api_keys WHERE id = ? AND user_id = ?',
        [keyId, userId]
      );

      if (keys.length === 0) {
        return null;
      }

      const keyData = keys[0];

      return {
        apiKeyId: keyData.id,
        requestCount: keyData.usage_count || 0,
        lastUsed: keyData.last_used ? new Date(keyData.last_used) : new Date(),
        rateLimitStatus: {
          tier: keyData.rate_limit_tier,
          remaining: this.calculateRemainingRequests(keyData.rate_limit_tier),
          resetTime: this.calculateResetTime(),
        },
      };
    } catch (error) {
      logger.error(`Failed to get usage for API key ${keyId}:`, error);
      return null;
    }
  }

  /**
   * Calculate remaining requests based on rate limit tier
   */
  private calculateRemainingRequests(tier: string): number {
    const limits = {
      free: 1000,
      pro: 10000,
      enterprise: 100000,
    };

    return limits[tier as keyof typeof limits] || 1000;
  }

  /**
   * Calculate rate limit reset time (next hour)
   */
  private calculateResetTime(): Date {
    const now = new Date();
    const nextHour = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      now.getHours() + 1,
      0,
      0,
      0
    );
    return nextHour;
  }

  /**
   * Update last used IP for security tracking
   */
  public async updateLastUsedIp(keyId: string, ipAddress: string): Promise<void> {
    try {
      const conn = await this.connection;

      await conn.execute('UPDATE api_keys SET last_used_ip = ? WHERE id = ?', [ipAddress, keyId]);
    } catch (error) {
      logger.error(`Failed to update last used IP for key ${keyId}:`, error);
    }
  }

  /**
   * Close database connection
   */
  public async close(): Promise<void> {
    try {
      const conn = await this.connection;
      await conn.end();
      logger.info('ApiKeyService database connection closed');
    } catch (error) {
      logger.error('Failed to close ApiKeyService database connection:', error);
    }
  }
}
