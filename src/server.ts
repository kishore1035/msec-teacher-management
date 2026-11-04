import { app } from './app';
import { env } from './config/env.config';
import { connectDatabase, disconnectDatabase } from './config/db.config';
import { logger } from './config/logger.config';
import { SocketService } from './services/socket.service';
import { CentralReportAnalyticsService } from './services/centralReportAnalytics.service';
import http from 'http';

const startServer = async () => {
  try {
    const server = http.createServer(app);
    SocketService.initialize(server);

    server.listen(env.PORT, '0.0.0.0', () => {
      logger.info(`🚀 Teacher Management Backend listening on port ${env.PORT} in ${env.NODE_ENV} mode`);
      logger.info(`Health check available at http://localhost:${env.PORT}/health`);
      logger.info(`Readiness probe available at http://localhost:${env.PORT}/health/ready`);
    });

    await connectDatabase();

    // Periodic expired report cleanup worker (runs every 6 hours, unref'd so it never blocks exit)
    const cleanupTimer = setInterval(async () => {
      try {
        await CentralReportAnalyticsService.cleanupExpiredReports();
      } catch (err) {
        logger.warn('Background report cleanup encountered an error:', err);
      }
    }, 6 * 60 * 60 * 1000);
    cleanupTimer.unref();

    let isShuttingDown = false;
    const shutdown = async (signal: string) => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      logger.info(`Received ${signal}. Starting graceful shutdown...`);
      clearInterval(cleanupTimer);
      await SocketService.close();
      server.close(async () => {
        logger.info('HTTP server closed.');
        await disconnectDatabase();
        process.exit(0);
      });

      // Force shutdown after 10s if connections remain hanging
      const forceTimer = setTimeout(() => {
        logger.error('Forceful shutdown after timeout');
        process.exit(1);
      }, 10000);
      forceTimer.unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled Promise Rejection:', reason);
    });

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      void shutdown('uncaughtException');
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

if (env.NODE_ENV !== 'test') {
  startServer();
}

export default startServer;
