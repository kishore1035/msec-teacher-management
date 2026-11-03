import { Types } from 'mongoose';
import {
  TeacherLeave,
  ITeacherLeave,
  IAffectedTimetableSlot,
  LeavePolicy,
  ILeavePolicy,
  Teacher,
  User,
  AcademicYear,
  Timetable,
  TimetableEntry,
  TimetableChange,
  Substitution,
  DayOfWeek,
} from '../models';
import { ApiError } from '../utils/apiError';
import { calculatePagination } from '../utils/pagination';
import { ROLES } from '../constants/roles.constant';
import { NotificationService } from './notification.service';
import { timeSlotsOverlap } from './timetableConflict.service';
import { IActorUser } from './teacherManagement.service';

const DAY_NAMES: DayOfWeek[] = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const extractId = (ref: unknown): string => {
  if (!ref) return '';
  if (typeof ref === 'object' && ref !== null && '_id' in ref) {
    return String((ref as { _id: unknown })._id);
  }
  return String(ref);
};

export class LeaveService {
  // ==========================================
  // LEAVE POLICIES
  // ==========================================

  static async createPolicy(
    input: {
      name: string;
      description?: string;
      academicYear?: string;
      leaveTypes: ILeavePolicy['leaveTypes'];
      approvalWorkflow?: Partial<ILeavePolicy['approvalWorkflow']>;
      cancellationRules?: Partial<ILeavePolicy['cancellationRules']>;
      applicableEmploymentCategories?: string[];
      effectiveFrom: string | Date;
      effectiveTo?: string | Date;
      isActive?: boolean;
    },
    userId: string
  ): Promise<ILeavePolicy> {
    const existing = await LeavePolicy.findOne({ name: input.name.trim() });
    if (existing) {
      throw ApiError.conflict(`Leave policy with name '${input.name}' already exists`);
    }

    if (input.academicYear) {
      const ay = await AcademicYear.findById(input.academicYear);
      if (!ay) throw ApiError.notFound('Academic year not found');
    }

    const effectiveFrom = new Date(input.effectiveFrom);
    const effectiveTo = input.effectiveTo ? new Date(input.effectiveTo) : undefined;
    if (effectiveTo && effectiveTo < effectiveFrom) {
      throw ApiError.badRequest('effectiveTo cannot be earlier than effectiveFrom');
    }

    return await LeavePolicy.create({
      name: input.name.trim(),
      description: input.description,
      academicYear: input.academicYear ? new Types.ObjectId(input.academicYear) : undefined,
      leaveTypes: input.leaveTypes,
      approvalWorkflow: {
        requiresApproval: input.approvalWorkflow?.requiresApproval ?? true,
        approverRoles: input.approvalWorkflow?.approverRoles || [ROLES.SUPER_ADMIN, ROLES.ADMIN],
        preventSelfApproval: input.approvalWorkflow?.preventSelfApproval ?? true,
        autoApproveTypes: input.approvalWorkflow?.autoApproveTypes || [],
      },
      cancellationRules: {
        allowPendingCancellation: input.cancellationRules?.allowPendingCancellation ?? true,
        allowApprovedCancellationBeforeStart:
          input.cancellationRules?.allowApprovedCancellationBeforeStart ?? true,
        allowAdminCancelAnytime: input.cancellationRules?.allowAdminCancelAnytime ?? true,
      },
      applicableEmploymentCategories: input.applicableEmploymentCategories || [
        'regular',
        'contract',
        'visiting',
        'adjunct',
        'probationary',
      ],
      effectiveFrom,
      effectiveTo,
      isActive: input.isActive ?? true,
      createdBy: new Types.ObjectId(userId),
      updatedBy: new Types.ObjectId(userId),
    });
  }

