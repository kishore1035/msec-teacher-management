import { Types } from 'mongoose';
import {
  ExaminationResult,
  IExaminationResult,
  IResultAudit,
} from '../models/examinationResult.model';
import { Examination, IExamination } from '../models/examination.model';
import { GradingPolicy, IGradingPolicy } from '../models/gradingPolicy.model';
import { Teacher } from '../models/teacher.model';
import { Student } from '../models/student.model';
import { Parent } from '../models/parent.model';
import { Subject } from '../models/subject.model';
import { TeacherAssignment } from '../models/teacherAssignment.model';
import { ApiError } from '../utils/apiError';
import { HTTP_STATUS } from '../constants/statusCodes';
import { ROLES } from '../constants/roles.constant';
import { calculatePagination } from '../utils/pagination';
import { PaginatedResult } from './assignment.service';

export interface StudentMarkEntryDTO {
  student: string;
  marksObtained?: number;
  isAbsent?: boolean;
  isExempted?: boolean;
  remarks?: string;
}

export interface BulkMarksEntryDTO {
  subject: string;
  marks: StudentMarkEntryDTO[];
}

export interface CorrectResultDTO {
  marksObtained: number;
  reason: string;
  remarks?: string;
}

export class ResultService {
  /**
   * Helper: Resolve Teacher profile for user
   */
  private async getTeacherForUser(userId: string) {
    const teacher = await Teacher.findOne({ user: userId });
    if (!teacher || teacher.status !== 'Active') {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        'Active Teacher profile required for this operation'
      );
    }
    return teacher;
  }

  /**
   * Retrieve active or default grading policy
   */
  public async getActiveGradingPolicy(academicYearId?: string): Promise<IGradingPolicy> {
    let policy: IGradingPolicy | null = null;
    if (academicYearId && Types.ObjectId.isValid(academicYearId)) {
      policy = await GradingPolicy.findOne({ academicYear: academicYearId });
    }

    if (!policy) {
      policy = await GradingPolicy.findOne({ isDefault: true });
    }

    if (!policy) {
      // Create default institutional policy if none exists
      policy = await GradingPolicy.create({
        name: 'Standard Institutional 10-Point Scale',
        isDefault: true,
        iaCalculationMethod: 'BEST_2_OF_3',
        minimumPassingPercentage: 40,
        grades: [
          { grade: 'O', minPercentage: 90, maxPercentage: 100, gradePoint: 10, description: 'Outstanding', isPassing: true },
          { grade: 'A+', minPercentage: 80, maxPercentage: 89.99, gradePoint: 9, description: 'Excellent', isPassing: true },
          { grade: 'A', minPercentage: 70, maxPercentage: 79.99, gradePoint: 8, description: 'Very Good', isPassing: true },
          { grade: 'B+', minPercentage: 60, maxPercentage: 69.99, gradePoint: 7, description: 'Good', isPassing: true },
          { grade: 'B', minPercentage: 50, maxPercentage: 59.99, gradePoint: 6, description: 'Above Average', isPassing: true },
          { grade: 'C', minPercentage: 45, maxPercentage: 49.99, gradePoint: 5, description: 'Average', isPassing: true },
          { grade: 'P', minPercentage: 40, maxPercentage: 44.99, gradePoint: 4, description: 'Pass', isPassing: true },
          { grade: 'F', minPercentage: 0, maxPercentage: 39.99, gradePoint: 0, description: 'Fail', isPassing: false },
        ],
      });
    }

    return policy;
  }

  /**
   * Calculate grade and percentage based on active policy
   */
  public calculateGradeAndPercentage(
    marksObtained: number | undefined,
    maximumMarks: number,
    isAbsent: boolean,
    isExempted: boolean,
    policy: IGradingPolicy
  ): {
    percentage?: number;
    grade?: string;
    gradePoint?: number;
    isPassed: boolean;
  } {
    if (isAbsent) {
      return {
        percentage: 0,
        grade: 'AB',
        gradePoint: 0,
        isPassed: false,
      };
    }

    if (isExempted) {
      return {
        percentage: undefined,
        grade: 'EX',
        gradePoint: undefined,
        isPassed: true,
      };
    }

    if (marksObtained === undefined || marksObtained === null) {
      return { isPassed: false };
    }

    const percentage = Number(((marksObtained / maximumMarks) * 100).toFixed(2));
    const isPassed = percentage >= policy.minimumPassingPercentage;

    const matchedTier = policy.grades.find(
      (g) => percentage >= g.minPercentage && percentage <= g.maxPercentage
    );

    const grade = matchedTier ? matchedTier.grade : isPassed ? 'P' : 'F';
    const gradePoint = matchedTier ? matchedTier.gradePoint : isPassed ? 4 : 0;

    return {
      percentage,
      grade,
      gradePoint,
      isPassed,
    };
  }

  /**
   * Bulk Enter Examination Marks
   */
  public async bulkEnterMarks(
    userId: string,
    role: string,
    examId: string,
    data: BulkMarksEntryDTO
  ): Promise<IExaminationResult[]> {
    const exam = await Examination.findById(examId);
    if (!exam) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Examination not found');
    }

    if (exam.status === 'cancelled') {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Cannot enter marks for a cancelled examination');
    }

    const subject = await Subject.findById(data.subject);
    if (!subject) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Subject not found');
    }

    // Role verification: Teachers must be assigned to subject
    if (role === ROLES.TEACHER) {
      const teacher = await this.getTeacherForUser(userId);
      const isAssigned = await TeacherAssignment.findOne({
        teacher: teacher._id,
        subject: subject._id,
        status: 'Active',
      });
      if (!isAssigned) {
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          'You are not actively assigned to teach this subject'
        );
      }
    }

    const policy = await this.getActiveGradingPolicy(exam.academicYear.toString());
    const results: IExaminationResult[] = [];

    for (const entry of data.marks) {
      const student = await Student.findById(entry.student);
      if (!student) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, `Student ${entry.student} not found`);
      }

      if (entry.marksObtained !== undefined) {
        if (entry.marksObtained < 0 || entry.marksObtained > exam.maximumMarks) {
          throw new ApiError(
            HTTP_STATUS.BAD_REQUEST,
            `Marks obtained (${entry.marksObtained}) must be between 0 and maximum marks (${exam.maximumMarks}) for student ${student.usn}`
          );
        }
      }

      const calculated = this.calculateGradeAndPercentage(
        entry.marksObtained,
        exam.maximumMarks,
        Boolean(entry.isAbsent),
        Boolean(entry.isExempted),
        policy
      );

      // Check if result already exists (prevent duplicate results by updating seamless or checking status)
      let result = await ExaminationResult.findOne({
        examination: exam._id,
        student: student._id,
        subject: subject._id,
      });

      if (result) {
        if (result.evaluationStatus === 'published' && role !== ROLES.ADMIN && role !== ROLES.SUPER_ADMIN) {
          throw new ApiError(
            HTTP_STATUS.FORBIDDEN,
            `Results for student ${student.usn} are already published and cannot be overwritten via bulk entry`
          );
        }
        result.marksObtained = entry.marksObtained;
        result.isAbsent = Boolean(entry.isAbsent);
        result.isExempted = Boolean(entry.isExempted);
        result.percentage = calculated.percentage;
        result.grade = calculated.grade;
        result.gradePoint = calculated.gradePoint;
        result.isPassed = calculated.isPassed;
        result.remarks = entry.remarks;
        result.evaluatedBy = new Types.ObjectId(userId);
        result.evaluatedAt = new Date();
        result.evaluationStatus = 'evaluated';
        await result.save();
      } else {
        result = await ExaminationResult.create({
          examination: exam._id,
          student: student._id,
          subject: subject._id,
          academicYear: exam.academicYear,
          semester: exam.semester,
          marksObtained: entry.marksObtained,
          maximumMarks: exam.maximumMarks,
          passingMarks: exam.passingMarks,
          percentage: calculated.percentage,
          grade: calculated.grade,
          gradePoint: calculated.gradePoint,
          isPassed: calculated.isPassed,
          isAbsent: Boolean(entry.isAbsent),
          isExempted: Boolean(entry.isExempted),
          remarks: entry.remarks,
          evaluationStatus: 'evaluated',
          evaluatedBy: new Types.ObjectId(userId),
          evaluatedAt: new Date(),
        });
      }

      results.push(result);
    }

    return results;
  }

  /**
   * Correct a published result with mandatory reason and immutable audit log
   */
  public async correctPublishedResult(
    userId: string,
    role: string,
    resultId: string,
    data: CorrectResultDTO
  ): Promise<IExaminationResult> {
    const result = await ExaminationResult.findById(resultId);
    if (!result) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Examination result not found');
    }

    if (role === ROLES.TEACHER) {
      const teacher = await this.getTeacherForUser(userId);
      const isAssigned = await TeacherAssignment.findOne({
        teacher: teacher._id,
        subject: result.subject,
        status: 'Active',
      });
      if (!isAssigned) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Unauthorized to correct result for this subject');
      }
    }

    if (data.marksObtained < 0 || data.marksObtained > result.maximumMarks) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        `Marks obtained (${data.marksObtained}) must be between 0 and maximum marks (${result.maximumMarks})`
      );
    }

    const policy = await this.getActiveGradingPolicy(result.academicYear.toString());
    const calculated = this.calculateGradeAndPercentage(
      data.marksObtained,
      result.maximumMarks,
      false,
      false,
      policy
    );

    // Immutable audit history entry
    const auditEntry: IResultAudit = {
      previousMarks: result.marksObtained,
      newMarks: data.marksObtained,
      previousGrade: result.grade,
      newGrade: calculated.grade,
      changedBy: new Types.ObjectId(userId),
      reason: data.reason,
      timestamp: new Date(),
    };

    result.auditHistory.push(auditEntry);
    result.marksObtained = data.marksObtained;
    result.isAbsent = false;
    result.isExempted = false;
    result.percentage = calculated.percentage;
    result.grade = calculated.grade;
    result.gradePoint = calculated.gradePoint;
    result.isPassed = calculated.isPassed;
    if (data.remarks) result.remarks = data.remarks;
    result.verifiedBy = new Types.ObjectId(userId);
    result.verifiedAt = new Date();

    await result.save();
    return result;
  }

  /**
   * Publish results for an examination (Admin only)
   */
  public async publishExaminationResults(
    _userId: string,
    _role: string,
    examId: string
  ): Promise<{ count: number }> {
    const exam = await Examination.findById(examId);
    if (!exam) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Examination not found');
    }

    const updateResult = await ExaminationResult.updateMany(
      { examination: exam._id },
      {
        $set: {
          evaluationStatus: 'published',
          publishedAt: new Date(),
        },
      }
    );

    exam.status = 'published';
    await exam.save();

    return { count: updateResult.modifiedCount };
  }

  /**
   * Get authenticated student's own published results
   */
  public async getMyResults(userId: string): Promise<IExaminationResult[]> {
    const student = await Student.findOne({ user: userId });
    if (!student) {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Student profile not found');
    }

    return ExaminationResult.find({
      student: student._id,
      evaluationStatus: 'published',
    })
      .populate('examination', 'name examinationType maximumMarks passingMarks')
      .populate('subject', 'name code credits')
      .sort({ createdAt: -1 });
  }

  /**
   * Get single student's results (RBAC protected)
   */
  public async getStudentResults(
    userId: string,
    role: string,
    studentId: string
  ): Promise<IExaminationResult[]> {
    const student = await Student.findById(studentId);
    if (!student) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Student not found');
    }

    if (role === ROLES.STUDENT) {
      if (student.user.toString() !== userId) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Students can only view their own results');
      }
      return this.getMyResults(userId);
    }

    if (role === ROLES.PARENT) {
      const parent = await Parent.findOne({ user: userId });
      if (!parent || !parent.students.some((sId) => sId.toString() === student._id.toString())) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Parents can only view results for their linked children');
      }
      // Parents only see published results
      return ExaminationResult.find({
        student: student._id,
        evaluationStatus: 'published',
      })
        .populate('examination', 'name examinationType maximumMarks passingMarks')
        .populate('subject', 'name code credits')
        .sort({ createdAt: -1 });
    }

    // Teachers & Admins
    return ExaminationResult.find({ student: student._id })
      .populate('examination', 'name examinationType maximumMarks passingMarks status')
      .populate('subject', 'name code credits')
      .sort({ createdAt: -1 });
  }

  /**
   * Get marks/results for an examination with pagination
   */
  public async getMarksForExam(
    userId: string,
    role: string,
    examId: string,
    query: { page?: number; limit?: number; subject?: string }
  ): Promise<PaginatedResult<IExaminationResult>> {
    const exam = await Examination.findById(examId);
    if (!exam) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Examination not found');
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = { examination: exam._id };
    if (query.subject) filter.subject = query.subject;

    if (role === ROLES.STUDENT) {
      const student = await Student.findOne({ user: userId });
      if (!student) throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Student not found');
      filter.student = student._id;
      filter.evaluationStatus = 'published';
    }

    const [items, total] = await Promise.all([
      ExaminationResult.find(filter)
        .populate('student', 'firstName lastName usn rollNumber')
        .populate('subject', 'name code')
        .sort({ 'student.rollNumber': 1 })
        .skip(skip)
        .limit(limit),
      ExaminationResult.countDocuments(filter),
    ]);

    return {
      items,
      meta: calculatePagination(page, limit, total),
    };
  }

  /**
   * Retrieve audit history for a result
   */
  public async getResultHistory(
    userId: string,
    role: string,
    resultId: string
  ): Promise<IResultAudit[]> {
    const result = await ExaminationResult.findById(resultId).populate('student');
    if (!result) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Result not found');
    }

    const student = result.student as any;
    if (role === ROLES.STUDENT) {
      if (student.user.toString() !== userId) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Unauthorized to view audit history');
      }
    }

    return result.auditHistory;
  }

  /**
   * Internal Assessment Aggregation (IA1, IA2, IA3)
   */
  public async getInternalAssessmentsForStudent(
    studentId: string,
    academicYearId?: string
  ): Promise<any> {
    const student = await Student.findById(studentId);
    if (!student) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Student not found');

    const yearId = academicYearId || student.academicYear.toString();
    const policy = await this.getActiveGradingPolicy(yearId);

    // Find all results for IA1, IA2, IA3
    const iaExams = await Examination.find({
      examinationType: { $in: ['IA1', 'IA2', 'IA3'] },
      academicYear: yearId,
      semester: student.semester,
    }).select('_id name examinationType maximumMarks');

    const examMap = new Map<string, IExamination>();
    for (const e of iaExams) {
      examMap.set(e._id.toString(), e);
    }

    const results = await ExaminationResult.find({
      student: student._id,
      examination: { $in: iaExams.map((e) => e._id) },
    }).populate('subject', 'name code credits');

    // Group by subject
    const subjectMap = new Map<string, any>();
    for (const res of results) {
      const sub = res.subject as any;
      const subId = sub._id.toString();
      const exam = examMap.get(res.examination.toString());
      if (!exam) continue;

      if (!subjectMap.has(subId)) {
        subjectMap.set(subId, {
          subjectId: sub._id,
          subjectName: sub.name,
          subjectCode: sub.code,
          iaScores: {},
        });
      }

      const item = subjectMap.get(subId);
      const score = res.isAbsent ? 0 : res.marksObtained ?? 0;
      item.iaScores[exam.examinationType] = {
        marksObtained: res.isAbsent ? 'AB' : res.marksObtained,
        maximumMarks: res.maximumMarks,
        percentage: res.percentage,
        isAbsent: res.isAbsent,
        scoreValue: score,
        scaledPercentage: (score / res.maximumMarks) * 100,
      };
    }

    // Apply calculation formula
    const subjectList: any[] = [];
    for (const [_, data] of subjectMap) {
      const percentages = Object.values(data.iaScores).map(
        (entry: any) => entry.scaledPercentage || 0
      );

      let finalPercentage = 0;
      if (policy.iaCalculationMethod === 'BEST_2_OF_3') {
        const sorted = [...percentages].sort((a, b) => b - a);
        const top2 = sorted.slice(0, 2);
        finalPercentage = top2.length > 0 ? top2.reduce((acc, v) => acc + v, 0) / top2.length : 0;
      } else if (policy.iaCalculationMethod === 'AVERAGE_ALL') {
        finalPercentage =
          percentages.length > 0
            ? percentages.reduce((acc, v) => acc + v, 0) / percentages.length
            : 0;
      } else if (policy.iaCalculationMethod === 'WEIGHTED') {
        const w = policy.iaWeights || { ia1: 0.3, ia2: 0.3, ia3: 0.4 };
        finalPercentage =
          (data.iaScores['IA1']?.scaledPercentage || 0) * w.ia1 +
          (data.iaScores['IA2']?.scaledPercentage || 0) * w.ia2 +
          (data.iaScores['IA3']?.scaledPercentage || 0) * w.ia3;
      }

      finalPercentage = Number(finalPercentage.toFixed(2));
      const gradeInfo = this.calculateGradeAndPercentage(
        finalPercentage,
        100,
        false,
        false,
        policy
      );

      subjectList.push({
        ...data,
        calculatedInternalPercentage: finalPercentage,
        calculatedGrade: gradeInfo.grade,
        isPassed: gradeInfo.isPassed,
      });
    }

    return {
      student: {
        id: student._id,
        name: `${student.firstName} ${student.lastName}`,
        usn: student.usn,
        semester: student.semester,
      },
      calculationMethod: policy.iaCalculationMethod,
      subjects: subjectList,
    };
  }

  /**
   * Configure Dynamic Grading Policy (Admin only)
   */
  public async configureGradingPolicy(
    userId: string,
    data: Partial<IGradingPolicy>
  ): Promise<IGradingPolicy> {
    if (data.isDefault) {
      await GradingPolicy.updateMany({}, { isDefault: false });
    }

    const policy = await GradingPolicy.create({
      ...data,
      createdBy: new Types.ObjectId(userId),
    });

    return policy;
  }
}

export const resultService = new ResultService();
