import { Router } from 'express';
import { AcademicController } from '../controllers/academic.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { ROLES } from '../constants/roles.constant';
import {
  createSectionSchema,
  updateSectionSchema,
  idParamSchema,
} from '../validators/academic.validator';

const router = Router();

router.get('/', authenticate, AcademicController.getSections);
router.get('/:id', authenticate, validateRequest(idParamSchema), AcademicController.getSectionById);

router.post(
  '/',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(createSectionSchema),
  AcademicController.createSection
);

router.put(
  '/:id',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(updateSectionSchema),
  AcademicController.updateSection
);

export const sectionRouter = router;
