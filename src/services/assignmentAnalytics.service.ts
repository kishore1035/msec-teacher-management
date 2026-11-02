import { Types } from 'mongoose';
import { Assignment } from '../models/assignment.model';
import { AssignmentSubmission } from '../models/assignmentSubmission.model';
import { Student } from '../models/student.model';
import { Teacher } from '../models/teacher.model';
import { ROLES } from '../constants/roles.constant';

export interface AnalyticsFilterDTO {
  academicYear?: string;
  semester?: number;
  section?: string;
  subject?: string;
  assignment?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface OverviewAnalyticsResult {
  totalAssignments: number;
  publishedAssignments: number;
  closedAssignments: number;
  draftAssignments: number;
  totalExpectedSubmissions: number;
  totalSubmissions: number;
  pendingSubmissions: number;
  lateSubmissions: number;
  evaluatedSubmissions: number;
  averageMarks: number;
  completionRate: number;
}

export class AssignmentAnalyticsService {
  /**
   * Helper: Build assignment match filter based on role and query
   */
  private async buildAssignmentFilter(
    userId: string,
    role: string,
    filters: AnalyticsFilterDTO
  ): Promise<Record<string, any>> {
    const filter: Record<string, any> = {};

    if (role === ROLES.TEACHER) {
      const teacher = await Teacher.findOne({ user: userId });
      if (teacher) {
        filter.teacher = teacher._id;
      }
    } else if (role === ROLES.STUDENT) {
      const student = await Student.findOne({ user: userId });
      if (student) {
        filter.section = student.section;
        filter.status = { $in: ['published', 'closed'] };
      }
    }

    if (filters.academicYear) filter.academicYear = new Types.ObjectId(filters.academicYear);
    if (filters.semester) filter.semester = filters.semester;
    if (filters.section) filter.section = new Types.ObjectId(filters.section);
    if (filters.subject) filter.subject = new Types.ObjectId(filters.subject);
    if (filters.assignment) filter._id = new Types.ObjectId(filters.assignment);
    if (filters.startDate || filters.endDate) {
      filter.dueDate = {};
      if (filters.startDate) filter.dueDate.$gte = new Date(filters.startDate);
      if (filters.endDate) filter.dueDate.$lte = new Date(filters.endDate);
    }

    return filter;
  }

  /**
   * High-level institutional/class overview analytics
   */
  public async getOverviewAnalytics(
    userId: string,
    role: string,
    filters: AnalyticsFilterDTO
  ): Promise<OverviewAnalyticsResult> {
    const assignmentFilter = await this.buildAssignmentFilter(userId, role, filters);

    // 1. Get assignments
    const assignments = await Assignment.find(assignmentFilter).select(
      '_id status section totalMarks'
    );
    const assignmentIds = assignments.map((a) => a._id);
    const sectionIds = [...new Set(assignments.map((a) => a.section.toString()))].map(
      (s) => new Types.ObjectId(s)
    );

    const totalAssignments = assignments.length;
    const publishedAssignments = assignments.filter((a) => a.status === 'published').length;
    const closedAssignments = assignments.filter((a) => a.status === 'closed').length;
    const draftAssignments = assignments.filter((a) => a.status === 'draft').length;

    // 2. Count expected submissions (students enrolled in sections * assignments in those sections)
    let totalExpectedSubmissions = 0;
    if (sectionIds.length > 0) {
      const studentCountPerSection = await Student.aggregate([
        { $match: { section: { $in: sectionIds }, status: 'Active' } },
        { $group: { _id: '$section', count: { $sum: 1 } } },
      ]);

      const sectionCountMap = new Map<string, number>();
      for (const item of studentCountPerSection) {
        sectionCountMap.set(item._id.toString(), item.count);
      }

      for (const a of assignments) {
        if (a.status !== 'draft') {
          totalExpectedSubmissions += sectionCountMap.get(a.section.toString()) || 0;
        }
      }
    }

    // 3. Submissions metrics
    if (assignmentIds.length === 0) {
      return {
        totalAssignments: 0,
        publishedAssignments: 0,
        closedAssignments: 0,
        draftAssignments: 0,
        totalExpectedSubmissions: 0,
        totalSubmissions: 0,
        pendingSubmissions: 0,
        lateSubmissions: 0,
        evaluatedSubmissions: 0,
        averageMarks: 0,
        completionRate: 0,
      };
    }

    const submissionStats = await AssignmentSubmission.aggregate([
      { $match: { assignment: { $in: assignmentIds } } },
      {
        $group: {
          _id: null,
          totalSubmissions: { $sum: 1 },
          lateSubmissions: {
            $sum: { $cond: [{ $eq: ['$isLate', true] }, 1, 0] },
          },
          evaluatedSubmissions: {
            $sum: { $cond: [{ $eq: ['$evaluationStatus', 'evaluated'] }, 1, 0] },
          },
          averageMarks: {
            $avg: {
              $cond: [
                { $eq: ['$evaluationStatus', 'evaluated'] },
                '$marksObtained',
                null,
              ],
            },
          },
        },
      },
    ]);

    const stats = submissionStats[0] || {
      totalSubmissions: 0,
      lateSubmissions: 0,
      evaluatedSubmissions: 0,
      averageMarks: 0,
    };

    const totalSubmissions = stats.totalSubmissions;
    const pendingSubmissions = Math.max(0, totalExpectedSubmissions - totalSubmissions);
    const completionRate =
      totalExpectedSubmissions > 0
        ? Number(((totalSubmissions / totalExpectedSubmissions) * 100).toFixed(2))
        : 0;

    return {
      totalAssignments,
      publishedAssignments,
      closedAssignments,
      draftAssignments,
      totalExpectedSubmissions,
      totalSubmissions,
      pendingSubmissions,
      lateSubmissions: stats.lateSubmissions,
      evaluatedSubmissions: stats.evaluatedSubmissions,
      averageMarks: stats.averageMarks ? Number(stats.averageMarks.toFixed(2)) : 0,
      completionRate,
    };
  }

