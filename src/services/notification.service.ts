import { Types } from 'mongoose';
import {
  Notification,
  INotification,
  NotificationType,
} from '../models/notification.model';
import { IAnnouncement, AnnouncementPriority } from '../models/announcement.model';
import { NotificationPreferenceService } from './notificationPreference.service';
import { NotificationDeliveryService } from './notificationDelivery.service';
import { SocketService } from './socket.service';
import { calculatePagination } from '../utils/pagination';
import { ApiError } from '../utils/apiError';
import { HTTP_STATUS } from '../constants/statusCodes';
import { ROLES } from '../constants/roles.constant';
import { env } from '../config/env.config';

export interface CreateEventNotificationInput {
  recipient: string | Types.ObjectId;
  title: string;
  message: string;
  notificationType: NotificationType;
  category?: string;
  priority?: AnnouncementPriority;
  announcement?: string | Types.ObjectId;
  relatedEntityType?: string;
  relatedEntityId?: string | Types.ObjectId;
  eventKey?: string;
  isMandatory?: boolean;
  expiresAt?: Date;
}

export class NotificationService {
  /**
   * Create a single event notification with strict deduplication by (recipient, eventKey) or (recipient, announcement)
   */
  public static async createEventNotification(
    input: CreateEventNotificationInput
  ): Promise<{ notification: INotification; created: boolean }> {
    const recipientObjId = new Types.ObjectId(input.recipient.toString());
    const category = input.category || this.mapTypeToCategory(input.notificationType);
    const priority = input.priority || 'normal';
    const isMandatory =
      input.isMandatory ??
      (category === 'emergency' || category === 'security' || priority === 'urgent');

    // Check existing notification to prevent duplicates for the same event & recipient
    if (input.eventKey) {
      const existing = await Notification.findOne({
        recipient: recipientObjId,
        eventKey: input.eventKey,
      });
      if (existing) {
        return { notification: existing, created: false };
      }
    }

    if (input.announcement) {
      const existingAnn = await Notification.findOne({
        recipient: recipientObjId,
        announcement: new Types.ObjectId(input.announcement.toString()),
      });
      if (existingAnn) {
        return { notification: existingAnn, created: false };
      }
    }

    const channels = await NotificationPreferenceService.evaluateChannelsForRecipient(
      recipientObjId,
      category,
      priority,
      isMandatory
    );

    try {
      const notification = await Notification.create({
        recipient: recipientObjId,
        announcement: input.announcement
          ? new Types.ObjectId(input.announcement.toString())
          : undefined,
        title: input.title,
        message: input.message,
        notificationType: input.notificationType,
        category,
        priority,
        relatedEntityType: input.relatedEntityType,
        relatedEntityId: input.relatedEntityId
          ? new Types.ObjectId(input.relatedEntityId.toString())
          : undefined,
        eventKey: input.eventKey,
        isMandatory,
        isRead: false,
        deliveryStatus: 'pending',
        deliveryChannels: channels.map((ch) => ({
          channel: ch,
          status: 'pending',
          attempts: 0,
        })),
        expiresAt: input.expiresAt,
      });

      const delivered = await NotificationDeliveryService.deliverNotification(
        notification,
        channels
      );

      return { notification: delivered || notification, created: true };
    } catch (err: unknown) {
      // Handle race-condition duplicate key (E11000)
      if ((err as { code?: number })?.code === 11000) {
        const existing = await Notification.findOne({
          recipient: recipientObjId,
          ...(input.eventKey
            ? { eventKey: input.eventKey }
            : { announcement: new Types.ObjectId(input.announcement!.toString()) }),
        });
        if (existing) {
          return { notification: existing, created: false };
        }
      }
      throw err;
    }
  }

