import { Request, Response } from 'express';
import { TeacherManagementService } from '../services/teacherManagement.service';
import { LeaveService } from '../services/leave.service';
import { SubstitutionService } from '../services/substitution.service';
import { TeacherWorkloadAnalyticsService } from '../services/teacherWorkloadAnalytics.service';
import { ApiResponse } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';
import { asyncHandler } from '../utils/asyncHandler';

export class TeacherManagementController {
  public static listTeachers = asyncHandler(async (req: Request, res: Response) => {
    const result = await TeacherManagementService.listTeachers({
      page: req.query['page'] ? Number(req.query['page']) : undefined,
      limit: req.query['limit'] ? Number(req.query['limit']) : undefined,
      search: req.query['search'] as string | undefined,
      department: req.query['department'] as string | undefined,
      designation: req.query['designation'] as string | undefined,
      specialization: req.query['specialization'] as string | undefined,
      employmentCategory: req.query['employmentCategory'] as string | undefined,
      status: req.query['status'] as string | undefined,
      isActive:
        req.query['isActive'] !== undefined
          ? String(req.query['isActive']) === 'true'
          : undefined,
    });
    return ApiResponse.success(
      res,
      'Teachers retrieved successfully',
      result.teachers,
      200,
      result.meta
    );
  });

  public static createTeacher = asyncHandler(async (req: Request, res: Response) => {
    const teacher = await TeacherManagementService.createTeacherProfile(req.body);
    return ApiResponse.created(res, 'Teacher profile created successfully', teacher);
  });

  public static getMyProfile = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized('Authentication required');
    const result = await TeacherManagementService.getMyProfile(req.user.id);
    return ApiResponse.success(res, 'Teacher profile retrieved successfully', result);
  });

  public static getTeacherById = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized('Authentication required');
    const teacher = await TeacherManagementService.getTeacherById(
      req.params['id'] as string,
      { id: req.user.id, role: req.user.role }
    );
    return ApiResponse.success(res, 'Teacher profile retrieved successfully', teacher);
  });

  public static updateTeacher = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized('Authentication required');
    const teacher = await TeacherManagementService.updateTeacherProfile(
      req.params['id'] as string,
      req.body,
      { id: req.user.id, role: req.user.role }
    );
    return ApiResponse.success(res, 'Teacher profile updated successfully', teacher);
  });

  public static getTeacherClasses = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized('Authentication required');
    const result = await TeacherManagementService.getTeacherClassesAndSubjects(
      req.params['id'] as string,
      {
        academicYear: req.query['academicYear'] as string | undefined,
        semester: req.query['semester'] ? Number(req.query['semester']) : undefined,
      },
      { id: req.user.id, role: req.user.role }
    );
    return ApiResponse.success(res, 'Teacher assigned classes and subjects retrieved successfully', result);
  });

  public static getTeacherTimetable = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized('Authentication required');
    const result = await TeacherManagementService.getTeacherTimetable(
      req.params['id'] as string,
      {
        academicYear: req.query['academicYear'] as string | undefined,
        semester: req.query['semester'] ? Number(req.query['semester']) : undefined,
        date: req.query['date'] as string | undefined,
      },
      { id: req.user.id, role: req.user.role }
    );
    return ApiResponse.success(res, 'Teacher timetable retrieved successfully', result);
  });

  public static getTeacherWorkload = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized('Authentication required');
    const result = await TeacherManagementService.getTeacherWorkloadSummary(
      req.params['id'] as string,
      {
        academicYear: req.query['academicYear'] as string | undefined,
        semester: req.query['semester'] ? Number(req.query['semester']) : undefined,
        startDate: req.query['startDate'] as string | undefined,
        endDate: req.query['endDate'] as string | undefined,
      },
      { id: req.user.id, role: req.user.role }
    );
    return ApiResponse.success(res, 'Teacher workload summary retrieved successfully', result);
  });

  public static getTeacherLeaveHistory = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized('Authentication required');
    const result = await TeacherManagementService.getTeacherLeaveHistory(
      req.params['id'] as string,
      {
        status: req.query['status'] as string | undefined,
        startDate: req.query['startDate'] as string | undefined,
        endDate: req.query['endDate'] as string | undefined,
        academicYear: req.query['academicYear'] as string | undefined,
        page: req.query['page'] ? Number(req.query['page']) : undefined,
        limit: req.query['limit'] ? Number(req.query['limit']) : undefined,
      },
      { id: req.user.id, role: req.user.role }
    );
    return ApiResponse.success(
      res,
      'Teacher leave history retrieved successfully',
      result,
      200,
      result.meta
    );
  });

  public static getTeacherSubstitutions = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized('Authentication required');
    const result = await TeacherManagementService.getTeacherSubstitutionHistory(
      req.params['id'] as string,
      {
        status: req.query['status'] as string | undefined,
        startDate: req.query['startDate'] as string | undefined,
        endDate: req.query['endDate'] as string | undefined,
        page: req.query['page'] ? Number(req.query['page']) : undefined,
        limit: req.query['limit'] ? Number(req.query['limit']) : undefined,
      },
      { id: req.user.id, role: req.user.role }
    );
    return ApiResponse.success(
      res,
      'Teacher substitution history retrieved successfully',
      result,
      200,
      result.meta
    );
  });
}

