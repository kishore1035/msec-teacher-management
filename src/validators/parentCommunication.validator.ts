import { z } from 'zod';
import {
  PARENT_COMMUNICATION_TYPES,
  PARENT_COMMUNICATION_STATUSES,
} from '../models/parentCommunication.model';

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
      path: val.path || val.filePath || `uploads/communications/${filename}`,
      uploadedAt: new Date(),
    };
  });

export const createParentCommunicationSchema = z.object({
  body: z.object({
    parent: objectIdSchema.optional(),
    student: objectIdSchema,
    teacher: objectIdSchema,
    subject: objectIdSchema.optional(),
    communicationType: z.enum(PARENT_COMMUNICATION_TYPES).optional().default('general'),
    subjectLine: z.string().trim().min(3, 'Subject line must be at least 3 characters').max(300),
    message: z.string().trim().min(3, 'Message must be at least 3 characters').max(10000),
    attachments: z.array(attachmentInputSchema).optional().default([]),
    meetingDetails: z
      .object({
        requestedDates: z.array(z.string()).optional(),
        preferredMode: z.enum(['in_person', 'online', 'phone']).optional(),
        agenda: z.string().trim().max(1000).optional(),
        scheduledAt: z.string().optional(),
        locationOrLink: z.string().trim().max(500).optional(),
      })
      .optional(),
  }),
});

export const createMeetingRequestSchema = z.object({
  body: z.object({
    parent: objectIdSchema.optional(),
    student: objectIdSchema,
    teacher: objectIdSchema,
    subject: objectIdSchema.optional(),
    subjectLine: z.string().trim().min(3).max(300).optional().default('Parent-Teacher Meeting Request'),
    message: z.string().trim().min(3).max(10000),
    requestedDates: z.array(z.string()).min(1, 'At least one requested date is required').optional(),
    preferredMode: z.enum(['in_person', 'online', 'phone']).optional().default('in_person'),
    agenda: z.string().trim().min(3).max(1000).optional(),
    scheduledAt: z.string().optional(),
    locationOrLink: z.string().trim().max(500).optional(),
    attachments: z.array(attachmentInputSchema).optional().default([]),
  }),
});

export const addParentCommunicationMessageSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    message: z.string().trim().min(1, 'Message cannot be empty').max(10000),
    attachments: z.array(attachmentInputSchema).optional().default([]),
    meetingUpdate: z
      .object({
        scheduledAt: z.string().optional(),
        locationOrLink: z.string().trim().max(500).optional(),
        meetingStatus: z
          .enum(['requested', 'confirmed', 'rescheduled', 'completed', 'cancelled'])
          .optional(),
      })
      .optional(),
  }),
});

export const closeParentCommunicationSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    reason: z.string().trim().max(500).optional(),
  }),
});

export const parentCommunicationQuerySchema = z.object({
  query: z.object({
    parent: objectIdSchema.optional(),
    student: objectIdSchema.optional(),
    teacher: objectIdSchema.optional(),
    subject: objectIdSchema.optional(),
    communicationType: z.enum(PARENT_COMMUNICATION_TYPES).optional(),
    status: z.enum(PARENT_COMMUNICATION_STATUSES).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
});