  /**
   * Generate notifications for an announcement across a resolved list of recipients using chunked bulk operations
   */
  public static async generateForAnnouncement(
    announcement: IAnnouncement,
    recipientIds: Types.ObjectId[]
  ): Promise<{ totalTargeted: number; createdCount: number }> {
    if (recipientIds.length === 0) {
      return { totalTargeted: 0, createdCount: 0 };
    }

    const uniqueRecipientIds = Array.from(
      new Set(recipientIds.map((id) => id.toString()))
    ).map((id) => new Types.ObjectId(id));

    const batchSize = env.NOTIFICATION_BATCH_SIZE || 500;
    const category = announcement.announcementType || 'general';
    const isMandatory =
      announcement.isMandatory ||
      announcement.announcementType === 'emergency' ||
      announcement.priority === 'urgent';
    const eventKeyPrefix = `announcement:${announcement._id.toString()}`;

    let createdCount = 0;

    for (let i = 0; i < uniqueRecipientIds.length; i += batchSize) {
      const chunk = uniqueRecipientIds.slice(i, i + batchSize);

      // Find which recipients in this chunk already have a notification for this announcement
      const existingDocs = await Notification.find({
        announcement: announcement._id,
        recipient: { $in: chunk },
      })
        .select('recipient')
        .lean();

      const existingRecipientSet = new Set(
        existingDocs.map((d) => d.recipient.toString())
      );

      const newRecipients = chunk.filter(
        (uid) => !existingRecipientSet.has(uid.toString())
      );

      if (newRecipients.length === 0) {
        continue;
      }

      // Evaluate channels for each recipient in parallel
      const recipientChannelPairs = await Promise.all(
        newRecipients.map(async (uid) => {
          const channels =
            await NotificationPreferenceService.evaluateChannelsForRecipient(
              uid,
              category,
              announcement.priority,
              isMandatory
            );
          return { uid, channels };
        })
      );

      const bulkOps = recipientChannelPairs.map(({ uid, channels }) => ({
        updateOne: {
          filter: {
            recipient: uid,
            announcement: announcement._id,
          },
          update: {
            $setOnInsert: {
              recipient: uid,
              announcement: announcement._id,
              title: announcement.title,
              message: announcement.summary || announcement.content.slice(0, 300),
              notificationType: (announcement.announcementType === 'emergency'
                ? 'emergency'
                : announcement.announcementType === 'event'
                ? 'event'
                : 'announcement') as NotificationType,
              category,
              priority: announcement.priority,
              relatedEntityType: 'Announcement',
              relatedEntityId: announcement._id,
              eventKey: eventKeyPrefix,
              isMandatory,
              isRead: false,
              deliveryStatus: 'pending' as const,
              deliveryChannels: channels.map((ch) => ({
                channel: ch,
                status: 'pending' as const,
                attempts: 0,
              })),
              expiresAt: announcement.expiresAt,
            },
          },
          upsert: true,
        },
      }));

      const bulkRes = await Notification.bulkWrite(bulkOps, { ordered: false });
      createdCount += bulkRes.upsertedCount || 0;

      // Fetch newly created notifications for delivery dispatch
      const createdNotifications = await Notification.find({
        announcement: announcement._id,
        recipient: { $in: newRecipients },
      });

      const channelLookup = new Map(
        recipientChannelPairs.map((p) => [p.uid.toString(), p.channels])
      );

      const deliveryItems = createdNotifications.map((notif) => ({
        notification: notif,
        channels: channelLookup.get(notif.recipient.toString()) || ['in_app'],
      }));

      await NotificationDeliveryService.dispatchBatchAsync(deliveryItems);
    }

    return {
      totalTargeted: uniqueRecipientIds.length,
      createdCount,
    };
  }

  /**
   * Reusable helper: Assignment deadline notification
   */
  public static async notifyAssignmentDeadline(params: {
    recipients: (string | Types.ObjectId)[];
    assignmentId: string | Types.ObjectId;
    assignmentTitle: string;
    dueDate: Date;
    priority?: AnnouncementPriority;
  }): Promise<number> {
    let createdCount = 0;
    for (const recipient of params.recipients) {
      const res = await this.createEventNotification({
        recipient,
        title: `Assignment Due: ${params.assignmentTitle}`,
        message: `Assignment "${params.assignmentTitle}" is due on ${new Date(params.dueDate).toISOString()}.`,
        notificationType: 'assignment_deadline',
        category: 'assignment',
        priority: params.priority || 'high',
        relatedEntityType: 'Assignment',
        relatedEntityId: params.assignmentId,
        eventKey: `assignment_deadline:${params.assignmentId.toString()}`,
      });
      if (res.created) createdCount += 1;
    }
    return createdCount;
  }

  /**
   * Reusable helper: Examination schedule or result publication notification
   */
  public static async notifyExaminationEvent(params: {
    recipients: (string | Types.ObjectId)[];
    examinationId: string | Types.ObjectId;
    eventType: 'schedule' | 'result';
    title: string;
    message: string;
    priority?: AnnouncementPriority;
  }): Promise<number> {
    let createdCount = 0;
    const notifType: NotificationType =
      params.eventType === 'schedule' ? 'examination_schedule' : 'examination_result';
    for (const recipient of params.recipients) {
      const res = await this.createEventNotification({
        recipient,
        title: params.title,
        message: params.message,
        notificationType: notifType,
        category: 'examination',
        priority: params.priority || 'high',
        relatedEntityType: 'Examination',
        relatedEntityId: params.examinationId,
        eventKey: `exam_${params.eventType}:${params.examinationId.toString()}`,
      });
      if (res.created) createdCount += 1;
    }
    return createdCount;
  }