export class LeaveController {
  // Policies
  public static listPolicies = asyncHandler(async (req: Request, res: Response) => {
    const policies = await LeaveService.listPolicies({
      isActive:
        req.query['isActive'] !== undefined
          ? String(req.query['isActive']) === 'true'
          : undefined,
      academicYear: req.query['academicYear'] as string | undefined,
    });
    return ApiResponse.success(res, 'Leave policies retrieved successfully', policies);
  });

  public static createPolicy = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized('Authentication required');
    const policy = await LeaveService.createPolicy(req.body, req.user.id);
    return ApiResponse.created(res, 'Leave policy created successfully', policy);
  });

  public static updatePolicy = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized('Authentication required');
    const policy = await LeaveService.updatePolicy(
      req.params['id'] as string,
      req.body,
      req.user.id
    );
    return ApiResponse.success(res, 'Leave policy updated successfully', policy);
  });

  public static getBalances = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized('Authentication required');
    const result = await LeaveService.getLeaveBalances(
      {
        teacher: req.query['teacher'] as string | undefined,
        academicYear: req.query['academicYear'] as string | undefined,
        leavePolicy: req.query['leavePolicy'] as string | undefined,
      },
      { id: req.user.id, role: req.user.role }
    );
    return ApiResponse.success(res, 'Leave balances retrieved successfully', result);
  });

  // Leave Requests
  public static submitLeaveRequest = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized('Authentication required');
    const leave = await LeaveService.submitLeaveRequest(req.body, {
      id: req.user.id,
      role: req.user.role,
    });
    return ApiResponse.created(res, 'Leave request submitted successfully', leave);
  });

  public static listLeaveRequests = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized('Authentication required');
    const result = await LeaveService.listLeaveRequests(
      {
        page: req.query['page'] ? Number(req.query['page']) : undefined,
        limit: req.query['limit'] ? Number(req.query['limit']) : undefined,
        teacher: req.query['teacher'] as string | undefined,
        department: req.query['department'] as string | undefined,
        leaveType: req.query['leaveType'] as string | undefined,
        status: req.query['status'] as string | undefined,
        startDate: req.query['startDate'] as string | undefined,
        endDate: req.query['endDate'] as string | undefined,
        academicYear: req.query['academicYear'] as string | undefined,
      },
      { id: req.user.id, role: req.user.role }
    );
    return ApiResponse.success(
      res,
      'Leave requests retrieved successfully',
      result.leaveRequests,
      200,
      result.meta
    );
  });

  public static getLeaveRequestById = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized('Authentication required');
    const leave = await LeaveService.getLeaveRequestById(req.params['id'] as string, {
      id: req.user.id,
      role: req.user.role,
    });
    return ApiResponse.success(res, 'Leave request retrieved successfully', leave);
  });

  public static approveLeaveRequest = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized('Authentication required');
    const comments = req.body.reviewComments || req.body.comments || req.body.reason;
    const leave = await LeaveService.approveLeaveRequest(
      req.params['id'] as string,
      comments,
      { id: req.user.id, role: req.user.role }
    );
    return ApiResponse.success(res, 'Leave request approved successfully', leave);
  });

  public static rejectLeaveRequest = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized('Authentication required');
    const comments = req.body.reviewComments || req.body.comments || req.body.reason;
    const leave = await LeaveService.rejectLeaveRequest(
      req.params['id'] as string,
      comments,
      { id: req.user.id, role: req.user.role }
    );
    return ApiResponse.success(res, 'Leave request rejected successfully', leave);
  });

  public static cancelLeaveRequest = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized('Authentication required');
    const reason = req.body.cancellationReason || req.body.reason;
    const leave = await LeaveService.cancelLeaveRequest(
      req.params['id'] as string,
      reason,
      { id: req.user.id, role: req.user.role }
    );
    return ApiResponse.success(res, 'Leave request cancelled successfully', leave);
  });
}

