import { Types } from 'mongoose';
import {
  Timetable,
  TimetableEntry,
  TimetableChange,
  Teacher,
  Student,
  DayOfWeek,
} from '../models';
import { ApiError } from '../utils/apiError';
import { timeToMinutes } from './timetableConflict.service';

const ALL_DAYS: DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const STANDARD_PERIODS = [1, 2, 3, 4, 5, 6, 7];

export class TimetableAccessService {
  /**
   * Get teacher's daily or weekly schedule with teaching hours and free periods
   */
  static async getTeacherSchedule(
    teacherUserIdOrId: string | Types.ObjectId,
    options: {
      date?: Date;
      dayOfWeek?: DayOfWeek;
      academicYear?: string;
      semester?: number;
    } = {}
  ) {
    // 1. Resolve Teacher
    let teacher = await Teacher.findOne({ user: teacherUserIdOrId });
    if (!teacher) {
      teacher = await Teacher.findById(teacherUserIdOrId);
    }
    if (!teacher) throw new ApiError(404, 'Teacher record not found');

    // 2. Query active published timetables
    const timetableFilter: Record<string, unknown> = {
      status: 'published',
    };
    if (options.academicYear) timetableFilter.academicYear = options.academicYear;
    if (options.semester) timetableFilter.semester = options.semester;

    const publishedTimetables = await Timetable.find(timetableFilter).select('_id');
    const publishedTimetableIds = publishedTimetables.map((t) => t._id);

    // 3. Find entries where teacher is lead or co-teacher
    const entryFilter: Record<string, unknown> = {
      timetable: { $in: publishedTimetableIds },
      $or: [{ teacher: teacher._id }, { additionalTeachers: teacher._id }],
      status: { $ne: 'cancelled' },
      isBreak: false,
    };
    if (options.dayOfWeek) entryFilter.dayOfWeek = options.dayOfWeek;

    const entries = await TimetableEntry.find(entryFilter)
      .populate('subject', 'name code')
      .populate('section', 'sectionName semester')
      .populate('timetable', 'name effectiveFrom effectiveTo')
      .sort({ dayOfWeek: 1, periodNumber: 1 });

    // 4. Incorporate approved TimetableChange records for the specific date if provided
    let effectiveEntries = entries.map((e) => e.toObject());

    if (options.date) {
      const targetDate = new Date(options.date);
      const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

      const changes = await TimetableChange.find({
        status: 'approved',
        effectiveDate: { $gte: startOfDay, $lte: endOfDay },
      })
        .populate('substituteTeacher', 'firstName lastName employeeId')
        .populate('entry');

      // Check if this teacher is substitute for any lecture today
      const substitutionForTeacher = changes.filter(
        (c) => c.substituteTeacher?._id?.toString() === teacher?._id.toString()
      );

      for (const sub of substitutionForTeacher) {
        if (sub.entry) {
          const subEntry = await TimetableEntry.findById(sub.entry._id)
            .populate('subject', 'name code')
            .populate('section', 'sectionName semester')
            .populate('timetable', 'name');

          if (subEntry) {
            const modifiedEntry = subEntry.toObject();
            modifiedEntry.status = 'substituted';
            (modifiedEntry as unknown as Record<string, unknown>).isSubstituteLecture = true;
            effectiveEntries.push(modifiedEntry);
          }
        }
      }

      // Check if any of teacher's regular lectures were cancelled or substituted
      effectiveEntries = effectiveEntries.filter((e) => {
        const matchingChange = changes.find(
          (c) => c.entry?._id?.toString() === e._id.toString()
        );
        if (matchingChange) {
          if (matchingChange.changeType === 'cancellation') {
            return false;
          }
          if (
            matchingChange.changeType === 'substitution' &&
            matchingChange.originalTeacher?.toString() === teacher?._id.toString()
          ) {
            return false; // Substituted by another teacher
          }
          if (matchingChange.changeType === 'classroom_change') {
            e.classroom = matchingChange.newClassroom || e.classroom;
          }
        }
        return true;
      });
    }

    // 5. Calculate Weekly Teaching Hours & Subject-wise breakdown
    let totalMinutes = 0;
    const subjectWiseMinutes: Record<string, { subjectName: string; minutes: number }> = {};

    for (const entry of effectiveEntries) {
      const dur = timeToMinutes(entry.endTime) - timeToMinutes(entry.startTime);
      if (dur > 0) {
        totalMinutes += dur;
        const subName = (entry.subject as { name?: string })?.name || 'Other';
        if (!subjectWiseMinutes[subName]) {
          subjectWiseMinutes[subName] = { subjectName: subName, minutes: 0 };
        }
        subjectWiseMinutes[subName].minutes += dur;
      }
    }

    const totalTeachingHours = Number((totalMinutes / 60).toFixed(2));
    const subjectWiseTeachingHours = Object.values(subjectWiseMinutes).map((s) => ({
      subjectName: s.subjectName,
      hours: Number((s.minutes / 60).toFixed(2)),
    }));

    // 6. Group schedule by day and compute free periods
    const scheduleByDay: Record<
      string,
      {
        lectures: typeof effectiveEntries;
        freePeriods: number[];
      }
    > = {};

    const targetDays = options.dayOfWeek ? [options.dayOfWeek] : ALL_DAYS;

    for (const day of targetDays) {
      const dayLectures = effectiveEntries
        .filter((e) => e.dayOfWeek === day)
        .sort((a, b) => a.periodNumber - b.periodNumber);

      const assignedPeriods = new Set(dayLectures.map((l) => l.periodNumber));
      const freePeriods = STANDARD_PERIODS.filter((p) => !assignedPeriods.has(p));

      scheduleByDay[day] = {
        lectures: dayLectures,
        freePeriods,
      };
    }

    return {
      teacher: {
        _id: teacher._id,
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        employeeId: teacher.employeeId,
        designation: teacher.designation,
      },
      scheduleByDay,
      summary: {
        totalLectures: effectiveEntries.length,
        totalTeachingHours,
        subjectWiseTeachingHours,
      },
    };
  }

