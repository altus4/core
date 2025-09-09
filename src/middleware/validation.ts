/**
 * Request Validation Middleware
 *
 * Provides Express middleware for validating request body, query, and params using Zod schemas.
 * Responds with 400 and detailed error information if validation fails.
 *
 * Usage:
 *   - Use validateRequest to validate incoming requests for endpoints
 */
import type { ApiResponse } from '@/types';
import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';
import { ZodError } from 'zod';

/**
 * Middleware to validate request body, query, and params using Zod schemas.
 * Responds with 400 and error details if validation fails.
 */
export const validateRequest = (schema: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (schema.body) {
        req.body = schema.body.parse(req.body);
      }
      if (schema.query) {
        req.query = schema.query.parse(req.query);
      }
      if (schema.params) {
        req.params = schema.params.parse(req.params);
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors.map(err => ({
              field: err.path.join('.'),
              message: err.message,
              code: err.code,
            })),
          },
          meta: {
            timestamp: new Date(),
            requestId: req.get('X-Request-ID') || 'unknown',
            version: process.env.npm_package_version || '0.3.0',
          },
        };
        res.status(400).json(response);
      } else {
        next(error);
      }
    }
  };
};