  static async updatePolicy(
    policyId: string,
    updates: Partial<{
      name: string;
      description: string;
      academicYear: string;
      leaveTypes: ILeavePolicy['leaveTypes'];
      approvalWorkflow: Partial<ILeavePolicy['approvalWorkflow']>;
      cancellationRules: Partial<ILeavePolicy['cancellationRules']>;
      applicableEmploymentCategories: string[];
      effectiveFrom: string | Date;
      effectiveTo: string | Date;
      isActive: boolean;
    }>,
    userId: string
  ): Promise<ILeavePolicy> {
    const policy = await LeavePolicy.findById(policyId);
    if (!policy) {
      throw ApiError.notFound('Leave policy not found');
    }

    if (updates.name && updates.name.trim() !== policy.name) {
      const duplicate = await LeavePolicy.findOne({
        _id: { $ne: policy._id },
        name: updates.name.trim(),
      });
      if (duplicate) {
        throw ApiError.conflict(`Leave policy with name '${updates.name}' already exists`);
      }
      policy.name = updates.name.trim();
    }

    if (updates.description !== undefined) policy.description = updates.description;
    if (updates.academicYear !== undefined) {
      policy.academicYear = updates.academicYear
        ? new Types.ObjectId(updates.academicYear)
        : undefined;
    }
    if (updates.leaveTypes !== undefined) policy.leaveTypes = updates.leaveTypes;
    if (updates.approvalWorkflow !== undefined) {
      policy.approvalWorkflow = {
        ...policy.approvalWorkflow,
        ...updates.approvalWorkflow,
      };
    }
    if (updates.cancellationRules !== undefined) {
      policy.cancellationRules = {
        ...policy.cancellationRules,
        ...updates.cancellationRules,
      };
    }
    if (updates.applicableEmploymentCategories !== undefined) {
      policy.applicableEmploymentCategories = updates.applicableEmploymentCategories;
    }
    if (updates.effectiveFrom !== undefined) {
      policy.effectiveFrom = new Date(updates.effectiveFrom);
    }
    if (updates.effectiveTo !== undefined) {
      policy.effectiveTo = new Date(updates.effectiveTo);
    }
    if (updates.isActive !== undefined) {
      policy.isActive = updates.isActive;
    }

    policy.updatedBy = new Types.ObjectId(userId);
    return await policy.save();
  }

  static async listPolicies(query: { isActive?: boolean; academicYear?: string } = {}) {
    const filter: Record<string, unknown> = {};
    if (query.isActive !== undefined) filter.isActive = query.isActive;
    if (query.academicYear) filter.academicYear = query.academicYear;

    return await LeavePolicy.find(filter)
      .populate('academicYear', 'year isCurrent')
      .populate('createdBy', 'name email')
      .sort({ isActive: -1, effectiveFrom: -1 });
  }

  static async getActivePolicyForRequest(options: {
    policyId?: string;
    academicYear?: string;
    date?: Date;
  }): Promise<ILeavePolicy | null> {
    if (options.policyId) {
      const explicit = await LeavePolicy.findById(options.policyId);
      if (!explicit || !explicit.isActive) {
        throw ApiError.badRequest('Specified leave policy does not exist or is inactive');
      }
      return explicit;
    }

    const filter: Record<string, unknown> = { isActive: true };
    if (options.academicYear) {
      filter.$or = [{ academicYear: options.academicYear }, { academicYear: { $exists: false } }];
    }

    const policies = await LeavePolicy.find(filter).sort({ effectiveFrom: -1, createdAt: -1 });
    if (policies.length === 0) return null;

    if (options.date) {
      const targetTime = options.date.getTime();
      const matching = policies.find((p) => {
        const fromOk = new Date(p.effectiveFrom).getTime() <= targetTime;
        const toOk = !p.effectiveTo || new Date(p.effectiveTo).getTime() >= targetTime;
        return fromOk && toOk;
      });
      if (matching) return matching;
    }

    return policies[0] || null;
  }

  // ==========================================
  // HELPER: CALCULATE DAYS & AFFECTED ENTRIES
  // ==========================================

  static calculateTotalDays(
    startDate: Date,
    endDate: Date,
    isPartialDay: boolean,
    dayPart: string
  ): number {
    const startUtc = Date.UTC(
      startDate.getUTCFullYear(),
      startDate.getUTCMonth(),
      startDate.getUTCDate()
    );
    const endUtc = Date.UTC(
      endDate.getUTCFullYear(),
      endDate.getUTCMonth(),
      endDate.getUTCDate()
    );

    const calendarDays = Math.floor((endUtc - startUtc) / (1000 * 60 * 60 * 24)) + 1;
    if (calendarDays <= 0) {
      throw ApiError.badRequest('Leave end date cannot be earlier than start date');
    }

    if (isPartialDay || dayPart !== 'full_day') {
      if (calendarDays > 1) {
        throw ApiError.badRequest('Partial-day or half-day leave must be within a single date');
      }
      return 0.5;
    }

    return calendarDays;
  }

