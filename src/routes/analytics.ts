/**
 * Analytics Routes
 *
 * Defines endpoints for retrieving user analytics, search trends, and insights.
 * Uses Zod schemas for request validation and delegates logic to AnalyticsController.
 *
 * Usage:
 *   - Mount this router at /api/v1/analytics in the main server
 */
import { AnalyticsController } from '@/controllers/AnalyticsController';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { authenticate, requireRole } from '@/middleware/auth';
import { validateRequest } from '@/middleware/validation';
import type { ApiResponse } from '@/types';
import { Router } from 'express';
import { z } from 'zod';

const router = Router();
const analyticsController = new AnalyticsController();

// Validation schemas for time range and analytics queries
const timeRangeSchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')
    .optional(),
  period: z.enum(['day', 'week', 'month', '3months', '6months', 'year']).default('week'),
});

const searchAnalyticsQuerySchema = z.object({
  ...timeRangeSchema.shape,
  // Coerce query string numbers to numeric types for GET endpoints
  limit: z.coerce.number().min(1).max(1000).default(100),
  offset: z.coerce.number().min(0).default(0),
});

/**
 * GET /api/v1/analytics/search-trends
 * Get user's search trends and insights
 * Validates query params and delegates to AnalyticsController.getSearchTrends()
 */
router.get(
  '/search-trends',
  authenticate,
  validateRequest({ query: timeRangeSchema }),
  async (req: AuthenticatedRequest, res) => {
    try {
      const trends = await analyticsController.getSearchTrends(req.user!.id, req.query as any);

      const response: ApiResponse = {
        success: true,
        data: trends,
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
          code: 'TRENDS_RETRIEVAL_FAILED',
          message: error instanceof Error ? error.message : 'Failed to retrieve search trends',
        },
      } as ApiResponse);
    }
  }
);

/**
 * GET /api/v1/analytics/performance
 * Get search performance metrics
 */
router.get(
  '/performance',
  authenticate,
  validateRequest({ query: timeRangeSchema }),
  async (req: AuthenticatedRequest, res) => {
    try {
      const performance = await analyticsController.getPerformanceMetrics(
        req.user!.id,
        req.query as any
      );

      const response: ApiResponse = {
        success: true,
        data: performance,
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
          code: 'PERFORMANCE_RETRIEVAL_FAILED',
          message:
            error instanceof Error ? error.message : 'Failed to retrieve performance metrics',
        },
      } as ApiResponse);
    }
  }
);

/**
 * GET /api/v1/analytics/popular-queries
 * Get most popular search queries
 */
router.get(
  '/popular-queries',
  authenticate,
  validateRequest({ query: timeRangeSchema }),
  async (req: AuthenticatedRequest, res) => {
    try {
      const queries = await analyticsController.getPopularQueries(req.user!.id, req.query as any);

      const response: ApiResponse = {
        success: true,
        data: queries,
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
          code: 'POPULAR_QUERIES_RETRIEVAL_FAILED',
          message: error instanceof Error ? error.message : 'Failed to retrieve popular queries',
        },
      } as ApiResponse);
    }
  }
);

/**
 * GET /api/v1/analytics/search-history
 * Get detailed search history
 */
router.get(
  '/search-history',
  authenticate,
  validateRequest({ query: searchAnalyticsQuerySchema }),
  async (req: AuthenticatedRequest, res) => {
    try {
      const history = await analyticsController.getSearchHistory(req.user!.id, req.query as any);

      const response: ApiResponse = {
        success: true,
        data: history,
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
          code: 'HISTORY_RETRIEVAL_FAILED',
          message: error instanceof Error ? error.message : 'Failed to retrieve search history',
        },
      } as ApiResponse);
    }
  }
);

/**
 * GET /api/v1/analytics/insights
 * Get AI-powered insights and recommendations
 */
router.get(
  '/insights',
  authenticate,
  validateRequest({ query: timeRangeSchema }),
  async (req: AuthenticatedRequest, res) => {
    try {
      const insights = await analyticsController.getInsights(req.user!.id, req.query as any);

      const response: ApiResponse = {
        success: true,
        data: insights,
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
          code: 'INSIGHTS_RETRIEVAL_FAILED',
          message: error instanceof Error ? error.message : 'Failed to retrieve insights',
        },
      } as ApiResponse);
    }
  }
);

/**
 * GET /api/v1/analytics/dashboard
 * Get comprehensive dashboard data
 */
router.get(
  '/dashboard',
  authenticate,
  validateRequest({ query: timeRangeSchema }),
  async (req: AuthenticatedRequest, res) => {
    try {
      const dashboard = await analyticsController.getDashboardData(req.user!.id, req.query as any);

      const response: ApiResponse = {
        success: true,
        data: dashboard,
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
          code: 'DASHBOARD_RETRIEVAL_FAILED',
          message: error instanceof Error ? error.message : 'Failed to retrieve dashboard data',
        },
      } as ApiResponse);
    }
  }
);

/**
 * Admin-only analytics endpoints
 */

/**
 * GET /api/v1/analytics/admin/system-overview
 * Get system-wide analytics (admin only)
 */
router.get(
  '/admin/system-overview',
  authenticate,
  requireRole('admin'),
  validateRequest({ query: timeRangeSchema }),
  async (req: AuthenticatedRequest, res) => {
    try {
      const overview = await analyticsController.getSystemOverview(req.query as any);

      const response: ApiResponse = {
        success: true,
        data: overview,
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
          code: 'SYSTEM_OVERVIEW_FAILED',
          message: error instanceof Error ? error.message : 'Failed to retrieve system overview',
        },
      } as ApiResponse);
    }
  }
);

/**
 * GET /api/v1/analytics/admin/user-activity
 * Get user activity analytics (admin only)
 */
router.get(
  '/admin/user-activity',
  authenticate,
  requireRole('admin'),
  validateRequest({ query: searchAnalyticsQuerySchema }),
  async (req: AuthenticatedRequest, res) => {
    try {
      const activity = await analyticsController.getUserActivity(req.query as any);

      const response: ApiResponse = {
        success: true,
        data: activity,
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
          code: 'USER_ACTIVITY_FAILED',
          message: error instanceof Error ? error.message : 'Failed to retrieve user activity',
        },
      } as ApiResponse);
    }
  }
);

/**
 * GET /api/v1/analytics/admin/performance-metrics
 * Get system performance metrics (admin only)
 */
router.get(
  '/admin/performance-metrics',
  authenticate,
  requireRole('admin'),
  validateRequest({ query: timeRangeSchema }),
  async (req: AuthenticatedRequest, res) => {
    try {
      const metrics = await analyticsController.getSystemPerformanceMetrics(req.query as any);

      const response: ApiResponse = {
        success: true,
        data: metrics,
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
          code: 'SYSTEM_PERFORMANCE_FAILED',
          message:
            error instanceof Error
              ? error.message
              : 'Failed to retrieve system performance metrics',
        },
      } as ApiResponse);
    }
  }
);

export { router as analyticsRoutes };
