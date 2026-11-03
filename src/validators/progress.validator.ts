import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const objectIdSchema = z.string().regex(objectIdRegex, 'Invalid ObjectId');

export const createRiskRuleSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Rule name must be at least 2 characters'),
    isDefault: z.boolean().optional(),
    academicYear: objectIdSchema.optional(),
    attendanceThreshold: z.number().min(0).max(100).optional(),
    assignmentCompletionThreshold: z.number().min(0).max(100).optional(),
    iaPassPercentageThreshold: z.number().min(0).max(100).optional(),
    examPassPercentageThreshold: z.number().min(0).max(100).optional(),
    consecutiveDeclinesThreshold: z.number().min(1).optional(),
    failedSubjectsThreshold: z.number().min(1).optional(),
    riskWeights: z
      .object({
        attendance: z.number().min(0).max(100),
        assignments: z.number().min(0).max(100),
        internalAssessments: z.number().min(0).max(100),
        examinations: z.number().min(0).max(100),
      })
      .optional(),
    riskScoreTiers: z
      .object({
        high: z.number().min(0).max(100),
        medium: z.number().min(0).max(100),
        low: z.number().min(0).max(100),
      })
      .optional(),
  }),
});

export const studentProgressQuerySchema = z.object({
  params: z.object({
    studentId: objectIdSchema,
  }),
  query: z.object({
    academicYear: objectIdSchema.optional(),
    semester: z.string().transform((val) => Number(val)).optional(),
    subjectId: objectIdSchema.optional(),
    recalculate: z.enum(['true', 'false']).transform((val) => val === 'true').optional(),
  }),
});

export const atRiskQuerySchema = z.object({
  query: z.object({
    academicYear: objectIdSchema.optional(),
    semester: z.string().transform((val) => Number(val)).optional(),
    sectionId: objectIdSchema.optional(),
    departmentId: objectIdSchema.optional(),
    riskLevel: z.enum(['low', 'medium', 'high']).optional(),
    page: z.string().transform((val) => Number(val)).optional(),
    limit: z.string().transform((val) => Number(val)).optional(),
  }),
});

export const atRiskStudentParamSchema = z.object({
  params: z.object({
    studentId: objectIdSchema,
  }),
  query: z.object({
    academicYear: objectIdSchema.optional(),
    semester: z.string().transform((val) => Number(val)).optional(),
  }),
});

export const classAnalyticsQuerySchema = z.object({
  query: z.object({
    academicYear: objectIdSchema.optional(),
    semester: z.string().transform((val) => Number(val)).optional(),
    department: objectIdSchema.optional(),
    class: objectIdSchema.optional(),
    section: objectIdSchema.optional(),
    subject: objectIdSchema.optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }),
});

export const subjectAnalyticsQuerySchema = z.object({
  query: z.object({
    academicYear: objectIdSchema.optional(),
    semester: z.string().transform((val) => Number(val)).optional(),
    subject: objectIdSchema.optional(),
    section: objectIdSchema.optional(),
    department: objectIdSchema.optional(),
  }),
});

export const teacherInsightsQuerySchema = z.object({
  query: z.object({
    academicYear: objectIdSchema.optional(),
    semester: z.string().transform((val) => Number(val)).optional(),
    section: objectIdSchema.optional(),
    subject: objectIdSchema.optional(),
  }),
});

export const studentReportParamSchema = z.object({
  params: z.object({
    studentId: objectIdSchema,
  }),
  query: z.object({
    academicYear: objectIdSchema.optional(),
    semester: z.string().transform((val) => Number(val)).optional(),
    format: z.enum(['json', 'pdf', 'excel', 'csv']).default('json'),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }),
});

export const classReportParamSchema = z.object({
  params: z.object({
    sectionId: objectIdSchema,
  }),
  query: z.object({
    academicYear: objectIdSchema.optional(),
    semester: z.string().transform((val) => Number(val)).optional(),
    format: z.enum(['json', 'pdf', 'excel', 'csv']).default('json'),
  }),
});

export const generateReportBodySchema = z.object({
  params: z.object({
    studentId: objectIdSchema,
  }),
  body: z.object({
    academicYear: objectIdSchema.optional(),
    semester: z.number().min(1).max(10).optional(),
    notes: z.string().max(1000).optional(),
    saveSnapshot: z.boolean().default(true),
  }),
});
