import { Router } from 'express';
import { AcademicController } from '../controllers/academic.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { ROLES } from '../constants/roles.constant';
import {
  createAcademicYearSchema,
  updateAcademicYearSchema,
  idParamSchema,
} from '../validators/academic.validator';

const router = Router();

// Public/Auth reads
router.get('/years', authenticate, AcademicController.getAcademicYears);
router.get('/years/current', authenticate, AcademicController.getCurrentAcademicYear);
router.get('/years/:id', authenticate, validateRequest(idParamSchema), AcademicController.getAcademicYearById);

// Admin-only writes
router.post(
  '/years',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(createAcademicYearSchema),
  AcademicController.createAcademicYear
);

router.put(
  '/years/:id',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(updateAcademicYearSchema),
  AcademicController.updateAcademicYear
);

router.put(
  '/years/:id/set-current',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(idParamSchema),
  AcademicController.setCurrentAcademicYear
);

export const academicRouter = router;
