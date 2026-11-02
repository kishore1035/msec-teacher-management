import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/apiResponse';
import { assignmentService } from '../services/assignment.service';
import { submissionService } from '../services/submission.service';
import { assignmentAnalyticsService } from '../services/assignmentAnalytics.service';
import { storageService } from '../services/storage.service';
import { Assignment } from '../models/assignment.model';
import { AssignmentSubmission } from '../models/assignmentSubmission.model';
import { Student } from '../models/student.model';
import { Parent } from '../models/parent.model';
import { Teacher } from '../models/teacher.model';
import { ROLES } from '../constants/roles.constant';
import { ApiError } from '../utils/apiError';
import { MESSAGES } from '../constants/messages';

export class AssignmentController {
  // ==========================================
  // ASSIGNMENTS
  // ==========================================

  public static createAssignment = asyncHandler(async (req: Request, res: Response) => {
    const files = req.files as Express.Multer.File[] | undefined;
    const assignment = await assignmentService.createAssignment(
      req.user!.id,
      req.user!.role,
      req.body,
      files
    );
    return ApiResponse.created(res, 'Assignment created successfully', assignment);
  });

  public static getAssignments = asyncHandler(async (req: Request, res: Response) => {
    const result = await assignmentService.getAssignments(
      req.user!.id,
      req.user!.role,
      req.query as any
    );
    return ApiResponse.success(res, 'Assignments retrieved successfully', result.items, 200, result.meta);
  });

  public static getAssignmentById = asyncHandler(async (req: Request, res: Response) => {
    const assignment = await assignmentService.getAssignmentById(
      req.user!.id,
      req.user!.role,
      req.params['id'] as string
    );
    return ApiResponse.success(res, 'Assignment details retrieved successfully', assignment);
  });

  public static updateAssignment = asyncHandler(async (req: Request, res: Response) => {
    const assignment = await assignmentService.updateAssignment(
      req.user!.id,
      req.user!.role,
      req.params['id'] as string,
      req.body
    );
    return ApiResponse.success(res, 'Assignment updated successfully', assignment);
  });

  public static publishAssignment = asyncHandler(async (req: Request, res: Response) => {
    const assignment = await assignmentService.publishAssignment(
      req.user!.id,
      req.user!.role,
      req.params['id'] as string
    );
    return ApiResponse.success(res, 'Assignment published successfully', assignment);
  });

  public static closeAssignment = asyncHandler(async (req: Request, res: Response) => {
    const assignment = await assignmentService.closeAssignment(
      req.user!.id,
      req.user!.role,
      req.params['id'] as string
    );
    return ApiResponse.success(res, 'Assignment closed successfully', assignment);
  });

  public static deleteAssignment = asyncHandler(async (req: Request, res: Response) => {
    await assignmentService.deleteAssignment(
      req.user!.id,
      req.user!.role,
      req.params['id'] as string
    );
    return ApiResponse.success(res, 'Assignment deleted successfully', null);
  });

