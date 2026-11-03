import { Types } from 'mongoose';
import { RiskRule, IRiskRule, IRiskWeights, IRiskScoreTiers } from '../models/riskRule.model';
import { Student } from '../models/student.model';
import { AttendanceSession } from '../models/attendanceSession.model';
import { AttendanceRecord } from '../models/attendanceRecord.model';
import { Assignment } from '../models/assignment.model';
import { AssignmentSubmission } from '../models/assignmentSubmission.model';
import { ExaminationResult } from '../models/examinationResult.model';
import { Teacher } from '../models/teacher.model';
import { TeacherAssignment } from '../models/teacherAssignment.model';
import { ROLES } from '../constants/roles.constant';
import { ApiError } from '../utils/apiError';
import { HTTP_STATUS } from '../constants/statusCodes';
import { IRiskIndicator, RiskLevel } from '../models/studentProgress.model';

export interface CreateRiskRuleDTO {
  name: string;
  isDefault?: boolean;
  academicYear?: string;
  attendanceThreshold?: number;
  assignmentCompletionThreshold?: number;
  iaPassPercentageThreshold?: number;
  examPassPercentageThreshold?: number;
  consecutiveDeclinesThreshold?: number;
  failedSubjectsThreshold?: number;
  riskWeights?: IRiskWeights;
  riskScoreTiers?: IRiskScoreTiers;
}

export interface StudentRiskEvaluation {
  studentId: string;
  studentName: string;
  usn: string;
  section: string;
  academicYear: string;
  semester: number;
  riskLevel: RiskLevel;
  riskScore: number;
  indicators: IRiskIndicator[];
  ruleName: string;
  metrics: {
    attendancePercentage: number | null;
    assignmentCompletionRate: number | null;
    iaAveragePercentage: number | null;
    examAveragePercentage: number | null;
    failedSubjectsCount: number;
  };
}

export class RiskDetectionService {
  /**
   * Retrieve active or default Risk Rule
   */
  public async getActiveRiskRule(academicYearId?: string): Promise<IRiskRule> {
    let rule: IRiskRule | null = null;

    if (academicYearId && Types.ObjectId.isValid(academicYearId)) {
      rule = await RiskRule.findOne({ academicYear: academicYearId });
    }

    if (!rule) {
      rule = await RiskRule.findOne({ isDefault: true });
    }

    if (!rule) {
      // Seed default institutional risk rule
      rule = await RiskRule.create({
        name: 'Standard Institutional Risk Evaluation Rule',
        isDefault: true,
        attendanceThreshold: 75,
        assignmentCompletionThreshold: 60,
        iaPassPercentageThreshold: 40,
        examPassPercentageThreshold: 40,
        consecutiveDeclinesThreshold: 2,
        failedSubjectsThreshold: 2,
        riskWeights: {
          attendance: 25,
          assignments: 25,
          internalAssessments: 25,
          examinations: 25,
        },
        riskScoreTiers: {
          high: 60,
          medium: 30,
          low: 0,
        },
      });
    }

    return rule;
  }

  /**
   * Create or update risk rule (Admin operation)
   */
  public async createOrUpdateRiskRule(
    data: CreateRiskRuleDTO,
    userId: string
  ): Promise<IRiskRule> {
    if (data.isDefault) {
      await RiskRule.updateMany({}, { isDefault: false });
    }

    const newRule = await RiskRule.create({
      ...data,
      academicYear: data.academicYear ? new Types.ObjectId(data.academicYear) : undefined,
      createdBy: new Types.ObjectId(userId),
    });

    return newRule;
  }

  /**
   * Evaluate academic risk for a specific student
   */
  public async evaluateStudentRisk(
    studentId: string,
    academicYearId?: string,
    semester?: number
  ): Promise<StudentRiskEvaluation> {
    const student = await Student.findById(studentId).populate('section', 'name');
    if (!student) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Student not found');
    }

