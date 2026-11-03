import { Request, Response } from 'express';
import { ParentCommunicationService } from '../services/parentCommunication.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/apiResponse';

export class ParentCommunicationController {
  public static createCommunication = asyncHandler(async (req: Request, res: Response) => {
    const communication = await ParentCommunicationService.createCommunication(
      req.body,
      req.user!
    );
    return ApiResponse.created(
      res,
      'Parent-teacher communication initiated successfully',
      communication
    );
  });

  public static createMeetingRequest = asyncHandler(async (req: Request, res: Response) => {
    const communication = await ParentCommunicationService.createMeetingRequest(
      req.body,
      req.user!
    );
    return ApiResponse.created(
      res,
      'Parent-teacher meeting request created successfully',
      communication
    );
  });

  public static getCommunications = asyncHandler(async (req: Request, res: Response) => {
    const { items, meta } = await ParentCommunicationService.getCommunications(
      req.query as Record<string, any>,
      req.user!
    );
    return ApiResponse.success(
      res,
      'Parent-teacher communications retrieved successfully',
      items,
      200,
      meta
    );
  });

  public static getCommunicationById = asyncHandler(async (req: Request, res: Response) => {
    const data = await ParentCommunicationService.getCommunicationById(
      req.params['id'] as string,
      req.user!
    );
    return ApiResponse.success(
      res,
      'Parent-teacher communication thread retrieved successfully',
      data
    );
  });

  public static addMessage = asyncHandler(async (req: Request, res: Response) => {
    const message = await ParentCommunicationService.addMessage(
      req.params['id'] as string,
      req.body,
      req.user!
    );
    return ApiResponse.created(res, 'Message sent successfully', message);
  });

  public static closeCommunication = asyncHandler(async (req: Request, res: Response) => {
    const communication = await ParentCommunicationService.closeCommunication(
      req.params['id'] as string,
      req.body.reason,
      req.user!
    );
    return ApiResponse.success(
      res,
      'Parent-teacher communication closed successfully',
      communication
    );
  });
}

