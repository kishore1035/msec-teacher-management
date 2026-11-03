import { Router } from 'express';
import { DoubtController } from '../controllers/doubt.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { ROLES } from '../constants/roles.constant';
import {
  createDoubtSchema,
  updateDoubtSchema,
  assignDoubtSchema,
  updateDoubtStatusSchema,
  createDoubtMessageSchema,
  getDoubtMessagesQuerySchema,
  reopenDoubtSchema,
  doubtQuerySchema,
  doubtAnalyticsQuerySchema,
} from '../validators/doubt.validator';
import { idParamSchema } from '../validators/academic.validator';

const router = Router();

// ==========================================
// 1. DOUBT ANALYTICS (Admin Only — before /:id)
// ==========================================
router.get(
  '/analytics/overview',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(doubtAnalyticsQuerySchema),
  DoubtController.getOverviewAnalytics
);

router.get(
  '/analytics/subjects',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(doubtAnalyticsQuerySchema),
  DoubtController.getSubjectAnalytics
);

router.get(
  '/analytics/teachers',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(doubtAnalyticsQuerySchema),
  DoubtController.getTeacherAnalytics
);

// ==========================================
// 2. DOUBT CRUD & WORKFLOW
// ==========================================
router.post(
  '/',
  authenticate,
  authorize([ROLES.STUDENT, ROLES.ADMIN, ROLES.SUPER_ADMIN]),
  validateRequest(createDoubtSchema),
  DoubtController.createDoubt
);

router.get(
  '/',
  authenticate,
  validateRequest(doubtQuerySchema),
  DoubtController.getDoubts
);

router.get(
  '/:id',
  authenticate,
  validateRequest(idParamSchema),
  DoubtController.getDoubtById
);

router.put(
  '/:id',
  authenticate,
  validateRequest(updateDoubtSchema),
  DoubtController.updateDoubt
);

router.patch(
  '/:id/assign',
  authenticate,
  authorize([ROLES.TEACHER, ROLES.ADMIN, ROLES.SUPER_ADMIN]),
  validateRequest(assignDoubtSchema),
  DoubtController.assignDoubt
);

router.patch(
  '/:id/status',
  authenticate,
  authorize([ROLES.TEACHER, ROLES.STUDENT, ROLES.ADMIN, ROLES.SUPER_ADMIN]),
  validateRequest(updateDoubtStatusSchema),
  DoubtController.updateDoubtStatus
);

// ==========================================
// 3. DOUBT CONVERSATION & REOPENING
// ==========================================
router.post(
  '/:id/messages',
  authenticate,
  authorize([ROLES.STUDENT, ROLES.TEACHER, ROLES.ADMIN, ROLES.SUPER_ADMIN]),
  validateRequest(createDoubtMessageSchema),
  DoubtController.addDoubtMessage
);

router.get(
  '/:id/messages',
  authenticate,
  validateRequest(getDoubtMessagesQuerySchema),
  DoubtController.getDoubtMessages
);

router.patch(
  '/:id/reopen',
  authenticate,
  authorize([ROLES.STUDENT, ROLES.TEACHER, ROLES.ADMIN, ROLES.SUPER_ADMIN]),
  validateRequest(reopenDoubtSchema),
  DoubtController.reopenDoubt
);

export const doubtRouter = router;
