import { Types } from 'mongoose';
import {
  StudentProgress,
  IStudentProgress,
  ProgressTrend,
} from '../models/studentProgress.model';
import { Student } from '../models/student.model';
import { Parent } from '../models/parent.model';
import { Teacher } from '../models/teacher.model';
import { TeacherAssignment } from '../models/teacherAssignment.model';
import { Subject } from '../models/subject.model';
import { AttendanceSession } from '../models/attendanceSession.model';
import { AttendanceRecord } from '../models/attendanceRecord.model';
import { Assignment } from '../models/assignment.model';
import { AssignmentSubmission } from '../models/assignmentSubmission.model';
import { ExaminationResult } from '../models/examinationResult.model';
import { RiskDetectionService } from './riskDetection.service';
import { ApiError } from '../utils/apiError';
import { HTTP_STATUS } from '../constants/statusCodes';
import { ROLES } from '../constants/roles.constant';

export interface ProgressCalculationOptions {
  academicYearId?: string;
  semester?: number;
  subjectId?: string;
  saveSnapshot?: boolean;
  notes?: string;
}

export class StudentProgressService {
  private riskDetectionService: RiskDetectionService;

  constructor() {
    this.riskDetectionService = new RiskDetectionService();
  }

  /**
   * RBAC Security Guard: Verify access rights to student academic records
   */
  public async verifyStudentAccess(
    studentId: string,
    requestingUser: { id: string; role: string }
  ): Promise<any> {
    const student = await Student.findById(studentId);
    if (!student) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Student not found');
    }

    if (requestingUser.role === ROLES.SUPER_ADMIN || requestingUser.role === ROLES.ADMIN) {
      return student;
    }

