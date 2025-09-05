---
title: ApiKeyService Documentation
description: Complete technical documentation for ApiKeyService - API key management, authentication, and tiered access control in Altus 4.
---

# ApiKeyService Documentation

Comprehensive ApiKeyService Implementation Guide

The ApiKeyService manages API keys for secure service-to-service authentication in Altus 4. It provides tiered access control, usage tracking, and comprehensive key lifecycle management with advanced security features and analytics.

## Service Overview

### Responsibilities

The ApiKeyService handles:

- **API Key Generation** - Secure generation of API keys with proper formatting and entropy
- **Authentication & Authorization** - Validate API keys and enforce permission-based access control
- **Tiered Access Control** - Manage different subscription tiers with varying limits and permissions
- **Usage Tracking** - Monitor API key usage patterns and enforce rate limits
- **Key Lifecycle Management** - Create, update, rotate, and revoke API keys
- **Analytics & Reporting** - Provide detailed usage analytics and insights

### Architecture

```typescript
export class ApiKeyService {
  constructor(
    private databaseService: DatabaseService,
    private cacheService: CacheService,
    private encryptionService: EncryptionService,
    private logger: Logger,
    private config: ApiKeyConfig
  ) {}

  // Core API Key Methods
  async createApiKey(userId: string, keyData: CreateApiKeyRequest): Promise<ApiKey>;
  async getApiKey(keyId: string): Promise<ApiKey | null>;
  async validateApiKey(key: string): Promise<ValidationResult>;
  async updateApiKey(keyId: string, updates: UpdateApiKeyRequest): Promise<ApiKey>;
  async revokeApiKey(keyId: string, reason?: string): Promise<void>;
  async regenerateApiKey(keyId: string): Promise<ApiKey>;

  // Usage Tracking
  async trackUsage(keyId: string, usage: UsageMetric): Promise<void>;
  async getUsageStats(keyId: string, options: UsageStatsOptions): Promise<UsageStats>;
  async checkRateLimit(keyId: string, endpoint?: string): Promise<RateLimitResult>;

  // Permission Management
  async updatePermissions(keyId: string, permissions: Permission[]): Promise<void>;
  async checkPermission(keyId: string, permission: string): Promise<boolean>;
  async upgradeTier(keyId: string, newTier: ApiKeyTier): Promise<void>;

  // Analytics
  async getKeyAnalytics(keyId: string, period: string): Promise<KeyAnalytics>;
  async getUserKeyStats(userId: string): Promise<UserKeyStats>;
}
```

## Core Functionality

### API Key Generation and Management

#### Secure API Key Creation

The service generates secure, properly formatted API keys with comprehensive metadata:

