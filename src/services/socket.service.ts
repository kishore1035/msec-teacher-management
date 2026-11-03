import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt';
import { User } from '../models/user.model';
import { Notification } from '../models/notification.model';
import { env } from '../config/env.config';
import { logger } from '../config/logger.config';

export interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    email: string;
    role: string;
    sessionId: string;
  };
}

export class SocketService {
  private static io: SocketIOServer | null = null;

  /**
   * Initialize Socket.IO server attached to HTTP server with JWT authentication
   */
  public static initialize(httpServer: HttpServer): SocketIOServer {
    if (this.io) {
      return this.io;
    }

    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN.split(','),
        credentials: true,
        methods: ['GET', 'POST'],
      },
      pingTimeout: 20000,
      pingInterval: 25000,
    });

    // JWT Authentication Middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const authHeader = socket.handshake.headers.authorization;
        const authToken =
          socket.handshake.auth?.['token'] ||
          (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
            ? authHeader.split(' ')[1]
            : undefined) ||
          (typeof socket.handshake.query?.['token'] === 'string'
            ? socket.handshake.query['token']
            : undefined);

        if (!authToken || typeof authToken !== 'string') {
          return next(new Error('Authentication error: Token missing'));
        }

        const decoded = verifyAccessToken(authToken);
        const user = await User.findById(decoded.userId).select('+refreshTokens');

        if (!user || !user.isActive) {
          return next(new Error('Authentication error: User inactive or not found'));
        }

        const activeSession = user.refreshTokens?.find(
          (s) => s.sessionId === decoded.sessionId
        );
        if (!activeSession) {
          return next(new Error('Authentication error: Session expired or revoked'));
        }

        socket.user = {
          id: user._id.toString(),
          email: user.email,
          role: user.role,
          sessionId: decoded.sessionId,
        };

        next();
      } catch (_err) {
        next(new Error('Authentication error: Invalid or expired token'));
      }
    });

    this.io.on('connection', (socket: AuthenticatedSocket) => {
      const user = socket.user;
      if (!user) {
        socket.disconnect(true);
        return;
      }

      const userChannel = this.getUserChannel(user.id);
      socket.join(userChannel);

      logger.debug(`Socket connected for user ${user.id} (${socket.id})`);

      // Emit connection confirmation with isolated channel name
      socket.emit('connected', {
        userId: user.id,
        channel: userChannel,
        timestamp: new Date().toISOString(),
      });

      // Prevent unauthorized room/channel subscription attempts
      socket.on(
        'subscribe:channel',
        (requestedChannel: string, callback?: (res: { success: boolean; error?: string }) => void) => {
          if (requestedChannel !== userChannel) {
            const errMsg = 'Forbidden: Cannot subscribe to another user notification channel';
            socket.emit('error:authorization', { message: errMsg });
            if (typeof callback === 'function') {
              callback({ success: false, error: errMsg });
            }
            return;
          }
          socket.join(userChannel);
          if (typeof callback === 'function') {
            callback({ success: true });
          }
        }
      );

      // Reconnect / Initial State Synchronization handler
      socket.on(
        'notifications:sync',
        async (callback?: (res: { success: boolean; unreadCount: number; recentUnread: unknown[] }) => void) => {
          try {
            const now = new Date();
            const filter = {
              recipient: user.id,
              isRead: false,
              $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: now } }],
            };

            const [unreadCount, recentUnread] = await Promise.all([
              Notification.countDocuments(filter),
              Notification.find(filter).sort({ createdAt: -1 }).limit(20).lean(),
            ]);

            const payload = {
              success: true,
              unreadCount,
              recentUnread,
            };

            socket.emit('notifications:synced', payload);
            if (typeof callback === 'function') {
              callback(payload);
            }
          } catch (_error) {
            if (typeof callback === 'function') {
              callback({ success: false, unreadCount: 0, recentUnread: [] });
            }
          }
        }
      );

      socket.on('disconnect', () => {
        logger.debug(`Socket disconnected for user ${user.id} (${socket.id})`);
      });
    });

    return this.io;
  }

  public static getUserChannel(userId: string): string {
    return `user:${userId}`;
  }

  public static getIO(): SocketIOServer | null {
    return this.io;
  }

  /**
   * Emit a real-time event strictly to a single authenticated user's channel
   */
  public static emitToUser(userId: string, event: string, payload: unknown): boolean {
    if (!this.io) {
      return false;
    }
    const channel = this.getUserChannel(userId.toString());
    this.io.to(channel).emit(event, payload);
    return true;
  }

  /**
   * Emit a real-time event to multiple authenticated users' isolated channels
   */
  public static emitToUsers(userIds: string[], event: string, payload: unknown): void {
    if (!this.io || userIds.length === 0) {
      return;
    }
    for (const uid of userIds) {
      this.emitToUser(uid, event, payload);
    }
  }

  /**
   * Cleanly close Socket.IO server instance (used in tests and graceful shutdown)
   */
  public static async close(): Promise<void> {
    if (this.io) {
      await new Promise<void>((resolve) => {
        this.io?.close(() => resolve());
      });
      this.io = null;
    }
  }
}
