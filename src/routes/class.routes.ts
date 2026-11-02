import { Router } from 'express';
import { AcademicController } from '../controllers/academic.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { ROLES } from '../constants/roles.constant';
import {
  createClassSchema,
  updateClassSchema,
  idParamSchema,
} from '../validators/academic.validator';

const router = Router();

router.get('/', authenticate, AcademicController.getClasses);
router.get('/:id', authenticate, validateRequest(idParamSchema), AcademicController.getClassById);

router.post(
  '/',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(createClassSchema),
  AcademicController.createClass
);

router.put(
  '/:id',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(updateClassSchema),
  AcademicController.updateClass
);

export const classRouter = router;
