import { Router } from 'express';
import { ProgressController } from '../controllers/progress.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { ROLES } from '../constants/roles.constant';
import {
  studentProgressQuerySchema,
  atRiskQuerySchema,
  atRiskStudentParamSchema,
  createRiskRuleSchema,
} from '../validators/progress.validator';

const router = Router();

// Risk Rules (Admin only for creation, staff for viewing)
router.post(
  '/risk-rules',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(createRiskRuleSchema),
  ProgressController.createOrUpdateRiskRule
);

router.get(
  '/risk-rules',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  ProgressController.getActiveRiskRule
);

// At-Risk Students List
router.get(
  '/at-risk',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(atRiskQuerySchema),
  ProgressController.getAtRiskStudents
);

// Individual Student Risk Evaluation
router.get(
  '/at-risk/:studentId',
  authenticate,
  validateRequest(atRiskStudentParamSchema),
  ProgressController.getAtRiskStudentById
);

// Individual Student Progress Profile
router.get(
  '/students/:studentId',
  authenticate,
  validateRequest(studentProgressQuerySchema),
  ProgressController.getStudentProgress
);

// Subject-Wise Progress for Student
router.get(
  '/students/:studentId/subjects',
  authenticate,
  validateRequest(studentProgressQuerySchema),
  ProgressController.getStudentSubjectWiseProgress
);

// Student Progress Historical Snapshots
router.get(
  '/students/:studentId/history',
  authenticate,
  ProgressController.getStudentProgressHistory
);

// Student Progress Trends
router.get(
  '/students/:studentId/trends',
  authenticate,
  ProgressController.getStudentProgressTrends
);

export const progressRouter = router;
export default router;
