import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';
import { TimetableService } from '../services/timetable.service';
import { TimetableConflictService } from '../services/timetableConflict.service';
import { TimetableAccessService } from '../services/timetableAccess.service';
import { TimetableChangeService } from '../services/timetableChange.service';
import { TimetableAnalyticsService } from '../services/timetableAnalytics.service';
import { Student, Parent } from '../models';
import { ROLES } from '../constants/roles.constant';

export class TimetableController {
  // --- Timetable Management ---

  static createTimetable = asyncHandler(async (req: Request, res: Response) => {
    const timetable = await TimetableService.createTimetable(req.body, req.user!.id);
    return ApiResponse.created(res, 'Timetable created successfully', timetable);
  });

  static listTimetables = asyncHandler(async (req: Request, res: Response) => {
    const result = await TimetableService.listTimetables(req.query as Record<string, any>);
    return ApiResponse.success(res, 'Timetables retrieved successfully', result.timetables, 200, result.meta);
  });

  static getTimetableById = asyncHandler(async (req: Request, res: Response) => {
    const timetableId = req.params['id'] as string;
    const result = await TimetableService.getTimetableById(timetableId);
    return ApiResponse.success(res, 'Timetable retrieved successfully', result);
  });

  static updateTimetable = asyncHandler(async (req: Request, res: Response) => {
    const timetableId = req.params['id'] as string;
    const timetable = await TimetableService.updateTimetable(timetableId, req.body);
    return ApiResponse.success(res, 'Timetable updated successfully', timetable);
  });

  static publishTimetable = asyncHandler(async (req: Request, res: Response) => {
    const timetableId = req.params['id'] as string;
    const timetable = await TimetableService.publishTimetable(timetableId, req.user!.id);
    return ApiResponse.success(res, 'Timetable published successfully', timetable);
  });

  static archiveTimetable = asyncHandler(async (req: Request, res: Response) => {
    const timetableId = req.params['id'] as string;
    const timetable = await TimetableService.archiveTimetable(timetableId);
    return ApiResponse.success(res, 'Timetable archived successfully', timetable);
  });

  static deleteTimetable = asyncHandler(async (req: Request, res: Response) => {
    const timetableId = req.params['id'] as string;
    await TimetableService.deleteTimetable(timetableId);
    return ApiResponse.success(res, 'Timetable deleted successfully', null);
  });

  // --- Timetable Entries ---

  static createTimetableEntry = asyncHandler(async (req: Request, res: Response) => {
    const timetableId = req.params['id'] as string;
    const entry = await TimetableService.createTimetableEntry(
      timetableId,
      req.body,
      { _id: req.user!.id, role: req.user!.role }
    );
    return ApiResponse.created(res, 'Timetable entry created successfully', entry);
  });

  static getTimetableEntries = asyncHandler(async (req: Request, res: Response) => {
    const timetableId = req.params['id'] as string;
    const entries = await TimetableService.getTimetableEntries(timetableId);
    return ApiResponse.success(res, 'Timetable entries retrieved successfully', entries);
  });

  static updateTimetableEntry = asyncHandler(async (req: Request, res: Response) => {
    const entryId = req.params['entryId'] as string;
    const entry = await TimetableService.updateTimetableEntry(
      entryId,
      req.body,
      { _id: req.user!.id, role: req.user!.role }
    );
    return ApiResponse.success(res, 'Timetable entry updated successfully', entry);
  });

  static deleteTimetableEntry = asyncHandler(async (req: Request, res: Response) => {
    const entryId = req.params['entryId'] as string;
    await TimetableService.deleteTimetableEntry(entryId);
    return ApiResponse.success(res, 'Timetable entry deleted successfully', null);
  });

  // --- Conflict Detection ---

  static checkConflicts = asyncHandler(async (req: Request, res: Response) => {
    const result = await TimetableConflictService.detectConflicts(req.body);
    return ApiResponse.success(res, 'Conflict check completed successfully', result);
  });

  static listConflicts = asyncHandler(async (req: Request, res: Response) => {
    const timetableId = req.query.timetableId as string | undefined;
    const overrides = await TimetableConflictService.listConflictOverrides(timetableId);
    return ApiResponse.success(res, 'Conflict overrides retrieved successfully', overrides);
  });

  static overrideConflict = asyncHandler(async (req: Request, res: Response) => {
    const timetableId = req.params['id'] as string;
    const { conflictType, conflictDetails, reason, entryId } = req.body;

    const override = await TimetableConflictService.recordOverride(
      timetableId,
      conflictType,
      conflictDetails,
      reason,
      req.user!.id,
      entryId
    );

    return ApiResponse.created(res, 'Conflict override recorded successfully', override);
  });

  // --- Teacher Timetable ---

  static getTeacherSchedule = asyncHandler(async (req: Request, res: Response) => {
    const teacherId =
      (req.query.teacherId as string) &&
      (req.user!.role === ROLES.SUPER_ADMIN || req.user!.role === ROLES.ADMIN)
        ? (req.query.teacherId as string)
        : req.user!.id;

    const result = await TimetableAccessService.getTeacherSchedule(teacherId, {
      date: req.query.date ? new Date(req.query.date as string) : undefined,
      dayOfWeek: req.query.dayOfWeek as any,
      academicYear: req.query.academicYear as string,
      semester: req.query.semester ? Number(req.query.semester) : undefined,
    });

    return ApiResponse.success(res, 'Teacher schedule retrieved successfully', result);
  });

