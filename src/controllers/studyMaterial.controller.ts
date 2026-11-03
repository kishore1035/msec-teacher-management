import { Request, Response } from 'express';
import { StudyMaterialService } from '../services/studyMaterial.service';
import { StudyMaterialAccessService } from '../services/studyMaterialAccess.service';
import { StudyMaterialAnalyticsService } from '../services/studyMaterialAnalytics.service';
import { ApiResponse } from '../utils/apiResponse';
import { HTTP_STATUS } from '../constants/statusCodes';
import { asyncHandler } from '../utils/asyncHandler';

const materialService = new StudyMaterialService();
const accessService = new StudyMaterialAccessService();
const analyticsService = new StudyMaterialAnalyticsService();

export class StudyMaterialController {
  // ==========================================
  // Core Material CRUD & Lifecycle
  // ==========================================

  public static createStudyMaterial = asyncHandler(async (req: Request, res: Response) => {
    const files = (req.files as Express.Multer.File[]) || [];
    const material = await materialService.createStudyMaterial(
      req.user!.id,
      req.user!.role,
      req.body,
      files
    );
    return ApiResponse.created(res, 'Study material created successfully', material);
  });

  public static getStudyMaterials = asyncHandler(async (req: Request, res: Response) => {
    const result = await materialService.getStudyMaterials(
      req.user!.id,
      req.user!.role,
      req.query as any
    );
    return ApiResponse.success(res, 'Study materials retrieved successfully', result.items, HTTP_STATUS.OK, result.meta);
  });

  public static getStudyMaterialById = asyncHandler(async (req: Request, res: Response) => {
    const materialId = req.params['id'] as string;
    const material = await materialService.getStudyMaterialById(
      req.user!.id,
      req.user!.role,
      materialId
    );
    return ApiResponse.success(res, 'Study material retrieved successfully', material);
  });

  public static updateStudyMaterial = asyncHandler(async (req: Request, res: Response) => {
    const materialId = req.params['id'] as string;
    const files = (req.files as Express.Multer.File[]) || [];
    const material = await materialService.updateStudyMaterial(
      req.user!.id,
      req.user!.role,
      materialId,
      req.body,
      files
    );
    return ApiResponse.success(res, 'Study material updated successfully', material);
  });

  public static publishStudyMaterial = asyncHandler(async (req: Request, res: Response) => {
    const materialId = req.params['id'] as string;
    const material = await materialService.publishStudyMaterial(
      req.user!.id,
      req.user!.role,
      materialId
    );
    return ApiResponse.success(res, 'Study material published successfully', material);
  });

  public static archiveStudyMaterial = asyncHandler(async (req: Request, res: Response) => {
    const materialId = req.params['id'] as string;
    const material = await materialService.archiveStudyMaterial(
      req.user!.id,
      req.user!.role,
      materialId
    );
    return ApiResponse.success(res, 'Study material archived successfully', material);
  });

  public static deleteStudyMaterial = asyncHandler(async (req: Request, res: Response) => {
    const materialId = req.params['id'] as string;
    await materialService.deleteStudyMaterial(req.user!.id, req.user!.role, materialId);
    return ApiResponse.success(res, 'Study material deleted successfully', null);
  });

  // ==========================================
  // Version Management
  // ==========================================

  public static getMaterialVersions = asyncHandler(async (req: Request, res: Response) => {
    const materialId = req.params['id'] as string;
    const versions = await materialService.getMaterialVersions(
      req.user!.id,
      req.user!.role,
      materialId
    );
    return ApiResponse.success(res, 'Material versions retrieved successfully', versions);
  });

  public static getMaterialVersionById = asyncHandler(async (req: Request, res: Response) => {
    const materialId = req.params['id'] as string;
    const versionId = req.params['versionId'] as string;
    const version = await materialService.getMaterialVersionById(
      req.user!.id,
      req.user!.role,
      materialId,
      versionId
    );
    return ApiResponse.success(res, 'Material version details retrieved successfully', version);
  });

  // ==========================================
  // Student & Search Access
  // ==========================================

  public static getMyResources = asyncHandler(async (req: Request, res: Response) => {
    const result = await accessService.getMyResources(req.user!.id, req.query as any);
    return ApiResponse.success(res, 'My resources retrieved successfully', result.items, HTTP_STATUS.OK, result.meta);
  });

  public static searchMaterials = asyncHandler(async (req: Request, res: Response) => {
    const result = await accessService.searchMaterials(
      req.user!.id,
      req.user!.role,
      req.query as any
    );
    return ApiResponse.success(res, 'Study materials search results', result.items, HTTP_STATUS.OK, result.meta);
  });

  public static getMaterialsBySubject = asyncHandler(async (req: Request, res: Response) => {
    const subjectId = req.params['subjectId'] as string;
    const result = await accessService.getMaterialsBySubject(
      req.user!.id,
      req.user!.role,
      subjectId,
      req.query as any
    );
    return ApiResponse.success(res, 'Subject materials retrieved successfully', result.items, HTTP_STATUS.OK, result.meta);
  });

  // ==========================================
  // Attachments
  // ==========================================

  public static getAttachments = asyncHandler(async (req: Request, res: Response) => {
    const materialId = req.params['id'] as string;
    const material = await materialService.getStudyMaterialById(
      req.user!.id,
      req.user!.role,
      materialId
    );
    return ApiResponse.success(res, 'Attachments retrieved successfully', material.attachments);
  });

  public static addAttachment = asyncHandler(async (req: Request, res: Response) => {
    const materialId = req.params['id'] as string;
    const file = req.file;
    if (!file) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    const attachment = await accessService.addAttachment(
      req.user!.id,
      req.user!.role,
      materialId,
      file
    );
    return ApiResponse.created(res, 'Attachment added successfully', attachment);
  });

  public static downloadAttachment = asyncHandler(async (req: Request, res: Response) => {
    const attachmentId = req.params['attachmentId'] as string;
    const { stream, filename, mimeType } = await accessService.downloadAttachment(
      req.user!.id,
      req.user!.role,
      attachmentId
    );

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return stream.pipe(res);
  });

  public static deleteAttachment = asyncHandler(async (req: Request, res: Response) => {
    const attachmentId = req.params['attachmentId'] as string;
    await accessService.deleteAttachment(req.user!.id, req.user!.role, attachmentId);
    return ApiResponse.success(res, 'Attachment deleted successfully', null);
  });

  // ==========================================
  // Resource Analytics
  // ==========================================

  public static getOverviewAnalytics = asyncHandler(async (req: Request, res: Response) => {
    const data = await analyticsService.getOverviewAnalytics(req.query as any);
    return ApiResponse.success(res, 'Overview analytics retrieved successfully', data);
  });

  public static getSubjectAnalytics = asyncHandler(async (req: Request, res: Response) => {
    const data = await analyticsService.getSubjectAnalytics(req.query as any);
    return ApiResponse.success(res, 'Subject analytics retrieved successfully', data);
  });

  public static getTeacherAnalytics = asyncHandler(async (req: Request, res: Response) => {
    const data = await analyticsService.getTeacherAnalytics(req.query as any);
    return ApiResponse.success(res, 'Teacher analytics retrieved successfully', data);
  });

  public static getPopularMaterials = asyncHandler(async (req: Request, res: Response) => {
    const data = await analyticsService.getPopularMaterials(req.query as any);
    return ApiResponse.success(res, 'Popular materials retrieved successfully', data);
  });
}
