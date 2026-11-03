import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/apiResponse';
import { AnnouncementService } from '../services/announcement.service';
import {
  AnnouncementStatus,
  AnnouncementType,
  AnnouncementPriority,
} from '../models/announcement.model';

export class AnnouncementController {
  public static createAnnouncement = asyncHandler(async (req: Request, res: Response) => {
    const files = Array.isArray(req.files) ? (req.files as Express.Multer.File[]) : undefined;
    const announcement = await AnnouncementService.createAnnouncement(
      req.user!.id,
      req.user!.role,
      req.body,
      files
    );
    return ApiResponse.created(res, 'Announcement created successfully', announcement);
  });

  public static getAnnouncements = asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as {
      status?: AnnouncementStatus;
      announcementType?: AnnouncementType;
      priority?: AnnouncementPriority;
      search?: string;
      includeExpired?: boolean;
      page?: number;
      limit?: number;
    };
    const { items, meta } = await AnnouncementService.getAnnouncements(
      req.user!.id,
      req.user!.role,
      query
    );
    return ApiResponse.success(
      res,
      'Announcements retrieved successfully',
      items,
      200,
      meta
    );
  });

  public static getAnnouncementById = asyncHandler(async (req: Request, res: Response) => {
    const announcement = await AnnouncementService.getAnnouncementById(
      req.user!.id,
      req.user!.role,
      req.params['id'] as string
    );
    return ApiResponse.success(res, 'Announcement retrieved successfully', announcement);
  });

  public static updateAnnouncement = asyncHandler(async (req: Request, res: Response) => {
    const files = Array.isArray(req.files) ? (req.files as Express.Multer.File[]) : undefined;
    const announcement = await AnnouncementService.updateAnnouncement(
      req.user!.id,
      req.user!.role,
      req.params['id'] as string,
      req.body,
      files
    );
    return ApiResponse.success(res, 'Announcement updated successfully', announcement);
  });

  public static publishAnnouncement = asyncHandler(async (req: Request, res: Response) => {
    const announcement = await AnnouncementService.publishAnnouncement(
      req.user!.id,
      req.user!.role,
      req.params['id'] as string
    );
    return ApiResponse.success(res, 'Announcement published successfully', announcement);
  });

  public static archiveAnnouncement = asyncHandler(async (req: Request, res: Response) => {
    const announcement = await AnnouncementService.archiveAnnouncement(
      req.user!.id,
      req.user!.role,
      req.params['id'] as string
    );
    return ApiResponse.success(res, 'Announcement archived successfully', announcement);
  });

  public static deleteAnnouncement = asyncHandler(async (req: Request, res: Response) => {
    const result = await AnnouncementService.deleteAnnouncement(
      req.user!.id,
      req.user!.role,
      req.params['id'] as string
    );
    return ApiResponse.success(
      res,
      result.deleted
        ? 'Draft announcement deleted successfully'
        : 'Announcement archived to preserve institutional history',
      result
    );
  });

  public static getAnnouncementAnalytics = asyncHandler(
    async (req: Request, res: Response) => {
      const analytics = await AnnouncementService.getAnnouncementAnalytics(
        req.user!.id,
        req.user!.role,
        req.params['id'] as string
      );
      return ApiResponse.success(
        res,
        'Announcement readership analytics retrieved successfully',
        analytics
      );
    }
  );

  public static getAnalyticsOverview = asyncHandler(async (req: Request, res: Response) => {
    const overview = await AnnouncementService.getAnalyticsOverview(
      req.user!.id,
      req.user!.role
    );
    return ApiResponse.success(
      res,
      'Announcement analytics overview retrieved successfully',
      overview
    );
  });
}
