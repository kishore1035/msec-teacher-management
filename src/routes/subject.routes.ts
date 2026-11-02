import { Router } from 'express';
import { AcademicController } from '../controllers/academic.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { ROLES } from '../constants/roles.constant';
import {
  createSubjectSchema,
  updateSubjectSchema,
  idParamSchema,
} from '../validators/academic.validator';

const router = Router();

router.get('/', authenticate, AcademicController.getSubjects);
router.get('/:id', authenticate, validateRequest(idParamSchema), AcademicController.getSubjectById);

router.post(
  '/',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(createSubjectSchema),
  AcademicController.createSubject
);

router.put(
  '/:id',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(updateSubjectSchema),
  AcademicController.updateSubject
);

export const subjectRouter = router;
