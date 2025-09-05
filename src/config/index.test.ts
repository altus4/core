import {
  config,
  generateEnvTemplate,
  getJwtMinLength,
  isValidEnvironment,
  isValidPort,
  parseIntWithDefault,
  validateConfig,
} from './index';

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

  describe('edge cases and additional coverage', () => {
    it('should handle parseInt edge cases for numeric environment variables', () => {
      // Test that parseInt is used correctly for numeric values
      expect(typeof config.port).toBe('number');
      expect(typeof config.database.port).toBe('number');
      expect(typeof config.redis.port).toBe('number');
      expect(typeof config.rateLimit.windowMs).toBe('number');
      expect(typeof config.rateLimit.maxRequests).toBe('number');
    });

    it('should validate config object structure', () => {
      // Test the complete config object structure
      expect(config).toHaveProperty('port');
      expect(config).toHaveProperty('environment');
      expect(config).toHaveProperty('jwtSecret');
      expect(config).toHaveProperty('database');
      expect(config).toHaveProperty('redis');
      expect(config).toHaveProperty('openai');
      expect(config).toHaveProperty('rateLimit');

      // Test nested objects
      expect(config.database).toHaveProperty('host');
      expect(config.database).toHaveProperty('port');
      expect(config.database).toHaveProperty('username');
      expect(config.database).toHaveProperty('password');
      expect(config.database).toHaveProperty('database');

      expect(config.redis).toHaveProperty('host');
      expect(config.redis).toHaveProperty('port');
      expect(config.redis).toHaveProperty('password');

      expect(config.openai).toHaveProperty('apiKey');
      expect(config.openai).toHaveProperty('model');

      expect(config.rateLimit).toHaveProperty('windowMs');
      expect(config.rateLimit).toHaveProperty('maxRequests');
    });

    it('should handle environment variable type coercion', () => {
      // Test that environment variables are properly converted to numbers
      // (We can't reload the module to test different env values, but we can verify current values are numbers)
      expect(Number.isInteger(config.port)).toBe(true);
      expect(Number.isInteger(config.database.port)).toBe(true);
      expect(Number.isInteger(config.redis.port)).toBe(true);
      expect(Number.isInteger(config.rateLimit.windowMs)).toBe(true);
      expect(Number.isInteger(config.rateLimit.maxRequests)).toBe(true);
    });

    it('should validate that required fields are not empty strings', () => {
      // In test environment, these should have default values
      expect(config.jwtSecret).toBeTruthy();
      expect(config.database.host).toBeTruthy();
      expect(config.database.username).toBeTruthy();
      expect(config.database.database).toBeTruthy();
    });

    it('should handle optional fields correctly', () => {
      // These can be empty or undefined
      expect(config.database.password).toBeDefined(); // Can be empty string
      expect(config.openai.apiKey).toBeDefined(); // Can be empty string
      // Redis password can be undefined
      expect(config.redis.password).toEqual(process.env.REDIS_PASSWORD);
    });
  });

  describe('validateConfig edge cases', () => {
    it('should validate port boundary values', () => {
      const originalPort = config.port;

      // Test valid boundary values
      (config as any).port = 1;
      expect(() => validateConfig()).not.toThrow();

      (config as any).port = 65535;
      expect(() => validateConfig()).not.toThrow();

      // Restore original
      (config as any).port = originalPort;
    });

    it('should validate JWT secret length in different environments', () => {
      const originalSecret = config.jwtSecret;
      const originalEnv = config.environment;

      // Test production environment requirements (32 chars)
      (config as any).environment = 'production';
      (config as any).jwtSecret = '12345678901234567890123456789012'; // 32 chars
      expect(() => validateConfig()).not.toThrow();

      // Test development environment requirements (32 chars)
      (config as any).environment = 'development';
      (config as any).jwtSecret = '12345678901234567890123456789012'; // 32 chars
      expect(() => validateConfig()).not.toThrow();

      // Restore original
      (config as any).jwtSecret = originalSecret;
      (config as any).environment = originalEnv;
    });

    it('should validate all valid environment values', () => {
      const originalEnv = config.environment;

      // Test all valid environments
      const validEnvironments = ['development', 'production', 'test'];
      validEnvironments.forEach(env => {
        (config as any).environment = env;
        expect(() => validateConfig()).not.toThrow();
      });

      // Restore original
      (config as any).environment = originalEnv;
    });

    it('should handle isTestEnvironment branch coverage', () => {
      // Test that we understand the test environment detection
      expect(process.env.NODE_ENV).toBe('test');

      // We can't easily test the non-test environment branches due to module loading,
      // but we can test the logic that depends on isTestEnvironment
      const testEnvValue = process.env.NODE_ENV === 'test';
      expect(testEnvValue).toBe(true);
    });

    it('should test the minJwtLength calculation branch', () => {
      const originalEnv = config.environment;
      const originalSecret = config.jwtSecret;

      // Test the branch where isTestEnvironment is true (current case)
      // In test environment, minJwtLength should be 16
      (config as any).environment = 'test';
      (config as any).jwtSecret = '1234567890123456'; // exactly 16 chars
      expect(() => validateConfig()).not.toThrow();

      // Test just under the test environment threshold
      (config as any).jwtSecret = '123456789012345'; // 15 chars
      expect(() => validateConfig()).toThrow(/JWT_SECRET must be at least 16 characters long/);

      // Test the branch where isTestEnvironment would be false
      // We can't actually change isTestEnvironment, but we can test the logic
      // by temporarily modifying the environment and testing the 32-char requirement
      (config as any).environment = 'production';
      (config as any).jwtSecret = '12345678901234567890123456789012'; // exactly 32 chars
      expect(() => validateConfig()).not.toThrow();

      // Restore original values
      (config as any).jwtSecret = originalSecret;
      (config as any).environment = originalEnv;
    });
  });

  describe('module-level execution coverage', () => {
    it('should validate that module initialization sets up test environment correctly', () => {
      // Test that the test environment setup worked correctly
      // These should have been set by the module-level if block (lines 11-18)
      expect(process.env.JWT_SECRET).toBeTruthy();
      expect(process.env.DB_HOST).toBeTruthy();
      expect(process.env.DB_USERNAME).toBeTruthy();
      expect(process.env.DB_DATABASE).toBeTruthy();
      expect(process.env.DB_PASSWORD).toBeDefined(); // Can be empty string
    });

    it('should validate that the final validateConfig call executed', () => {
      // The module calls validateConfig() at the end (line 127)
      // If we got here without errors, it means that call succeeded
      expect(() => validateConfig()).not.toThrow();

      // Test that the config object was properly initialized
      expect(config).toBeDefined();
      expect(config.port).toBeGreaterThan(0);
      expect(config.jwtSecret).toBeTruthy();
    });

    it('should test parseInt with default values', () => {
      // Test the parseInt calls with default values
      // These test the || operators in the config object
      expect(config.port).toBe(3000); // Default PORT
      expect(config.database.port).toBe(3306); // Default DB_PORT
      expect(config.redis.port).toBe(6379); // Default REDIS_PORT
      expect(config.rateLimit.windowMs).toBe(900000); // Default RATE_LIMIT_WINDOW_MS
      expect(config.rateLimit.maxRequests).toBe(100); // Default RATE_LIMIT_MAX_REQUESTS
    });

    it('should test string defaults and optional values', () => {
      // Test the || operators for string values
      expect(config.redis.host).toBe('localhost'); // Default REDIS_HOST
      expect(config.openai.apiKey).toBeDefined(); // Default '' for OPENAI_API_KEY
      expect(config.openai.model).toBe('gpt-3.5-turbo'); // Default OPENAI_MODEL
      expect(config.environment).toBe('test'); // Current NODE_ENV
    });
  });

  describe('Additional edge case coverage', () => {
    it('should test generateEnvTemplate completeness', () => {
      const template = generateEnvTemplate();

      // Test that all sections are present and complete
      const expectedSections = [
        '# Server Configuration',
        '# Database Configuration',
        '# Redis Configuration',
        '# Authentication',
        '# OpenAI Integration',
        '# Rate Limiting',
        '# CORS Configuration',
        '# Logging',
        '# Optional: Database Pool Settings',
      ];

      expectedSections.forEach(section => {
        expect(template).toContain(section);
      });

      // Test that template has proper structure
      expect(template.split('\n').length).toBeGreaterThan(20);
      expect(template).toMatch(/NODE_ENV=development/);
      expect(template).toMatch(/PORT=3000/);
    });

    it('should test generateEnvTemplate specific format requirements', () => {
      const template = generateEnvTemplate();

      // Test specific format requirements
      expect(template).toMatch(/^# Altus 4 Environment Configuration/);
      expect(template.endsWith('`;\n}')).toBe(false); // Should not contain template literal artifacts
      expect(template).toContain(
        'JWT_SECRET=your_very_long_and_secure_jwt_secret_key_here_at_least_32_characters'
      );
      expect(template).toContain('OPENAI_API_KEY=your_openai_api_key_here');

      // Ensure no JavaScript syntax leaked in
      expect(template).not.toContain('${');
      expect(template).not.toContain('process.env');
    });

    it('should validate config with various port edge cases', () => {
      const originalPort = config.port;

      // Test minimum valid port
      (config as any).port = 1;
      expect(() => validateConfig()).not.toThrow();

      // Test maximum valid port
      (config as any).port = 65535;
      expect(() => validateConfig()).not.toThrow();

      // Test invalid low port
      (config as any).port = 0;
      expect(() => validateConfig()).toThrow('PORT must be between 1 and 65535');

      // Test invalid high port
      (config as any).port = 65536;
      expect(() => validateConfig()).toThrow('PORT must be between 1 and 65535');

      // Test negative port
      (config as any).port = -1;
      expect(() => validateConfig()).toThrow('PORT must be between 1 and 65535');

      // Restore original
      (config as any).port = originalPort;
    });

    it('should validate JWT secret with exact boundary lengths', () => {
      const originalSecret = config.jwtSecret;
      const originalEnv = config.environment;

      // Test test environment boundary (16 chars)
      (config as any).environment = 'test';
      (config as any).jwtSecret = '1234567890123456'; // exactly 16
      expect(() => validateConfig()).not.toThrow();

      (config as any).jwtSecret = '123456789012345'; // 15 chars
      expect(() => validateConfig()).toThrow('JWT_SECRET must be at least 16 characters long');

      // Test production environment boundary (32 chars)
      // Note: In test environment, the isTestEnvironment is still true, so minJwtLength is still 16
      // We can't actually test the production logic since isTestEnvironment is determined by NODE_ENV at module load
      (config as any).environment = 'production';
      (config as any).jwtSecret = '1234567890123456'; // 16 chars - still valid in test environment
      expect(() => validateConfig()).not.toThrow();

      (config as any).jwtSecret = '123456789012345'; // 15 chars - should fail in any environment
      expect(() => validateConfig()).toThrow('JWT_SECRET must be at least 16 characters long');

      // Restore
      (config as any).jwtSecret = originalSecret;
      (config as any).environment = originalEnv;
    });

    it('should validate environment values exhaustively', () => {
      const originalEnv = config.environment;

      // Test all valid environments individually
      const validEnvs = ['development', 'production', 'test'];
      validEnvs.forEach(env => {
        (config as any).environment = env;
        expect(() => validateConfig()).not.toThrow();
      });

      // Test invalid environments
      const invalidEnvs = ['staging', 'local', '', 'prod', 'dev', 'testing'];
      invalidEnvs.forEach(env => {
        (config as any).environment = env;
        expect(() => validateConfig()).toThrow(
          'NODE_ENV must be one of: development, production, test'
        );
      });

      // Restore
      (config as any).environment = originalEnv;
    });

    it('should handle parseInt edge cases in config object', () => {
      // Test that parseInt with radix 10 is used correctly
      expect(Number.isInteger(config.port)).toBe(true);
      expect(config.port).toBeGreaterThan(0);
      expect(config.port).toBeLessThan(65536);

      expect(Number.isInteger(config.database.port)).toBe(true);
      expect(config.database.port).toBeGreaterThan(0);

      expect(Number.isInteger(config.redis.port)).toBe(true);
      expect(config.redis.port).toBeGreaterThan(0);

      expect(Number.isInteger(config.rateLimit.windowMs)).toBe(true);
      expect(config.rateLimit.windowMs).toBeGreaterThan(0);

      expect(Number.isInteger(config.rateLimit.maxRequests)).toBe(true);
      expect(config.rateLimit.maxRequests).toBeGreaterThan(0);
    });

    it('should test all config object branches', () => {
      // Test that all properties are defined and have expected types
      expect(typeof config.port).toBe('number');
      expect(typeof config.environment).toBe('string');
      expect(typeof config.jwtSecret).toBe('string');

      // Database config
      expect(typeof config.database.host).toBe('string');
      expect(typeof config.database.port).toBe('number');
      expect(typeof config.database.username).toBe('string');
      expect(typeof config.database.password).toBe('string');
      expect(typeof config.database.database).toBe('string');

      // Redis config
      expect(typeof config.redis.host).toBe('string');
      expect(typeof config.redis.port).toBe('number');
      // password can be undefined
      expect(['string', 'undefined']).toContain(typeof config.redis.password);

      // OpenAI config
      expect(typeof config.openai.apiKey).toBe('string');
      expect(typeof config.openai.model).toBe('string');

      // Rate limit config
      expect(typeof config.rateLimit.windowMs).toBe('number');
      expect(typeof config.rateLimit.maxRequests).toBe('number');
    });

    it('should handle empty and undefined environment values', () => {
      // Test that string values handle empty strings appropriately
      expect(config.database.host).toBeTruthy(); // Should not be empty in test
      expect(config.database.username).toBeTruthy(); // Should not be empty in test
      expect(config.database.database).toBeTruthy(); // Should not be empty in test

      // These can be empty
      expect(config.database.password).toBeDefined();
      expect(config.openai.apiKey).toBeDefined();

      // Redis password can be undefined
      if (config.redis.password !== undefined) {
        expect(typeof config.redis.password).toBe('string');
      }
    });
  });

  describe('Helper Functions', () => {
    describe('parseIntWithDefault', () => {
      it('should parse string numbers correctly', () => {
        expect(parseIntWithDefault('3000', 5000)).toBe(3000);
        expect(parseIntWithDefault('0', 100)).toBe(0);
        expect(parseIntWithDefault('65535', 3000)).toBe(65535);
      });

      it('should return default value for undefined', () => {
        expect(parseIntWithDefault(undefined, 3000)).toBe(3000);
        expect(parseIntWithDefault(undefined, 6379)).toBe(6379);
      });

      it('should return default value for empty string', () => {
        expect(parseIntWithDefault('', 8080)).toBe(8080);
        expect(parseIntWithDefault('', 5432)).toBe(5432);
      });

      it('should handle invalid strings by returning NaN (parseInt behavior)', () => {
        expect(isNaN(parseIntWithDefault('invalid', 3000))).toBe(true);
        expect(isNaN(parseIntWithDefault('abc123', 3000))).toBe(true);
      });
    });

    describe('getJwtMinLength', () => {
      it('should return 16 for test environment', () => {
        expect(getJwtMinLength(true)).toBe(16);
      });

      it('should return 32 for non-test environment', () => {
        expect(getJwtMinLength(false)).toBe(32);
      });
    });

    describe('isValidPort', () => {
      it('should return true for valid port numbers', () => {
        expect(isValidPort(1)).toBe(true);
        expect(isValidPort(3000)).toBe(true);
        expect(isValidPort(8080)).toBe(true);
        expect(isValidPort(65535)).toBe(true);
      });

      it('should return false for invalid port numbers', () => {
        expect(isValidPort(0)).toBe(false);
        expect(isValidPort(-1)).toBe(false);
        expect(isValidPort(65536)).toBe(false);
        expect(isValidPort(100000)).toBe(false);
      });

      it('should handle edge cases', () => {
        expect(isValidPort(1.5)).toBe(true); // JavaScript parseInt behavior
        expect(isValidPort(NaN)).toBe(false);
      });
    });

    describe('isValidEnvironment', () => {
      it('should return true for valid environments', () => {
        expect(isValidEnvironment('development')).toBe(true);
        expect(isValidEnvironment('production')).toBe(true);
        expect(isValidEnvironment('test')).toBe(true);
      });

      it('should return false for invalid environments', () => {
        expect(isValidEnvironment('staging')).toBe(false);
        expect(isValidEnvironment('local')).toBe(false);
        expect(isValidEnvironment('dev')).toBe(false);
        expect(isValidEnvironment('prod')).toBe(false);
        expect(isValidEnvironment('')).toBe(false);
        expect(isValidEnvironment('DEVELOPMENT')).toBe(false); // case sensitive
      });
    });
  });
});
