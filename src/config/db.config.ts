import mongoose from 'mongoose';
import { env } from './env.config';
import { logger } from './logger.config';

let isConnected = false;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let memoryServerInstance: any = null;

export const connectDatabase = async (uri: string = env.MONGODB_URI): Promise<typeof mongoose> => {
  if (isConnected) {
    return mongoose;
  }

  mongoose.connection.on('connected', () => {
    isConnected = true;
    logger.info('MongoDB connection established successfully');
  });

  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB connection error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    isConnected = false;
    logger.warn('MongoDB connection disconnected');
  });

  try {
    const conn = await mongoose.connect(uri, {
      autoIndex: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 2500,
    });
    isConnected = true;
    return conn;
  } catch (error) {
    if (env.NODE_ENV === 'development') {
      logger.warn(`Could not connect to external MongoDB at ${uri}. Initializing in-memory MongoDB server for development...`);
      try {
        const { MongoMemoryServer } = await import('mongodb-memory-server');
        memoryServerInstance = await MongoMemoryServer.create();
        const memoryUri = memoryServerInstance.getUri();
        logger.info(`In-memory MongoDB running at: ${memoryUri}`);
        const conn = await mongoose.connect(memoryUri, {
          autoIndex: true,
        });
        isConnected = true;
        return conn;
      } catch (memErr) {
        logger.error('Failed to start in-memory MongoDB:', memErr);
        throw error;
      }
    }
    logger.error('Failed to connect to MongoDB:', error);
    throw error;
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  if (!isConnected && !memoryServerInstance) {
    return;
  }
  try {
    await mongoose.connection.close();
    isConnected = false;
    if (memoryServerInstance) {
      await memoryServerInstance.stop();
      memoryServerInstance = null;
    }
    logger.info('MongoDB connection closed');
  } catch (error) {
    logger.error('Error during MongoDB disconnection:', error);
  }
};

export const isDatabaseConnected = (): boolean => isConnected;