  /**
   * Get teacher's today schedule
   */
  static async getTeacherToday(teacherUserIdOrId: string | Types.ObjectId) {
    const today = new Date();
    const dayNames: DayOfWeek[] = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];
    const dayOfWeek = dayNames[today.getDay()];

    return await this.getTeacherSchedule(teacherUserIdOrId, {
      date: today,
      dayOfWeek,
    });
  }

  /**
   * Get section-wise weekly or daily timetable (published only for non-admins)
   */
  static async getSectionSchedule(
    sectionId: string | Types.ObjectId,
    options: {
      date?: Date;
      dayOfWeek?: DayOfWeek;
      includeDraft?: boolean;
    } = {}
  ) {
    const statusQuery = options.includeDraft
      ? { $in: ['draft', 'published'] }
      : 'published';

    // Find active published timetable for section
    const timetable = await Timetable.findOne({
      section: sectionId,
      status: statusQuery,
    })
      .populate('academicYear', 'year')
      .populate('department', 'departmentName')
      .populate('class', 'className')
      .populate('section', 'sectionName semester');

    if (!timetable) {
      return {
        timetable: null,
        scheduleByDay: {},
        entries: [],
      };
    }

    const entryFilter: Record<string, unknown> = {
      timetable: timetable._id,
      status: { $ne: 'cancelled' },
    };
    if (options.dayOfWeek) entryFilter.dayOfWeek = options.dayOfWeek;

    const entries = await TimetableEntry.find(entryFilter)
      .populate('subject', 'name code')
      .populate('teacher', 'firstName lastName employeeId designation')
      .populate('additionalTeachers', 'firstName lastName employeeId')
      .sort({ dayOfWeek: 1, periodNumber: 1 });

    let effectiveEntries = entries.map((e) => e.toObject());

    // Apply temporary timetable changes for date if provided
    if (options.date) {
      const targetDate = new Date(options.date);
      const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

      const changes = await TimetableChange.find({
        timetable: timetable._id,
        status: 'approved',
        effectiveDate: { $gte: startOfDay, $lte: endOfDay },
      })
        .populate('substituteTeacher', 'firstName lastName employeeId designation')
        .populate('entry');

      for (const change of changes) {
        const entryIdx = effectiveEntries.findIndex(
          (e) => e._id.toString() === change.entry?._id?.toString()
        );

        const target = effectiveEntries[entryIdx];
        if (target) {
          if (change.changeType === 'cancellation') {
            target.status = 'cancelled';
          } else if (change.changeType === 'substitution') {
            target.status = 'substituted';
            if (change.substituteTeacher) {
              target.teacher = change.substituteTeacher;
            }
          } else if (change.changeType === 'classroom_change') {
            target.classroom = change.newClassroom || target.classroom;
          } else if (change.changeType === 'rescheduling') {
            target.status = 'rescheduled';
            target.startTime = change.newStartTime || target.startTime;
            target.endTime = change.newEndTime || target.endTime;
          }
        }
      }
    }

    const targetDays = options.dayOfWeek ? [options.dayOfWeek] : ALL_DAYS;
    const scheduleByDay: Record<string, typeof effectiveEntries> = {};

    for (const day of targetDays) {
      scheduleByDay[day] = effectiveEntries
        .filter((e) => e.dayOfWeek === day)
        .sort((a, b) => a.periodNumber - b.periodNumber);
    }

    return {
      timetable,
      scheduleByDay,
      entries: effectiveEntries,
    };
  }

  /**
   * Get student's timetable based on their enrolled section
   */
  static async getStudentSchedule(
    studentUserId: string | Types.ObjectId,
    options: { date?: Date; dayOfWeek?: DayOfWeek } = {}
  ) {
    const student = await Student.findOne({ user: studentUserId });
    if (!student) throw new ApiError(404, 'Student profile not found');
    if (!student.section) throw new ApiError(400, 'Student is not enrolled in any section');

    const result = await this.getSectionSchedule(student.section, {
      ...options,
      includeDraft: false, // Students NEVER see draft timetables
    });

    return {
      student: {
        _id: student._id,
        firstName: student.firstName,
        lastName: student.lastName,
        usn: student.usn,
        rollNumber: student.rollNumber,
      },
      ...result,
    };
  }

  /**
   * Get student's today schedule
   */
  static async getStudentToday(studentUserId: string | Types.ObjectId) {
    const today = new Date();
    const dayNames: DayOfWeek[] = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];
    const dayOfWeek = dayNames[today.getDay()];

    return await this.getStudentSchedule(studentUserId, {
      date: today,
      dayOfWeek,
    });
  }
}
