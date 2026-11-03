import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/apiResponse';
import { NotificationService } from '../services/notification.service';
import { NotificationPreferenceService } from '../services/notificationPreference.service';

export class NotificationController {
  public static getNotifications = asyncHandler(async (req: Request, res: Response) => {
    const { items, meta } = await NotificationService.getUserNotifications(
      req.user!.id,
      req.query as Record<string, unknown>
    );
    return ApiResponse.success(
      res,
      'Notifications retrieved successfully',
      items,
      200,
      meta
    );
  });

  public static getUnreadCount = asyncHandler(async (req: Request, res: Response) => {
    const result = await NotificationService.getUnreadCount(req.user!.id);
    return ApiResponse.success(res, 'Unread notification count retrieved', result);
  });

  public static getNotificationHistory = asyncHandler(
    async (req: Request, res: Response) => {
      const { items, meta } = await NotificationService.getNotificationHistory(
        req.user!.id,
        req.query as Record<string, unknown>
      );
      return ApiResponse.success(
        res,
        'Notification history retrieved successfully',
        items,
        200,
        meta
      );
    }
  );

  public static getNotificationById = asyncHandler(
    async (req: Request, res: Response) => {
      const notification = await NotificationService.getNotificationById(
        req.user!.id,
        req.params['id'] as string
      );
      return ApiResponse.success(
        res,
        'Notification retrieved successfully',
        notification
      );
    }
  );

  public static markAsRead = asyncHandler(async (req: Request, res: Response) => {
    const notification = await NotificationService.markAsRead(
      req.user!.id,
      req.params['id'] as string
    );
    return ApiResponse.success(res, 'Notification marked as read', notification);
  });

  public static markAllAsRead = asyncHandler(async (req: Request, res: Response) => {
    const category = req.body?.category as string | undefined;
    const result = await NotificationService.markAllAsRead(req.user!.id, category);
    return ApiResponse.success(res, 'All notifications marked as read', result);
  });

  public static getPreferences = asyncHandler(async (req: Request, res: Response) => {
    const pref = await NotificationPreferenceService.getOrCreatePreferences(req.user!.id);
    return ApiResponse.success(
      res,
      'Notification preferences retrieved successfully',
      pref
    );
  });

  public static updatePreferences = asyncHandler(async (req: Request, res: Response) => {
    const pref = await NotificationPreferenceService.updatePreferences(
      req.user!.id,
      req.body
    );
    return ApiResponse.success(
      res,
      'Notification preferences updated successfully',
      pref
    );
  });

  public static registerDevice = asyncHandler(async (req: Request, res: Response) => {
    const device = await NotificationPreferenceService.registerDevice(
      req.user!.id,
      req.body
    );
    return ApiResponse.created(res, 'Notification device registered successfully', device);
  });

  public static getDeliveryStatus = asyncHandler(async (req: Request, res: Response) => {
    const { summary, items, meta } = await NotificationService.getDeliveryStatus(
      req.user!.id,
      req.user!.role,
      req.query as Record<string, unknown>
    );
    return ApiResponse.success(
      res,
      'Notification delivery status retrieved successfully',
      { summary, items },
      200,
      meta
    );
  });

  public static createDirectEventNotification = asyncHandler(
    async (req: Request, res: Response) => {
      const {
        recipients,
        title,
        message,
        notificationType,
        category,
        priority,
        relatedEntityType,
        relatedEntityId,
        eventKey,
        isMandatory,
        expiresAt,
      } = req.body;

      const results = [];
      let createdCount = 0;

      for (const recipient of recipients as string[]) {
        const resItem = await NotificationService.createEventNotification({
          recipient,
          title,
          message,
          notificationType,
          category,
          priority,
          relatedEntityType,
          relatedEntityId,
          eventKey,
          isMandatory,
          expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        });
        if (resItem.created) createdCount += 1;
        results.push(resItem.notification);
      }

      return ApiResponse.created(res, 'Event notifications processed successfully', {
        totalRequested: recipients.length,
        createdCount,
        notifications: results,
      });
    }
  );
}
