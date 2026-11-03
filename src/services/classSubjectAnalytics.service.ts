import { Types } from 'mongoose';
import { Student } from '../models/student.model';
import { Subject } from '../models/subject.model';
import { AttendanceSession } from '../models/attendanceSession.model';
import { AttendanceRecord } from '../models/attendanceRecord.model';
import { Assignment } from '../models/assignment.model';
import { AssignmentSubmission } from '../models/assignmentSubmission.model';
import { ExaminationResult } from '../models/examinationResult.model';
import { Teacher } from '../models/teacher.model';
import { TeacherAssignment } from '../models/teacherAssignment.model';
import { RiskDetectionService } from './riskDetection.service';
import { StudentProgressService } from './studentProgress.service';
import { ApiError } from '../utils/apiError';
import { HTTP_STATUS } from '../constants/statusCodes';

export interface AnalyticsFilterDTO {
  academicYear?: string;
  semester?: number;
  department?: string;
  class?: string;
  section?: string;
  subject?: string;
  startDate?: string;
  endDate?: string;
}

export class ClassSubjectAnalyticsService {
  private riskDetectionService: RiskDetectionService;
  private studentProgressService: StudentProgressService;

  constructor() {
    this.riskDetectionService = new RiskDetectionService();
    this.studentProgressService = new StudentProgressService();
  }

  /**
   * Helper: Build Student match filter
   */
  private buildStudentFilter(filters: AnalyticsFilterDTO): Record<string, any> {
    const query: Record<string, any> = { status: 'Active' };
    if (filters.academicYear) query.academicYear = new Types.ObjectId(filters.academicYear);
    if (filters.semester) query.semester = filters.semester;
    if (filters.department) query.department = new Types.ObjectId(filters.department);
    if (filters.class) query.class = new Types.ObjectId(filters.class);
    if (filters.section) query.section = new Types.ObjectId(filters.section);
    return query;
  }

  // ==========================================
  // MODULE 5: CLASS PERFORMANCE ANALYTICS
  // ==========================================

  /**
   * Class Overview: total students, overall average, attendance rate, assignment completion, exam pass rate
   */
  public async getClassOverview(filters: AnalyticsFilterDTO): Promise<any> {
    const studentFilter = this.buildStudentFilter(filters);
    const students = await Student.find(studentFilter).select('_id');
    const totalStudents = students.length;

    if (totalStudents === 0) {
      return {
        totalStudents: 0,
        classAverage: 0,
        attendanceAverage: 0,
        assignmentCompletionRate: 0,
        examinationPassRate: 0,
        activeSectionsCount: 0,
      };
    }

    const studentIds = students.map((s) => s._id);

    // 1. Attendance Average
    const sessionMatch: Record<string, any> = { status: 'Completed' };
    if (filters.section) sessionMatch.section = new Types.ObjectId(filters.section);
    if (filters.academicYear) sessionMatch.academicYear = new Types.ObjectId(filters.academicYear);
    if (filters.semester) sessionMatch.semester = filters.semester;
    if (filters.startDate || filters.endDate) {
      sessionMatch.date = {};
      if (filters.startDate) sessionMatch.date.$gte = new Date(filters.startDate);
      if (filters.endDate) sessionMatch.date.$lte = new Date(filters.endDate);
    }

    const completedSessions = await AttendanceSession.find(sessionMatch).select('_id');
    let attendanceAverage = 0;
    if (completedSessions.length > 0) {
      const records = await AttendanceRecord.find({
        session: { $in: completedSessions.map((s) => s._id) },
        student: { $in: studentIds },
      });
      const attended = records.filter(
        (r) => r.status === 'Present' || r.status === 'Late'
      ).length;
      const totalPossible = completedSessions.length * totalStudents;
      attendanceAverage = totalPossible > 0 ? Number(((attended / totalPossible) * 100).toFixed(2)) : 0;
    }

    // 2. Assignment Completion Rate
    const assignmentMatch: Record<string, any> = {
      status: { $in: ['published', 'closed'] },
    };
    if (filters.section) assignmentMatch.section = new Types.ObjectId(filters.section);
    if (filters.academicYear) assignmentMatch.academicYear = new Types.ObjectId(filters.academicYear);
    if (filters.semester) assignmentMatch.semester = filters.semester;

    const assignments = await Assignment.find(assignmentMatch).select('_id');
    let assignmentCompletionRate = 0;
    if (assignments.length > 0) {
      const submissions = await AssignmentSubmission.find({
        assignment: { $in: assignments.map((a) => a._id) },
        student: { $in: studentIds },
      });
      const totalExpected = assignments.length * totalStudents;
      assignmentCompletionRate = totalExpected > 0 ? Number(((submissions.length / totalExpected) * 100).toFixed(2)) : 0;
    }

    // 3. Examination Pass Rate & Class Average
    const examResultMatch: Record<string, any> = {
      student: { $in: studentIds },
    };
    if (filters.academicYear) examResultMatch.academicYear = new Types.ObjectId(filters.academicYear);
    if (filters.semester) examResultMatch.semester = filters.semester;
    if (filters.subject) examResultMatch.subject = new Types.ObjectId(filters.subject);

    const examResults = await ExaminationResult.find(examResultMatch);
    const validResults = examResults.filter(
      (r) => !r.isExempted && typeof r.percentage === 'number'
    );

    let examinationPassRate = 0;
    let classAverage = 0;
    if (validResults.length > 0) {
      const passed = validResults.filter((r) => r.isPassed).length;
      examinationPassRate = Number(((passed / validResults.length) * 100).toFixed(2));
      const totalPct = validResults.reduce((acc, r) => acc + (r.percentage || 0), 0);
      classAverage = Number((totalPct / validResults.length).toFixed(2));
    }

    return {
      totalStudents,
      classAverage,
      attendanceAverage,
      assignmentCompletionRate,
      examinationPassRate,
      totalEvaluations: validResults.length,
    };
  }

