import { ExternalProxy, type ExternalProxyConfig, TimeoutError } from './external-proxy';

/**
 * Test implementation of ExternalProxy for testing purposes
 */
class TestExternalProxy extends ExternalProxy {
  // Expose withTimeout for testing
  public async testWithTimeout<T>(
    promise: Promise<T>,
    operation: string,
    customTimeout?: number
  ): Promise<T> {
    return this.withTimeout(promise, operation, customTimeout);
  }

  // Expose config for testing
  public getTestConfig() {
    return this.config;
  }

  // Expose isTimeoutError for testing
  public testIsTimeoutError(error: unknown): error is TimeoutError {
    return this.isTimeoutError(error);
  }
}

describe('ExternalProxy', () => {
  let proxy: TestExternalProxy;
  let mockOnTimeout: jest.Mock;
  let mockOnError: jest.Mock;

  const defaultConfig: ExternalProxyConfig = {
    defaultTimeout: 5000,
    serviceName: 'Test Service',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockOnTimeout = jest.fn();
    mockOnError = jest.fn();

    proxy = new TestExternalProxy(defaultConfig);
  });

  describe('constructor', () => {
    it('should initialize with provided config', () => {
      // Act
      proxy = new TestExternalProxy(defaultConfig);
      const config = proxy.getTestConfig();

      // Assert
      expect(config.defaultTimeout).toBe(5000);
      expect(config.serviceName).toBe('Test Service');
      expect(config.onTimeout).toBeDefined();
      expect(config.onError).toBeDefined();
    });

    it('should use provided timeout and error handlers', () => {
      // Arrange
      const configWithHandlers: ExternalProxyConfig = {
        ...defaultConfig,
        onTimeout: mockOnTimeout,
        onError: mockOnError,
      };

      // Act
      proxy = new TestExternalProxy(configWithHandlers);
      const config = proxy.getTestConfig();

      // Assert
      expect(config.onTimeout).toBe(mockOnTimeout);
      expect(config.onError).toBe(mockOnError);
    });
  });

  describe('isTimeoutError', () => {
    it('should return true for TimeoutError instances', () => {
      // Arrange
      const timeoutError = new TimeoutError('Timeout', 5000);

      // Act & Assert
      expect(proxy.testIsTimeoutError(timeoutError)).toBe(true);
    });

    it('should return false for other error types', () => {
      // Arrange
      const regularError = new Error('Regular error');

      // Act & Assert
      expect(proxy.testIsTimeoutError(regularError)).toBe(false);
    });

    it('should return false for non-error values', () => {
      // Act & Assert
      expect(proxy.testIsTimeoutError('string')).toBe(false);
      expect(proxy.testIsTimeoutError(123)).toBe(false);
      expect(proxy.testIsTimeoutError(null)).toBe(false);
      expect(proxy.testIsTimeoutError(undefined)).toBe(false);
    });
  });

  describe('withTimeout', () => {
    it('should resolve with promise result when within timeout', async () => {
      // Arrange
      const expectedResult = 'test result';
      const testPromise = Promise.resolve(expectedResult);

      // Act
      const result = await proxy.testWithTimeout(testPromise, 'test operation');

      // Assert
      expect(result).toBe(expectedResult);
    });

    it('should use custom timeout when provided', async () => {
      // Arrange
      const testPromise = Promise.resolve('result');

      // Act
      const result = await proxy.testWithTimeout(testPromise, 'test operation', 10000);

      // Assert
      expect(result).toBe('result');
    });

    it('should handle timeout errors correctly', async () => {
      // Arrange
      const proxy = new TestExternalProxy({
        ...defaultConfig,
        onTimeout: mockOnTimeout,
      });

      // Create a promise that will timeout
      const slowPromise = new Promise(resolve => setTimeout(() => resolve('slow'), 100));

      // Act & Assert - using very short timeout (1ms) to force timeout
      await expect(proxy.testWithTimeout(slowPromise, 'test operation', 1)).rejects.toThrow(
        'Operation timed out after 1ms for Test Service test operation'
      );
      expect(mockOnTimeout).toHaveBeenCalled();
    });

    it('should work with async operations that take time', async () => {
      // Arrange
      const testPromise = new Promise(resolve => setTimeout(() => resolve('delayed result'), 10));

      // Act - with generous timeout
      const result = await proxy.testWithTimeout(testPromise, 'async test', 1000);

      // Assert
      expect(result).toBe('delayed result');
    });
  });
});