    const yearId = academicYearId || student.academicYear.toString();
    const sem = semester || student.semester;
    const rule = await this.getActiveRiskRule(yearId);

    const indicators: IRiskIndicator[] = [];
    let totalRiskScore = 0;

    // 1. Attendance Analysis
    const sessions = await AttendanceSession.find({
      section: student.section,
      academicYear: yearId,
      semester: sem,
      status: 'Completed',
    }).select('_id');

    let attendancePercentage: number | null = null;
    if (sessions.length > 0) {
      const records = await AttendanceRecord.find({
        session: { $in: sessions.map((s) => s._id) },
        student: student._id,
      });

      const attended = records.filter(
        (r) => r.status === 'Present' || r.status === 'Late'
      ).length;
      attendancePercentage = (attended / sessions.length) * 100;

      if (attendancePercentage < rule.attendanceThreshold) {
        const diff = rule.attendanceThreshold - attendancePercentage;
        const contrib = Math.min(
          rule.riskWeights.attendance,
          Math.round((diff / rule.attendanceThreshold) * rule.riskWeights.attendance * 1.5)
        );
        const severity: 'high' | 'medium' | 'low' =
          attendancePercentage < rule.attendanceThreshold - 15 ? 'high' : 'medium';

        indicators.push({
          code: 'LOW_ATTENDANCE',
          message: `Attendance is ${attendancePercentage.toFixed(1)}%, which is below the institutional threshold of ${rule.attendanceThreshold}%`,
          severity,
          scoreContribution: contrib,
        });
        totalRiskScore += contrib;
      }
    }

    // 2. Assignment Completion Analysis
    const assignments = await Assignment.find({
      section: student.section,
      academicYear: yearId,
      semester: sem,
      status: { $in: ['published', 'closed'] },
    }).select('_id totalMarks');

    let assignmentCompletionRate: number | null = null;
    if (assignments.length > 0) {
      const submissions = await AssignmentSubmission.find({
        assignment: { $in: assignments.map((a) => a._id) },
        student: student._id,
      });

      assignmentCompletionRate = (submissions.length / assignments.length) * 100;

      if (assignmentCompletionRate < rule.assignmentCompletionThreshold) {
        const diff = rule.assignmentCompletionThreshold - assignmentCompletionRate;
        const contrib = Math.min(
          rule.riskWeights.assignments,
          Math.round(
            (diff / rule.assignmentCompletionThreshold) * rule.riskWeights.assignments * 1.5
          )
        );
        const severity: 'high' | 'medium' | 'low' =
          assignmentCompletionRate < rule.assignmentCompletionThreshold - 20 ? 'high' : 'medium';

        indicators.push({
          code: 'MISSING_ASSIGNMENTS',
          message: `Assignment completion rate is ${assignmentCompletionRate.toFixed(1)}%, below the required threshold of ${rule.assignmentCompletionThreshold}% (${submissions.length}/${assignments.length} submitted)`,
          severity,
          scoreContribution: contrib,
        });
        totalRiskScore += contrib;
      }
    }

    // 3. Internal Assessments & Examinations
    const examResults = await ExaminationResult.find({
      student: student._id,
      academicYear: yearId,
      semester: sem,
    })
      .populate('examination', 'name examinationType maximumMarks passingMarks startDate')
      .populate('subject', 'name code');

    // Separate IA vs Semester / Other
    const iaResults = examResults.filter(
      (r) =>
        r.examination &&
        ['IA1', 'IA2', 'IA3'].includes((r.examination as any).examinationType)
    );