```typescript
interface CreateApiKeyRequest {
  name: string
  tier: ApiKeyTier
  permissions: Permission[]
  environment: 'test' | 'live'
  description?: string
  expiresAt?: Date
  ipWhitelist?: string[]
  metadata?: Record<string, any>
}

interface ApiKey {
  id: string
  userId: string
  name: string
  keyPrefix: string
  keyHash: string
  tier: ApiKeyTier
  environment: 'test' | 'live'
  permissions: Permission[]
  status: ApiKeyStatus
  usage: UsageInfo
  security: SecurityInfo
  metadata: KeyMetadata
  createdAt: Date
  updatedAt: Date
  expiresAt?: Date
  lastUsedAt?: Date
}

interface ApiKeyTier {
  name: 'free' | 'pro' | 'enterprise' | 'custom'
  limits: TierLimits
  features: string[]
  price?: number
}

interface TierLimits {
  requestsPerHour: number
  requestsPerDay: number
  requestsPerMonth: number
  burstLimit: number
  concurrentRequests: number
  aiRequestsPerHour: number
  maxDatabases: number
}

async createApiKey(userId: string, keyData: CreateApiKeyRequest): Promise<ApiKey> {
  const startTime = Date.now()

  try {
    // Validate input data
    await this.validateCreateRequest(keyData)

    // Check user tier limits
    await this.checkUserKeyLimits(userId, keyData.tier)

    // Generate secure API key
    const { key, keyHash, keyPrefix } = await this.generateSecureApiKey(keyData.environment)

    // Create API key object
    const apiKey: ApiKey = {
      id: this.generateKeyId(),
      userId,
      name: keyData.name.trim(),
      keyPrefix,
      keyHash,
      tier: keyData.tier,
      environment: keyData.environment,
      permissions: keyData.permissions,
      status: {
        active: true,
        verified: false,
        suspended: false,
        suspendedReason: null
      },
      usage: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        lastRequestAt: null,
        currentPeriodUsage: {
          hour: 0,
          day: 0,
          month: 0
        }
      },
      security: {
        ipWhitelist: keyData.ipWhitelist || [],
        lastAccessIP: null,
        failedAttempts: 0,
        compromisedAt: null
      },
      metadata: {
        description: keyData.description,
        userAgent: keyData.metadata?.userAgent,
        source: keyData.metadata?.source || 'dashboard',
        ...keyData.metadata
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: keyData.expiresAt,
      lastUsedAt: null
    }

    // Store in database
    await this.storeApiKey(apiKey)

    // Cache key metadata for fast lookup
    await this.cacheKeyMetadata(keyPrefix, apiKey)

    // Log key creation
    this.logger.info('API key created', {
      keyId: apiKey.id,
      userId,
      tier: keyData.tier.name,
      environment: keyData.environment,
      permissions: keyData.permissions.length
    })

    // Return API key with the actual key (only shown once)
    return {
      ...apiKey,
      key // Include actual key only in creation response
    }

  } catch (error) {
    const operationTime = Date.now() - startTime
    this.logger.error('API key creation failed', {
      error,
      userId,
      keyName: keyData.name,
      operationTime
    })
    throw error
  }
}

private async generateSecureApiKey(environment: 'test' | 'live'): Promise<{
  key: string
  keyHash: string
  keyPrefix: string
}> {
  // Generate cryptographically secure random bytes
  const randomBytes = require('crypto').randomBytes(32)
  const keyToken = randomBytes.toString('base64url')

  // Create formatted API key
  const keyPrefix = `altus4_sk_${environment}`
  const key = `${keyPrefix}_${keyToken}`

  // Hash the key for storage (using SHA-256 for fast lookups)
  const keyHash = require('crypto')
    .createHash('sha256')
    .update(key)
    .digest('hex')

  // Store prefix mapping for efficient lookups
  const prefixLookup = keyPrefix.substring(0, 20) // First 20 chars

  return {
    key,
    keyHash,
    keyPrefix: prefixLookup
  }
}

private async validateCreateRequest(keyData: CreateApiKeyRequest): Promise<void> {
  const errors: string[] = []

  // Name validation
  if (!keyData.name || keyData.name.trim().length < 3) {
    errors.push('API key name must be at least 3 characters')
  }

  if (keyData.name.length > 100) {
    errors.push('API key name must be less than 100 characters')
  }

  // Tier validation
  if (!['free', 'pro', 'enterprise', 'custom'].includes(keyData.tier.name)) {
    errors.push('Invalid tier specified')
  }

  // Permission validation
  if (!keyData.permissions || keyData.permissions.length === 0) {
    errors.push('At least one permission must be specified')
  }

  const validPermissions = this.getValidPermissions()
  const invalidPermissions = keyData.permissions.filter(p => !validPermissions.includes(p))
  if (invalidPermissions.length > 0) {
    errors.push(`Invalid permissions: ${invalidPermissions.join(', ')}`)
  }

  // Environment validation
  if (!['test', 'live'].includes(keyData.environment)) {
    errors.push('Environment must be either "test" or "live"')
  }

  // Expiration validation
  if (keyData.expiresAt && keyData.expiresAt <= new Date()) {
    errors.push('Expiration date must be in the future')
  }

  // IP whitelist validation
  if (keyData.ipWhitelist && keyData.ipWhitelist.length > 0) {
    const invalidIPs = keyData.ipWhitelist.filter(ip => !this.isValidIP(ip))
    if (invalidIPs.length > 0) {
      errors.push(`Invalid IP addresses: ${invalidIPs.join(', ')}`)
    }
  }

  if (errors.length > 0) {
    throw new AppError('VALIDATION_ERROR', `API key validation failed: ${errors.join(', ')}`)
  }
}
```

### API Key Validation and Authentication

#### High-Performance Key Validation

The service provides fast, secure API key validation with comprehensive checks:

```typescript
interface ValidationResult {
  valid: boolean
  apiKey?: ApiKey
  user?: User
  reason?: string
  rateLimitInfo?: RateLimitInfo
  permissions?: Permission[]
}

interface RateLimitInfo {
  limit: number
  remaining: number
  resetTime: Date
  blocked: boolean
}

async validateApiKey(key: string): Promise<ValidationResult> {
  const startTime = Date.now()

  try {
    // Extract key prefix for fast lookup
    const keyPrefix = this.extractKeyPrefix(key)
    if (!keyPrefix) {
      return {
        valid: false,
        reason: 'Invalid API key format'
      }
    }

    // Try cache lookup first
    let apiKey = await this.getCachedKeyMetadata(keyPrefix)

    if (!apiKey) {
      // Hash the key for database lookup
      const keyHash = require('crypto')
        .createHash('sha256')
        .update(key)
        .digest('hex')

      // Query database
      apiKey = await this.getApiKeyByHash(keyHash)

      if (!apiKey) {
        await this.logInvalidKeyAttempt(key, 'key_not_found')
        return {
          valid: false,
          reason: 'Invalid API key'
        }
      }

      // Cache for future lookups
      await this.cacheKeyMetadata(keyPrefix, apiKey)
    }

    // Perform validation checks
    const validationChecks = await this.performValidationChecks(apiKey, key)
    if (!validationChecks.valid) {
      return validationChecks
    }

    // Check rate limits
    const rateLimitResult = await this.checkRateLimit(apiKey.id)
    if (rateLimitResult.blocked) {
      return {
        valid: false,
        reason: 'Rate limit exceeded',
        rateLimitInfo: rateLimitResult.info
      }
    }

    // Get user information
    const user = await this.getUserById(apiKey.userId)
    if (!user || !user.status.active) {
      return {
        valid: false,
        reason: 'User account inactive'
      }
    }

    // Update last used timestamp
    await this.updateLastUsed(apiKey.id)

    const validationTime = Date.now() - startTime
    this.logger.debug('API key validated successfully', {
      keyId: apiKey.id,
      userId: apiKey.userId,
      tier: apiKey.tier.name,
      validationTime
    })

    return {
      valid: true,
      apiKey,
      user,
      permissions: apiKey.permissions,
      rateLimitInfo: rateLimitResult.info
    }

  } catch (error) {
    const validationTime = Date.now() - startTime
    this.logger.error('API key validation failed', {
      error,
      keyPrefix: this.extractKeyPrefix(key),
      validationTime
    })

    return {
      valid: false,
      reason: 'Validation service error'
    }
  }
}

private async performValidationChecks(apiKey: ApiKey, key: string): Promise<ValidationResult> {
  // Check if key is active
  if (!apiKey.status.active) {
    await this.logInvalidKeyAttempt(key, 'key_inactive')
    return {
      valid: false,
      reason: 'API key is inactive'
    }
  }

  // Check if key is suspended
  if (apiKey.status.suspended) {
    await this.logInvalidKeyAttempt(key, 'key_suspended')
    return {
      valid: false,
      reason: `API key suspended: ${apiKey.status.suspendedReason}`
    }
  }

  // Check expiration
  if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
    await this.logInvalidKeyAttempt(key, 'key_expired')
    return {
      valid: false,
      reason: 'API key has expired'
    }
  }

  // Check IP whitelist if configured
  if (apiKey.security.ipWhitelist.length > 0) {
    const clientIP = this.getClientIP()
    if (!this.isIPAllowed(clientIP, apiKey.security.ipWhitelist)) {
      await this.logInvalidKeyAttempt(key, 'ip_not_whitelisted')
      return {
        valid: false,
        reason: 'IP address not authorized'
      }
    }
  }

  // Check for compromised key
  if (apiKey.security.compromisedAt) {
    await this.logInvalidKeyAttempt(key, 'key_compromised')
    return {
      valid: false,
      reason: 'API key has been compromised and revoked'
    }
  }

  return { valid: true }
}
```

### Usage Tracking and Rate Limiting

#### Comprehensive Usage Analytics

The service provides detailed usage tracking with real-time rate limiting:

```typescript
interface UsageMetric {
  endpoint: string
  method: string
  responseStatus: number
  responseTime: number
  requestSize: number
  responseSize: number
  timestamp: Date
  metadata?: Record<string, any>
}

interface UsageStats {
  period: string
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  averageResponseTime: number
  totalDataTransferred: number
  topEndpoints: EndpointUsage[]
  hourlyBreakdown: HourlyUsage[]
  errorBreakdown: ErrorBreakdown[]
}

interface RateLimitResult {
  blocked: boolean
  info: RateLimitInfo
}

async trackUsage(keyId: string, usage: UsageMetric): Promise<void> {
  try {
    const timestamp = usage.timestamp || new Date()

    // Update real-time counters in Redis
    await this.updateRealTimeCounters(keyId, usage, timestamp)

    // Store detailed usage record
    await this.storeUsageRecord(keyId, usage)

    // Update API key usage statistics
    await this.updateApiKeyStats(keyId, usage)

    this.logger.debug('Usage tracked', {
      keyId,
      endpoint: usage.endpoint,
      status: usage.responseStatus,
      responseTime: usage.responseTime
    })

  } catch (error) {
    this.logger.error('Usage tracking failed', { error, keyId, usage })
    // Don't throw error to avoid disrupting API responses
  }
}

private async updateRealTimeCounters(keyId: string, usage: UsageMetric, timestamp: Date): Promise<void> {
  const hour = Math.floor(timestamp.getTime() / (1000 * 3600))
  const day = Math.floor(timestamp.getTime() / (1000 * 86400))
  const month = Math.floor(timestamp.getTime() / (1000 * 86400 * 30))

  const pipeline = this.cacheService.pipeline()

  // Increment counters for different time periods
  pipeline.hincrby(`usage:${keyId}:hour:${hour}`, 'requests', 1)
  pipeline.hincrby(`usage:${keyId}:day:${day}`, 'requests', 1)
  pipeline.hincrby(`usage:${keyId}:month:${month}`, 'requests', 1)

  // Track successful vs failed requests
  if (usage.responseStatus >= 200 && usage.responseStatus < 400) {
    pipeline.hincrby(`usage:${keyId}:hour:${hour}`, 'successful', 1)
    pipeline.hincrby(`usage:${keyId}:day:${day}`, 'successful', 1)
    pipeline.hincrby(`usage:${keyId}:month:${month}`, 'successful', 1)
  } else {
    pipeline.hincrby(`usage:${keyId}:hour:${hour}`, 'failed', 1)
    pipeline.hincrby(`usage:${keyId}:day:${day}`, 'failed', 1)
    pipeline.hincrby(`usage:${keyId}:month:${month}`, 'failed', 1)
  }

  // Track data usage
  pipeline.hincrby(`usage:${keyId}:hour:${hour}`, 'data', usage.requestSize + usage.responseSize)

  // Track response times for averages
  pipeline.hincrby(`usage:${keyId}:hour:${hour}`, 'responseTimeSum', usage.responseTime)

  // Set expiration for cleanup
  pipeline.expire(`usage:${keyId}:hour:${hour}`, 86400 * 7) // 7 days
  pipeline.expire(`usage:${keyId}:day:${day}`, 86400 * 30) // 30 days
  pipeline.expire(`usage:${keyId}:month:${month}`, 86400 * 365) // 1 year

  await pipeline.exec()
}

async checkRateLimit(keyId: string, endpoint?: string): Promise<RateLimitResult> {
  try {
    const apiKey = await this.getApiKey(keyId)
    if (!apiKey) {
      return {
        blocked: true,
        info: {
          limit: 0,
          remaining: 0,
          resetTime: new Date(),
          blocked: true
        }
      }
    }

    const now = new Date()
    const currentHour = Math.floor(now.getTime() / (1000 * 3600))

    // Get current usage for this hour
    const hourlyUsage = await this.cacheService.hget(
      `usage:${keyId}:hour:${currentHour}`,
      'requests'
    )

    const currentUsage = parseInt(hourlyUsage || '0')
    const limit = apiKey.tier.limits.requestsPerHour
    const remaining = Math.max(0, limit - currentUsage)

    // Check if blocked
    const blocked = currentUsage >= limit

    // Calculate reset time (next hour)
    const resetTime = new Date((currentHour + 1) * 3600 * 1000)

    const rateLimitInfo: RateLimitInfo = {
      limit,
      remaining,
      resetTime,
      blocked
    }

    // Update rate limit cache for response headers
    await this.cacheService.setex(
      `ratelimit:${keyId}`,
      300, // 5 minutes
      JSON.stringify(rateLimitInfo)
    )

    if (blocked) {
      this.logger.warn('Rate limit exceeded', {
        keyId,
        currentUsage,
        limit,
        tier: apiKey.tier.name
      })

      // Log rate limit violation
      await this.logRateLimitViolation(keyId, currentUsage, limit)
    }

    return {
      blocked,
      info: rateLimitInfo
    }

  } catch (error) {
    this.logger.error('Rate limit check failed', { error, keyId })

    // Fail open with conservative limits
    return {
      blocked: false,
      info: {
        limit: 1000,
        remaining: 1000,
        resetTime: new Date(Date.now() + 3600000),
        blocked: false
      }
    }
  }
}

async getUsageStats(keyId: string, options: UsageStatsOptions = {}): Promise<UsageStats> {
  try {
    const { period = 'day', limit = 100 } = options

    // Calculate time range
    const endTime = new Date()
    const startTime = new Date()

    switch (period) {
      case 'hour':
        startTime.setHours(startTime.getHours() - 24)
        break
      case 'day':
        startTime.setDate(startTime.getDate() - 30)
        break
      case 'month':
        startTime.setMonth(startTime.getMonth() - 12)
        break
    }

    // Aggregate usage data
    const usageData = await this.aggregateUsageData(keyId, startTime, endTime, period)

    // Get top endpoints
    const topEndpoints = await this.getTopEndpoints(keyId, startTime, endTime, limit)

    // Get error breakdown
    const errorBreakdown = await this.getErrorBreakdown(keyId, startTime, endTime)

    const stats: UsageStats = {
      period,
      totalRequests: usageData.totalRequests,
      successfulRequests: usageData.successfulRequests,
      failedRequests: usageData.failedRequests,
      averageResponseTime: usageData.averageResponseTime,
      totalDataTransferred: usageData.totalDataTransferred,
      topEndpoints,
      hourlyBreakdown: usageData.hourlyBreakdown,
      errorBreakdown
    }

    return stats

  } catch (error) {
    this.logger.error('Failed to get usage stats', { error, keyId })
    throw new AppError('USAGE_STATS_FAILED', error.message)
  }
}
```