  /**
   * Class / Section-wise performance report
   */
  public async getClassAnalytics(
    userId: string,
    role: string,
    filters: AnalyticsFilterDTO
  ): Promise<any[]> {
    const assignmentFilter = await this.buildAssignmentFilter(userId, role, filters);

    return Assignment.aggregate([
      { $match: assignmentFilter },
      {
        $lookup: {
          from: 'assignmentsubmissions',
          localField: '_id',
          foreignField: 'assignment',
          as: 'submissions',
        },
      },
      {
        $lookup: {
          from: 'sections',
          localField: 'section',
          foreignField: '_id',
          as: 'sectionInfo',
        },
      },
      { $unwind: '$sectionInfo' },
      {
        $group: {
          _id: '$section',
          sectionName: { $first: '$sectionInfo.sectionName' },
          semester: { $first: '$sectionInfo.semester' },
          totalAssignments: { $sum: 1 },
          totalSubmissions: { $sum: { $size: '$submissions' } },
        },
      },
      { $sort: { semester: 1, sectionName: 1 } },
    ]);
  }

  /**
   * Subject-wise performance report
   */
  public async getSubjectAnalytics(
    userId: string,
    role: string,
    filters: AnalyticsFilterDTO
  ): Promise<any[]> {
    const assignmentFilter = await this.buildAssignmentFilter(userId, role, filters);

    return Assignment.aggregate([
      { $match: assignmentFilter },
      {
        $lookup: {
          from: 'assignmentsubmissions',
          localField: '_id',
          foreignField: 'assignment',
          as: 'submissions',
        },
      },
      {
        $lookup: {
          from: 'subjects',
          localField: 'subject',
          foreignField: '_id',
          as: 'subjectInfo',
        },
      },
      { $unwind: '$subjectInfo' },
      {
        $group: {
          _id: '$subject',
          subjectName: { $first: '$subjectInfo.name' },
          subjectCode: { $first: '$subjectInfo.code' },
          totalAssignments: { $sum: 1 },
          totalSubmissions: { $sum: { $size: '$submissions' } },
        },
      },
      { $sort: { subjectName: 1 } },
    ]);
  }

  /**
   * Student-wise performance & submission metrics
   */
  public async getStudentAnalytics(
    userId: string,
    role: string,
    studentId: string
  ): Promise<any> {
    const student = await Student.findById(studentId);
    if (!student) {
      throw new Error('Student not found');
    }

    if (role === ROLES.STUDENT) {
      if (student.user.toString() !== userId) {
        throw new Error('Access forbidden to other student metrics');
      }
    }

    const assignedCount = await Assignment.countDocuments({
      section: student.section,
      status: { $in: ['published', 'closed'] },
    });

    const submissions = await AssignmentSubmission.find({ student: student._id }).populate({
      path: 'assignment',
      select: 'title totalMarks passingMarks dueDate',
    });

    const totalSubmitted = submissions.length;
    const evaluated = submissions.filter((s) => s.evaluationStatus === 'evaluated');
    const late = submissions.filter((s) => s.isLate).length;

    let totalMarksObtained = 0;
    let totalPossibleMarks = 0;

    for (const sub of evaluated) {
      const assignment = sub.assignment as any;
      if (assignment && sub.marksObtained !== undefined) {
        totalMarksObtained += sub.marksObtained;
        totalPossibleMarks += assignment.totalMarks;
      }
    }

    const averagePercentage =
      totalPossibleMarks > 0
        ? Number(((totalMarksObtained / totalPossibleMarks) * 100).toFixed(2))
        : 0;

    return {
      student: {
        id: student._id,
        name: `${student.firstName} ${student.lastName}`,
        usn: student.usn,
        rollNumber: student.rollNumber,
      },
      totalAssigned: assignedCount,
      totalSubmitted,
      pendingSubmissions: Math.max(0, assignedCount - totalSubmitted),
      lateSubmissions: late,
      evaluatedSubmissions: evaluated.length,
      totalMarksObtained,
      totalPossibleMarks,
      averagePercentage,
    };
  }
}

export const assignmentAnalyticsService = new AssignmentAnalyticsService();