  /**
   * Class Performance: subject-wise averages, grade distribution, top performers, students requiring attention
   */
  public async getClassPerformance(filters: AnalyticsFilterDTO): Promise<any> {
    const studentFilter = this.buildStudentFilter(filters);
    const students = await Student.find(studentFilter);
    const totalStudents = students.length;

    if (totalStudents === 0) {
      return {
        subjectAverages: [],
        gradeDistribution: {},
        topPerformers: [],
        studentsRequiringAttention: [],
      };
    }

    const studentIds = students.map((s) => s._id);

    // 1. Grade distribution & Subject Averages via Results
    const examResultMatch: Record<string, any> = {
      student: { $in: studentIds },
    };
    if (filters.academicYear) examResultMatch.academicYear = new Types.ObjectId(filters.academicYear);
    if (filters.semester) examResultMatch.semester = filters.semester;

    const examResults = await ExaminationResult.find(examResultMatch).populate(
      'subject',
      'name code'
    );

    const gradeDistribution: Record<string, number> = {};
    const subjectMap = new Map<string, { name: string; code: string; scores: number[] }>();

    for (const r of examResults) {
      if (r.isExempted || typeof r.percentage !== 'number') continue;

      if (r.grade) {
        gradeDistribution[r.grade] = (gradeDistribution[r.grade] || 0) + 1;
      }

      if (r.subject) {
        const sub = r.subject as any;
        const subId = sub._id.toString();
        if (!subjectMap.has(subId)) {
          subjectMap.set(subId, { name: sub.name, code: sub.code, scores: [] });
        }
        subjectMap.get(subId)!.scores.push(r.percentage);
      }
    }

    const subjectAverages = Array.from(subjectMap.entries()).map(([subjectId, item]) => {
      const avg =
        item.scores.length > 0
          ? Number((item.scores.reduce((a, b) => a + b, 0) / item.scores.length).toFixed(2))
          : 0;
      return {
        subjectId,
        subjectName: item.name,
        subjectCode: item.code,
        averageMarks: avg,
        evaluationsCount: item.scores.length,
      };
    });

    // 2. Compute individual student progress profiles for ranking and attention detection
    const progressList: any[] = [];
    for (const s of students) {
      const progress = await this.studentProgressService.calculateStudentProgress(
        s._id.toString(),
        {
          academicYearId: filters.academicYear,
          semester: filters.semester,
        }
      );
      progressList.push({
        studentId: s._id,
        name: `${s.firstName} ${s.lastName}`,
        usn: s.usn,
        overallPercentage: progress.overallAcademicPercentage,
        attendancePercentage: progress.attendancePercentage,
        assignmentCompletionRate: progress.assignmentCompletionRate,
        progressTrend: progress.progressTrend,
        riskLevel: progress.riskLevel,
        riskScore: progress.riskScore,
        riskIndicators: progress.riskIndicators,
      });
    }

    // Top performers (top 5 sorted by overallPercentage descending)
    const sortedByScore = [...progressList].sort(
      (a, b) => b.overallPercentage - a.overallPercentage
    );
    const topPerformers = sortedByScore.slice(0, 5);

    // Students requiring attention: High or Medium risk, or failing overall (<40%)
    const studentsRequiringAttention = progressList.filter(
      (p) => p.riskLevel === 'high' || p.riskLevel === 'medium' || p.overallPercentage < 40
    );

    return {
      totalStudents,
      subjectAverages,
      gradeDistribution,
      topPerformers,
      studentsRequiringAttention,
    };
  }

