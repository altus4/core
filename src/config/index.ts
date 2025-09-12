import type { AppConfig } from '@/types';
import { getDatabaseConfig, getPort, getRedisConfig } from './heroku';

const isTestEnvironment = process.env.NODE_ENV === 'test';

// Helper function to parse integer with default
export const parseIntWithDefault = (value: string | undefined, defaultValue: number): number => {
  return parseInt(value || defaultValue.toString(), 10);
};

// Helper function to get environment-specific JWT minimum length
export const getJwtMinLength = (isTestEnv: boolean): number => {
  return isTestEnv ? 16 : 32;
};

// Helper function to validate port range
export const isValidPort = (port: number): boolean => {
  return port >= 1 && port <= 65535;
};

// Helper function to validate environment
export const isValidEnvironment = (env: string): boolean => {
  return ['development', 'production', 'test'].includes(env);
};

const requiredEnvVars = ['JWT_SECRET', 'DB_HOST', 'DB_USERNAME', 'DB_DATABASE'] as const;

// DB_PASSWORD can be empty for local development
const optionalEnvVars = ['DB_PASSWORD'] as const;

// In test environment, provide defaults to avoid strict validation
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

// Get configurations that support Heroku add-ons
const databaseConfig = getDatabaseConfig();
const redisConfig = getRedisConfig();

export const config: AppConfig = {
  port: getPort(),
  environment: (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test',
  jwtSecret: process.env.JWT_SECRET!,

  database: databaseConfig,

  redis: redisConfig,

  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
  },

  rateLimit: {
    windowMs: parseIntWithDefault(process.env.RATE_LIMIT_WINDOW_MS, 900000), // 15 minutes
    maxRequests: parseIntWithDefault(process.env.RATE_LIMIT_MAX_REQUESTS, 100),
  },

  timeout: {
    openai: parseIntWithDefault(process.env.OPENAI_TIMEOUT_MS, 30000), // 30 seconds
  },
};

// Validate configuration
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

// Environment file template
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
# Add any additional origins beyond the default local development servers
# Common dev servers (5173, 3000, 3001, 4173, 8080) are included by default
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com

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
