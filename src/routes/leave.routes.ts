import { Router } from 'express';
import { LeaveController } from '../controllers/leaveSubstitutionTeacher.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { ROLES } from '../constants/roles.constant';
import {
  createLeavePolicySchema,
  updateLeavePolicySchema,
  createLeaveRequestSchema,
  listLeaveRequestsQuerySchema,
  reviewLeaveRequestSchema,
  cancelLeaveRequestSchema,
  leaveBalanceQuerySchema,
  teacherIdParamSchema,
} from '../validators/leaveSubstitutionTeacher.validator';

// ==========================================
// 1. /api/v1/leave-requests Router
// ==========================================
const reqRouter = Router();

reqRouter.post(
  '/',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(createLeaveRequestSchema),
  LeaveController.submitLeaveRequest
);

reqRouter.get(
  '/',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(listLeaveRequestsQuerySchema),
  LeaveController.listLeaveRequests
);

reqRouter.get(
  '/:id',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(teacherIdParamSchema),
  LeaveController.getLeaveRequestById
);

reqRouter.patch(
  '/:id/cancel',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(cancelLeaveRequestSchema),
  LeaveController.cancelLeaveRequest
);

reqRouter.patch(
  '/:id/approve',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(reviewLeaveRequestSchema),
  LeaveController.approveLeaveRequest
);

reqRouter.patch(
  '/:id/reject',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(reviewLeaveRequestSchema),
  LeaveController.rejectLeaveRequest
);

export const leaveRequestRouter = reqRouter;

// ==========================================
// 2. /api/v1/leaves Router (Policies & Balances)
// ==========================================
const leavesRouter = Router();

leavesRouter.get(
  '/policies',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  LeaveController.listPolicies
);

leavesRouter.post(
  '/policies',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(createLeavePolicySchema),
  LeaveController.createPolicy
);

leavesRouter.patch(
  '/policies/:id',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(updateLeavePolicySchema),
  LeaveController.updatePolicy
);

leavesRouter.get(
  '/balances',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(leaveBalanceQuerySchema),
  LeaveController.getBalances
);

export const leaveRouter = leavesRouter;