  /**
   * Class Attendance Analytics
   */
  public async getClassAttendance(filters: AnalyticsFilterDTO): Promise<any> {
    const studentFilter = this.buildStudentFilter(filters);
    const students = await Student.find(studentFilter).select('_id firstName lastName usn');
    const totalStudents = students.length;

    const sessionMatch: Record<string, any> = { status: 'Completed' };
    if (filters.section) sessionMatch.section = new Types.ObjectId(filters.section);
    if (filters.academicYear) sessionMatch.academicYear = new Types.ObjectId(filters.academicYear);
    if (filters.semester) sessionMatch.semester = filters.semester;
    if (filters.subject) sessionMatch.subject = new Types.ObjectId(filters.subject);

    const sessions = await AttendanceSession.find(sessionMatch).select('_id date');
    const totalSessions = sessions.length;

    if (totalStudents === 0 || totalSessions === 0) {
      return {
        totalStudents,
        totalSessions,
        overallAttendancePercentage: 0,
        presentRate: 0,
        absentRate: 0,
        lateRate: 0,
        shortageStudentsCount: 0,
      };
    }

    const records = await AttendanceRecord.find({
      session: { $in: sessions.map((s) => s._id) },
      student: { $in: students.map((s) => s._id) },
    });

    const presentCount = records.filter((r) => r.status === 'Present').length;
    const lateCount = records.filter((r) => r.status === 'Late').length;
    const absentCount = records.filter((r) => r.status === 'Absent').length;
    const totalRecords = records.length || 1;

    const overallAttendancePercentage = Number(
      (((presentCount + lateCount) / (totalSessions * totalStudents)) * 100).toFixed(2)
    );

    // Student shortage count (< 75%)
    let shortageStudentsCount = 0;
    for (const s of students) {
      const studentRecs = records.filter((r) => r.student.toString() === s._id.toString());
      const attended = studentRecs.filter((r) => r.status === 'Present' || r.status === 'Late').length;
      const pct = (attended / totalSessions) * 100;
      if (pct < 75) shortageStudentsCount++;
    }

    return {
      totalStudents,
      totalSessions,
      overallAttendancePercentage,
      presentRate: Number(((presentCount / totalRecords) * 100).toFixed(2)),
      lateRate: Number(((lateCount / totalRecords) * 100).toFixed(2)),
      absentRate: Number(((absentCount / totalRecords) * 100).toFixed(2)),
      shortageStudentsCount,
    };
  }

