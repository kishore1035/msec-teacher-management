import { Router } from 'express';
import { AcademicController } from '../controllers/academic.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { ROLES } from '../constants/roles.constant';
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  idParamSchema,
} from '../validators/academic.validator';

const router = Router();

router.get('/', authenticate, AcademicController.getDepartments);
router.get('/:id', authenticate, validateRequest(idParamSchema), AcademicController.getDepartmentById);

router.post(
  '/',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(createDepartmentSchema),
  AcademicController.createDepartment
);

router.put(
  '/:id',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(updateDepartmentSchema),
  AcademicController.updateDepartment
);

export const departmentRouter = router;
