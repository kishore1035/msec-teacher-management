import { Router } from 'express';
import { ExaminationController } from '../controllers/examination.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { ROLES } from '../constants/roles.constant';
import {
  createExaminationValidator,
  updateExaminationValidator,
  updateExaminationStatusValidator,
  createScheduleValidator,
  updateScheduleValidator,
  bulkMarksEntryValidator,
  correctResultValidator,
  gradingPolicyValidator,
  examinationQueryValidator,
} from '../validators/examination.validator';

export const examinationRouter = Router();
export const examinationScheduleRouter = Router();
export const examinationResultRouter = Router();
export const internalAssessmentRouter = Router();
export const resultRouter = Router();

// ==========================================
// 1. EXAMINATION ROUTES (/api/v1/examinations)
// ==========================================

// Analytics
examinationRouter.get(
  '/analytics/overview',
  authenticate,
  ExaminationController.getOverviewAnalytics
);

examinationRouter.get(
  '/analytics/class',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  ExaminationController.getClassAnalytics
);

examinationRouter.get(
  '/analytics/subject',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  ExaminationController.getSubjectAnalytics
);

examinationRouter.get(
  '/analytics/grades',
  authenticate,
  ExaminationController.getGradeDistribution
);

examinationRouter.get(
  '/analytics/student/:studentId',
  authenticate,
  ExaminationController.getStudentAnalytics
);

// Examination CRUD
examinationRouter.post(
  '/',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(createExaminationValidator),
  ExaminationController.createExamination
);

examinationRouter.get(
  '/',
  authenticate,
  validateRequest(examinationQueryValidator),
  ExaminationController.getExaminations
);

examinationRouter.get('/:id', authenticate, ExaminationController.getExaminationById);

examinationRouter.put(
  '/:id',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(updateExaminationValidator),
  ExaminationController.updateExamination
);

examinationRouter.patch(
  '/:id/status',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(updateExaminationStatusValidator),
  ExaminationController.updateExaminationStatus
);

examinationRouter.delete(
  '/:id',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  ExaminationController.deleteExamination
);

// Schedules within an examination
examinationRouter.post(
  '/:id/schedule',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(createScheduleValidator),
  ExaminationController.createSchedule
);

examinationRouter.get(
  '/:id/schedule',
  authenticate,
  ExaminationController.getSchedulesForExam
);

// Marks within an examination
examinationRouter.post(
  '/:id/marks',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(bulkMarksEntryValidator),
  ExaminationController.bulkEnterMarks
);

examinationRouter.get(
  '/:id/marks',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  ExaminationController.getMarksForExam
);

// ==========================================
// 2. EXAMINATION SCHEDULE ROUTES (/api/v1/examination-schedules)
// ==========================================

examinationScheduleRouter.get(
  '/my-schedule',
  authenticate,
  ExaminationController.getMySchedule
);

examinationScheduleRouter.put(
  '/:id',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(updateScheduleValidator),
  ExaminationController.updateSchedule
);

// ==========================================
// 3. EXAMINATION RESULTS ROUTES (/api/v1/examination-results)
// ==========================================

examinationResultRouter.get(
  '/:id/history',
  authenticate,
  ExaminationController.getResultHistory
);

// ==========================================
// 4. INTERNAL ASSESSMENTS ROUTES (/api/v1/internal-assessments)
// ==========================================

internalAssessmentRouter.get(
  '/',
  authenticate,
  ExaminationController.getActiveGradingPolicy
);

internalAssessmentRouter.post(
  '/configuration',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(gradingPolicyValidator),
  ExaminationController.configureGradingPolicy
);

internalAssessmentRouter.get(
  '/student/:studentId',
  authenticate,
  ExaminationController.getInternalAssessmentsForStudent
);

// ==========================================
// 5. RESULTS ROUTES (/api/v1/results)
// ==========================================

resultRouter.get(
  '/my-results',
  authenticate,
  authorize([ROLES.STUDENT]),
  ExaminationController.getMyResults
);

resultRouter.get(
  '/student/:studentId',
  authenticate,
  ExaminationController.getStudentResults
);

resultRouter.get(
  '/examination/:examinationId',
  authenticate,
  ExaminationController.getMarksForExam
);

resultRouter.post(
  '/:examinationId/publish',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  ExaminationController.publishExaminationResults
);

resultRouter.patch(
  '/:resultId/correct',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(correctResultValidator),
  ExaminationController.correctPublishedResult
);
