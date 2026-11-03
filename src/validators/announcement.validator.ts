import { z } from 'zod';
import {
  ANNOUNCEMENT_TYPES,
  ANNOUNCEMENT_PRIORITIES,
  TARGET_AUDIENCES,
  ANNOUNCEMENT_STATUSES,
} from '../models/announcement.model';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const objectIdSchema = z.string().regex(objectIdRegex, 'Invalid MongoDB ObjectId format');

const normalizeArrayField = (val: unknown) => {
  if (val === undefined || val === null || val === '') return undefined;
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return val.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  return val;
};

const objectIdArraySchema = z.preprocess(
  normalizeArrayField,
  z.array(objectIdSchema).optional()
);

const stringArraySchema = z.preprocess(
  normalizeArrayField,
  z.array(z.string().trim().min(1)).optional()
);

export const createAnnouncementSchema = z.object({
  body: z.object({
    title: z.string().trim().min(3, 'Title must be at least 3 characters').max(300),
    content: z.string().trim().min(3, 'Content must be at least 3 characters'),
    summary: z.string().trim().max(500).optional(),
    announcementType: z.enum(ANNOUNCEMENT_TYPES).optional().default('general'),
    priority: z.enum(ANNOUNCEMENT_PRIORITIES).optional().default('normal'),
    targetAudience: z.enum(TARGET_AUDIENCES).optional(),
    targetRoles: stringArraySchema,
    targetDepartments: objectIdArraySchema,
    targetClasses: objectIdArraySchema,
    targetSections: objectIdArraySchema,
    targetSubjects: objectIdArraySchema,
    specificRecipients: objectIdArraySchema,
    publishAt: z.string().datetime({ offset: true }).or(z.string().min(1)).optional(),
    expiresAt: z.string().datetime({ offset: true }).or(z.string().min(1)).optional(),
    status: z.enum(ANNOUNCEMENT_STATUSES).optional(),
    isMandatory: z
      .preprocess((v) => (v === 'true' ? true : v === 'false' ? false : v), z.boolean().optional()),
  }),
});

export const updateAnnouncementSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    title: z.string().trim().min(3).max(300).optional(),
    content: z.string().trim().min(3).optional(),
    summary: z.string().trim().max(500).optional(),
    announcementType: z.enum(ANNOUNCEMENT_TYPES).optional(),
    priority: z.enum(ANNOUNCEMENT_PRIORITIES).optional(),
    targetAudience: z.enum(TARGET_AUDIENCES).optional(),
    targetRoles: stringArraySchema,
    targetDepartments: objectIdArraySchema,
    targetClasses: objectIdArraySchema,
    targetSections: objectIdArraySchema,
    targetSubjects: objectIdArraySchema,
    specificRecipients: objectIdArraySchema,
    publishAt: z.string().nullable().optional(),
    expiresAt: z.string().nullable().optional(),
    isMandatory: z
      .preprocess((v) => (v === 'true' ? true : v === 'false' ? false : v), z.boolean().optional()),
    changeNote: z.string().trim().max(300).optional(),
  }),
});

export const announcementIdParamSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

export const listAnnouncementsQuerySchema = z.object({
  query: z.object({
    status: z.enum(ANNOUNCEMENT_STATUSES).optional(),
    announcementType: z.enum(ANNOUNCEMENT_TYPES).optional(),
    priority: z.enum(ANNOUNCEMENT_PRIORITIES).optional(),
    search: z.string().optional(),
    includeExpired: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
    page: z
      .string()
      .transform((v) => parseInt(v, 10))
      .optional(),
    limit: z
      .string()
      .transform((v) => parseInt(v, 10))
      .optional(),
  }),
});
