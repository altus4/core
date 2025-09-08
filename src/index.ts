/**
 * Entry point for the Altus4 application.
 *
 * Sets up the Express server, middleware, routes, and error handling.
 * Loads environment variables and configures security, logging, and health checks.
 *
 * Usage:
 *   - Instantiate AltusServer to start the application
 */
import { config } from '@/config';
import { createApp } from '@/app';
import { logger } from '@/utils/logger';
import { createServer } from 'http';

/**
 * Main server class for Altus4.
 * Handles initialization, middleware, routes, and error handling.
 */
class AltusServer {
  /**
   * Express application instance.
   */
  private app: ReturnType<typeof createApp>;

  /**
   * HTTP server instance.
   */
  private server: any;

  /**
   * Initialize the server, middleware, routes, and error handling.
   */
  constructor() {
    this.app = createApp();
  }

  private setupErrorHandling(): void {
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', error => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });
  }

  public async start(): Promise<void> {
    try {
      const port = config.port || 3000;

      this.server = createServer(this.app);

      this.server.listen(port, () => {
        logger.info(`🚀 Altus 4 Server started on port ${port}`);
        logger.info(`🌍 Environment: ${config.environment}`);
        logger.info(`📊 Health check: http://localhost:${port}/health`);
      });

      // Graceful shutdown
      process.on('SIGTERM', () => this.gracefulShutdown());
      process.on('SIGINT', () => this.gracefulShutdown());
    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  public getApp() {
    return this.app;
  }

  private async gracefulShutdown(): Promise<void> {
    logger.info('🛑 Graceful shutdown initiated...');

    if (this.server) {
      this.server.close(() => {
        logger.info('✅ HTTP server closed');
        process.exit(0);
      });
    }
  }
}

// Start the server
const altusServer = new AltusServer();
altusServer.start().catch(error => {
  logger.error('Failed to start Altus 4:', error);
  process.exit(1);
});

export default altusServer;
