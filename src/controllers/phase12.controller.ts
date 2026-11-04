import { Request, Response } from 'express';
import { AIAssistantService } from '../services/aiAssistant.service';
import { DashboardService } from '../services/dashboard.service';
import { CentralReportAnalyticsService } from '../services/centralReportAnalytics.service';
import { ApiResponse } from '../utils/apiResponse';
import { HTTP_STATUS } from '../constants/statusCodes';
import { asyncHandler } from '../utils/asyncHandler';

export class AIAssistantController {
  public static generateLessonPlan = asyncHandler(async (req: Request, res: Response) => {
    const doc = await AIAssistantService.generateEducationalContent(
      { id: req.user!.id, role: req.user!.role },
      'lesson_plan',
      req.body
    );
    return ApiResponse.success(
      res,
      'AI lesson plan draft generated successfully. Teacher review required before publication.',
      doc,
      HTTP_STATUS.CREATED
    );
  });

  public static generateQuiz = asyncHandler(async (req: Request, res: Response) => {
    const doc = await AIAssistantService.generateEducationalContent(
      { id: req.user!.id, role: req.user!.role },
      'quiz',
      req.body
    );
    return ApiResponse.success(
      res,
      'AI quiz draft generated successfully. Teacher review required before publication.',
      doc,
      HTTP_STATUS.CREATED
    );
  });

  public static generateQuestionPaper = asyncHandler(async (req: Request, res: Response) => {
    const doc = await AIAssistantService.generateEducationalContent(
      { id: req.user!.id, role: req.user!.role },
      'question_paper',
      req.body
    );
    return ApiResponse.success(
      res,
      'AI question paper draft generated successfully. Teacher review required before publication.',
      doc,
      HTTP_STATUS.CREATED
    );
  });

  public static generateAssignment = asyncHandler(async (req: Request, res: Response) => {
    const doc = await AIAssistantService.generateEducationalContent(
      { id: req.user!.id, role: req.user!.role },
      'assignment',
      req.body
    );
    return ApiResponse.success(
      res,
      'AI assignment draft generated successfully. Teacher review required before publication.',
      doc,
      HTTP_STATUS.CREATED
    );
  });

  public static generateTopicExplanation = asyncHandler(async (req: Request, res: Response) => {
    const doc = await AIAssistantService.generateEducationalContent(
      { id: req.user!.id, role: req.user!.role },
      'topic_explanation',
      req.body
    );
    return ApiResponse.success(
      res,
      'AI topic explanation draft generated successfully. Teacher review required before publication.',
      doc,
      HTTP_STATUS.CREATED
    );
  });

  public static generateRubric = asyncHandler(async (req: Request, res: Response) => {
    const doc = await AIAssistantService.generateEducationalContent(
      { id: req.user!.id, role: req.user!.role },
      'rubric',
      req.body
    );
    return ApiResponse.success(
      res,
      'AI evaluation rubric draft generated successfully.',
      doc,
      HTTP_STATUS.CREATED
    );
  });

  public static generateStudyMaterialSummary = asyncHandler(async (req: Request, res: Response) => {
    const doc = await AIAssistantService.generateEducationalContent(
      { id: req.user!.id, role: req.user!.role },
      'study_material_summary',
      req.body
    );
    return ApiResponse.success(
      res,
      'AI study material summary draft generated successfully.',
      doc,
      HTTP_STATUS.CREATED
    );
  });

  public static generateTeachingMaterial = asyncHandler(async (req: Request, res: Response) => {
    const doc = await AIAssistantService.generateEducationalContent(
      { id: req.user!.id, role: req.user!.role },
      'teaching_material',
      req.body
    );
    return ApiResponse.success(
      res,
      'AI teaching material draft generated successfully.',
      doc,
      HTTP_STATUS.CREATED
    );
  });

  public static generateLearningOutcomes = asyncHandler(async (req: Request, res: Response) => {
    const doc = await AIAssistantService.generateEducationalContent(
      { id: req.user!.id, role: req.user!.role },
      'learning_outcomes',
      req.body
    );
    return ApiResponse.success(
      res,
      'AI learning outcomes draft generated successfully.',
      doc,
      HTTP_STATUS.CREATED
    );
  });

