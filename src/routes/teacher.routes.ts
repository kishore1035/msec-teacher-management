import { Router } from 'express';
import { AcademicController } from '../controllers/academic.controller';
import { TeacherManagementController } from '../controllers/leaveSubstitutionTeacher.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { ROLES } from '../constants/roles.constant';
import {
  createTeacherProfileSchema,
  updateTeacherProfileSchema,
  listTeachersQuerySchema,
  teacherIdParamSchema,
  teacherSubResourceQuerySchema,
} from '../validators/leaveSubstitutionTeacher.validator';

const router = Router();

// ==========================================
// Teacher Personal "Me" Views (Must precede /:id)
// ==========================================
router.get(
  '/me',
  authenticate,
  authorize([ROLES.TEACHER]),
  TeacherManagementController.getMyProfile
);

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

// ==========================================
// Teacher Profile Directory & CRUD
// ==========================================
router.get(
  '/',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(listTeachersQuerySchema),
  TeacherManagementController.listTeachers
);

router.post(
  '/',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(createTeacherProfileSchema),
  TeacherManagementController.createTeacher
);

router.get(
  '/:id',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(teacherIdParamSchema),
  TeacherManagementController.getTeacherById
);

router.patch(
  '/:id',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(updateTeacherProfileSchema),
  TeacherManagementController.updateTeacher
);

router.get(
  '/:id/classes',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(teacherSubResourceQuerySchema),
  TeacherManagementController.getTeacherClasses
);

router.get(
  '/:id/timetable',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(teacherSubResourceQuerySchema),
  TeacherManagementController.getTeacherTimetable
);

router.get(
  '/:id/workload',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(teacherSubResourceQuerySchema),
  TeacherManagementController.getTeacherWorkload
);

router.get(
  '/:id/leave-history',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(teacherSubResourceQuerySchema),
  TeacherManagementController.getTeacherLeaveHistory
);

router.get(
  '/:id/substitutions',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(teacherSubResourceQuerySchema),
  TeacherManagementController.getTeacherSubstitutions
);

export const teacherRouter = router;

