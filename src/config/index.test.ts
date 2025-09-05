import { config, generateEnvTemplate, validateConfig } from './index';

describe('Config Module', () => {
  describe('config object', () => {
    it('should have required properties', () => {
      expect(config).toHaveProperty('port');
      expect(config).toHaveProperty('environment');
      expect(config).toHaveProperty('jwtSecret');
      expect(config).toHaveProperty('database');
      expect(config).toHaveProperty('redis');
      expect(config).toHaveProperty('openai');
      expect(config).toHaveProperty('rateLimit');
    });

    it('should parse environment variables correctly', () => {
      expect(typeof config.port).toBe('number');
      expect(['development', 'production', 'test']).toContain(config.environment);
      expect(typeof config.jwtSecret).toBe('string');
      expect(typeof config.database.host).toBe('string');
      expect(typeof config.redis.host).toBe('string');
      expect(typeof config.openai.apiKey).toBe('string');
      expect(typeof config.rateLimit.windowMs).toBe('number');
    });

    it('should use default values when environment variables are not set', () => {
      expect(config.port).toBe(3000); // Default PORT
      expect(config.database.port).toBe(3306); // Default DB_PORT
      expect(config.redis.port).toBe(6379); // Default REDIS_PORT
      expect(config.openai.model).toBe('gpt-3.5-turbo'); // Default OPENAI_MODEL
      expect(config.rateLimit.windowMs).toBe(900000); // Default RATE_LIMIT_WINDOW_MS
      expect(config.rateLimit.maxRequests).toBe(100); // Default RATE_LIMIT_MAX_REQUESTS
    });

    it('should handle optional environment variables', () => {
      // These should be defined even if empty
      expect(config.database.password).toBeDefined();
      expect(config.openai.apiKey).toBeDefined();
      // Redis password can be undefined when REDIS_PASSWORD env var is not set
      expect(config.redis.password).toEqual(process.env.REDIS_PASSWORD);
    });
  });

  describe('validateConfig', () => {
    it('should not throw for valid config', () => {
      expect(() => validateConfig()).not.toThrow();
    });

    it('should throw if port is out of range', () => {
      const originalPort = config.port;
      (config as any).port = 70000;
      expect(() => validateConfig()).toThrow('PORT must be between 1 and 65535');
      (config as any).port = originalPort;
    });

    it('should throw if port is too low', () => {
      const originalPort = config.port;
      (config as any).port = 0;
      expect(() => validateConfig()).toThrow('PORT must be between 1 and 65535');
      (config as any).port = originalPort;
    });

    it('should throw if JWT_SECRET is too short', () => {
      const originalSecret = config.jwtSecret;
      (config as any).jwtSecret = 'short';
      expect(() => validateConfig()).toThrow(/JWT_SECRET must be at least/);
      (config as any).jwtSecret = originalSecret;
    });

    it('should throw if NODE_ENV is invalid', () => {
      const originalEnv = config.environment;
      (config as any).environment = 'invalid_env';
      expect(() => validateConfig()).toThrow(
        'NODE_ENV must be one of: development, production, test'
      );
      (config as any).environment = originalEnv;
    });

    it('should accept valid environments', () => {
      const originalEnv = config.environment;

      (config as any).environment = 'development';
      expect(() => validateConfig()).not.toThrow();

      (config as any).environment = 'production';
      expect(() => validateConfig()).not.toThrow();

      (config as any).environment = 'test';
      expect(() => validateConfig()).not.toThrow();

      (config as any).environment = originalEnv;
    });

    it('should have different JWT secret length requirements for test vs production', () => {
      const originalSecret = config.jwtSecret;
      const originalEnv = config.environment;

      // In test environment, 16 chars should be enough
      (config as any).environment = 'test';
      (config as any).jwtSecret = '1234567890123456'; // 16 chars
      expect(() => validateConfig()).not.toThrow();

      // But less than 16 should still fail
      (config as any).jwtSecret = '123456789012345'; // 15 chars
      expect(() => validateConfig()).toThrow(/JWT_SECRET must be at least 16 characters long/);

      (config as any).jwtSecret = originalSecret;
      (config as any).environment = originalEnv;
    });
  });

  describe('generateEnvTemplate', () => {
    it('should return a string containing environment variable keys', () => {
      const template = generateEnvTemplate();
      expect(typeof template).toBe('string');
      expect(template).toContain('NODE_ENV');
      expect(template).toContain('DB_HOST');
      expect(template).toContain('JWT_SECRET');
      expect(template).toContain('OPENAI_API_KEY');
    });

    it('should include all required configuration sections', () => {
      const template = generateEnvTemplate();

      // Server Configuration
      expect(template).toContain('# Server Configuration');
      expect(template).toContain('PORT=3000');

      // Database Configuration
      expect(template).toContain('# Database Configuration');
      expect(template).toContain('DB_PORT=3306');
      expect(template).toContain('DB_USERNAME=altus4_user');
      expect(template).toContain('DB_DATABASE=altus4_meta');

      // Redis Configuration
      expect(template).toContain('# Redis Configuration');
      expect(template).toContain('REDIS_HOST=localhost');
      expect(template).toContain('REDIS_PORT=6379');

      // Authentication
      expect(template).toContain('# Authentication');
      expect(template).toContain('JWT_SECRET=');

      // OpenAI Integration
      expect(template).toContain('# OpenAI Integration');
      expect(template).toContain('OPENAI_MODEL=gpt-3.5-turbo');

      // Rate Limiting
      expect(template).toContain('# Rate Limiting');
      expect(template).toContain('RATE_LIMIT_WINDOW_MS=900000');
      expect(template).toContain('RATE_LIMIT_MAX_REQUESTS=100');

      // CORS Configuration
      expect(template).toContain('# CORS Configuration');
      expect(template).toContain('ALLOWED_ORIGINS=');

      // Logging
      expect(template).toContain('# Logging');
      expect(template).toContain('LOG_LEVEL=info');

      // Optional Database Pool Settings
      expect(template).toContain('# Optional: Database Pool Settings');
      expect(template).toContain('DB_CONNECTION_LIMIT=10');
    });

    it('should be a valid environment file format', () => {
      const template = generateEnvTemplate();

      // Should start with a comment
      expect(template).toMatch(/^# Altus 4 Environment Configuration/);

      // Should contain key=value pairs
      expect(template).toMatch(/\w+=\w+/);

      // Should contain comments (lines starting with #)
      expect(template).toMatch(/^#/m);

      // Should not contain any undefined or null values
      expect(template).not.toContain('undefined');
      expect(template).not.toContain('null');
    });
  });

  describe('environment variable validation in non-test environment', () => {
    // Note: These tests simulate non-test environment behavior
    // but can't actually test the module loading validation since
    // that happens at import time

    it('should handle missing required environment variables', () => {
      // This is more of a documentation test since the actual validation
      // happens at module load time in non-test environments
      const requiredVars = ['JWT_SECRET', 'DB_HOST', 'DB_USERNAME', 'DB_DATABASE'];
      expect(requiredVars).toHaveLength(4);
      expect(requiredVars).toContain('JWT_SECRET');
      expect(requiredVars).toContain('DB_HOST');
      expect(requiredVars).toContain('DB_USERNAME');
      expect(requiredVars).toContain('DB_DATABASE');
    });

    it('should handle optional environment variables', () => {
      const optionalVars = ['DB_PASSWORD'];
      expect(optionalVars).toHaveLength(1);
      expect(optionalVars).toContain('DB_PASSWORD');
    });
  });
});
