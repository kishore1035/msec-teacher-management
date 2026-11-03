import { Types } from 'mongoose';
import {
  Timetable,
  TimetableEntry,
  TimetableConflictOverride,
} from '../models';
import { timeToMinutes } from './timetableConflict.service';

export class TimetableAnalyticsService {
  /**
   * Teacher workload analytics: weekly hours, lecture counts, workload distribution
   */
  static async getTeacherWorkloadAnalytics(filters: {
    academicYear?: string;
    semester?: number;
    department?: string;
  }) {
    // 1. Find relevant published timetables
    const timetableFilter: Record<string, unknown> = { status: 'published' };
    if (filters.academicYear) timetableFilter.academicYear = filters.academicYear;
    if (filters.semester) timetableFilter.semester = filters.semester;
    if (filters.department) timetableFilter.department = filters.department;

    const timetables = await Timetable.find(timetableFilter).select('_id');
    const timetableIds = timetables.map((t) => t._id);

    // 2. Fetch all active lecture entries
    const entries = await TimetableEntry.find({
      timetable: { $in: timetableIds },
      status: 'active',
      isBreak: false,
      teacher: { $exists: true, $ne: null },
    })
      .populate('teacher', 'firstName lastName employeeId department designation')
      .populate('subject', 'name code');

    // 3. Aggregate by teacher
    const teacherMap: Record<
      string,
      {
        teacherId: string;
        name: string;
        employeeId: string;
        designation: string;
        lectureCount: number;
        totalMinutes: number;
        subjectBreakdown: Record<string, number>;
      }
    > = {};

    for (const entry of entries) {
      if (!entry.teacher) continue;
      const t = entry.teacher as unknown as {
        _id: Types.ObjectId;
        firstName: string;
        lastName: string;
        employeeId: string;
        designation: string;
      };
      const tId = t._id.toString();

      if (!teacherMap[tId]) {
        teacherMap[tId] = {
          teacherId: tId,
          name: `${t.firstName} ${t.lastName}`,
          employeeId: t.employeeId,
          designation: t.designation || 'Lecturer',
          lectureCount: 0,
          totalMinutes: 0,
          subjectBreakdown: {},
        };
      }

      const dur = timeToMinutes(entry.endTime) - timeToMinutes(entry.startTime);
      teacherMap[tId].lectureCount += 1;
      teacherMap[tId].totalMinutes += dur > 0 ? dur : 55;

      const subName = (entry.subject as { name?: string })?.name || 'General';
      teacherMap[tId].subjectBreakdown[subName] =
        (teacherMap[tId].subjectBreakdown[subName] || 0) + 1;
    }

    const teacherWorkloads = Object.values(teacherMap).map((tw) => ({
      ...tw,
      totalWeeklyHours: Number((tw.totalMinutes / 60).toFixed(2)),
    }));

    // Sort by hours descending
    teacherWorkloads.sort((a, b) => b.totalWeeklyHours - a.totalWeeklyHours);

    const highestWorkload = teacherWorkloads[0] || null;
    const lowestWorkload =
      teacherWorkloads.length > 0 ? teacherWorkloads[teacherWorkloads.length - 1] : null;

    const totalHoursAll = teacherWorkloads.reduce((acc, t) => acc + t.totalWeeklyHours, 0);
    const averageWeeklyHours =
      teacherWorkloads.length > 0
        ? Number((totalHoursAll / teacherWorkloads.length).toFixed(2))
        : 0;

    return {
      totalTeachersEvaluated: teacherWorkloads.length,
      averageWeeklyHours,
      highestWorkload,
      lowestWorkload,
      teacherWorkloads,
    };
  }

