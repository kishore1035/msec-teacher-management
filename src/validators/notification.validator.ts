import { z } from 'zod';
import {
  NOTIFICATION_TYPES,
  DELIVERY_STATUSES,
} from '../models/notification.model';
import { ANNOUNCEMENT_PRIORITIES } from '../models/announcement.model';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const objectIdSchema = z.string().regex(objectIdRegex, 'Invalid MongoDB ObjectId format');

export const listNotificationsQuerySchema = z.object({
  query: z.object({
    isRead: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
    category: z.string().trim().optional(),
    notificationType: z.enum(NOTIFICATION_TYPES).optional(),
    priority: z.enum(ANNOUNCEMENT_PRIORITIES).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    includeExpired: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
    page: z
      .string()
      .transform((v) => parseInt(v, 10))
      .optional(),
    limit: z
      .string()
      .transform((v) => parseInt(v, 10))
      .optional(),
  }),
});

export const notificationIdParamSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

export const markAllReadSchema = z.object({
  body: z
    .object({
      category: z.string().trim().optional(),
    })
    .optional(),
});

const categoryChannelPrefSchema = z.object({
  inApp: z.boolean().optional(),
  email: z.boolean().optional(),
  sms: z.boolean().optional(),
  push: z.boolean().optional(),
});

export const updatePreferencesSchema = z.object({
  body: z.object({
    inAppEnabled: z.boolean().optional(),
    emailEnabled: z.boolean().optional(),
    smsEnabled: z.boolean().optional(),
    pushEnabled: z.boolean().optional(),
    categoryPreferences: z.record(z.string(), categoryChannelPrefSchema).optional(),
    quietHours: z
      .object({
        enabled: z.boolean().optional(),
        startTime: z.string().optional(),
        endTime: z.string().optional(),
        allowUrgent: z.boolean().optional(),
      })
      .optional(),
    timezone: z.string().trim().min(1).optional(),
  }),
});

export const registerDeviceSchema = z.object({
  body: z.object({
    deviceToken: z.string().trim().min(8, 'Device token must be at least 8 characters'),
    platform: z.enum(['web', 'android', 'ios']).optional().default('web'),
    deviceName: z.string().trim().max(120).optional(),
  }),
});

export const deliveryStatusQuerySchema = z.object({
  query: z.object({
    announcementId: objectIdSchema.optional(),
    deliveryStatus: z.enum(DELIVERY_STATUSES).optional(),
    page: z
      .string()
      .transform((v) => parseInt(v, 10))
      .optional(),
    limit: z
      .string()
      .transform((v) => parseInt(v, 10))
      .optional(),
  }),
});

export const createDirectEventNotificationSchema = z.object({
  body: z.object({
    recipients: z.array(objectIdSchema).min(1, 'At least one recipient is required'),
    title: z.string().trim().min(3).max(300),
    message: z.string().trim().min(3),
    notificationType: z.enum(NOTIFICATION_TYPES).optional().default('administrative'),
    category: z.string().trim().optional(),
    priority: z.enum(ANNOUNCEMENT_PRIORITIES).optional().default('normal'),
    relatedEntityType: z.string().trim().optional(),
    relatedEntityId: objectIdSchema.optional(),
    eventKey: z.string().trim().optional(),
    isMandatory: z.boolean().optional(),
    expiresAt: z.string().optional(),
  }),
});
