import { z } from 'zod';

const objectIdString = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid MongoDB ObjectId');

const baseAIContextFields = {
  title: z.string().trim().min(3).max(200).optional(),
  subject: objectIdString,
  class: objectIdString.optional(),
  section: objectIdString.optional(),
  academicYear: objectIdString.optional(),
  semester: z.coerce.number().int().min(1).max(12).optional(),
  topic: z.string().trim().min(2).max(300),
  subtopics: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
  difficultyLevel: z.enum(['beginner', 'intermediate', 'advanced', 'mixed']).default('intermediate'),
  bloomTaxonomyLevels: z
    .array(z.enum(['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create']))
    .optional(),
  additionalInstructions: z.string().trim().max(3000).optional(),
  studyMaterialIds: z.array(objectIdString).max(10).optional(),
  assignmentIds: z.array(objectIdString).max(10).optional(),
  examinationIds: z.array(objectIdString).max(10).optional(),
};

export const generateLessonPlanSchema = z.object({
  body: z.object({
    ...baseAIContextFields,
    durationMinutes: z.coerce.number().int().min(15).max(300).default(60),
    numberOfSessions: z.coerce.number().int().min(1).max(20).default(1),
    teachingMethodology: z.string().trim().max(200).optional(),
    learningObjectives: z.array(z.string().trim().max(300)).max(15).optional(),
  }),
});

export const generateQuizSchema = z.object({
  body: z.object({
    ...baseAIContextFields,
    questionCount: z.coerce.number().int().min(1).max(50).default(10),
    questionTypes: z
      .array(z.enum(['mcq', 'true_false', 'short_answer', 'fill_in_blank', 'descriptive']))
      .default(['mcq', 'short_answer']),
    totalMarks: z.coerce.number().min(1).max(500).default(20),
    durationMinutes: z.coerce.number().int().min(5).max(180).default(30),
    includeAnswerKey: z.boolean().default(true),
  }),
});

export const generateQuestionPaperSchema = z.object({
  body: z.object({
    ...baseAIContextFields,
    examTitle: z.string().trim().min(3).max(200).optional(),
    examType: z
      .enum(['internal_1', 'internal_2', 'internal_3', 'mid_term', 'end_semester', 'model_exam'])
      .default('internal_1'),
    totalMarks: z.coerce.number().min(10).max(200).default(100),
    durationMinutes: z.coerce.number().int().min(30).max(300).default(180),
    sectionsConfig: z
      .array(
        z.object({
          sectionName: z.string().trim().min(1).max(100),
          questionCount: z.coerce.number().int().min(1).max(30),
          marksPerQuestion: z.coerce.number().min(1).max(50),
          questionType: z
            .enum(['mcq', 'short_answer', 'long_answer', 'case_study', 'problem_solving'])
            .default('short_answer'),
          optionalChoices: z.coerce.number().int().min(0).max(10).default(0),
        })
      )
      .optional(),
    includeMarkingScheme: z.boolean().default(true),
  }),
});

export const generateAssignmentSchema = z.object({
  body: z.object({
    ...baseAIContextFields,
    assignmentType: z
      .enum(['problem_set', 'coding_lab', 'case_study', 'research_essay', 'mini_project', 'mixed'])
      .default('problem_set'),
    questionCount: z.coerce.number().int().min(1).max(30).default(5),
    totalMarks: z.coerce.number().min(5).max(200).default(50),
    estimatedHours: z.coerce.number().min(0.5).max(100).default(4),
    includeEvaluationRubric: z.boolean().default(true),
  }),
});

export const generateTopicExplanationSchema = z.object({
  body: z.object({
    ...baseAIContextFields,
    targetAudienceLevel: z
      .enum(['first_year', 'undergraduate', 'advanced_undergraduate', 'remedial'])
      .default('undergraduate'),
    includeExamples: z.boolean().default(true),
    includeRealWorldApplications: z.boolean().default(true),
    includeCommonMisconceptions: z.boolean().default(true),
    includePracticeQuestions: z.boolean().default(true),
  }),
});

