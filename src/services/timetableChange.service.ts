import { Types } from 'mongoose';
import {
  Timetable,
  TimetableEntry,
  TimetableChange,
  ITimetableChange,
  Teacher,
  TeacherLeave,
} from '../models';
import { ApiError } from '../utils/apiError';
import { TimetableConflictService } from './timetableConflict.service';

export class TimetableChangeService {
  /**
   * Request or record a timetable change (substitution, rescheduling, cancellation, etc.)
   */
  static async createChange(
    data: {
      timetable: string | Types.ObjectId;
      entry: string | Types.ObjectId;
      changeType: ITimetableChange['changeType'];
      effectiveDate: Date;
      originalTeacher?: string | Types.ObjectId;
      substituteTeacher?: string | Types.ObjectId;
      originalClassroom?: string;
      newClassroom?: string;
      originalStartTime?: string;
      newStartTime?: string;
      originalEndTime?: string;
      newEndTime?: string;
      originalDayOfWeek?: ITimetableChange['originalDayOfWeek'];
      newDayOfWeek?: ITimetableChange['newDayOfWeek'];
      originalPeriodNumber?: number;
      newPeriodNumber?: number;
      reason: string;
    },
    user: { _id: Types.ObjectId | string; role: string }
  ): Promise<ITimetableChange> {
    const timetable = await Timetable.findById(data.timetable);
    if (!timetable) throw new ApiError(404, 'Timetable not found');

    const entry = await TimetableEntry.findById(data.entry);
    if (!entry) throw new ApiError(404, 'Timetable entry not found');

    // If teacher substitution, check substitute teacher availability and conflicts
    if (data.changeType === 'substitution') {
      if (!data.substituteTeacher) {
        throw new ApiError(400, 'Substitute teacher must be specified for substitution');
      }

      const substitute = await Teacher.findById(data.substituteTeacher);
      if (!substitute) throw new ApiError(404, 'Substitute teacher not found');

      // Check if substitute teacher is on leave on the effective date
      const effectiveDate = new Date(data.effectiveDate);
      if (substitute.status === 'On Leave') {
        throw new ApiError(
          409,
          `Substitute teacher ${substitute.firstName} ${substitute.lastName} is currently On Leave`
        );
      }

      const onLeave = await TeacherLeave.findOne({
        teacher: substitute._id,
        status: 'approved',
        startDate: { $lte: effectiveDate },
        endDate: { $gte: effectiveDate },
      });

      if (onLeave) {
        throw new ApiError(
          409,
          `Substitute teacher ${substitute.firstName} ${substitute.lastName} has approved leave on ${effectiveDate.toISOString().split('T')[0]}`
        );
      }

      // Check if substitute teacher has a conflicting lecture at this time on this day
      const targetDayOfWeek = entry.dayOfWeek;
      const targetStartTime = entry.startTime;
      const targetEndTime = entry.endTime;

      const conflictCheck = await TimetableConflictService.detectConflicts({
        timetableId: timetable._id,
        teacher: substitute._id,
        classroom: entry.classroom,
        dayOfWeek: targetDayOfWeek,
        startTime: targetStartTime,
        endTime: targetEndTime,
        effectiveFrom: effectiveDate,
        effectiveTo: effectiveDate,
        excludeEntryId: entry._id,
      });

      const teacherConflict = conflictCheck.conflicts.find(
        (c) => c.conflictType === 'TEACHER_CONFLICT'
      );
      if (teacherConflict) {
        throw new ApiError(
          409,
          `Substitute teacher conflict: ${teacherConflict.description}`
        );
      }
    }

    // If rescheduling, check conflicts for new day/time/classroom
    if (data.changeType === 'rescheduling') {
      const targetDay = data.newDayOfWeek || entry.dayOfWeek;
      const targetStart = data.newStartTime || entry.startTime;
      const targetEnd = data.newEndTime || entry.endTime;
      const targetRoom = data.newClassroom || entry.classroom;

      const conflictCheck = await TimetableConflictService.detectConflicts({
        timetableId: timetable._id,
        section: timetable.section,
        teacher: entry.teacher,
        classroom: targetRoom,
        dayOfWeek: targetDay,
        startTime: targetStart,
        endTime: targetEnd,
        effectiveFrom: data.effectiveDate,
        effectiveTo: data.effectiveDate,
        excludeEntryId: entry._id,
      });

      if (conflictCheck.hasConflicts) {
        throw new ApiError(
          409,
          `Rescheduling conflict detected: ${conflictCheck.conflicts.map((c) => c.description).join('; ')}`
        );
      }
    }

    // Admins auto-approve, non-admins create pending requests
    const isAdmin = user.role === 'Super Admin' || user.role === 'Admin';
    const status = isAdmin ? 'approved' : 'pending';

    return await TimetableChange.create({
      ...data,
      originalTeacher: data.originalTeacher || entry.teacher,
      originalClassroom: data.originalClassroom || entry.classroom,
      originalStartTime: data.originalStartTime || entry.startTime,
      originalEndTime: data.originalEndTime || entry.endTime,
      originalDayOfWeek: data.originalDayOfWeek || entry.dayOfWeek,
      originalPeriodNumber: data.originalPeriodNumber || entry.periodNumber,
      status,
      requestedBy: user._id,
      approvedBy: isAdmin ? user._id : undefined,
      approvedAt: isAdmin ? new Date() : undefined,
    });
  }

  /**
   * Approve timetable change
   */
  static async approveChange(
    changeId: string,
    user: { _id: Types.ObjectId | string; role: string }
  ): Promise<ITimetableChange> {
    const change = await TimetableChange.findById(changeId);
    if (!change) throw new ApiError(404, 'Timetable change request not found');

    if (change.status === 'approved') {
      throw new ApiError(400, 'Timetable change is already approved');
    }

    change.status = 'approved';
    change.approvedBy = new Types.ObjectId(user._id.toString());
    change.approvedAt = new Date();

    return await change.save();
  }

  /**
   * Reject timetable change
   */
  static async rejectChange(
    changeId: string,
    rejectionReason: string,
    user: { _id: Types.ObjectId | string; role: string }
  ): Promise<ITimetableChange> {
    const change = await TimetableChange.findById(changeId);
    if (!change) throw new ApiError(404, 'Timetable change request not found');

    if (change.status === 'rejected') {
      throw new ApiError(400, 'Timetable change is already rejected');
    }

    change.status = 'rejected';
    change.rejectionReason = rejectionReason;
    change.approvedBy = new Types.ObjectId(user._id.toString());

    return await change.save();
  }

  /**
   * List timetable changes with filtering
   */
  static async listChanges(query: {
    timetable?: string;
    status?: string;
    changeType?: string;
    date?: string;
  }) {
    const filter: Record<string, unknown> = {};
    if (query.timetable) filter.timetable = query.timetable;
    if (query.status) filter.status = query.status;
    if (query.changeType) filter.changeType = query.changeType;
    if (query.date) {
      const d = new Date(query.date);
      const start = new Date(d.setHours(0, 0, 0, 0));
      const end = new Date(d.setHours(23, 59, 59, 999));
      filter.effectiveDate = { $gte: start, $lte: end };
    }

    return await TimetableChange.find(filter)
      .populate('originalTeacher', 'firstName lastName employeeId')
      .populate('substituteTeacher', 'firstName lastName employeeId')
      .populate('requestedBy', 'name email')
      .populate('approvedBy', 'name email')
      .populate('timetable', 'name section')
      .sort({ createdAt: -1 });
  }
}
