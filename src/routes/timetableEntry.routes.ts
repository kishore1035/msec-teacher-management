import { Router } from 'express';
import { z } from 'zod';
import { TimetableController } from '../controllers/timetable.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { ROLES } from '../constants/roles.constant';
import { updateTimetableEntrySchema, objectIdSchema } from '../validators/timetable.validator';

const router = Router();

router.use(authenticate);

const entryIdParamSchema = z.object({
  params: z.object({
    entryId: objectIdSchema,
  }),
});

router.put(
  '/:entryId',
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(updateTimetableEntrySchema),
  TimetableController.updateTimetableEntry
);

router.delete(
  '/:entryId',
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(entryIdParamSchema),
  TimetableController.deleteTimetableEntry
);

export const timetableEntryRouter = router;
