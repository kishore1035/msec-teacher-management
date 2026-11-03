import { Request, Response } from 'express';
import { ClassSubjectAnalyticsService } from '../services/classSubjectAnalytics.service';
import { ApiResponse } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';

const analyticsService = new ClassSubjectAnalyticsService();

export class AnalyticsController {
  // Class Analytics
  public static getClassOverview = asyncHandler(async (req: Request, res: Response) => {
    const data = await analyticsService.getClassOverview(req.query as any);
    return ApiResponse.success(res, 'Class overview analytics retrieved successfully', data);
  });

  public static getClassPerformance = asyncHandler(async (req: Request, res: Response) => {
    const data = await analyticsService.getClassPerformance(req.query as any);
    return ApiResponse.success(res, 'Class performance analytics retrieved successfully', data);
  });

  public static getClassAttendance = asyncHandler(async (req: Request, res: Response) => {
    const data = await analyticsService.getClassAttendance(req.query as any);
    return ApiResponse.success(res, 'Class attendance analytics retrieved successfully', data);
  });

  public static getClassAssignments = asyncHandler(async (req: Request, res: Response) => {
    const data = await analyticsService.getClassAssignments(req.query as any);
    return ApiResponse.success(res, 'Class assignment analytics retrieved successfully', data);
  });

  // Subject Analytics
  public static getSubjectOverview = asyncHandler(async (req: Request, res: Response) => {
    const data = await analyticsService.getSubjectOverview(req.query as any);
    return ApiResponse.success(res, 'Subject overview analytics retrieved successfully', data);
  });

  public static getSubjectPerformance = asyncHandler(async (req: Request, res: Response) => {
    const data = await analyticsService.getSubjectPerformance(req.query as any);
    return ApiResponse.success(res, 'Subject performance analytics retrieved successfully', data);
  });

  public static getSubjectComparison = asyncHandler(async (req: Request, res: Response) => {
    const data = await analyticsService.getSubjectComparison(req.query as any);
    return ApiResponse.success(res, 'Subject comparison analytics retrieved successfully', data);
  });

  // Teacher Insights
  public static getTeacherOverview = asyncHandler(async (req: Request, res: Response) => {
    const data = await analyticsService.getTeacherOverview(req.user!.id, req.query as any);
    return ApiResponse.success(res, 'Teacher academic overview insights retrieved successfully', data);
  });

  public static getTeacherStudentsAtRisk = asyncHandler(async (req: Request, res: Response) => {
    const data = await analyticsService.getTeacherStudentsAtRisk(req.user!.id, req.query as any);
    return ApiResponse.success(res, 'Teacher at-risk students retrieved successfully', data);
  });
}
