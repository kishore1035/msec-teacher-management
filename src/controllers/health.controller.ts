import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { Request, Response } from 'express';
import { isDatabaseConnected } from '../config/db.config';
import { AIProviderRegistry } from '../services/aiProvider.service';
import { HTTP_STATUS } from '../constants/statusCodes';

export class HealthController {
  /**
   * GET /health & GET /api/v1/health
   * Overall service health summary (never exposes sensitive credentials or connection strings)
   */
  static async getHealth(_req: Request, res: Response): Promise<void> {
    const dbConnected = isDatabaseConnected();
    res.status(HTTP_STATUS.OK).json({
      success: true,
      status: 'healthy',
      service: 'MSEC Teacher Management & Academic ERP Backend',
      version: '1.0.0',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      dependencies: {
        database: dbConnected ? 'connected' : 'disconnected',
        aiProvider: AIProviderRegistry.resolveProvider().providerName,
      },
    });
  }

  /**
   * GET /health/live & GET /api/v1/health/live
   * Liveness probe verifying the Node.js application process and event loop responsiveness
   */
  static async getLiveness(_req: Request, res: Response): Promise<void> {
    const mem = process.memoryUsage();
    res.status(HTTP_STATUS.OK).json({
      success: true,
      status: 'alive',
      uptime: Math.round(process.uptime()),
      memoryMB: {
        rss: Math.round((mem.rss / (1024 * 1024)) * 100) / 100,
        heapUsed: Math.round((mem.heapUsed / (1024 * 1024)) * 100) / 100,
        heapTotal: Math.round((mem.heapTotal / (1024 * 1024)) * 100) / 100,
      },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * GET /health/ready & GET /api/v1/health/ready
   * Readiness probe verifying MongoDB connectivity, file storage writability, and AI provider initialization
   */
  static async getReadiness(_req: Request, res: Response): Promise<void> {
    let dbReady = isDatabaseConnected() && mongoose.connection.readyState === 1;
    if (dbReady && mongoose.connection.db) {
      try {
        await mongoose.connection.db.admin().ping();
      } catch {
        dbReady = false;
      }
    }

    let storageReady = false;
    try {
      const uploadsDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      fs.accessSync(uploadsDir, fs.constants.R_OK | fs.constants.W_OK);
      storageReady = true;
    } catch {
      storageReady = false;
    }

    const aiReady = Boolean(AIProviderRegistry.resolveProvider()?.providerName);
    const overallReady = dbReady && storageReady && aiReady;

    res.status(overallReady ? HTTP_STATUS.OK : HTTP_STATUS.SERVICE_UNAVAILABLE).json({
      success: overallReady,
      status: overallReady ? 'ready' : 'not_ready',
      checks: {
        database: dbReady ? 'ready' : 'unavailable',
        fileStorage: storageReady ? 'ready' : 'unavailable',
        aiService: aiReady ? 'ready' : 'unavailable',
      },
      timestamp: new Date().toISOString(),
    });
  }
}
