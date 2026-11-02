import { Request, Response } from 'express';
import { AttendanceService } from '../services/attendance.service';
import { ApiResponse } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { MESSAGES } from '../constants/messages';
import { ApiError } from '../utils/apiError';

export class AttendanceController {
  // Policy
  static createPolicy = asyncHandler(async (req: Request, res: Response) => {
    const policy = await AttendanceService.createPolicy(req.body, req.user);
    return ApiResponse.created(res, MESSAGES.RESOURCE_CREATED, policy);
  });

  static getPolicy = asyncHandler(async (req: Request, res: Response) => {
    const policy = await AttendanceService.getActivePolicy(req.query['academicYear'] as string);
    return ApiResponse.success(res, MESSAGES.RESOURCE_FETCHED, policy);
  });

  static updatePolicy = asyncHandler(async (req: Request, res: Response) => {
    const policy = await AttendanceService.updatePolicy(req.params['id'] as string, req.body, req.user);
    return ApiResponse.success(res, MESSAGES.RESOURCE_UPDATED, policy);
  });

  // Sessions
  static createSession = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized(MESSAGES.UNAUTHORIZED);
    const session = await AttendanceService.createSession(req.body, req.user);
    return ApiResponse.created(res, MESSAGES.RESOURCE_CREATED, session);
  });

  static getSessions = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized(MESSAGES.UNAUTHORIZED);
    const sessions = await AttendanceService.getSessions(
      {
        section: req.query['section'] as string,
        subject: req.query['subject'] as string,
        teacher: req.query['teacher'] as string,
        date: req.query['date'] as string,
        academicYear: req.query['academicYear'] as string,
        status: req.query['status'] as string,
      },
      req.user
    );
    return ApiResponse.success(res, MESSAGES.RESOURCE_FETCHED, sessions);
  });

  static getSessionById = asyncHandler(async (req: Request, res: Response) => {
    const session = await AttendanceService.getSessionById(req.params['id'] as string);
    return ApiResponse.success(res, MESSAGES.RESOURCE_FETCHED, session);
  });

  static updateSession = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized(MESSAGES.UNAUTHORIZED);
    const session = await AttendanceService.updateSession(req.params['id'] as string, req.body, req.user);
    return ApiResponse.success(res, MESSAGES.RESOURCE_UPDATED, session);
  });

  static cancelSession = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized(MESSAGES.UNAUTHORIZED);
    const session = await AttendanceService.cancelSession(
      req.params['id'] as string,
      req.body.reason,
      req.user
    );
    return ApiResponse.success(res, 'Session cancelled successfully', session);
  });

  // Records (Marking & Auditing)
  static bulkMarkAttendance = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized(MESSAGES.UNAUTHORIZED);
    const result = await AttendanceService.bulkMarkAttendance(
      req.params['sessionId'] as string,
      req.body.records,
      req.user
    );
    return ApiResponse.success(res, 'Attendance marked successfully', result);
  });

  static getSessionRecords = asyncHandler(async (req: Request, res: Response) => {
    const records = await AttendanceService.getSessionRecords(req.params['sessionId'] as string);
    return ApiResponse.success(res, MESSAGES.RESOURCE_FETCHED, records);
  });

  static updateRecord = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized(MESSAGES.UNAUTHORIZED);
    const record = await AttendanceService.updateRecord(
      req.params['recordId'] as string,
      req.body,
      req.user
    );
    return ApiResponse.success(res, 'Attendance record updated successfully', record);
  });

  // Reports & Analytics
  static getStudentAttendance = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized(MESSAGES.UNAUTHORIZED);
    const report = await AttendanceService.getStudentAttendanceHistory(
      req.params['studentId'] as string,
      {
        subjectId: req.query['subjectId'] as string,
        startDate: req.query['startDate'] as string,
        endDate: req.query['endDate'] as string,
      },
      req.user
    );
    return ApiResponse.success(res, MESSAGES.RESOURCE_FETCHED, report);
  });

  static getShortages = asyncHandler(async (req: Request, res: Response) => {
    const shortages = await AttendanceService.getShortageList({
      sectionId: req.query['sectionId'] as string,
      subjectId: req.query['subjectId'] as string,
      academicYearId: req.query['academicYearId'] as string,
    });
    return ApiResponse.success(res, MESSAGES.RESOURCE_FETCHED, shortages);
  });

  static getSummary = asyncHandler(async (req: Request, res: Response) => {
    const summary = await AttendanceService.getAttendanceSummary({
      sectionId: req.query['sectionId'] as string,
      subjectId: req.query['subjectId'] as string,
      startDate: req.query['startDate'] as string,
      endDate: req.query['endDate'] as string,
    });
    return ApiResponse.success(res, MESSAGES.RESOURCE_FETCHED, summary);
  });
}
