import { Types } from 'mongoose';
import {
  ReportJob,
  IReportJob,
  ReportJobType,
  ReportExportFormat,
  IReportJobFilters,
} from '../models/reportJob.model';
import { Teacher } from '../models/teacher.model';
import { Student } from '../models/student.model';
import { Parent } from '../models/parent.model';
import { Section } from '../models/section.model';
import { TeacherAssignment } from '../models/teacherAssignment.model';
import { AttendanceSession } from '../models/attendanceSession.model';
import { AttendanceRecord } from '../models/attendanceRecord.model';
import { AttendancePolicy } from '../models/attendancePolicy.model';
import { Assignment } from '../models/assignment.model';
import { AssignmentSubmission } from '../models/assignmentSubmission.model';
import { ExaminationResult } from '../models/examinationResult.model';
import { StudentProgress } from '../models/studentProgress.model';
import { TeacherLeave } from '../models/teacherLeave.model';
import { Substitution } from '../models/substitution.model';
import { TimetableEntry } from '../models/timetableEntry.model';
import { storageService } from './storage.service';
import { env } from '../config/env.config';
import { ApiError } from '../utils/apiError';
import { HTTP_STATUS } from '../constants/statusCodes';

export interface ReportRequester {
  id: string;
  role: string;
}

export class CentralReportAnalyticsService {
  private static normalizeRole(role: string): 'admin' | 'teacher' | 'student' | 'parent' {
    const r = (role || '').toLowerCase().trim();
    if (r === 'admin' || r === 'super admin' || r === 'super_admin') return 'admin';
    if (r === 'teacher') return 'teacher';
    if (r === 'student') return 'student';
    if (r === 'parent') return 'parent';
    return r as any;
  }

  /**
   * Resolves role-scoped constraints for analytics and report queries.
   */
  public static async resolveScopeConstraints(
    user: ReportRequester,
    filters: IReportJobFilters = {}
  ): Promise<{
    allowedSectionIds?: Types.ObjectId[];
    allowedSubjectIds?: Types.ObjectId[];
    allowedStudentIds?: Types.ObjectId[];
    teacherId?: Types.ObjectId;
  }> {
    const normRole = this.normalizeRole(user.role);
    if (normRole === 'admin') {
      return {};
    }

    if (normRole === 'teacher') {
      const teacher = await Teacher.findOne({ user: new Types.ObjectId(user.id) }).lean();
      if (!teacher) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Teacher profile not found');
      }

      const assignments = await TeacherAssignment.find({
        teacher: teacher._id,
        status: 'Active',
      }).lean();

      const classTeacherSections = await Section.find({
        classTeacher: teacher._id,
      })
        .select('_id')
        .lean();

      const allowedSectionIds = Array.from(
        new Set([
          ...assignments.map((a) => a.section.toString()),
          ...classTeacherSections.map((s) => s._id.toString()),
          ...(((teacher as any).classesAssigned || []) as any[]).map((id: any) => id.toString()),
        ])
      ).map((id) => new Types.ObjectId(id));

      const allowedSubjectIds = Array.from(
        new Set([
          ...assignments.map((a) => a.subject.toString()),
          ...(((teacher as any).subjectsAssigned || []) as any[]).map((id: any) => id.toString()),
        ])
      ).map((id) => new Types.ObjectId(id));

      if (
        filters.section &&
        allowedSectionIds.length > 0 &&
        !allowedSectionIds.some((id) => id.toString() === filters.section)
      ) {
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          'You are not authorized to access analytics or reports for an unassigned section'
        );
      }

