import { Request, Response } from 'express';
import { AcademicService } from '../services/academic.service';
import { ApiResponse } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { MESSAGES } from '../constants/messages';
import { ApiError } from '../utils/apiError';

export class AcademicController {
  // Academic Years
  static createAcademicYear = asyncHandler(async (req: Request, res: Response) => {
    const result = await AcademicService.createAcademicYear(req.body, req.user?.id);
    return ApiResponse.created(res, MESSAGES.RESOURCE_CREATED, result);
  });

  static getAcademicYears = asyncHandler(async (req: Request, res: Response) => {
    const result = await AcademicService.getAcademicYears({ status: req.query['status'] as string });
    return ApiResponse.success(res, MESSAGES.RESOURCE_FETCHED, result);
  });

  static getCurrentAcademicYear = asyncHandler(async (_req: Request, res: Response) => {
    const result = await AcademicService.getCurrentAcademicYear();
    return ApiResponse.success(res, MESSAGES.RESOURCE_FETCHED, result);
  });

  static getAcademicYearById = asyncHandler(async (req: Request, res: Response) => {
    const result = await AcademicService.getAcademicYearById(req.params['id'] as string);
    return ApiResponse.success(res, MESSAGES.RESOURCE_FETCHED, result);
  });

  static updateAcademicYear = asyncHandler(async (req: Request, res: Response) => {
    const result = await AcademicService.updateAcademicYear(req.params['id'] as string, req.body);
    return ApiResponse.success(res, MESSAGES.RESOURCE_UPDATED, result);
  });

  static setCurrentAcademicYear = asyncHandler(async (req: Request, res: Response) => {
    const result = await AcademicService.setCurrentAcademicYear(req.params['id'] as string);
    return ApiResponse.success(res, MESSAGES.CURRENT_ACADEMIC_YEAR_SET, result);
  });

  // Departments
  static createDepartment = asyncHandler(async (req: Request, res: Response) => {
    const result = await AcademicService.createDepartment(req.body);
    return ApiResponse.created(res, MESSAGES.RESOURCE_CREATED, result);
  });

  static getDepartments = asyncHandler(async (req: Request, res: Response) => {
    const result = await AcademicService.getDepartments({ status: req.query['status'] as string });
    return ApiResponse.success(res, MESSAGES.RESOURCE_FETCHED, result);
  });

  static getDepartmentById = asyncHandler(async (req: Request, res: Response) => {
    const result = await AcademicService.getDepartmentById(req.params['id'] as string);
    return ApiResponse.success(res, MESSAGES.RESOURCE_FETCHED, result);
  });

  static updateDepartment = asyncHandler(async (req: Request, res: Response) => {
    const result = await AcademicService.updateDepartment(req.params['id'] as string, req.body);
    return ApiResponse.success(res, MESSAGES.RESOURCE_UPDATED, result);
  });

  // Classes
  static createClass = asyncHandler(async (req: Request, res: Response) => {
    const result = await AcademicService.createClass(req.body);
    return ApiResponse.created(res, MESSAGES.RESOURCE_CREATED, result);
  });

  static getClasses = asyncHandler(async (req: Request, res: Response) => {
    const result = await AcademicService.getClasses({
      department: req.query['department'] as string,
      status: req.query['status'] as string,
    });
    return ApiResponse.success(res, MESSAGES.RESOURCE_FETCHED, result);
  });

  static getClassById = asyncHandler(async (req: Request, res: Response) => {
    const result = await AcademicService.getClassById(req.params['id'] as string);
    return ApiResponse.success(res, MESSAGES.RESOURCE_FETCHED, result);
  });

  static updateClass = asyncHandler(async (req: Request, res: Response) => {
    const result = await AcademicService.updateClass(req.params['id'] as string, req.body);
    return ApiResponse.success(res, MESSAGES.RESOURCE_UPDATED, result);
  });

  // Sections
  static createSection = asyncHandler(async (req: Request, res: Response) => {
    const result = await AcademicService.createSection(req.body);
    return ApiResponse.created(res, MESSAGES.RESOURCE_CREATED, result);
  });