  /**
   * Automatically identify affected timetable entries for a teacher during a leave period
   */
  static async resolveAffectedTimetableEntries(params: {
    teacherId: Types.ObjectId | string;
    startDate: Date;
    endDate: Date;
    isPartialDay: boolean;
    dayPart: string;
    startTime?: string;
    endTime?: string;
    startPeriod?: number;
    endPeriod?: number;
  }): Promise<IAffectedTimetableSlot[]> {
    const teacherObjId = new Types.ObjectId(params.teacherId.toString());

    const activeTimetables = await Timetable.find({
      status: 'published',
      effectiveFrom: { $lte: params.endDate },
      effectiveTo: { $gte: params.startDate },
    }).select('_id effectiveFrom effectiveTo');

    if (activeTimetables.length === 0) return [];

    const timetableIds = activeTimetables.map((t) => t._id);

    const teacherEntries = await TimetableEntry.find({
      timetable: { $in: timetableIds },
      $or: [{ teacher: teacherObjId }, { additionalTeachers: teacherObjId }],
      status: 'active',
      isBreak: false,
    }).sort({ periodNumber: 1 });

    if (teacherEntries.length === 0) return [];

    const affectedSlots: IAffectedTimetableSlot[] = [];

    const current = new Date(
      Date.UTC(
        params.startDate.getUTCFullYear(),
        params.startDate.getUTCMonth(),
        params.startDate.getUTCDate()
      )
    );
    const last = new Date(
      Date.UTC(
        params.endDate.getUTCFullYear(),
        params.endDate.getUTCMonth(),
        params.endDate.getUTCDate()
      )
    );

    while (current <= last) {
      const dayOfWeek = DAY_NAMES[current.getUTCDay()];
      const dayEntries = teacherEntries.filter((e) => e.dayOfWeek === dayOfWeek);

      for (const entry of dayEntries) {
        if (params.isPartialDay || params.dayPart !== 'full_day') {
          if (params.startTime && params.endTime) {
            if (!timeSlotsOverlap(params.startTime, params.endTime, entry.startTime, entry.endTime)) {
              continue;
            }
          } else if (params.startPeriod !== undefined && params.endPeriod !== undefined) {
            if (entry.periodNumber < params.startPeriod || entry.periodNumber > params.endPeriod) {
              continue;
            }
          } else if (params.dayPart === 'first_half') {
            if (entry.periodNumber > 4) continue;
          } else if (params.dayPart === 'second_half') {
            if (entry.periodNumber <= 4) continue;
          }
        }

        affectedSlots.push({
          timetableEntry: entry._id,
          timetable: entry.timetable,
          date: new Date(current),
          dayOfWeek: entry.dayOfWeek,
          periodNumber: entry.periodNumber,
          startTime: entry.startTime,
          endTime: entry.endTime,
          subject: entry.subject,
          section: entry.section,
          classroom: entry.classroom,
        });
      }

      current.setUTCDate(current.getUTCDate() + 1);
    }

    return affectedSlots;
  }

  // ==========================================
  // LEAVE BALANCES
  // ==========================================

