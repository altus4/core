/**
 * Search Routes
 *
 * Defines endpoints for executing searches, getting suggestions, and analyzing queries.
 * Uses API key authentication and Zod schemas for request validation.
 * Delegates logic to SearchController.
 *
 * Usage:
 *   - Mount this router at /api/v1/search in the main server
 */
import { SearchController } from '@/controllers/SearchController';
import type { ApiKeyAuthenticatedRequest } from '@/middleware/apiKeyAuth';
import { authenticateApiKey, requirePermission } from '@/middleware/apiKeyAuth';
import { rateLimiter } from '@/middleware/rateLimiter';
import { validateRequest } from '@/middleware/validation';
import type { ApiResponse, SearchRequest, SearchResponse } from '@/types';
import { Router } from 'express';
import { z } from 'zod';

const router = Router();
const searchController = new SearchController();

// Apply rate limiting and authentication to all search routes
router.use(rateLimiter);
router.use(authenticateApiKey);

// Validation schemas for search, suggestions, and query analysis
const searchRequestSchema = z.object({
  query: z.string().min(1, 'Query cannot be empty').max(500, 'Query too long'),
  databases: z.array(z.string()).optional().default([]),
  tables: z.array(z.string()).optional(),
  columns: z.array(z.string()).optional(),
  searchMode: z.enum(['natural', 'boolean', 'semantic']).optional().default('natural'),
  limit: z.number().min(1).max(100).optional().default(20),
  offset: z.number().min(0).optional().default(0),
  includeAnalytics: z.boolean().optional().default(false),
});

const suggestionRequestSchema = z.object({
  query: z.string().min(1).max(100),
  databases: z.array(z.string()).optional(),
  tables: z.array(z.string()).optional(),
});

const analyzeQuerySchema = z.object({
  query: z.string().min(1, 'Query cannot be empty'),
  databases: z.array(z.string()).min(1, 'At least one database required'),
});

/**
 * POST /api/v1/search
 * Execute a search across specified databases
 * Validates request body and delegates to SearchController.executeSearch()
 */
router.post(
  '/',
  requirePermission('search'),
  validateRequest({ body: searchRequestSchema }),
  async (req: ApiKeyAuthenticatedRequest, res) => {
    try {
      const searchRequest: SearchRequest = {
        ...req.body,
        userId: req.user!.id,
      };

      const result = await searchController.executeSearch(searchRequest);

      const response: ApiResponse<SearchResponse> = {
        success: true,
        data: result,
        meta: {
          timestamp: new Date(),
          requestId: req.get('X-Request-ID') || 'unknown',
          version: process.env.npm_package_version || '0.3.0',
          apiKeyTier: req.apiKey?.rateLimitTier,
        },
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'SEARCH_FAILED',
          message: error instanceof Error ? error.message : 'Search execution failed',
        },
      } as ApiResponse);
    }
  }
);

/**
 * GET /api/v1/search/suggestions
 * Get search suggestions based on partial query
 */
router.get(
  '/suggestions',
  requirePermission('search'),
  validateRequest({ query: suggestionRequestSchema }),
  async (req: ApiKeyAuthenticatedRequest, res) => {
    try {
      const suggestions = await searchController.getSearchSuggestions({
        query: req.query.query as string,
        databases: (req.query.databases as string[]) || [],
        tables: (req.query.tables as string[]) || [],
        userId: req.user!.id,
      });

      const response: ApiResponse = {
        success: true,
        data: { suggestions },
        meta: {
          timestamp: new Date(),
          requestId: req.get('X-Request-ID') || 'unknown',
          version: process.env.npm_package_version || '0.3.0',
          apiKeyTier: req.apiKey?.rateLimitTier,
        },
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'SUGGESTIONS_FAILED',
          message: error instanceof Error ? error.message : 'Failed to get suggestions',
        },
      } as ApiResponse);
    }
  }
);

/**
 * POST /api/v1/search/analyze
 * Analyze search performance and get optimization suggestions
 */
router.post(
  '/analyze',
  requirePermission('analytics'),
  validateRequest({ body: analyzeQuerySchema }),
  async (req: ApiKeyAuthenticatedRequest, res) => {
    try {
      const analysis = await searchController.analyzeQuery({
        query: req.body.query,
        databases: req.body.databases,
        userId: req.user!.id,
      });

      const response: ApiResponse = {
        success: true,
        data: analysis,
        meta: {
          timestamp: new Date(),
          requestId: req.get('X-Request-ID') || 'unknown',
          version: process.env.npm_package_version || '0.3.0',
          apiKeyTier: req.apiKey?.rateLimitTier,
        },
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'ANALYSIS_FAILED',
          message: error instanceof Error ? error.message : 'Query analysis failed',
        },
      } as ApiResponse);
    }
  }
);

/**
 * GET /api/v1/search/trends
 * Get search trends and analytics for a user
 */
router.get(
  '/trends',
  requirePermission('analytics'),
  async (req: ApiKeyAuthenticatedRequest, res) => {
    try {
      const trends = await searchController.getUserTrends(req.user!.id);

      const response: ApiResponse = {
        success: true,
        data: trends,
        meta: {
          timestamp: new Date(),
          requestId: req.get('X-Request-ID') || 'unknown',
          version: process.env.npm_package_version || '0.3.0',
          apiKeyTier: req.apiKey?.rateLimitTier,
        },
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'TRENDS_FAILED',
          message: error instanceof Error ? error.message : 'Failed to get trends',
        },
      } as ApiResponse);
    }
  }
);

/**
 * GET /api/v1/search/history
 * Get user's search history
 */
router.get(
  '/history',
  requirePermission('search'),
  async (req: ApiKeyAuthenticatedRequest, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      const history = await searchController.getSearchHistory(req.user!.id, limit, offset);

      const response: ApiResponse = {
        success: true,
        data: history,
        meta: {
          timestamp: new Date(),
          requestId: req.get('X-Request-ID') || 'unknown',
          version: process.env.npm_package_version || '0.3.0',
          apiKeyTier: req.apiKey?.rateLimitTier,
        },
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'HISTORY_FAILED',
          message: error instanceof Error ? error.message : 'Failed to get search history',
        },
      } as ApiResponse);
    }
  }
);

export { router as searchRoutes };