export class SubstitutionController {
  public static createSubstitution = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized('Authentication required');
    const substitution = await SubstitutionService.createSubstitution(req.body, {
      id: req.user.id,
      role: req.user.role,
    });
    return ApiResponse.created(res, 'Substitution created successfully', substitution);
  });

  public static listSubstitutions = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized('Authentication required');
    const result = await SubstitutionService.listSubstitutions(
      {
        page: req.query['page'] ? Number(req.query['page']) : undefined,
        limit: req.query['limit'] ? Number(req.query['limit']) : undefined,
        absentTeacher: req.query['absentTeacher'] as string | undefined,
        substituteTeacher: req.query['substituteTeacher'] as string | undefined,
        teacher: req.query['teacher'] as string | undefined,
        section: req.query['section'] as string | undefined,
        subject: req.query['subject'] as string | undefined,
        department: req.query['department'] as string | undefined,
        leaveRequest: req.query['leaveRequest'] as string | undefined,
        status: req.query['status'] as string | undefined,
        date: req.query['date'] as string | undefined,
        startDate: req.query['startDate'] as string | undefined,
        endDate: req.query['endDate'] as string | undefined,
      },
      { id: req.user.id, role: req.user.role }
    );
    return ApiResponse.success(
      res,
      'Substitutions retrieved successfully',
      result.substitutions,
      200,
      result.meta
    );
  });

  public static getAvailableTeachers = asyncHandler(async (req: Request, res: Response) => {
    const result = await SubstitutionService.getAvailableSubstituteTeachers({
      timetableEntry: req.query['timetableEntry'] as string | undefined,
      date: req.query['date'] as string,
      periodNumber: req.query['periodNumber'] ? Number(req.query['periodNumber']) : undefined,
      startTime: req.query['startTime'] as string | undefined,
      endTime: req.query['endTime'] as string | undefined,
      subject: req.query['subject'] as string | undefined,
      department: req.query['department'] as string | undefined,
      section: req.query['section'] as string | undefined,
    });
    return ApiResponse.success(res, 'Available substitute teachers retrieved successfully', result);
  });

  public static checkConflicts = asyncHandler(async (req: Request, res: Response) => {
    const result = await SubstitutionService.checkSubstitutionConflicts({
      substituteTeacher: req.query['substituteTeacher'] as string,
      timetableEntry: req.query['timetableEntry'] as string | undefined,
      date: req.query['date'] as string,
      periodNumber: req.query['periodNumber'] ? Number(req.query['periodNumber']) : undefined,
      startTime: req.query['startTime'] as string | undefined,
      endTime: req.query['endTime'] as string | undefined,
      classroom: req.query['classroom'] as string | undefined,
      section: req.query['section'] as string | undefined,
    });
    return ApiResponse.success(res, 'Substitution conflict check completed', result);
  });

  public static getSubstitutionById = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized('Authentication required');
    const substitution = await SubstitutionService.getSubstitutionById(
      req.params['id'] as string,
      { id: req.user.id, role: req.user.role }
    );
    return ApiResponse.success(res, 'Substitution retrieved successfully', substitution);
  });

  public static approveSubstitution = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized('Authentication required');
    const comments = req.body.approvalComments || req.body.comments;
    const substitution = await SubstitutionService.approveSubstitution(
      req.params['id'] as string,
      comments,
      { id: req.user.id, role: req.user.role }
    );
    return ApiResponse.success(res, 'Substitution approved successfully', substitution);
  });

  public static rejectSubstitution = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized('Authentication required');
    const reason = req.body.rejectionReason || req.body.reason || req.body.comments;
    const substitution = await SubstitutionService.rejectSubstitution(
      req.params['id'] as string,
      reason,
      { id: req.user.id, role: req.user.role }
    );
    return ApiResponse.success(res, 'Substitution rejected successfully', substitution);
  });

  public static completeSubstitution = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized('Authentication required');
    const substitution = await SubstitutionService.completeSubstitution(
      req.params['id'] as string,
      req.body,
      { id: req.user.id, role: req.user.role }
    );
    return ApiResponse.success(res, 'Substitution marked as completed', substitution);
  });

  public static cancelSubstitution = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized('Authentication required');
    const reason = req.body.cancellationReason || req.body.reason;
    const substitution = await SubstitutionService.cancelSubstitution(
      req.params['id'] as string,
      reason,
      { id: req.user.id, role: req.user.role }
    );
    return ApiResponse.success(res, 'Substitution cancelled successfully', substitution);
  });
}