  static async getLeaveBalances(
    query: { teacher?: string; academicYear?: string; leavePolicy?: string },
    actor: IActorUser
  ) {
    let teacherRecord = null;
    if (actor.role === ROLES.TEACHER) {
      const ownTeacher = await Teacher.findOne({ user: actor.id });
      if (!ownTeacher) {
        throw ApiError.notFound('Teacher profile not found for current user');
      }
      if (query.teacher && query.teacher !== ownTeacher._id.toString()) {
        throw ApiError.forbidden('Teachers can only view their own leave balances');
      }
      teacherRecord = ownTeacher;
    } else if (query.teacher) {
      teacherRecord = await Teacher.findById(query.teacher);
      if (!teacherRecord) {
        throw ApiError.notFound('Teacher profile not found');
      }
    } else {
      const ownTeacher = await Teacher.findOne({ user: actor.id });
      if (ownTeacher) {
        teacherRecord = ownTeacher;
      } else {
        throw ApiError.badRequest('Please specify a teacher ID to view leave balances');
      }
    }

    const policy = await this.getActivePolicyForRequest({
      policyId: query.leavePolicy,
      academicYear: query.academicYear,
    });

    const leaveFilter: Record<string, unknown> = {
      teacher: teacherRecord._id,
      status: { $in: ['approved', 'pending'] },
    };
    if (query.academicYear) {
      leaveFilter.academicYear = query.academicYear;
    } else if (policy?.effectiveFrom) {
      leaveFilter.startDate = { $gte: policy.effectiveFrom };
    }

    const existingLeaves = await TeacherLeave.find(leaveFilter);

    const usageByType: Record<
      string,
      { approvedDays: number; pendingDays: number; totalRequests: number }
    > = {};

    for (const leave of existingLeaves) {
      const lt = (leave.leaveType || 'casual').toLowerCase();
      if (!usageByType[lt]) {
        usageByType[lt] = { approvedDays: 0, pendingDays: 0, totalRequests: 0 };
      }
      const days = leave.totalDays || 1;
      if (leave.status === 'approved') {
        usageByType[lt].approvedDays += days;
      } else if (leave.status === 'pending') {
        usageByType[lt].pendingDays += days;
      }
      usageByType[lt].totalRequests += 1;
    }

    const balances: Array<{
      leaveType: string;
      displayName: string;
      annualQuota: number | null;
      approvedDays: number;
      pendingDays: number;
      remainingDays: number | null;
      isPaid: boolean;
      allowHalfDay: boolean;
    }> = [];

    if (policy && policy.leaveTypes.length > 0) {
      for (const rule of policy.leaveTypes) {
        const usage = usageByType[rule.leaveType] || {
          approvedDays: 0,
          pendingDays: 0,
          totalRequests: 0,
        };
        const quota = rule.annualQuota !== undefined ? rule.annualQuota : null;
        const remaining =
          quota !== null ? Math.max(0, quota - (usage.approvedDays + usage.pendingDays)) : null;

        balances.push({
          leaveType: rule.leaveType,
          displayName: rule.displayName,
          annualQuota: quota,
          approvedDays: usage.approvedDays,
          pendingDays: usage.pendingDays,
          remainingDays: remaining,
          isPaid: rule.isPaid,
          allowHalfDay: rule.allowHalfDay,
        });
      }
    } else {
      for (const [lt, usage] of Object.entries(usageByType)) {
        balances.push({
          leaveType: lt,
          displayName: lt.charAt(0).toUpperCase() + lt.slice(1),
          annualQuota: null,
          approvedDays: usage.approvedDays,
          pendingDays: usage.pendingDays,
          remainingDays: null,
          isPaid: true,
          allowHalfDay: true,
        });
      }
    }

    return {
      teacher: {
        _id: teacherRecord._id,
        employeeId: teacherRecord.employeeId,
        firstName: teacherRecord.firstName,
        lastName: teacherRecord.lastName,
        employmentCategory: teacherRecord.employmentCategory || 'regular',
      },
      policy: policy
        ? {
            _id: policy._id,
            name: policy.name,
            effectiveFrom: policy.effectiveFrom,
            effectiveTo: policy.effectiveTo,
          }
        : null,
      balances,
    };
  }

  // ==========================================
  // SUBMIT & MANAGE LEAVE REQUESTS
  // ==========================================

