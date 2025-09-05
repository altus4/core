/**
 * Database Routes
 *
 * Defines endpoints for managing user database connections, schemas, and metadata.
 * Uses Zod schemas for request validation and delegates logic to DatabaseController.
 *
 * Usage:
 *   - Mount this router at /api/v1/databases in the main server
 */
import { DatabaseController } from '@/controllers/DatabaseController';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { authenticate } from '@/middleware/auth';
import { validateRequest } from '@/middleware/validation';
import type { ApiResponse, DatabaseConnection, TableSchema } from '@/types';
import { Router } from 'express';
import { z } from 'zod';

const router = Router();
const databaseController = new DatabaseController();

// Validation schemas for adding and updating database connections
const addConnectionSchema = z.object({
  name: z.string().min(1, 'Connection name is required').max(255),
  host: z.string().min(1, 'Host is required'),
  port: z.number().min(1).max(65535).default(3306),
  database: z.string().min(1, 'Database name is required'),
  username: z.string().min(1, 'Username is required'),
  password: z.string(), // Allow empty passwords for local development
  ssl: z.boolean().default(false),
});

const updateConnectionSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  host: z.string().min(1).optional(),
  port: z.number().min(1).max(65535).optional(),
  database: z.string().min(1).optional(),
  username: z.string().min(1).optional(),
  password: z.string().optional(), // Allow empty passwords for local development
  ssl: z.boolean().optional(),
});

/**
 * GET /api/v1/databases
 * Get all user's database connections
 * Requires authentication and delegates to DatabaseController.getUserConnections()
 */
router.get('/', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const connections = await databaseController.getUserConnections(req.user!.id);

    const response: ApiResponse<DatabaseConnection[]> = {
      success: true,
      data: connections,
      meta: {
        timestamp: new Date(),
        requestId: req.get('X-Request-ID') || 'unknown',
        version: '0.1.0',
      },
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_RETRIEVAL_FAILED',
        message: error instanceof Error ? error.message : 'Failed to retrieve database connections',
      },
    } as ApiResponse);
  }
});

/**
 * POST /api/v1/databases
 * Add a new database connection
 */
router.post(
  '/',
  authenticate,
  validateRequest({ body: addConnectionSchema }),
  async (req: AuthenticatedRequest, res) => {
    try {
      const connection = await databaseController.addConnection(req.user!.id, req.body);

      const response: ApiResponse<DatabaseConnection> = {
        success: true,
        data: connection,
        meta: {
          timestamp: new Date(),
          requestId: req.get('X-Request-ID') || 'unknown',
          version: '0.1.0',
        },
      };

      res.status(201).json(response);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'DATABASE_CONNECTION_FAILED',
          message: error instanceof Error ? error.message : 'Failed to add database connection',
        },
      } as ApiResponse);
    }
  }
);

/**
 * GET /api/v1/databases/:connectionId
 * Get a specific database connection
 */
router.get('/:connectionId', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const connection = await databaseController.getConnection(
      req.user!.id,
      req.params.connectionId
    );

    if (!connection) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CONNECTION_NOT_FOUND',
          message: 'Database connection not found',
        },
      } as ApiResponse);
    }

    const response: ApiResponse<DatabaseConnection> = {
      success: true,
      data: connection,
      meta: {
        timestamp: new Date(),
        requestId: req.get('X-Request-ID') || 'unknown',
        version: '0.1.0',
      },
    };

    return res.json(response);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: {
        code: 'CONNECTION_RETRIEVAL_FAILED',
        message: error instanceof Error ? error.message : 'Failed to retrieve connection',
      },
    } as ApiResponse);
  }
});

/**
 * PUT /api/v1/databases/:connectionId
 * Update a database connection
 */
router.put(
  '/:connectionId',
  authenticate,
  validateRequest({ body: updateConnectionSchema }),
  async (req: AuthenticatedRequest, res) => {
    try {
      const connection = await databaseController.updateConnection(
        req.user!.id,
        req.params.connectionId,
        req.body
      );

      if (!connection) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'CONNECTION_NOT_FOUND',
            message: 'Database connection not found',
          },
        } as ApiResponse);
      }

      const response: ApiResponse<DatabaseConnection> = {
        success: true,
        data: connection,
        meta: {
          timestamp: new Date(),
          requestId: req.get('X-Request-ID') || 'unknown',
          version: '0.1.0',
        },
      };

      return res.json(response);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CONNECTION_UPDATE_FAILED',
          message: error instanceof Error ? error.message : 'Failed to update connection',
        },
      } as ApiResponse);
    }
  }
);

/**
 * DELETE /api/v1/databases/:connectionId
 * Remove a database connection
 */
router.delete('/:connectionId', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const success = await databaseController.removeConnection(
      req.user!.id,
      req.params.connectionId
    );

    if (!success) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CONNECTION_NOT_FOUND',
          message: 'Database connection not found',
        },
      } as ApiResponse);
    }

    const response: ApiResponse<{ success: boolean }> = {
      success: true,
      data: { success: true },
      meta: {
        timestamp: new Date(),
        requestId: req.get('X-Request-ID') || 'unknown',
        version: '0.1.0',
      },
    };

    return res.json(response);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: {
        code: 'CONNECTION_REMOVAL_FAILED',
        message: error instanceof Error ? error.message : 'Failed to remove connection',
      },
    } as ApiResponse);
  }
});

/**
 * POST /api/v1/databases/:connectionId/test
 * Test database connection
 */
router.post('/:connectionId/test', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await databaseController.testConnection(req.user!.id, req.params.connectionId);

    const response: ApiResponse<{ connected: boolean; message?: string }> = {
      success: true,
      data: result,
      meta: {
        timestamp: new Date(),
        requestId: req.get('X-Request-ID') || 'unknown',
        version: '0.1.0',
      },
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'CONNECTION_TEST_FAILED',
        message: error instanceof Error ? error.message : 'Connection test failed',
      },
    } as ApiResponse);
  }
});

/**
 * GET /api/v1/databases/:connectionId/schema
 * Get database schema information
 */
router.get('/:connectionId/schema', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const schemas = await databaseController.discoverSchema(req.user!.id, req.params.connectionId);

    const response: ApiResponse<TableSchema[]> = {
      success: true,
      data: schemas,
      meta: {
        timestamp: new Date(),
        requestId: req.get('X-Request-ID') || 'unknown',
        version: '0.1.0',
      },
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SCHEMA_DISCOVERY_FAILED',
        message: error instanceof Error ? error.message : 'Failed to discover schema',
      },
    } as ApiResponse);
  }
});

/**
 * GET /api/v1/databases/status
 * Get status of all database connections
 */
router.get('/status', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const statuses = await databaseController.getConnectionStatuses(req.user!.id);

    const response: ApiResponse<Record<string, boolean>> = {
      success: true,
      data: statuses,
      meta: {
        timestamp: new Date(),
        requestId: req.get('X-Request-ID') || 'unknown',
        version: '0.1.0',
      },
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'STATUS_CHECK_FAILED',
        message: error instanceof Error ? error.message : 'Failed to check connection statuses',
      },
    } as ApiResponse);
  }
});

export { router as databaseRoutes };
