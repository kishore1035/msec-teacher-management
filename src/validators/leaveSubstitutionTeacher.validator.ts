import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const objectIdSchema = z.string().regex(objectIdRegex, 'Invalid ObjectId format');
const dateStringSchema = z
  .string()
  .datetime()
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Invalid date format (expected YYYY-MM-DD or ISO8601)'));
const timeStringSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be in HH:MM format');

// ==========================================
// 1. TEACHER MANAGEMENT VALIDATORS
// ==========================================

export const createTeacherProfileSchema = z.object({
  body: z.object({
    user: objectIdSchema,
    employeeId: z.string().min(2, 'Employee ID is required').trim(),
    firstName: z.string().min(1, 'First name is required').trim(),
    lastName: z.string().min(1, 'Last name is required').trim(),
    department: objectIdSchema,
    designation: z.string().min(2, 'Designation is required').trim(),
    qualification: z.string().min(1, 'Qualification is required').trim(),
    qualifications: z.array(z.string().trim()).optional(),
    specialization: z.array(z.string().trim()).optional(),
    joiningDate: dateStringSchema.optional(),
    employmentCategory: z
      .enum(['regular', 'contract', 'visiting', 'adjunct', 'probationary'])
      .optional(),
    phone: z.string().min(5, 'Phone number is required').trim(),
    alternatePhone: z.string().trim().optional(),
    address: z.string().trim().optional(),
    emergencyContact: z.string().trim().optional(),
    officeRoom: z.string().trim().optional(),
    bio: z.string().trim().optional(),
    profilePhotoUrl: z.string().trim().optional(),
    maxWeeklyHours: z.number().min(1).max(60).optional(),
    isActive: z.boolean().optional(),
    status: z
      .enum(['Active', 'On Leave', 'Resigned', 'Retired', 'Inactive'])
      .optional(),
  }),
});

export const updateTeacherProfileSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    employeeId: z.string().min(2).trim().optional(),
    firstName: z.string().min(1).trim().optional(),
    lastName: z.string().min(1).trim().optional(),
    department: objectIdSchema.optional(),
    designation: z.string().min(2).trim().optional(),
    qualification: z.string().min(1).trim().optional(),
    qualifications: z.array(z.string().trim()).optional(),
    specialization: z.array(z.string().trim()).optional(),
    joiningDate: dateStringSchema.optional(),
    employmentCategory: z
      .enum(['regular', 'contract', 'visiting', 'adjunct', 'probationary'])
      .optional(),
    phone: z.string().min(5).trim().optional(),
    alternatePhone: z.string().trim().optional(),
    address: z.string().trim().optional(),
    emergencyContact: z.string().trim().optional(),
    officeRoom: z.string().trim().optional(),
    bio: z.string().trim().optional(),
    profilePhotoUrl: z.string().trim().optional(),
    maxWeeklyHours: z.number().min(1).max(60).optional(),
    isActive: z.boolean().optional(),
    status: z
      .enum(['Active', 'On Leave', 'Resigned', 'Retired', 'Inactive'])
      .optional(),
  }),
});

export const listTeachersQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    search: z.string().trim().optional(),
    department: objectIdSchema.optional(),
    designation: z.string().trim().optional(),
    specialization: z.string().trim().optional(),
    employmentCategory: z
      .enum(['regular', 'contract', 'visiting', 'adjunct', 'probationary'])
      .optional(),
    status: z
      .enum(['Active', 'On Leave', 'Resigned', 'Retired', 'Inactive'])
      .optional(),
    isActive: z
      .enum(['true', 'false'])
      .transform((val) => val === 'true')
      .optional(),
  }),
});

export const teacherIdParamSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

export const teacherSubResourceQuerySchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  query: z.object({
    academicYear: objectIdSchema.optional(),
    semester: z.coerce.number().int().min(1).max(10).optional(),
    date: dateStringSchema.optional(),
    startDate: dateStringSchema.optional(),
    endDate: dateStringSchema.optional(),
    status: z.string().trim().optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
});

// ==========================================
// 2. LEAVE POLICY & REQUEST VALIDATORS
// ==========================================

