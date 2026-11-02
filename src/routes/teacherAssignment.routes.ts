import { Router } from 'express';
import { AcademicController } from '../controllers/academic.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { ROLES } from '../constants/roles.constant';
import {
  createTeacherAssignmentSchema,
  updateTeacherAssignmentSchema,
  idParamSchema,
} from '../validators/academic.validator';

const router = Router();

router.get('/', authenticate, AcademicController.getTeacherAssignments);
router.get('/:id', authenticate, validateRequest(idParamSchema), AcademicController.getTeacherAssignmentById);

router.post(
  '/',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(createTeacherAssignmentSchema),
  AcademicController.createTeacherAssignment
);

router.put(
  '/:id',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(updateTeacherAssignmentSchema),
  AcademicController.updateTeacherAssignment
);

router.delete(
  '/:id',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(idParamSchema),
  AcademicController.deleteTeacherAssignment
);

export const teacherAssignmentRouter = router;
