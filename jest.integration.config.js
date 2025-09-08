/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Root directory
  rootDir: '.',

  // Test match patterns for integration tests only
  testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],

  // Setup files
  setupFiles: ['<rootDir>/tests/setup/env.setup.js'],
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup/integration.setup.ts',
    '<rootDir>/tests/setup/refresh.setup.ts',
  ],

  // Coverage configuration (disabled for integration tests)
  collectCoverage: false,

  // Module resolution
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

  // Test timeout (longer for integration tests)
  testTimeout: 60000,

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,

  // Handle async operations
  detectOpenHandles: true,
  forceExit: true,
};
