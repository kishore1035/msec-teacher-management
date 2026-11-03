import { app } from './app';
import { env } from './config/env.config';
import { connectDatabase, disconnectDatabase } from './config/db.config';
import { logger } from './config/logger.config';
import { SocketService } from './services/socket.service';
import http from 'http';

const startServer = async () => {
  try {
    const server = http.createServer(app);
    SocketService.initialize(server);

    server.listen(env.PORT, '0.0.0.0', () => {
      logger.info(`🚀 Teacher Management Backend listening on port ${env.PORT} in ${env.NODE_ENV} mode`);
      logger.info(`Health check available at http://localhost:${env.PORT}/api/v1/health`);
    });

    await connectDatabase();

    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);
      await SocketService.close();
      server.close(async () => {
        logger.info('HTTP server closed.');
        await disconnectDatabase();
        process.exit(0);
      });

      // Force shutdown after 10s if connections remain hanging
      setTimeout(() => {
        logger.error('Forceful shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

if (env.NODE_ENV !== 'test') {
  startServer();
}

export default startServer;
