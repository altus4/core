/**
 * Rate Limiting Middleware
 *
 * Provides Express middleware for request rate limiting using Redis and rate-limiter-flexible.
 * Configures different rate limiters for general, authentication, and API key-based endpoints.
 * Supports tiered rate limiting based on API key subscription levels.
 *
 * Usage:
 *   - Use rateLimiter to protect endpoints from abuse and excessive requests
 *   - Automatically applies appropriate limits based on API key tier
 */
import { config } from '@/config';
import type { ApiResponse } from '@/types';
import { logger } from '@/utils/logger';
import type { NextFunction, Response } from 'express';
import Redis from 'ioredis';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import type { ApiKeyAuthenticatedRequest } from './apiKeyAuth';

// Create Redis client for rate limiting
const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  lazyConnect: true,
});

// Redis connection event handlers for logging
redis.on('error', error => {
  logger.error('Rate limiter Redis error:', error);
});

redis.on('connect', () => {
  logger.info('Rate limiter Redis connected');
});

// General rate limiter instance - DISABLED FOR TESTING
const rateLimiterInstance = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'altus4_rl',
  points: 10000, // Very high limit for testing
  duration: 1, // 1 second window
  blockDuration: 1, // Block for 1 second only
});

// More strict rate limiter for authentication endpoints - DISABLED FOR TESTING
const authRateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'altus4_auth_rl',
  points: 10000, // Very high limit for testing
  duration: 1, // 1 second window
  blockDuration: 1, // Block for 1 second only
});

// API key-based rate limiters for different tiers
const freeApiKeyLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'altus4_api_free',
  points: 1000, // 1000 requests per hour
  duration: 3600, // Per hour
  blockDuration: 300, // Block for 5 minutes
});

const proApiKeyLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'altus4_api_pro',
  points: 10000, // 10,000 requests per hour
  duration: 3600, // Per hour
  blockDuration: 300, // Block for 5 minutes
});

const enterpriseApiKeyLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'altus4_api_enterprise',
  points: 100000, // 100,000 requests per hour
  duration: 3600, // Per hour
  blockDuration: 60, // Block for 1 minute only
});

// Legacy search rate limiter (kept for backward compatibility)
const searchRateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'altus4_search_rl',
  points: 1000, // 1000 searches
  duration: 3600, // Per hour
  blockDuration: 300, // Block for 5 minutes
});

/**
 * Get rate limiter based on API key tier
 */
const getRateLimiterForTier = (tier: string): RateLimiterRedis => {
  switch (tier) {
    case 'pro':
      return proApiKeyLimiter;
    case 'enterprise':
      return enterpriseApiKeyLimiter;
    case 'free':
    default:
      return freeApiKeyLimiter;
  }
};

/**
 * Get rate limit values for a tier
 */
const getRateLimitValues = (tier: string) => {
  switch (tier) {
    case 'pro':
      return { limit: 10000, name: 'Pro' };
    case 'enterprise':
      return { limit: 100000, name: 'Enterprise' };
    case 'free':
    default:
      return { limit: 1000, name: 'Free' };
  }
};

/**
 * Middleware to apply rate limiting based on API key tier or fallback to IP.
 * Responds with 429 if rate limit is exceeded.
 */
export const rateLimiter = async (
  req: ApiKeyAuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let currentLimiter: RateLimiterRedis;
    let key: string;
    let limitInfo: { limit: number; name: string };

    // Choose appropriate rate limiter and key
    if (req.path.includes('/auth/')) {
      // Use strict auth rate limiter for authentication endpoints
      currentLimiter = authRateLimiter;
      key = req.ip || 'unknown';
      limitInfo = { limit: 5, name: 'Auth' };
    } else if (req.apiKey) {
      // Use API key-based rate limiting for authenticated requests
      currentLimiter = getRateLimiterForTier(req.apiKey.rateLimitTier);
      key = req.apiKey.id; // Use API key ID as the key
      limitInfo = getRateLimitValues(req.apiKey.rateLimitTier);
    } else {
      // Fallback to IP-based rate limiting for unauthenticated requests
      currentLimiter = rateLimiterInstance;
      key = req.ip || 'unknown';
      limitInfo = { limit: config.rateLimit.maxRequests, name: 'General' };
    }

    // Apply rate limiting
    const rateLimiterRes = await currentLimiter.consume(key);

    // Set rate limit headers for successful requests
    res.set({
      'X-RateLimit-Limit': limitInfo.limit.toString(),
      'X-RateLimit-Remaining': Math.max(0, rateLimiterRes.remainingPoints || 0).toString(),
      'X-RateLimit-Reset': new Date(
        Date.now() + (rateLimiterRes.msBeforeNext || 3600000)
      ).toISOString(),
      'X-RateLimit-Tier': limitInfo.name,
    });

    next();
  } catch (rateLimiterRes: any) {
    const remainingPoints = rateLimiterRes?.remainingPoints || 0;
    const msBeforeNext = rateLimiterRes?.msBeforeNext || 3600000;
    const totalHits = rateLimiterRes?.totalHits || 0;

    // Determine the current limit based on context
    let currentLimit = config.rateLimit.maxRequests;
    let tierName = 'General';

    if (req.path.includes('/auth/')) {
      currentLimit = 5;
      tierName = 'Auth';
    } else if (req.apiKey) {
      const limitInfo = getRateLimitValues(req.apiKey.rateLimitTier);
      currentLimit = limitInfo.limit;
      tierName = limitInfo.name;
    }

    // Set rate limit headers
    res.set({
      'Retry-After': Math.round(msBeforeNext / 1000) || 1,
      'X-RateLimit-Limit': currentLimit.toString(),
      'X-RateLimit-Remaining': Math.max(0, remainingPoints).toString(),
      'X-RateLimit-Reset': new Date(Date.now() + msBeforeNext).toISOString(),
      'X-RateLimit-Tier': tierName,
    });

    logger.warn('Rate limit exceeded:', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      userId: req.user?.id,
      apiKeyId: req.apiKey?.id,
      apiKeyTier: req.apiKey?.rateLimitTier,
      remainingPoints,
      totalHits,
      msBeforeNext,
      userAgent: req.get('User-Agent'),
    });

    const response: ApiResponse = {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later',
        details: {
          retryAfter: Math.round(msBeforeNext / 1000),
          limit: currentLimit,
          remaining: Math.max(0, remainingPoints),
          tier: tierName,
          ...(req.apiKey?.rateLimitTier === 'free' && {
            upgradeMessage: 'Upgrade to Pro or Enterprise for higher rate limits',
          }),
        },
      },
      meta: {
        timestamp: new Date(),
        requestId: req.get('X-Request-ID') || 'unknown',
        version: process.env.npm_package_version || '0.3.0',
      },
    };

    res.status(429).json(response);
  }
};

// Export the rate limiter instances for testing and direct use
export {
  authRateLimiter,
  enterpriseApiKeyLimiter,
  freeApiKeyLimiter,
  getRateLimiterForTier,
  getRateLimitValues,
  proApiKeyLimiter,
  rateLimiterInstance,
  searchRateLimiter,
};

// Graceful shutdown
process.on('SIGINT', async () => {
  try {
    await redis.quit();
    logger.info('Rate limiter Redis connection closed');
  } catch (error) {
    logger.error('Error closing rate limiter Redis connection:', error);
  }
});

process.on('SIGTERM', async () => {
  try {
    await redis.quit();
    logger.info('Rate limiter Redis connection closed');
  } catch (error) {
    logger.error('Error closing rate limiter Redis connection:', error);
  }
});