    // Evaluate IA percentage
    let iaAveragePercentage: number | null = null;
    if (iaResults.length > 0) {
      const scoredIa = iaResults.filter((r) => !r.isExempted);
      if (scoredIa.length > 0) {
        const totalPct = scoredIa.reduce((acc, r) => acc + (r.percentage || 0), 0);
        iaAveragePercentage = totalPct / scoredIa.length;

        if (iaAveragePercentage < rule.iaPassPercentageThreshold) {
          const diff = rule.iaPassPercentageThreshold - iaAveragePercentage;
          const contrib = Math.min(
            rule.riskWeights.internalAssessments,
            Math.round(
              (diff / rule.iaPassPercentageThreshold) * rule.riskWeights.internalAssessments * 1.5
            )
          );
          const severity: 'high' | 'medium' | 'low' =
            iaAveragePercentage < rule.iaPassPercentageThreshold - 10 ? 'high' : 'medium';

          indicators.push({
            code: 'POOR_IA_PERFORMANCE',
            message: `Internal assessment average of ${iaAveragePercentage.toFixed(1)}% is below the passing criteria of ${rule.iaPassPercentageThreshold}%`,
            severity,
            scoreContribution: contrib,
          });
          totalRiskScore += contrib;
        }
      }
    }

    // Evaluate Exam percentage & declines
    let examAveragePercentage: number | null = null;
    const allScoredResults = examResults.filter((r) => !r.isExempted);

    if (allScoredResults.length > 0) {
      const totalPct = allScoredResults.reduce((acc, r) => acc + (r.percentage || 0), 0);
      examAveragePercentage = totalPct / allScoredResults.length;

      if (examAveragePercentage < rule.examPassPercentageThreshold) {
        const diff = rule.examPassPercentageThreshold - examAveragePercentage;
        const contrib = Math.min(
          rule.riskWeights.examinations,
          Math.round(
            (diff / rule.examPassPercentageThreshold) * rule.riskWeights.examinations * 1.5
          )
        );

        indicators.push({
          code: 'POOR_EXAM_PERFORMANCE',
          message: `Overall examination average of ${examAveragePercentage.toFixed(1)}% is below the benchmark of ${rule.examPassPercentageThreshold}%`,
          severity: examAveragePercentage < rule.examPassPercentageThreshold - 10 ? 'high' : 'medium',
          scoreContribution: contrib,
        });
        totalRiskScore += contrib;
      }

      // Check for consecutive declining marks across sequential assessments
      // Sort chronologically
      const sortedResults = [...allScoredResults].sort((a, b) => {
        const dateA = (a.examination as any)?.startDate ? new Date((a.examination as any).startDate).getTime() : 0;
        const dateB = (b.examination as any)?.startDate ? new Date((b.examination as any).startDate).getTime() : 0;
        return dateA - dateB;
      });

      let consecutiveDeclines = 0;
      let maxConsecutiveDeclines = 0;
      for (let i = 1; i < sortedResults.length; i++) {
        const prevItem = sortedResults[i - 1];
        const currItem = sortedResults[i];
        const prev = prevItem?.percentage ?? 0;
        const curr = currItem?.percentage ?? 0;
        if (curr < prev - 2) {
          // meaningful drop of > 2%
          consecutiveDeclines++;
          if (consecutiveDeclines > maxConsecutiveDeclines) {
            maxConsecutiveDeclines = consecutiveDeclines;
          }
        } else {
          consecutiveDeclines = 0;
        }
      }

      if (maxConsecutiveDeclines >= rule.consecutiveDeclinesThreshold) {
        const contrib = 15;
        indicators.push({
          code: 'DECLINING_PERFORMANCE_TREND',
          message: `Demonstrated declining performance trend across ${maxConsecutiveDeclines + 1} sequential assessment evaluations`,
          severity: maxConsecutiveDeclines >= 3 ? 'high' : 'medium',
          scoreContribution: contrib,
        });
        totalRiskScore += contrib;
      }
    }

    // 4. Failed Subjects Count
    const failedResults = examResults.filter((r) => r.isPassed === false && !r.isExempted);
    const failedSubjectsSet = new Set<string>();
    for (const r of failedResults) {
      if (r.subject) failedSubjectsSet.add(r.subject.toString());
    }
    const failedSubjectsCount = failedSubjectsSet.size;

