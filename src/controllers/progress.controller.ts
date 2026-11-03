import { Request, Response } from 'express';
import { StudentProgressService } from '../services/studentProgress.service';
import { RiskDetectionService } from '../services/riskDetection.service';
import { ApiResponse } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';

const progressService = new StudentProgressService();
const riskService = new RiskDetectionService();

export class ProgressController {
  public static getStudentProgress = asyncHandler(async (req: Request, res: Response) => {
    const studentId = req.params['studentId'] as string;
    const { academicYear, semester, subjectId, recalculate } = req.query as any;

    const progress = await progressService.getStudentProgress(
      studentId,
      { id: req.user!.id, role: req.user!.role },
      {
        academicYear,
        semester,
        subjectId,
        recalculate,
      }
    );

    return ApiResponse.success(res, 'Student progress profile retrieved successfully', progress);
  });

  public static getStudentSubjectWiseProgress = asyncHandler(async (req: Request, res: Response) => {
    const studentId = req.params['studentId'] as string;
    const { academicYear, semester } = req.query as any;

    const subjectProgress = await progressService.getStudentSubjectWiseProgress(
      studentId,
      { id: req.user!.id, role: req.user!.role },
      { academicYear, semester }
    );

    return ApiResponse.success(res, 'Subject-wise progress retrieved successfully', subjectProgress);
  });

  public static getStudentProgressHistory = asyncHandler(async (req: Request, res: Response) => {
    const studentId = req.params['studentId'] as string;

    const history = await progressService.getStudentProgressHistory(
      studentId,
      { id: req.user!.id, role: req.user!.role }
    );

    return ApiResponse.success(res, 'Student progress history retrieved successfully', history);
  });

  public static getStudentProgressTrends = asyncHandler(async (req: Request, res: Response) => {
    const studentId = req.params['studentId'] as string;
    const { academicYear, semester } = req.query as any;

    const trends = await progressService.getStudentProgressTrends(
      studentId,
      { id: req.user!.id, role: req.user!.role },
      { academicYear, semester }
    );

    return ApiResponse.success(res, 'Student progress trends retrieved successfully', trends);
  });

  public static getAtRiskStudents = asyncHandler(async (req: Request, res: Response) => {
    const { academicYear, semester, sectionId, departmentId, riskLevel, page, limit } =
      req.query as any;

    const result = await riskService.getAtRiskStudents(
      {
        academicYear,
        semester,
        sectionId,
        departmentId,
        riskLevel,
        page,
        limit,
      },
      req.user!.role,
      req.user!.id
    );

    return ApiResponse.success(res, 'At-risk students retrieved successfully', result);
  });

  public static getAtRiskStudentById = asyncHandler(async (req: Request, res: Response) => {
    const studentId = req.params['studentId'] as string;
    const { academicYear, semester } = req.query as any;

    // Verify access
    await progressService.verifyStudentAccess(studentId, {
      id: req.user!.id,
      role: req.user!.role,
    });

    const riskEvaluation = await riskService.evaluateStudentRisk(
      studentId,
      academicYear,
      semester
    );

    return ApiResponse.success(res, 'Student risk evaluation retrieved successfully', riskEvaluation);
  });

  public static createOrUpdateRiskRule = asyncHandler(async (req: Request, res: Response) => {
    const rule = await riskService.createOrUpdateRiskRule(req.body, req.user!.id);
    return ApiResponse.created(res, 'Risk rule configured successfully', rule);
  });

  public static getActiveRiskRule = asyncHandler(async (req: Request, res: Response) => {
    const { academicYear } = req.query as any;
    const rule = await riskService.getActiveRiskRule(academicYear);
    return ApiResponse.success(res, 'Active risk rule retrieved successfully', rule);
  });
}
