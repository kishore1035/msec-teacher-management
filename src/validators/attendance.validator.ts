import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const objectIdSchema = z.string().regex(objectIdRegex, 'Invalid ObjectId format');

export const createAttendanceSessionSchema = z.object({
  body: z.object({
    academicYear: objectIdSchema,
    section: objectIdSchema,
    subject: objectIdSchema,
    teacher: objectIdSchema,
    date: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Invalid date format (YYYY-MM-DD)')),
    semester: z.number().int().min(1).max(10),
    periodNumber: z.number().int().min(1).max(10),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    sessionType: z.enum(['Regular', 'Lab', 'Extra', 'Tutorial']).default('Regular'),
  }),
});

export const updateAttendanceSessionSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    sessionType: z.enum(['Regular', 'Lab', 'Extra', 'Tutorial']).optional(),
    status: z.enum(['Scheduled', 'Completed', 'Cancelled']).optional(),
  }),
});

export const cancelAttendanceSessionSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    reason: z.string().min(3, 'Cancellation reason is required'),
  }),
});

export const bulkMarkAttendanceSchema = z.object({
  params: z.object({
    sessionId: objectIdSchema,
  }),
  body: z.object({
    records: z
      .array(
        z.object({
          student: objectIdSchema,
          status: z.enum(['Present', 'Absent', 'Late', 'Excused']),
          remarks: z.string().optional(),
        })
      )
      .min(1, 'At least one student attendance record must be provided'),
  }),
});

export const updateAttendanceRecordSchema = z.object({
  params: z.object({
    recordId: objectIdSchema,
  }),
  body: z.object({
    status: z.enum(['Present', 'Absent', 'Late', 'Excused']),
    correctionReason: z.string().min(3, 'Correction reason is required for audit compliance'),
    remarks: z.string().optional(),
  }),
});

export const attendancePolicySchemaValidator = z.object({
  body: z.object({
    academicYear: objectIdSchema,
    institutionThreshold: z.number().min(1).max(100).default(75),
    warningThreshold: z.number().min(1).max(100).default(85),
    subjectThresholds: z
      .array(
        z.object({
          subject: objectIdSchema,
          threshold: z.number().min(1).max(100),
        })
      )
      .optional()
      .default([]),
    lateTreatment: z.enum(['Present', 'CountAsHalf', 'Absent']).default('Present'),
    excusedTreatment: z.enum(['Present', 'ExcludeFromTotal', 'Absent']).default('ExcludeFromTotal'),
    effectiveDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
  }),
});

export const updateAttendancePolicySchemaValidator = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    institutionThreshold: z.number().min(1).max(100).optional(),
    warningThreshold: z.number().min(1).max(100).optional(),
    subjectThresholds: z
      .array(
        z.object({
          subject: objectIdSchema,
          threshold: z.number().min(1).max(100),
        })
      )
      .optional(),
    lateTreatment: z.enum(['Present', 'CountAsHalf', 'Absent']).optional(),
    excusedTreatment: z.enum(['Present', 'ExcludeFromTotal', 'Absent']).optional(),
    status: z.enum(['Active', 'Archived']).optional(),
  }),
});
