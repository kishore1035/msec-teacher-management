import { Types } from 'mongoose';
import {
  Teacher,
  Department,
  Timetable,
  TimetableEntry,
  TeacherAssignment,
  TeacherLeave,
  Substitution,
} from '../models';
import { ApiError } from '../utils/apiError';
import { ROLES } from '../constants/roles.constant';
import { timeToMinutes } from './timetableConflict.service';
import { IActorUser } from './teacherManagement.service';

export interface IWorkloadAnalyticsQuery {
  academicYear?: string;
  semester?: number;
  department?: string;
  teacher?: string;
  startDate?: string;
  endDate?: string;
}

const extractId = (ref: unknown): string => {
  if (!ref) return '';
  if (typeof ref === 'object' && ref !== null && '_id' in ref) {
    return String((ref as { _id: unknown })._id);
  }
  return String(ref);
};

export class TeacherWorkloadAnalyticsService {
  /**
   * 1. Teacher-wise workload analytics
   */
  static async getTeacherWorkloadAnalytics(
    query: IWorkloadAnalyticsQuery,
    actor: IActorUser
  ) {
    const teacherFilter: Record<string, unknown> = {};
    const isAdmin = actor.role === ROLES.SUPER_ADMIN || actor.role === ROLES.ADMIN;

    if (!isAdmin) {
      const ownTeacher = await Teacher.findOne({ user: actor.id });
      if (!ownTeacher) {
        throw ApiError.notFound('Teacher profile not found');
      }
      if (query.teacher && query.teacher !== ownTeacher._id.toString()) {
        throw ApiError.forbidden('Teachers can only view their own workload analytics');
      }
      teacherFilter._id = ownTeacher._id;
    } else {
      if (query.teacher) teacherFilter._id = new Types.ObjectId(query.teacher);
      if (query.department) teacherFilter.department = new Types.ObjectId(query.department);
    }

    const teachers = await Teacher.find(teacherFilter)
      .populate('department', 'name code')
      .sort({ firstName: 1, lastName: 1 });

    const teacherIds = teachers.map((t) => t._id);

    const timetableFilter: Record<string, unknown> = { status: 'published' };
    if (query.academicYear) timetableFilter.academicYear = query.academicYear;
    if (query.semester) timetableFilter.semester = query.semester;

    const publishedTimetables = await Timetable.find(timetableFilter).select('_id');
    const timetableIds = publishedTimetables.map((t) => t._id);

    const dateFilter: Record<string, Date> = {};
    if (query.startDate) dateFilter.$gte = new Date(query.startDate);
    if (query.endDate) dateFilter.$lte = new Date(query.endDate);

    const [entries, assignments, leaves, substitutions] = await Promise.all([
      TimetableEntry.find({
        timetable: { $in: timetableIds },
        $or: [
          { teacher: { $in: teacherIds } },
          { additionalTeachers: { $in: teacherIds } },
        ],
        status: { $ne: 'cancelled' },
        isBreak: false,
      }),
      TeacherAssignment.find({
        teacher: { $in: teacherIds },
        status: 'Active',
        ...(query.academicYear ? { academicYear: query.academicYear } : {}),
        ...(query.semester ? { semester: query.semester } : {}),
      }),
      TeacherLeave.find({
        teacher: { $in: teacherIds },
        status: 'approved',
        ...(query.startDate ? { endDate: { $gte: new Date(query.startDate) } } : {}),
        ...(query.endDate ? { startDate: { $lte: new Date(query.endDate) } } : {}),
      }),
      Substitution.find({
        $or: [
          { substituteTeacher: { $in: teacherIds } },
          { absentTeacher: { $in: teacherIds } },
        ],
        status: { $in: ['proposed', 'approved', 'completed'] },
        ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
      }),
    ]);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const teacherWorkloads = teachers.map((t) => {
      const tid = t._id.toString();

      const tEntries = entries.filter(
        (e) =>
          extractId(e.teacher) === tid ||
          (e.additionalTeachers || []).some((add) => extractId(add) === tid)
      );

      let weeklyMinutes = 0;
      for (const e of tEntries) {
        const dur = timeToMinutes(e.endTime) - timeToMinutes(e.startTime);
        if (dur > 0) weeklyMinutes += dur;
      }

      const weeklyTeachingHours = Number((weeklyMinutes / 60).toFixed(2));
      const maxWeeklyHours = t.maxWeeklyHours || 24;
      const utilizationPercentage = Number(
        Math.min(100, (weeklyTeachingHours / maxWeeklyHours) * 100).toFixed(2)
      );

      const tAssignments = assignments.filter((a) => extractId(a.teacher) === tid);
      const uniqueSubjects = new Set(tAssignments.map((a) => extractId(a.subject)));
      const uniqueSections = new Set(tAssignments.map((a) => extractId(a.section)));

      const tLeaves = leaves.filter((l) => extractId(l.teacher) === tid);
      const approvedLeaveDays = tLeaves.reduce((sum, l) => sum + (l.totalDays || 1), 0);

      const completedSubstitutions = substitutions.filter(
        (s) => extractId(s.substituteTeacher) === tid && s.status === 'completed'
      ).length;

      const upcomingSubstitutions = substitutions.filter(
        (s) =>
          extractId(s.substituteTeacher) === tid &&
          (s.status === 'approved' || s.status === 'proposed') &&
          new Date(s.date) >= todayStart
      ).length;

      const substitutionsTakenTotal = substitutions.filter(
        (s) =>
          extractId(s.substituteTeacher) === tid &&
          (s.status === 'approved' || s.status === 'completed')
      ).length;

      return {
        teacher: {
          _id: t._id,
          employeeId: t.employeeId,
          firstName: t.firstName,
          lastName: t.lastName,
          designation: t.designation,
          department: t.department,
          status: t.status,
        },
        weeklyTeachingPeriods: tEntries.length,
        weeklyTeachingHours,
        maxWeeklyHours,
        utilizationPercentage,
        assignedSubjectsCount: uniqueSubjects.size,
        assignedSectionsCount: uniqueSections.size,
        substitutionsTakenTotal,
        completedSubstitutions,
        upcomingSubstitutions,
        approvedLeaveDays,
      };
    });

    const totalTeachers = teacherWorkloads.length;
    const averageWeeklyHours =
      totalTeachers > 0
        ? Number(
            (
              teacherWorkloads.reduce((sum, tw) => sum + tw.weeklyTeachingHours, 0) /
              totalTeachers
            ).toFixed(2)
          )
        : 0;

    return {
      summary: {
        totalTeachers,
        averageWeeklyHours,
        totalWeeklyPeriods: teacherWorkloads.reduce(
          (sum, tw) => sum + tw.weeklyTeachingPeriods,
          0
        ),
      },
      teachers: teacherWorkloads,
    };
  }

