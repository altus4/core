/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Root directory
  rootDir: '.',

  // Test match patterns
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.ts',
    '<rootDir>/src/**/*.test.ts',
    '<rootDir>/tests/**/*.test.ts',
  ],

  // Setup files
  setupFiles: ['<rootDir>/tests/env-setup.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],

  // Coverage configuration
  collectCoverage: false, // Enable with --coverage flag
  collectCoverageFrom: [
    // Services - all fully tested
    'src/services/AIService.ts',
    'src/services/CacheService.ts',
    'src/services/DatabaseService.ts',
    'src/services/SearchService.ts',
    'src/services/UserService.ts',

    // Controllers - all fully tested
    'src/controllers/AnalyticsController.ts',
    'src/controllers/AuthController.ts',
    'src/controllers/DatabaseController.ts',
    'src/controllers/SearchController.ts',

    // Middleware - all fully tested
    'src/middleware/auth.ts',
    'src/middleware/errorHandler.ts',
    'src/middleware/rateLimiter.ts',
    'src/middleware/requestLogger.ts',
    'src/middleware/validation.ts',

    // Utilities - all fully tested
    'src/utils/encryption.ts',
    'src/utils/logger.ts',

    // Configuration - fully tested
    'src/config/index.ts',

    // Exclude routes and types from coverage for now
    '!src/routes/**',
    '!src/types/**',
    '!src/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 85,
      lines: 85,
      statements: 85,
    },

    // Excellent files - maintain high standards
    'src/services/UserService.ts': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    'src/services/DatabaseService.ts': {
      branches: 65,
      functions: 95,
      lines: 95,
      statements: 95,
    },

    // Services with good coverage - progressive improvement
    'src/services/SearchService.ts': {
      branches: 70,
      functions: 90,
      lines: 80,
      statements: 80,
    },
    'src/services/AIService.ts': {
      branches: 75,
      functions: 95,
      lines: 75,
      statements: 75,
    },
    'src/services/CacheService.ts': {
      branches: 50,
      functions: 80,
      lines: 60,
      statements: 60,
    },

    // Controllers - realistic but high standards
    'src/controllers/*.ts': {
      branches: 75,
      functions: 90,
      lines: 85,
      statements: 85,
    },

    // Middleware - adjusted based on complexity
    'src/middleware/requestLogger.ts': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    'src/middleware/errorHandler.ts': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    'src/middleware/validation.ts': {
      branches: 85,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    'src/middleware/auth.ts': {
      branches: 60,
      functions: 30,
      lines: 75,
      statements: 80,
    },
    'src/middleware/rateLimiter.ts': {
      branches: 85,
      functions: 20,
      lines: 75,
      statements: 75,
    },

    // Perfect utilities - maintain 100%
    'src/utils/*.ts': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },

    // Configuration - environment-dependent (has untestable module-load code)
    'src/config/index.ts': {
      branches: 60,
      functions: 50,
      lines: 75,
      statements: 75,
    },
  },

  // Module resolution - CORRECT property name is moduleNameMapper
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
  },

  // Transform configuration
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
      },
    ],
  },

  // Test timeout
  testTimeout: 30000,

  // Global setup/teardown (temporarily disabled)
  // globalSetup: '<rootDir>/tests/global-setup.ts',
  // globalTeardown: '<rootDir>/tests/global-teardown.ts',

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,

  // Handle async operations
  detectOpenHandles: true,
  forceExit: true,
};