export class WorkloadAnalyticsController {
  public static getTeacherWorkload = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized('Authentication required');
    const result = await TeacherWorkloadAnalyticsService.getTeacherWorkloadAnalytics(
      {
        academicYear: req.query['academicYear'] as string | undefined,
        semester: req.query['semester'] ? Number(req.query['semester']) : undefined,
        department: req.query['department'] as string | undefined,
        teacher: req.query['teacher'] as string | undefined,
        startDate: req.query['startDate'] as string | undefined,
        endDate: req.query['endDate'] as string | undefined,
      },
      { id: req.user.id, role: req.user.role }
    );
    return ApiResponse.success(res, 'Teacher workload analytics retrieved successfully', result);
  });

  public static getDepartmentWorkload = asyncHandler(async (req: Request, res: Response) => {
    const result = await TeacherWorkloadAnalyticsService.getDepartmentWorkloadAnalytics({
      academicYear: req.query['academicYear'] as string | undefined,
      semester: req.query['semester'] ? Number(req.query['semester']) : undefined,
      department: req.query['department'] as string | undefined,
      startDate: req.query['startDate'] as string | undefined,
      endDate: req.query['endDate'] as string | undefined,
    });
    return ApiResponse.success(
      res,
      'Department workload distribution retrieved successfully',
      result
    );
  });

  public static getLeaveSummary = asyncHandler(async (req: Request, res: Response) => {
    const result = await TeacherWorkloadAnalyticsService.getLeaveSummaryAnalytics({
      academicYear: req.query['academicYear'] as string | undefined,
      department: req.query['department'] as string | undefined,
      teacher: req.query['teacher'] as string | undefined,
      startDate: req.query['startDate'] as string | undefined,
      endDate: req.query['endDate'] as string | undefined,
    });
    return ApiResponse.success(res, 'Leave summary analytics retrieved successfully', result);
  });

  public static getSubstitutionSummary = asyncHandler(async (req: Request, res: Response) => {
    const result = await TeacherWorkloadAnalyticsService.getSubstitutionSummaryAnalytics({
      department: req.query['department'] as string | undefined,
      teacher: req.query['teacher'] as string | undefined,
      startDate: req.query['startDate'] as string | undefined,
      endDate: req.query['endDate'] as string | undefined,
    });
    return ApiResponse.success(
      res,
      'Substitution summary analytics retrieved successfully',
      result
    );
  });
}
