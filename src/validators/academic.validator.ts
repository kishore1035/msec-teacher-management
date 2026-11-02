import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const objectIdSchema = z.string().regex(objectIdRegex, 'Invalid ObjectId format');

// Academic Year
export const createAcademicYearSchema = z.object({
  body: z.object({
    year: z.string().min(4, 'Year name required (e.g. 2026-2027)'),
    startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Invalid date format')),
    endDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Invalid date format')),
    semesterType: z.enum(['ODD', 'EVEN']).default('ODD'),
    isCurrent: z.boolean().optional().default(false),
  }),
});

export const updateAcademicYearSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    year: z.string().min(4).optional(),
    startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
    endDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
    semesterType: z.enum(['ODD', 'EVEN']).optional(),
    status: z.enum(['Active', 'Archived']).optional(),
  }),
});

// Department
export const createDepartmentSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Department name required'),
    code: z.string().min(2, 'Department code required (e.g. CSE, ECE)'),
    description: z.string().optional(),
    hod: objectIdSchema.optional().nullable(),
  }),
});

export const updateDepartmentSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    name: z.string().min(2).optional(),
    code: z.string().min(2).optional(),
    description: z.string().optional(),
    hod: objectIdSchema.optional().nullable(),
    status: z.enum(['Active', 'Inactive']).optional(),
  }),
});

// Class
export const createClassSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Class name required'),
    code: z.string().min(2, 'Class code required'),
    department: objectIdSchema,
    degree: z.enum(['B.E.', 'M.Tech', 'MCA', 'Other']).default('B.E.'),
    durationYears: z.number().int().min(1).max(6).default(4),
  }),
});

export const updateClassSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    name: z.string().min(2).optional(),
    code: z.string().min(2).optional(),
    department: objectIdSchema.optional(),
    degree: z.enum(['B.E.', 'M.Tech', 'MCA', 'Other']).optional(),
    durationYears: z.number().int().min(1).max(6).optional(),
    status: z.enum(['Active', 'Inactive']).optional(),
  }),
});

// Section
export const createSectionSchema = z.object({
  body: z.object({
    class: objectIdSchema,
    academicYear: objectIdSchema,
    semester: z.number().int().min(1).max(10),
    sectionName: z.string().min(1, 'Section name required (e.g. A, B)'),
    classTeacher: objectIdSchema.optional().nullable(),
    roomNumber: z.string().optional(),
    capacity: z.number().int().min(1).default(60),
  }),
});

export const updateSectionSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    classTeacher: objectIdSchema.optional().nullable(),
    roomNumber: z.string().optional(),
    capacity: z.number().int().min(1).optional(),
    status: z.enum(['Active', 'Archived']).optional(),
  }),
});

// Subject
export const createSubjectSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Subject name required'),
    code: z.string().min(2, 'Subject code required (e.g. 21CS51)'),
    department: objectIdSchema,
    semester: z.number().int().min(1).max(10),
    credits: z.number().int().min(1).max(10),
    subjectType: z.enum(['Theory', 'Practical', 'Elective', 'Project']).default('Theory'),
    description: z.string().optional(),
    modules: z
      .array(
        z.object({
          moduleNumber: z.number().int().min(1),
          title: z.string().min(1),
          topics: z.array(z.string()).default([]),
          description: z.string().optional(),
        })
      )
      .optional()
      .default([]),
  }),
});

export const updateSubjectSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    name: z.string().min(2).optional(),
    code: z.string().min(2).optional(),
    department: objectIdSchema.optional(),
    semester: z.number().int().min(1).max(10).optional(),
    credits: z.number().int().min(1).max(10).optional(),
    subjectType: z.enum(['Theory', 'Practical', 'Elective', 'Project']).optional(),
    description: z.string().optional(),
    status: z.enum(['Active', 'Inactive']).optional(),
  }),
});

// Teacher Assignment
export const createTeacherAssignmentSchema = z.object({
  body: z.object({
    teacher: objectIdSchema,
    subject: objectIdSchema,
    section: objectIdSchema,
    academicYear: objectIdSchema,
    semester: z.number().int().min(1).max(10),
    isPrimary: z.boolean().optional().default(true),
  }),
});

export const updateTeacherAssignmentSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    isPrimary: z.boolean().optional(),
    status: z.enum(['Active', 'Inactive', 'Archived']).optional(),
  }),
});

export const idParamSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});
