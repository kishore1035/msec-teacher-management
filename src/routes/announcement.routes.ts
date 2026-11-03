import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { communicationRateLimiter } from '../middleware/rateLimiter.middleware';
import { uploadAnnouncementFiles } from '../middleware/upload.middleware';
import { ROLES } from '../constants/roles.constant';
import { AnnouncementController } from '../controllers/announcement.controller';
import {
  createAnnouncementSchema,
  updateAnnouncementSchema,
  announcementIdParamSchema,
  listAnnouncementsQuerySchema,
} from '../validators/announcement.validator';

const router = Router();

router.use(authenticate);

// Analytics overview (must precede /:id)
router.get(
  '/analytics/overview',
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  AnnouncementController.getAnalyticsOverview
);

// List announcements visible to the user
router.get(
  '/',
  validateRequest(listAnnouncementsQuerySchema),
  AnnouncementController.getAnnouncements
);

// Create announcement (Administrators and Teachers)
router.post(
  '/',
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  communicationRateLimiter,
  uploadAnnouncementFiles.array('attachments', 5),
  validateRequest(createAnnouncementSchema),
  AnnouncementController.createAnnouncement
);

// Single announcement readership analytics
router.get(
  '/:id/analytics',
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(announcementIdParamSchema),
  AnnouncementController.getAnnouncementAnalytics
);

// Get announcement by ID
router.get(
  '/:id',
  validateRequest(announcementIdParamSchema),
  AnnouncementController.getAnnouncementById
);

// Edit announcement
router.put(
  '/:id',
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  uploadAnnouncementFiles.array('attachments', 5),
  validateRequest(updateAnnouncementSchema),
  AnnouncementController.updateAnnouncement
);

// Publish announcement
router.patch(
  '/:id/publish',
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  communicationRateLimiter,
  validateRequest(announcementIdParamSchema),
  AnnouncementController.publishAnnouncement
);

// Archive announcement
router.patch(
  '/:id/archive',
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(announcementIdParamSchema),
  AnnouncementController.archiveAnnouncement
);

// Delete/Archive announcement
router.delete(
  '/:id',
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(announcementIdParamSchema),
  AnnouncementController.deleteAnnouncement
);

export const announcementRouter = router;