  /**
   * Class Assignment Analytics
   */
  public async getClassAssignments(filters: AnalyticsFilterDTO): Promise<any> {
    const studentFilter = this.buildStudentFilter(filters);
    const students = await Student.find(studentFilter).select('_id');
    const totalStudents = students.length;

    const assignmentMatch: Record<string, any> = {
      status: { $in: ['published', 'closed'] },
    };
    if (filters.section) assignmentMatch.section = new Types.ObjectId(filters.section);
    if (filters.academicYear) assignmentMatch.academicYear = new Types.ObjectId(filters.academicYear);
    if (filters.semester) assignmentMatch.semester = filters.semester;
    if (filters.subject) assignmentMatch.subject = new Types.ObjectId(filters.subject);

    const assignments = await Assignment.find(assignmentMatch).select(
      '_id title totalMarks dueDate status'
    );

    if (totalStudents === 0 || assignments.length === 0) {
      return {
        totalStudents,
        totalAssignments: assignments.length,
        submissionRate: 0,
        lateSubmissionRate: 0,
        evaluatedRate: 0,
        assignmentBreakdown: [],
      };
    }

    const assignmentIds = assignments.map((a) => a._id);
    const submissions = await AssignmentSubmission.find({
      assignment: { $in: assignmentIds },
      student: { $in: students.map((s) => s._id) },
    });

    const totalSubmissions = submissions.length;
    const totalExpected = assignments.length * totalStudents;
    const submissionRate = Number(((totalSubmissions / totalExpected) * 100).toFixed(2));
    const lateCount = submissions.filter((s) => s.isLate).length;
    const evaluatedCount = submissions.filter((s) => s.evaluationStatus === 'evaluated').length;

    const assignmentBreakdown = assignments.map((a) => {
      const subs = submissions.filter((s) => s.assignment.toString() === a._id.toString());
      const evals = subs.filter(
        (s) => s.evaluationStatus === 'evaluated' && typeof s.marksObtained === 'number'
      );
      const avg =
        evals.length > 0
          ? Number(
              (
                evals.reduce((acc, s) => acc + (s.marksObtained || 0), 0) / evals.length
              ).toFixed(2)
            )
          : 0;
      return {
        assignmentId: a._id,
        title: a.title,
        totalMarks: a.totalMarks,
        submissionsCount: subs.length,
        completionRate: Number(((subs.length / totalStudents) * 100).toFixed(2)),
        averageMarks: avg,
      };
    });

    return {
      totalStudents,
      totalAssignments: assignments.length,
      submissionRate,
      lateSubmissionRate:
        totalSubmissions > 0
          ? Number(((lateCount / totalSubmissions) * 100).toFixed(2))
          : 0,
      evaluatedRate:
        totalSubmissions > 0
          ? Number(((evaluatedCount / totalSubmissions) * 100).toFixed(2))
          : 0,
      assignmentBreakdown,
    };
  }

  // ==========================================
  // MODULE 6: SUBJECT PERFORMANCE ANALYTICS
  // ==========================================

  /**
   * Subject Overview: average, highest, lowest marks, pass/fail percentage
   */
  public async getSubjectOverview(filters: AnalyticsFilterDTO): Promise<any> {
    if (!filters.subject) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Subject filter is required for subject analytics');
    }

    const subject = await Subject.findById(filters.subject);
    if (!subject) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Subject not found');

    const resultMatch: Record<string, any> = {
      subject: subject._id,
      isExempted: false,
    };
    if (filters.academicYear) resultMatch.academicYear = new Types.ObjectId(filters.academicYear);
    if (filters.semester) resultMatch.semester = filters.semester;

    const results = await ExaminationResult.find(resultMatch);
    const validResults = results.filter((r) => typeof r.percentage === 'number');

    if (validResults.length === 0) {
      return {
        subjectId: subject._id,
        subjectName: subject.name,
        subjectCode: subject.code,
        evaluationsCount: 0,
        averageMarksPercentage: 0,
        highestMarksPercentage: 0,
        lowestMarksPercentage: 0,
        passPercentage: 0,
        failPercentage: 0,
        difficultyIndicator: {
          level: 'Insufficient Data',
          reason: 'At least 5 evaluated student results are required to determine subject difficulty',
        },
      };
    }

    const percentages = validResults.map((r) => r.percentage || 0);
    const avg = Number((percentages.reduce((a, b) => a + b, 0) / percentages.length).toFixed(2));
    const highest = Math.max(...percentages);
    const lowest = Math.min(...percentages);
    const passedCount = validResults.filter((r) => r.isPassed).length;
    const passPct = Number(((passedCount / validResults.length) * 100).toFixed(2));
    const failPct = Number((100 - passPct).toFixed(2));

