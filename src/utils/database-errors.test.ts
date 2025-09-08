/**
 * Tests for Database Error Utilities
 *
 * Tests the createDatabaseError function and DatabaseError class to ensure
 * proper error parsing, helpful suggestions, and secure handling of sensitive data.
 */

import {
  createDatabaseError,
  DatabaseError,
  DatabaseErrorCode,
  sanitizeErrorForLogging,
} from './database-errors';

describe('Database Error Utilities', () => {
  describe('DatabaseError class', () => {
    it('should create DatabaseError with all properties', () => {
      const error = new DatabaseError(
        DatabaseErrorCode.CONNECTION_REFUSED,
        'Test error message',
        new Error('Original error'),
        ['suggestion 1', 'suggestion 2'],
        true,
        502
      );

      expect(error.code).toBe(DatabaseErrorCode.CONNECTION_REFUSED);
      expect(error.message).toBe('Test error message');
      expect(error.suggestions).toEqual(['suggestion 1', 'suggestion 2']);
      expect(error.isRetryable).toBe(true);
      expect(error.statusCode).toBe(502);
      expect(error.originalError?.message).toBe('Original error');
      expect(error.name).toBe('DatabaseError');
      expect(error.isOperational).toBe(true);
    });

    it('should create DatabaseError with default values', () => {
      const error = new DatabaseError(DatabaseErrorCode.UNKNOWN, 'Test error');

      expect(error.code).toBe(DatabaseErrorCode.UNKNOWN);
      expect(error.message).toBe('Test error');
      expect(error.suggestions).toEqual([]);
      expect(error.isRetryable).toBe(false);
      expect(error.statusCode).toBe(500);
      expect(error.originalError).toBeUndefined();
    });
  });

  describe('createDatabaseError function', () => {
    describe('connection refused errors', () => {
      it('should handle ECONNREFUSED error', () => {
        const originalError = {
          code: 'ECONNREFUSED',
          message: 'connect ECONNREFUSED 127.0.0.1:3306',
        };

        const dbError = createDatabaseError(originalError);

        expect(dbError.code).toBe(DatabaseErrorCode.CONNECTION_REFUSED);
        expect(dbError.message).toBe('Unable to connect to the database server');
        expect(dbError.isRetryable).toBe(true);
        expect(dbError.statusCode).toBe(502);
        expect(dbError.suggestions).toEqual([
          'Verify the database server is running',
          'Check the host and port configuration',
          'Ensure firewall allows connections on the specified port',
          'Verify network connectivity between services',
        ]);
      });
    });

    describe('host not found errors', () => {
      it('should handle ENOTFOUND error', () => {
        const originalError = {
          code: 'ENOTFOUND',
          hostname: 'invalid-host.example.com',
          message: 'getaddrinfo ENOTFOUND invalid-host.example.com',
        };

        const dbError = createDatabaseError(originalError);

        expect(dbError.code).toBe(DatabaseErrorCode.HOST_NOT_FOUND);
        expect(dbError.message).toBe(
          'Database host could not be resolved: invalid-host.example.com'
        );
        expect(dbError.isRetryable).toBe(false);
        expect(dbError.statusCode).toBe(404);
        expect(dbError.suggestions).toContain('Check the hostname spelling in your configuration');
      });

      it('should handle EAI_NONAME error', () => {
        const originalError = {
          code: 'EAI_NONAME',
          message: 'getaddrinfo EAI_NONAME unknown-host',
        };

        const dbError = createDatabaseError(originalError);

        expect(dbError.code).toBe(DatabaseErrorCode.HOST_NOT_FOUND);
        expect(dbError.message).toBe('Database host could not be resolved: unknown');
        expect(dbError.isRetryable).toBe(false);
        expect(dbError.statusCode).toBe(404);
      });
    });

    describe('authentication errors', () => {
      it('should handle ER_ACCESS_DENIED_ERROR', () => {
        const originalError = {
          code: 'ER_ACCESS_DENIED_ERROR',
          errno: 1045,
          message: "Access denied for user 'testuser'@'localhost' (using password: YES)",
        };

        const dbError = createDatabaseError(originalError);

        expect(dbError.code).toBe(DatabaseErrorCode.AUTHENTICATION_FAILED);
        expect(dbError.message).toBe('Database authentication failed');
        expect(dbError.isRetryable).toBe(false);
        expect(dbError.statusCode).toBe(401);
        expect(dbError.suggestions).toEqual([
          'Verify the username and password are correct',
          'Check if the user has permission to connect from this host',
          'Ensure the user account is not locked or expired',
          'Try connecting with a database client to test credentials',
        ]);
      });

      it('should handle authentication error by errno', () => {
        const originalError = {
          errno: 1045,
          message: 'Access denied for user',
        };

        const dbError = createDatabaseError(originalError);

        expect(dbError.code).toBe(DatabaseErrorCode.AUTHENTICATION_FAILED);
        expect(dbError.statusCode).toBe(401);
      });

      it('should handle ER_ACCESS_DENIED_NO_PASSWORD_ERROR', () => {
        const originalError = {
          code: 'ER_ACCESS_DENIED_NO_PASSWORD_ERROR',
          errno: 1698,
          message: "Access denied for user 'root'@'localhost'",
        };

        const dbError = createDatabaseError(originalError);

        expect(dbError.code).toBe(DatabaseErrorCode.AUTHENTICATION_FAILED);
        expect(dbError.message).toBe('Database connection requires a password');
        expect(dbError.suggestions).toContain('Provide a password for the database user');
      });
    });

    describe('database not found errors', () => {
      it('should handle ER_BAD_DB_ERROR', () => {
        const originalError = {
          code: 'ER_BAD_DB_ERROR',
          errno: 1049,
          database: 'nonexistent_db',
          message: "Unknown database 'nonexistent_db'",
        };

        const dbError = createDatabaseError(originalError);

        expect(dbError.code).toBe(DatabaseErrorCode.DATABASE_NOT_FOUND);
        expect(dbError.message).toBe('Database does not exist: nonexistent_db');
        expect(dbError.isRetryable).toBe(false);
        expect(dbError.statusCode).toBe(404);
        expect(dbError.suggestions).toContain('Verify the database name spelling');
      });

      it('should handle database not found by errno', () => {
        const originalError = {
          errno: 1049,
          message: 'Unknown database',
        };

        const dbError = createDatabaseError(originalError);

        expect(dbError.code).toBe(DatabaseErrorCode.DATABASE_NOT_FOUND);
        expect(dbError.message).toBe('Database does not exist: unknown');
      });
    });

    describe('timeout errors', () => {
      it('should handle ETIMEDOUT error', () => {
        const originalError = {
          code: 'ETIMEDOUT',
          message: 'connect ETIMEDOUT 192.168.1.100:3306',
        };

        const dbError = createDatabaseError(originalError);

        expect(dbError.code).toBe(DatabaseErrorCode.TIMEOUT);
        expect(dbError.message).toBe('Connection to database timed out');
        expect(dbError.isRetryable).toBe(true);
        expect(dbError.statusCode).toBe(408);
        expect(dbError.suggestions).toContain('Check network latency to the database server');
      });

      it('should handle timeout in error message', () => {
        const originalError = {
          message: 'Connection timeout after 30000ms',
        };

        const dbError = createDatabaseError(originalError);

        expect(dbError.code).toBe(DatabaseErrorCode.TIMEOUT);
        expect(dbError.isRetryable).toBe(true);
      });
    });

    describe('SSL errors', () => {
      it('should handle SSL requirement error', () => {
        const originalError = {
          errno: 3159,
          message:
            'Connections using insecure transport are prohibited while --require_secure_transport=ON',
        };

        const dbError = createDatabaseError(originalError);

        expect(dbError.code).toBe(DatabaseErrorCode.SSL_REQUIRED);
        expect(dbError.message).toBe('SSL connection required but not configured');
        expect(dbError.isRetryable).toBe(false);
        expect(dbError.statusCode).toBe(502);
        expect(dbError.suggestions).toContain('Enable SSL in your database configuration');
      });

      it('should handle SSL in error message', () => {
        const originalError = {
          message: 'SSL connection error',
        };

        const dbError = createDatabaseError(originalError);

        expect(dbError.code).toBe(DatabaseErrorCode.SSL_REQUIRED);
      });
    });

    describe('too many connections errors', () => {
      it('should handle ER_CON_COUNT_ERROR', () => {
        const originalError = {
          code: 'ER_CON_COUNT_ERROR',
          errno: 1040,
          message: 'Too many connections',
        };

        const dbError = createDatabaseError(originalError);

        expect(dbError.code).toBe(DatabaseErrorCode.TOO_MANY_CONNECTIONS);
        expect(dbError.message).toBe('Too many database connections');
        expect(dbError.isRetryable).toBe(true);
        expect(dbError.statusCode).toBe(503);
        expect(dbError.suggestions).toContain('Wait for existing connections to be released');
      });
    });

    describe('permission denied errors', () => {
      it('should handle ER_TABLEACCESS_DENIED_ERROR', () => {
        const originalError = {
          code: 'ER_TABLEACCESS_DENIED_ERROR',
          message: 'SELECT command denied to user',
        };

        const dbError = createDatabaseError(originalError);

        expect(dbError.code).toBe(DatabaseErrorCode.PERMISSION_DENIED);
        expect(dbError.message).toBe('Database operation permission denied');
        expect(dbError.statusCode).toBe(403);
        expect(dbError.suggestions).toContain('Check if the user has required privileges');
      });

      it('should handle ER_COLUMNACCESS_DENIED_ERROR', () => {
        const originalError = {
          code: 'ER_COLUMNACCESS_DENIED_ERROR',
          message: 'SELECT command denied to user',
        };

        const dbError = createDatabaseError(originalError);

        expect(dbError.code).toBe(DatabaseErrorCode.PERMISSION_DENIED);
      });
    });

    describe('unknown errors', () => {
      it('should handle unknown error with message', () => {
        const originalError = {
          message: 'Some unknown database error',
        };

        const dbError = createDatabaseError(originalError);

        expect(dbError.code).toBe(DatabaseErrorCode.UNKNOWN);
        expect(dbError.message).toBe('Database error: Some unknown database error');
        expect(dbError.isRetryable).toBe(false);
        expect(dbError.statusCode).toBe(500);
        expect(dbError.suggestions).toContain('Check the database server logs for more details');
      });

      it('should handle error without message', () => {
        const originalError = {};

        const dbError = createDatabaseError(originalError);

        expect(dbError.code).toBe(DatabaseErrorCode.UNKNOWN);
        expect(dbError.message).toBe('Database error: Unknown error');
      });

      it('should handle null/undefined error', () => {
        const dbError1 = createDatabaseError(null);
        const dbError2 = createDatabaseError(undefined);

        expect(dbError1.code).toBe(DatabaseErrorCode.UNKNOWN);
        expect(dbError2.code).toBe(DatabaseErrorCode.UNKNOWN);
        expect(dbError1.message).toBe('Database error: Unknown error');
        expect(dbError2.message).toBe('Database error: Unknown error');
      });

      it('should handle error with toString method', () => {
        const originalError = {
          toString: () => 'Custom error string',
        };

        const dbError = createDatabaseError(originalError);

        expect(dbError.message).toBe('Database error: Custom error string');
      });
    });
  });

  describe('sanitizeErrorForLogging function', () => {
    it('should sanitize error data for safe logging', () => {
      const originalError = new Error('Original error with password=secret123');
      const dbError = new DatabaseError(
        DatabaseErrorCode.AUTHENTICATION_FAILED,
        'Test error',
        originalError,
        ['suggestion 1'],
        true,
        401
      );

      const sanitized = sanitizeErrorForLogging(dbError);

      expect(sanitized).toEqual({
        code: DatabaseErrorCode.AUTHENTICATION_FAILED,
        message: 'Test error',
        suggestions: ['suggestion 1'],
        isRetryable: true,
        statusCode: 401,
        originalErrorCode: undefined,
        originalErrorName: 'Error',
      });

      // Ensure original error message is not included
      expect(sanitized).not.toHaveProperty('originalError');
      expect(JSON.stringify(sanitized)).not.toContain('password=secret123');
    });

    it('should handle error without originalError', () => {
      const dbError = new DatabaseError(DatabaseErrorCode.UNKNOWN, 'Test error');

      const sanitized = sanitizeErrorForLogging(dbError);

      expect(sanitized.originalErrorCode).toBeUndefined();
      expect(sanitized.originalErrorName).toBeUndefined();
    });

    it('should never expose sensitive data in logs', () => {
      const originalError = {
        code: 'ER_ACCESS_DENIED_ERROR',
        message: "Access denied for user 'admin'@'localhost' (using password: YES)",
        host: 'secret-server.internal.com',
        user: 'admin',
        password: 'super-secret-password',
      };

      const dbError = createDatabaseError(originalError);
      const sanitized = sanitizeErrorForLogging(dbError);

      const serialized = JSON.stringify(sanitized);

      // Ensure no sensitive data is present
      expect(serialized).not.toContain('super-secret-password');
      expect(serialized).not.toContain('secret-server.internal.com');
      expect(serialized).not.toContain('admin');
      expect(sanitized).not.toHaveProperty('originalError');
    });
  });

  describe('error code coverage', () => {
    it('should have all error codes defined', () => {
      const errorCodes = Object.values(DatabaseErrorCode);

      expect(errorCodes).toContain('CONNECTION_REFUSED');
      expect(errorCodes).toContain('AUTHENTICATION_FAILED');
      expect(errorCodes).toContain('HOST_NOT_FOUND');
      expect(errorCodes).toContain('DATABASE_NOT_FOUND');
      expect(errorCodes).toContain('TIMEOUT');
      expect(errorCodes).toContain('SSL_REQUIRED');
      expect(errorCodes).toContain('POOL_EXHAUSTED');
      expect(errorCodes).toContain('PERMISSION_DENIED');
      expect(errorCodes).toContain('TOO_MANY_CONNECTIONS');
      expect(errorCodes).toContain('UNKNOWN');
    });

    it('should provide suggestions for all error types', () => {
      const testCases = [
        { code: 'ECONNREFUSED' },
        { code: 'ENOTFOUND', hostname: 'test.com' },
        { code: 'ER_ACCESS_DENIED_ERROR', errno: 1045 },
        { code: 'ER_BAD_DB_ERROR', errno: 1049, database: 'test' },
        { code: 'ETIMEDOUT' },
        { errno: 3159 }, // SSL required
        { code: 'ER_CON_COUNT_ERROR', errno: 1040 },
        { code: 'ER_TABLEACCESS_DENIED_ERROR' },
        { message: 'unknown error' },
      ];

      testCases.forEach(testCase => {
        const dbError = createDatabaseError(testCase);
        expect(dbError.suggestions.length).toBeGreaterThan(0);
        expect(dbError.suggestions.every(s => typeof s === 'string' && s.length > 0)).toBe(true);
      });
    });
  });
});