  /**
   * 2. Department-wise workload distribution analytics
   */
  static async getDepartmentWorkloadAnalytics(query: IWorkloadAnalyticsQuery) {
    const deptFilter: Record<string, unknown> = {};
    if (query.department) deptFilter._id = new Types.ObjectId(query.department);

    const departments = await Department.find(deptFilter).sort({ name: 1 });
    const workloadData = await this.getTeacherWorkloadAnalytics(query, {
      id: '',
      role: ROLES.SUPER_ADMIN,
    });

    const departmentDistribution = departments.map((dept) => {
      const deptId = dept._id.toString();
      const deptTeachers = workloadData.teachers.filter(
        (tw) => extractId(tw.teacher.department) === deptId
      );

      const teacherCount = deptTeachers.length;
      const totalWeeklyPeriods = deptTeachers.reduce(
        (sum, tw) => sum + tw.weeklyTeachingPeriods,
        0
      );
      const totalWeeklyHours = Number(
        deptTeachers.reduce((sum, tw) => sum + tw.weeklyTeachingHours, 0).toFixed(2)
      );
      const averageWeeklyHoursPerTeacher =
        teacherCount > 0 ? Number((totalWeeklyHours / teacherCount).toFixed(2)) : 0;
      const totalLeaveDays = deptTeachers.reduce((sum, tw) => sum + tw.approvedLeaveDays, 0);
      const totalSubstitutionsHandled = deptTeachers.reduce(
        (sum, tw) => sum + tw.substitutionsTakenTotal,
        0
      );

      return {
        department: {
          _id: dept._id,
          name: dept.name,
          code: dept.code,
        },
        teacherCount,
        totalWeeklyPeriods,
        totalWeeklyHours,
        averageWeeklyHoursPerTeacher,
        totalLeaveDays,
        totalSubstitutionsHandled,
      };
    });

    return {
      totalDepartments: departmentDistribution.length,
      departments: departmentDistribution,
    };
  }

