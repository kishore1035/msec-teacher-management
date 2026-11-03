import { Router } from 'express';
import { AnalyticsController } from '../controllers/analytics.controller';
import { WorkloadAnalyticsController } from '../controllers/leaveSubstitutionTeacher.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { ROLES } from '../constants/roles.constant';
import {
  classAnalyticsQuerySchema,
  subjectAnalyticsQuerySchema,
  teacherInsightsQuerySchema,
} from '../validators/progress.validator';
import { workloadAnalyticsQuerySchema } from '../validators/leaveSubstitutionTeacher.validator';

const router = Router();

// ==========================================
// Class Analytics
// ==========================================
router.get(
  '/class/overview',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(classAnalyticsQuerySchema),
  AnalyticsController.getClassOverview
);

router.get(
  '/class/performance',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(classAnalyticsQuerySchema),
  AnalyticsController.getClassPerformance
);

router.get(
  '/class/attendance',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(classAnalyticsQuerySchema),
  AnalyticsController.getClassAttendance
);

router.get(
  '/class/assignments',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(classAnalyticsQuerySchema),
  AnalyticsController.getClassAssignments
);

// ==========================================
// Subject Analytics
// ==========================================
router.get(
  '/subject/overview',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(subjectAnalyticsQuerySchema),
  AnalyticsController.getSubjectOverview
);

router.get(
  '/subject/performance',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(subjectAnalyticsQuerySchema),
  AnalyticsController.getSubjectPerformance
);

router.get(
  '/subject/comparison',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(subjectAnalyticsQuerySchema),
  AnalyticsController.getSubjectComparison
);

// ==========================================
// Teacher Performance Insights
// ==========================================
router.get(
  '/teacher/overview',
  authenticate,
  authorize([ROLES.TEACHER, ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(teacherInsightsQuerySchema),
  AnalyticsController.getTeacherOverview
);

router.get(
  '/teacher/students-at-risk',
  authenticate,
  authorize([ROLES.TEACHER, ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(teacherInsightsQuerySchema),
  AnalyticsController.getTeacherStudentsAtRisk
);

// ==========================================
// Phase 11: Teacher Workload, Leave & Substitution Analytics
// ==========================================
router.get(
  '/teacher-workload',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(workloadAnalyticsQuerySchema),
  WorkloadAnalyticsController.getTeacherWorkload
);

router.get(
  '/department-workload',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(workloadAnalyticsQuerySchema),
  WorkloadAnalyticsController.getDepartmentWorkload
);

router.get(
  '/leave-summary',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(workloadAnalyticsQuerySchema),
  WorkloadAnalyticsController.getLeaveSummary
);

router.get(
  '/substitution-summary',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(workloadAnalyticsQuerySchema),
  WorkloadAnalyticsController.getSubstitutionSummary
);

export const analyticsRouter = router;
export default router;

