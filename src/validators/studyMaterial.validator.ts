import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const objectIdSchema = z.string().regex(objectIdRegex, 'Invalid ObjectId');

const materialTypes = [
  'notes',
  'lecture',
  'presentation',
  'reference',
  'textbook',
  'question_paper',
  'syllabus',
  'video',
  'other',
] as const;

const materialVisibilities = ['class', 'subject', 'institution'] as const;
const materialStatuses = ['draft', 'published', 'archived'] as const;

export const createStudyMaterialSchema = z.object({
  body: z.object({
    title: z.string().min(2, 'Title must be at least 2 characters').max(200),
    description: z.string().min(2, 'Description must be at least 2 characters').max(2000),
    materialType: z.enum(materialTypes),
    subject: objectIdSchema,
    section: objectIdSchema.optional(),
    academicYear: objectIdSchema,
    semester: z.union([z.number(), z.string().transform((v) => Number(v))]),
    topic: z.string().max(100).optional(),
    unit: z.string().max(50).optional(),
    tags: z
      .union([
        z.array(z.string()),
        z.string().transform((v) => {
          try {
            const parsed = JSON.parse(v);
            return Array.isArray(parsed) ? parsed : [v];
          } catch {
            return v.split(',').map((s) => s.trim()).filter(Boolean);
          }
        }),
      ])
      .optional(),
    visibility: z.enum(materialVisibilities).default('class'),
    status: z.enum(materialStatuses).default('draft'),
  }),
});

export const updateStudyMaterialSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    title: z.string().min(2).max(200).optional(),
    description: z.string().min(2).max(2000).optional(),
    materialType: z.enum(materialTypes).optional(),
    topic: z.string().max(100).optional(),
    unit: z.string().max(50).optional(),
    tags: z
      .union([
        z.array(z.string()),
        z.string().transform((v) => {
          try {
            const parsed = JSON.parse(v);
            return Array.isArray(parsed) ? parsed : [v];
          } catch {
            return v.split(',').map((s) => s.trim()).filter(Boolean);
          }
        }),
      ])
      .optional(),
    visibility: z.enum(materialVisibilities).optional(),
    status: z.enum(materialStatuses).optional(),
    changeDescription: z.string().min(2).default('Updated study material content'),
  }),
});

export const materialQuerySchema = z.object({
  query: z.object({
    subject: objectIdSchema.optional(),
    section: objectIdSchema.optional(),
    academicYear: objectIdSchema.optional(),
    semester: z.string().transform((v) => Number(v)).optional(),
    teacher: objectIdSchema.optional(),
    materialType: z.enum(materialTypes).optional(),
    visibility: z.enum(materialVisibilities).optional(),
    status: z.enum(materialStatuses).optional(),
    unit: z.string().optional(),
    tag: z.string().optional(),
    page: z.string().transform((v) => Number(v)).optional(),
    limit: z.string().transform((v) => Number(v)).optional(),
  }),
});

export const searchMaterialsSchema = z.object({
  query: z.object({
    q: z.string().min(1, 'Search query cannot be empty'),
    subject: objectIdSchema.optional(),
    section: objectIdSchema.optional(),
    materialType: z.enum(materialTypes).optional(),
    semester: z.string().transform((v) => Number(v)).optional(),
    page: z.string().transform((v) => Number(v)).optional(),
    limit: z.string().transform((v) => Number(v)).optional(),
  }),
});

export const materialIdParamSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

export const attachmentIdParamSchema = z.object({
  params: z.object({
    attachmentId: objectIdSchema,
  }),
});

export const materialAttachmentParamSchema = z.object({
  params: z.object({
    id: objectIdSchema,
    attachmentId: objectIdSchema.optional(),
  }),
});

export const versionIdParamSchema = z.object({
  params: z.object({
    id: objectIdSchema,
    versionId: z.string(),
  }),
});

export const materialAnalyticsQuerySchema = z.object({
  query: z.object({
    academicYear: objectIdSchema.optional(),
    semester: z.string().transform((v) => Number(v)).optional(),
    subject: objectIdSchema.optional(),
    teacher: objectIdSchema.optional(),
  }),
});
