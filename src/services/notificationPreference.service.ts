import { Types } from 'mongoose';
import {
  NotificationPreference,
  INotificationPreference,
  NotificationDevice,
  INotificationDevice,
  PREFERENCE_CATEGORIES,
  ICategoryChannelPreference,
} from '../models/notificationPreference.model';
import { DeliveryChannelType } from '../models/notification.model';
import { AnnouncementPriority } from '../models/announcement.model';
import { ApiError } from '../utils/apiError';
import { HTTP_STATUS } from '../constants/statusCodes';

const MANDATORY_CATEGORIES = new Set(['emergency', 'security']);
const TIME_24H_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export interface UpdatePreferencesDTO {
  inAppEnabled?: boolean;
  emailEnabled?: boolean;
  smsEnabled?: boolean;
  pushEnabled?: boolean;
  categoryPreferences?: Record<string, Partial<ICategoryChannelPreference>>;
  quietHours?: {
    enabled?: boolean;
    startTime?: string;
    endTime?: string;
    allowUrgent?: boolean;
  };
  timezone?: string;
}

export class NotificationPreferenceService {
  /**
   * Validate IANA timezone string
   */
  public static isValidTimezone(tz: string): boolean {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate 24h HH:mm quiet-hour time string
   */
  public static isValidQuietHourTime(timeStr: string): boolean {
    return TIME_24H_REGEX.test(timeStr);
  }

  /**
   * Retrieve or initialize notification preferences for a user
   */
  public static async getOrCreatePreferences(
    userId: string | Types.ObjectId
  ): Promise<INotificationPreference> {
    let pref = await NotificationPreference.findOne({ user: userId });
    if (!pref) {
      pref = await NotificationPreference.create({ user: userId });
    }
    return pref;
  }

  /**
   * Update user's notification preferences with validation and mandatory category protection
   */
  public static async updatePreferences(
    userId: string | Types.ObjectId,
    dto: UpdatePreferencesDTO
  ): Promise<INotificationPreference> {
    if (dto.timezone !== undefined) {
      if (!this.isValidTimezone(dto.timezone)) {
        throw new ApiError(
          HTTP_STATUS.BAD_REQUEST,
          `Invalid timezone '${dto.timezone}'. Must be a valid IANA timezone (e.g. Asia/Kolkata, UTC).`
        );
      }
    }

    if (dto.quietHours) {
      if (
        dto.quietHours.startTime !== undefined &&
        !this.isValidQuietHourTime(dto.quietHours.startTime)
      ) {
        throw new ApiError(
          HTTP_STATUS.BAD_REQUEST,
          'Invalid quietHours.startTime format. Use HH:mm (24-hour format).'
        );
      }
      if (
        dto.quietHours.endTime !== undefined &&
        !this.isValidQuietHourTime(dto.quietHours.endTime)
      ) {
        throw new ApiError(
          HTTP_STATUS.BAD_REQUEST,
          'Invalid quietHours.endTime format. Use HH:mm (24-hour format).'
        );
      }
    }

    // Prevent disabling critical security or emergency notifications
    if (dto.inAppEnabled === false) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        'Global in-app notifications cannot be completely disabled because mandatory security and emergency alerts require delivery'
      );
    }

    if (dto.categoryPreferences) {
      for (const [category, settings] of Object.entries(dto.categoryPreferences)) {
        if (MANDATORY_CATEGORIES.has(category)) {
          if (settings.inApp === false) {
            throw new ApiError(
              HTTP_STATUS.BAD_REQUEST,
              `Cannot disable mandatory '${category}' notifications`
            );
          }
        }
      }
    }

    const pref = await this.getOrCreatePreferences(userId);

    if (dto.inAppEnabled !== undefined) pref.inAppEnabled = dto.inAppEnabled;
    if (dto.emailEnabled !== undefined) pref.emailEnabled = dto.emailEnabled;
    if (dto.smsEnabled !== undefined) pref.smsEnabled = dto.smsEnabled;
    if (dto.pushEnabled !== undefined) pref.pushEnabled = dto.pushEnabled;
    if (dto.timezone !== undefined) pref.timezone = dto.timezone;

    if (dto.quietHours) {
      pref.quietHours = {
        enabled: dto.quietHours.enabled ?? pref.quietHours.enabled,
        startTime: dto.quietHours.startTime ?? pref.quietHours.startTime,
        endTime: dto.quietHours.endTime ?? pref.quietHours.endTime,
        allowUrgent: dto.quietHours.allowUrgent ?? pref.quietHours.allowUrgent,
      };
    }

