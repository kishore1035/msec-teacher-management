import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/apiResponse';
import { examinationService } from '../services/examination.service';
import { resultService } from '../services/result.service';
import { examinationAnalyticsService } from '../services/examinationAnalytics.service';

export class ExaminationController {
  // ==========================================
  // EXAMINATIONS
  // ==========================================

  public static createExamination = asyncHandler(async (req: Request, res: Response) => {
    const exam = await examinationService.createExamination(
      req.user!.id,
      req.user!.role,
      req.body
    );
    return ApiResponse.created(res, 'Examination created successfully', exam);
  });

  public static getExaminations = asyncHandler(async (req: Request, res: Response) => {
    const result = await examinationService.getExaminations(
      req.user!.id,
      req.user!.role,
      req.query as any
    );
    return ApiResponse.success(res, 'Examinations retrieved successfully', result.items, 200, result.meta);
  });

  public static getExaminationById = asyncHandler(async (req: Request, res: Response) => {
    const exam = await examinationService.getExaminationById(req.params['id'] as string);
    return ApiResponse.success(res, 'Examination details retrieved successfully', exam);
  });

  public static updateExamination = asyncHandler(async (req: Request, res: Response) => {
    const exam = await examinationService.updateExamination(
      req.user!.id,
      req.user!.role,
      req.params['id'] as string,
      req.body
    );
    return ApiResponse.success(res, 'Examination updated successfully', exam);
  });

  public static updateExaminationStatus = asyncHandler(async (req: Request, res: Response) => {
    const exam = await examinationService.updateExaminationStatus(
      req.user!.id,
      req.user!.role,
      req.params['id'] as string,
      req.body.status
    );
    return ApiResponse.success(res, 'Examination status updated successfully', exam);
  });

  public static deleteExamination = asyncHandler(async (req: Request, res: Response) => {
    await examinationService.deleteExamination(
      req.user!.id,
      req.user!.role,
      req.params['id'] as string
    );
    return ApiResponse.success(res, 'Examination deleted successfully', null);
  });

  // ==========================================
  // SCHEDULES
  // ==========================================

  public static createSchedule = asyncHandler(async (req: Request, res: Response) => {
    const schedule = await examinationService.scheduleExamination(
      req.user!.id,
      req.user!.role,
      req.params['id'] as string,
      req.body
    );
    return ApiResponse.created(res, 'Examination scheduled successfully', schedule);
  });

  public static getSchedulesForExam = asyncHandler(async (req: Request, res: Response) => {
    const schedules = await examinationService.getSchedulesForExam(req.params['id'] as string);
    return ApiResponse.success(res, 'Examination schedules retrieved successfully', schedules);
  });

  public static updateSchedule = asyncHandler(async (req: Request, res: Response) => {
    const schedule = await examinationService.updateSchedule(
      req.user!.id,
      req.user!.role,
      req.params['id'] as string,
      req.body
    );
    return ApiResponse.success(res, 'Examination schedule updated successfully', schedule);
  });

  public static getMySchedule = asyncHandler(async (req: Request, res: Response) => {
    const schedules = await examinationService.getMySchedule(
      req.user!.id,
      req.user!.role
    );
    return ApiResponse.success(res, 'My examination timetable retrieved successfully', schedules);
  });

  // ==========================================
  // MARKS & RESULTS
  // ==========================================

  public static bulkEnterMarks = asyncHandler(async (req: Request, res: Response) => {
    const results = await resultService.bulkEnterMarks(
      req.user!.id,
      req.user!.role,
      req.params['id'] as string,
      req.body
    );
    return ApiResponse.success(res, 'Examination marks recorded successfully', results);
  });

  public static getMarksForExam = asyncHandler(async (req: Request, res: Response) => {
    const result = await resultService.getMarksForExam(
      req.user!.id,
      req.user!.role,
      req.params['id'] as string,
      req.query as any
    );
    return ApiResponse.success(res, 'Marks retrieved successfully', result.items, 200, result.meta);
  });

