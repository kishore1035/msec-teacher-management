import { Router } from 'express';
import { ReportController } from '../controllers/report.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { ROLES } from '../constants/roles.constant';
import {
  studentReportParamSchema,
  generateReportBodySchema,
  classReportParamSchema,
} from '../validators/progress.validator';

const router = Router();

// Student Progress Report (Students, Parents, Teachers, Admins)
router.get(
  '/students/:studentId/progress',
  authenticate,
  validateRequest(studentReportParamSchema),
  ReportController.getStudentProgressReport
);

// Explicit Generation with Snapshot Archiving
router.post(
  '/students/:studentId/generate',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(generateReportBodySchema),
  ReportController.generateStudentProgressReport
);

// Class Section Progress Report (Teachers, Admins)
router.get(
  '/class/:sectionId',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(classReportParamSchema),
  ReportController.getClassProgressReport
);

export const reportRouter = router;
export default router;