      if (
        filters.subject &&
        allowedSubjectIds.length > 0 &&
        !allowedSubjectIds.some((id) => id.toString() === filters.subject)
      ) {
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          'You are not authorized to access analytics or reports for an unassigned subject'
        );
      }

      if (filters.teacher && filters.teacher !== teacher._id.toString()) {
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          'Teachers can only view workload or leave reports for their own profile'
        );
      }

      return {
        allowedSectionIds,
        allowedSubjectIds,
        teacherId: teacher._id as Types.ObjectId,
      };
    }

    if (normRole === 'student') {
      const student = await Student.findOne({ user: new Types.ObjectId(user.id) }).lean();
      if (!student) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Student profile not found');
      }

      if (filters.student && filters.student !== student._id.toString()) {
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          'Students can only access their own academic reports and analytics'
        );
      }

      return {
        allowedStudentIds: [student._id as Types.ObjectId],
        allowedSectionIds: student.section ? [student.section as Types.ObjectId] : [],
      };
    }

    if (normRole === 'parent') {
      const parent = await Parent.findOne({
        user: new Types.ObjectId(user.id),
      }).lean();
      if (!parent) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Parent profile not found');
      }

      const linkedStudentIds = (parent.students || []).map((id: any) => new Types.ObjectId(id));
      if (
        filters.student &&
        !linkedStudentIds.some((id) => id.toString() === filters.student)
      ) {
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          'Parents can only access academic reports and analytics for their verified linked children'
        );
      }

      return {
        allowedStudentIds: filters.student
          ? [new Types.ObjectId(filters.student)]
          : linkedStudentIds,
      };
    }

    throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Unauthorized role');
  }

  /**
   * 1. Centralized Overview Analytics (`GET /api/v1/analytics/overview`)
   */
  public static async getOverviewAnalytics(
    user: ReportRequester,
    filters: IReportJobFilters = {}
  ): Promise<Record<string, any>> {
    const [attendance, assignments, examinations, progress] = await Promise.all([
      this.getAttendanceAnalytics(user, filters),
      this.getAssignmentsAnalytics(user, filters),
      this.getExaminationsAnalytics(user, filters),
      this.getStudentProgressAnalytics(user, filters),
    ]);

    return {
      filtersApplied: filters,
      attendanceSummary: attendance.summary,
      assignmentsSummary: assignments.summary,
      examinationsSummary: examinations.summary,
      studentProgressSummary: progress.summary,
    };
  }

  /**
   * 2. Attendance Analytics (`GET /api/v1/analytics/attendance`)
   */
  public static async getAttendanceAnalytics(
    user: ReportRequester,
    filters: IReportJobFilters = {}
  ): Promise<Record<string, any>> {
    const scope = await this.resolveScopeConstraints(user, filters);
    const policy =
      (await AttendancePolicy.findOne({ isActive: true }).lean()) || {
        minimumPercentage: 75,
        warningThreshold: 85,
      };
    const threshold = (policy as any).minimumPercentage || 75;
    const warningThreshold = (policy as any).warningThreshold || 85;

    const normRole = this.normalizeRole(user.role);
    const sessionFilter: Record<string, any> = { status: { $nin: ['Cancelled', 'cancelled'] } };
    if (filters.academicYear) sessionFilter.academicYear = new Types.ObjectId(filters.academicYear);
    if (filters.semester) sessionFilter.semester = Number(filters.semester);
    if (filters.section) {
      sessionFilter.section = new Types.ObjectId(filters.section);
    } else if (scope.allowedSectionIds && scope.allowedSectionIds.length > 0 && normRole === 'teacher') {
      sessionFilter.section = { $in: scope.allowedSectionIds };
    }
    if (filters.subject) {
      sessionFilter.subject = new Types.ObjectId(filters.subject);
    } else if (scope.allowedSubjectIds && scope.allowedSubjectIds.length > 0 && normRole === 'teacher') {
      sessionFilter.subject = { $in: scope.allowedSubjectIds };
    }
    if (filters.startDate || filters.endDate) {
      sessionFilter.date = {};
      if (filters.startDate) sessionFilter.date.$gte = new Date(filters.startDate);
      if (filters.endDate) sessionFilter.date.$lte = new Date(filters.endDate);
    }

    const sessions = await AttendanceSession.find(sessionFilter)
      .populate('section', 'name semester')
      .populate('subject', 'name code')
      .lean();
    const sessionIds = sessions.map((s) => s._id);

    const recordFilter: Record<string, any> = {
      session: { $in: sessionIds },
    };
    if (filters.student) {
      recordFilter.student = new Types.ObjectId(filters.student);
    } else if (scope.allowedStudentIds) {
      recordFilter.student = { $in: scope.allowedStudentIds };
    }

    const records = await AttendanceRecord.find(recordFilter)
      .populate('student', 'rollNumber usn semester section')
      .populate({
        path: 'session',
        select: 'date subject section status',
        populate: [
          { path: 'subject', select: 'name code' },
          { path: 'section', select: 'name semester' },
        ],
      })
      .lean();

    // Group by student
    const studentMap = new Map<
      string,
      {
        studentId: string;
        rollNumber: string;
        usn: string;
        totalSessions: number;
        presentSessions: number;
        lateSessions: number;
        absentSessions: number;
        excusedSessions: number;
      }
    >();

    // Group by subject
    const subjectMap = new Map<
      string,
      { subjectId: string; subjectName: string; subjectCode: string; totalRecords: number; presentCount: number }
    >();

    // Group by section
    const sectionMap = new Map<
      string,
      { sectionId: string; sectionName: string; totalRecords: number; presentCount: number }
    >();

    for (const r of records as any[]) {
      if (!r.student || !r.session) continue;
      const stId = r.student._id.toString();
      if (!studentMap.has(stId)) {
        studentMap.set(stId, {
          studentId: stId,
          rollNumber: r.student.rollNumber || '',
          usn: r.student.usn || '',
          totalSessions: 0,
          presentSessions: 0,
          lateSessions: 0,
          absentSessions: 0,
          excusedSessions: 0,
        });
      }
      const stEntry = studentMap.get(stId)!;
      const status = (r.status || '').toLowerCase();

      if (status === 'present') {
        stEntry.totalSessions += 1;
        stEntry.presentSessions += 1;
      } else if (status === 'late') {
        stEntry.totalSessions += 1;
        stEntry.lateSessions += 1;
      } else if (status === 'excused') {
        stEntry.excusedSessions += 1;
      } else {
        stEntry.totalSessions += 1;
        stEntry.absentSessions += 1;
      }

      const subj = r.session.subject;
      if (subj) {
        const subjId = subj._id.toString();
        if (!subjectMap.has(subjId)) {
          subjectMap.set(subjId, {
            subjectId: subjId,
            subjectName: subj.name || '',
            subjectCode: subj.code || '',
            totalRecords: 0,
            presentCount: 0,
          });
        }
        const sEntry = subjectMap.get(subjId)!;
        if (status !== 'excused') {
          sEntry.totalRecords += 1;
          if (status === 'present' || status === 'late') sEntry.presentCount += 1;
        }
      }

      const sec = r.session.section;
      if (sec) {
        const secId = sec._id.toString();
        if (!sectionMap.has(secId)) {
          sectionMap.set(secId, {
            sectionId: secId,
            sectionName: sec.name || '',
            totalRecords: 0,
            presentCount: 0,
          });
        }
        const secEntry = sectionMap.get(secId)!;
        if (status !== 'excused') {
          secEntry.totalRecords += 1;
          if (status === 'present' || status === 'late') secEntry.presentCount += 1;
        }
      }
    }

    const studentAttendanceHistory = Array.from(studentMap.values()).map((st) => {
      const attended = st.presentSessions + st.lateSessions;
      const percentage =
        st.totalSessions > 0 ? Number(((attended / st.totalSessions) * 100).toFixed(2)) : 100;
      return {
        ...st,
        attendancePercentage: percentage,
        status:
          percentage < threshold
            ? 'shortage'
            : percentage <= warningThreshold
            ? 'warning'
            : 'good',
      };
    });

    const shortageList = studentAttendanceHistory.filter((s) => s.status === 'shortage');
    const overallAveragePercentage =
      studentAttendanceHistory.length > 0
        ? Number(
            (
              studentAttendanceHistory.reduce((acc, cur) => acc + cur.attendancePercentage, 0) /
              studentAttendanceHistory.length
            ).toFixed(2)
          )
        : 100;

    return {
      summary: {
        totalSessionsAnalyzed: sessions.length,
        totalStudentsAnalyzed: studentAttendanceHistory.length,
        overallAveragePercentage,
        shortageThreshold: threshold,
        shortageCount: shortageList.length,
      },
      sectionAttendanceReport: Array.from(sectionMap.values()).map((sec) => ({
        ...sec,
        averageAttendancePercentage:
          sec.totalRecords > 0
            ? Number(((sec.presentCount / sec.totalRecords) * 100).toFixed(2))
            : 100,
      })),
      subjectAttendanceReport: Array.from(subjectMap.values()).map((sub) => ({
        ...sub,
        averageAttendancePercentage:
          sub.totalRecords > 0
            ? Number(((sub.presentCount / sub.totalRecords) * 100).toFixed(2))
            : 100,
      })),
      studentAttendanceHistory,
      shortageList,
    };
  }

  /**
   * 3. Assignments Analytics (`GET /api/v1/analytics/assignments`)
   */
  public static async getAssignmentsAnalytics(
    user: ReportRequester,
    filters: IReportJobFilters = {}
  ): Promise<Record<string, any>> {
    const scope = await this.resolveScopeConstraints(user, filters);

    const assignmentFilter: Record<string, any> = {
      status: { $in: ['published', 'closed'] },
    };
    if (filters.academicYear) assignmentFilter.academicYear = new Types.ObjectId(filters.academicYear);
    if (filters.semester) assignmentFilter.semester = Number(filters.semester);
    const normRole = this.normalizeRole(user.role);
    if (filters.section) {
      assignmentFilter.section = new Types.ObjectId(filters.section);
    } else if (scope.allowedSectionIds && scope.allowedSectionIds.length > 0) {
      assignmentFilter.section = { $in: scope.allowedSectionIds };
    }
    if (filters.subject) {
      assignmentFilter.subject = new Types.ObjectId(filters.subject);
    } else if (scope.allowedSubjectIds && scope.allowedSubjectIds.length > 0 && normRole === 'teacher') {
      assignmentFilter.subject = { $in: scope.allowedSubjectIds };
    }

    const assignments = await Assignment.find(assignmentFilter)
      .populate('subject', 'name code')
      .populate('section', 'name semester')
      .lean();
    const assignmentIds = assignments.map((a) => a._id);

    const submissionFilter: Record<string, any> = {
      assignment: { $in: assignmentIds },
    };
    if (filters.student) {
      submissionFilter.student = new Types.ObjectId(filters.student);
    } else if (scope.allowedStudentIds) {
      submissionFilter.student = { $in: scope.allowedStudentIds };
    }

    const submissions = await AssignmentSubmission.find(submissionFilter)
      .populate('student', 'rollNumber usn')
      .populate({
        path: 'assignment',
        select: 'title totalMarks passingMarks dueDate subject section',
        populate: { path: 'subject', select: 'name code' },
      })
      .lean();

    const evaluatedSubmissions = submissions.filter(
      (s: any) => s.status === 'evaluated' && typeof s.marksObtained === 'number'
    );
    const lateSubmissions = submissions.filter((s: any) => s.isLate === true);

    const subjectPerformanceMap = new Map<
      string,
      {
        subjectId: string;
        subjectName: string;
        subjectCode: string;
        submissionsCount: number;
        evaluatedCount: number;
        totalPercentageSum: number;
      }
    >();

    for (const sub of submissions as any[]) {
      const asg = sub.assignment;
      if (!asg || !asg.subject) continue;
      const subjId = asg.subject._id.toString();
      if (!subjectPerformanceMap.has(subjId)) {
        subjectPerformanceMap.set(subjId, {
          subjectId: subjId,
          subjectName: asg.subject.name || '',
          subjectCode: asg.subject.code || '',
          submissionsCount: 0,
          evaluatedCount: 0,
          totalPercentageSum: 0,
        });
      }
      const entry = subjectPerformanceMap.get(subjId)!;
      entry.submissionsCount += 1;
      if (sub.status === 'evaluated' && typeof sub.marksObtained === 'number' && asg.totalMarks > 0) {
        entry.evaluatedCount += 1;
        entry.totalPercentageSum += (sub.marksObtained / asg.totalMarks) * 100;
      }
    }

    const avgScorePercentage =
      evaluatedSubmissions.length > 0
        ? Number(
            (
              evaluatedSubmissions.reduce((acc, cur: any) => {
                const maxM = cur.assignment?.totalMarks || 100;
                return acc + ((cur.marksObtained || 0) / maxM) * 100;
              }, 0) / evaluatedSubmissions.length
            ).toFixed(2)
          )
        : 0;

    return {
      summary: {
        totalAssignments: assignments.length,
        totalSubmissions: submissions.length,
        evaluatedSubmissions: evaluatedSubmissions.length,
        pendingEvaluations: submissions.length - evaluatedSubmissions.length,
        lateSubmissionsCount: lateSubmissions.length,
        averageScorePercentage: avgScorePercentage,
      },
      subjectWisePerformance: Array.from(subjectPerformanceMap.values()).map((s) => ({
        subjectId: s.subjectId,
        subjectName: s.subjectName,
        subjectCode: s.subjectCode,
        submissionsCount: s.submissionsCount,
        evaluatedCount: s.evaluatedCount,
        averagePercentage:
          s.evaluatedCount > 0 ? Number((s.totalPercentageSum / s.evaluatedCount).toFixed(2)) : 0,
      })),
      lateAndMissingReport: {
        lateSubmissions: lateSubmissions.map((l: any) => ({
          submissionId: l._id,
          studentRollNumber: l.student?.rollNumber,
          assignmentTitle: l.assignment?.title,
          submittedAt: l.submittedAt,
          status: l.status,
        })),
      },
      submissionsList: submissions.map((s: any) => ({
        submissionId: s._id,
        assignmentTitle: s.assignment?.title,
        subjectCode: s.assignment?.subject?.code,
        studentRollNumber: s.student?.rollNumber,
        status: s.status,
        isLate: s.isLate,
        marksObtained: s.marksObtained ?? null,
        totalMarks: s.assignment?.totalMarks ?? null,
      })),
    };
  }

  /**
   * 4. Examinations Analytics (`GET /api/v1/analytics/examinations`)
   */
  public static async getExaminationsAnalytics(
    user: ReportRequester,
    filters: IReportJobFilters = {}
  ): Promise<Record<string, any>> {
    const scope = await this.resolveScopeConstraints(user, filters);

    const normRole = this.normalizeRole(user.role);
    const resultFilter: Record<string, any> = {};
    // Students and parents can ONLY see published examination results
    if (normRole === 'student' || normRole === 'parent') {
      resultFilter.evaluationStatus = 'published';
    }
    if (filters.section) {
      const sectionStudents = await Student.find({
        section: new Types.ObjectId(filters.section),
      })
        .select('_id')
        .lean();
      resultFilter.student = { $in: sectionStudents.map((s) => s._id) };
    } else if (scope.allowedSectionIds && scope.allowedSectionIds.length > 0 && normRole === 'teacher') {
      const sectionStudents = await Student.find({ section: { $in: scope.allowedSectionIds } })
        .select('_id')
        .lean();
      resultFilter.student = { $in: sectionStudents.map((s) => s._id) };
    }
    if (filters.subject) {
      resultFilter.subject = new Types.ObjectId(filters.subject);
    } else if (scope.allowedSubjectIds && scope.allowedSubjectIds.length > 0 && normRole === 'teacher') {
      resultFilter.subject = { $in: scope.allowedSubjectIds };
    }
    if (filters.student) {
      resultFilter.student = new Types.ObjectId(filters.student);
    } else if (scope.allowedStudentIds) {
      resultFilter.student = { $in: scope.allowedStudentIds };
    }

    const results = await ExaminationResult.find(resultFilter)
      .populate('student', 'rollNumber usn semester')
      .populate('subject', 'name code credits')
      .populate('examination', 'name examType semester')
      .sort({ percentage: -1 })
      .lean();

    const totalResults = results.length;
    const passedResults = results.filter((r: any) => r.isPassed === true).length;
    const failedResults = results.filter((r: any) => r.isPassed === false).length;

    const gradeDistribution: Record<string, number> = {};
    const subjectAnalysisMap = new Map<
      string,
      {
        subjectId: string;
        subjectName: string;
        subjectCode: string;
        evaluatedCount: number;
        passedCount: number;
        percentageSum: number;
      }
    >();

    for (const r of results as any[]) {
      const grade = r.grade || 'N/A';
      gradeDistribution[grade] = (gradeDistribution[grade] || 0) + 1;

      if (r.subject) {
        const sId = r.subject._id.toString();
        if (!subjectAnalysisMap.has(sId)) {
          subjectAnalysisMap.set(sId, {
            subjectId: sId,
            subjectName: r.subject.name || '',
            subjectCode: r.subject.code || '',
            evaluatedCount: 0,
            passedCount: 0,
            percentageSum: 0,
          });
        }
        const entry = subjectAnalysisMap.get(sId)!;
        entry.evaluatedCount += 1;
        if (r.isPassed === true) entry.passedCount += 1;
        entry.percentageSum += Number(r.percentage || 0);
      }
    }

    const avgPercentage =
      totalResults > 0
        ? Number(
            (
              results.reduce((acc, cur: any) => acc + Number(cur.percentage || 0), 0) /
              totalResults
            ).toFixed(2)
          )
        : 0;

    const formattedRows = results.map((r: any) => ({
      resultId: r._id,
      examinationName: r.examination?.name || '',
      subjectCode: r.subject?.code || '',
      subjectName: r.subject?.name || '',
      studentRollNumber: r.student?.rollNumber || '',
      studentUsn: r.student?.usn || '',
      marksObtained: r.marksObtained,
      maxMarks: r.maximumMarks,
      percentage: r.percentage,
      grade: r.grade,
      gradePoints: r.gradePoint,
      passStatus: r.isPassed ? 'Pass' : 'Fail',
      isPublished: r.evaluationStatus === 'published',
    }));

    return {
      summary: {
        totalResults,
        passedCount: passedResults,
        failedCount: failedResults,
        passPercentage:
          totalResults > 0 ? Number(((passedResults / totalResults) * 100).toFixed(2)) : 100,
        averagePercentage: avgPercentage,
      },
      gradeDistribution,
      subjectWiseAnalysis: Array.from(subjectAnalysisMap.values()).map((s) => ({
        subjectId: s.subjectId,
        subjectName: s.subjectName,
        subjectCode: s.subjectCode,
        evaluatedCount: s.evaluatedCount,
        passPercentage:
          s.evaluatedCount > 0
            ? Number(((s.passedCount / s.evaluatedCount) * 100).toFixed(2))
            : 100,
        averagePercentage:
          s.evaluatedCount > 0 ? Number((s.percentageSum / s.evaluatedCount).toFixed(2)) : 0,
      })),
      topPerformers: formattedRows.slice(0, 5),
      lowPerformers: [...formattedRows].reverse().slice(0, 5),
      resultsList: formattedRows,
    };
  }

  /**
   * 5. Student Progress Analytics (`GET /api/v1/analytics/student-progress`)
   */
  public static async getStudentProgressAnalytics(
    user: ReportRequester,
    filters: IReportJobFilters = {}
  ): Promise<Record<string, any>> {
    const scope = await this.resolveScopeConstraints(user, filters);

    const normRole = this.normalizeRole(user.role);
    const progressFilter: Record<string, any> = { isSnapshot: false };
    if (filters.academicYear) progressFilter.academicYear = new Types.ObjectId(filters.academicYear);
    if (filters.semester) progressFilter.semester = Number(filters.semester);
    if (filters.section) {
      progressFilter.section = new Types.ObjectId(filters.section);
    } else if (scope.allowedSectionIds && scope.allowedSectionIds.length > 0 && normRole === 'teacher') {
      progressFilter.section = { $in: scope.allowedSectionIds };
    }
    if (filters.student) {
      progressFilter.student = new Types.ObjectId(filters.student);
    } else if (scope.allowedStudentIds) {
      progressFilter.student = { $in: scope.allowedStudentIds };
    }

    const progressDocs = await StudentProgress.find(progressFilter)
      .populate('student', 'rollNumber usn semester')
      .populate('section', 'name semester')
      .lean();

    const atRiskStudents = progressDocs.filter(
      (p: any) =>
        p.riskClassification?.level === 'high' || p.riskClassification?.level === 'medium'
    );

    const avgOverallScore =
      progressDocs.length > 0
        ? Number(
            (
              progressDocs.reduce(
                (acc, cur: any) => acc + Number(cur.overallPerformance?.overallScore || 0),
                0
              ) / progressDocs.length
            ).toFixed(2)
          )
        : 0;

    return {
      summary: {
        totalProfilesAnalyzed: progressDocs.length,
        averageOverallScore: avgOverallScore,
        highRiskCount: progressDocs.filter((p: any) => p.riskClassification?.level === 'high')
          .length,
        mediumRiskCount: progressDocs.filter((p: any) => p.riskClassification?.level === 'medium')
          .length,
        lowRiskCount: progressDocs.filter((p: any) => p.riskClassification?.level === 'low')
          .length,
      },
      atRiskStudentsReport: atRiskStudents.map((p: any) => ({
        studentId: p.student?._id,
        rollNumber: p.student?.rollNumber || '',
        usn: p.student?.usn || '',
        sectionName: p.section?.name || '',
        riskLevel: p.riskClassification?.level,
        riskScore: p.riskClassification?.riskScore,
        indicators: (p.riskClassification?.indicators || []).map((ind: any) => ind.code || ind.type),
        attendancePercentage: p.attendanceSummary?.overallPercentage ?? 100,
        overallAcademicScore: p.overallPerformance?.overallScore ?? 0,
      })),
      progressProfiles: progressDocs.map((p: any) => ({
        studentId: p.student?._id,
        rollNumber: p.student?.rollNumber || '',
        usn: p.student?.usn || '',
        semester: p.semester,
        attendancePercentage: p.attendanceSummary?.overallPercentage ?? 100,
        assignmentCompletionPercentage: p.assignmentSummary?.completionPercentage ?? 100,
        overallScore: p.overallPerformance?.overallScore ?? 0,
        riskLevel: p.riskClassification?.level || 'low',
      })),
    };
  }

  /**
   * Builds tabular columns & rows for any of the 7 report types.
   */
  public static async buildReportDataset(
    user: ReportRequester,
    reportType: ReportJobType,
    filters: IReportJobFilters = {}
  ): Promise<{
    title: string;
    columns: Array<{ key: string; header: string }>;
    rows: Array<Record<string, any>>;
    summaryMetrics: Record<string, any>;
  }> {
    switch (reportType) {
      case 'attendance': {
        const data = await this.getAttendanceAnalytics(user, filters);
        return {
          title: 'Academic Attendance & Shortage Report',
          columns: [
            { key: 'rollNumber', header: 'Roll Number' },
            { key: 'usn', header: 'USN' },
            { key: 'totalSessions', header: 'Total Sessions' },
            { key: 'presentSessions', header: 'Present' },
            { key: 'lateSessions', header: 'Late' },
            { key: 'absentSessions', header: 'Absent' },
            { key: 'excusedSessions', header: 'Excused' },
            { key: 'attendancePercentage', header: 'Attendance (%)' },
            { key: 'status', header: 'Shortage Status' },
          ],
          rows: data.studentAttendanceHistory,
          summaryMetrics: data.summary,
        };
      }

      case 'assignments': {
        const data = await this.getAssignmentsAnalytics(user, filters);
        return {
          title: 'Assignment Submissions & Evaluation Report',
          columns: [
            { key: 'assignmentTitle', header: 'Assignment Title' },
            { key: 'subjectCode', header: 'Subject Code' },
            { key: 'studentRollNumber', header: 'Roll Number' },
            { key: 'status', header: 'Status' },
            { key: 'isLate', header: 'Late Submission' },
            { key: 'marksObtained', header: 'Marks Obtained' },
            { key: 'totalMarks', header: 'Max Marks' },
          ],
          rows: data.submissionsList,
          summaryMetrics: data.summary,
        };
      }

      case 'examinations': {
        const data = await this.getExaminationsAnalytics(user, filters);
        return {
          title: 'Examination Results & Grade Distribution Report',
          columns: [
            { key: 'examinationName', header: 'Examination' },
            { key: 'subjectCode', header: 'Subject Code' },
            { key: 'subjectName', header: 'Subject Name' },
            { key: 'studentRollNumber', header: 'Roll Number' },
            { key: 'studentUsn', header: 'USN' },
            { key: 'marksObtained', header: 'Marks Obtained' },
            { key: 'maxMarks', header: 'Max Marks' },
            { key: 'percentage', header: 'Percentage (%)' },
            { key: 'grade', header: 'Grade' },
            { key: 'passStatus', header: 'Pass Status' },
          ],
          rows: data.resultsList,
          summaryMetrics: data.summary,
        };
      }

      case 'student_progress': {
        const data = await this.getStudentProgressAnalytics(user, filters);
        return {
          title: 'Student Academic Progress & Risk Report',
          columns: [
            { key: 'rollNumber', header: 'Roll Number' },
            { key: 'usn', header: 'USN' },
            { key: 'semester', header: 'Semester' },
            { key: 'attendancePercentage', header: 'Attendance (%)' },
            { key: 'assignmentCompletionPercentage', header: 'Assignments (%)' },
            { key: 'overallScore', header: 'Overall Score (%)' },
            { key: 'riskLevel', header: 'Risk Level' },
          ],
          rows: data.progressProfiles,
          summaryMetrics: data.summary,
        };
      }

      case 'teacher_workload': {
        const normRole = this.normalizeRole(user.role);
        if (normRole !== 'admin' && normRole !== 'teacher') {
          throw new ApiError(
            HTTP_STATUS.FORBIDDEN,
            'Only administrators and teachers can generate teacher workload reports'
          );
        }
        const scope = await this.resolveScopeConstraints(user, filters);
        const teacherFilter: Record<string, any> = { status: 'Active' };
        if (filters.department) {
          teacherFilter.department = new Types.ObjectId(filters.department);
        }
        if (filters.teacher) {
          teacherFilter._id = new Types.ObjectId(filters.teacher);
        } else if (scope.teacherId) {
          teacherFilter._id = scope.teacherId;
        }

        const teachers = await Teacher.find(teacherFilter)
          .populate('user', 'firstName lastName email')
          .populate('department', 'name code')
          .lean();

        const rows = await Promise.all(
          teachers.map(async (t: any) => {
            const [assignmentsCount, weeklyLecturesCount, substitutionsCount, leavesCount] =
              await Promise.all([
                TeacherAssignment.countDocuments({ teacher: t._id, status: 'Active' }),
                TimetableEntry.countDocuments({ teacher: t._id }),
                Substitution.countDocuments({
                  substituteTeacher: t._id,
                  status: { $in: ['approved', 'completed'] },
                }),
                TeacherLeave.countDocuments({ teacher: t._id, status: 'approved' }),
              ]);

            return {
              employeeId: t.employeeId,
              teacherName: `${t.firstName || t.user?.firstName || ''} ${t.lastName || t.user?.lastName || ''}`.trim(),
              departmentCode: t.department?.code || '',
              designation: t.designation,
              assignedSubjectsSections: assignmentsCount,
              weeklyPeriods: weeklyLecturesCount,
              substitutionsHandled: substitutionsCount,
              approvedLeaves: leavesCount,
              maxPeriodsPerWeek: t.maxWeeklyHours || 24,
            };
          })
        );

        return {
          title: 'Faculty Teaching Workload & Utilization Report',
          columns: [
            { key: 'employeeId', header: 'Employee ID' },
            { key: 'teacherName', header: 'Teacher Name' },
            { key: 'departmentCode', header: 'Department' },
            { key: 'designation', header: 'Designation' },
            { key: 'assignedSubjectsSections', header: 'Active Assignments' },
            { key: 'weeklyPeriods', header: 'Weekly Periods' },
            { key: 'substitutionsHandled', header: 'Substitutions Handled' },
            { key: 'approvedLeaves', header: 'Approved Leaves' },
          ],
          rows,
          summaryMetrics: {
            totalTeachersAnalyzed: rows.length,
          },
        };
      }

      case 'leave_summary': {
        const normRole = this.normalizeRole(user.role);
        if (normRole !== 'admin' && normRole !== 'teacher') {
          throw new ApiError(
            HTTP_STATUS.FORBIDDEN,
            'Only administrators and teachers can generate leave summary reports'
          );
        }
        const scope = await this.resolveScopeConstraints(user, filters);
        const leaveFilter: Record<string, any> = {};
        if (filters.teacher) {
          leaveFilter.teacher = new Types.ObjectId(filters.teacher);
        } else if (scope.teacherId) {
          leaveFilter.teacher = scope.teacherId;
        }
        if (filters.startDate || filters.endDate) {
          leaveFilter.startDate = {};
          if (filters.startDate) leaveFilter.startDate.$gte = new Date(filters.startDate);
          if (filters.endDate) leaveFilter.startDate.$lte = new Date(filters.endDate);
        }

        const leaves = await TeacherLeave.find(leaveFilter)
          .populate({
            path: 'teacher',
            select: 'employeeId designation',
            populate: { path: 'user', select: 'firstName lastName' },
          })
          .sort({ startDate: -1 })
          .lean();

        const rows = leaves.map((l: any) => ({
          employeeId: l.teacher?.employeeId || '',
          teacherName: `${l.teacher?.user?.firstName || ''} ${l.teacher?.user?.lastName || ''}`.trim(),
          leaveType: l.leaveType,
          startDate: l.startDate ? new Date(l.startDate).toISOString().split('T')[0] : '',
          endDate: l.endDate ? new Date(l.endDate).toISOString().split('T')[0] : '',
          totalDays: l.totalDays || 1,
          status: l.status,
        }));

        return {
          title: 'Faculty Leave Utilization Summary Report',
          columns: [
            { key: 'employeeId', header: 'Employee ID' },
            { key: 'teacherName', header: 'Teacher Name' },
            { key: 'leaveType', header: 'Leave Type' },
            { key: 'startDate', header: 'Start Date' },
            { key: 'endDate', header: 'End Date' },
            { key: 'totalDays', header: 'Total Days' },
            { key: 'status', header: 'Status' },
          ],
          rows,
          summaryMetrics: {
            totalLeaveRequests: rows.length,
            approvedCount: rows.filter((r) => r.status === 'approved').length,
            pendingCount: rows.filter((r) => r.status === 'pending').length,
          },
        };
      }

      case 'substitution_summary': {
        const normRole = this.normalizeRole(user.role);
        if (normRole !== 'admin' && normRole !== 'teacher') {
          throw new ApiError(
            HTTP_STATUS.FORBIDDEN,
            'Only administrators and teachers can generate substitution summary reports'
          );
        }
        const scope = await this.resolveScopeConstraints(user, filters);
        const subFilter: Record<string, any> = {};
        if (filters.teacher) {
          const tid = new Types.ObjectId(filters.teacher);
          subFilter.$or = [{ originalTeacher: tid }, { substituteTeacher: tid }];
        } else if (scope.teacherId) {
          subFilter.$or = [
            { originalTeacher: scope.teacherId },
            { substituteTeacher: scope.teacherId },
          ];
        }

        const subs = await Substitution.find(subFilter)
          .populate('originalTeacher', 'employeeId')
          .populate('substituteTeacher', 'employeeId')
          .populate('subject', 'name code')
          .populate('section', 'name')
          .sort({ date: -1 })
          .lean();

        const rows = subs.map((s: any) => ({
          date: s.date ? new Date(s.date).toISOString().split('T')[0] : '',
          periodNumber: s.periodNumber,
          sectionName: s.section?.name || '',
          subjectCode: s.subject?.code || '',
          originalTeacherId: s.originalTeacher?.employeeId || '',
          substituteTeacherId: s.substituteTeacher?.employeeId || '',
          status: s.status,
        }));

        return {
          title: 'Lecture Substitution & Coverage Report',
          columns: [
            { key: 'date', header: 'Date' },
            { key: 'periodNumber', header: 'Period' },
            { key: 'sectionName', header: 'Section' },
            { key: 'subjectCode', header: 'Subject' },
            { key: 'originalTeacherId', header: 'Original Teacher' },
            { key: 'substituteTeacherId', header: 'Substitute Teacher' },
            { key: 'status', header: 'Status' },
          ],
          rows,
          summaryMetrics: {
            totalSubstitutions: rows.length,
            approvedCount: rows.filter((r) => r.status === 'approved').length,
          },
        };
      }
    }
  }

  /**
   * Formats dataset into RFC-4180 CSV Buffer.
   */
  public static formatAsCSV(
    columns: Array<{ key: string; header: string }>,
    rows: Array<Record<string, any>>
  ): Buffer {
    const escapeCell = (val: any): string => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headerLine = columns.map((c) => escapeCell(c.header)).join(',');
    const dataLines = rows.map((row) =>
      columns.map((c) => escapeCell(row[c.key])).join(',')
    );

    return Buffer.from([headerLine, ...dataLines].join('\r\n'), 'utf-8');
  }

  /**
   * Formats dataset into Excel SpreadsheetML (.xlsx / XML Workbook) Buffer.
   */
  public static formatAsExcel(
    title: string,
    columns: Array<{ key: string; header: string }>,
    rows: Array<Record<string, any>>
  ): Buffer {
    const escapeXml = (val: any): string => {
      if (val === null || val === undefined) return '';
      return String(val)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    const headerCells = columns
      .map((c) => `<Cell><Data ss:Type="String">${escapeXml(c.header)}</Data></Cell>`)
      .join('');

    const rowXml = rows
      .map((row) => {
        const cells = columns
          .map((c) => {
            const val = row[c.key];
            const isNum = typeof val === 'number' && !Number.isNaN(val);
            return `<Cell><Data ss:Type="${isNum ? 'Number' : 'String'}">${escapeXml(val)}</Data></Cell>`;
          })
          .join('');
        return `<Row>${cells}</Row>`;
      })
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="${escapeXml(title.slice(0, 30))}">
  <Table>
   <Row>${headerCells}</Row>
   ${rowXml}
  </Table>
 </Worksheet>
</Workbook>`;

    return Buffer.from(xml, 'utf-8');
  }

  /**
   * Formats dataset into a valid standard %PDF-1.4 document Buffer.
   */
  public static formatAsPDF(
    title: string,
    columns: Array<{ key: string; header: string }>,
    rows: Array<Record<string, any>>,
    summaryMetrics: Record<string, any> = {}
  ): Buffer {
    const sanitizePdfText = (val: any): string =>
      String(val ?? '')
        .replace(/[()\\]/g, '')
        .replace(/[^\x20-\x7E]/g, ' ');

    const lines: string[] = [
      `MSEC ACADEMIC ERP - OFFICIAL INSTITUTIONAL REPORT`,
      `Report Title: ${sanitizePdfText(title)}`,
      `Generated At: ${new Date().toISOString()}`,
      `Summary: ${sanitizePdfText(JSON.stringify(summaryMetrics))}`,
      `--------------------------------------------------------------------------------`,
      columns.map((c) => sanitizePdfText(c.header)).join(' | '),
      `--------------------------------------------------------------------------------`,
    ];

    for (const row of rows.slice(0, 200)) {
      lines.push(
        columns.map((c) => sanitizePdfText(row[c.key])).join(' | ').slice(0, 110)
      );
    }

    const contentStreamLines = ['BT', '/F1 9 Tf', '40 760 Td', '12 TL'];
    for (const line of lines.slice(0, 58)) {
      contentStreamLines.push(`(${line}) Tj T*`);
    }
    contentStreamLines.push('ET');
    const streamBody = contentStreamLines.join('\n');

    const objects = [
      `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`,
      `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`,
      `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n`,
      `4 0 obj\n<< /Length ${Buffer.byteLength(streamBody, 'utf-8')} >>\nstream\n${streamBody}\nendstream\nendobj\n`,
      `5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`,
    ];

    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [0];
    for (const obj of objects) {
      offsets.push(Buffer.byteLength(pdf, 'utf-8'));
      pdf += obj;
    }

    const xrefOffset = Buffer.byteLength(pdf, 'utf-8');
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i < offsets.length; i++) {
      pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

    return Buffer.from(pdf, 'utf-8');
  }

  /**
   * Generates a ReportJob, writes the exported file via storageService to `uploads/reports`,
   * and returns the completed (or queued) ReportJob.
   */
  public static async createReportJob(
    user: ReportRequester,
    payload: {
      reportType: ReportJobType;
      title?: string;
      exportFormat: ReportExportFormat;
      asyncMode?: boolean;
      expiresInHours?: number;
      filters?: IReportJobFilters;
    }
  ): Promise<IReportJob> {
    // Verify scope authorization immediately before creating job
    const dataset = await this.buildReportDataset(
      user,
      payload.reportType,
      payload.filters || {}
    );

    const expiryHours = payload.expiresInHours ?? env.REPORT_EXPIRY_HOURS ?? 168;
    const expiresAt = new Date(Date.now() + expiryHours * 3600 * 1000);

    const job = await ReportJob.create({
      requestedBy: new Types.ObjectId(user.id),
      requesterRole: user.role,
      reportType: payload.reportType,
      title: payload.title || dataset.title,
      filters: payload.filters || {},
      exportFormat: payload.exportFormat,
      status: 'queued',
      rowCount: dataset.rows.length,
      summaryMetrics: dataset.summaryMetrics,
      requestedAt: new Date(),
      expiresAt,
    });

    const executeExport = async () => {
      try {
        job.status = 'processing';
        await job.save();

        let buffer: Buffer;
        let ext: string;
        let mimeType: string;

        if (payload.exportFormat === 'pdf') {
          buffer = this.formatAsPDF(
            job.title,
            dataset.columns,
            dataset.rows,
            dataset.summaryMetrics
          );
          ext = '.pdf';
          mimeType = 'application/pdf';
        } else if (payload.exportFormat === 'excel') {
          buffer = this.formatAsExcel(job.title, dataset.columns, dataset.rows);
          ext = '.xlsx';
          mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        } else {
          buffer = this.formatAsCSV(dataset.columns, dataset.rows);
          ext = '.csv';
          mimeType = 'text/csv';
        }

        const stored = await storageService.saveFile(
          {
            originalname: `${payload.reportType}-report${ext}`,
            mimetype: mimeType,
            size: buffer.length,
            buffer,
          } as any,
          'reports'
        );

        job.status = 'completed';
        job.completedAt = new Date();
        job.fileReference = {
          fileName: stored.filename,
          originalName: stored.originalName,
          mimeType: stored.mimeType,
          size: stored.size,
          path: stored.path,
        };
        await job.save();
      } catch (err: any) {
        job.status = 'failed';
        job.errorDetails = err?.message || 'Report generation failed';
        await job.save();
      }
    };

    const shouldRunAsync =
      payload.asyncMode === true || dataset.rows.length > env.REPORT_ASYNC_ROW_THRESHOLD;

    if (shouldRunAsync) {
      setImmediate(() => {
        executeExport().catch(() => {});
      });
      return job;
    }

    await executeExport();
    return job;
  }

  /**
   * Lists report jobs visible to the authenticated user.
   */
  public static async listReportJobs(
    user: ReportRequester,
    query: Record<string, any> = {}
  ): Promise<{
    items: any[];
    pagination: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const normRole = this.normalizeRole(user.role);
    const filter: Record<string, any> = {};
    if (normRole !== 'admin') {
      filter.requestedBy = new Types.ObjectId(user.id);
    }
    if (query.reportType) filter.reportType = query.reportType;
    if (query.exportFormat) filter.exportFormat = query.exportFormat;
    if (query.status) filter.status = query.status;

    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      ReportJob.find(filter)
        .populate('requestedBy', 'firstName lastName email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ReportJob.countDocuments(filter),
    ]);

    return {
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Gets a single ReportJob and refreshes its expiry state if needed.
   */
  public static async getReportJobById(
    id: string,
    user: ReportRequester
  ): Promise<IReportJob> {
    const normRole = this.normalizeRole(user.role);
    const job = await ReportJob.findById(id).populate(
      'requestedBy',
      'firstName lastName email role'
    );

    if (!job) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Report job not found');
    }

    const requesterId = (job.requestedBy as any)?._id
      ? (job.requestedBy as any)._id.toString()
      : job.requestedBy.toString();

    if (normRole !== 'admin' && requesterId !== user.id) {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        'You are not authorized to access this report job'
      );
    }

    // Check if report has expired
    if (job.status === 'completed' && job.expiresAt && new Date() > job.expiresAt) {
      job.status = 'expired';
      if (job.fileReference?.path) {
        await storageService.deleteFile(job.fileReference.path);
      }
      await job.save();
    }

    return job;
  }

  /**
   * Returns a readable stream and metadata for downloading a completed report file.
   */
  public static async downloadReportFile(
    id: string,
    user: ReportRequester
  ): Promise<{
    stream: NodeJS.ReadableStream;
    fileName: string;
    mimeType: string;
    size: number;
  }> {
    const job = await this.getReportJobById(id, user);

    if (job.status === 'expired') {
      throw new ApiError(
        HTTP_STATUS.GONE || 410,
        'This generated report has expired and its export file has been cleaned up'
      );
    }

    if (job.status !== 'completed' || !job.fileReference?.path) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        `Report is not ready for download (current status: ${job.status})`
      );
    }

    const stream = storageService.getFileStream(job.fileReference.path);
    job.downloadCount = (job.downloadCount || 0) + 1;
    await job.save();

    return {
      stream,
      fileName: job.fileReference.originalName || job.fileReference.fileName,
      mimeType: job.fileReference.mimeType,
      size: job.fileReference.size,
    };
  }

  /**
   * Deletes a report job and removes its associated disk file.
   */
  public static async deleteReportJob(id: string, user: ReportRequester): Promise<void> {
    const job = await this.getReportJobById(id, user);
    if (job.fileReference?.path) {
      await storageService.deleteFile(job.fileReference.path);
    }
    await ReportJob.deleteOne({ _id: job._id });
  }

  /**
   * Background cleanup utility to mark expired report jobs and delete their disk artifacts.
   */
  public static async cleanupExpiredReports(): Promise<number> {
    const now = new Date();
    const expiredJobs = await ReportJob.find({
      status: 'completed',
      expiresAt: { $lte: now },
    });

    for (const job of expiredJobs) {
      job.status = 'expired';
      if (job.fileReference?.path) {
        await storageService.deleteFile(job.fileReference.path);
      }
      await job.save();
    }

    return expiredJobs.length;
  }
}