  /**
   * 3. Leave summary analytics
   */
  static async getLeaveSummaryAnalytics(query: IWorkloadAnalyticsQuery) {
    const filter: Record<string, unknown> = {};

    if (query.teacher) {
      filter.teacher = new Types.ObjectId(query.teacher);
    } else if (query.department) {
      const deptTeachers = await Teacher.find({ department: query.department }).select('_id');
      filter.teacher = { $in: deptTeachers.map((t) => t._id) };
    }

    if (query.academicYear) filter.academicYear = new Types.ObjectId(query.academicYear);
    if (query.startDate) filter.endDate = { $gte: new Date(query.startDate) };
    if (query.endDate) filter.startDate = { $lte: new Date(query.endDate) };

    const leaves = await TeacherLeave.find(filter).populate({
      path: 'teacher',
      select: 'firstName lastName employeeId department',
      populate: { path: 'department', select: 'name code' },
    });

    const byStatus: Record<string, { count: number; totalDays: number }> = {
      pending: { count: 0, totalDays: 0 },
      approved: { count: 0, totalDays: 0 },
      rejected: { count: 0, totalDays: 0 },
      cancelled: { count: 0, totalDays: 0 },
    };

    const byLeaveType: Record<
      string,
      { leaveType: string; totalRequests: number; approvedDays: number; pendingDays: number }
    > = {};

    for (const l of leaves) {
      const days = l.totalDays || 1;
      const st = l.status || 'pending';
      if (!byStatus[st]) {
        byStatus[st] = { count: 0, totalDays: 0 };
      }
      byStatus[st].count += 1;
      byStatus[st].totalDays += days;

      const lt = (l.leaveType || 'casual').toLowerCase();
      if (!byLeaveType[lt]) {
        byLeaveType[lt] = {
          leaveType: lt,
          totalRequests: 0,
          approvedDays: 0,
          pendingDays: 0,
        };
      }
      byLeaveType[lt].totalRequests += 1;
      if (st === 'approved') byLeaveType[lt].approvedDays += days;
      if (st === 'pending') byLeaveType[lt].pendingDays += days;
    }

    return {
      totalLeaveRequests: leaves.length,
      totalApprovedDays: byStatus.approved?.totalDays || 0,
      byStatus,
      byLeaveType: Object.values(byLeaveType),
    };
  }

  /**
   * 4. Substitution summary analytics
   */
  static async getSubstitutionSummaryAnalytics(query: IWorkloadAnalyticsQuery) {
    const filter: Record<string, unknown> = {};

    if (query.teacher) {
      const tid = new Types.ObjectId(query.teacher);
      filter.$or = [{ substituteTeacher: tid }, { absentTeacher: tid }];
    } else if (query.department) {
      const deptTeachers = await Teacher.find({ department: query.department }).select('_id');
      const ids = deptTeachers.map((t) => t._id);
      filter.$or = [{ substituteTeacher: { $in: ids } }, { absentTeacher: { $in: ids } }];
    }

    if (query.startDate || query.endDate) {
      const dateRange: Record<string, Date> = {};
      if (query.startDate) dateRange.$gte = new Date(query.startDate);
      if (query.endDate) dateRange.$lte = new Date(query.endDate);
      filter.date = dateRange;
    }

    const substitutions = await Substitution.find(filter)
      .populate('substituteTeacher', 'firstName lastName employeeId')
      .populate('absentTeacher', 'firstName lastName employeeId')
      .populate('subject', 'name code');

    const byStatus: Record<string, number> = {
      proposed: 0,
      approved: 0,
      rejected: 0,
      completed: 0,
      cancelled: 0,
    };

    const topSubstituteMap: Record<
      string,
      {
        teacherId: string;
        name: string;
        employeeId: string;
        assignedCount: number;
        completedCount: number;
      }
    > = {};

    for (const s of substitutions) {
      byStatus[s.status] = (byStatus[s.status] || 0) + 1;

      if (s.status === 'approved' || s.status === 'completed') {
        const subDoc = s.substituteTeacher as unknown as {
          _id: Types.ObjectId;
          firstName?: string;
          lastName?: string;
          employeeId?: string;
        };
        if (subDoc?._id) {
          const tid = subDoc._id.toString();
          if (!topSubstituteMap[tid]) {
            topSubstituteMap[tid] = {
              teacherId: tid,
              name: `${subDoc.firstName || ''} ${subDoc.lastName || ''}`.trim(),
              employeeId: subDoc.employeeId || '',
              assignedCount: 0,
              completedCount: 0,
            };
          }
          topSubstituteMap[tid].assignedCount += 1;
          if (s.status === 'completed') {
            topSubstituteMap[tid].completedCount += 1;
          }
        }
      }
    }

    const topSubstituteTeachers = Object.values(topSubstituteMap).sort(
      (a, b) => b.assignedCount - a.assignedCount
    );

    return {
      totalSubstitutions: substitutions.length,
      byStatus,
      topSubstituteTeachers,
    };
  }
}