    // Data-backed difficulty indicator (requires at least 5 sample records)
    let difficultyIndicator: { level: string; reason: string };
    if (validResults.length >= 5) {
      if (failPct >= 35 || avg < 45) {
        difficultyIndicator = {
          level: 'High Difficulty',
          reason: `High failure rate (${failPct}%) and low average score (${avg}%) based on ${validResults.length} assessments`,
        };
      } else if (passPct >= 85 && avg >= 70) {
        difficultyIndicator = {
          level: 'Low Difficulty',
          reason: `Strong class performance with ${passPct}% pass rate and ${avg}% average across ${validResults.length} assessments`,
        };
      } else {
        difficultyIndicator = {
          level: 'Moderate Difficulty',
          reason: `Balanced academic distribution with ${passPct}% pass rate and ${avg}% average score across ${validResults.length} assessments`,
        };
      }
    } else {
      difficultyIndicator = {
        level: 'Insufficient Data',
        reason: 'At least 5 evaluated student results are required to determine subject difficulty',
      };
    }

    return {
      subjectId: subject._id,
      subjectName: subject.name,
      subjectCode: subject.code,
      evaluationsCount: validResults.length,
      averageMarksPercentage: avg,
      highestMarksPercentage: highest,
      lowestMarksPercentage: lowest,
      passPercentage: passPct,
      failPercentage: failPct,
      difficultyIndicator,
    };
  }

  /**
   * Subject Performance: performance distribution & assessment breakdowns
   */
  public async getSubjectPerformance(filters: AnalyticsFilterDTO): Promise<any> {
    if (!filters.subject) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Subject filter is required');
    }

    const overview = await this.getSubjectOverview(filters);

    const resultMatch: Record<string, any> = {
      subject: new Types.ObjectId(filters.subject),
      isExempted: false,
    };
    if (filters.academicYear) resultMatch.academicYear = new Types.ObjectId(filters.academicYear);
    if (filters.semester) resultMatch.semester = filters.semester;

    const results = await ExaminationResult.find(resultMatch).populate(
      'examination',
      'name examinationType maximumMarks'
    );

    const gradeDistribution: Record<string, number> = {};
    const assessmentMap = new Map<string, { name: string; type: string; scores: number[] }>();

    for (const r of results) {
      if (typeof r.percentage !== 'number') continue;

      if (r.grade) {
        gradeDistribution[r.grade] = (gradeDistribution[r.grade] || 0) + 1;
      }

      if (r.examination) {
        const exam = r.examination as any;
        const examId = exam._id.toString();
        if (!assessmentMap.has(examId)) {
          assessmentMap.set(examId, {
            name: exam.name,
            type: exam.examinationType,
            scores: [],
          });
        }
        assessmentMap.get(examId)!.scores.push(r.percentage);
      }
    }

    const assessmentBreakdown = Array.from(assessmentMap.entries()).map(([examId, item]) => {
      const avg =
        item.scores.length > 0
          ? Number((item.scores.reduce((a, b) => a + b, 0) / item.scores.length).toFixed(2))
          : 0;
      return {
        examinationId: examId,
        examinationName: item.name,
        examinationType: item.type,
        averagePercentage: avg,
        totalEvaluated: item.scores.length,
      };
    });

    return {
      ...overview,
      gradeDistribution,
      assessmentBreakdown,
    };
  }

  /**
   * Subject Comparison: compare across sections
   */
  public async getSubjectComparison(filters: AnalyticsFilterDTO): Promise<any> {
    if (!filters.subject) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Subject filter is required');
    }

    const subject = await Subject.findById(filters.subject);
    if (!subject) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Subject not found');

    const resultMatch: Record<string, any> = {
      subject: subject._id,
      isExempted: false,
    };
    if (filters.academicYear) resultMatch.academicYear = new Types.ObjectId(filters.academicYear);
    if (filters.semester) resultMatch.semester = filters.semester;

    const results = await ExaminationResult.find(resultMatch).populate({
      path: 'student',
      select: 'section',
      populate: { path: 'section', select: 'name' },
    });

    const sectionMap = new Map<string, { sectionName: string; scores: number[]; passes: number }>();

    for (const r of results) {
      if (typeof r.percentage !== 'number' || !r.student) continue;
      const s = r.student as any;
      if (!s.section) continue;

      const secId = s.section._id?.toString() || s.section.toString();
      const secName = s.section.name || 'Unknown Section';

      if (!sectionMap.has(secId)) {
        sectionMap.set(secId, { sectionName: secName, scores: [], passes: 0 });
      }

      const secData = sectionMap.get(secId)!;
      secData.scores.push(r.percentage);
      if (r.isPassed) secData.passes++;
    }

    const sectionComparisons = Array.from(sectionMap.entries()).map(([secId, data]) => {
      const avg =
        data.scores.length > 0
          ? Number((data.scores.reduce((a, b) => a + b, 0) / data.scores.length).toFixed(2))
          : 0;
      const passRate =
        data.scores.length > 0
          ? Number(((data.passes / data.scores.length) * 100).toFixed(2))
          : 0;
      return {
        sectionId: secId,
        sectionName: data.sectionName,
        evaluationsCount: data.scores.length,
        averagePercentage: avg,
        passPercentage: passRate,
      };
    });

    return {
      subjectId: subject._id,
      subjectName: subject.name,
      sectionComparisons,
    };
  }

  // ==========================================
  // MODULE 7: TEACHER PERFORMANCE INSIGHTS
  // ==========================================

  /**
   * Teacher Overview Insights: scoped strictly to assigned subjects/sections
   */
  public async getTeacherOverview(
    teacherUserId: string,
    filters: AnalyticsFilterDTO
  ): Promise<any> {
    const teacher = await Teacher.findOne({ user: teacherUserId });
    if (!teacher) {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Teacher profile not found');
    }

    const assignments = await TeacherAssignment.find({
      teacher: teacher._id,
      status: 'Active',
    })
      .populate('section', 'name semester')
      .populate('subject', 'name code credits');

    if (assignments.length === 0) {
      return {
        teacherId: teacher._id,
        teacherName: `${teacher.firstName} ${teacher.lastName}`,
        assignedClassesCount: 0,
        assignedSubjectsCount: 0,
        classOverview: null,
      };
    }

    const sectionIds = assignments.map((a) => a.section._id);
    const subjectIds = assignments.map((a) => a.subject._id);

    // Apply teacher-scoped filters
    const scopedFilters: AnalyticsFilterDTO = {
      ...filters,
      section: filters.section || undefined,
      subject: filters.subject || undefined,
    };

    if (filters.section && !sectionIds.some((s) => s.toString() === filters.section)) {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        'You are not authorized to view insights for sections outside your assignment'
      );
    }

    if (filters.subject && !subjectIds.some((s) => s.toString() === filters.subject)) {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        'You are not authorized to view insights for subjects outside your assignment'
      );
    }

    // Compute aggregated overview for assigned classes
    const classOverview = await this.getClassOverview({
      ...scopedFilters,
      section: scopedFilters.section || (sectionIds.length === 1 && sectionIds[0] ? sectionIds[0].toString() : undefined),
    });

    return {
      teacherId: teacher._id,
      teacherName: `${teacher.firstName} ${teacher.lastName}`,
      assignedClasses: assignments.map((a) => ({
        sectionId: (a.section as any)._id,
        sectionName: (a.section as any).name,
        semester: (a.section as any).semester,
        subjectId: (a.subject as any)._id,
        subjectName: (a.subject as any).name,
        subjectCode: (a.subject as any).code,
      })),
      classOverview,
    };
  }

  /**
   * Teacher Students At-Risk: scoped strictly to assigned sections
   */
  public async getTeacherStudentsAtRisk(
    teacherUserId: string,
    filters: AnalyticsFilterDTO
  ): Promise<any> {
    const teacher = await Teacher.findOne({ user: teacherUserId });
    if (!teacher) {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Teacher profile not found');
    }

    return this.riskDetectionService.getAtRiskStudents(
      {
        academicYear: filters.academicYear,
        semester: filters.semester,
        sectionId: filters.section,
      },
      'Teacher',
      teacherUserId
    );
  }
}
