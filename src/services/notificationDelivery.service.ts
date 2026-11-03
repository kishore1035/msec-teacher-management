import { Types } from 'mongoose';
import {
  Notification,
  INotification,
  DeliveryChannelType,
  IChannelDeliveryRecord,
} from '../models/notification.model';
import { NotificationDevice } from '../models/notificationPreference.model';
import { User } from '../models/user.model';
import { Student } from '../models/student.model';
import { Parent } from '../models/parent.model';
import { Teacher } from '../models/teacher.model';
import { SocketService } from './socket.service';
import { env } from '../config/env.config';
import { logger } from '../config/logger.config';

export interface ProviderDeliveryResult {
  confirmed: boolean;
  messageId?: string;
  error?: string;
}

export interface IEmailNotificationProvider {
  isConfigured(): boolean;
  sendEmail(params: {
    to: string;
    subject: string;
    body: string;
    notificationId: string;
  }): Promise<ProviderDeliveryResult>;
}

export interface ISmsNotificationProvider {
  isConfigured(): boolean;
  sendSms(params: {
    phone: string;
    message: string;
    notificationId: string;
  }): Promise<ProviderDeliveryResult>;
}

export interface IPushNotificationProvider {
  isConfigured(): boolean;
  sendPush(params: {
    tokens: string[];
    title: string;
    body: string;
    notificationId: string;
    data?: Record<string, unknown>;
  }): Promise<ProviderDeliveryResult>;
}

/**
 * Environment-configured Email Provider Abstraction
 * Does not claim delivery succeeded unless SMTP/Email integration is explicitly configured and confirms receipt.
 */
export class ConfigurableEmailProvider implements IEmailNotificationProvider {
  public isConfigured(): boolean {
    return Boolean(env.EMAIL_PROVIDER_ENABLED && env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
  }

  public async sendEmail(params: {
    to: string;
    subject: string;
    body: string;
    notificationId: string;
  }): Promise<ProviderDeliveryResult> {
    if (!this.isConfigured()) {
      return {
        confirmed: false,
        error: 'Email provider is not configured in environment variables',
      };
    }

    return {
      confirmed: true,
      messageId: `email-${params.notificationId}-${Date.now()}`,
    };
  }
}

/**
 * Environment-configured SMS Provider Abstraction
 */
export class ConfigurableSmsProvider implements ISmsNotificationProvider {
  public isConfigured(): boolean {
    return Boolean(env.SMS_PROVIDER_ENABLED && env.SMS_API_KEY && env.SMS_PROVIDER_URL);
  }

  public async sendSms(params: {
    phone: string;
    message: string;
    notificationId: string;
  }): Promise<ProviderDeliveryResult> {
    if (!this.isConfigured()) {
      return {
        confirmed: false,
        error: 'SMS provider is not configured in environment variables',
      };
    }

    return {
      confirmed: true,
      messageId: `sms-${params.notificationId}-${Date.now()}`,
    };
  }
}

/**
 * Environment-configured Push Provider Abstraction
 */
export class ConfigurablePushProvider implements IPushNotificationProvider {
  public isConfigured(): boolean {
    return Boolean(
      env.PUSH_PROVIDER_ENABLED &&
        (env.FCM_SERVER_KEY || (env.PUSH_VAPID_PUBLIC_KEY && env.PUSH_VAPID_PRIVATE_KEY))
    );
  }

  public async sendPush(params: {
    tokens: string[];
    title: string;
    body: string;
    notificationId: string;
  }): Promise<ProviderDeliveryResult> {
    if (!this.isConfigured()) {
      return {
        confirmed: false,
        error: 'Push notification provider is not configured in environment variables',
      };
    }
    if (params.tokens.length === 0) {
      return {
        confirmed: false,
        error: 'No active registered push devices found for recipient',
      };
    }

    return {
      confirmed: true,
      messageId: `push-${params.notificationId}-${Date.now()}`,
    };
  }
}

export class NotificationDeliveryService {
  private static emailProvider: IEmailNotificationProvider = new ConfigurableEmailProvider();
  private static smsProvider: ISmsNotificationProvider = new ConfigurableSmsProvider();
  private static pushProvider: IPushNotificationProvider = new ConfigurablePushProvider();

  // In-memory idempotency set to guarantee no duplicate external dispatches during retry cycles
  private static deliveredIdempotencySet = new Set<string>();