### Permission Management and Authorization

#### Granular Permission System

The service implements a comprehensive permission system with role-based access control:

```typescript
enum Permission {
  // Search permissions
  SEARCH_READ = 'search:read',
  SEARCH_ADVANCED = 'search:advanced',

  // Database permissions
  DATABASE_READ = 'database:read',
  DATABASE_WRITE = 'database:write',
  DATABASE_DELETE = 'database:delete',
  DATABASE_SCHEMA = 'database:schema',

  // Analytics permissions
  ANALYTICS_READ = 'analytics:read',
  ANALYTICS_WRITE = 'analytics:write',
  ANALYTICS_EXPORT = 'analytics:export',

  // Admin permissions
  ADMIN_USERS = 'admin:users',
  ADMIN_SYSTEM = 'admin:system',
  ADMIN_BILLING = 'admin:billing'
}

interface PermissionCheck {
  allowed: boolean
  reason?: string
  requiredTier?: string
}

async checkPermission(keyId: string, permission: string): Promise<boolean> {
  try {
    const apiKey = await this.getApiKey(keyId)
    if (!apiKey) {
      return false
    }

    // Check if permission is in the key's permission list
    if (!apiKey.permissions.includes(permission as Permission)) {
      this.logger.debug('Permission denied - not in key permissions', {
        keyId,
        permission,
        keyPermissions: apiKey.permissions
      })
      return false
    }

    // Check tier-specific restrictions
    const tierCheck = this.checkTierPermission(apiKey.tier, permission)
    if (!tierCheck.allowed) {
      this.logger.debug('Permission denied - tier restriction', {
        keyId,
        permission,
        tier: apiKey.tier.name,
        reason: tierCheck.reason
      })
      return false
    }

    return true

  } catch (error) {
    this.logger.error('Permission check failed', { error, keyId, permission })
    return false
  }
}

private checkTierPermission(tier: ApiKeyTier, permission: string): PermissionCheck {
  // Define tier-specific permission restrictions
  const tierPermissions: Record<string, string[]> = {
    free: [
      'search:read',
      'database:read',
      'analytics:read'
    ],
    pro: [
      'search:read',
      'search:advanced',
      'database:read',
      'database:write',
      'analytics:read',
      'analytics:write'
    ],
    enterprise: [
      'search:read',
      'search:advanced',
      'database:read',
      'database:write',
      'database:delete',
      'database:schema',
      'analytics:read',
      'analytics:write',
      'analytics:export'
    ],
    custom: [] // Custom tiers have explicit permission lists
  }

  // For custom tiers, rely on explicit permission grants
  if (tier.name === 'custom') {
    return { allowed: true }
  }

  const allowedPermissions = tierPermissions[tier.name] || []
  const allowed = allowedPermissions.includes(permission)

  return {
    allowed,
    reason: allowed ? undefined : `Permission not available for ${tier.name} tier`,
    requiredTier: this.getMinimumTierForPermission(permission)
  }
}

async updatePermissions(keyId: string, permissions: Permission[]): Promise<void> {
  try {
    const apiKey = await this.getApiKey(keyId)
    if (!apiKey) {
      throw new AppError('API_KEY_NOT_FOUND', 'API key not found')
    }

    // Validate permissions
    const validPermissions = this.getValidPermissions()
    const invalidPermissions = permissions.filter(p => !validPermissions.includes(p))
    if (invalidPermissions.length > 0) {
      throw new AppError('INVALID_PERMISSIONS', `Invalid permissions: ${invalidPermissions.join(', ')}`)
    }

    // Check tier compatibility
    const incompatiblePermissions = permissions.filter(p =>
      !this.checkTierPermission(apiKey.tier, p).allowed
    )
    if (incompatiblePermissions.length > 0) {
      throw new AppError('TIER_INCOMPATIBLE_PERMISSIONS',
        `Permissions not available for ${apiKey.tier.name} tier: ${incompatiblePermissions.join(', ')}`)
    }

    // Update permissions
    apiKey.permissions = permissions
    apiKey.updatedAt = new Date()

    await this.updateApiKey(keyId, { permissions })

    // Clear cached metadata
    await this.clearKeyCache(apiKey.keyPrefix)

    this.logger.info('API key permissions updated', {
      keyId,
      newPermissions: permissions,
      tier: apiKey.tier.name
    })

  } catch (error) {
    this.logger.error('Failed to update permissions', { error, keyId })
    throw error
  }
}
```