    if (dto.categoryPreferences) {
      for (const [cat, val] of Object.entries(dto.categoryPreferences)) {
        if (!PREFERENCE_CATEGORIES.includes(cat as (typeof PREFERENCE_CATEGORIES)[number])) {
          throw new ApiError(
            HTTP_STATUS.BAD_REQUEST,
            `Unsupported notification category '${cat}'`
          );
        }
        const existing = pref.categoryPreferences.get(cat) || {
          inApp: true,
          email: true,
          sms: false,
          push: true,
        };
        pref.categoryPreferences.set(cat, {
          inApp: MANDATORY_CATEGORIES.has(cat) ? true : (val.inApp ?? existing.inApp),
          email: MANDATORY_CATEGORIES.has(cat) && val.email === false ? false : (val.email ?? existing.email),
          sms: val.sms ?? existing.sms,
          push: val.push ?? existing.push,
        });
      }
    }

    await pref.save();
    return pref;
  }

  /**
   * Check if current time falls within the user's configured quiet hours
   */
  public static isWithinQuietHours(
    pref: INotificationPreference,
    referenceDate: Date = new Date()
  ): boolean {
    if (!pref.quietHours?.enabled) {
      return false;
    }

    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: pref.timezone || 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      const parts = formatter.formatToParts(referenceDate);
      const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10) % 24;
      const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
      const currentMinutes = hour * 60 + minute;

      const [startH = 22, startM = 0] = pref.quietHours.startTime.split(':').map(Number);
      const [endH = 7, endM = 0] = pref.quietHours.endTime.split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      if (startMinutes <= endMinutes) {
        return currentMinutes >= startMinutes && currentMinutes < endMinutes;
      } else {
        // Crosses midnight (e.g., 22:00 to 07:00)
        return currentMinutes >= startMinutes || currentMinutes < endMinutes;
      }
    } catch {
      return false;
    }
  }

  /**
   * Determine which delivery channels are enabled for a recipient given category, priority, and mandatory status
   */
  public static async evaluateChannelsForRecipient(
    userId: string | Types.ObjectId,
    category: string,
    priority: AnnouncementPriority,
    isMandatory = false,
    referenceDate: Date = new Date()
  ): Promise<DeliveryChannelType[]> {
    const pref = await this.getOrCreatePreferences(userId);
    const isCritical =
      isMandatory ||
      MANDATORY_CATEGORIES.has(category) ||
      priority === 'urgent';

    // Mandatory institutional / security / emergency notifications always deliver in-app
    if (isMandatory || MANDATORY_CATEGORIES.has(category)) {
      const channels: DeliveryChannelType[] = ['in_app'];
      if (pref.emailEnabled) channels.push('email');
      if (pref.smsEnabled) channels.push('sms');
      if (pref.pushEnabled) channels.push('push');
      return channels;
    }

    const catPref = pref.categoryPreferences.get(category) || {
      inApp: true,
      email: true,
      sms: false,
      push: true,
    };

    const channels: DeliveryChannelType[] = [];

    if (pref.inAppEnabled && catPref.inApp) {
      channels.push('in_app');
    } else if (isCritical) {
      channels.push('in_app');
    }

    const inQuietHours = this.isWithinQuietHours(pref, referenceDate);
    const suppressExternal =
      inQuietHours && !(priority === 'urgent' && pref.quietHours.allowUrgent);

    if (!suppressExternal) {
      if (pref.emailEnabled && catPref.email) channels.push('email');
      if (pref.smsEnabled && catPref.sms) channels.push('sms');
      if (pref.pushEnabled && catPref.push) channels.push('push');
    }

    if (channels.length === 0) {
      channels.push('in_app');
    }

    return channels;
  }

  /**
   * Register or update a push notification device token for a user
   */
  public static async registerDevice(
    userId: string | Types.ObjectId,
    dto: {
      deviceToken: string;
      platform?: 'web' | 'android' | 'ios';
      deviceName?: string;
    }
  ): Promise<INotificationDevice> {
    const device = await NotificationDevice.findOneAndUpdate(
      { user: userId, deviceToken: dto.deviceToken },
      {
        $set: {
          platform: dto.platform || 'web',
          deviceName: dto.deviceName,
          isActive: true,
          lastActiveAt: new Date(),
        },
      },
      { new: true, upsert: true }
    );
    return device;
  }

  /**
   * List registered devices for a user
   */
  public static async getUserDevices(
    userId: string | Types.ObjectId
  ): Promise<INotificationDevice[]> {
    return NotificationDevice.find({ user: userId, isActive: true }).sort({ updatedAt: -1 });
  }
}