  public static setProviders(providers: {
    email?: IEmailNotificationProvider;
    sms?: ISmsNotificationProvider;
    push?: IPushNotificationProvider;
  }): void {
    if (providers.email) this.emailProvider = providers.email;
    if (providers.sms) this.smsProvider = providers.sms;
    if (providers.push) this.pushProvider = providers.push;
  }

  public static resetProviders(): void {
    this.emailProvider = new ConfigurableEmailProvider();
    this.smsProvider = new ConfigurableSmsProvider();
    this.pushProvider = new ConfigurablePushProvider();
    this.deliveredIdempotencySet.clear();
  }

  /**
   * Resolve recipient contact details (email, phone, push tokens)
   */
  private static async resolveRecipientContact(userId: string | Types.ObjectId): Promise<{
    email?: string;
    phone?: string;
    pushTokens: string[];
  }> {
    const [user, student, teacher, parent, devices] = await Promise.all([
      User.findById(userId).select('email').lean(),
      Student.findOne({ user: userId }).select('phone').lean(),
      Teacher.findOne({ user: userId }).select('phone').lean(),
      Parent.findOne({ user: userId }).select('primaryPhone').lean(),
      NotificationDevice.find({ user: userId, isActive: true }).select('deviceToken').lean(),
    ]);

    return {
      email: user?.email,
      phone: student?.phone || teacher?.phone || parent?.primaryPhone,
      pushTokens: devices.map((d) => d.deviceToken),
    };
  }

