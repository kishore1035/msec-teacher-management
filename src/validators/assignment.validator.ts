import { z } from 'zod';
import { Types } from 'mongoose';

const objectIdSchema = z.string().refine((val) => Types.ObjectId.isValid(val), {
  message: 'Invalid MongoDB ObjectId',
});

export const createAssignmentSchema = z
  .object({
    title: z.string().trim().min(3, 'Title must be at least 3 characters').max(200),
    description: z.string().trim().min(5, 'Description must be at least 5 characters'),
    instructions: z.string().trim().optional(),
    academicYear: objectIdSchema,
    semester: z.coerce.number().int().min(1).max(10),
    section: objectIdSchema,
    subject: objectIdSchema,
    teacher: objectIdSchema.optional(),
    assignmentType: z
      .enum(['homework', 'project', 'practical', 'presentation', 'research', 'other'])
      .default('homework'),
    totalMarks: z.coerce.number().positive('Total marks must be greater than 0'),
    passingMarks: z.coerce.number().min(0, 'Passing marks cannot be negative'),
    assignedDate: z.coerce.date().optional(),
    dueDate: z.coerce.date(),
    allowLateSubmission: z.coerce.boolean().default(false),
    lateSubmissionDeadline: z.coerce.date().optional(),
    maxResubmissions: z.coerce.number().int().min(0).default(1),
  })
  .refine((data) => data.passingMarks <= data.totalMarks, {
    message: 'Passing marks cannot exceed total marks',
    path: ['passingMarks'],
  })
  .refine(
    (data) => {
      if (data.allowLateSubmission && data.lateSubmissionDeadline) {
        return data.lateSubmissionDeadline >= data.dueDate;
      }
      return true;
    },
    {
      message: 'Late submission deadline cannot be earlier than due date',
      path: ['lateSubmissionDeadline'],
    }
  );

export const updateAssignmentSchema = z
  .object({
    title: z.string().trim().min(3).max(200).optional(),
    description: z.string().trim().min(5).optional(),
    instructions: z.string().trim().optional(),
    totalMarks: z.coerce.number().positive().optional(),
    passingMarks: z.coerce.number().min(0).optional(),
    dueDate: z.coerce.date().optional(),
    allowLateSubmission: z.coerce.boolean().optional(),
    lateSubmissionDeadline: z.coerce.date().optional(),
    maxResubmissions: z.coerce.number().int().min(0).optional(),
    status: z.enum(['draft', 'published', 'closed', 'archived']).optional(),
  })
  .refine(
    (data) => {
      if (data.totalMarks !== undefined && data.passingMarks !== undefined) {
        return data.passingMarks <= data.totalMarks;
      }
      return true;
    },
    {
      message: 'Passing marks cannot exceed total marks',
      path: ['passingMarks'],
    }
  );

export const assignmentQuerySchema = z.object({
  academicYear: objectIdSchema.optional(),
  semester: z.coerce.number().int().min(1).max(10).optional(),
  section: objectIdSchema.optional(),
  subject: objectIdSchema.optional(),
  teacher: objectIdSchema.optional(),
  status: z.enum(['draft', 'published', 'closed', 'archived']).optional(),
  assignmentType: z
    .enum(['homework', 'project', 'practical', 'presentation', 'research', 'other'])
    .optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const submitAssignmentSchema = z.object({
  submissionText: z.string().trim().optional(),
});

export const evaluateSubmissionSchema = z.object({
  marksObtained: z.coerce.number().min(0, 'Marks obtained cannot be negative'),
  feedback: z.string().trim().optional(),
  reason: z.string().trim().optional(),
});

export const returnSubmissionSchema = z.object({
  reason: z.string().trim().min(3, 'Return reason must be at least 3 characters'),
});

export const analyticsQuerySchema = z.object({
  academicYear: objectIdSchema.optional(),
  semester: z.coerce.number().int().min(1).max(10).optional(),
  section: objectIdSchema.optional(),
  subject: objectIdSchema.optional(),
  assignment: objectIdSchema.optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});