  public static addAttachments = asyncHandler(async (req: Request, res: Response) => {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      throw ApiError.badRequest('No files provided for upload');
    }
    const assignment = await assignmentService.addAttachments(
      req.user!.id,
      req.user!.role,
      req.params['id'] as string,
      files
    );
    return ApiResponse.success(res, 'Attachments added to assignment successfully', assignment);
  });

  public static removeAttachment = asyncHandler(async (req: Request, res: Response) => {
    const assignment = await assignmentService.removeAttachment(
      req.user!.id,
      req.user!.role,
      req.params['id'] as string,
      req.params['attachmentId'] as string
    );
    return ApiResponse.success(res, 'Attachment removed successfully', assignment);
  });

  // ==========================================
  // SUBMISSIONS & EVALUATIONS
  // ==========================================

  public static submitAssignment = asyncHandler(async (req: Request, res: Response) => {
    const files = req.files as Express.Multer.File[] | undefined;
    const submission = await submissionService.submitAssignment(
      req.user!.id,
      req.params['assignmentId'] as string,
      req.body,
      files
    );
    return ApiResponse.created(res, 'Assignment submitted successfully', submission);
  });

  public static resubmitAssignment = asyncHandler(async (req: Request, res: Response) => {
    const files = req.files as Express.Multer.File[] | undefined;
    const submission = await submissionService.resubmitAssignment(
      req.user!.id,
      req.params['assignmentId'] as string,
      req.body,
      files
    );
    return ApiResponse.success(res, 'Assignment resubmitted successfully', submission);
  });

  public static getSubmissionsForAssignment = asyncHandler(async (req: Request, res: Response) => {
    const result = await submissionService.getSubmissionsForAssignment(
      req.user!.id,
      req.user!.role,
      req.params['assignmentId'] as string,
      req.query as any
    );
    return ApiResponse.success(res, 'Submissions retrieved successfully', result.items, 200, result.meta);
  });

  public static getSubmissionById = asyncHandler(async (req: Request, res: Response) => {
    const submission = await submissionService.getSubmissionById(
      req.user!.id,
      req.user!.role,
      req.params['submissionId'] as string
    );
    return ApiResponse.success(res, 'Submission details retrieved successfully', submission);
  });

  public static getMySubmissions = asyncHandler(async (req: Request, res: Response) => {
    const result = await submissionService.getMySubmissions(
      req.user!.id,
      req.query as any
    );
    return ApiResponse.success(res, 'My submissions retrieved successfully', result.items, 200, result.meta);
  });

  public static evaluateSubmission = asyncHandler(async (req: Request, res: Response) => {
    const submission = await submissionService.evaluateSubmission(
      req.user!.id,
      req.user!.role,
      req.params['submissionId'] as string,
      req.body
    );
    return ApiResponse.success(res, 'Submission evaluated successfully', submission);
  });

  public static returnSubmission = asyncHandler(async (req: Request, res: Response) => {
    const submission = await submissionService.returnSubmission(
      req.user!.id,
      req.user!.role,
      req.params['submissionId'] as string,
      req.body
    );
    return ApiResponse.success(res, 'Submission returned for correction', submission);
  });

  public static getEvaluationHistory = asyncHandler(async (req: Request, res: Response) => {
    const history = await submissionService.getEvaluationHistory(
      req.user!.id,
      req.user!.role,
      req.params['submissionId'] as string
    );
    return ApiResponse.success(res, 'Evaluation history retrieved successfully', history);
  });

  // ==========================================
  // ANALYTICS
  // ==========================================

  public static getOverviewAnalytics = asyncHandler(async (req: Request, res: Response) => {
    const stats = await assignmentAnalyticsService.getOverviewAnalytics(
      req.user!.id,
      req.user!.role,
      req.query as any
    );
    return ApiResponse.success(res, 'Overview analytics retrieved successfully', stats);
  });

  public static getClassAnalytics = asyncHandler(async (req: Request, res: Response) => {
    const stats = await assignmentAnalyticsService.getClassAnalytics(
      req.user!.id,
      req.user!.role,
      req.query as any
    );
    return ApiResponse.success(res, 'Class performance analytics retrieved successfully', stats);
  });

  public static getSubjectAnalytics = asyncHandler(async (req: Request, res: Response) => {
    const stats = await assignmentAnalyticsService.getSubjectAnalytics(
      req.user!.id,
      req.user!.role,
      req.query as any
    );
    return ApiResponse.success(res, 'Subject performance analytics retrieved successfully', stats);
  });

  public static getStudentAnalytics = asyncHandler(async (req: Request, res: Response) => {
    const stats = await assignmentAnalyticsService.getStudentAnalytics(
      req.user!.id,
      req.user!.role,
      req.params['studentId'] as string
    );
    return ApiResponse.success(res, 'Student performance analytics retrieved successfully', stats);
  });

  // ==========================================
  // SECURE ATTACHMENT STREAMING
  // ==========================================

  public static downloadAttachment = asyncHandler(async (req: Request, res: Response) => {
    const attachmentId = req.params['attachmentId'] as string;
    const userId = req.user!.id;
    const role = req.user!.role;

    // Check if attachment belongs to an Assignment
    let attachmentObj: any = null;
    const assignment = await Assignment.findOne({ 'attachments._id': attachmentId });

    if (assignment) {
      attachmentObj = assignment.attachments.find((a) => a._id?.toString() === attachmentId);

      // Verify access to assignment
      if (role === ROLES.STUDENT) {
        const student = await Student.findOne({ user: userId });
        if (!student || student.section.toString() !== assignment.section.toString()) {
          throw ApiError.forbidden('Unauthorized access to assignment attachment');
        }
        if (assignment.status === 'draft') {
          throw ApiError.forbidden('Draft attachments are not accessible');
        }
      } else if (role === ROLES.PARENT) {
        const parent = await Parent.findOne({ user: userId });
        if (!parent) {
          throw ApiError.forbidden(MESSAGES.UNAUTHORIZED);
        }
        const children = await Student.find({ _id: { $in: parent.students } });
        const hasChild = children.some((c) => c.section.toString() === assignment.section.toString());
        if (!hasChild || assignment.status === 'draft') {
          throw ApiError.forbidden('Unauthorized access to assignment attachment');
        }
      }
    } else {
      // Check if attachment belongs to a Submission
      const submission = await AssignmentSubmission.findOne({ 'attachments._id': attachmentId }).populate('assignment');
      if (submission) {
        attachmentObj = submission.attachments.find((a) => a._id?.toString() === attachmentId);

        if (role === ROLES.STUDENT) {
          const student = await Student.findOne({ user: userId });
          if (!student || submission.student.toString() !== student._id.toString()) {
            throw ApiError.forbidden('Unauthorized access to student submission file');
          }
        } else if (role === ROLES.PARENT) {
          const parent = await Parent.findOne({ user: userId });
          if (!parent || !parent.students.some((sId) => sId.toString() === submission.student.toString())) {
            throw ApiError.forbidden('Unauthorized access to student submission file');
          }
        } else if (role === ROLES.TEACHER) {
          const teacher = await Teacher.findOne({ user: userId });
          const assign = submission.assignment as any;
          if (!teacher || assign.teacher.toString() !== teacher._id.toString()) {
            throw ApiError.forbidden('Unauthorized access to submission file');
          }
        }
      }
    }

    if (!attachmentObj) {
      throw ApiError.notFound('Attachment not found');
    }

    res.setHeader('Content-Type', attachmentObj.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(attachmentObj.originalName)}"`
    );

    const stream = storageService.getFileStream(attachmentObj.path);
    stream.pipe(res);
  });
}
