/**
 * Application Factory
 *
 * Creates and configures the Express application instance with middleware, routes, and error handling.
 * Sets up security, logging, CORS, rate limiting, and API endpoints for Altus4.
 * Provides a factory function to create the app for both server and testing.
 *
 * Usage:
 *   - Call createApp() to get a configured Express application
 *   - Mount API routes under /api/v1 with proper middleware
 *   - Includes health check endpoint for monitoring
 */
import { config } from '@/config';
import { errorHandler } from '@/middleware/errorHandler';
import { rateLimiter } from '@/middleware/rateLimiter';
import { requestLogger } from '@/middleware/requestLogger';
import { analyticsRoutes } from '@/routes/analytics';
import apiKeyRoutes from '@/routes/apiKeys';
import { authRoutes } from '@/routes/auth';
import { databaseRoutes } from '@/routes/database';
import managementRoutes from '@/routes/management';
import { searchRoutes } from '@/routes/search';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';

// Load environment variables from .env file
dotenv.config();

/**
 * Creates and configures an Express application with all necessary middleware, routes, and error handling.
 * Sets up security headers, CORS, rate limiting, request logging, and API endpoints.
 *
 * @returns Express application instance ready to start serving requests
 */
export function createApp(): express.Application {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(
    cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true,
    })
  );

  // Request parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Logging and rate limiting (skip in tests for speed/noise)
  if (process.env.NODE_ENV !== 'test') {
    app.use(requestLogger);
    app.use(rateLimiter);
  }

  // Health check endpoint for monitoring
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
      uptime: process.uptime(),
      env: config.environment,
    });
  });

  // API routes - organize all v1 endpoints under /api/v1
  const apiV1 = express.Router();
  apiV1.use('/auth', authRoutes);
  apiV1.use('/search', searchRoutes);
  apiV1.use('/databases', databaseRoutes);
  apiV1.use('/analytics', analyticsRoutes);
  apiV1.use('/keys', apiKeyRoutes);
  apiV1.use('/management', managementRoutes);
  app.use('/api/v1', apiV1);

  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Endpoint not found',
      },
    });
  });

  // Error handler
  app.use(errorHandler);

  return app;
}
