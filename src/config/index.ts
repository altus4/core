/**
 * Configuration Module
 *
 * Manages application configuration from environment variables with validation and defaults.
 * Provides type-safe configuration object, validation functions, and environment template generation.
 * Handles different configuration requirements for development, production, and test environments.
 *
 * Usage:
 *   - Import { config } to access validated configuration
 *   - Call validateConfig() to ensure environment variables are properly set
 *   - Use helper functions for parsing and validation
 */
import type { AppConfig } from '@/types';

const isTestEnvironment = process.env.NODE_ENV === 'test';

/**
 * Helper function to parse integer from environment variable with fallback default.
 *
 * @param value - Environment variable value (string or undefined)
 * @param defaultValue - Default value to use if parsing fails
 * @returns Parsed integer value or default
 */
export const parseIntWithDefault = (value: string | undefined, defaultValue: number): number => {
  return parseInt(value || defaultValue.toString(), 10);
};

/**
 * Get environment-specific JWT minimum length requirement.
 * Test environments allow shorter secrets for convenience.
 *
 * @param isTestEnv - Whether running in test environment
 * @returns Minimum required JWT secret length
 */
export const getJwtMinLength = (isTestEnv: boolean): number => {
  return isTestEnv ? 16 : 32;
};

/**
 * Validate that port number is within valid range.
 *
 * @param port - Port number to validate
 * @returns True if port is valid (1-65535)
 */
export const isValidPort = (port: number): boolean => {
  return port >= 1 && port <= 65535;
};

/**
 * Validate that environment string is one of allowed values.
 *
 * @param env - Environment string to validate
 * @returns True if environment is valid
 */
export const isValidEnvironment = (env: string): boolean => {
  return ['development', 'production', 'test'].includes(env);
};

/** Required environment variables that must be present in production */
const requiredEnvVars = ['JWT_SECRET', 'DB_HOST', 'DB_USERNAME', 'DB_DATABASE'] as const;

/** Optional environment variables that can be empty (DB_PASSWORD for local development) */
const optionalEnvVars = ['DB_PASSWORD'] as const;

// In test environment, provide defaults to avoid strict validation and enable testing
if (isTestEnvironment) {
  process.env.JWT_SECRET =
    process.env.JWT_SECRET || 'test_jwt_secret_key_for_testing_at_least_32_characters_long';
  process.env.DB_HOST = process.env.DB_HOST || 'localhost';
  process.env.DB_USERNAME = process.env.DB_USERNAME || 'root';
  process.env.DB_PASSWORD = process.env.DB_PASSWORD || '';
  process.env.DB_DATABASE = process.env.DB_DATABASE || 'altus4_test';
}

// Validate required environment variables (skip in test mode or provide defaults)
if (!isTestEnvironment) {
  const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  // Ensure optional variables are defined (can be empty)
  optionalEnvVars.forEach(envVar => {
    if (process.env[envVar] === undefined) {
      process.env[envVar] = '';
    }
  });
}

/**
 * Main application configuration object.
 * Combines environment variables with sensible defaults and validation.
 * All values are type-safe and validated at startup.
 */
export const config: AppConfig = {
  port: parseIntWithDefault(process.env.PORT, 3000),
  environment: (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test',
  jwtSecret: process.env.JWT_SECRET!,

  /** MySQL database configuration for metadata storage */
  database: {
    host: process.env.DB_HOST!,
    port: parseIntWithDefault(process.env.DB_PORT, 3306),
    username: process.env.DB_USERNAME!,
    password: process.env.DB_PASSWORD!,
    database: process.env.DB_DATABASE!,
  },

  /** Redis configuration for caching and rate limiting */
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseIntWithDefault(process.env.REDIS_PORT, 6379),
    password: process.env.REDIS_PASSWORD,
  },

  /** OpenAI API configuration for AI-powered features */
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
  },

  /** Rate limiting configuration */
  rateLimit: {
    windowMs: parseIntWithDefault(process.env.RATE_LIMIT_WINDOW_MS, 900000), // 15 minutes
    maxRequests: parseIntWithDefault(process.env.RATE_LIMIT_MAX_REQUESTS, 100),
  },

  /** Timeout configurations for external services */
  timeout: {
    openai: parseIntWithDefault(process.env.OPENAI_TIMEOUT_MS, 30000), // 30 seconds
  },
};

/**
 * Validates the configuration object to ensure all required values are present and valid.
 * Throws descriptive errors if validation fails.
 * Uses different validation rules for test vs production environments.
 *
 * @throws Error if configuration is invalid
 */
export const validateConfig = (): void => {
  if (!isValidPort(config.port)) {
    throw new Error('PORT must be between 1 and 65535');
  }

  // Be more lenient with JWT secret in test environment
  const minJwtLength = getJwtMinLength(isTestEnvironment);
  if (config.jwtSecret.length < minJwtLength) {
    throw new Error(`JWT_SECRET must be at least ${minJwtLength} characters long`);
  }

  if (!isValidEnvironment(config.environment)) {
    throw new Error('NODE_ENV must be one of: development, production, test');
  }
};

/**
 * Generates a template .env file with all required and optional configuration variables.
 * Useful for setting up new deployments and development environments.
 *
 * @returns String containing .env file template with documentation
 */
export const generateEnvTemplate = (): string => {
  return `# Altus 4 Environment Configuration

# Server Configuration
NODE_ENV=development
PORT=3000

# Database Configuration (Primary - for metadata storage)
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=altus4_user
DB_PASSWORD=your_secure_password
DB_DATABASE=altus4_meta

# Redis Configuration (for caching)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Authentication
JWT_SECRET=your_very_long_and_secure_jwt_secret_key_here_at_least_32_characters

# OpenAI Integration (for AI features)
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-3.5-turbo

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes in milliseconds
RATE_LIMIT_MAX_REQUESTS=100

# Timeout Configuration
OPENAI_TIMEOUT_MS=30000      # 30 seconds for OpenAI API calls

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Logging
LOG_LEVEL=info

# Optional: Database Pool Settings
DB_CONNECTION_LIMIT=10
DB_ACQUIRE_TIMEOUT=60000
DB_TIMEOUT=60000
`;
};

// Run validation on import
validateConfig();