  /**
   * Classroom & Laboratory utilization analytics
   */
  static async getClassroomUtilizationAnalytics(filters: {
    academicYear?: string;
    semester?: number;
    dayOfWeek?: string;
    periodNumber?: number;
  }) {
    const timetableFilter: Record<string, unknown> = { status: 'published' };
    if (filters.academicYear) timetableFilter.academicYear = filters.academicYear;
    if (filters.semester) timetableFilter.semester = filters.semester;

    const timetables = await Timetable.find(timetableFilter).select('_id');
    const timetableIds = timetables.map((t) => t._id);

    const entries = await TimetableEntry.find({
      timetable: { $in: timetableIds },
      status: 'active',
      isBreak: false,
    });

    const roomMap: Record<
      string,
      {
        classroom: string;
        isLab: boolean;
        lectureCount: number;
        totalMinutes: number;
      }
    > = {};

    for (const entry of entries) {
      const room = entry.classroom.trim();
      if (!room) continue;

      if (!roomMap[room]) {
        const isLab =
          entry.lectureType === 'lab' ||
          entry.lectureType === 'practical' ||
          room.toLowerCase().includes('lab');

        roomMap[room] = {
          classroom: room,
          isLab,
          lectureCount: 0,
          totalMinutes: 0,
        };
      }

      const dur = timeToMinutes(entry.endTime) - timeToMinutes(entry.startTime);
      roomMap[room].lectureCount += 1;
      roomMap[room].totalMinutes += dur > 0 ? dur : 55;
    }

    const standardWeekHours = 40; // 8 hrs x 5 days
    const roomUtilizations = Object.values(roomMap).map((r) => {
      const weeklyHours = Number((r.totalMinutes / 60).toFixed(2));
      const utilizationRate = Number(
        Math.min(100, (weeklyHours / standardWeekHours) * 100).toFixed(1)
      );
      return {
        classroom: r.classroom,
        isLab: r.isLab,
        lectureCount: r.lectureCount,
        weeklyHours,
        utilizationRate,
      };
    });

    // Check free classrooms if dayOfWeek and periodNumber are given
    let freeClassrooms: string[] = [];
    if (filters.dayOfWeek && filters.periodNumber) {
      const occupiedRooms = new Set(
        entries
          .filter(
            (e) =>
              e.dayOfWeek === filters.dayOfWeek &&
              e.periodNumber === filters.periodNumber
          )
          .map((e) => e.classroom.trim())
      );

      const allKnownRooms = Object.keys(roomMap);
      freeClassrooms = allKnownRooms.filter((r) => !occupiedRooms.has(r));
    }

    return {
      totalClassroomsTracked: roomUtilizations.length,
      roomUtilizations,
      freeClassroomsQuery:
        filters.dayOfWeek && filters.periodNumber
          ? {
              dayOfWeek: filters.dayOfWeek,
              periodNumber: filters.periodNumber,
              availableRooms: freeClassrooms,
            }
          : undefined,
    };
  }

  /**
   * Subject distribution analytics
   */
  static async getSubjectDistributionAnalytics(filters: {
    academicYear?: string;
    semester?: number;
    section?: string;
  }) {
    const timetableFilter: Record<string, unknown> = { status: 'published' };
    if (filters.academicYear) timetableFilter.academicYear = filters.academicYear;
    if (filters.semester) timetableFilter.semester = filters.semester;
    if (filters.section) timetableFilter.section = filters.section;

    const timetables = await Timetable.find(timetableFilter).select('_id');
    const timetableIds = timetables.map((t) => t._id);

    const entries = await TimetableEntry.find({
      timetable: { $in: timetableIds },
      status: 'active',
      isBreak: false,
      subject: { $exists: true, $ne: null },
    }).populate('subject', 'name code credits');

    const subjectMap: Record<
      string,
      {
        subjectId: string;
        subjectName: string;
        subjectCode: string;
        theoryLectures: number;
        practicalLectures: number;
        tutorialLectures: number;
        totalLectures: number;
        totalMinutes: number;
      }
    > = {};

    for (const entry of entries) {
      if (!entry.subject) continue;
      const s = entry.subject as unknown as {
        _id: Types.ObjectId;
        name: string;
        code: string;
      };
      const sId = s._id.toString();

      if (!subjectMap[sId]) {
        subjectMap[sId] = {
          subjectId: sId,
          subjectName: s.name,
          subjectCode: s.code,
          theoryLectures: 0,
          practicalLectures: 0,
          tutorialLectures: 0,
          totalLectures: 0,
          totalMinutes: 0,
        };
      }

      const dur = timeToMinutes(entry.endTime) - timeToMinutes(entry.startTime);
      subjectMap[sId].totalLectures += 1;
      subjectMap[sId].totalMinutes += dur > 0 ? dur : 55;

      if (entry.lectureType === 'theory') subjectMap[sId].theoryLectures += 1;
      else if (entry.lectureType === 'practical' || entry.lectureType === 'lab')
        subjectMap[sId].practicalLectures += 1;
      else if (entry.lectureType === 'tutorial') subjectMap[sId].tutorialLectures += 1;
    }

    const subjectDistribution = Object.values(subjectMap).map((sub) => ({
      ...sub,
      weeklyHours: Number((sub.totalMinutes / 60).toFixed(2)),
    }));

    return {
      totalSubjectsEvaluated: subjectDistribution.length,
      subjectDistribution,
    };
  }

  /**
   * Conflict and audit logs report
   */
  static async getConflictReport(filters: { timetableId?: string }) {
    const overrides = await TimetableConflictOverride.find(filters)
      .populate('overriddenBy', 'name email role')
      .populate('timetable', 'name section status')
      .sort({ createdAt: -1 });

    return {
      totalOverridesLogged: overrides.length,
      overrides,
    };
  }
}
