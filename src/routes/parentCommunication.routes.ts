import { Router } from 'express';
import { ParentCommunicationController } from '../controllers/parentCommunication.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { ROLES } from '../constants/roles.constant';
import {
  createParentCommunicationSchema,
  createMeetingRequestSchema,
  addParentCommunicationMessageSchema,
  closeParentCommunicationSchema,
  parentCommunicationQuerySchema,
} from '../validators/parentCommunication.validator';
import { idParamSchema } from '../validators/academic.validator';

const router = Router();

// Dedicated meeting request endpoint (mounted before /:id)
router.post(
  '/meeting-requests',
  authenticate,
  authorize([ROLES.PARENT, ROLES.TEACHER, ROLES.ADMIN, ROLES.SUPER_ADMIN]),
  validateRequest(createMeetingRequestSchema),
  ParentCommunicationController.createMeetingRequest
);

router.post(
  '/',
  authenticate,
  authorize([ROLES.PARENT, ROLES.TEACHER, ROLES.ADMIN, ROLES.SUPER_ADMIN]),
  validateRequest(createParentCommunicationSchema),
  ParentCommunicationController.createCommunication
);

router.get(
  '/',
  authenticate,
  authorize([ROLES.PARENT, ROLES.TEACHER, ROLES.ADMIN, ROLES.SUPER_ADMIN]),
  validateRequest(parentCommunicationQuerySchema),
  ParentCommunicationController.getCommunications
);

router.get(
  '/:id',
  authenticate,
  authorize([ROLES.PARENT, ROLES.TEACHER, ROLES.ADMIN, ROLES.SUPER_ADMIN]),
  validateRequest(idParamSchema),
  ParentCommunicationController.getCommunicationById
);

router.post(
  '/:id/messages',
  authenticate,
  authorize([ROLES.PARENT, ROLES.TEACHER, ROLES.ADMIN, ROLES.SUPER_ADMIN]),
  validateRequest(addParentCommunicationMessageSchema),
  ParentCommunicationController.addMessage
);

router.patch(
  '/:id/close',
  authenticate,
  authorize([ROLES.PARENT, ROLES.TEACHER, ROLES.ADMIN, ROLES.SUPER_ADMIN]),
  validateRequest(closeParentCommunicationSchema),
  ParentCommunicationController.closeCommunication
);

export const parentCommunicationRouter = router;