    if (failedSubjectsCount >= rule.failedSubjectsThreshold) {
      const contrib = Math.min(25, failedSubjectsCount * 10);
      indicators.push({
        code: 'MULTIPLE_FAILED_SUBJECTS',
        message: `Student has failing results in ${failedSubjectsCount} subject(s), reaching or exceeding the threshold of ${rule.failedSubjectsThreshold}`,
        severity: 'high',
        scoreContribution: contrib,
      });
      totalRiskScore += contrib;
    }

    // Clamp score to 100
    const finalScore = Math.min(100, Math.max(0, totalRiskScore));

    // Determine Risk Level based on tiers
    let riskLevel: RiskLevel = 'low';
    if (finalScore >= rule.riskScoreTiers.high) {
      riskLevel = 'high';
    } else if (finalScore >= rule.riskScoreTiers.medium) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'low';
    }

    return {
      studentId: student._id.toString(),
      studentName: `${student.firstName} ${student.lastName}`,
      usn: student.usn,
      section: (student.section as any)?.name || student.section.toString(),
      academicYear: yearId,
      semester: sem,
      riskLevel,
      riskScore: finalScore,
      indicators,
      ruleName: rule.name,
      metrics: {
        attendancePercentage,
        assignmentCompletionRate,
        iaAveragePercentage,
        examAveragePercentage,
        failedSubjectsCount,
      },
    };
  }

  /**
   * Retrieve list of at-risk students with role-based scoping
   */
  public async getAtRiskStudents(
    filters: {
      academicYear?: string;
      semester?: number;
      sectionId?: string;
      departmentId?: string;
      riskLevel?: string;
      page?: number;
      limit?: number;
    },
    userRole: string,
    userId: string
  ): Promise<any> {
    const studentQuery: Record<string, any> = { status: 'Active' };

    if (filters.academicYear) studentQuery.academicYear = filters.academicYear;
    if (filters.semester) studentQuery.semester = filters.semester;
    if (filters.departmentId) studentQuery.department = filters.departmentId;

    if (userRole === ROLES.TEACHER) {
      const teacher = await Teacher.findOne({ user: userId });
      if (!teacher) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Teacher profile not found');
      }
      const assignments = await TeacherAssignment.find({
        teacher: teacher._id,
        status: 'Active',
      }).select('section');
      const teacherSectionIds = assignments.map((a) => a.section);

      if (filters.sectionId) {
        if (!teacherSectionIds.some((s) => s.toString() === filters.sectionId)) {
          throw new ApiError(
            HTTP_STATUS.FORBIDDEN,
            'You are not assigned to the requested section'
          );
        }
        studentQuery.section = filters.sectionId;
      } else {
        studentQuery.section = { $in: teacherSectionIds };
      }
    } else if (filters.sectionId) {
      studentQuery.section = filters.sectionId;
    }

    const students = await Student.find(studentQuery).select('_id');
    const evaluations: StudentRiskEvaluation[] = [];

    for (const s of students) {
      const evalResult = await this.evaluateStudentRisk(
        s._id.toString(),
        filters.academicYear,
        filters.semester
      );
      if (!filters.riskLevel || evalResult.riskLevel === filters.riskLevel) {
        evaluations.push(evalResult);
      }
    }

    // Sort by riskScore descending
    evaluations.sort((a, b) => b.riskScore - a.riskScore);

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const startIndex = (page - 1) * limit;
    const paginatedItems = evaluations.slice(startIndex, startIndex + limit);

    return {
      total: evaluations.length,
      page,
      limit,
      totalPages: Math.ceil(evaluations.length / limit) || 1,
      highRiskCount: evaluations.filter((e) => e.riskLevel === 'high').length,
      mediumRiskCount: evaluations.filter((e) => e.riskLevel === 'medium').length,
      lowRiskCount: evaluations.filter((e) => e.riskLevel === 'low').length,
      students: paginatedItems,
    };
  }
}
