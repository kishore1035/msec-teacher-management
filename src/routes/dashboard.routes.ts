import { Router } from 'express';
import { DashboardController } from '../controllers/phase12.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { ROLES } from '../constants/roles.constant';
import { validateRequest } from '../middleware/validate.middleware';
import { dashboardQuerySchema } from '../validators/phase12.validator';

const router = Router();

router.use(authenticate);

router.get(
  '/admin',
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(dashboardQuerySchema),
  DashboardController.getAdminDashboard
);

router.get(
  '/teacher',
  authorize([ROLES.TEACHER]),
  validateRequest(dashboardQuerySchema),
  DashboardController.getTeacherDashboard
);

router.get(
  '/student',
  authorize([ROLES.STUDENT]),
  validateRequest(dashboardQuerySchema),
  DashboardController.getStudentDashboard
);

router.get(
  '/parent',
  authorize([ROLES.PARENT]),
  validateRequest(dashboardQuerySchema),
  DashboardController.getParentDashboard
);

export const dashboardRouter = router;
export default router;
