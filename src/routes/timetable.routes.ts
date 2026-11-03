import { Router } from 'express';
import { TimetableController } from '../controllers/timetable.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { ROLES } from '../constants/roles.constant';
import {
  createTimetableSchema,
  updateTimetableSchema,
  createTimetableEntrySchema,
  checkConflictSchema,
  overrideConflictSchema,
  queryTimetableSchema,
  queryAnalyticsSchema,
  timetableIdParamSchema,
  sectionIdParamSchema,
} from '../validators/timetable.validator';

const router = Router();

// Global Authentication
router.use(authenticate);

// ==========================================
// 1. Static Analytics Routes (Must be before /:id)
// ==========================================
router.get(
  '/analytics/teacher-workload',
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(queryAnalyticsSchema),
  TimetableController.getTeacherWorkloadAnalytics
);

router.get(
  '/analytics/classroom-utilization',
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(queryAnalyticsSchema),
  TimetableController.getClassroomUtilizationAnalytics
);

router.get(
  '/analytics/subject-distribution',
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(queryAnalyticsSchema),
  TimetableController.getSubjectDistributionAnalytics
);

router.get(
  '/analytics/conflicts',
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  TimetableController.getConflictAnalytics
);

// ==========================================
// 2. Conflict Detection Endpoints
// ==========================================
router.post(
  '/check-conflicts',
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(checkConflictSchema),
  TimetableController.checkConflicts
);

router.get(
  '/conflicts',
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  TimetableController.listConflicts
);

router.post(
  '/conflicts/:id/override',
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(overrideConflictSchema),
  TimetableController.overrideConflict
);

// ==========================================
// 3. Teacher Timetable Endpoints
// ==========================================
router.get(
  '/teachers/me/today',
  authorize([ROLES.TEACHER, ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  TimetableController.getTeacherToday
);

router.get(
  '/teachers/me/weekly',
  authorize([ROLES.TEACHER, ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  TimetableController.getTeacherWeekly
);

router.get(
  '/teachers/me',
  authorize([ROLES.TEACHER, ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  TimetableController.getTeacherSchedule
);

// ==========================================
// 4. Student & Section Timetable Endpoints
// ==========================================
router.get(
  '/students/me/today',
  authorize([ROLES.STUDENT]),
  TimetableController.getStudentToday
);

router.get(
  '/students/me',
  authorize([ROLES.STUDENT]),
  TimetableController.getStudentSchedule
);

router.get(
  '/sections/:sectionId',
  validateRequest(sectionIdParamSchema),
  TimetableController.getSectionSchedule
);

// ==========================================
// 5. Parametric Timetable Sub-resource Routes
// ==========================================
router.patch(
  '/:id/publish',
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(timetableIdParamSchema),
  TimetableController.publishTimetable
);

router.patch(
  '/:id/archive',
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(timetableIdParamSchema),
  TimetableController.archiveTimetable
);

router.post(
  '/:id/entries',
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(createTimetableEntrySchema),
  TimetableController.createTimetableEntry
);

router.get(
  '/:id/entries',
  validateRequest(timetableIdParamSchema),
  TimetableController.getTimetableEntries
);

// ==========================================
// 6. Core Timetable CRUD
// ==========================================
router.post(
  '/',
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(createTimetableSchema),
  TimetableController.createTimetable
);

router.get(
  '/',
  validateRequest(queryTimetableSchema),
  TimetableController.listTimetables
);

router.get(
  '/:id',
  validateRequest(timetableIdParamSchema),
  TimetableController.getTimetableById
);

router.put(
  '/:id',
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(updateTimetableSchema),
  TimetableController.updateTimetable
);

router.delete(
  '/:id',
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(timetableIdParamSchema),
  TimetableController.deleteTimetable
);

export const timetableRouter = router;
