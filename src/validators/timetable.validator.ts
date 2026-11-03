import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const objectIdSchema = z
  .string()
  .regex(objectIdRegex, 'Invalid ObjectId format');

export const dayOfWeekEnum = z.enum([
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]);

export const lectureTypeEnum = z.enum([
  'theory',
  'practical',
  'tutorial',
  'lab',
  'project',
  'break',
  'other',
]);

export const timetableTypeEnum = z.enum([
  'regular',
  'temporary',
  'examination',
  'special',
]);

export const timetableStatusEnum = z.enum(['draft', 'published', 'archived']);

export const timetableChangeTypeEnum = z.enum([
  'cancellation',
  'rescheduling',
  'substitution',
  'classroom_change',
  'temporary_override',
]);

// Timetable creation validator
export const createTimetableSchema = z.object({
  body: z
    .object({
      name: z.string().min(1, 'Name is required').max(120, 'Name too long'),
      academicYear: objectIdSchema,
      semester: z.coerce.number().int().min(1).max(8),
      department: objectIdSchema,
      class: objectIdSchema,
      section: objectIdSchema,
      effectiveFrom: z.coerce.date(),
      effectiveTo: z.coerce.date(),
      timetableType: timetableTypeEnum.optional().default('regular'),
      status: timetableStatusEnum.optional().default('draft'),
    })
    .refine((data) => data.effectiveTo >= data.effectiveFrom, {
      message: 'effectiveTo must be greater than or equal to effectiveFrom',
      path: ['effectiveTo'],
    }),
});

// Timetable update validator
export const updateTimetableSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z
    .object({
      name: z.string().min(1).max(120).optional(),
      academicYear: objectIdSchema.optional(),
      semester: z.coerce.number().int().min(1).max(8).optional(),
      department: objectIdSchema.optional(),
      class: objectIdSchema.optional(),
      section: objectIdSchema.optional(),
      effectiveFrom: z.coerce.date().optional(),
      effectiveTo: z.coerce.date().optional(),
      timetableType: timetableTypeEnum.optional(),
      status: timetableStatusEnum.optional(),
    })
    .refine(
      (data) => {
        if (data.effectiveFrom && data.effectiveTo) {
          return data.effectiveTo >= data.effectiveFrom;
        }
        return true;
      },
      {
        message: 'effectiveTo must be greater than or equal to effectiveFrom',
        path: ['effectiveTo'],
      }
    ),
});

// Timetable Entry creation validator
export const createTimetableEntrySchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z
    .object({
      dayOfWeek: dayOfWeekEnum,
      periodNumber: z.coerce.number().int().min(1).max(12),
      startTime: z.string().regex(timeRegex, 'Start time must be HH:mm (e.g. 09:00)'),
      endTime: z.string().regex(timeRegex, 'End time must be HH:mm (e.g. 09:55)'),
      subject: objectIdSchema.optional(),
      teacher: objectIdSchema.optional(),
      additionalTeachers: z.array(objectIdSchema).optional(),
      classroom: z.string().min(1, 'Classroom is required').max(50),
      lectureType: lectureTypeEnum.optional().default('theory'),
      isBreak: z.boolean().optional().default(false),
      allowOverride: z.boolean().optional().default(false),
      overrideReason: z.string().min(3).optional(),
    })
    .refine((data) => data.startTime < data.endTime, {
      message: 'startTime must be strictly before endTime',
      path: ['endTime'],
    }),
});

// Timetable Entry update validator
export const updateTimetableEntrySchema = z.object({
  params: z.object({
    entryId: objectIdSchema,
  }),
  body: z
    .object({
      dayOfWeek: dayOfWeekEnum.optional(),
      periodNumber: z.coerce.number().int().min(1).max(12).optional(),
      startTime: z.string().regex(timeRegex).optional(),
      endTime: z.string().regex(timeRegex).optional(),
      subject: objectIdSchema.optional(),
      teacher: objectIdSchema.optional(),
      additionalTeachers: z.array(objectIdSchema).optional(),
      classroom: z.string().min(1).max(50).optional(),
      lectureType: lectureTypeEnum.optional(),
      isBreak: z.boolean().optional(),
      status: z.enum(['active', 'cancelled', 'rescheduled', 'substituted']).optional(),
      allowOverride: z.boolean().optional().default(false),
      overrideReason: z.string().min(3).optional(),
    })
    .refine(
      (data) => {
        if (data.startTime && data.endTime) {
          return data.startTime < data.endTime;
        }
        return true;
      },
      {
        message: 'startTime must be strictly before endTime',
        path: ['endTime'],
      }
    ),
});