    if (requestingUser.role === ROLES.STUDENT) {
      if (student.user.toString() !== requestingUser.id) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Students can only view their own progress');
      }
      return student;
    }

    if (requestingUser.role === ROLES.PARENT) {
      const parent = await Parent.findOne({ user: requestingUser.id });
      if (!parent) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Parent record not found');
      }
      const isLinked = parent.students.some((c: Types.ObjectId) => c.toString() === student._id.toString());
      if (!isLinked) {
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          'Parents can only view progress for their linked children'
        );
      }
      return student;
    }

    if (requestingUser.role === ROLES.TEACHER) {
      const teacher = await Teacher.findOne({ user: requestingUser.id });
      if (!teacher) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Teacher record not found');
      }
      const assigned = await TeacherAssignment.findOne({
        teacher: teacher._id,
        section: student.section,
        status: 'Active',
      });
      if (!assigned) {
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          'You are not authorized to view progress for students outside your assigned classes'
        );
      }
      return student;
    }

    throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Access denied');
  }

  /**
   * Core Calculation Engine: Compute progress metrics dynamically
   */
  public async calculateStudentProgress(
    studentId: string,
    options: ProgressCalculationOptions = {}
  ): Promise<IStudentProgress> {
    const student = await Student.findById(studentId);
    if (!student) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Student not found');
    }

    const yearId = options.academicYearId || student.academicYear.toString();
    const sem = options.semester || student.semester;
    const subjectFilter = options.subjectId ? new Types.ObjectId(options.subjectId) : null;

    // 1. Attendance percentage
    const sessionMatch: Record<string, any> = {
      section: student.section,
      academicYear: yearId,
      semester: sem,
      status: 'Completed',
    };
    if (subjectFilter) {
      sessionMatch.subject = subjectFilter;
    }

    const sessions = await AttendanceSession.find(sessionMatch).select('_id');
    let attendancePercentage = 0;
    if (sessions.length > 0) {
      const records = await AttendanceRecord.find({
        session: { $in: sessions.map((s) => s._id) },
        student: student._id,
      });
      const attended = records.filter(
        (r) => r.status === 'Present' || r.status === 'Late'
      ).length;
      attendancePercentage = Number(((attended / sessions.length) * 100).toFixed(2));
    }

    // 2. Assignment completion & average marks
    const assignmentMatch: Record<string, any> = {
      section: student.section,
      academicYear: yearId,
      semester: sem,
      status: { $in: ['published', 'closed'] },
    };
    if (subjectFilter) {
      assignmentMatch.subject = subjectFilter;
    }

    const assignments = await Assignment.find(assignmentMatch).select('_id totalMarks');
    let assignmentCompletionRate = 0;
    let assignmentAverageMarks = 0;

    if (assignments.length > 0) {
      const submissions = await AssignmentSubmission.find({
        assignment: { $in: assignments.map((a) => a._id) },
        student: student._id,
      });

      assignmentCompletionRate = Number(
        ((submissions.length / assignments.length) * 100).toFixed(2)
      );

      const evaluatedSubmissions = submissions.filter(
        (s) => s.evaluationStatus === 'evaluated' && typeof s.marksObtained === 'number'
      );

      if (evaluatedSubmissions.length > 0) {
        const assignmentMap = new Map<string, number>();
        for (const a of assignments) {
          assignmentMap.set(a._id.toString(), a.totalMarks);
        }

        const totalPct = evaluatedSubmissions.reduce((acc, sub) => {
          const totalMarks = assignmentMap.get(sub.assignment.toString()) || 100;
          const pct = ((sub.marksObtained || 0) / totalMarks) * 100;
          return acc + pct;
        }, 0);

        assignmentAverageMarks = Number((totalPct / evaluatedSubmissions.length).toFixed(2));
      }
    }

    // 3. Examination & Assessment Results
    const examResultMatch: Record<string, any> = {
      student: student._id,
      academicYear: yearId,
      semester: sem,
    };
    if (subjectFilter) {
      examResultMatch.subject = subjectFilter;
    }

    const examResults = await ExaminationResult.find(examResultMatch).populate(
      'examination',
      'name examinationType maximumMarks passingMarks startDate'
    );

    // Filter valid evaluations (do NOT treat missing marks as 0)
    const validResults = examResults.filter(
      (r) => !r.isExempted && typeof r.percentage === 'number'
    );

    const iaResults = validResults.filter(
      (r) =>
        r.examination &&
        ['IA1', 'IA2', 'IA3'].includes((r.examination as any).examinationType)
    );
    const nonIaResults = validResults.filter(
      (r) =>
        r.examination &&
        !['IA1', 'IA2', 'IA3'].includes((r.examination as any).examinationType)
    );

    let iaMarks = 0;
    if (iaResults.length > 0) {
      const iaTotal = iaResults.reduce((acc, r) => acc + (r.percentage || 0), 0);
      iaMarks = Number((iaTotal / iaResults.length).toFixed(2));
    }

    let examinationMarks = 0;
    if (nonIaResults.length > 0) {
      const examTotal = nonIaResults.reduce((acc, r) => acc + (r.percentage || 0), 0);
      examinationMarks = Number((examTotal / nonIaResults.length).toFixed(2));
    }

    // 4. Dynamic Overall Academic Percentage
    // Handle missing components gracefully by normalizing weights among existing components
    const components: { weight: number; value: number }[] = [];
    if (nonIaResults.length > 0) {
      components.push({ weight: 40, value: examinationMarks });
    }
    if (iaResults.length > 0) {
      components.push({ weight: 35, value: iaMarks });
    }
    if (assignments.length > 0 && assignmentAverageMarks > 0) {
      components.push({ weight: 15, value: assignmentAverageMarks });
    }
    if (sessions.length > 0) {
      components.push({ weight: 10, value: attendancePercentage });
    }

    let overallAcademicPercentage = 0;
    if (components.length > 0) {
      const totalWeight = components.reduce((acc, c) => acc + c.weight, 0);
      const weightedSum = components.reduce((acc, c) => acc + c.value * c.weight, 0);
      overallAcademicPercentage = Number((weightedSum / totalWeight).toFixed(2));
    } else if (validResults.length > 0) {
      // Fallback if only exam results exist
      const total = validResults.reduce((acc, r) => acc + (r.percentage || 0), 0);
      overallAcademicPercentage = Number((total / validResults.length).toFixed(2));
    }

    // 5. Look up previous performance for comparison
    const previousSnapshot = await StudentProgress.findOne({
      student: student._id,
      subject: subjectFilter,
      $or: [
        { isSnapshot: true },
        { academicYear: { $ne: yearId } },
        { semester: { $lt: sem } },
      ],
    }).sort({ snapshotDate: -1, createdAt: -1 });

    const previousAcademicPerformance = previousSnapshot
      ? previousSnapshot.overallAcademicPercentage
      : undefined;

    // 6. Trend Detection: analyze chronological performance
    let progressTrend: ProgressTrend = 'stable';
    if (validResults.length >= 2) {
      const sortedResults = [...validResults].sort((a, b) => {
        const dateA = (a.examination as any)?.startDate
          ? new Date((a.examination as any).startDate).getTime()
          : 0;
        const dateB = (b.examination as any)?.startDate
          ? new Date((b.examination as any).startDate).getTime()
          : 0;
        return dateA - dateB;
      });

      const percentages = sortedResults.map((r) => r.percentage || 0);
      let isStrictlyImproving = true;
      let isStrictlyDeclining = true;
      let maxDelta = 0;

      for (let i = 1; i < percentages.length; i++) {
        const curr = percentages[i] ?? 0;
        const prev = percentages[i - 1] ?? 0;
        const diff = curr - prev;
        if (Math.abs(diff) > maxDelta) maxDelta = Math.abs(diff);
        if (diff <= 0) isStrictlyImproving = false;
        if (diff >= 0) isStrictlyDeclining = false;
      }

      const firstScore = percentages[0] ?? 0;
      const lastScore = percentages[percentages.length - 1] ?? 0;

      if (isStrictlyImproving && lastScore > firstScore + 3) {
        progressTrend = 'improving';
      } else if (isStrictlyDeclining && lastScore < firstScore - 3) {
        progressTrend = 'declining';
      } else if (maxDelta >= 15) {
        progressTrend = 'irregular';
      } else {
        progressTrend = 'stable';
      }
    } else if (previousAcademicPerformance !== undefined) {
      const diff = overallAcademicPercentage - previousAcademicPerformance;
      if (diff >= 3) {
        progressTrend = 'improving';
      } else if (diff <= -3) {
        progressTrend = 'declining';
      } else {
        progressTrend = 'stable';
      }
    }

    // 7. Evaluate Risk Level & Risk Indicators
    const riskEval = await this.riskDetectionService.evaluateStudentRisk(
      student._id.toString(),
      yearId,
      sem
    );

    // 8. Upsert current active record
    const filterQuery: Record<string, any> = {
      student: student._id,
      academicYear: new Types.ObjectId(yearId),
      semester: sem,
      subject: subjectFilter,
      isSnapshot: false,
    };

    const progressDoc = await StudentProgress.findOneAndUpdate(
      filterQuery,
      {
        student: student._id,
        academicYear: new Types.ObjectId(yearId),
        semester: sem,
        section: student.section,
        subject: subjectFilter,
        attendancePercentage,
        assignmentCompletionRate,
        assignmentAverageMarks,
        iaMarks,
        examinationMarks,
        overallAcademicPercentage,
        previousAcademicPerformance,
        currentAcademicPerformance: overallAcademicPercentage,
        progressTrend,
        riskLevel: riskEval.riskLevel,
        riskScore: riskEval.riskScore,
        riskIndicators: riskEval.indicators,
        notes: options.notes,
        lastCalculatedAt: new Date(),
        isSnapshot: false,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // 9. Save historical snapshot if requested
    if (options.saveSnapshot) {
      await StudentProgress.create({
        student: student._id,
        academicYear: new Types.ObjectId(yearId),
        semester: sem,
        section: student.section,
        subject: subjectFilter,
        attendancePercentage,
        assignmentCompletionRate,
        assignmentAverageMarks,
        iaMarks,
        examinationMarks,
        overallAcademicPercentage,
        previousAcademicPerformance,
        currentAcademicPerformance: overallAcademicPercentage,
        progressTrend,
        riskLevel: riskEval.riskLevel,
        riskScore: riskEval.riskScore,
        riskIndicators: riskEval.indicators,
        notes: options.notes,
        isSnapshot: true,
        snapshotDate: new Date(),
        lastCalculatedAt: new Date(),
      });
    }

    return progressDoc;
  }

  /**
   * Retrieve student progress profile
   */
  public async getStudentProgress(
    studentId: string,
    requestingUser: { id: string; role: string },
    options: {
      academicYear?: string;
      semester?: number;
      subjectId?: string;
      recalculate?: boolean;
    } = {}
  ): Promise<any> {
    const student = await this.verifyStudentAccess(studentId, requestingUser);

    const yearId = options.academicYear || student.academicYear.toString();
    const sem = options.semester || student.semester;
    const subjectFilter = options.subjectId ? new Types.ObjectId(options.subjectId) : null;

    if (options.recalculate) {
      return this.calculateStudentProgress(studentId, {
        academicYearId: yearId,
        semester: sem,
        subjectId: options.subjectId,
      });
    }

    let progress: any = await StudentProgress.findOne({
      student: student._id,
      academicYear: yearId,
      semester: sem,
      subject: subjectFilter,
      isSnapshot: false,
    })
      .populate('student', 'firstName lastName usn rollNumber email')
      .populate('academicYear', 'year')
      .populate('section', 'name')
      .populate('subject', 'name code');

    if (!progress) {
      progress = await this.calculateStudentProgress(studentId, {
        academicYearId: yearId,
        semester: sem,
        subjectId: options.subjectId,
      });
    }

    return progress;
  }

  /**
   * Retrieve subject-wise progress list for student
   */
  public async getStudentSubjectWiseProgress(
    studentId: string,
    requestingUser: { id: string; role: string },
    options: { academicYear?: string; semester?: number } = {}
  ): Promise<any[]> {
    const student = await this.verifyStudentAccess(studentId, requestingUser);

    const yearId = options.academicYear || student.academicYear.toString();
    const sem = options.semester || student.semester;

    // Retrieve all active subjects for this semester/department
    const subjects = await Subject.find({
      department: student.department,
      semester: sem,
      status: 'Active',
    });

    const subjectProgressList: any[] = [];
    for (const sub of subjects) {
      const progress = await this.calculateStudentProgress(studentId, {
        academicYearId: yearId,
        semester: sem,
        subjectId: sub._id.toString(),
      });

      subjectProgressList.push({
        subjectId: sub._id,
        subjectName: sub.name,
        subjectCode: sub.code,
        credits: sub.credits,
        attendancePercentage: progress.attendancePercentage,
        assignmentCompletionRate: progress.assignmentCompletionRate,
        assignmentAverageMarks: progress.assignmentAverageMarks,
        iaMarks: progress.iaMarks,
        examinationMarks: progress.examinationMarks,
        overallAcademicPercentage: progress.overallAcademicPercentage,
        progressTrend: progress.progressTrend,
        riskLevel: progress.riskLevel,
      });
    }

    return subjectProgressList;
  }

  /**
   * Retrieve historical academic progress snapshots
   */
  public async getStudentProgressHistory(
    studentId: string,
    requestingUser: { id: string; role: string }
  ): Promise<any> {
    const student = await this.verifyStudentAccess(studentId, requestingUser);

    const snapshots = await StudentProgress.find({
      student: student._id,
      isSnapshot: true,
      subject: null, // overall profiles
    })
      .sort({ snapshotDate: -1 })
      .populate('academicYear', 'year')
      .populate('section', 'name');

    // Also gather current active progress records across semesters
    const activeRecords = await StudentProgress.find({
      student: student._id,
      isSnapshot: false,
      subject: null,
    })
      .sort({ semester: 1 })
      .populate('academicYear', 'year')
      .populate('section', 'name');

    return {
      studentId: student._id,
      studentName: `${student.firstName} ${student.lastName}`,
      usn: student.usn,
      currentSemester: student.semester,
      snapshots,
      semesterProgression: activeRecords.map((r) => ({
        semester: r.semester,
        academicYear: (r.academicYear as any)?.year,
        overallPercentage: r.overallAcademicPercentage,
        attendancePercentage: r.attendancePercentage,
        assignmentCompletionRate: r.assignmentCompletionRate,
        iaMarks: r.iaMarks,
        examinationMarks: r.examinationMarks,
        progressTrend: r.progressTrend,
        riskLevel: r.riskLevel,
        lastCalculatedAt: r.lastCalculatedAt,
      })),
    };
  }

  /**
   * Retrieve student progress performance trends over time
   */
  public async getStudentProgressTrends(
    studentId: string,
    requestingUser: { id: string; role: string },
    options: { academicYear?: string; semester?: number } = {}
  ): Promise<any> {
    const student = await this.verifyStudentAccess(studentId, requestingUser);

    const yearId = options.academicYear || student.academicYear.toString();
    const sem = options.semester || student.semester;

    // Fetch chronological exam results
    const results = await ExaminationResult.find({
      student: student._id,
      academicYear: yearId,
      semester: sem,
    })
      .populate('examination', 'name examinationType startDate maximumMarks')
      .populate('subject', 'name code');

    const timeline = results
      .filter((r) => !r.isExempted && typeof r.percentage === 'number')
      .map((r) => ({
        date: (r.examination as any)?.startDate || r.createdAt,
        title: (r.examination as any)?.name || 'Assessment',
        type: (r.examination as any)?.examinationType || 'Exam',
        subject: (r.subject as any)?.name,
        subjectCode: (r.subject as any)?.code,
        percentage: r.percentage,
        marksObtained: r.marksObtained,
        maximumMarks: r.maximumMarks,
        grade: r.grade,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Current overall progress record
    const progress = await this.calculateStudentProgress(studentId, {
      academicYearId: yearId,
      semester: sem,
    });

    return {
      studentId: student._id,
      studentName: `${student.firstName} ${student.lastName}`,
      usn: student.usn,
      overallAcademicPercentage: progress.overallAcademicPercentage,
      progressTrend: progress.progressTrend,
      riskLevel: progress.riskLevel,
      timeline,
      attendanceRate: progress.attendancePercentage,
      assignmentRate: progress.assignmentCompletionRate,
    };
  }
}