  public static generateQuestionBank = asyncHandler(async (req: Request, res: Response) => {
    const doc = await AIAssistantService.generateEducationalContent(
      { id: req.user!.id, role: req.user!.role },
      'question_bank',
      req.body
    );
    return ApiResponse.success(
      res,
      'AI question bank draft generated successfully.',
      doc,
      HTTP_STATUS.CREATED
    );
  });

  public static listContent = asyncHandler(async (req: Request, res: Response) => {
    const result = await AIAssistantService.listGeneratedContent(
      { id: req.user!.id, role: req.user!.role },
      req.query as Record<string, any>
    );
    return ApiResponse.success(res, 'AI-generated content retrieved successfully', result);
  });

  public static getContentById = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params['id'] as string;
    const doc = await AIAssistantService.getContentById(id, {
      id: req.user!.id,
      role: req.user!.role,
    });
    return ApiResponse.success(res, 'AI-generated content details retrieved successfully', doc);
  });

  public static updateContent = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params['id'] as string;
    const doc = await AIAssistantService.updateContent(
      id,
      { id: req.user!.id, role: req.user!.role },
      req.body
    );
    return ApiResponse.success(
      res,
      'AI-generated content updated and revision recorded successfully',
      doc
    );
  });

  public static approveContent = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params['id'] as string;
    const doc = await AIAssistantService.approveContent(
      id,
      { id: req.user!.id, role: req.user!.role },
      req.body || {}
    );
    return ApiResponse.success(res, 'AI-generated content approved successfully', doc);
  });

  public static rejectContent = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params['id'] as string;
    const doc = await AIAssistantService.rejectContent(
      id,
      { id: req.user!.id, role: req.user!.role },
      req.body
    );
    return ApiResponse.success(res, 'AI-generated content rejected', doc);
  });

  public static deleteContent = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params['id'] as string;
    await AIAssistantService.deleteContent(id, {
      id: req.user!.id,
      role: req.user!.role,
    });
    return ApiResponse.success(res, 'AI-generated content deleted successfully', null);
  });

  public static getUsageSummary = asyncHandler(async (req: Request, res: Response) => {
    const data = await AIAssistantService.getUserUsageSummary({
      id: req.user!.id,
      role: req.user!.role,
    });
    return ApiResponse.success(res, 'AI usage summary retrieved successfully', data);
  });

  public static getUsageAnalytics = asyncHandler(async (req: Request, res: Response) => {
    const data = await AIAssistantService.getAdminUsageAnalytics(req.query as Record<string, any>);
    return ApiResponse.success(res, 'Institution AI usage analytics retrieved successfully', data);
  });

  public static listPolicies = asyncHandler(async (_req: Request, res: Response) => {
    const policies = await AIAssistantService.listPolicies();
    return ApiResponse.success(res, 'AI usage policies retrieved successfully', policies);
  });

  public static upsertPolicy = asyncHandler(async (req: Request, res: Response) => {
    const policy = await AIAssistantService.upsertPolicy(
      { id: req.user!.id, role: req.user!.role },
      req.body
    );
    return ApiResponse.success(
      res,
      'AI usage policy configured successfully',
      policy,
      HTTP_STATUS.CREATED
    );
  });
}

export class DashboardController {
  public static getAdminDashboard = asyncHandler(async (req: Request, res: Response) => {
    const data = await DashboardService.getAdminDashboard(
      req.user!.id,
      req.query as Record<string, any>
    );
    return ApiResponse.success(res, 'Administrator dashboard retrieved successfully', data);
  });

  public static getTeacherDashboard = asyncHandler(async (req: Request, res: Response) => {
    const data = await DashboardService.getTeacherDashboard(
      req.user!.id,
      req.query as Record<string, any>
    );
    return ApiResponse.success(res, 'Teacher dashboard retrieved successfully', data);
  });

  public static getStudentDashboard = asyncHandler(async (req: Request, res: Response) => {
    const data = await DashboardService.getStudentDashboard(
      req.user!.id,
      req.query as Record<string, any>
    );
    return ApiResponse.success(res, 'Student dashboard retrieved successfully', data);
  });