  static getSections = asyncHandler(async (req: Request, res: Response) => {
    const result = await AcademicService.getSections({
      class: req.query['class'] as string,
      academicYear: req.query['academicYear'] as string,
      semester: req.query['semester'] ? parseInt(req.query['semester'] as string, 10) : undefined,
    });
    return ApiResponse.success(res, MESSAGES.RESOURCE_FETCHED, result);
  });

  static getSectionById = asyncHandler(async (req: Request, res: Response) => {
    const result = await AcademicService.getSectionById(req.params['id'] as string);
    return ApiResponse.success(res, MESSAGES.RESOURCE_FETCHED, result);
  });

  static updateSection = asyncHandler(async (req: Request, res: Response) => {
    const result = await AcademicService.updateSection(req.params['id'] as string, req.body);
    return ApiResponse.success(res, MESSAGES.RESOURCE_UPDATED, result);
  });

  // Subjects
  static createSubject = asyncHandler(async (req: Request, res: Response) => {
    const result = await AcademicService.createSubject(req.body);
    return ApiResponse.created(res, MESSAGES.RESOURCE_CREATED, result);
  });

  static getSubjects = asyncHandler(async (req: Request, res: Response) => {
    const result = await AcademicService.getSubjects({
      department: req.query['department'] as string,
      semester: req.query['semester'] ? parseInt(req.query['semester'] as string, 10) : undefined,
      subjectType: req.query['subjectType'] as string,
    });
    return ApiResponse.success(res, MESSAGES.RESOURCE_FETCHED, result);
  });

  static getSubjectById = asyncHandler(async (req: Request, res: Response) => {
    const result = await AcademicService.getSubjectById(req.params['id'] as string);
    return ApiResponse.success(res, MESSAGES.RESOURCE_FETCHED, result);
  });

  static updateSubject = asyncHandler(async (req: Request, res: Response) => {
    const result = await AcademicService.updateSubject(req.params['id'] as string, req.body);
    return ApiResponse.success(res, MESSAGES.RESOURCE_UPDATED, result);
  });

  // Teacher Assignments
  static createTeacherAssignment = asyncHandler(async (req: Request, res: Response) => {
    const result = await AcademicService.createTeacherAssignment(req.body, req.user?.id);
    return ApiResponse.created(res, MESSAGES.RESOURCE_CREATED, result);
  });

  static getTeacherAssignments = asyncHandler(async (req: Request, res: Response) => {
    const result = await AcademicService.getTeacherAssignments({
      teacher: req.query['teacher'] as string,
      section: req.query['section'] as string,
      subject: req.query['subject'] as string,
      academicYear: req.query['academicYear'] as string,
      status: req.query['status'] as string,
    });
    return ApiResponse.success(res, MESSAGES.RESOURCE_FETCHED, result);
  });

  static getTeacherAssignmentById = asyncHandler(async (req: Request, res: Response) => {
    const result = await AcademicService.getTeacherAssignmentById(req.params['id'] as string);
    return ApiResponse.success(res, MESSAGES.RESOURCE_FETCHED, result);
  });

  static updateTeacherAssignment = asyncHandler(async (req: Request, res: Response) => {
    const result = await AcademicService.updateTeacherAssignment(req.params['id'] as string, req.body);
    return ApiResponse.success(res, MESSAGES.RESOURCE_UPDATED, result);
  });

  static deleteTeacherAssignment = asyncHandler(async (req: Request, res: Response) => {
    await AcademicService.deleteTeacherAssignment(req.params['id'] as string);
    return ApiResponse.success(res, MESSAGES.RESOURCE_DELETED, null);
  });

  // Teacher "Me" endpoints
  static getMyClasses = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized(MESSAGES.UNAUTHORIZED);
    const result = await AcademicService.getMyClasses(req.user.id);
    return ApiResponse.success(res, MESSAGES.RESOURCE_FETCHED, result);
  });

  static getMySubjects = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized(MESSAGES.UNAUTHORIZED);
    const result = await AcademicService.getMySubjects(req.user.id);
    return ApiResponse.success(res, MESSAGES.RESOURCE_FETCHED, result);
  });

  static getMyAssignments = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized(MESSAGES.UNAUTHORIZED);
    const result = await AcademicService.getMyAssignments(req.user.id);
    return ApiResponse.success(res, MESSAGES.RESOURCE_FETCHED, result);
  });
}