  static async submitLeaveRequest(
    input: {
      teacher?: string;
      leavePolicy?: string;
      academicYear?: string;
      leaveType: string;
      startDate: string | Date;
      endDate: string | Date;
      isPartialDay?: boolean;
      dayPart?: 'full_day' | 'first_half' | 'second_half' | 'custom_hours';
      startTime?: string;
      endTime?: string;
      startPeriod?: number;
      endPeriod?: number;
      totalDays?: number;
      reason: string;
      attachments?: Array<{
        fileName: string;
        fileUrl: string;
        fileType?: string;
        fileSize?: number;
      }>;
    },
    actor: IActorUser
  ): Promise<ITeacherLeave> {
    // 1. Resolve Teacher & verify RBAC
    let teacherRecord = null;
    const isAdmin = actor.role === ROLES.SUPER_ADMIN || actor.role === ROLES.ADMIN;

    if (!isAdmin) {
      teacherRecord = await Teacher.findOne({ user: actor.id });
      if (!teacherRecord) {
        throw ApiError.notFound('Teacher profile not found for current user');
      }
      if (input.teacher && input.teacher !== teacherRecord._id.toString()) {
        throw ApiError.forbidden('Teachers can only submit leave requests for themselves');
      }
    } else if (input.teacher) {
      teacherRecord = await Teacher.findById(input.teacher);
      if (!teacherRecord) {
        throw ApiError.notFound('Teacher profile not found');
      }
    } else {
      teacherRecord = await Teacher.findOne({ user: actor.id });
      if (!teacherRecord) {
        throw ApiError.badRequest('Teacher reference is required');
      }
    }

    if (
      teacherRecord.isActive === false ||
      teacherRecord.status === 'Inactive' ||
      teacherRecord.status === 'Resigned' ||
      teacherRecord.status === 'Retired'
    ) {
      throw ApiError.badRequest(
        `Cannot submit leave request for inactive teacher profile (${teacherRecord.status})`
      );
    }

    const startDate = new Date(input.startDate);
    const endDate = new Date(input.endDate);
    const dayPart = input.dayPart || (input.isPartialDay ? 'first_half' : 'full_day');
    const isPartialDay = Boolean(input.isPartialDay || dayPart !== 'full_day');

    const calculatedDays = this.calculateTotalDays(startDate, endDate, isPartialDay, dayPart);
    const totalDays = input.totalDays ?? calculatedDays;

    const normalizedLeaveType = input.leaveType.trim().toLowerCase();

    // 2. Validate against active LeavePolicy (if configured)
    const policy = await this.getActivePolicyForRequest({
      policyId: input.leavePolicy,
      academicYear: input.academicYear,
      date: startDate,
    });

    let initialStatus: 'pending' | 'approved' = 'pending';

    if (policy) {
      const empCategory = teacherRecord.employmentCategory || 'regular';
      if (
        policy.applicableEmploymentCategories.length > 0 &&
        !policy.applicableEmploymentCategories.includes(empCategory)
      ) {
        throw ApiError.badRequest(
          `Employment category '${empCategory}' is not covered by leave policy '${policy.name}'`
        );
      }

      const typeRule = policy.leaveTypes.find((t) => t.leaveType === normalizedLeaveType);
      if (!typeRule) {
        throw ApiError.badRequest(
          `Leave type '${normalizedLeaveType}' is not permitted under active policy '${policy.name}'`
        );
      }

      if (
        typeRule.applicableCategories &&
        typeRule.applicableCategories.length > 0 &&
        !typeRule.applicableCategories.includes(empCategory)
      ) {
        throw ApiError.badRequest(
          `Leave type '${normalizedLeaveType}' is not applicable to '${empCategory}' faculty`
        );
      }

      if (isPartialDay && !typeRule.allowHalfDay && !typeRule.allowPartialDay) {
        throw ApiError.badRequest(
          `Partial-day or half-day leave is not allowed for leave type '${normalizedLeaveType}'`
        );
      }

      if (typeRule.maxConsecutiveDays && totalDays > typeRule.maxConsecutiveDays) {
        throw ApiError.badRequest(
          `Requested leave duration (${totalDays} days) exceeds maximum consecutive limit (${typeRule.maxConsecutiveDays} days) for '${normalizedLeaveType}'`
        );
      }

      const hasAttachments = Boolean(input.attachments && input.attachments.length > 0);
      if (typeRule.requiresAttachment && !hasAttachments) {
        throw ApiError.badRequest(
          `Supporting attachment is required for '${normalizedLeaveType}' leave`
        );
      }
      if (
        typeRule.requiresAttachmentAfterDays &&
        totalDays > typeRule.requiresAttachmentAfterDays &&
        !hasAttachments
      ) {
        throw ApiError.badRequest(
          `Supporting attachment is required for '${normalizedLeaveType}' leave exceeding ${typeRule.requiresAttachmentAfterDays} days`
        );
      }

      // Check dynamic quota / balance if annualQuota is defined
      if (typeRule.annualQuota !== undefined && typeRule.annualQuota !== null) {
        const balanceResult = await this.getLeaveBalances(
          {
            teacher: teacherRecord._id.toString(),
            academicYear: input.academicYear,
            leavePolicy: policy._id.toString(),
          },
          { id: actor.id, role: ROLES.SUPER_ADMIN }
        );
        const typeBalance = balanceResult.balances.find(
          (b) => b.leaveType === normalizedLeaveType
        );
        if (
          typeBalance &&
          typeBalance.remainingDays !== null &&
          totalDays > typeBalance.remainingDays
        ) {
          throw ApiError.badRequest(
            `Insufficient '${normalizedLeaveType}' leave balance. Requested: ${totalDays} days, Available: ${typeBalance.remainingDays} days`
          );
        }
      }

      if (
        !policy.approvalWorkflow.requiresApproval ||
        policy.approvalWorkflow.autoApproveTypes.includes(normalizedLeaveType)
      ) {
        initialStatus = 'approved';
      }
    }

    // 3. Detect overlapping pending or approved leave requests for the same teacher
    const overlappingLeaves = await TeacherLeave.find({
      teacher: teacherRecord._id,
      status: { $in: ['pending', 'approved'] },
      startDate: { $lte: endDate },
      endDate: { $gte: startDate },
    });

    for (const existing of overlappingLeaves) {
      // Allow two non-overlapping partial-day leaves on the same date (e.g., first_half and second_half)
      if (isPartialDay && existing.isPartialDay) {
        if (
          (dayPart === 'first_half' && existing.dayPart === 'second_half') ||
          (dayPart === 'second_half' && existing.dayPart === 'first_half')
        ) {
          continue;
        }
        if (
          input.startTime &&
          input.endTime &&
          existing.startTime &&
          existing.endTime &&
          !timeSlotsOverlap(input.startTime, input.endTime, existing.startTime, existing.endTime)
        ) {
          continue;
        }
      }

      throw ApiError.conflict(
        `Overlapping ${existing.status} leave request (${existing.leaveType}) already exists from ${existing.startDate.toISOString().split('T')[0]} to ${existing.endDate.toISOString().split('T')[0]}`
      );
    }

    // 4. Resolve affected timetable entries
    const affectedTimetableEntries = await this.resolveAffectedTimetableEntries({
      teacherId: teacherRecord._id,
      startDate,
      endDate,
      isPartialDay,
      dayPart,
      startTime: input.startTime,
      endTime: input.endTime,
      startPeriod: input.startPeriod,
      endPeriod: input.endPeriod,
    });

    // 5. Create LeaveRequest
    const leaveRequest = await TeacherLeave.create({
      teacher: teacherRecord._id,
      leavePolicy: policy?._id,
      academicYear: input.academicYear ? new Types.ObjectId(input.academicYear) : policy?.academicYear,
      leaveType: normalizedLeaveType,
      startDate,
      endDate,
      isPartialDay,
      dayPart,
      startTime: input.startTime,
      endTime: input.endTime,
      startPeriod: input.startPeriod,
      endPeriod: input.endPeriod,
      totalDays,
      reason: input.reason.trim(),
      attachments: input.attachments || [],
      status: initialStatus,
      appliedDate: new Date(),
      affectedTimetableEntries,
      approvalHistory: [
        {
          action: 'submitted',
          actor: new Types.ObjectId(actor.id),
          actorRole: actor.role,
          comments: input.reason.trim(),
          timestamp: new Date(),
        },
      ],
    });

    // 6. Trigger Phase 9 Notifications to Administrators & Teacher
    const admins = await User.find({
      role: { $in: [ROLES.SUPER_ADMIN, ROLES.ADMIN] },
      isActive: true,
    }).select('_id');

    const dateRangeText = `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`;

    await Promise.all(
      admins.map((admin) =>
        NotificationService.createEventNotification({
          recipient: admin._id,
          title: `New Leave Request: ${teacherRecord.firstName} ${teacherRecord.lastName}`,
          message: `${teacherRecord.firstName} ${teacherRecord.lastName} (${teacherRecord.employeeId}) submitted a ${normalizedLeaveType} leave request for ${totalDays} day(s) (${dateRangeText}). Affected classes: ${affectedTimetableEntries.length}.`,
          notificationType: 'leave_update',
          priority: 'normal',
          relatedEntityType: 'LeaveRequest',
          relatedEntityId: leaveRequest._id,
          eventKey: `leave:submitted:${leaveRequest._id.toString()}:${admin._id.toString()}`,
        })
      )
    );

    return (await TeacherLeave.findById(leaveRequest._id)
      .populate('teacher', 'firstName lastName employeeId designation department')
      .populate('leavePolicy', 'name')) as ITeacherLeave;
  }

