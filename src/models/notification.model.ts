import { Schema, model, Document, Types } from 'mongoose';
import { AnnouncementPriority, ANNOUNCEMENT_PRIORITIES } from './announcement.model';

export const NOTIFICATION_TYPES = [
  'announcement',
  'assignment_deadline',
  'examination_schedule',
  'examination_result',
  'attendance_warning',
  'timetable_change',
  'leave_update',
  'substitution_update',
  'doubt_update',
  'parent_communication',
  'meeting_request',
  'academic_progress',
  'administrative',
  'security',
  'event',
  'emergency',
  'other',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const DELIVERY_STATUSES = ['pending', 'sent', 'delivered', 'partial', 'failed'] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const DELIVERY_CHANNELS = ['in_app', 'email', 'sms', 'push'] as const;
export type DeliveryChannelType = (typeof DELIVERY_CHANNELS)[number];

export interface IChannelDeliveryRecord {
  channel: DeliveryChannelType;
  status: 'pending' | 'delivered' | 'failed' | 'skipped';
  attempts: number;
  lastAttemptAt?: Date;
  deliveredAt?: Date;
  errorMessage?: string;
  providerMessageId?: string;
}

export interface INotification extends Document {
  _id: Types.ObjectId;
  recipient: Types.ObjectId;
  announcement?: Types.ObjectId;
  title: string;
  message: string;
  notificationType: NotificationType;
  category: string;
  priority: AnnouncementPriority;
  relatedEntityType?: string;
  relatedEntityId?: Types.ObjectId;
  eventKey?: string;
  isMandatory: boolean;
  isRead: boolean;
  readAt?: Date;
  deliveryStatus: DeliveryStatus;
  deliveredAt?: Date;
  deliveryChannels: IChannelDeliveryRecord[];
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const channelDeliverySchema = new Schema<IChannelDeliveryRecord>(
  {
    channel: {
      type: String,
      enum: DELIVERY_CHANNELS,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'delivered', 'failed', 'skipped'],
      default: 'pending',
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastAttemptAt: { type: Date },
    deliveredAt: { type: Date },
    errorMessage: { type: String },
    providerMessageId: { type: String },
  },
  { _id: false }
);

const notificationSchema = new Schema<INotification>(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Recipient user reference is required'],
      index: true,
    },
    announcement: {
      type: Schema.Types.ObjectId,
      ref: 'Announcement',
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
      maxlength: [300, 'Title cannot exceed 300 characters'],
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
    },
    notificationType: {
      type: String,
      enum: NOTIFICATION_TYPES,
      default: 'announcement',
      required: true,
      index: true,
    },
    category: {
      type: String,
      default: 'general',
      trim: true,
      index: true,
    },
    priority: {
      type: String,
      enum: ANNOUNCEMENT_PRIORITIES,
      default: 'normal',
      required: true,
      index: true,
    },
    relatedEntityType: {
      type: String,
      trim: true,
    },
    relatedEntityId: {
      type: Schema.Types.ObjectId,
    },
    eventKey: {
      type: String,
      trim: true,
    },
    isMandatory: {
      type: Boolean,
      default: false,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
    },
    deliveryStatus: {
      type: String,
      enum: DELIVERY_STATUSES,
      default: 'pending',
      required: true,
      index: true,
    },
    deliveredAt: {
      type: Date,
    },
    deliveryChannels: {
      type: [channelDeliverySchema],
      default: [],
    },
    expiresAt: {
      type: Date,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret['__v'];
        return ret;
      },
    },
  }
);

// Compound unique index to prevent duplicate notifications for the same event and recipient
notificationSchema.index(
  { recipient: 1, eventKey: 1 },
  {
    unique: true,
    partialFilterExpression: { eventKey: { $exists: true, $type: 'string' } },
  }
);

// Compound unique index to prevent duplicate announcement notifications per recipient
notificationSchema.index(
  { recipient: 1, announcement: 1 },
  {
    unique: true,
    partialFilterExpression: { announcement: { $exists: true, $type: 'objectId' } },
  }
);

// Performance indexes for inbox queries, unread counts, analytics, and history filtering
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, category: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, notificationType: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, priority: 1, createdAt: -1 });
notificationSchema.index({ announcement: 1, isRead: 1 });
notificationSchema.index({ deliveryStatus: 1, createdAt: -1 });

export const Notification = model<INotification>('Notification', notificationSchema);
