/**
 * Heroku-specific configuration utilities
 * Handles parsing of Heroku add-on URLs like CLEARDB_DATABASE_URL and REDIS_URL
 */

export interface ParsedDatabaseUrl {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

export interface ParsedRedisUrl {
  host: string;
  port: number;
  password?: string;
}

/**
 * Parse a database URL in the format:
 * mysql://username:password@hostname:port/database
 */
export function parseDatabaseUrl(url: string): ParsedDatabaseUrl {
  try {
    const parsed = new URL(url);

    return {
      host: parsed.hostname,
      port: parseInt(parsed.port) || 3306,
      username: parsed.username,
      password: parsed.password,
      database: parsed.pathname.slice(1), // Remove leading slash
    };
  } catch (error) {
    throw new Error(`Invalid database URL format: ${error}`);
  }
}

/**
 * Parse a Redis URL in the format:
 * redis://:password@hostname:port
 * or redis://hostname:port
 */
export function parseRedisUrl(url: string): ParsedRedisUrl {
  try {
    const parsed = new URL(url);

    return {
      host: parsed.hostname,
      port: parseInt(parsed.port) || 6379,
      password: parsed.password || undefined,
    };
  } catch (error) {
    throw new Error(`Invalid Redis URL format: ${error}`);
  }
}

/**
 * Get database configuration from environment variables
 * Prioritizes Heroku add-on URLs over individual env vars
 */
export function getDatabaseConfig() {
  // Check for Heroku add-on URLs first
  const clearDbUrl = process.env.CLEARDB_DATABASE_URL;
  const jawsDbUrl = process.env.JAWSDB_URL;
  const databaseUrl = process.env.DATABASE_URL;

  if (clearDbUrl) {
    return parseDatabaseUrl(clearDbUrl);
  }

  if (jawsDbUrl) {
    return parseDatabaseUrl(jawsDbUrl);
  }

  if (databaseUrl) {
    return parseDatabaseUrl(databaseUrl);
  }

  // Fallback to individual environment variables
  return {
    host: process.env.DB_HOST!,
    port: parseInt(process.env.DB_PORT || '3306'),
    username: process.env.DB_USERNAME!,
    password: process.env.DB_PASSWORD!,
    database: process.env.DB_DATABASE!,
  };
}

/**
 * Get Redis configuration from environment variables
 * Prioritizes Heroku Redis URL over individual env vars
 */
export function getRedisConfig() {
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    return parseRedisUrl(redisUrl);
  }

  // Fallback to individual environment variables
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
  };
}

/**
 * Get the port from environment variables
 * Heroku automatically sets the PORT environment variable
 */
export function getPort(): number {
  return parseInt(process.env.PORT || '3000');
}
