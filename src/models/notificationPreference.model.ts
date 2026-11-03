import { Schema, model, Document, Types } from 'mongoose';

export const PREFERENCE_CATEGORIES = [
  'general',
  'academic',
  'examination',
  'attendance',
  'assignment',
  'timetable',
  'event',
  'emergency',
  'administrative',
  'security',
  'other',
] as const;

export type PreferenceCategory = (typeof PREFERENCE_CATEGORIES)[number];

export interface ICategoryChannelPreference {
  inApp: boolean;
  email: boolean;
  sms: boolean;
  push: boolean;
}

export interface IQuietHours {
  enabled: boolean;
  startTime: string; // HH:mm in 24h format (e.g. "22:00")
  endTime: string;   // HH:mm in 24h format (e.g. "07:00")
  allowUrgent: boolean;
}

export interface INotificationPreference extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  categoryPreferences: Map<string, ICategoryChannelPreference>;
  quietHours: IQuietHours;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}

const categoryChannelPrefSchema = new Schema<ICategoryChannelPreference>(
  {
    inApp: { type: Boolean, default: true },
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: false },
    push: { type: Boolean, default: true },
  },
  { _id: false }
);

const quietHoursSchema = new Schema<IQuietHours>(
  {
    enabled: { type: Boolean, default: false },
    startTime: { type: String, default: '22:00' },
    endTime: { type: String, default: '07:00' },
    allowUrgent: { type: Boolean, default: true },
  },
  { _id: false }
);

const defaultCategoryPreferences = (): Record<string, ICategoryChannelPreference> => {
  const defaults: Record<string, ICategoryChannelPreference> = {};
  for (const cat of PREFERENCE_CATEGORIES) {
    defaults[cat] = {
      inApp: true,
      email: true,
      sms: cat === 'emergency' || cat === 'security' || cat === 'attendance',
      push: true,
    };
  }
  return defaults;
};

const notificationPreferenceSchema = new Schema<INotificationPreference>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      unique: true,
      index: true,
    },
    inAppEnabled: {
      type: Boolean,
      default: true,
    },
    emailEnabled: {
      type: Boolean,
      default: true,
    },
    smsEnabled: {
      type: Boolean,
      default: false,
    },
    pushEnabled: {
      type: Boolean,
      default: true,
    },
    categoryPreferences: {
      type: Map,
      of: categoryChannelPrefSchema,
      default: defaultCategoryPreferences,
    },
    quietHours: {
      type: quietHoursSchema,
      default: () => ({
        enabled: false,
        startTime: '22:00',
        endTime: '07:00',
        allowUrgent: true,
      }),
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata',
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret['__v'];
        if (ret['categoryPreferences'] instanceof Map) {
          ret['categoryPreferences'] = Object.fromEntries(ret['categoryPreferences']);
        }
        return ret;
      },
    },
    toObject: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret['__v'];
        if (ret['categoryPreferences'] instanceof Map) {
          ret['categoryPreferences'] = Object.fromEntries(ret['categoryPreferences']);
        }
        return ret;
      },
    },
  }
);

export const NotificationPreference = model<INotificationPreference>(
  'NotificationPreference',
  notificationPreferenceSchema
);

export interface INotificationDevice extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  deviceToken: string;
  platform: 'web' | 'android' | 'ios';
  deviceName?: string;
  isActive: boolean;
  lastActiveAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const notificationDeviceSchema = new Schema<INotificationDevice>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    deviceToken: {
      type: String,
      required: true,
      trim: true,
    },
    platform: {
      type: String,
      enum: ['web', 'android', 'ios'],
      default: 'web',
    },
    deviceName: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
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

notificationDeviceSchema.index({ user: 1, deviceToken: 1 }, { unique: true });

export const NotificationDevice = model<INotificationDevice>(
  'NotificationDevice',
  notificationDeviceSchema
);
