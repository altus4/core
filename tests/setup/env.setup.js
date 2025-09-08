// Environment setup for tests
process.env.NODE_ENV = 'test';

// Database configuration for tests
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '3306';
process.env.DB_USERNAME = 'test_user';
process.env.DB_PASSWORD = 'test_password';
process.env.DB_DATABASE = 'altus4_test';

// Redis configuration for tests
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';

// JWT configuration for tests
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';

// OpenAI configuration for tests
process.env.OPENAI_API_KEY = 'test-openai-key';

// Disable external services in tests
process.env.DISABLE_EXTERNAL_SERVICES = 'true';

// Set test timeout
jest.setTimeout(30000);
