import { Types } from 'mongoose';
import {
  Timetable,
  TimetableEntry,
  DayOfWeek,
  Teacher,
  TeacherLeave,
  ExaminationSchedule,
  TimetableConflictOverride,
} from '../models';

export interface IConflictDetail {
  conflictType:
    | 'TEACHER_CONFLICT'
    | 'SECTION_CONFLICT'
    | 'CLASSROOM_CONFLICT'
    | 'LABORATORY_CONFLICT'
    | 'TEACHER_LEAVE_CONFLICT'
    | 'EXAMINATION_CONFLICT';
  description: string;
  conflictingEntityId?: string;
  conflictingEntityType: 'Teacher' | 'Section' | 'Classroom' | 'Examination';
  dayOfWeek: DayOfWeek;
  timeSlot: string;
}

export interface IConflictCheckInput {
  timetableId?: Types.ObjectId | string;
  section?: Types.ObjectId | string;
  teacher?: Types.ObjectId | string;
  additionalTeachers?: (Types.ObjectId | string)[];
  classroom: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  effectiveFrom?: Date;
  effectiveTo?: Date;
  lectureType?: string;
  excludeEntryId?: Types.ObjectId | string;
}

export const timeToMinutes = (timeStr: string): number => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

export const timeSlotsOverlap = (
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean => {
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);
  return s1 < e2 && e1 > s2;
};

export const dateRangesOverlap = (
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): boolean => {
  const s1 = new Date(start1).getTime();
  const e1 = new Date(end1).getTime();
  const s2 = new Date(start2).getTime();
  const e2 = new Date(end2).getTime();
  return s1 <= e2 && e1 >= s2;
};

