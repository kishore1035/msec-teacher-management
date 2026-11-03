import { Router } from 'express';
import { TimetableController } from '../controllers/timetable.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { ROLES } from '../constants/roles.constant';
import {
  createTimetableChangeSchema,
  approveRejectChangeSchema,
  timetableIdParamSchema,
} from '../validators/timetable.validator';

const router = Router();

router.use(authenticate);

router.post(
  '/',
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(createTimetableChangeSchema),
  TimetableController.createChange
);

router.get(
  '/',
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  TimetableController.listChanges
);

router.put(
  '/:id/approve',
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(timetableIdParamSchema),
  TimetableController.approveChange
);

router.put(
  '/:id/reject',
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(approveRejectChangeSchema),
  TimetableController.rejectChange
);

export const timetableChangeRouter = router;