### Key Lifecycle Management

#### Comprehensive Key Operations

The service provides complete lifecycle management for API keys:

```typescript
async regenerateApiKey(keyId: string): Promise<ApiKey> {
  try {
    const existingKey = await this.getApiKey(keyId)
    if (!existingKey) {
      throw new AppError('API_KEY_NOT_FOUND', 'API key not found')
    }

    // Generate new key
    const { key, keyHash, keyPrefix } = await this.generateSecureApiKey(existingKey.environment)

    // Update key in database
    const updatedKey: ApiKey = {
      ...existingKey,
      keyPrefix,
      keyHash,
      updatedAt: new Date(),
      // Reset security counters
      security: {
        ...existingKey.security,
        failedAttempts: 0,
        compromisedAt: null
      }
    }

    await this.updateApiKeyInDatabase(keyId, updatedKey)

    // Clear old cache entries
    await this.clearKeyCache(existingKey.keyPrefix)

    // Cache new key metadata
    await this.cacheKeyMetadata(keyPrefix, updatedKey)

    this.logger.info('API key regenerated', {
      keyId,
      userId: existingKey.userId,
      tier: existingKey.tier.name
    })

    // Return with new key
    return {
      ...updatedKey,
      key
    }

  } catch (error) {
    this.logger.error('API key regeneration failed', { error, keyId })
    throw error
  }
}

async revokeApiKey(keyId: string, reason?: string): Promise<void> {
  try {
    const apiKey = await this.getApiKey(keyId)
    if (!apiKey) {
      throw new AppError('API_KEY_NOT_FOUND', 'API key not found')
    }

    // Update key status
    apiKey.status.active = false
    apiKey.status.suspended = true
    apiKey.status.suspendedReason = reason || 'Revoked by user'
    apiKey.updatedAt = new Date()

    await this.updateApiKeyInDatabase(keyId, apiKey)

    // Clear cache
    await this.clearKeyCache(apiKey.keyPrefix)

    // Log revocation
    await this.logKeyEvent(keyId, 'key_revoked', { reason })

    this.logger.info('API key revoked', {
      keyId,
      reason,
      userId: apiKey.userId
    })

  } catch (error) {
    this.logger.error('API key revocation failed', { error, keyId })
    throw error
  }
}

async upgradeTier(keyId: string, newTier: ApiKeyTier): Promise<void> {
  try {
    const apiKey = await this.getApiKey(keyId)
    if (!apiKey) {
      throw new AppError('API_KEY_NOT_FOUND', 'API key not found')
    }

    // Validate tier upgrade
    if (!this.isValidTierUpgrade(apiKey.tier, newTier)) {
      throw new AppError('INVALID_TIER_UPGRADE', 'Invalid tier upgrade path')
    }

    // Update tier and adjust permissions if needed
    const updatedPermissions = this.adjustPermissionsForTier(apiKey.permissions, newTier)

    apiKey.tier = newTier
    apiKey.permissions = updatedPermissions
    apiKey.updatedAt = new Date()

    await this.updateApiKeyInDatabase(keyId, apiKey)

    // Clear cache
    await this.clearKeyCache(apiKey.keyPrefix)

    // Log tier upgrade
    await this.logKeyEvent(keyId, 'tier_upgraded', {
      oldTier: apiKey.tier.name,
      newTier: newTier.name
    })

    this.logger.info('API key tier upgraded', {
      keyId,
      oldTier: apiKey.tier.name,
      newTier: newTier.name,
      userId: apiKey.userId
    })

  } catch (error) {
    this.logger.error('Tier upgrade failed', { error, keyId })
    throw error
  }
}
```