  public static correctPublishedResult = asyncHandler(async (req: Request, res: Response) => {
    const result = await resultService.correctPublishedResult(
      req.user!.id,
      req.user!.role,
      req.params['resultId'] as string,
      req.body
    );
    return ApiResponse.success(res, 'Examination result corrected successfully', result);
  });

  public static publishExaminationResults = asyncHandler(async (req: Request, res: Response) => {
    const published = await resultService.publishExaminationResults(
      req.user!.id,
      req.user!.role,
      req.params['examinationId'] as string
    );
    return ApiResponse.success(res, 'Examination results published successfully', published);
  });

  public static getMyResults = asyncHandler(async (req: Request, res: Response) => {
    const results = await resultService.getMyResults(req.user!.id);
    return ApiResponse.success(res, 'My published examination results retrieved successfully', results);
  });

  public static getStudentResults = asyncHandler(async (req: Request, res: Response) => {
    const results = await resultService.getStudentResults(
      req.user!.id,
      req.user!.role,
      req.params['studentId'] as string
    );
    return ApiResponse.success(res, 'Student examination results retrieved successfully', results);
  });

  public static getResultHistory = asyncHandler(async (req: Request, res: Response) => {
    const history = await resultService.getResultHistory(
      req.user!.id,
      req.user!.role,
      req.params['id'] as string
    );
    return ApiResponse.success(res, 'Result modification history retrieved successfully', history);
  });

  // ==========================================
  // INTERNAL ASSESSMENTS & GRADING POLICY
  // ==========================================

  public static configureGradingPolicy = asyncHandler(async (req: Request, res: Response) => {
    const policy = await resultService.configureGradingPolicy(req.user!.id, req.body);
    return ApiResponse.created(res, 'Grading and IA policy configured successfully', policy);
  });

  public static getActiveGradingPolicy = asyncHandler(async (req: Request, res: Response) => {
    const policy = await resultService.getActiveGradingPolicy(req.query['academicYear'] as string);
    return ApiResponse.success(res, 'Active grading policy retrieved successfully', policy);
  });

  public static getInternalAssessmentsForStudent = asyncHandler(async (req: Request, res: Response) => {
    const data = await resultService.getInternalAssessmentsForStudent(
      req.params['studentId'] as string,
      req.query['academicYear'] as string
    );
    return ApiResponse.success(res, 'Internal assessment summary retrieved successfully', data);
  });

  // ==========================================
  // ANALYTICS
  // ==========================================

  public static getOverviewAnalytics = asyncHandler(async (req: Request, res: Response) => {
    const stats = await examinationAnalyticsService.getOverviewAnalytics(req.query as any);
    return ApiResponse.success(res, 'Overview examination analytics retrieved successfully', stats);
  });

  public static getClassAnalytics = asyncHandler(async (req: Request, res: Response) => {
    const stats = await examinationAnalyticsService.getClassAnalytics(req.query as any);
    return ApiResponse.success(res, 'Class-wise examination performance retrieved successfully', stats);
  });

  public static getSubjectAnalytics = asyncHandler(async (req: Request, res: Response) => {
    const stats = await examinationAnalyticsService.getSubjectAnalytics(req.query as any);
    return ApiResponse.success(res, 'Subject-wise examination performance retrieved successfully', stats);
  });

  public static getGradeDistribution = asyncHandler(async (req: Request, res: Response) => {
    const stats = await examinationAnalyticsService.getGradeDistribution(req.query as any);
    return ApiResponse.success(res, 'Grade distribution retrieved successfully', stats);
  });

  public static getStudentAnalytics = asyncHandler(async (req: Request, res: Response) => {
    const stats = await examinationAnalyticsService.getStudentAnalytics(req.params['studentId'] as string);
    return ApiResponse.success(res, 'Student examination performance retrieved successfully', stats);
  });
}
