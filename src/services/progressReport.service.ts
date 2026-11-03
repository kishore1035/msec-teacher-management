import { Student } from '../models/student.model';
import { Section } from '../models/section.model';
import { Teacher } from '../models/teacher.model';
import { TeacherAssignment } from '../models/teacherAssignment.model';
import { StudentProgressService } from './studentProgress.service';
import { ClassSubjectAnalyticsService } from './classSubjectAnalytics.service';
import { ApiError } from '../utils/apiError';
import { HTTP_STATUS } from '../constants/statusCodes';
import { ROLES } from '../constants/roles.constant';

export interface ReportOptionsDTO {
  academicYear?: string;
  semester?: number;
  format?: 'json' | 'pdf' | 'excel' | 'csv';
  startDate?: string;
  endDate?: string;
  notes?: string;
  saveSnapshot?: boolean;
}

export class ProgressReportService {
  private studentProgressService: StudentProgressService;
  private classSubjectAnalyticsService: ClassSubjectAnalyticsService;

  constructor() {
    this.studentProgressService = new StudentProgressService();
    this.classSubjectAnalyticsService = new ClassSubjectAnalyticsService();
  }

  /**
   * Helper: Generate CSV/Excel string from tabular data
   */
  private generateCsv(headers: string[], rows: (string | number)[][]): string {
    const escapeCsv = (val: string | number) => {
      const str = String(val ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headerLine = headers.map(escapeCsv).join(',');
    const rowLines = rows.map((row) => row.map(escapeCsv).join(','));
    return '\uFEFF' + [headerLine, ...rowLines].join('\r\n'); // Include UTF-8 BOM for Excel
  }

  /**
   * Generate Comprehensive Student Academic Progress Report
   */
  public async generateStudentReport(
    studentId: string,
    requestingUser: { id: string; role: string },
    options: ReportOptionsDTO = {}
  ): Promise<any> {
    const student = await this.studentProgressService.verifyStudentAccess(
      studentId,
      requestingUser
    );

    const populatedStudent = await Student.findById(student._id)
      .populate('department', 'name code')
      .populate('class', 'name')
      .populate('section', 'name')
      .populate('academicYear', 'year');

    const yearId = options.academicYear || student.academicYear.toString();
    const sem = options.semester || student.semester;

    // Calculate/retrieve progress profile
    const progress = await this.studentProgressService.calculateStudentProgress(
      student._id.toString(),
      {
        academicYearId: yearId,
        semester: sem,
        saveSnapshot: options.saveSnapshot ?? false,
        notes: options.notes,
      }
    );

    // Retrieve subject-wise breakdown
    const subjectWise = await this.studentProgressService.getStudentSubjectWiseProgress(
      student._id.toString(),
      requestingUser,
      { academicYear: yearId, semester: sem }
    );

    const reportData = {
      institution: 'M. S. Engineering College (MSEC Bengaluru)',
      reportTitle: 'Student Academic Progress & Performance Report',
      generatedAt: new Date().toISOString(),
      student: {
        id: populatedStudent?._id,
        name: `${populatedStudent?.firstName} ${populatedStudent?.lastName}`,
        usn: populatedStudent?.usn,
        rollNumber: populatedStudent?.rollNumber,
        department: (populatedStudent?.department as any)?.name || 'Engineering',
        departmentCode: (populatedStudent?.department as any)?.code || '',
        class: (populatedStudent?.class as any)?.name || 'B.E.',
        section: (populatedStudent?.section as any)?.name || 'A',
        semester: sem,
        academicYear: (populatedStudent?.academicYear as any)?.year || 'Current',
      },
      academicSummary: {
        overallAcademicPercentage: progress.overallAcademicPercentage,
        attendancePercentage: progress.attendancePercentage,
        assignmentCompletionRate: progress.assignmentCompletionRate,
        assignmentAverageMarks: progress.assignmentAverageMarks,
        internalAssessmentAverage: progress.iaMarks,
        examinationAverage: progress.examinationMarks,
        progressTrend: progress.progressTrend,
        riskLevel: progress.riskLevel,
        riskScore: progress.riskScore,
        riskIndicators: progress.riskIndicators,
      },
      subjectBreakdown: subjectWise,
      notes: options.notes || progress.notes,
    };

    if (options.format === 'csv' || options.format === 'excel') {
      const headers = [
        'Subject Code',
        'Subject Name',
        'Credits',
        'Attendance %',
        'Assignment %',
        'IA Marks %',
        'Exam Marks %',
        'Overall %',
        'Trend',
        'Risk Level',
      ];
      const rows = subjectWise.map((s) => [
        s.subjectCode,
        s.subjectName,
        s.credits,
        s.attendancePercentage,
        s.assignmentCompletionRate,
        s.iaMarks,
        s.examinationMarks,
        s.overallAcademicPercentage,
        s.progressTrend,
        s.riskLevel,
      ]);

      const csvContent = this.generateCsv(headers, rows);
      return {
        isExport: true,
        contentType: options.format === 'excel' ? 'application/vnd.ms-excel' : 'text/csv',
        filename: `Student_Report_${student.usn}_Sem${sem}.${options.format === 'excel' ? 'csv' : 'csv'}`,
        data: csvContent,
      };
    }

    if (options.format === 'pdf') {
      // Structured Text-PDF report formatted for terminal or file preview
      const pdfText = `
================================================================================
                    M. S. ENGINEERING COLLEGE (MSEC BENGALURU)
                 STUDENT ACADEMIC PROGRESS & PERFORMANCE REPORT
================================================================================
Generated: ${reportData.generatedAt}
Student:   ${reportData.student.name} (USN: ${reportData.student.usn})
Class:     ${reportData.student.departmentCode} - Semester ${reportData.student.semester} - Section ${reportData.student.section}
--------------------------------------------------------------------------------
OVERALL PERFORMANCE SUMMARY
- Overall Percentage:        ${reportData.academicSummary.overallAcademicPercentage}%
- Attendance Rate:           ${reportData.academicSummary.attendancePercentage}%
- Assignment Completion:     ${reportData.academicSummary.assignmentCompletionRate}%
- Internal Assessment Avg:   ${reportData.academicSummary.internalAssessmentAverage}%
- Examination Avg:           ${reportData.academicSummary.examinationAverage}%
- Academic Progress Trend:   ${reportData.academicSummary.progressTrend.toUpperCase()}
- Academic Risk Level:       ${reportData.academicSummary.riskLevel.toUpperCase()} (Score: ${reportData.academicSummary.riskScore})
--------------------------------------------------------------------------------
SUBJECT-WISE PERFORMANCE BREAKDOWN
${subjectWise.map((s) => `* [${s.subjectCode}] ${s.subjectName.padEnd(25)} | Att: ${String(s.attendancePercentage).padStart(5)}% | IA: ${String(s.iaMarks).padStart(5)}% | Exam: ${String(s.examinationMarks).padStart(5)}% | Overall: ${String(s.overallAcademicPercentage).padStart(5)}%`).join('\n')}
================================================================================
`;
      return {
        isExport: true,
        contentType: 'text/plain',
        filename: `Student_Report_${student.usn}_Sem${sem}.txt`,
        data: pdfText,
      };
    }

    return reportData;
  }

  /**
   * Generate Class-Level Progress Report for Section
   */
  public async generateClassReport(
    sectionId: string,
    requestingUser: { id: string; role: string },
    options: ReportOptionsDTO = {}
  ): Promise<any> {
    const section = await Section.findById(sectionId)
      .populate({
        path: 'class',
        select: 'name department',
        populate: { path: 'department', select: 'name code' },
      })
      .populate('academicYear', 'year');

    if (!section) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Section not found');
    }

    // Role verification
    if (requestingUser.role === ROLES.TEACHER) {
      const teacher = await Teacher.findOne({ user: requestingUser.id });
      if (!teacher) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Teacher profile not found');
      }
      const assigned = await TeacherAssignment.findOne({
        teacher: teacher._id,
        section: section._id,
        status: 'Active',
      });
      if (!assigned) {
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          'You are not authorized to view reports for sections outside your assignment'
        );
      }
    } else if (
      requestingUser.role !== ROLES.SUPER_ADMIN &&
      requestingUser.role !== ROLES.ADMIN
    ) {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        'Only teachers and administrators can generate class reports'
      );
    }

    const yearId = options.academicYear || section.academicYear._id.toString();
    const sem = options.semester || section.semester;

    // Get overview analytics
    const classOverview = await this.classSubjectAnalyticsService.getClassOverview({
      section: section._id.toString(),
      academicYear: yearId,
      semester: sem,
    });

    // Get class performance
    const classPerformance = await this.classSubjectAnalyticsService.getClassPerformance({
      section: section._id.toString(),
      academicYear: yearId,
      semester: sem,
    });

    const reportData = {
      institution: 'M. S. Engineering College (MSEC Bengaluru)',
      reportTitle: 'Class Academic Performance & Progress Report',
      generatedAt: new Date().toISOString(),
      section: {
        id: section._id,
        name: section.sectionName,
        semester: sem,
        class: (section.class as any)?.name,
        academicYear: (section.academicYear as any)?.year,
      },
      classOverview,
      subjectAverages: classPerformance.subjectAverages,
      gradeDistribution: classPerformance.gradeDistribution,
      topPerformers: classPerformance.topPerformers,
      studentsRequiringAttention: classPerformance.studentsRequiringAttention,
    };

    if (options.format === 'csv' || options.format === 'excel') {
      const headers = ['Metric / Subject', 'Score / Average %', 'Notes'];
      const rows: (string | number)[][] = [
        ['Total Students', classOverview.totalStudents, ''],
        ['Class Average %', classOverview.classAverage, ''],
        ['Attendance Average %', classOverview.attendanceAverage, ''],
        ['Assignment Completion %', classOverview.assignmentCompletionRate, ''],
        ['Exam Pass Rate %', classOverview.examinationPassRate, ''],
        ...classPerformance.subjectAverages.map((s: any) => [
          `Subject: ${s.subjectName} (${s.subjectCode})`,
          s.averageMarks,
          `${s.evaluationsCount} evaluations`,
        ]),
      ];

      const csvContent = this.generateCsv(headers, rows);
      return {
        isExport: true,
        contentType: options.format === 'excel' ? 'application/vnd.ms-excel' : 'text/csv',
        filename: `Class_Report_${section.sectionName}_Sem${sem}.${options.format === 'excel' ? 'csv' : 'csv'}`,
        data: csvContent,
      };
    }

    return reportData;
  }
}