const leaveTypeConfigZodSchema = z.object({
  leaveType: z.string().min(1, 'Leave type code is required').trim().toLowerCase(),
  displayName: z.string().min(1, 'Display name is required').trim(),
  description: z.string().trim().optional(),
  annualQuota: z.number().min(0).optional(),
  allowCarryForward: z.boolean().optional().default(false),
  maxCarryForwardDays: z.number().min(0).optional(),
  allowHalfDay: z.boolean().optional().default(true),
  allowPartialDay: z.boolean().optional().default(true),
  requiresAttachment: z.boolean().optional().default(false),
  requiresAttachmentAfterDays: z.number().min(1).optional(),
  minNoticeDays: z.number().min(0).optional().default(0),
  maxConsecutiveDays: z.number().min(1).optional(),
  isPaid: z.boolean().optional().default(true),
  applicableCategories: z.array(z.string().trim()).optional(),
});

export const createLeavePolicySchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Policy name is required').trim(),
    description: z.string().trim().optional(),
    academicYear: objectIdSchema.optional(),
    leaveTypes: z
      .array(leaveTypeConfigZodSchema)
      .min(1, 'At least one leave type configuration is required'),
    approvalWorkflow: z
      .object({
        requiresApproval: z.boolean().optional().default(true),
        approverRoles: z.array(z.string()).optional(),
        preventSelfApproval: z.boolean().optional().default(true),
        autoApproveTypes: z.array(z.string()).optional(),
      })
      .optional(),
    cancellationRules: z
      .object({
        allowPendingCancellation: z.boolean().optional().default(true),
        allowApprovedCancellationBeforeStart: z.boolean().optional().default(true),
        allowAdminCancelAnytime: z.boolean().optional().default(true),
      })
      .optional(),
    applicableEmploymentCategories: z.array(z.string().trim()).optional(),
    effectiveFrom: dateStringSchema,
    effectiveTo: dateStringSchema.optional(),
    isActive: z.boolean().optional().default(true),
  }),
});

export const updateLeavePolicySchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    name: z.string().min(2).trim().optional(),
    description: z.string().trim().optional(),
    academicYear: objectIdSchema.optional(),
    leaveTypes: z.array(leaveTypeConfigZodSchema).min(1).optional(),
    approvalWorkflow: z
      .object({
        requiresApproval: z.boolean().optional(),
        approverRoles: z.array(z.string()).optional(),
        preventSelfApproval: z.boolean().optional(),
        autoApproveTypes: z.array(z.string()).optional(),
      })
      .optional(),
    cancellationRules: z
      .object({
        allowPendingCancellation: z.boolean().optional(),
        allowApprovedCancellationBeforeStart: z.boolean().optional(),
        allowAdminCancelAnytime: z.boolean().optional(),
      })
      .optional(),
    applicableEmploymentCategories: z.array(z.string().trim()).optional(),
    effectiveFrom: dateStringSchema.optional(),
    effectiveTo: dateStringSchema.optional(),
    isActive: z.boolean().optional(),
  }),
});

export const createLeaveRequestSchema = z.object({
  body: z.object({
    teacher: objectIdSchema.optional(),
    leavePolicy: objectIdSchema.optional(),
    academicYear: objectIdSchema.optional(),
    leaveType: z.string().min(1, 'Leave type is required').trim().toLowerCase(),
    startDate: dateStringSchema,
    endDate: dateStringSchema,
    isPartialDay: z.boolean().optional().default(false),
    dayPart: z
      .enum(['full_day', 'first_half', 'second_half', 'custom_hours'])
      .optional()
      .default('full_day'),
    startTime: timeStringSchema.optional(),
    endTime: timeStringSchema.optional(),
    startPeriod: z.number().int().min(1).max(12).optional(),
    endPeriod: z.number().int().min(1).max(12).optional(),
    totalDays: z.number().min(0.25).optional(),
    reason: z.string().min(3, 'Reason must be at least 3 characters').trim(),
    attachments: z
      .array(
        z.object({
          fileName: z.string().min(1).trim(),
          fileUrl: z.string().min(1).trim(),
          fileType: z.string().trim().optional(),
          fileSize: z.number().optional(),
        })
      )
      .optional(),
  }),
});

export const listLeaveRequestsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    teacher: objectIdSchema.optional(),
    department: objectIdSchema.optional(),
    leaveType: z.string().trim().toLowerCase().optional(),
    status: z.enum(['pending', 'approved', 'rejected', 'cancelled']).optional(),
    startDate: dateStringSchema.optional(),
    endDate: dateStringSchema.optional(),
    academicYear: objectIdSchema.optional(),
  }),
});