  /**
   * Reusable helper: Attendance shortage/warning notification
   */
  public static async notifyAttendanceWarning(params: {
    recipients: (string | Types.ObjectId)[];
    studentId: string | Types.ObjectId;
    subjectId?: string | Types.ObjectId;
    percentage: number;
    threshold: number;
    periodKey?: string;
  }): Promise<number> {
    let createdCount = 0;
    const keySuffix = params.periodKey || new Date().toISOString().slice(0, 10);
    for (const recipient of params.recipients) {
      const res = await this.createEventNotification({
        recipient,
        title: 'Attendance Shortage Warning',
        message: `Attendance is currently at ${params.percentage.toFixed(1)}%, which is below the institutional threshold of ${params.threshold}%.`,
        notificationType: 'attendance_warning',
        category: 'attendance',
        priority: 'high',
        relatedEntityType: 'Student',
        relatedEntityId: params.studentId,
        eventKey: `attendance_warning:${params.studentId.toString()}:${params.subjectId?.toString() || 'overall'}:${keySuffix}`,
      });
      if (res.created) createdCount += 1;
    }
    return createdCount;
  }

  /**
   * Reusable helper: Timetable change notification
   */
  public static async notifyTimetableChange(params: {
    recipients: (string | Types.ObjectId)[];
    timetableChangeId: string | Types.ObjectId;
    changeType: string;
    message: string;
  }): Promise<number> {
    let createdCount = 0;
    for (const recipient of params.recipients) {
      const res = await this.createEventNotification({
        recipient,
        title: `Timetable Update: ${params.changeType.replace('_', ' ').toUpperCase()}`,
        message: params.message,
        notificationType: 'timetable_change',
        category: 'timetable',
        priority: 'normal',
        relatedEntityType: 'TimetableChange',
        relatedEntityId: params.timetableChangeId,
        eventKey: `timetable_change:${params.timetableChangeId.toString()}`,
      });
      if (res.created) createdCount += 1;
    }
    return createdCount;
  }

  /**
   * Reusable helper: Leave and substitution update notification
   */
  public static async notifyLeaveOrSubstitution(params: {
    recipients: (string | Types.ObjectId)[];
    entityId: string | Types.ObjectId;
    updateType: 'leave_update' | 'substitution_update';
    title: string;
    message: string;
  }): Promise<number> {
    let createdCount = 0;
    for (const recipient of params.recipients) {
      const res = await this.createEventNotification({
        recipient,
        title: params.title,
        message: params.message,
        notificationType: params.updateType,
        category: 'timetable',
        priority: 'normal',
        relatedEntityType:
          params.updateType === 'leave_update' ? 'TeacherLeave' : 'TimetableChange',
        relatedEntityId: params.entityId,
        eventKey: `${params.updateType}:${params.entityId.toString()}`,
      });
      if (res.created) createdCount += 1;
    }
    return createdCount;
  }

  /**
   * Get paginated notifications for a specific user
   */
  public static async getUserNotifications(
    userId: string,
    query: {
      isRead?: boolean;
      category?: string;
      notificationType?: string;
      priority?: string;
      startDate?: string;
      endDate?: string;
      includeExpired?: boolean;
      page?: number;
      limit?: number;
    } = {}
  ) {
    const now = new Date();
    const filter: Record<string, unknown> = {
      recipient: new Types.ObjectId(userId),
    };

    if (!query.includeExpired) {
      filter.$or = [
        { expiresAt: { $exists: false } },
        { expiresAt: null },
        { expiresAt: { $gt: now } },
      ];
    }

    if (query.isRead !== undefined) {
      filter.isRead = query.isRead;
    }
    if (query.category) {
      filter.category = query.category;
    }
    if (query.notificationType) {
      filter.notificationType = query.notificationType;
    }
    if (query.priority) {
      filter.priority = query.priority;
    }
    if (query.startDate || query.endDate) {
      const dateFilter: Record<string, Date> = {};
      if (query.startDate) dateFilter.$gte = new Date(query.startDate);
      if (query.endDate) dateFilter.$lte = new Date(query.endDate);
      filter.createdAt = dateFilter;
    }

    const total = await Notification.countDocuments(filter);
    const meta = calculatePagination(query.page, query.limit, total);
    const skip = (meta.page - 1) * meta.limit;

    const items = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(meta.limit);

    return { items, meta };
  }

  /**
   * Get notification history for a user (including expired notifications, filterable by category and date)
   */
  public static async getNotificationHistory(
    userId: string,
    query: {
      category?: string;
      notificationType?: string;
      isRead?: boolean;
      priority?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    } = {}
  ) {
    return this.getUserNotifications(userId, {
      ...query,
      includeExpired: true,
    });
  }

