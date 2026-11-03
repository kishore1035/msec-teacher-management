import { z } from 'zod';
import { DOUBT_CATEGORIES, DOUBT_PRIORITIES, DOUBT_STATUSES } from '../models/doubt.model';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const objectIdSchema = z.string().regex(objectIdRegex, 'Invalid MongoDB ObjectId');

const attachmentInputSchema = z
  .object({
    filename: z.string().min(1).max(255).optional(),
    fileName: z.string().min(1).max(255).optional(),
    originalName: z.string().min(1).max(255).optional(),
    mimeType: z.string().min(1).max(120).optional(),
    fileType: z.string().min(1).max(120).optional(),
    size: z.number().int().nonnegative().optional(),
    fileSize: z.number().int().nonnegative().optional(),
    path: z.string().min(1).max(500).optional(),
    filePath: z.string().min(1).max(500).optional(),
  })
  .transform((val) => {
    const filename = val.filename || val.fileName || val.originalName || 'attachment';
    return {
      filename,
      originalName: val.originalName || filename,
      mimeType: val.mimeType || val.fileType || 'application/octet-stream',
      size: val.size ?? val.fileSize ?? 0,
      path: val.path || val.filePath || `uploads/doubts/${filename}`,
      uploadedAt: new Date(),
    };
  });

export const createDoubtSchema = z.object({
  body: z.object({
    title: z.string().trim().min(3, 'Title must be at least 3 characters').max(300),
    description: z.string().trim().min(5, 'Description must be at least 5 characters'),
    student: objectIdSchema.optional(),
    subject: objectIdSchema,
    section: objectIdSchema.optional(),
    academicYear: objectIdSchema.optional(),
    semester: z.number().int().min(1).max(10).optional(),
    assignedTeacher: objectIdSchema.optional(),
    category: z.enum(DOUBT_CATEGORIES).optional().default('conceptual'),
    priority: z.enum(DOUBT_PRIORITIES).optional().default('normal'),
    topic: z.string().trim().max(200).optional(),
    tags: z.array(z.string().trim().max(50)).optional().default([]),
    attachments: z.array(attachmentInputSchema).optional().default([]),
  }),
});

export const updateDoubtSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    title: z.string().trim().min(3).max(300).optional(),
    description: z.string().trim().min(5).optional(),
    category: z.enum(DOUBT_CATEGORIES).optional(),
    priority: z.enum(DOUBT_PRIORITIES).optional(),
    topic: z.string().trim().max(200).optional(),
    tags: z.array(z.string().trim().max(50)).optional(),
    attachments: z.array(attachmentInputSchema).optional(),
  }),
});

export const assignDoubtSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    assignedTeacher: objectIdSchema,
    reason: z.string().trim().max(500).optional(),
  }),
});

export const updateDoubtStatusSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    status: z.enum(DOUBT_STATUSES),
    reason: z.string().trim().max(500).optional(),
  }),
});

export const createDoubtMessageSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    message: z.string().trim().min(1, 'Message cannot be empty').max(10000),
    attachments: z.array(attachmentInputSchema).optional().default([]),
    isInternalNote: z.boolean().optional().default(false),
    markAsStatus: z.enum(['in_progress', 'answered', 'resolved']).optional(),
  }),
});

export const getDoubtMessagesQuerySchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
});

export const reopenDoubtSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    reason: z.string().trim().min(3, 'Reopen reason must be at least 3 characters').max(1000),
  }),
});

export const doubtQuerySchema = z.object({
  query: z.object({
    student: objectIdSchema.optional(),
    subject: objectIdSchema.optional(),
    section: objectIdSchema.optional(),
    academicYear: objectIdSchema.optional(),
    semester: z.coerce.number().int().min(1).max(10).optional(),
    assignedTeacher: objectIdSchema.optional(),
    category: z.enum(DOUBT_CATEGORIES).optional(),
    priority: z.enum(DOUBT_PRIORITIES).optional(),
    status: z.enum(DOUBT_STATUSES).optional(),
    search: z.string().trim().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
});

export const doubtAnalyticsQuerySchema = z.object({
  query: z.object({
    subject: objectIdSchema.optional(),
    section: objectIdSchema.optional(),
    academicYear: objectIdSchema.optional(),
    semester: z.coerce.number().int().min(1).max(10).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    overdueHours: z.coerce.number().int().positive().optional(),
  }),
});
