import { Router } from 'express';
import { SubstitutionController } from '../controllers/leaveSubstitutionTeacher.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { ROLES } from '../constants/roles.constant';
import {
  createSubstitutionSchema,
  listSubstitutionsQuerySchema,
  availableTeachersQuerySchema,
  substitutionConflictsQuerySchema,
  approveSubstitutionSchema,
  rejectSubstitutionSchema,
  completeSubstitutionSchema,
  cancelSubstitutionSchema,
  teacherIdParamSchema,
} from '../validators/leaveSubstitutionTeacher.validator';

const router = Router();

// Static query routes before /:id
router.get(
  '/available-teachers',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(availableTeachersQuerySchema),
  SubstitutionController.getAvailableTeachers
);

router.get(
  '/conflicts',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(substitutionConflictsQuerySchema),
  SubstitutionController.checkConflicts
);

router.post(
  '/',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(createSubstitutionSchema),
  SubstitutionController.createSubstitution
);

router.get(
  '/',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(listSubstitutionsQuerySchema),
  SubstitutionController.listSubstitutions
);

router.get(
  '/:id',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(teacherIdParamSchema),
  SubstitutionController.getSubstitutionById
);

router.patch(
  '/:id/approve',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(approveSubstitutionSchema),
  SubstitutionController.approveSubstitution
);

router.patch(
  '/:id/reject',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(rejectSubstitutionSchema),
  SubstitutionController.rejectSubstitution
);

router.patch(
  '/:id/complete',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(completeSubstitutionSchema),
  SubstitutionController.completeSubstitution
);

router.patch(
  '/:id/cancel',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(cancelSubstitutionSchema),
  SubstitutionController.cancelSubstitution
);

export const substitutionRouter = router;