  public static getParentDashboard = asyncHandler(async (req: Request, res: Response) => {
    const data = await DashboardService.getParentDashboard(
      req.user!.id,
      req.query as Record<string, any>
    );
    return ApiResponse.success(res, 'Parent dashboard retrieved successfully', data);
  });
}

export class CentralAnalyticsController {
  public static getOverview = asyncHandler(async (req: Request, res: Response) => {
    const data = await CentralReportAnalyticsService.getOverviewAnalytics(
      { id: req.user!.id, role: req.user!.role },
      req.query as Record<string, any>
    );
    return ApiResponse.success(res, 'Academic overview analytics retrieved successfully', data);
  });

  public static getAttendance = asyncHandler(async (req: Request, res: Response) => {
    const data = await CentralReportAnalyticsService.getAttendanceAnalytics(
      { id: req.user!.id, role: req.user!.role },
      req.query as Record<string, any>
    );
    return ApiResponse.success(res, 'Attendance analytics retrieved successfully', data);
  });

  public static getAssignments = asyncHandler(async (req: Request, res: Response) => {
    const data = await CentralReportAnalyticsService.getAssignmentsAnalytics(
      { id: req.user!.id, role: req.user!.role },
      req.query as Record<string, any>
    );
    return ApiResponse.success(res, 'Assignment analytics retrieved successfully', data);
  });

  public static getExaminations = asyncHandler(async (req: Request, res: Response) => {
    const data = await CentralReportAnalyticsService.getExaminationsAnalytics(
      { id: req.user!.id, role: req.user!.role },
      req.query as Record<string, any>
    );
    return ApiResponse.success(res, 'Examination analytics retrieved successfully', data);
  });

  public static getStudentProgress = asyncHandler(async (req: Request, res: Response) => {
    const data = await CentralReportAnalyticsService.getStudentProgressAnalytics(
      { id: req.user!.id, role: req.user!.role },
      req.query as Record<string, any>
    );
    return ApiResponse.success(res, 'Student progress analytics retrieved successfully', data);
  });
}

export class CentralReportController {
  public static generateReport = asyncHandler(async (req: Request, res: Response) => {
    const job = await CentralReportAnalyticsService.createReportJob(
      { id: req.user!.id, role: req.user!.role },
      req.body
    );
    const statusCode =
      job.status === 'queued' || job.status === 'processing'
        ? HTTP_STATUS.ACCEPTED || 202
        : HTTP_STATUS.CREATED;
    return ApiResponse.success(res, 'Report generation job created successfully', job, statusCode);
  });

  public static listReports = asyncHandler(async (req: Request, res: Response) => {
    const result = await CentralReportAnalyticsService.listReportJobs(
      { id: req.user!.id, role: req.user!.role },
      req.query as Record<string, any>
    );
    return ApiResponse.success(res, 'Report jobs retrieved successfully', result);
  });

  public static getReportById = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params['id'] as string;
    const job = await CentralReportAnalyticsService.getReportJobById(id, {
      id: req.user!.id,
      role: req.user!.role,
    });
    return ApiResponse.success(res, 'Report job details retrieved successfully', job);
  });

  public static getReportStatus = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params['id'] as string;
    const job = await CentralReportAnalyticsService.getReportJobById(id, {
      id: req.user!.id,
      role: req.user!.role,
    });
    return ApiResponse.success(res, 'Report job status retrieved successfully', {
      id: job._id,
      reportType: job.reportType,
      exportFormat: job.exportFormat,
      status: job.status,
      rowCount: job.rowCount,
      requestedAt: job.requestedAt,
      completedAt: job.completedAt,
      expiresAt: job.expiresAt,
      errorDetails: job.errorDetails,
    });
  });

  public static downloadReport = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params['id'] as string;
    const fileInfo = await CentralReportAnalyticsService.downloadReportFile(id, {
      id: req.user!.id,
      role: req.user!.role,
    });

    res.setHeader('Content-Type', fileInfo.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileInfo.fileName}"`
    );
    res.setHeader('Content-Length', String(fileInfo.size));

    fileInfo.stream.pipe(res);
  });

  public static deleteReport = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params['id'] as string;
    await CentralReportAnalyticsService.deleteReportJob(id, {
      id: req.user!.id,
      role: req.user!.role,
    });
    return ApiResponse.success(res, 'Report job and exported file deleted successfully', null);
  });
}
