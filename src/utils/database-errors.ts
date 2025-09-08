/**
 * Database Error Utilities
 *
 * Provides custom error classes and helper functions for database connection failures.
 * Includes specific error codes, user-friendly messages, and actionable suggestions.
 *
 * Usage:
 *   - Use createDatabaseError() to parse MySQL errors into structured DatabaseError instances
 *   - DatabaseError includes error codes, suggestions, and retry information
 */

export enum DatabaseErrorCode {
  CONNECTION_REFUSED = 'CONNECTION_REFUSED',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  HOST_NOT_FOUND = 'HOST_NOT_FOUND',
  DATABASE_NOT_FOUND = 'DATABASE_NOT_FOUND',
  TIMEOUT = 'TIMEOUT',
  SSL_REQUIRED = 'SSL_REQUIRED',
  POOL_EXHAUSTED = 'POOL_EXHAUSTED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  TOO_MANY_CONNECTIONS = 'TOO_MANY_CONNECTIONS',
  UNKNOWN = 'UNKNOWN',
}

export class DatabaseError extends Error {
  public readonly code: DatabaseErrorCode;
  public readonly originalError?: Error;
  public readonly suggestions: string[];
  public readonly isRetryable: boolean;
  public readonly statusCode: number;
  public readonly isOperational: boolean = true;

  constructor(
    code: DatabaseErrorCode,
    message: string,
    originalError?: Error,
    suggestions: string[] = [],
    isRetryable: boolean = false,
    statusCode: number = 500
  ) {
    super(message);
    this.code = code;
    this.originalError = originalError;
    this.suggestions = suggestions;
    this.isRetryable = isRetryable;
    this.statusCode = statusCode;
    this.name = 'DatabaseError';

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Creates a structured DatabaseError from a MySQL error object.
 * Parses common MySQL error codes and provides actionable suggestions.
 *
 * @param error - The original error from MySQL/mysql2
 * @returns DatabaseError with specific code, message, and suggestions
 */
export function createDatabaseError(error: any): DatabaseError {
  let message: string;
  if (!error) {
    message = 'Unknown error';
  } else {
    const { message: errorMessage } = error;
    if (errorMessage) {
      message = errorMessage;
    } else if (typeof error.toString === 'function' && error.toString() !== '[object Object]') {
      message = error.toString();
    } else {
      message = 'Unknown error';
    }
  }

  const { code, errno } = error || {};

  // Connection refused (MySQL server not running)
  if (code === 'ECONNREFUSED') {
    return new DatabaseError(
      DatabaseErrorCode.CONNECTION_REFUSED,
      'Unable to connect to the database server',
      error,
      [
        'Verify the database server is running',
        'Check the host and port configuration',
        'Ensure firewall allows connections on the specified port',
        'Verify network connectivity between services',
      ],
      true,
      502
    );
  }

  // Host not found (DNS/hostname issues)
  if (code === 'ENOTFOUND' || code === 'EAI_NONAME') {
    return new DatabaseError(
      DatabaseErrorCode.HOST_NOT_FOUND,
      `Database host could not be resolved: ${error.hostname || 'unknown'}`,
      error,
      [
        'Check the hostname spelling in your configuration',
        'Verify DNS resolution is working',
        'Try using an IP address instead of hostname',
        'Check if the host requires VPN access',
      ],
      false,
      404
    );
  }

  // Authentication failed
  if (code === 'ER_ACCESS_DENIED_ERROR' || errno === 1045) {
    return new DatabaseError(
      DatabaseErrorCode.AUTHENTICATION_FAILED,
      'Database authentication failed',
      error,
      [
        'Verify the username and password are correct',
        'Check if the user has permission to connect from this host',
        'Ensure the user account is not locked or expired',
        'Try connecting with a database client to test credentials',
      ],
      false,
      401
    );
  }

  // Database not found
  if (code === 'ER_BAD_DB_ERROR' || errno === 1049) {
    return new DatabaseError(
      DatabaseErrorCode.DATABASE_NOT_FOUND,
      `Database does not exist: ${error.database || 'unknown'}`,
      error,
      [
        'Verify the database name spelling',
        'Check if the database has been created',
        'Ensure your user has access to this database',
        'Try connecting without specifying a database first',
      ],
      false,
      404
    );
  }

  // Connection timeout
  if (code === 'ETIMEDOUT' || message.includes('timeout')) {
    return new DatabaseError(
      DatabaseErrorCode.TIMEOUT,
      'Connection to database timed out',
      error,
      [
        'Check network latency to the database server',
        'Increase connection timeout in configuration',
        'Verify the database server is not overloaded',
        'Check for network connectivity issues',
      ],
      true,
      408
    );
  }

  // No password provided when required
  if (code === 'ER_ACCESS_DENIED_NO_PASSWORD_ERROR' || errno === 1698) {
    return new DatabaseError(
      DatabaseErrorCode.AUTHENTICATION_FAILED,
      'Database connection requires a password',
      error,
      [
        'Provide a password for the database user',
        'Check if the user account requires password authentication',
        'Verify password is not empty or null',
      ],
      false,
      401
    );
  }

  // SSL connection required
  if (message.includes('SSL') || code?.includes('SSL') || errno === 3159) {
    return new DatabaseError(
      DatabaseErrorCode.SSL_REQUIRED,
      'SSL connection required but not configured',
      error,
      [
        'Enable SSL in your database configuration',
        'Obtain SSL certificates from your database provider',
        'Check if the database server requires SSL connections',
        'Configure SSL options in connection string',
      ],
      false,
      502
    );
  }

  // Too many connections
  if (code === 'ER_CON_COUNT_ERROR' || errno === 1040) {
    return new DatabaseError(
      DatabaseErrorCode.TOO_MANY_CONNECTIONS,
      'Too many database connections',
      error,
      [
        'Wait for existing connections to be released',
        'Increase max_connections in MySQL configuration',
        'Check for connection leaks in your application',
        'Consider using connection pooling',
      ],
      true,
      503
    );
  }

  // Permission denied for specific operations
  if (code === 'ER_TABLEACCESS_DENIED_ERROR' || code === 'ER_COLUMNACCESS_DENIED_ERROR') {
    return new DatabaseError(
      DatabaseErrorCode.PERMISSION_DENIED,
      'Database operation permission denied',
      error,
      [
        'Check if the user has required privileges',
        'Contact your database administrator',
        'Verify the user has access to the required tables',
        'Review database user permissions',
      ],
      false,
      403
    );
  }

  // Default case for unknown errors
  return new DatabaseError(
    DatabaseErrorCode.UNKNOWN,
    `Database error: ${message}`,
    error,
    [
      'Check the database server logs for more details',
      'Verify all connection parameters are correct',
      'Try connecting with a database client tool',
      'Contact your database administrator if the issue persists',
    ],
    false,
    500
  );
}

/**
 * Sanitizes error messages to remove sensitive information.
 * Ensures passwords, connection strings, and other secrets are not exposed.
 *
 * @param error - The error object to sanitize
 * @returns Sanitized error object safe for logging
 */
export function sanitizeErrorForLogging(error: DatabaseError): Record<string, any> {
  return {
    code: error.code,
    message: error.message,
    suggestions: error.suggestions,
    isRetryable: error.isRetryable,
    statusCode: error.statusCode,
    // Exclude original error which might contain sensitive data
    originalErrorCode:
      error.originalError && 'code' in error.originalError ? error.originalError.code : undefined,
    originalErrorName: error.originalError?.name,
    // Never include the full original error message as it might contain passwords
  };
}
