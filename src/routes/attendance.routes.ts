import { Router } from 'express';
import { AttendanceController } from '../controllers/attendance.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { ROLES } from '../constants/roles.constant';
import {
  createAttendanceSessionSchema,
  updateAttendanceSessionSchema,
  cancelAttendanceSessionSchema,
  bulkMarkAttendanceSchema,
  updateAttendanceRecordSchema,
  attendancePolicySchemaValidator,
  updateAttendancePolicySchemaValidator,
} from '../validators/attendance.validator';
import { idParamSchema } from '../validators/academic.validator';

const router = Router();

// ==========================================
// 1. POLICY
// ==========================================
router.get('/policy', authenticate, AttendanceController.getPolicy);

router.post(
  '/policy',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(attendancePolicySchemaValidator),
  AttendanceController.createPolicy
);

router.put(
  '/policy/:id',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(updateAttendancePolicySchemaValidator),
  AttendanceController.updatePolicy
);

// ==========================================
// 2. SESSIONS
// ==========================================
router.post(
  '/sessions',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(createAttendanceSessionSchema),
  AttendanceController.createSession
);

router.get('/sessions', authenticate, AttendanceController.getSessions);

router.get(
  '/sessions/:id',
  authenticate,
  validateRequest(idParamSchema),
  AttendanceController.getSessionById
);

router.patch(
  '/sessions/:id',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(updateAttendanceSessionSchema),
  AttendanceController.updateSession
);

router.patch(
  '/sessions/:id/cancel',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(cancelAttendanceSessionSchema),
  AttendanceController.cancelSession
);

// ==========================================
// 3. RECORDS (MARKING & AUDITING)
// ==========================================
router.post(
  '/sessions/:sessionId/records',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(bulkMarkAttendanceSchema),
  AttendanceController.bulkMarkAttendance
);

router.get(
  '/sessions/:sessionId/records',
  authenticate,
  AttendanceController.getSessionRecords
);

router.patch(
  '/records/:recordId',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(updateAttendanceRecordSchema),
  AttendanceController.updateRecord
);

// ==========================================
// 4. REPORTS & SHORTAGES
// ==========================================
router.get(
  '/students/:studentId',
  authenticate,
  AttendanceController.getStudentAttendance
);

router.get(
  '/shortages',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  AttendanceController.getShortages
);

router.get(
  '/summary',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  AttendanceController.getSummary
);

router.get(
  '/reports/class',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  AttendanceController.getSummary
);

router.get(
  '/reports/subject',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  AttendanceController.getSummary
);

router.get(
  '/reports/daily',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  AttendanceController.getSummary
);

router.get(
  '/reports/monthly',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  AttendanceController.getSummary
);

export const attendanceRouter = router;
