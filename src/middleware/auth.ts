/**
 * Authentication Middleware
 *
 * Provides Express middleware for JWT authentication and role-based access control.
 * Adds user information to the request object if authentication succeeds.
 *
 * Usage:
 *   - Use authenticate to protect routes and extract user info from JWT
 *   - Use requireRole to restrict access based on user role
 */
import { config } from '@/config';
import type { ApiResponse } from '@/types';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

/**
 * Extends Express Request to include authenticated user info.
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role: 'admin' | 'user';
  };
}

/**
 * Middleware to authenticate requests using JWT.
 * Adds user info to req.user if token is valid.
 * Responds with 401 if token is missing or invalid.
 */
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    // Check if authorization header exists
    if (!authHeader) {
      res.status(401).json({
        success: false,
        error: {
          code: 'NO_TOKEN',
          message: 'Authorization header missing',
        },
      } as ApiResponse);
      return;
    }

    // Normalize and check header format - handle case insensitive and whitespace
    const normalizedHeader = authHeader.trim();
    const bearerMatch = normalizedHeader.match(/^bearer\s*(.*)$/i);

    if (!bearerMatch) {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_AUTH_FORMAT',
          message: 'Authorization header must be in format: Bearer <token>',
        },
      } as ApiResponse);
      return;
    }

    const token = bearerMatch[1].trim();

    // Check if token is empty
    if (!token) {
      res.status(401).json({
        success: false,
        error: {
          code: 'NO_TOKEN',
          message: 'Token is missing from authorization header',
        },
      } as ApiResponse);
      return;
    }

    const decoded = jwt.verify(token, config.jwtSecret) as any;

    // Support both `id` and `userId` payload keys to be robust across tests
    req.user = {
      id: decoded.id ?? decoded.userId,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role,
    };

    next();
  } catch (error: any) {
    // Handle JWT specific errors
    let errorCode = 'INVALID_TOKEN';
    let errorMessage = 'Invalid or expired token';

    if (error.name === 'TokenExpiredError') {
      errorCode = 'TOKEN_EXPIRED';
      errorMessage = 'Token has expired';
    } else if (error.name === 'JsonWebTokenError') {
      errorCode = 'INVALID_TOKEN';
      errorMessage = 'Invalid token format or signature';
    }

    res.status(401).json({
      success: false,
      error: {
        code: errorCode,
        message: errorMessage,
      },
    } as ApiResponse);
  }
};

/**
 * Middleware to require a specific user role for access.
 * Responds with 401 if user is not authenticated or role does not match.
 *
 * @param role - Required user role ('admin' or 'user')
 */
export const requireRole = (role: 'admin' | 'user') => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
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

    if (req.user.role !== role && req.user.role !== 'admin') {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `${role} role required`,
        },
      } as ApiResponse);
      return;
    }

    next();
  };
};
