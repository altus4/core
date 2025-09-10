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
import { logger } from '@/utils/logger';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';

// Load environment variables from .env file
dotenv.config();

export function createApp(): express.Application {
  const app = express();

  // Security middleware
  app.use(helmet());

  // Enhanced CORS configuration for local development and production
  const corsOptions = {
    origin: [
      'http://localhost:5173', // Vite dev server (default)
      'http://localhost:5174', // Vite dev server (default)
      'http://localhost:3000', // React dev server / Next.js
      'http://localhost:3001', // Alternative dev port
      'http://localhost:4173', // Vite preview server
      'http://localhost:8080', // Vue CLI dev server
      'http://localhost:5173', // Vite dev server (default)
      'http://127.0.0.1:5174', // Localhost alias for Vite
      'http://127.0.0.1:3000', // Localhost alias for React/Next.js
      ...(process.env.ALLOWED_ORIGINS?.split(',').filter(Boolean) || []), // Additional origins from env
    ],
    credentials: true, // Allow cookies/auth headers
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'Cache-Control',
      'X-Request-ID',
    ],
    exposedHeaders: ['X-Request-ID', 'X-RateLimit-Remaining'],
    optionsSuccessStatus: 200, // Some legacy browsers (IE11, various SmartTVs) choke on 204
    preflightContinue: false,
  };

  app.use(cors(corsOptions));

  // CORS debugging middleware (only in development)
  if (config.environment === 'development') {
    app.use((req, res, next) => {
      const origin = req.get('Origin');
      if (origin && req.method === 'OPTIONS') {
        logger.debug(`CORS preflight from origin: ${origin}`);
      }
      next();
    });
  }

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

  // API routes
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
