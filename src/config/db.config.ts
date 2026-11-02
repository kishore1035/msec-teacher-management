import mongoose from 'mongoose';
import { env } from './env.config';
import { logger } from './logger.config';

let isConnected = false;

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
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
    return conn;
  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);
    throw error;
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  if (!isConnected) {
    return;
  }
  try {
    await mongoose.connection.close();
    isConnected = false;
    logger.info('MongoDB connection closed');
  } catch (error) {
    logger.error('Error during MongoDB disconnection:', error);
  }
};

export const isDatabaseConnected = (): boolean => isConnected;
