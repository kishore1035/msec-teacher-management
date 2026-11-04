import { Router } from 'express';
import { ReportController } from '../controllers/report.controller';
import { CentralReportController } from '../controllers/phase12.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { ROLES } from '../constants/roles.constant';
import {
  studentReportParamSchema,
  generateReportBodySchema,
  classReportParamSchema,
} from '../validators/progress.validator';
import {
  generateReportJobSchema,
  listReportJobsSchema,
  reportJobIdParamSchema,
} from '../validators/phase12.validator';

const router = Router();

// ==========================================
// Phase 6: Student & Class Progress Reports
// ==========================================
router.get(
  '/students/:studentId/progress',
  authenticate,
  validateRequest(studentReportParamSchema),
  ReportController.getStudentProgressReport
);

router.post(
  '/students/:studentId/generate',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(generateReportBodySchema),
  ReportController.generateStudentProgressReport
);

router.get(
  '/class/:sectionId',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(classReportParamSchema),
  ReportController.getClassProgressReport
);

// ==========================================
// Phase 12: Centralized Report Generation & Export Jobs (PDF, Excel, CSV)
// ==========================================
router.post(
  '/generate',
  authenticate,
  validateRequest(generateReportJobSchema),
  CentralReportController.generateReport
);

router.get(
  '/',
  authenticate,
  validateRequest(listReportJobsSchema),
  CentralReportController.listReports
);

router.get(
  '/:id',
  authenticate,
  validateRequest(reportJobIdParamSchema),
  CentralReportController.getReportById
);

router.get(
  '/:id/status',
  authenticate,
  validateRequest(reportJobIdParamSchema),
  CentralReportController.getReportStatus
);

router.get(
  '/:id/download',
  authenticate,
  validateRequest(reportJobIdParamSchema),
  CentralReportController.downloadReport
);

router.delete(
  '/:id',
  authenticate,
  validateRequest(reportJobIdParamSchema),
  CentralReportController.deleteReport
);

export const reportRouter = router;
export default router;