### Analytics and Reporting

#### Comprehensive Key Analytics

The service provides detailed analytics for API key usage and performance:

```typescript
interface KeyAnalytics {
  period: string
  keyId: string
  keyName: string
  tier: string
  overview: {
    totalRequests: number
    successRate: number
    averageResponseTime: number
    dataTransferred: number
    topEndpoints: EndpointUsage[]
  }
  trends: {
    requestTrend: TrendData[]
    performanceTrend: TrendData[]
    errorTrend: TrendData[]
  }
  geographic: {
    countries: CountryUsage[]
    regions: RegionUsage[]
  }
  insights: {
    peakUsageHours: number[]
    mostUsedFeatures: string[]
    recommendations: string[]
  }
}

async getKeyAnalytics(keyId: string, period: string = 'week'): Promise<KeyAnalytics> {
  try {
    const apiKey = await this.getApiKey(keyId)
    if (!apiKey) {
      throw new AppError('API_KEY_NOT_FOUND', 'API key not found')
    }

    const dateRange = this.calculateDateRange(period)

    // Get usage statistics
    const usageStats = await this.getUsageStats(keyId, {
      period,
      startDate: dateRange.start,
      endDate: dateRange.end
    })

    // Get geographic data
    const geographicData = await this.getGeographicUsage(keyId, dateRange)

    // Get trend data
    const trends = await this.getTrendAnalytics(keyId, dateRange)

    // Generate insights
    const insights = await this.generateKeyInsights(keyId, usageStats, trends)

    const analytics: KeyAnalytics = {
      period,
      keyId,
      keyName: apiKey.name,
      tier: apiKey.tier.name,
      overview: {
        totalRequests: usageStats.totalRequests,
        successRate: usageStats.successfulRequests / usageStats.totalRequests,
        averageResponseTime: usageStats.averageResponseTime,
        dataTransferred: usageStats.totalDataTransferred,
        topEndpoints: usageStats.topEndpoints
      },
      trends,
      geographic: geographicData,
      insights
    }

    return analytics

  } catch (error) {
    this.logger.error('Failed to get key analytics', { error, keyId })
    throw new AppError('KEY_ANALYTICS_FAILED', error.message)
  }
}

async getUserKeyStats(userId: string): Promise<UserKeyStats> {
  try {
    // Get all user's API keys
    const userKeys = await this.getUserApiKeys(userId)

    // Aggregate statistics across all keys
    const totalStats = {
      totalKeys: userKeys.length,
      activeKeys: userKeys.filter(k => k.status.active).length,
      totalRequests: 0,
      totalDataTransferred: 0,
      averageResponseTime: 0
    }

    // Get usage for each key
    const keyUsagePromises = userKeys.map(async key => {
      const usage = await this.getUsageStats(key.id, { period: 'month' })
      return {
        keyId: key.id,
        keyName: key.name,
        tier: key.tier.name,
        ...usage
      }
    })

    const keyUsages = await Promise.all(keyUsagePromises)

    // Calculate totals
    keyUsages.forEach(usage => {
      totalStats.totalRequests += usage.totalRequests
      totalStats.totalDataTransferred += usage.totalDataTransferred
    })

    totalStats.averageResponseTime = keyUsages.reduce((sum, usage) =>
      sum + usage.averageResponseTime, 0) / keyUsages.length || 0

    return {
      userId,
      overview: totalStats,
      keyBreakdown: keyUsages,
      trends: await this.getUserUsageTrends(userId),
      recommendations: await this.generateUserRecommendations(userId, totalStats)
    }

  } catch (error) {
    this.logger.error('Failed to get user key stats', { error, userId })
    throw new AppError('USER_KEY_STATS_FAILED', error.message)
  }
}
```