export class TimetableConflictService {
  /**
   * Comprehensive conflict detection engine
   */
  static async detectConflicts(
    input: IConflictCheckInput
  ): Promise<{ hasConflicts: boolean; conflicts: IConflictDetail[] }> {
    const conflicts: IConflictDetail[] = [];

    // 1. Resolve timetable dates and section if timetableId provided
    let effectiveFrom = input.effectiveFrom;
    let effectiveTo = input.effectiveTo;
    let sectionId = input.section;

    if (input.timetableId) {
      const timetable = await Timetable.findById(input.timetableId);
      if (timetable) {
        if (!effectiveFrom) effectiveFrom = timetable.effectiveFrom;
        if (!effectiveTo) effectiveTo = timetable.effectiveTo;
        if (!sectionId) sectionId = timetable.section;
      }
    }

    // Default dates if still not set
    if (!effectiveFrom) effectiveFrom = new Date();
    if (!effectiveTo) {
      effectiveTo = new Date();
      effectiveTo.setMonth(effectiveTo.getMonth() + 6);
    }

    const allTeachersToCheck: Types.ObjectId[] = [];
    if (input.teacher) {
      allTeachersToCheck.push(new Types.ObjectId(input.teacher.toString()));
    }
    if (input.additionalTeachers && input.additionalTeachers.length > 0) {
      for (const t of input.additionalTeachers) {
        allTeachersToCheck.push(new Types.ObjectId(t.toString()));
      }
    }

    // Find all active/published timetables that overlap the effective date range
    const overlappingTimetables = await Timetable.find({
      status: { $in: ['draft', 'published'] },
      effectiveFrom: { $lte: effectiveTo },
      effectiveTo: { $gte: effectiveFrom },
    }).select('_id name section status effectiveFrom effectiveTo');

    const overlappingTimetableIds = overlappingTimetables.map((t) => t._id);

    // Fetch existing entries on the same dayOfWeek across overlapping timetables
    const entryQuery: Record<string, unknown> = {
      timetable: { $in: overlappingTimetableIds },
      dayOfWeek: input.dayOfWeek,
      status: 'active',
      isBreak: false,
    };

    if (input.excludeEntryId) {
      entryQuery._id = { $ne: new Types.ObjectId(input.excludeEntryId.toString()) };
    }

    const existingEntries = await TimetableEntry.find(entryQuery)
      .populate('teacher', 'firstName lastName employeeId')
      .populate('subject', 'name code')
      .populate('section', 'sectionName');

    // 2. Check Teacher Conflicts
    if (allTeachersToCheck.length > 0) {
      for (const entry of existingEntries) {
        if (!timeSlotsOverlap(input.startTime, input.endTime, entry.startTime, entry.endTime)) {
          continue;
        }

        const entryTeacherId = entry.teacher?._id?.toString() || entry.teacher?.toString();
        const entryAdditionalTeachers = (entry.additionalTeachers || []).map((t) =>
          t.toString()
        );

        for (const targetTeacherId of allTeachersToCheck) {
          const targetStr = targetTeacherId.toString();
          if (
            entryTeacherId === targetStr ||
            entryAdditionalTeachers.includes(targetStr)
          ) {
            const teacherObj = entry.teacher as unknown as { firstName?: string; lastName?: string } | undefined;
            const teacherName = teacherObj?.firstName
              ? `${teacherObj.firstName} ${teacherObj.lastName || ''}`.trim()
              : targetStr;

            conflicts.push({
              conflictType: 'TEACHER_CONFLICT',
              description: `Teacher ${teacherName} is already scheduled for another lecture (${entry.startTime} - ${entry.endTime}) in classroom ${entry.classroom}`,
              conflictingEntityId: targetStr,
              conflictingEntityType: 'Teacher',
              dayOfWeek: input.dayOfWeek,
              timeSlot: `${entry.startTime} - ${entry.endTime}`,
            });
          }
        }
      }
    }

    // 3. Check Section Conflicts
    if (sectionId) {
      const sectionStr = sectionId.toString();
      for (const entry of existingEntries) {
        const entrySectionStr = entry.section?._id?.toString() || entry.section?.toString();
        if (entrySectionStr === sectionStr) {
          if (timeSlotsOverlap(input.startTime, input.endTime, entry.startTime, entry.endTime)) {
            conflicts.push({
              conflictType: 'SECTION_CONFLICT',
              description: `Section already has a scheduled lecture (${entry.startTime} - ${entry.endTime}) in classroom ${entry.classroom}`,
              conflictingEntityId: sectionStr,
              conflictingEntityType: 'Section',
              dayOfWeek: input.dayOfWeek,
              timeSlot: `${entry.startTime} - ${entry.endTime}`,
            });
          }
        }
      }
    }

    // 4. Check Classroom & Laboratory Conflicts
    if (input.classroom && input.classroom.trim().length > 0) {
      const targetRoom = input.classroom.trim().toLowerCase();
      const isLab =
        input.lectureType === 'lab' ||
        input.lectureType === 'practical' ||
        targetRoom.includes('lab');

      for (const entry of existingEntries) {
        if (entry.classroom && entry.classroom.trim().toLowerCase() === targetRoom) {
          if (timeSlotsOverlap(input.startTime, input.endTime, entry.startTime, entry.endTime)) {
            // If it's a lab, check if different section
            const entrySectionStr = entry.section?._id?.toString() || entry.section?.toString();
            const inputSectionStr = sectionId?.toString();

            if (isLab) {
              conflicts.push({
                conflictType: 'LABORATORY_CONFLICT',
                description: `Laboratory '${entry.classroom}' is already occupied by another session from ${entry.startTime} to ${entry.endTime}`,
                conflictingEntityId: entry.classroom,
                conflictingEntityType: 'Classroom',
                dayOfWeek: input.dayOfWeek,
                timeSlot: `${entry.startTime} - ${entry.endTime}`,
              });
            } else if (entrySectionStr !== inputSectionStr) {
              conflicts.push({
                conflictType: 'CLASSROOM_CONFLICT',
                description: `Classroom '${entry.classroom}' is already allocated to another lecture from ${entry.startTime} to ${entry.endTime}`,
                conflictingEntityId: entry.classroom,
                conflictingEntityType: 'Classroom',
                dayOfWeek: input.dayOfWeek,
                timeSlot: `${entry.startTime} - ${entry.endTime}`,
              });
            }
          }
        }
      }
    }

    // 5. Check Teacher Availability & Approved Leave
    if (allTeachersToCheck.length > 0) {
      for (const teacherId of allTeachersToCheck) {
        const teacher = await Teacher.findById(teacherId);
        if (teacher) {
          if (teacher.status === 'On Leave') {
            conflicts.push({
              conflictType: 'TEACHER_LEAVE_CONFLICT',
              description: `Teacher ${teacher.firstName} ${teacher.lastName} status is currently 'On Leave'`,
              conflictingEntityId: teacher._id.toString(),
              conflictingEntityType: 'Teacher',
              dayOfWeek: input.dayOfWeek,
              timeSlot: `${input.startTime} - ${input.endTime}`,
            });
          }

          // Check approved leaves overlapping the effective period
          const approvedLeaves = await TeacherLeave.find({
            teacher: teacher._id,
            status: 'approved',
            startDate: { $lte: effectiveTo },
            endDate: { $gte: effectiveFrom },
          });

          if (approvedLeaves.length > 0) {
            for (const leave of approvedLeaves) {
              if (leave.isPartialDay && leave.startTime && leave.endTime) {
                if (!timeSlotsOverlap(input.startTime, input.endTime, leave.startTime, leave.endTime)) {
                  continue;
                }
              }
              conflicts.push({
                conflictType: 'TEACHER_LEAVE_CONFLICT',
                description: `Teacher ${teacher.firstName} ${teacher.lastName} has approved ${leave.leaveType} leave from ${leave.startDate.toISOString().split('T')[0]} to ${leave.endDate.toISOString().split('T')[0]}`,
                conflictingEntityId: teacher._id.toString(),
                conflictingEntityType: 'Teacher',
                dayOfWeek: input.dayOfWeek,
                timeSlot: `${input.startTime} - ${input.endTime}`,
              });
            }
          }
        }
      }
    }

    // 6. Check Scheduled Examination Conflicts
    if (sectionId) {
      const examSchedules = await ExaminationSchedule.find({
        section: sectionId,
        status: { $in: ['scheduled', 'rescheduled'] },
        examDate: { $gte: effectiveFrom, $lte: effectiveTo },
      });

      const dayNames = [
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
      ];

      for (const exam of examSchedules) {
        const examDayOfWeek = dayNames[new Date(exam.examDate).getDay()];
        if (examDayOfWeek === input.dayOfWeek) {
          if (timeSlotsOverlap(input.startTime, input.endTime, exam.startTime, exam.endTime)) {
            conflicts.push({
              conflictType: 'EXAMINATION_CONFLICT',
              description: `Examination is scheduled for this section on ${input.dayOfWeek} (${exam.examDate.toISOString().split('T')[0]}) from ${exam.startTime} to ${exam.endTime} at venue ${exam.venue}`,
              conflictingEntityId: exam._id.toString(),
              conflictingEntityType: 'Examination',
              dayOfWeek: input.dayOfWeek,
              timeSlot: `${exam.startTime} - ${exam.endTime}`,
            });
          }
        }
      }
    }

    return {
      hasConflicts: conflicts.length > 0,
      conflicts,
    };
  }

  /**
   * Log an audited administrator override for a conflict
   */
  static async recordOverride(
    timetableId: Types.ObjectId | string,
    conflictType: string,
    conflictDetails: string,
    reason: string,
    userId: Types.ObjectId | string,
    entryId?: Types.ObjectId | string
  ) {
    return await TimetableConflictOverride.create({
      timetable: timetableId,
      entry: entryId,
      conflictType,
      conflictDetails,
      reason,
      overriddenBy: userId,
    });
  }

  /**
   * List conflict overrides audit trail
   */
  static async listConflictOverrides(timetableId?: string) {
    const query: Record<string, unknown> = {};
    if (timetableId) query.timetable = timetableId;

    return await TimetableConflictOverride.find(query)
      .populate('overriddenBy', 'name email role')
      .populate('timetable', 'name section')
      .sort({ createdAt: -1 });
  }
}