  static async listLeaveRequests(
    query: {
      page?: number;
      limit?: number;
      teacher?: string;
      department?: string;
      leaveType?: string;
      status?: string;
      startDate?: string;
      endDate?: string;
      academicYear?: string;
    },
    actor: IActorUser
  ) {
    const filter: Record<string, unknown> = {};
    const isAdmin = actor.role === ROLES.SUPER_ADMIN || actor.role === ROLES.ADMIN;

    if (!isAdmin) {
      const ownTeacher = await Teacher.findOne({ user: actor.id });
      if (!ownTeacher) {
        throw ApiError.notFound('Teacher profile not found');
      }
      filter.teacher = ownTeacher._id;
    } else if (query.teacher) {
      filter.teacher = query.teacher;
    } else if (query.department) {
      const deptTeachers = await Teacher.find({ department: query.department }).select('_id');
      filter.teacher = { $in: deptTeachers.map((t) => t._id) };
    }

    if (query.leaveType) filter.leaveType = query.leaveType.toLowerCase();
    if (query.status) filter.status = query.status;
    if (query.academicYear) filter.academicYear = query.academicYear;
    if (query.startDate || query.endDate) {
      if (query.startDate) filter.endDate = { $gte: new Date(query.startDate) };
      if (query.endDate) filter.startDate = { $lte: new Date(query.endDate) };
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [leaveRequests, total] = await Promise.all([
      TeacherLeave.find(filter)
        .populate({
          path: 'teacher',
          select: 'firstName lastName employeeId designation department',
          populate: { path: 'department', select: 'name code' },
        })
        .populate('reviewedBy', 'name email role')
        .populate('approvedBy', 'name email role')
        .populate('leavePolicy', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      TeacherLeave.countDocuments(filter),
    ]);

    return {
      leaveRequests,
      meta: calculatePagination(page, limit, total),
    };
  }

  static async getLeaveRequestById(
    leaveId: string,
    actor: IActorUser
  ): Promise<ITeacherLeave> {
    const leave = await TeacherLeave.findById(leaveId)
      .populate({
        path: 'teacher',
        select: 'user firstName lastName employeeId designation department',
        populate: { path: 'department', select: 'name code' },
      })
      .populate('leavePolicy', 'name leaveTypes')
      .populate('reviewedBy', 'name email role')
      .populate('approvedBy', 'name email role')
      .populate('cancelledBy', 'name email role')
      .populate('affectedTimetableEntries.subject', 'name code')
      .populate('affectedTimetableEntries.section', 'sectionName semester');

    if (!leave) {
      throw ApiError.notFound('Leave request not found');
    }

    const isAdmin = actor.role === ROLES.SUPER_ADMIN || actor.role === ROLES.ADMIN;
    const teacherObj = leave.teacher as unknown as { user?: unknown };
    if (!isAdmin && extractId(teacherObj?.user) !== actor.id) {
      throw ApiError.forbidden('You can only view your own leave requests');
    }

    return leave;
  }

  static async approveLeaveRequest(
    leaveId: string,
    reviewComments: string | undefined,
    actor: IActorUser
  ): Promise<ITeacherLeave> {
    const leave = await TeacherLeave.findById(leaveId).populate('teacher');
    if (!leave) {
      throw ApiError.notFound('Leave request not found');
    }

    const teacherDoc = leave.teacher as unknown as {
      _id: Types.ObjectId;
      user: Types.ObjectId;
      firstName: string;
      lastName: string;
      employeeId: string;
    };

    // Prevent self-approval
    if (extractId(teacherDoc?.user) === actor.id) {
      throw ApiError.forbidden('Users cannot approve their own leave requests');
    }

    if (leave.status !== 'pending') {
      throw ApiError.badRequest(
        `Only pending leave requests can be approved (current status: ${leave.status})`
      );
    }

    const now = new Date();
    leave.status = 'approved';
    leave.approvedBy = new Types.ObjectId(actor.id);
    leave.reviewedBy = new Types.ObjectId(actor.id);
    leave.reviewedAt = now;
    if (reviewComments) leave.reviewComments = reviewComments;

    leave.approvalHistory.push({
      action: 'approved',
      actor: new Types.ObjectId(actor.id),
      actorRole: actor.role,
      comments: reviewComments || 'Leave request approved',
      timestamp: now,
    });

    await leave.save();

    // Notify teacher via Phase 9 NotificationService
    if (teacherDoc?.user) {
      await NotificationService.createEventNotification({
        recipient: extractId(teacherDoc.user),
        title: `Leave Request Approved`,
        message: `Your ${leave.leaveType} leave request from ${leave.startDate.toISOString().split('T')[0]} to ${leave.endDate.toISOString().split('T')[0]} has been approved.${reviewComments ? ` Note: ${reviewComments}` : ''}`,
        notificationType: 'leave_update',
        priority: 'normal',
        relatedEntityType: 'LeaveRequest',
        relatedEntityId: leave._id,
        eventKey: `leave:approved:${leave._id.toString()}`,
      });
    }

    return (await this.getLeaveRequestById(leave._id.toString(), actor)) as ITeacherLeave;
  }

  static async rejectLeaveRequest(
    leaveId: string,
    reviewComments: string | undefined,
    actor: IActorUser
  ): Promise<ITeacherLeave> {
    const leave = await TeacherLeave.findById(leaveId).populate('teacher');
    if (!leave) {
      throw ApiError.notFound('Leave request not found');
    }

    const teacherDoc = leave.teacher as unknown as {
      _id: Types.ObjectId;
      user: Types.ObjectId;
      firstName: string;
      lastName: string;
    };

    if (extractId(teacherDoc?.user) === actor.id) {
      throw ApiError.forbidden('Users cannot review their own leave requests');
    }

    if (leave.status !== 'pending') {
      throw ApiError.badRequest(
        `Only pending leave requests can be rejected (current status: ${leave.status})`
      );
    }

    const now = new Date();
    leave.status = 'rejected';
    leave.reviewedBy = new Types.ObjectId(actor.id);
    leave.reviewedAt = now;
    leave.reviewComments = reviewComments || 'Leave request rejected';

    leave.approvalHistory.push({
      action: 'rejected',
      actor: new Types.ObjectId(actor.id),
      actorRole: actor.role,
      comments: leave.reviewComments,
      timestamp: now,
    });

    await leave.save();

    if (teacherDoc?.user) {
      await NotificationService.createEventNotification({
        recipient: extractId(teacherDoc.user),
        title: `Leave Request Rejected`,
        message: `Your ${leave.leaveType} leave request from ${leave.startDate.toISOString().split('T')[0]} to ${leave.endDate.toISOString().split('T')[0]} was rejected. Reason: ${leave.reviewComments}`,
        notificationType: 'leave_update',
        priority: 'high',
        relatedEntityType: 'LeaveRequest',
        relatedEntityId: leave._id,
        eventKey: `leave:rejected:${leave._id.toString()}`,
      });
    }

    return (await this.getLeaveRequestById(leave._id.toString(), actor)) as ITeacherLeave;
  }

  static async cancelLeaveRequest(
    leaveId: string,
    cancellationReason: string | undefined,
    actor: IActorUser
  ): Promise<ITeacherLeave> {
    const leave = await TeacherLeave.findById(leaveId)
      .populate('teacher')
      .populate('leavePolicy');

    if (!leave) {
      throw ApiError.notFound('Leave request not found');
    }

    const teacherDoc = leave.teacher as unknown as {
      _id: Types.ObjectId;
      user: Types.ObjectId;
      firstName: string;
      lastName: string;
    };

    const isAdmin = actor.role === ROLES.SUPER_ADMIN || actor.role === ROLES.ADMIN;
    const isOwner = extractId(teacherDoc?.user) === actor.id;

    if (!isAdmin && !isOwner) {
      throw ApiError.forbidden('You can only cancel your own leave requests');
    }

    if (leave.status === 'cancelled' || leave.status === 'rejected') {
      throw ApiError.badRequest(`Leave request is already ${leave.status} and cannot be cancelled`);
    }

    const policy = leave.leavePolicy as unknown as ILeavePolicy | undefined;

    if (!isAdmin && leave.status === 'approved') {
      const allowApprovedCancel =
        policy?.cancellationRules?.allowApprovedCancellationBeforeStart ?? true;
      if (!allowApprovedCancel) {
        throw ApiError.badRequest('Policy does not allow teachers to cancel approved leave requests');
      }
      if (new Date(leave.startDate).getTime() <= Date.now()) {
        throw ApiError.badRequest(
          'Cannot cancel an approved leave request after its start date has passed'
        );
      }
    }

    const now = new Date();
    leave.status = 'cancelled';
    leave.cancelledBy = new Types.ObjectId(actor.id);
    leave.cancelledAt = now;
    leave.cancellationReason = cancellationReason || 'Cancelled by user';

    leave.approvalHistory.push({
      action: 'cancelled',
      actor: new Types.ObjectId(actor.id),
      actorRole: actor.role,
      comments: leave.cancellationReason,
      timestamp: now,
    });

    await leave.save();

    // Cascade cancel any linked active substitutions & revert timetable changes
    const linkedSubstitutions = await Substitution.find({
      leaveRequest: leave._id,
      status: { $in: ['proposed', 'approved'] },
    });

    for (const sub of linkedSubstitutions) {
      sub.status = 'cancelled';
      sub.cancelledBy = new Types.ObjectId(actor.id);
      sub.cancelledAt = now;
      sub.cancellationReason = 'Associated leave request was cancelled';
      sub.auditHistory.push({
        action: 'cancelled',
        actor: new Types.ObjectId(actor.id),
        actorRole: actor.role,
        comments: 'Cancelled automatically due to leave cancellation',
        timestamp: now,
      });
      await sub.save();

      if (sub.timetableChange) {
        await TimetableChange.findByIdAndUpdate(sub.timetableChange, {
          status: 'rejected',
          rejectionReason: 'Associated leave and substitution cancelled',
        });
      }
    }

    if (teacherDoc?.user) {
      await NotificationService.createEventNotification({
        recipient: extractId(teacherDoc.user),
        title: `Leave Request Cancelled`,
        message: `Leave request (${leave.leaveType}) from ${leave.startDate.toISOString().split('T')[0]} to ${leave.endDate.toISOString().split('T')[0]} has been cancelled.`,
        notificationType: 'leave_update',
        priority: 'normal',
        relatedEntityType: 'LeaveRequest',
        relatedEntityId: leave._id,
        eventKey: `leave:cancelled:${leave._id.toString()}:${now.getTime()}`,
      });
    }

    return (await this.getLeaveRequestById(leave._id.toString(), actor)) as ITeacherLeave;
  }
}
