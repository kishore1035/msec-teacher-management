import { z } from 'zod';
import { Types } from 'mongoose';

export const objectIdSchema = z.string().refine((val) => Types.ObjectId.isValid(val), {
  message: 'Invalid MongoDB ObjectId',
});

export const createExaminationSchema = z
  .object({
    name: z.string().trim().min(3, 'Examination name must be at least 3 characters'),
    examinationCode: z.string().trim().min(3, 'Examination code must be at least 3 characters'),
    examinationType: z.enum([
      'IA1',
      'IA2',
      'IA3',
      'semester',
      'practical',
      'supplementary',
      'other',
    ]),
    academicYear: objectIdSchema,
    semester: z.coerce.number().int().min(1).max(10),
    section: objectIdSchema.optional(),
    subject: objectIdSchema.optional(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    maximumMarks: z.coerce.number().positive('Maximum marks must be greater than 0'),
    passingMarks: z.coerce.number().min(0, 'Passing marks cannot be negative'),
    duration: z.coerce.number().int().min(15, 'Duration must be at least 15 minutes'),
    instructions: z.string().trim().optional(),
  })
  .refine((data) => data.passingMarks <= data.maximumMarks, {
    message: 'Passing marks cannot exceed maximum marks',
    path: ['passingMarks'],
  })
  .refine((data) => data.startDate <= data.endDate, {
    message: 'End date must be on or after start date',
    path: ['endDate'],
  });

export const updateExaminationSchema = z
  .object({
    name: z.string().trim().min(3).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    maximumMarks: z.coerce.number().positive().optional(),
    passingMarks: z.coerce.number().min(0).optional(),
    duration: z.coerce.number().int().min(15).optional(),
    instructions: z.string().trim().optional(),
    status: z
      .enum(['draft', 'scheduled', 'ongoing', 'completed', 'published', 'cancelled'])
      .optional(),
  })
  .refine(
    (data) => {
      if (data.maximumMarks !== undefined && data.passingMarks !== undefined) {
        return data.passingMarks <= data.maximumMarks;
      }
      return true;
    },
    {
      message: 'Passing marks cannot exceed maximum marks',
      path: ['passingMarks'],
    }
  );

export const createScheduleSchema = z.object({
  subject: objectIdSchema,
  section: objectIdSchema,
  examDate: z.coerce.date(),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Start time must be in HH:MM format'),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'End time must be in HH:MM format'),
  venue: z.string().trim().min(2, 'Venue is required'),
  invigilators: z.array(objectIdSchema).optional().default([]),
  instructions: z.string().trim().optional(),
});

export const updateScheduleSchema = z.object({
  examDate: z.coerce.date().optional(),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  venue: z.string().trim().min(2).optional(),
  invigilators: z.array(objectIdSchema).optional(),
  instructions: z.string().trim().optional(),
  status: z.enum(['scheduled', 'rescheduled', 'completed', 'cancelled']).optional(),
  rescheduleReason: z.string().trim().optional(),
});

const studentMarkEntrySchema = z
  .object({
    student: objectIdSchema,
    marksObtained: z.coerce.number().min(0).optional(),
    isAbsent: z.boolean().optional().default(false),
    isExempted: z.boolean().optional().default(false),
    remarks: z.string().trim().optional(),
  })
  .refine(
    (data) => data.isAbsent || data.isExempted || data.marksObtained !== undefined,
    {
      message: 'marksObtained is required unless student is marked absent or exempted',
      path: ['marksObtained'],
    }
  );

export const bulkMarksEntrySchema = z.object({
  subject: objectIdSchema,
  marks: z.array(studentMarkEntrySchema).min(1, 'At least one student mark entry is required'),
});

export const correctResultSchema = z.object({
  marksObtained: z.coerce.number().min(0, 'Marks obtained cannot be negative'),
  reason: z.string().trim().min(3, 'Correction reason must be at least 3 characters'),
  remarks: z.string().trim().optional(),
});

export const gradingPolicySchema = z.object({
  academicYear: objectIdSchema.optional(),
  name: z.string().trim().min(3),
  isDefault: z.boolean().optional().default(false),
  iaCalculationMethod: z.enum(['BEST_2_OF_3', 'AVERAGE_ALL', 'WEIGHTED']).default('BEST_2_OF_3'),
  iaWeights: z
    .object({
      ia1: z.number().min(0).max(1),
      ia2: z.number().min(0).max(1),
      ia3: z.number().min(0).max(1),
    })
    .optional(),
  minimumPassingPercentage: z.number().min(0).max(100).default(40),
  grades: z
    .array(
      z.object({
        grade: z.string().trim().min(1),
        minPercentage: z.number().min(0).max(100),
        maxPercentage: z.number().min(0).max(100),
        gradePoint: z.number().min(0).max(10),
        description: z.string().trim(),
        isPassing: z.boolean(),
      })
    )
    .optional(),
});

export const examinationQuerySchema = z.object({
  academicYear: objectIdSchema.optional(),
  semester: z.coerce.number().int().min(1).max(10).optional(),
  section: objectIdSchema.optional(),
  subject: objectIdSchema.optional(),
  examinationType: z.enum(['IA1', 'IA2', 'IA3', 'semester', 'practical', 'supplementary', 'other']).optional(),
  status: z.enum(['draft', 'scheduled', 'ongoing', 'completed', 'published', 'cancelled']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Middleware request validators
export const createExaminationValidator = z.object({
  body: createExaminationSchema,
});

export const updateExaminationValidator = z.object({
  params: z.object({ id: objectIdSchema }),
  body: updateExaminationSchema,
});

export const updateExaminationStatusValidator = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    status: z.enum(['draft', 'scheduled', 'ongoing', 'completed', 'published', 'cancelled']),
  }),
});

export const createScheduleValidator = z.object({
  params: z.object({ id: objectIdSchema }), // exam id
  body: createScheduleSchema,
});

export const updateScheduleValidator = z.object({
  params: z.object({ id: objectIdSchema }),
  body: updateScheduleSchema,
});

export const bulkMarksEntryValidator = z.object({
  params: z.object({ id: objectIdSchema }), // exam id
  body: bulkMarksEntrySchema,
});

export const correctResultValidator = z.object({
  params: z.object({ resultId: objectIdSchema }),
  body: correctResultSchema,
});

export const gradingPolicyValidator = z.object({
  body: gradingPolicySchema,
});

export const examinationQueryValidator = z.object({
  query: examinationQuerySchema,
});
