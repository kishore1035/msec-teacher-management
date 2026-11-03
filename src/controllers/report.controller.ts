import { Request, Response } from 'express';
import { ProgressReportService } from '../services/progressReport.service';
import { ApiResponse } from '../utils/apiResponse';
import { HTTP_STATUS } from '../constants/statusCodes';
import { asyncHandler } from '../utils/asyncHandler';

const reportService = new ProgressReportService();

export class ReportController {
  public static getStudentProgressReport = asyncHandler(async (req: Request, res: Response) => {
    const studentId = req.params['studentId'] as string;
    const { academicYear, semester, format, startDate, endDate } = req.query as any;

    const result = await reportService.generateStudentReport(
      studentId,
      { id: req.user!.id, role: req.user!.role },
      {
        academicYear,
        semester,
        format,
        startDate,
        endDate,
      }
    );

    if (result && result.isExport) {
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      return res.status(HTTP_STATUS.OK).send(result.data);
    }

    return ApiResponse.success(res, 'Student progress report generated successfully', result);
  });

  public static generateStudentProgressReport = asyncHandler(async (req: Request, res: Response) => {
    const studentId = req.params['studentId'] as string;
    const { academicYear, semester, notes, saveSnapshot } = req.body;

    const result = await reportService.generateStudentReport(
      studentId,
      { id: req.user!.id, role: req.user!.role },
      {
        academicYear,
        semester,
        notes,
        saveSnapshot,
      }
    );

    return ApiResponse.success(
      res,
      'Student progress report generated and snapshot archived successfully',
      result
    );
  });

  public static getClassProgressReport = asyncHandler(async (req: Request, res: Response) => {
    const sectionId = req.params['sectionId'] as string;
    const { academicYear, semester, format } = req.query as any;

    const result = await reportService.generateClassReport(
      sectionId,
      { id: req.user!.id, role: req.user!.role },
      {
        academicYear,
        semester,
        format,
      }
    );

    if (result && result.isExport) {
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      return res.status(HTTP_STATUS.OK).send(result.data);
    }

    return ApiResponse.success(res, 'Class progress report generated successfully', result);
  });
}
