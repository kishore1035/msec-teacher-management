import { Request, Response } from 'express';
import { ParentService } from '../services/parent.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/apiResponse';

export class ParentController {
  public static createParent = asyncHandler(async (req: Request, res: Response) => {
    const parent = await ParentService.createParent(req.body, req.user!.id);
    return ApiResponse.created(res, 'Parent profile created successfully', parent);
  });

  public static getParents = asyncHandler(async (req: Request, res: Response) => {
    const { items, meta } = await ParentService.getParents(req.query as Record<string, any>);
    return ApiResponse.success(res, 'Parents retrieved successfully', items, 200, meta);
  });

  public static getParentById = asyncHandler(async (req: Request, res: Response) => {
    const parent = await ParentService.getParentById(req.params['id'] as string, req.user!);
    return ApiResponse.success(res, 'Parent profile retrieved successfully', parent);
  });

  public static updateParent = asyncHandler(async (req: Request, res: Response) => {
    const parent = await ParentService.updateParent(
      req.params['id'] as string,
      req.body,
      req.user!.id
    );
    return ApiResponse.success(res, 'Parent profile updated successfully', parent);
  });

  public static linkChild = asyncHandler(async (req: Request, res: Response) => {
    const parent = await ParentService.linkChildToParent(
      req.params['parentId'] as string,
      req.body,
      req.user!.id
    );
    return ApiResponse.success(res, 'Student linked to parent successfully', parent);
  });

  public static unlinkChild = asyncHandler(async (req: Request, res: Response) => {
    const parent = await ParentService.unlinkChildFromParent(
      req.params['parentId'] as string,
      req.params['studentId'] as string,
      req.user!.id
    );
    return ApiResponse.success(res, 'Student unlinked from parent successfully', parent);
  });

  public static getMyChildren = asyncHandler(async (req: Request, res: Response) => {
    const data = await ParentService.getMyChildren(req.user!.id);
    return ApiResponse.success(res, 'Linked children retrieved successfully', data);
  });

  public static getChildProfile = asyncHandler(async (req: Request, res: Response) => {
    const data = await ParentService.getChildProfile(
      req.user!.id,
      req.params['studentId'] as string
    );
    return ApiResponse.success(res, 'Student profile retrieved successfully', data);
  });

  public static getChildAttendance = asyncHandler(async (req: Request, res: Response) => {
    const data = await ParentService.getChildAttendance(
      req.user!.id,
      req.params['studentId'] as string,
      req.query as Record<string, any>
    );
    return ApiResponse.success(res, 'Student attendance retrieved successfully', data);
  });

  public static getChildAssignments = asyncHandler(async (req: Request, res: Response) => {
    const data = await ParentService.getChildAssignments(
      req.user!.id,
      req.params['studentId'] as string,
      req.query as Record<string, any>
    );
    return ApiResponse.success(res, 'Student assignments retrieved successfully', data);
  });

  public static getChildResults = asyncHandler(async (req: Request, res: Response) => {
    const data = await ParentService.getChildResults(
      req.user!.id,
      req.params['studentId'] as string
    );
    return ApiResponse.success(
      res,
      'Published student examination results retrieved successfully',
      data
    );
  });

  public static getChildProgress = asyncHandler(async (req: Request, res: Response) => {
    const data = await ParentService.getChildProgress(
      req.user!.id,
      req.params['studentId'] as string,
      req.query as Record<string, any>
    );
    return ApiResponse.success(res, 'Student academic progress retrieved successfully', data);
  });

  public static getChildTimetable = asyncHandler(async (req: Request, res: Response) => {
    const data = await ParentService.getChildTimetable(
      req.user!.id,
      req.params['studentId'] as string,
      req.query as Record<string, any>
    );
    return ApiResponse.success(res, 'Student timetable retrieved successfully', data);
  });
}