export const reviewLeaveRequestSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    reviewComments: z.string().trim().optional(),
    comments: z.string().trim().optional(),
    reason: z.string().trim().optional(),
  }),
});

export const cancelLeaveRequestSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    cancellationReason: z.string().trim().optional(),
    reason: z.string().trim().optional(),
  }),
});

export const leaveBalanceQuerySchema = z.object({
  query: z.object({
    teacher: objectIdSchema.optional(),
    academicYear: objectIdSchema.optional(),
    leavePolicy: objectIdSchema.optional(),
  }),
});

// ==========================================
// 3. SUBSTITUTION VALIDATORS
// ==========================================

export const createSubstitutionSchema = z.object({
  body: z.object({
    timetableEntry: objectIdSchema,
    timetable: objectIdSchema.optional(),
    leaveRequest: objectIdSchema.optional(),
    absentTeacher: objectIdSchema.optional(),
    substituteTeacher: objectIdSchema,
    date: dateStringSchema,
    periodNumber: z.number().int().min(1).max(12).optional(),
    startTime: timeStringSchema.optional(),
    endTime: timeStringSchema.optional(),
    subject: objectIdSchema.optional(),
    section: objectIdSchema.optional(),
    classroom: z.string().trim().optional(),
    reason: z.string().min(3, 'Substitution reason is required').trim(),
    autoApprove: z.boolean().optional(),
    notifyParents: z.boolean().optional().default(false),
  }),
});

export const listSubstitutionsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    absentTeacher: objectIdSchema.optional(),
    substituteTeacher: objectIdSchema.optional(),
    teacher: objectIdSchema.optional(),
    section: objectIdSchema.optional(),
    subject: objectIdSchema.optional(),
    department: objectIdSchema.optional(),
    leaveRequest: objectIdSchema.optional(),
    status: z
      .enum(['proposed', 'approved', 'rejected', 'completed', 'cancelled'])
      .optional(),
    date: dateStringSchema.optional(),
    startDate: dateStringSchema.optional(),
    endDate: dateStringSchema.optional(),
  }),
});

export const availableTeachersQuerySchema = z.object({
  query: z.object({
    timetableEntry: objectIdSchema.optional(),
    date: dateStringSchema,
    periodNumber: z.coerce.number().int().min(1).max(12).optional(),
    startTime: timeStringSchema.optional(),
    endTime: timeStringSchema.optional(),
    subject: objectIdSchema.optional(),
    department: objectIdSchema.optional(),
    section: objectIdSchema.optional(),
  }),
});

export const substitutionConflictsQuerySchema = z.object({
  query: z.object({
    substituteTeacher: objectIdSchema,
    timetableEntry: objectIdSchema.optional(),
    date: dateStringSchema,
    periodNumber: z.coerce.number().int().min(1).max(12).optional(),
    startTime: timeStringSchema.optional(),
    endTime: timeStringSchema.optional(),
    classroom: z.string().trim().optional(),
    section: objectIdSchema.optional(),
  }),
});

export const approveSubstitutionSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    approvalComments: z.string().trim().optional(),
    comments: z.string().trim().optional(),
  }),
});

export const rejectSubstitutionSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    rejectionReason: z.string().trim().optional(),
    reason: z.string().trim().optional(),
    comments: z.string().trim().optional(),
  }),
});

export const completeSubstitutionSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    topicsCovered: z.string().trim().optional(),
    remarks: z.string().trim().optional(),
    attendanceRecorded: z.boolean().optional(),
  }),
});

export const cancelSubstitutionSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    cancellationReason: z.string().trim().optional(),
    reason: z.string().trim().optional(),
  }),
});

// ==========================================
// 4. WORKLOAD & ANALYTICS VALIDATORS
// ==========================================

export const workloadAnalyticsQuerySchema = z.object({
  query: z.object({
    academicYear: objectIdSchema.optional(),
    semester: z.coerce.number().int().min(1).max(10).optional(),
    department: objectIdSchema.optional(),
    teacher: objectIdSchema.optional(),
    startDate: dateStringSchema.optional(),
    endDate: dateStringSchema.optional(),
  }),
});