export const generateRubricSchema = z.object({
  body: z.object({
    ...baseAIContextFields,
    assessmentTitle: z.string().trim().min(2).max(200).optional(),
    totalMarks: z.coerce.number().min(5).max(500).default(100),
    criteriaList: z.array(z.string().trim().min(2).max(150)).max(15).optional(),
    performanceLevels: z
      .array(z.string().trim().min(2).max(100))
      .default(['Exemplary', 'Proficient', 'Developing', 'Needs Improvement']),
  }),
});

export const generateStudyMaterialSummarySchema = z.object({
  body: z.object({
    title: z.string().trim().min(3).max(200).optional(),
    subject: objectIdString.optional(),
    class: objectIdString.optional(),
    section: objectIdString.optional(),
    academicYear: objectIdString.optional(),
    semester: z.coerce.number().int().min(1).max(12).optional(),
    topic: z.string().trim().min(2).max(300).optional(),
    studyMaterialId: objectIdString.optional(),
    studyMaterialIds: z.array(objectIdString).max(10).optional(),
    rawTextExcerpt: z.string().trim().max(10000).optional(),
    summaryFormat: z
      .enum(['bullet_points', 'structured_notes', 'revision_cheat_sheet', 'executive_summary'])
      .default('structured_notes'),
    includeKeyFormulasAndTerms: z.boolean().default(true),
    includeRevisionQuestions: z.boolean().default(true),
  }),
});

export const generateTeachingMaterialSchema = z.object({
  body: z.object({
    ...baseAIContextFields,
    materialFormat: z
      .enum(['lecture_notes', 'slide_outline', 'lab_manual', 'worked_examples'])
      .default('lecture_notes'),
  }),
});

export const generateLearningOutcomesSchema = z.object({
  body: z.object({
    ...baseAIContextFields,
    outcomeCount: z.coerce.number().int().min(2).max(15).default(6),
    alignWithProgramOutcomes: z.boolean().default(true),
  }),
});

export const generateQuestionBankSchema = z.object({
  body: z.object({
    ...baseAIContextFields,
    questionCount: z.coerce.number().int().min(2).max(50).default(15),
    includeSolutions: z.boolean().default(true),
  }),
});