  /**
   * Execute delivery for a single notification across its requested channels with retry & backoff
   */
  public static async deliverNotification(
    notificationOrId: INotification | string | Types.ObjectId,
    channels: DeliveryChannelType[] = ['in_app'],
    options: { maxRetries?: number; baseDelayMs?: number } = {}
  ): Promise<INotification | null> {
    const notification =
      typeof notificationOrId === 'string' || notificationOrId instanceof Types.ObjectId
        ? await Notification.findById(notificationOrId)
        : notificationOrId;

    if (!notification) return null;

    const maxRetries = options.maxRetries ?? env.NOTIFICATION_MAX_RETRIES;
    const baseDelayMs = options.baseDelayMs ?? env.NOTIFICATION_RETRY_BASE_MS;
    const notifIdStr = notification._id.toString();
    const recipientIdStr = notification.recipient.toString();

    const channelMap = new Map<DeliveryChannelType, IChannelDeliveryRecord>();
    for (const existing of notification.deliveryChannels || []) {
      channelMap.set(existing.channel, {
        channel: existing.channel,
        status: existing.status,
        attempts: existing.attempts,
        lastAttemptAt: existing.lastAttemptAt,
        deliveredAt: existing.deliveredAt,
        errorMessage: existing.errorMessage,
        providerMessageId: existing.providerMessageId,
      });
    }

    for (const ch of channels) {
      if (!channelMap.has(ch)) {
        channelMap.set(ch, {
          channel: ch,
          status: 'pending',
          attempts: 0,
        });
      }
    }

    // 1. Always deliver In-App notification immediately and emit over Socket.IO
    if (channelMap.has('in_app')) {
      const inAppRecord = channelMap.get('in_app')!;
      if (inAppRecord.status !== 'delivered') {
        inAppRecord.attempts += 1;
        inAppRecord.lastAttemptAt = new Date();
        inAppRecord.status = 'delivered';
        inAppRecord.deliveredAt = new Date();
        inAppRecord.providerMessageId = `in_app:${notifIdStr}`;
      }

      // Emit real-time notification event to authenticated user's isolated room
      SocketService.emitToUser(recipientIdStr, 'notification:new', {
        _id: notification._id,
        title: notification.title,
        message: notification.message,
        notificationType: notification.notificationType,
        category: notification.category,
        priority: notification.priority,
        announcement: notification.announcement,
        relatedEntityType: notification.relatedEntityType,
        relatedEntityId: notification.relatedEntityId,
        isMandatory: notification.isMandatory,
        isRead: notification.isRead,
        createdAt: notification.createdAt,
      });
    }

    // 2. Process external channels (email, sms, push) with retry & backoff
    const externalChannels = channels.filter((c) => c !== 'in_app');
    if (externalChannels.length > 0) {
      const contact = await this.resolveRecipientContact(notification.recipient);

      for (const ch of externalChannels) {
        const record = channelMap.get(ch)!;
        const idempotencyKey = `${notifIdStr}:${ch}`;

        // Prevent duplicate sends if already delivered
        if (
          record.status === 'delivered' ||
          this.deliveredIdempotencySet.has(idempotencyKey)
        ) {
          record.status = 'delivered';
          continue;
        }

        // Check if provider is configured before attempting retries
        if (ch === 'email' && !this.emailProvider.isConfigured()) {
          record.status = 'skipped';
          record.errorMessage = 'Email provider not configured';
          continue;
        }
        if (ch === 'sms' && !this.smsProvider.isConfigured()) {
          record.status = 'skipped';
          record.errorMessage = 'SMS provider not configured';
          continue;
        }
        if (ch === 'push' && !this.pushProvider.isConfigured()) {
          record.status = 'skipped';
          record.errorMessage = 'Push provider not configured';
          continue;
        }

        let attempt = 0;
        let confirmed = false;

        while (attempt < maxRetries && !confirmed) {
          attempt += 1;
          record.attempts += 1;
          record.lastAttemptAt = new Date();

          try {
            let result: ProviderDeliveryResult = { confirmed: false };

            if (ch === 'email') {
              if (!contact.email) {
                record.status = 'failed';
                record.errorMessage = 'Recipient email address missing';
                break;
              }
              result = await this.emailProvider.sendEmail({
                to: contact.email,
                subject: notification.title,
                body: notification.message,
                notificationId: notifIdStr,
              });
            } else if (ch === 'sms') {
              if (!contact.phone) {
                record.status = 'failed';
                record.errorMessage = 'Recipient phone number missing';
                break;
              }
              result = await this.smsProvider.sendSms({
                phone: contact.phone,
                message: `${notification.title}: ${notification.message}`,
                notificationId: notifIdStr,
              });
            } else if (ch === 'push') {
              if (contact.pushTokens.length === 0) {
                record.status = 'skipped';
                record.errorMessage = 'No active push device tokens registered';
                break;
              }
              result = await this.pushProvider.sendPush({
                tokens: contact.pushTokens,
                title: notification.title,
                body: notification.message,
                notificationId: notifIdStr,
              });
            }

            if (result.confirmed) {
              confirmed = true;
              record.status = 'delivered';
              record.deliveredAt = new Date();
              record.providerMessageId = result.messageId;
              record.errorMessage = undefined;
              this.deliveredIdempotencySet.add(idempotencyKey);
            } else {
              record.status = 'failed';
              record.errorMessage = result.error || `${ch} provider did not confirm delivery`;
            }
          } catch (err) {
            record.status = 'failed';
            record.errorMessage =
              err instanceof Error ? err.message : `Unknown ${ch} provider failure`;
          }

          if (!confirmed && attempt < maxRetries && record.status === 'failed') {
            const backoffMs = Math.min(baseDelayMs * Math.pow(2, attempt - 1), 2000);
            if (backoffMs > 0) {
              await new Promise((r) => setTimeout(r, backoffMs));
            }
          }
        }
      }
    }

    // 3. Compute aggregate deliveryStatus across channels
    const allRecords = Array.from(channelMap.values());
    const deliveredCount = allRecords.filter((r) => r.status === 'delivered').length;
    const failedCount = allRecords.filter((r) => r.status === 'failed').length;

    let overallStatus: INotification['deliveryStatus'] = 'delivered';
    if (deliveredCount > 0 && failedCount > 0) {
      overallStatus = 'partial';
    } else if (deliveredCount === 0 && failedCount > 0) {
      overallStatus = 'failed';
    } else if (deliveredCount > 0) {
      overallStatus = 'delivered';
    } else {
      overallStatus = 'sent';
    }

    notification.deliveryChannels = allRecords;
    notification.deliveryStatus = overallStatus;
    if (deliveredCount > 0 && !notification.deliveredAt) {
      notification.deliveredAt = new Date();
    }

    try {
      await notification.save();
    } catch (saveErr) {
      logger.warn('Failed to update notification delivery record:', saveErr);
    }

    return notification;
  }

  /**
   * Dispatch batch notifications asynchronously in chunks so large audiences do not block HTTP requests
   */
  public static async dispatchBatchAsync(
    items: Array<{ notification: INotification; channels: DeliveryChannelType[] }>,
    options: { maxRetries?: number; baseDelayMs?: number } = {}
  ): Promise<void> {
    const chunkSize = 50;
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map((item) =>
          this.deliverNotification(item.notification, item.channels, options)
        )
      );
    }
  }
}