// Pre-flight conflict check schema
export const checkConflictSchema = z.object({
  body: z
    .object({
      timetableId: objectIdSchema.optional(),
      academicYear: objectIdSchema.optional(),
      semester: z.coerce.number().int().min(1).max(8).optional(),
      section: objectIdSchema.optional(),
      dayOfWeek: dayOfWeekEnum,
      periodNumber: z.coerce.number().int().min(1).max(12).optional(),
      startTime: z.string().regex(timeRegex),
      endTime: z.string().regex(timeRegex),
      teacher: objectIdSchema.optional(),
      additionalTeachers: z.array(objectIdSchema).optional(),
      classroom: z.string().min(1).max(50),
      effectiveFrom: z.coerce.date().optional(),
      effectiveTo: z.coerce.date().optional(),
      excludeEntryId: objectIdSchema.optional(),
    })
    .refine((data) => data.startTime < data.endTime, {
      message: 'startTime must be strictly before endTime',
      path: ['endTime'],
    }),
});

// Override conflict schema
export const overrideConflictSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    conflictType: z.string().min(1, 'Conflict type is required'),
    conflictDetails: z.string().min(1, 'Conflict details are required'),
    reason: z.string().min(3, 'Reason must be at least 3 characters'),
    entryId: objectIdSchema.optional(),
  }),
});

// Timetable change creation schema
export const createTimetableChangeSchema = z.object({
  body: z.object({
    timetable: objectIdSchema,
    entry: objectIdSchema,
    changeType: timetableChangeTypeEnum,
    effectiveDate: z.coerce.date(),
    originalTeacher: objectIdSchema.optional(),
    substituteTeacher: objectIdSchema.optional(),
    originalClassroom: z.string().optional(),
    newClassroom: z.string().optional(),
    originalStartTime: z.string().regex(timeRegex).optional(),
    newStartTime: z.string().regex(timeRegex).optional(),
    originalEndTime: z.string().regex(timeRegex).optional(),
    newEndTime: z.string().regex(timeRegex).optional(),
    originalDayOfWeek: dayOfWeekEnum.optional(),
    newDayOfWeek: dayOfWeekEnum.optional(),
    originalPeriodNumber: z.coerce.number().int().min(1).max(12).optional(),
    newPeriodNumber: z.coerce.number().int().min(1).max(12).optional(),
    reason: z.string().min(3, 'Reason must be at least 3 characters'),
  }),
});

// Approve or reject timetable change
export const approveRejectChangeSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    status: z.enum(['approved', 'rejected']),
    rejectionReason: z.string().min(3).optional(),
  }),
});

// Query Timetables
export const queryTimetableSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    academicYear: objectIdSchema.optional(),
    semester: z.coerce.number().int().min(1).max(8).optional(),
    department: objectIdSchema.optional(),
    class: objectIdSchema.optional(),
    section: objectIdSchema.optional(),
    status: timetableStatusEnum.optional(),
    timetableType: timetableTypeEnum.optional(),
  }),
});

// Query Analytics
export const queryAnalyticsSchema = z.object({
  query: z.object({
    academicYear: objectIdSchema.optional(),
    semester: z.coerce.number().int().min(1).max(8).optional(),
    department: objectIdSchema.optional(),
    section: objectIdSchema.optional(),
    dayOfWeek: dayOfWeekEnum.optional(),
    periodNumber: z.coerce.number().int().min(1).max(12).optional(),
  }),
});

export const timetableIdParamSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

export const sectionIdParamSchema = z.object({
  params: z.object({
    sectionId: objectIdSchema,
  }),
});