export const listAIContentSchema = z.object({
  query: z.object({
    contentType: z
      .enum([
        'lesson_plan',
        'topic_explanation',
        'quiz',
        'question_paper',
        'assignment',
        'teaching_material',
        'learning_outcomes',
        'rubric',
        'study_material_summary',
        'question_bank',
      ])
      .optional(),
    reviewStatus: z.enum(['draft', 'pending_review', 'approved', 'rejected']).optional(),
    subject: objectIdString.optional(),
    section: objectIdString.optional(),
    academicYear: objectIdString.optional(),
    createdBy: objectIdString.optional(),
    search: z.string().trim().max(200).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

export const updateAIContentSchema = z.object({
  params: z.object({
    id: objectIdString,
  }),
  body: z.object({
    title: z.string().trim().min(3).max(200).optional(),
    currentContent: z.record(z.string(), z.any()).or(z.string().min(1)).optional(),
    editNotes: z.string().trim().max(500).optional(),
    submitForReview: z.boolean().optional(),
  }),
});

export const approveAIContentSchema = z.object({
  params: z.object({
    id: objectIdString,
  }),
  body: z.object({
    comments: z.string().trim().max(1000).optional(),
    convertToResource: z
      .object({
        resourceType: z.enum(['StudyMaterial', 'Assignment']),
        visibility: z.enum(['class', 'subject', 'institution']).default('section' as any).optional(),
        dueDate: z.string().datetime().optional(),
        maxMarks: z.coerce.number().min(1).max(500).optional(),
        publishImmediately: z.boolean().default(false),
      })
      .optional(),
  }),
});

export const rejectAIContentSchema = z.object({
  params: z.object({
    id: objectIdString,
  }),
  body: z.object({
    comments: z.string().trim().min(3, 'Rejection comments must be at least 3 characters').max(1000),
  }),
});

export const aiContentIdParamSchema = z.object({
  params: z.object({
    id: objectIdString,
  }),
});

export const aiUsageQuerySchema = z.object({
  query: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    user: objectIdString.optional(),
    requestType: z.string().optional(),
    status: z.enum(['success', 'failure', 'rate_limited', 'blocked']).optional(),
  }),
});

export const upsertAIUsagePolicySchema = z.object({
  body: z.object({
    name: z.string().trim().min(3).max(150),
    scope: z.enum(['institution', 'role', 'user']).default('role'),
    targetRole: z
      .enum([
        'Super Admin',
        'Admin',
        'Teacher',
        'Student',
        'Parent',
        'super_admin',
        'admin',
        'teacher',
        'student',
        'parent',
      ])
      .optional(),
    targetUser: objectIdString.optional(),
    dailyRequestLimit: z.coerce.number().int().min(0).max(10000).default(50),
    monthlyRequestLimit: z.coerce.number().int().min(0).max(200000).default(1000),
    dailyTokenLimit: z.coerce.number().int().min(0).max(10000000).default(50000),
    monthlyTokenLimit: z.coerce.number().int().min(0).max(100000000).default(500000),
    maxInputChars: z.coerce.number().int().min(100).max(100000).default(12000),
    allowedContentTypes: z
      .array(
        z.enum([
          'lesson_plan',
          'topic_explanation',
          'quiz',
          'question_paper',
          'assignment',
          'teaching_material',
          'learning_outcomes',
          'rubric',
          'study_material_summary',
          'question_bank',
        ])
      )
      .optional(),
    requireReviewBeforePublish: z.boolean().default(true),
    isActive: z.boolean().default(true),
  }),
});

export const dashboardQuerySchema = z.object({
  query: z.object({
    academicYear: objectIdString.optional(),
    semester: z.coerce.number().int().min(1).max(12).optional(),
    department: objectIdString.optional(),
    section: objectIdString.optional(),
    studentId: objectIdString.optional(),
    refreshCache: z
      .string()
      .optional()
      .transform((val) => val === 'true'),
  }),
});

export const analyticsFilterQuerySchema = z.object({
  query: z.object({
    academicYear: objectIdString.optional(),
    semester: z.coerce.number().int().min(1).max(12).optional(),
    department: objectIdString.optional(),
    class: objectIdString.optional(),
    section: objectIdString.optional(),
    subject: objectIdString.optional(),
    student: objectIdString.optional(),
    teacher: objectIdString.optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }),
});

export const generateReportJobSchema = z.object({
  body: z.object({
    reportType: z.enum([
      'attendance',
      'assignments',
      'examinations',
      'student_progress',
      'teacher_workload',
      'leave_summary',
      'substitution_summary',
    ]),
    title: z.string().trim().min(3).max(200).optional(),
    exportFormat: z.enum(['pdf', 'excel', 'csv']).default('csv'),
    asyncMode: z.boolean().default(false),
    expiresInHours: z.coerce.number().min(0.001).max(720).optional(),
    filters: z
      .object({
        academicYear: objectIdString.optional(),
        semester: z.coerce.number().int().min(1).max(12).optional(),
        department: objectIdString.optional(),
        class: objectIdString.optional(),
        section: objectIdString.optional(),
        subject: objectIdString.optional(),
        student: objectIdString.optional(),
        teacher: objectIdString.optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
      .default({}),
  }),
});

export const listReportJobsSchema = z.object({
  query: z.object({
    reportType: z
      .enum([
        'attendance',
        'assignments',
        'examinations',
        'student_progress',
        'teacher_workload',
        'leave_summary',
        'substitution_summary',
      ])
      .optional(),
    exportFormat: z.enum(['pdf', 'excel', 'csv']).optional(),
    status: z.enum(['queued', 'processing', 'completed', 'failed', 'expired']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

export const reportJobIdParamSchema = z.object({
  params: z.object({
    id: objectIdString,
  }),
});
