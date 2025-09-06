/**
 * Base class for external service proxies with common timeout handling
 *
 * Provides common functionality for all external API proxies including
 * timeout handling, error logging, and configuration management.
 */

/**
 * Custom error class for timeout operations
 */
export class TimeoutError extends Error {
  constructor(
    message: string,
    public readonly timeoutMs: number
  ) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Base configuration for external service proxies
 */
export interface ExternalProxyConfig {
  /** Default timeout for all API calls */
  defaultTimeout: number;
  /** Service name for error logging */
  serviceName: string;
  /** Custom timeout handler */
  onTimeout?: (error: TimeoutError, operation: string) => void;
  /** Custom error handler */
  onError?: (error: unknown, operation: string) => void;
}

/**
 * Abstract base class for external service proxies
 */
export abstract class ExternalProxy {
  protected config: Required<ExternalProxyConfig>;

  constructor(config: ExternalProxyConfig) {
    this.config = {
      onTimeout: () => {}, // No-op default
      onError: () => {}, // No-op default
      ...config,
    };
  }

  /**
   * Utility to check if an error is a TimeoutError
   *
   * @param error - Error to check
   * @returns true if the error is a TimeoutError
   */
  protected isTimeoutError(error: unknown): error is TimeoutError {
    return error instanceof TimeoutError;
  }

  /**
   * Adds timeout protection to a promise, rejecting with TimeoutError if timeout occurs first
   *
   * @param promise - The Promise to add timeout protection to
   * @param timeoutMs - Timeout in milliseconds
   * @param operation - Optional operation name for better error messages
   * @returns Promise that either resolves with the original result or rejects with TimeoutError
   */
  private addTimeout<T>(promise: Promise<T>, timeoutMs: number, operation?: string): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timeoutId = setTimeout(() => {
        const operationName = operation ? ` for ${operation}` : '';
        reject(
          new TimeoutError(`Operation timed out after ${timeoutMs}ms${operationName}`, timeoutMs)
        );
      }, timeoutMs);

      // Cleanup timeout if the original promise resolves first
      promise.finally(() => clearTimeout(timeoutId));
    });

    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * Wraps any external API call with timeout and error handling
   *
   * @param promise - The promise to wrap with timeout
   * @param operation - Operation name for logging
   * @param customTimeout - Optional custom timeout for this specific call
   * @returns Promise with timeout handling applied
   */
  protected async withTimeout<T>(
    promise: Promise<T>,
    operation: string,
    customTimeout?: number
  ): Promise<T> {
    const timeout = customTimeout ?? this.config.defaultTimeout;

    try {
      return await this.addTimeout(promise, timeout, `${this.config.serviceName} ${operation}`);
    } catch (error) {
      if (this.isTimeoutError(error)) {
        this.config.onTimeout(error, operation);
      } else {
        this.config.onError(error, operation);
      }
      throw error;
    }
  }
}
