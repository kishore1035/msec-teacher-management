import { Request, Response } from 'express';
import { DoubtService } from '../services/doubt.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/apiResponse';

export class DoubtController {
  public static createDoubt = asyncHandler(async (req: Request, res: Response) => {
    const doubt = await DoubtService.createDoubt(req.body, req.user!);
    return ApiResponse.created(res, 'Doubt submitted successfully', doubt);
  });

  public static getDoubts = asyncHandler(async (req: Request, res: Response) => {
    const { items, meta } = await DoubtService.getDoubts(
      req.query as Record<string, any>,
      req.user!
    );
    return ApiResponse.success(res, 'Doubts retrieved successfully', items, 200, meta);
  });

  public static getDoubtById = asyncHandler(async (req: Request, res: Response) => {
    const doubt = await DoubtService.getDoubtById(req.params['id'] as string, req.user!);
    return ApiResponse.success(res, 'Doubt retrieved successfully', doubt);
  });

  public static updateDoubt = asyncHandler(async (req: Request, res: Response) => {
    const doubt = await DoubtService.updateDoubt(
      req.params['id'] as string,
      req.body,
      req.user!
    );
    return ApiResponse.success(res, 'Doubt updated successfully', doubt);
  });

  public static assignDoubt = asyncHandler(async (req: Request, res: Response) => {
    const doubt = await DoubtService.assignDoubt(
      req.params['id'] as string,
      req.body.assignedTeacher,
      req.body.reason,
      req.user!
    );
    return ApiResponse.success(res, 'Doubt assigned successfully', doubt);
  });

  public static updateDoubtStatus = asyncHandler(async (req: Request, res: Response) => {
    const doubt = await DoubtService.updateDoubtStatus(
      req.params['id'] as string,
      req.body.status,
      req.body.reason,
      req.user!
    );
    return ApiResponse.success(res, 'Doubt status updated successfully', doubt);
  });

  public static addDoubtMessage = asyncHandler(async (req: Request, res: Response) => {
    const message = await DoubtService.addDoubtMessage(
      req.params['id'] as string,
      req.body,
      req.user!
    );
    return ApiResponse.created(res, 'Message posted successfully', message);
  });

  public static getDoubtMessages = asyncHandler(async (req: Request, res: Response) => {
    const { items, meta } = await DoubtService.getDoubtMessages(
      req.params['id'] as string,
      req.query as Record<string, any>,
      req.user!
    );
    return ApiResponse.success(res, 'Doubt messages retrieved successfully', items, 200, meta);
  });

  public static reopenDoubt = asyncHandler(async (req: Request, res: Response) => {
    const doubt = await DoubtService.reopenDoubt(
      req.params['id'] as string,
      req.body.reason,
      req.user!
    );
    return ApiResponse.success(res, 'Doubt reopened successfully', doubt);
  });

  public static getOverviewAnalytics = asyncHandler(async (req: Request, res: Response) => {
    const data = await DoubtService.getOverviewAnalytics(req.query as Record<string, any>);
    return ApiResponse.success(res, 'Doubt overview analytics retrieved successfully', data);
  });

  public static getSubjectAnalytics = asyncHandler(async (req: Request, res: Response) => {
    const data = await DoubtService.getSubjectAnalytics(req.query as Record<string, any>);
    return ApiResponse.success(res, 'Doubt subject analytics retrieved successfully', data);
  });

  public static getTeacherAnalytics = asyncHandler(async (req: Request, res: Response) => {
    const data = await DoubtService.getTeacherWorkloadAnalytics(
      req.query as Record<string, any>
    );
    return ApiResponse.success(res, 'Doubt teacher workload retrieved successfully', data);
  });
}