## Security Features

### Key Security Implementation

The service implements comprehensive security measures:

```typescript
interface SecurityFeatures {
  keyRotation: boolean
  ipWhitelisting: boolean
  compromiseDetection: boolean
  rateLimiting: boolean
  auditLogging: boolean
  encryptionAtRest: boolean
}

async detectCompromisedKey(keyId: string, indicators: SecurityIndicator[]): Promise<void> {
  try {
    const apiKey = await this.getApiKey(keyId)
    if (!apiKey) return

    // Analyze security indicators
    const riskScore = this.calculateRiskScore(indicators)

    if (riskScore >= this.config.security.compromiseThreshold) {
      // Mark key as compromised
      apiKey.security.compromisedAt = new Date()
      apiKey.status.active = false
      apiKey.status.suspended = true
      apiKey.status.suspendedReason = 'Suspected compromise'

      await this.updateApiKeyInDatabase(keyId, apiKey)

      // Clear cache
      await this.clearKeyCache(apiKey.keyPrefix)

      // Alert user and security team
      await this.alertCompromisedKey(keyId, indicators, riskScore)

      this.logger.warn('API key marked as compromised', {
        keyId,
        riskScore,
        indicators: indicators.map(i => i.type)
      })
    }

  } catch (error) {
    this.logger.error('Compromise detection failed', { error, keyId })
  }
}

private calculateRiskScore(indicators: SecurityIndicator[]): number {
  const weights = {
    unusual_location: 0.3,
    high_frequency: 0.2,
    failed_requests: 0.25,
    ip_reputation: 0.25
  }

  return indicators.reduce((score, indicator) => {
    return score + (weights[indicator.type] || 0.1) * indicator.severity
  }, 0)
}
```

## Best Practices and Configuration

### Service Configuration

```typescript
interface ApiKeyConfig {
  security: {
    keyLength: number;
    hashAlgorithm: string;
    compromiseThreshold: number;
    maxKeysPerUser: number;
    keyExpirationWarningDays: number;
  };
  rateLimit: {
    windowSize: number;
    burstMultiplier: number;
    blockDuration: number;
  };
  analytics: {
    retentionPeriod: number;
    aggregationInterval: number;
    enableGeolocation: boolean;
  };
  features: {
    enableKeyRotation: boolean;
    enableIPWhitelisting: boolean;
    enableUsageAlerts: boolean;
  };
}
```

### Security Best Practices

1. **Key Generation**: Use cryptographically secure random generation
2. **Storage**: Hash keys for storage, never store plain text
3. **Transmission**: Always use HTTPS for key transmission
4. **Monitoring**: Implement comprehensive usage monitoring
5. **Rotation**: Support regular key rotation
6. **Compromise Detection**: Implement automated compromise detection
7. **Rate Limiting**: Enforce strict rate limits per tier

---

**The ApiKeyService provides enterprise-grade API key management with comprehensive security, analytics, and lifecycle management capabilities, forming the backbone of Altus 4's authentication system.**
