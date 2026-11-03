import { Router } from 'express';
import { ParentController } from '../controllers/parent.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { ROLES } from '../constants/roles.constant';
import {
  createParentSchema,
  updateParentSchema,
  linkChildSchema,
  unlinkChildParamSchema,
  parentQuerySchema,
  parentChildParamSchema,
} from '../validators/parent.validator';
import { idParamSchema } from '../validators/academic.validator';

const router = Router();

// ==========================================
// 1. PARENT ACADEMIC PORTAL (/me/children/* — mounted before /:id)
// ==========================================
router.get(
  '/me/children',
  authenticate,
  authorize([ROLES.PARENT]),
  ParentController.getMyChildren
);

router.get(
  '/me/children/:studentId/profile',
  authenticate,
  authorize([ROLES.PARENT]),
  validateRequest(parentChildParamSchema),
  ParentController.getChildProfile
);

router.get(
  '/me/children/:studentId/attendance',
  authenticate,
  authorize([ROLES.PARENT]),
  validateRequest(parentChildParamSchema),
  ParentController.getChildAttendance
);

router.get(
  '/me/children/:studentId/assignments',
  authenticate,
  authorize([ROLES.PARENT]),
  validateRequest(parentChildParamSchema),
  ParentController.getChildAssignments
);

router.get(
  '/me/children/:studentId/results',
  authenticate,
  authorize([ROLES.PARENT]),
  validateRequest(parentChildParamSchema),
  ParentController.getChildResults
);

router.get(
  '/me/children/:studentId/progress',
  authenticate,
  authorize([ROLES.PARENT]),
  validateRequest(parentChildParamSchema),
  ParentController.getChildProgress
);

router.get(
  '/me/children/:studentId/timetable',
  authenticate,
  authorize([ROLES.PARENT]),
  validateRequest(parentChildParamSchema),
  ParentController.getChildTimetable
);

// ==========================================
// 2. PARENT MANAGEMENT (Admin Only for mutations)
// ==========================================
router.post(
  '/',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(createParentSchema),
  ParentController.createParent
);

router.get(
  '/',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(parentQuerySchema),
  ParentController.getParents
);

router.get(
  '/:id',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.PARENT]),
  validateRequest(idParamSchema),
  ParentController.getParentById
);

router.put(
  '/:id',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(updateParentSchema),
  ParentController.updateParent
);

router.post(
  '/:parentId/children',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(linkChildSchema),
  ParentController.linkChild
);

router.delete(
  '/:parentId/children/:studentId',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(unlinkChildParamSchema),
  ParentController.unlinkChild
);

export const parentRouter = router;