  /**
   * Get unread notification count for a user
   */
  public static async getUnreadCount(userId: string): Promise<{ unreadCount: number }> {
    const now = new Date();
    const unreadCount = await Notification.countDocuments({
      recipient: new Types.ObjectId(userId),
      isRead: false,
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: null },
        { expiresAt: { $gt: now } },
      ],
    });
    return { unreadCount };
  }

  /**
   * Get a single notification by ID (strictly enforcing recipient ownership)
   */
  public static async getNotificationById(
    userId: string,
    notificationId: string
  ): Promise<INotification> {
    const notification = await Notification.findById(notificationId);
    if (!notification) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Notification not found');
    }
    if (notification.recipient.toString() !== userId) {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        'You do not have permission to access another user notification'
      );
    }
    return notification;
  }

  /**
   * Mark a single notification as read (strictly enforcing recipient ownership)
   */
  public static async markAsRead(
    userId: string,
    notificationId: string
  ): Promise<INotification> {
    const notification = await Notification.findById(notificationId);
    if (!notification) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Notification not found');
    }
    if (notification.recipient.toString() !== userId) {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        'You can only modify the read status of your own notifications'
      );
    }

    if (!notification.isRead) {
      notification.isRead = true;
      notification.readAt = new Date();
      await notification.save();

      SocketService.emitToUser(userId, 'notification:read', {
        notificationId: notification._id.toString(),
        readAt: notification.readAt,
      });
    }

    return notification;
  }

  /**
   * Mark all unread notifications for a user as read
   */
  public static async markAllAsRead(
    userId: string,
    category?: string
  ): Promise<{ modifiedCount: number; readAt: Date }> {
    const readAt = new Date();
    const filter: Record<string, unknown> = {
      recipient: new Types.ObjectId(userId),
      isRead: false,
    };
    if (category) {
      filter.category = category;
    }

    const res = await Notification.updateMany(filter, {
      $set: {
        isRead: true,
        readAt,
      },
    });

    SocketService.emitToUser(userId, 'notification:read_all', {
      modifiedCount: res.modifiedCount,
      readAt,
    });

    return {
      modifiedCount: res.modifiedCount,
      readAt,
    };
  }

  /**
   * Get delivery status summary (user's own notifications or institution-wide for admins)
   */
  public static async getDeliveryStatus(
    userId: string,
    userRole: string,
    query: {
      announcementId?: string;
      deliveryStatus?: string;
      page?: number;
      limit?: number;
    } = {}
  ) {
    const filter: Record<string, unknown> = {};
    if (userRole !== ROLES.ADMIN && userRole !== ROLES.SUPER_ADMIN) {
      filter.recipient = new Types.ObjectId(userId);
    }
    if (query.announcementId) {
      filter.announcement = new Types.ObjectId(query.announcementId);
    }
    if (query.deliveryStatus) {
      filter.deliveryStatus = query.deliveryStatus;
    }

    const total = await Notification.countDocuments(filter);
    const meta = calculatePagination(query.page, query.limit, total);
    const skip = (meta.page - 1) * meta.limit;

    const [items, statusAggregation] = await Promise.all([
      Notification.find(filter)
        .select(
          'recipient announcement title notificationType priority deliveryStatus deliveredAt deliveryChannels createdAt'
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(meta.limit),
      Notification.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$deliveryStatus',
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const summary: Record<string, number> = {
      pending: 0,
      sent: 0,
      delivered: 0,
      partial: 0,
      failed: 0,
    };
    for (const row of statusAggregation) {
      if (row._id && row._id in summary) {
        summary[row._id] = row.count;
      }
    }

    return { summary, items, meta };
  }

  /**
   * Retention policy cleanup:
   * Only purges old READ, non-mandatory notifications older than NOTIFICATION_RETENTION_DAYS.
   * NEVER deletes unread notifications or mandatory/high-priority unread records.
   */
  public static async applyRetentionPolicy(
    retentionDays: number = env.NOTIFICATION_RETENTION_DAYS
  ): Promise<{ deletedCount: number }> {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const result = await Notification.deleteMany({
      isRead: true,
      isMandatory: false,
      priority: { $nin: ['high', 'urgent'] },
      createdAt: { $lt: cutoffDate },
    });
    return { deletedCount: result.deletedCount || 0 };
  }

  private static mapTypeToCategory(type: NotificationType): string {
    switch (type) {
      case 'assignment_deadline':
        return 'assignment';
      case 'examination_schedule':
      case 'examination_result':
        return 'examination';
      case 'attendance_warning':
        return 'attendance';
      case 'timetable_change':
      case 'leave_update':
      case 'substitution_update':
        return 'timetable';
      case 'security':
        return 'security';
      case 'emergency':
        return 'emergency';
      case 'event':
        return 'event';
      case 'administrative':
        return 'administrative';
      default:
        return 'general';
    }
  }
}
