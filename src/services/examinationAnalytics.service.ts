import { Types } from 'mongoose';
import { ExaminationResult } from '../models/examinationResult.model';
import { Student } from '../models/student.model';

export interface ExamAnalyticsFilterDTO {
  examination?: string;
  academicYear?: string;
  semester?: number;
  section?: string;
  subject?: string;
}

export class ExaminationAnalyticsService {
  /**
   * Helper: Build match stage from filters
   */
  private buildMatchFilter(filters: ExamAnalyticsFilterDTO): Record<string, any> {
    const match: Record<string, any> = {};
    if (filters.examination) match.examination = new Types.ObjectId(filters.examination);
    if (filters.academicYear) match.academicYear = new Types.ObjectId(filters.academicYear);
    if (filters.semester) match.semester = filters.semester;
    if (filters.subject) match.subject = new Types.ObjectId(filters.subject);
    return match;
  }

  /**
   * High-level examination overview analytics
   */
  public async getOverviewAnalytics(filters: ExamAnalyticsFilterDTO) {
    const match = this.buildMatchFilter(filters);

    const stats = await ExaminationResult.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalStudentsEvaluated: { $sum: 1 },
          passedCount: { $sum: { $cond: [{ $eq: ['$isPassed', true] }, 1, 0] } },
          failedCount: { $sum: { $cond: [{ $eq: ['$isPassed', false] }, 1, 0] } },
          absentCount: { $sum: { $cond: [{ $eq: ['$isAbsent', true] }, 1, 0] } },
          exemptedCount: { $sum: { $cond: [{ $eq: ['$isExempted', true] }, 1, 0] } },
          averageMarks: {
            $avg: {
              $cond: [
                { $and: [{ $ne: ['$isAbsent', true] }, { $ne: ['$isExempted', true] }] },
                '$marksObtained',
                null,
              ],
            },
          },
          highestMarks: {
            $max: {
              $cond: [
                { $and: [{ $ne: ['$isAbsent', true] }, { $ne: ['$isExempted', true] }] },
                '$marksObtained',
                null,
              ],
            },
          },
          lowestMarks: {
            $min: {
              $cond: [
                { $and: [{ $ne: ['$isAbsent', true] }, { $ne: ['$isExempted', true] }] },
                '$marksObtained',
                null,
              ],
            },
          },
          averagePercentage: {
            $avg: {
              $cond: [
                { $and: [{ $ne: ['$isAbsent', true] }, { $ne: ['$isExempted', true] }] },
                '$percentage',
                null,
              ],
            },
          },
        },
      },
    ]);

    const result = stats[0] || {
      totalStudentsEvaluated: 0,
      passedCount: 0,
      failedCount: 0,
      absentCount: 0,
      exemptedCount: 0,
      averageMarks: 0,
      highestMarks: 0,
      lowestMarks: 0,
      averagePercentage: 0,
    };

    const evaluatedNonAbsent = result.totalStudentsEvaluated - result.absentCount;
    const passPercentage =
      evaluatedNonAbsent > 0
        ? Number(((result.passedCount / evaluatedNonAbsent) * 100).toFixed(2))
        : 0;
    const failPercentage =
      evaluatedNonAbsent > 0
        ? Number(((result.failedCount / evaluatedNonAbsent) * 100).toFixed(2))
        : 0;

    return {
      ...result,
      averageMarks: result.averageMarks ? Number(result.averageMarks.toFixed(2)) : 0,
      averagePercentage: result.averagePercentage ? Number(result.averagePercentage.toFixed(2)) : 0,
      passPercentage,
      failPercentage,
    };
  }

  /**
   * Class / Section-wise examination analytics
   */
  public async getClassAnalytics(filters: ExamAnalyticsFilterDTO) {
    const match = this.buildMatchFilter(filters);

    return ExaminationResult.aggregate([
      { $match: match },
      {
        $lookup: {
          from: 'students',
          localField: 'student',
          foreignField: '_id',
          as: 'studentInfo',
        },
      },
      { $unwind: '$studentInfo' },
      {
        $lookup: {
          from: 'sections',
          localField: 'studentInfo.section',
          foreignField: '_id',
          as: 'sectionInfo',
        },
      },
      { $unwind: '$sectionInfo' },
      {
        $group: {
          _id: '$studentInfo.section',
          sectionName: { $first: '$sectionInfo.sectionName' },
          semester: { $first: '$studentInfo.semester' },
          totalEvaluated: { $sum: 1 },
          passed: { $sum: { $cond: [{ $eq: ['$isPassed', true] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ['$isPassed', false] }, 1, 0] } },
          averageMarks: {
            $avg: {
              $cond: [
                { $and: [{ $ne: ['$isAbsent', true] }, { $ne: ['$isExempted', true] }] },
                '$marksObtained',
                null,
              ],
            },
          },
          highestMarks: { $max: '$marksObtained' },
          lowestMarks: { $min: '$marksObtained' },
        },
      },
      { $sort: { semester: 1, sectionName: 1 } },
    ]);
  }

  /**
   * Subject-wise performance breakdown
   */
  public async getSubjectAnalytics(filters: ExamAnalyticsFilterDTO) {
    const match = this.buildMatchFilter(filters);

    return ExaminationResult.aggregate([
      { $match: match },
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
          totalEvaluated: { $sum: 1 },
          passed: { $sum: { $cond: [{ $eq: ['$isPassed', true] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ['$isPassed', false] }, 1, 0] } },
          averageMarks: {
            $avg: {
              $cond: [
                { $and: [{ $ne: ['$isAbsent', true] }, { $ne: ['$isExempted', true] }] },
                '$marksObtained',
                null,
              ],
            },
          },
          highestMarks: { $max: '$marksObtained' },
          lowestMarks: { $min: '$marksObtained' },
        },
      },
      { $sort: { subjectName: 1 } },
    ]);
  }

  /**
   * Grade Distribution
   */
  public async getGradeDistribution(filters: ExamAnalyticsFilterDTO) {
    const match = this.buildMatchFilter(filters);

    return ExaminationResult.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$grade',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);
  }

  /**
   * Student-specific examination performance & at-risk detection
   */
  public async getStudentAnalytics(studentId: string) {
    const student = await Student.findById(studentId);
    if (!student) throw new Error('Student not found');

    const results = await ExaminationResult.find({ student: student._id })
      .populate('examination', 'name examinationType maximumMarks passingMarks')
      .populate('subject', 'name code credits');

    const totalAppeared = results.length;
    const passedCount = results.filter((r) => r.isPassed).length;
    const failedCount = results.filter((r) => !r.isPassed && !r.isExempted).length;
    const isAtRisk = failedCount > 0;

    let totalMarks = 0;
    let maxPossible = 0;
    for (const r of results) {
      if (!r.isAbsent && !r.isExempted && r.marksObtained !== undefined) {
        totalMarks += r.marksObtained;
        maxPossible += r.maximumMarks;
      }
    }

    const overallPercentage =
      maxPossible > 0 ? Number(((totalMarks / maxPossible) * 100).toFixed(2)) : 0;

    return {
      student: {
        id: student._id,
        name: `${student.firstName} ${student.lastName}`,
        usn: student.usn,
        rollNumber: student.rollNumber,
        semester: student.semester,
      },
      totalAppeared,
      passedCount,
      failedCount,
      overallPercentage,
      isAtRisk,
      results,
    };
  }
}

export const examinationAnalyticsService = new ExaminationAnalyticsService();
