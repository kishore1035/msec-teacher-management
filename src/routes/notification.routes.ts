import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { communicationRateLimiter } from '../middleware/rateLimiter.middleware';
import { ROLES } from '../constants/roles.constant';
import { NotificationController } from '../controllers/notification.controller';
import {
  listNotificationsQuerySchema,
  notificationIdParamSchema,
  markAllReadSchema,
  updatePreferencesSchema,
  registerDeviceSchema,
  deliveryStatusQuerySchema,
  createDirectEventNotificationSchema,
} from '../validators/notification.validator';

const router = Router();

router.use(authenticate);

// Unread count
router.get('/unread-count', NotificationController.getUnreadCount);

// Mark all notifications as read
router.patch(
  '/read-all',
  validateRequest(markAllReadSchema),
  NotificationController.markAllAsRead
);

// Notification history (filterable by category and date)
router.get(
  '/history',
  validateRequest(listNotificationsQuerySchema),
  NotificationController.getNotificationHistory
);

// Notification preferences
router.get('/preferences', NotificationController.getPreferences);

router.put(
  '/preferences',
  validateRequest(updatePreferencesSchema),
  NotificationController.updatePreferences
);

// Register push notification device
router.post(
  '/devices',
  validateRequest(registerDeviceSchema),
  NotificationController.registerDevice
);

// Delivery status tracking
router.get(
  '/delivery-status',
  validateRequest(deliveryStatusQuerySchema),
  NotificationController.getDeliveryStatus
);

// Direct administrative / event notifications trigger
router.post(
  '/events',
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  communicationRateLimiter,
  validateRequest(createDirectEventNotificationSchema),
  NotificationController.createDirectEventNotification
);

// List user notifications
router.get(
  '/',
  validateRequest(listNotificationsQuerySchema),
  NotificationController.getNotifications
);

// Get single notification by ID
router.get(
  '/:id',
  validateRequest(notificationIdParamSchema),
  NotificationController.getNotificationById
);

// Mark single notification as read
router.patch(
  '/:id/read',
  validateRequest(notificationIdParamSchema),
  NotificationController.markAsRead
);

export const notificationRouter = router;
