import { Router } from 'express';
import { AcademicController } from '../controllers/academic.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { ROLES } from '../constants/roles.constant';

const router = Router();

// Teacher personal academic views
router.get(
  '/me/classes',
  authenticate,
  authorize([ROLES.TEACHER]),
  AcademicController.getMyClasses
);

router.get(
  '/me/subjects',
  authenticate,
  authorize([ROLES.TEACHER]),
  AcademicController.getMySubjects
);

router.get(
  '/me/assignments',
  authenticate,
  authorize([ROLES.TEACHER]),
  AcademicController.getMyAssignments
);

export const teacherRouter = router;
