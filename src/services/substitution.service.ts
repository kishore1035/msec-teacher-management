import { Types } from 'mongoose';
import {
  Substitution,
  ISubstitution,
  Timetable,
  TimetableEntry,
  TimetableChange,
  Teacher,
  TeacherLeave,
  TeacherAssignment,
  Subject,
  Student,
  Parent,
  DayOfWeek,
} from '../models';
import { ApiError } from '../utils/apiError';
import { calculatePagination } from '../utils/pagination';
import { ROLES } from '../constants/roles.constant';
import { NotificationService } from './notification.service';
import { timeSlotsOverlap, timeToMinutes } from './timetableConflict.service';
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

export interface ISubstitutionConflictItem {
  conflictType:
    | 'TEACHER_INACTIVE'
    | 'SELF_SUBSTITUTION_CONFLICT'
    | 'TEACHER_LEAVE_CONFLICT'
    | 'TEACHER_TIMETABLE_CONFLICT'
    | 'SUBSTITUTE_DOUBLE_BOOKED'
    | 'SLOT_ALREADY_SUBSTITUTED';
  description: string;
}

export class SubstitutionService {
  /**
   * Normalize a Date to UTC start and end of day
   */
  static getDayBounds(dateInput: Date | string): {
    targetDate: Date;
    startOfDay: Date;
    endOfDay: Date;
    dayOfWeek: DayOfWeek;
  } {
    const d = new Date(dateInput);
    const startOfDay = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0)
    );
    const endOfDay = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999)
    );
    const dayOfWeek = DAY_NAMES[startOfDay.getUTCDay()] as DayOfWeek;
    return { targetDate: startOfDay, startOfDay, endOfDay, dayOfWeek };
  }

  /**
   * Check all conflict vectors for assigning a substitute teacher to a specific date & slot
   */
  static async checkSubstitutionConflicts(input: {
    substituteTeacher: string | Types.ObjectId;
    absentTeacher?: string | Types.ObjectId;
    timetableEntry?: string | Types.ObjectId;
    date: string | Date;
    periodNumber?: number;
    startTime?: string;
    endTime?: string;
    classroom?: string;
    section?: string | Types.ObjectId;
    excludeSubstitutionId?: string | Types.ObjectId;
  }): Promise<{ hasConflicts: boolean; conflicts: ISubstitutionConflictItem[] }> {
    const conflicts: ISubstitutionConflictItem[] = [];
    const { startOfDay, endOfDay, dayOfWeek } = this.getDayBounds(input.date);

    let startTime = input.startTime || '09:00';
    let endTime = input.endTime || '09:55';
    let periodNumber = input.periodNumber || 1;
    let absentTeacherId = input.absentTeacher ? input.absentTeacher.toString() : undefined;
    let entryIdStr = input.timetableEntry ? input.timetableEntry.toString() : undefined;

    if (input.timetableEntry) {
      const entry = await TimetableEntry.findById(input.timetableEntry);
      if (entry) {
        startTime = input.startTime || entry.startTime;
        endTime = input.endTime || entry.endTime;
        periodNumber = input.periodNumber || entry.periodNumber;
        if (!absentTeacherId && entry.teacher) {
          absentTeacherId = entry.teacher.toString();
        }
      }
    }

    const substitute = await Teacher.findById(input.substituteTeacher);
    if (!substitute) {
      throw ApiError.notFound('Substitute teacher not found');
    }

    // 1. Check substitute teacher active status
    if (
      substitute.isActive === false ||
      substitute.status === 'Inactive' ||
      substitute.status === 'Resigned' ||
      substitute.status === 'Retired'
    ) {
      conflicts.push({
        conflictType: 'TEACHER_INACTIVE',
        description: `Teacher ${substitute.firstName} ${substitute.lastName} is not active (status: ${substitute.status})`,
      });
    }

    if (substitute.status === 'On Leave') {
      conflicts.push({
        conflictType: 'TEACHER_LEAVE_CONFLICT',
        description: `Teacher ${substitute.firstName} ${substitute.lastName} has employment status 'On Leave'`,
      });
    }

    // 2. Prevent self-substitution
    if (absentTeacherId && substitute._id.toString() === absentTeacherId) {
      conflicts.push({
        conflictType: 'SELF_SUBSTITUTION_CONFLICT',
        description: `Absent teacher cannot be assigned as their own substitute`,
      });
    }

    // 3. Check approved leaves on the target date
    const approvedLeaves = await TeacherLeave.find({
      teacher: substitute._id,
      status: 'approved',
      startDate: { $lte: endOfDay },
      endDate: { $gte: startOfDay },
    });

    for (const leave of approvedLeaves) {
      if (leave.isPartialDay || leave.dayPart !== 'full_day') {
        if (leave.startTime && leave.endTime) {
          if (!timeSlotsOverlap(startTime, endTime, leave.startTime, leave.endTime)) {
            continue;
          }
        } else if (leave.startPeriod !== undefined && leave.endPeriod !== undefined) {
          if (periodNumber < leave.startPeriod || periodNumber > leave.endPeriod) {
            continue;
          }
        } else if (leave.dayPart === 'first_half' && periodNumber > 4) {
          continue;
        } else if (leave.dayPart === 'second_half' && periodNumber <= 4) {
          continue;
        }
      }

      conflicts.push({
        conflictType: 'TEACHER_LEAVE_CONFLICT',
        description: `Teacher ${substitute.firstName} ${substitute.lastName} has approved ${leave.leaveType} leave on ${startOfDay.toISOString().split('T')[0]}`,
      });
    }

    // 4. Check regular scheduled TimetableEntry conflicts on dayOfWeek
    const activeTimetables = await Timetable.find({
      status: { $in: ['draft', 'published'] },
      effectiveFrom: { $lte: endOfDay },
      effectiveTo: { $gte: startOfDay },
    }).select('_id');

    const timetableIds = activeTimetables.map((t) => t._id);

    const regularEntries = await TimetableEntry.find({
      timetable: { $in: timetableIds },
      dayOfWeek,
      $or: [{ teacher: substitute._id }, { additionalTeachers: substitute._id }],
      status: 'active',
      isBreak: false,
      ...(entryIdStr ? { _id: { $ne: new Types.ObjectId(entryIdStr) } } : {}),
    });

    for (const regEntry of regularEntries) {
      if (timeSlotsOverlap(startTime, endTime, regEntry.startTime, regEntry.endTime)) {
        conflicts.push({
          conflictType: 'TEACHER_TIMETABLE_CONFLICT',
          description: `Teacher ${substitute.firstName} ${substitute.lastName} is already scheduled for period ${regEntry.periodNumber} (${regEntry.startTime} - ${regEntry.endTime}) in classroom ${regEntry.classroom}`,
        });
      }
    }

    // 5. Check if substitute teacher is already assigned to another substitution on the same date & overlapping time
    const subQuery: Record<string, unknown> = {
      substituteTeacher: substitute._id,
      date: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ['proposed', 'approved'] },
    };
    if (input.excludeSubstitutionId) {
      subQuery._id = { $ne: new Types.ObjectId(input.excludeSubstitutionId.toString()) };
    }

    const existingSubForTeacher = await Substitution.find(subQuery);
    for (const sub of existingSubForTeacher) {
      if (
        sub.periodNumber === periodNumber ||
        timeSlotsOverlap(startTime, endTime, sub.startTime, sub.endTime)
      ) {
        conflicts.push({
          conflictType: 'SUBSTITUTE_DOUBLE_BOOKED',
          description: `Teacher ${substitute.firstName} ${substitute.lastName} is already assigned to another substitution during period ${sub.periodNumber} (${sub.startTime} - ${sub.endTime})`,
        });
      }
    }

    // 6. Check if the target timetable entry already has an active substitution on this date
    if (entryIdStr) {
      const slotQuery: Record<string, unknown> = {
        timetableEntry: new Types.ObjectId(entryIdStr),
        date: { $gte: startOfDay, $lte: endOfDay },
        status: { $in: ['proposed', 'approved'] },
      };
      if (input.excludeSubstitutionId) {
        slotQuery._id = { $ne: new Types.ObjectId(input.excludeSubstitutionId.toString()) };
      }

      const existingSlotSub = await Substitution.findOne(slotQuery);
      if (existingSlotSub) {
        conflicts.push({
          conflictType: 'SLOT_ALREADY_SUBSTITUTED',
          description: `An active substitution (${existingSlotSub.status}) already exists for this timetable slot on ${startOfDay.toISOString().split('T')[0]}`,
        });
      }
    }

    return {
      hasConflicts: conflicts.length > 0,
      conflicts,
    };
  }

  /**
   * Find and rank available substitute teachers for a timetable slot
   */
  static async getAvailableSubstituteTeachers(query: {
    timetableEntry?: string;
    date: string;
    periodNumber?: number;
    startTime?: string;
    endTime?: string;
    subject?: string;
    department?: string;
    section?: string;
  }) {
    const { startOfDay, endOfDay, dayOfWeek } = this.getDayBounds(query.date);

    let startTime = query.startTime || '09:00';
    let endTime = query.endTime || '09:55';
    let periodNumber = query.periodNumber || 1;
    let subjectId = query.subject;
    let departmentId = query.department;
    let sectionId = query.section;
    let absentTeacherId: string | undefined;

    if (query.timetableEntry) {
      const entry = await TimetableEntry.findById(query.timetableEntry).populate('timetable');
      if (!entry) {
        throw ApiError.notFound('Timetable entry not found');
      }
      startTime = query.startTime || entry.startTime;
      endTime = query.endTime || entry.endTime;
      periodNumber = query.periodNumber || entry.periodNumber;
      if (!subjectId && entry.subject) subjectId = entry.subject.toString();
      if (!sectionId && entry.section) sectionId = entry.section.toString();
      if (entry.teacher) absentTeacherId = entry.teacher.toString();

      const parentTimetable = entry.timetable as unknown as { department?: Types.ObjectId };
      if (!departmentId && parentTimetable?.department) {
        departmentId = parentTimetable.department.toString();
      }
    }

    let targetSubjectDoc = null;
    if (subjectId) {
      targetSubjectDoc = await Subject.findById(subjectId);
      if (!departmentId && targetSubjectDoc?.department) {
        departmentId = targetSubjectDoc.department.toString();
      }
    }

    const candidates = await Teacher.find({
      isActive: { $ne: false },
      status: 'Active',
      ...(absentTeacherId ? { _id: { $ne: new Types.ObjectId(absentTeacherId) } } : {}),
    }).populate('department', 'name code');

    // Fetch subject assignments and weekly timetable entries to score candidates
    const [subjectAssignments, activeTimetables, substitutionsToday] = await Promise.all([
      subjectId
        ? TeacherAssignment.find({ subject: subjectId, status: 'Active' }).select('teacher')
        : Promise.resolve([]),
      Timetable.find({
        status: 'published',
        effectiveFrom: { $lte: endOfDay },
        effectiveTo: { $gte: startOfDay },
      }).select('_id'),
      Substitution.find({
        date: { $gte: startOfDay, $lte: endOfDay },
        status: { $in: ['proposed', 'approved', 'completed'] },
      }).select('substituteTeacher'),
    ]);

    const subjectTeacherIds = new Set(subjectAssignments.map((a) => a.teacher.toString()));
    const publishedTimetableIds = activeTimetables.map((t) => t._id);

    const allWeeklyEntries = await TimetableEntry.find({
      timetable: { $in: publishedTimetableIds },
      status: 'active',
      isBreak: false,
    }).select('teacher startTime endTime');

    const weeklyPeriodsByTeacher: Record<string, number> = {};
    const weeklyMinutesByTeacher: Record<string, number> = {};

    for (const e of allWeeklyEntries) {
      if (!e.teacher) continue;
      const tid = e.teacher.toString();
      weeklyPeriodsByTeacher[tid] = (weeklyPeriodsByTeacher[tid] || 0) + 1;
      const dur = timeToMinutes(e.endTime) - timeToMinutes(e.startTime);
      if (dur > 0) {
        weeklyMinutesByTeacher[tid] = (weeklyMinutesByTeacher[tid] || 0) + dur;
      }
    }

    const subsTodayByTeacher: Record<string, number> = {};
    for (const s of substitutionsToday) {
      const tid = s.substituteTeacher.toString();
      subsTodayByTeacher[tid] = (subsTodayByTeacher[tid] || 0) + 1;
    }

    const availableTeachers: Array<{
      teacher: {
        _id: Types.ObjectId;
        employeeId: string;
        firstName: string;
        lastName: string;
        designation: string;
        department: unknown;
        specialization: string[];
      };
      isSubjectEligible: boolean;
      isSameDepartment: boolean;
      weeklyScheduledPeriods: number;
      weeklyTeachingHours: number;
      substitutionsOnDate: number;
      recommendationScore: number;
      recommendationReasons: string[];
    }> = [];

    for (const candidate of candidates) {
      const conflictCheck = await this.checkSubstitutionConflicts({
        substituteTeacher: candidate._id,
        absentTeacher: absentTeacherId,
        timetableEntry: query.timetableEntry,
        date: query.date,
        periodNumber,
        startTime,
        endTime,
        section: sectionId,
      });

      if (conflictCheck.hasConflicts) {
        continue;
      }

      const cid = candidate._id.toString();
      const hasSubjectAssignment = subjectTeacherIds.has(cid);
      const hasSpecializationMatch = Boolean(
        targetSubjectDoc &&
          candidate.specialization &&
          candidate.specialization.some(
            (spec) =>
              spec.toLowerCase().includes(targetSubjectDoc.name.toLowerCase()) ||
              spec.toLowerCase().includes(targetSubjectDoc.code.toLowerCase())
          )
      );

      const isSubjectEligible = hasSubjectAssignment || hasSpecializationMatch;
      const isSameDepartment = Boolean(
        departmentId && extractId(candidate.department) === departmentId
      );

      const weeklyScheduledPeriods = weeklyPeriodsByTeacher[cid] || 0;
      const weeklyTeachingHours = Number(((weeklyMinutesByTeacher[cid] || 0) / 60).toFixed(2));
      const substitutionsOnDate = subsTodayByTeacher[cid] || 0;

      let score = 50;
      const reasons: string[] = ['Available during requested time slot'];

      if (isSubjectEligible) {
        score += 35;
        reasons.push('Eligible to teach the subject');
      }
      if (isSameDepartment) {
        score += 20;
        reasons.push('Belongs to the same department');
      }
      score += Math.max(0, 20 - weeklyScheduledPeriods);
      score -= substitutionsOnDate * 15;

      availableTeachers.push({
        teacher: {
          _id: candidate._id,
          employeeId: candidate.employeeId,
          firstName: candidate.firstName,
          lastName: candidate.lastName,
          designation: candidate.designation,
          department: candidate.department,
          specialization: candidate.specialization || [],
        },
        isSubjectEligible,
        isSameDepartment,
        weeklyScheduledPeriods,
        weeklyTeachingHours,
        substitutionsOnDate,
        recommendationScore: score,
        recommendationReasons: reasons,
      });
    }

    availableTeachers.sort((a, b) => b.recommendationScore - a.recommendationScore);

    return {
      slotDetails: {
        date: startOfDay.toISOString().split('T')[0],
        dayOfWeek,
        periodNumber,
        startTime,
        endTime,
        subject: subjectId || null,
        department: departmentId || null,
        section: sectionId || null,
      },
      totalAvailable: availableTeachers.length,
      availableTeachers,
    };
  }

  /**
   * Synchronize an approved Substitution with non-destructive TimetableChange record
   */
  private static async syncTimetableChangeForSubstitution(
    substitution: ISubstitution,
    actorId: string
  ): Promise<void> {
    if (substitution.timetableChange) {
      await TimetableChange.findByIdAndUpdate(substitution.timetableChange, {
        substituteTeacher: substitution.substituteTeacher,
        status: 'approved',
        approvedBy: new Types.ObjectId(actorId),
        approvedAt: new Date(),
      });
    } else {
      const change = await TimetableChange.create({
        timetable: substitution.timetable,
        entry: substitution.timetableEntry,
        changeType: 'substitution',
        effectiveDate: substitution.date,
        originalTeacher: substitution.absentTeacher,
        substituteTeacher: substitution.substituteTeacher,
        originalClassroom: substitution.classroom,
        originalStartTime: substitution.startTime,
        originalEndTime: substitution.endTime,
        originalDayOfWeek: substitution.dayOfWeek,
        originalPeriodNumber: substitution.periodNumber,
        reason: substitution.reason,
        status: 'approved',
        requestedBy: substitution.assignedBy,
        approvedBy: new Types.ObjectId(actorId),
        approvedAt: new Date(),
      });

      substitution.timetableChange = change._id;
      await substitution.save();
    }

    // If linked to a LeaveRequest, link the substitution inside affectedTimetableEntries
    if (substitution.leaveRequest) {
      const leave = await TeacherLeave.findById(substitution.leaveRequest);
      if (leave && leave.affectedTimetableEntries.length > 0) {
        const subDateStr = substitution.date.toISOString().split('T')[0];
        for (const slot of leave.affectedTimetableEntries) {
          const slotDateStr = new Date(slot.date).toISOString().split('T')[0];
          if (
            slot.timetableEntry.toString() === substitution.timetableEntry.toString() &&
            slotDateStr === subDateStr
          ) {
            slot.substitution = substitution._id;
          }
        }
        await leave.save();
      }
    }
  }

  /**
   * Notify affected teachers, students, and optionally parents about a substitution update
   */
  private static async sendSubstitutionNotifications(
    substitution: ISubstitution,
    eventAction: 'proposed' | 'approved' | 'rejected' | 'cancelled'
  ): Promise<void> {
    const [absentTeacher, substituteTeacher, subjectDoc] = await Promise.all([
      Teacher.findById(substitution.absentTeacher).select('user firstName lastName'),
      Teacher.findById(substitution.substituteTeacher).select('user firstName lastName'),
      substitution.subject ? Subject.findById(substitution.subject).select('name code') : null,
    ]);

    const dateStr = new Date(substitution.date).toISOString().split('T')[0];
    const subjectLabel = subjectDoc ? `${subjectDoc.name} (${subjectDoc.code})` : 'Lecture';

    // Notify substitute teacher
    if (substituteTeacher?.user) {
      await NotificationService.createEventNotification({
        recipient: substituteTeacher.user,
        title: `Substitution ${eventAction.charAt(0).toUpperCase() + eventAction.slice(1)}: ${subjectLabel}`,
        message: `Substitution for ${subjectLabel} on ${dateStr} (Period ${substitution.periodNumber}, ${substitution.startTime}-${substitution.endTime}, Room ${substitution.classroom}) is now ${eventAction}.`,
        notificationType: 'substitution_update',
        priority: 'normal',
        relatedEntityType: 'Substitution',
        relatedEntityId: substitution._id,
        eventKey: `substitution:${eventAction}:${substitution._id.toString()}:sub:${substituteTeacher.user.toString()}`,
      });
    }

    // Notify absent teacher
    if (absentTeacher?.user) {
      await NotificationService.createEventNotification({
        recipient: absentTeacher.user,
        title: `Class Substitution ${eventAction.charAt(0).toUpperCase() + eventAction.slice(1)}: ${subjectLabel}`,
        message: `Substitute teacher ${substituteTeacher?.firstName || ''} ${substituteTeacher?.lastName || ''} has been ${eventAction} for your ${subjectLabel} class on ${dateStr} (Period ${substitution.periodNumber}).`,
        notificationType: 'substitution_update',
        priority: 'normal',
        relatedEntityType: 'Substitution',
        relatedEntityId: substitution._id,
        eventKey: `substitution:${eventAction}:${substitution._id.toString()}:abs:${absentTeacher.user.toString()}`,
      });
    }

    // Notify students in the affected section when approved or cancelled
    if (eventAction === 'approved' || eventAction === 'cancelled') {
      const students = await Student.find({
        section: substitution.section,
        status: 'Active',
      }).select('_id user');

      await Promise.all(
        students
          .filter((s) => s.user)
          .map((student) =>
            NotificationService.createEventNotification({
              recipient: student.user,
              title:
                eventAction === 'approved'
                  ? `Teacher Substitution: ${subjectLabel}`
                  : `Substitution Cancelled: ${subjectLabel}`,
              message:
                eventAction === 'approved'
                  ? `Period ${substitution.periodNumber} (${subjectLabel}) on ${dateStr} will be taken by ${substituteTeacher?.firstName || ''} ${substituteTeacher?.lastName || ''} in ${substitution.classroom}.`
                  : `Previously announced substitution for Period ${substitution.periodNumber} (${subjectLabel}) on ${dateStr} has been cancelled.`,
              notificationType: 'substitution_update',
              priority: 'normal',
              relatedEntityType: 'Substitution',
              relatedEntityId: substitution._id,
              eventKey: `substitution:${eventAction}:${substitution._id.toString()}:stu:${student.user.toString()}`,
            })
          )
      );

      // Only notify parents if notifyParents is explicitly enabled
      if (substitution.notifyParents && students.length > 0) {
        const studentIds = students.map((s) => s._id);
        const parents = await Parent.find({
          'students.student': { $in: studentIds },
          isActive: true,
        }).select('user');

        await Promise.all(
          parents
            .filter((p) => p.user)
            .map((parent) =>
              NotificationService.createEventNotification({
                recipient: parent.user,
                title: `Class Schedule Update: ${subjectLabel}`,
                message: `Period ${substitution.periodNumber} (${subjectLabel}) on ${dateStr} has a substitution update (${eventAction}).`,
                notificationType: 'substitution_update',
                priority: 'low',
                relatedEntityType: 'Substitution',
                relatedEntityId: substitution._id,
                eventKey: `substitution:${eventAction}:${substitution._id.toString()}:par:${parent.user.toString()}`,
              })
            )
        );
      }
    }
  }

  /**
   * Create / propose / assign a teacher substitution
   */
  static async createSubstitution(
    input: {
      timetableEntry: string;
      timetable?: string;
      leaveRequest?: string;
      absentTeacher?: string;
      substituteTeacher: string;
      date: string | Date;
      periodNumber?: number;
      startTime?: string;
      endTime?: string;
      subject?: string;
      section?: string;
      classroom?: string;
      reason: string;
      autoApprove?: boolean;
      notifyParents?: boolean;
    },
    actor: IActorUser
  ): Promise<ISubstitution> {
    const entry = await TimetableEntry.findById(input.timetableEntry);
    if (!entry) {
      throw ApiError.notFound('Original timetable entry not found');
    }

    const timetableId = input.timetable || entry.timetable.toString();
    const timetable = await Timetable.findById(timetableId);
    if (!timetable) {
      throw ApiError.notFound('Timetable not found');
    }

    const absentTeacherId = input.absentTeacher || entry.teacher?.toString();
    if (!absentTeacherId) {
      throw ApiError.badRequest('Absent teacher could not be determined for this timetable entry');
    }

    const [absentTeacher, substituteTeacher] = await Promise.all([
      Teacher.findById(absentTeacherId),
      Teacher.findById(input.substituteTeacher),
    ]);

    if (!absentTeacher) throw ApiError.notFound('Absent teacher not found');
    if (!substituteTeacher) throw ApiError.notFound('Substitute teacher not found');

    // If actor is a Teacher, they can only propose substitutions for their own classes
    const isAdmin = actor.role === ROLES.SUPER_ADMIN || actor.role === ROLES.ADMIN;
    if (!isAdmin && extractId(absentTeacher.user) !== actor.id) {
      throw ApiError.forbidden(
        'Teachers can only propose substitutions for their own scheduled lectures'
      );
    }

    const { targetDate, dayOfWeek } = this.getDayBounds(input.date);
    const periodNumber = input.periodNumber || entry.periodNumber;
    const startTime = input.startTime || entry.startTime;
    const endTime = input.endTime || entry.endTime;
    const classroom = input.classroom || entry.classroom;
    const sectionId = input.section || entry.section.toString();
    const subjectId = input.subject || entry.subject?.toString();

    // Run comprehensive conflict check
    const conflictResult = await this.checkSubstitutionConflicts({
      substituteTeacher: substituteTeacher._id,
      absentTeacher: absentTeacher._id,
      timetableEntry: entry._id,
      date: targetDate,
      periodNumber,
      startTime,
      endTime,
      classroom,
      section: sectionId,
    });

    if (conflictResult.hasConflicts) {
      const details = conflictResult.conflicts
        .map((c) => `[${c.conflictType}] ${c.description}`)
        .join('; ');
      throw ApiError.conflict(`Substitution conflict detected: ${details}`);
    }

    const shouldAutoApprove = isAdmin && input.autoApprove !== false;
    const initialStatus = shouldAutoApprove ? 'approved' : 'proposed';
    const now = new Date();

    const substitution = await Substitution.create({
      timetable: timetable._id,
      timetableEntry: entry._id,
      leaveRequest: input.leaveRequest ? new Types.ObjectId(input.leaveRequest) : undefined,
      absentTeacher: absentTeacher._id,
      substituteTeacher: substituteTeacher._id,
      date: targetDate,
      dayOfWeek,
      periodNumber,
      startTime,
      endTime,
      subject: subjectId ? new Types.ObjectId(subjectId) : undefined,
      section: new Types.ObjectId(sectionId),
      classroom,
      reason: input.reason.trim(),
      status: initialStatus,
      assignedBy: new Types.ObjectId(actor.id),
      approvedBy: shouldAutoApprove ? new Types.ObjectId(actor.id) : undefined,
      approvedAt: shouldAutoApprove ? now : undefined,
      approvalComments: shouldAutoApprove ? 'Auto-approved by administrator' : undefined,
      notifyParents: Boolean(input.notifyParents),
      auditHistory: [
        {
          action: shouldAutoApprove ? 'approved' : 'proposed',
          actor: new Types.ObjectId(actor.id),
          actorRole: actor.role,
          comments: input.reason.trim(),
          timestamp: now,
        },
      ],
    });

    if (shouldAutoApprove) {
      await this.syncTimetableChangeForSubstitution(substitution, actor.id);
    }

    await this.sendSubstitutionNotifications(
      substitution,
      shouldAutoApprove ? 'approved' : 'proposed'
    );

    return (await this.getSubstitutionById(substitution._id.toString(), actor)) as ISubstitution;
  }

  /**
   * Approve a proposed substitution
   */
  static async approveSubstitution(
    substitutionId: string,
    approvalComments: string | undefined,
    actor: IActorUser
  ): Promise<ISubstitution> {
    const substitution = await Substitution.findById(substitutionId);
    if (!substitution) {
      throw ApiError.notFound('Substitution record not found');
    }

    if (substitution.status !== 'proposed') {
      throw ApiError.badRequest(
        `Only proposed substitutions can be approved (current status: ${substitution.status})`
      );
    }

    // Re-verify conflicts before approving
    const conflictResult = await this.checkSubstitutionConflicts({
      substituteTeacher: substitution.substituteTeacher,
      absentTeacher: substitution.absentTeacher,
      timetableEntry: substitution.timetableEntry,
      date: substitution.date,
      periodNumber: substitution.periodNumber,
      startTime: substitution.startTime,
      endTime: substitution.endTime,
      classroom: substitution.classroom,
      section: substitution.section,
      excludeSubstitutionId: substitution._id,
    });

    if (conflictResult.hasConflicts) {
      const details = conflictResult.conflicts
        .map((c) => `[${c.conflictType}] ${c.description}`)
        .join('; ');
      throw ApiError.conflict(`Cannot approve substitution due to conflict: ${details}`);
    }

    const now = new Date();
    substitution.status = 'approved';
    substitution.approvedBy = new Types.ObjectId(actor.id);
    substitution.approvedAt = now;
    if (approvalComments) substitution.approvalComments = approvalComments;

    substitution.auditHistory.push({
      action: 'approved',
      actor: new Types.ObjectId(actor.id),
      actorRole: actor.role,
      comments: approvalComments || 'Approved by administrator',
      timestamp: now,
    });

    await substitution.save();
    await this.syncTimetableChangeForSubstitution(substitution, actor.id);
    await this.sendSubstitutionNotifications(substitution, 'approved');

    return (await this.getSubstitutionById(substitution._id.toString(), actor)) as ISubstitution;
  }

  /**
   * Reject a proposed substitution
   */
  static async rejectSubstitution(
    substitutionId: string,
    rejectionReason: string | undefined,
    actor: IActorUser
  ): Promise<ISubstitution> {
    const substitution = await Substitution.findById(substitutionId);
    if (!substitution) {
      throw ApiError.notFound('Substitution record not found');
    }

    if (substitution.status !== 'proposed') {
      throw ApiError.badRequest(
        `Only proposed substitutions can be rejected (current status: ${substitution.status})`
      );
    }

    const now = new Date();
    substitution.status = 'rejected';
    substitution.approvedBy = new Types.ObjectId(actor.id);
    substitution.rejectionReason = rejectionReason || 'Rejected by administrator';

    substitution.auditHistory.push({
      action: 'rejected',
      actor: new Types.ObjectId(actor.id),
      actorRole: actor.role,
      comments: substitution.rejectionReason,
      timestamp: now,
    });

    await substitution.save();
    await this.sendSubstitutionNotifications(substitution, 'rejected');

    return (await this.getSubstitutionById(substitution._id.toString(), actor)) as ISubstitution;
  }

  /**
   * Mark an approved substitution as completed
   */
  static async completeSubstitution(
    substitutionId: string,
    details: {
      topicsCovered?: string;
      remarks?: string;
      attendanceRecorded?: boolean;
    },
    actor: IActorUser
  ): Promise<ISubstitution> {
    const substitution = await Substitution.findById(substitutionId).populate(
      'substituteTeacher',
      'user firstName lastName'
    );

    if (!substitution) {
      throw ApiError.notFound('Substitution record not found');
    }

    const isAdmin = actor.role === ROLES.SUPER_ADMIN || actor.role === ROLES.ADMIN;
    const subTeacherObj = substitution.substituteTeacher as unknown as { user?: unknown };

    if (!isAdmin && extractId(subTeacherObj?.user) !== actor.id) {
      throw ApiError.forbidden(
        'Only the assigned substitute teacher or an administrator can mark this substitution as completed'
      );
    }

    if (substitution.status !== 'approved') {
      throw ApiError.badRequest(
        `Only approved substitutions can be marked completed (current status: ${substitution.status})`
      );
    }

    const now = new Date();
    substitution.status = 'completed';
    substitution.completionDetails = {
      completedAt: now,
      completedBy: new Types.ObjectId(actor.id),
      topicsCovered: details.topicsCovered,
      remarks: details.remarks,
      attendanceRecorded: Boolean(details.attendanceRecorded),
    };

    substitution.auditHistory.push({
      action: 'completed',
      actor: new Types.ObjectId(actor.id),
      actorRole: actor.role,
      comments: details.remarks || details.topicsCovered || 'Substitution lecture completed',
      timestamp: now,
    });

    await substitution.save();

    return (await this.getSubstitutionById(substitution._id.toString(), actor)) as ISubstitution;
  }

  /**
   * Cancel a substitution and revert non-destructive TimetableChange override
   */
  static async cancelSubstitution(
    substitutionId: string,
    cancellationReason: string | undefined,
    actor: IActorUser
  ): Promise<ISubstitution> {
    const substitution = await Substitution.findById(substitutionId)
      .populate('absentTeacher', 'user')
      .populate('substituteTeacher', 'user');

    if (!substitution) {
      throw ApiError.notFound('Substitution record not found');
    }

    const isAdmin = actor.role === ROLES.SUPER_ADMIN || actor.role === ROLES.ADMIN;
    const absentUser = extractId(
      (substitution.absentTeacher as unknown as { user?: unknown })?.user
    );

    if (!isAdmin && absentUser !== actor.id) {
      throw ApiError.forbidden('You are not authorized to cancel this substitution');
    }

    if (substitution.status === 'cancelled' || substitution.status === 'rejected') {
      throw ApiError.badRequest(`Substitution is already ${substitution.status}`);
    }

    if (substitution.status === 'completed' && !isAdmin) {
      throw ApiError.badRequest('Completed substitutions cannot be cancelled by non-admins');
    }

    const now = new Date();
    substitution.status = 'cancelled';
    substitution.cancelledBy = new Types.ObjectId(actor.id);
    substitution.cancelledAt = now;
    substitution.cancellationReason = cancellationReason || 'Cancelled';

    substitution.auditHistory.push({
      action: 'cancelled',
      actor: new Types.ObjectId(actor.id),
      actorRole: actor.role,
      comments: substitution.cancellationReason,
      timestamp: now,
    });

    await substitution.save();

    // Revert TimetableChange so original timetable entry is no longer overridden
    if (substitution.timetableChange) {
      await TimetableChange.findByIdAndUpdate(substitution.timetableChange, {
        status: 'rejected',
        rejectionReason: `Substitution cancelled: ${substitution.cancellationReason}`,
      });
    }

    await this.sendSubstitutionNotifications(substitution, 'cancelled');

    return (await this.getSubstitutionById(substitution._id.toString(), actor)) as ISubstitution;
  }

  /**
   * List substitutions with filters
   */
  static async listSubstitutions(
    query: {
      page?: number;
      limit?: number;
      absentTeacher?: string;
      substituteTeacher?: string;
      teacher?: string;
      section?: string;
      subject?: string;
      department?: string;
      leaveRequest?: string;
      status?: string;
      date?: string;
      startDate?: string;
      endDate?: string;
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
      filter.$or = [
        { substituteTeacher: ownTeacher._id },
        { absentTeacher: ownTeacher._id },
      ];
    } else {
      if (query.absentTeacher) filter.absentTeacher = query.absentTeacher;
      if (query.substituteTeacher) filter.substituteTeacher = query.substituteTeacher;
      if (query.teacher) {
        filter.$or = [
          { substituteTeacher: query.teacher },
          { absentTeacher: query.teacher },
        ];
      }
      if (query.department) {
        const deptTeachers = await Teacher.find({ department: query.department }).select('_id');
        const ids = deptTeachers.map((t) => t._id);
        filter.$or = [{ substituteTeacher: { $in: ids } }, { absentTeacher: { $in: ids } }];
      }
    }

    if (query.section) filter.section = query.section;
    if (query.subject) filter.subject = query.subject;
    if (query.leaveRequest) filter.leaveRequest = query.leaveRequest;
    if (query.status) filter.status = query.status;

    if (query.date) {
      const { startOfDay, endOfDay } = this.getDayBounds(query.date);
      filter.date = { $gte: startOfDay, $lte: endOfDay };
    } else if (query.startDate || query.endDate) {
      const dateRange: Record<string, Date> = {};
      if (query.startDate) dateRange.$gte = new Date(query.startDate);
      if (query.endDate) dateRange.$lte = new Date(query.endDate);
      filter.date = dateRange;
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [substitutions, total] = await Promise.all([
      Substitution.find(filter)
        .populate('absentTeacher', 'firstName lastName employeeId designation')
        .populate('substituteTeacher', 'firstName lastName employeeId designation')
        .populate('subject', 'name code')
        .populate('section', 'sectionName semester')
        .populate('assignedBy', 'name email role')
        .populate('approvedBy', 'name email role')
        .sort({ date: -1, periodNumber: 1 })
        .skip(skip)
        .limit(limit),
      Substitution.countDocuments(filter),
    ]);

    return {
      substitutions,
      meta: calculatePagination(page, limit, total),
    };
  }

  /**
   * Get single substitution details
   */
  static async getSubstitutionById(
    substitutionId: string,
    actor: IActorUser
  ): Promise<ISubstitution> {
    const substitution = await Substitution.findById(substitutionId)
      .populate('absentTeacher', 'user firstName lastName employeeId designation department')
      .populate('substituteTeacher', 'user firstName lastName employeeId designation department')
      .populate('subject', 'name code')
      .populate('section', 'sectionName semester')
      .populate('timetable', 'name effectiveFrom effectiveTo')
      .populate('timetableEntry')
      .populate('leaveRequest', 'leaveType startDate endDate status')
      .populate('assignedBy', 'name email role')
      .populate('approvedBy', 'name email role')
      .populate('cancelledBy', 'name email role');

    if (!substitution) {
      throw ApiError.notFound('Substitution record not found');
    }

    const isAdmin = actor.role === ROLES.SUPER_ADMIN || actor.role === ROLES.ADMIN;
    if (!isAdmin) {
      const absUserId = extractId(
        (substitution.absentTeacher as unknown as { user?: unknown })?.user
      );
      const subUserId = extractId(
        (substitution.substituteTeacher as unknown as { user?: unknown })?.user
      );
      if (absUserId !== actor.id && subUserId !== actor.id) {
        throw ApiError.forbidden('You can only view substitutions involving your classes');
      }
    }

    return substitution;
  }
}