  static getTeacherToday = asyncHandler(async (req: Request, res: Response) => {
    const teacherId =
      (req.query.teacherId as string) &&
      (req.user!.role === ROLES.SUPER_ADMIN || req.user!.role === ROLES.ADMIN)
        ? (req.query.teacherId as string)
        : req.user!.id;

    const result = await TimetableAccessService.getTeacherToday(teacherId);
    return ApiResponse.success(res, "Teacher's today schedule retrieved successfully", result);
  });

  static getTeacherWeekly = asyncHandler(async (req: Request, res: Response) => {
    const teacherId =
      (req.query.teacherId as string) &&
      (req.user!.role === ROLES.SUPER_ADMIN || req.user!.role === ROLES.ADMIN)
        ? (req.query.teacherId as string)
        : req.user!.id;

    const result = await TimetableAccessService.getTeacherSchedule(teacherId);
    return ApiResponse.success(res, "Teacher's weekly schedule retrieved successfully", result);
  });

  // --- Student & Section Timetable ---

  static getStudentSchedule = asyncHandler(async (req: Request, res: Response) => {
    const result = await TimetableAccessService.getStudentSchedule(req.user!.id, {
      date: req.query.date ? new Date(req.query.date as string) : undefined,
      dayOfWeek: req.query.dayOfWeek as any,
    });

    return ApiResponse.success(res, 'Student schedule retrieved successfully', result);
  });

  static getStudentToday = asyncHandler(async (req: Request, res: Response) => {
    const result = await TimetableAccessService.getStudentToday(req.user!.id);
    return ApiResponse.success(res, "Student's today schedule retrieved successfully", result);
  });

  static getSectionSchedule = asyncHandler(async (req: Request, res: Response) => {
    const sectionId = req.params['sectionId'] as string;

    // RBAC check: Student must be in section, Parent must have linked child in section
    if (req.user!.role === ROLES.STUDENT) {
      const student = await Student.findOne({ user: req.user!.id });
      if (!student || student.section.toString() !== sectionId) {
        throw new ApiError(403, 'Students can only view timetables for their own section');
      }
    } else if (req.user!.role === ROLES.PARENT) {
      const parent = await Parent.findOne({ user: req.user!.id }).populate('students');
      if (!parent) {
        throw new ApiError(403, 'Parent record not found');
      }

      const linkedStudents = await Student.find({
        _id: { $in: parent.students },
        section: sectionId,
      });

      if (linkedStudents.length === 0) {
        throw new ApiError(
          403,
          'Parents can only view timetables for sections of their linked children'
        );
      }
    }

    const isAdmin =
      req.user!.role === ROLES.SUPER_ADMIN || req.user!.role === ROLES.ADMIN;
    const result = await TimetableAccessService.getSectionSchedule(sectionId, {
      date: req.query.date ? new Date(req.query.date as string) : undefined,
      dayOfWeek: req.query.dayOfWeek as any,
      includeDraft: isAdmin,
    });

    return ApiResponse.success(res, 'Section timetable retrieved successfully', result);
  });

  // --- Timetable Changes & Substitutions ---

  static createChange = asyncHandler(async (req: Request, res: Response) => {
    const change = await TimetableChangeService.createChange(req.body, {
      _id: req.user!.id,
      role: req.user!.role,
    });
    return ApiResponse.created(res, 'Timetable change recorded successfully', change);
  });

  static listChanges = asyncHandler(async (req: Request, res: Response) => {
    const changes = await TimetableChangeService.listChanges(
      req.query as Record<string, any>
    );
    return ApiResponse.success(res, 'Timetable changes retrieved successfully', changes);
  });

  static approveChange = asyncHandler(async (req: Request, res: Response) => {
    const changeId = req.params['id'] as string;
    const change = await TimetableChangeService.approveChange(changeId, {
      _id: req.user!.id,
      role: req.user!.role,
    });
    return ApiResponse.success(res, 'Timetable change approved successfully', change);
  });

  static rejectChange = asyncHandler(async (req: Request, res: Response) => {
    const changeId = req.params['id'] as string;
    const reason = req.body.rejectionReason || 'Rejected by administrator';
    const change = await TimetableChangeService.rejectChange(changeId, reason, {
      _id: req.user!.id,
      role: req.user!.role,
    });
    return ApiResponse.success(res, 'Timetable change rejected successfully', change);
  });

  // --- Analytics ---

  static getTeacherWorkloadAnalytics = asyncHandler(async (req: Request, res: Response) => {
    const analytics = await TimetableAnalyticsService.getTeacherWorkloadAnalytics(
      req.query as Record<string, any>
    );
    return ApiResponse.success(res, 'Teacher workload analytics retrieved', analytics);
  });

  static getClassroomUtilizationAnalytics = asyncHandler(
    async (req: Request, res: Response) => {
      const analytics = await TimetableAnalyticsService.getClassroomUtilizationAnalytics(
        req.query as Record<string, any>
      );
      return ApiResponse.success(
        res,
        'Classroom utilization analytics retrieved',
        analytics
      );
    }
  );

  static getSubjectDistributionAnalytics = asyncHandler(
    async (req: Request, res: Response) => {
      const analytics = await TimetableAnalyticsService.getSubjectDistributionAnalytics(
        req.query as Record<string, any>
      );
      return ApiResponse.success(
        res,
        'Subject distribution analytics retrieved',
        analytics
      );
    }
  );

  static getConflictAnalytics = asyncHandler(async (req: Request, res: Response) => {
    const analytics = await TimetableAnalyticsService.getConflictReport(
      req.query as Record<string, any>
    );
    return ApiResponse.success(res, 'Timetable conflict report retrieved', analytics);
  });
}
