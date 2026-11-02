import { Types } from 'mongoose';
import {
  AssignmentSubmission,
  IAssignmentSubmission,
  IEvaluationHistory,
  SubmissionStatus,
} from '../models/assignmentSubmission.model';
import { Assignment, IAssignment, IAttachment } from '../models/assignment.model';
import { Student } from '../models/student.model';
import { Teacher } from '../models/teacher.model';
import { Parent } from '../models/parent.model';
import { storageService } from './storage.service';
import { ApiError } from '../utils/apiError';
import { HTTP_STATUS } from '../constants/statusCodes';
import { ROLES } from '../constants/roles.constant';
import { calculatePagination } from '../utils/pagination';
import { PaginatedResult } from './assignment.service';

export interface SubmitAssignmentDTO {
  submissionText?: string;
}

export interface EvaluateSubmissionDTO {
  marksObtained: number;
  feedback?: string;
  reason?: string;
}

export interface ReturnSubmissionDTO {
  reason: string;
}

export class SubmissionService {
  /**
   * Helper: Resolve Student profile for user
   */
  private async getStudentForUser(userId: string) {
    const student = await Student.findOne({ user: userId });
    if (!student || student.status !== 'Active') {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        'Active Student profile required for this operation'
      );
    }
    return student;
  }

  /**
   * Helper: Resolve Teacher profile for user
   */
  private async getTeacherForUser(userId: string) {
    const teacher = await Teacher.findOne({ user: userId });
    if (!teacher || teacher.status !== 'Active') {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        'Active Teacher profile required for this operation'
      );
    }
    return teacher;
  }

  /**
   * Submit an assignment
   */
  public async submitAssignment(
    userId: string,
    assignmentId: string,
    data: SubmitAssignmentDTO,
    files?: Express.Multer.File[]
  ): Promise<IAssignmentSubmission> {
    const student = await this.getStudentForUser(userId);
    const assignment = await Assignment.findById(assignmentId);

    if (!assignment) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Assignment not found');
    }

    if (student.section.toString() !== assignment.section.toString()) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        'You are not enrolled in the section for this assignment'
      );
    }

    if (assignment.status !== 'published') {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        'Assignment is not open for submission'
      );
    }

    // Check if an existing submission already exists
    const existingSubmission = await AssignmentSubmission.findOne({
      assignment: assignment._id,
      student: student._id,
    });

    if (existingSubmission) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        'You have already submitted this assignment. Use the resubmit endpoint if revisions are permitted.'
      );
    }

    // Deadline validation
    const now = new Date();
    let isLate = false;
    let submissionStatus: SubmissionStatus = 'submitted';

    if (now > assignment.dueDate) {
      if (!assignment.allowLateSubmission) {
        throw new ApiError(
          HTTP_STATUS.BAD_REQUEST,
          'Submission deadline has passed and late submissions are not allowed'
        );
      }
      if (assignment.lateSubmissionDeadline && now > assignment.lateSubmissionDeadline) {
        throw new ApiError(
          HTTP_STATUS.BAD_REQUEST,
          'Late submission deadline has expired'
        );
      }
      isLate = true;
      submissionStatus = 'late';
    }

    // Attachment processing
    const attachments: IAttachment[] = [];
    if (files && files.length > 0) {
      for (const file of files) {
        const saved = await storageService.saveFile(file, 'submissions');
        attachments.push(saved);
      }
    }

    if (!data.submissionText && attachments.length === 0) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        'Submission must include text response or at least one file attachment'
      );
    }

    const submission = await AssignmentSubmission.create({
      assignment: assignment._id,
      student: student._id,
      submissionText: data.submissionText,
      attachments,
      submittedAt: now,
      submissionStatus,
      attemptNumber: 1,
      isLate,
      evaluationStatus: 'pending',
    });

    return submission;
  }

  /**
   * Resubmit an assignment
   */
  public async resubmitAssignment(
    userId: string,
    assignmentId: string,
    data: SubmitAssignmentDTO,
    files?: Express.Multer.File[]
  ): Promise<IAssignmentSubmission> {
    const student = await this.getStudentForUser(userId);
    const assignment = await Assignment.findById(assignmentId);

    if (!assignment) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Assignment not found');
    }

    if (assignment.status !== 'published') {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        'Assignment is not open for submission'
      );
    }

    const submission = await AssignmentSubmission.findOne({
      assignment: assignment._id,
      student: student._id,
    });

    if (!submission) {
      throw new ApiError(
        HTTP_STATUS.NOT_FOUND,
        'No prior submission found to resubmit'
      );
    }

    // Attempt limit check
    const maxAttemptsAllowed = 1 + (assignment.maxResubmissions || 0);
    if (submission.attemptNumber >= maxAttemptsAllowed) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        `Maximum submission attempts (${maxAttemptsAllowed}) exceeded`
      );
    }

    // Deadline check
    const now = new Date();
    let isLate = false;
    let submissionStatus: SubmissionStatus = 'resubmitted';

    if (now > assignment.dueDate) {
      if (!assignment.allowLateSubmission) {
        throw new ApiError(
          HTTP_STATUS.BAD_REQUEST,
          'Submission deadline has passed and late submissions are not allowed'
        );
      }
      if (assignment.lateSubmissionDeadline && now > assignment.lateSubmissionDeadline) {
        throw new ApiError(
          HTTP_STATUS.BAD_REQUEST,
          'Late submission deadline has expired'
        );
      }
      isLate = true;
      submissionStatus = 'late';
    }

    // Process new attachments
    if (files && files.length > 0) {
      for (const file of files) {
        const saved = await storageService.saveFile(file, 'submissions');
        submission.attachments.push(saved);
      }
    }

    if (data.submissionText !== undefined) {
      submission.submissionText = data.submissionText;
    }

    submission.attemptNumber += 1;
    submission.submittedAt = now;
    submission.isLate = isLate;
    submission.submissionStatus = submissionStatus;
    submission.evaluationStatus = 'pending';

    await submission.save();
    return submission;
  }

  /**
   * Get all submissions for an assignment (Teachers & Admins)
   */
  public async getSubmissionsForAssignment(
    userId: string,
    role: string,
    assignmentId: string,
    query: { page?: number; limit?: number; status?: string; evaluationStatus?: string }
  ): Promise<PaginatedResult<IAssignmentSubmission>> {
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Assignment not found');
    }

    if (role === ROLES.TEACHER) {
      const teacher = await this.getTeacherForUser(userId);
      if (assignment.teacher.toString() !== teacher._id.toString()) {
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          'You are not authorized to view submissions for this assignment'
        );
      }
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = { assignment: assignment._id };
    if (query.status) filter.submissionStatus = query.status;
    if (query.evaluationStatus) filter.evaluationStatus = query.evaluationStatus;

    const [items, total] = await Promise.all([
      AssignmentSubmission.find(filter)
        .populate('student', 'firstName lastName usn rollNumber')
        .populate('evaluatedBy', 'email')
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(limit),
      AssignmentSubmission.countDocuments(filter),
    ]);

    return {
      items,
      meta: calculatePagination(page, limit, total),
    };
  }

  /**
   * Get single submission by ID with RBAC check
   */
  public async getSubmissionById(
    userId: string,
    role: string,
    submissionId: string
  ): Promise<IAssignmentSubmission> {
    const submission = await AssignmentSubmission.findById(submissionId)
      .populate('assignment')
      .populate('student', 'firstName lastName usn rollNumber user section')
      .populate('evaluatedBy', 'email');

    if (!submission) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Submission not found');
    }

    const assignment = submission.assignment as unknown as IAssignment;
    const student = submission.student as unknown as any;

    if (role === ROLES.STUDENT) {
      if (student.user.toString() !== userId) {
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          'You can only view your own submission'
        );
      }
    } else if (role === ROLES.PARENT) {
      const parent = await Parent.findOne({ user: userId });
      if (!parent || !parent.students.some((sId) => sId.toString() === student._id.toString())) {
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          'You can only view submissions for your linked child'
        );
      }
    } else if (role === ROLES.TEACHER) {
      const teacher = await this.getTeacherForUser(userId);
      if (assignment.teacher.toString() !== teacher._id.toString()) {
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          'You can only view submissions for your own assignments'
        );
      }
    }

    return submission;
  }

  /**
   * Get current student's submissions
   */
  public async getMySubmissions(
    userId: string,
    query: { page?: number; limit?: number }
  ): Promise<PaginatedResult<IAssignmentSubmission>> {
    const student = await this.getStudentForUser(userId);
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter = { student: student._id };
    const [items, total] = await Promise.all([
      AssignmentSubmission.find(filter)
        .populate({
          path: 'assignment',
          populate: [
            { path: 'subject', select: 'name code' },
            { path: 'teacher', select: 'firstName lastName' },
          ],
        })
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(limit),
      AssignmentSubmission.countDocuments(filter),
    ]);

    return {
      items,
      meta: calculatePagination(page, limit, total),
    };
  }

  /**
   * Evaluate a submission (Grade + Feedback + Audit Trail)
   */
  public async evaluateSubmission(
    userId: string,
    role: string,
    submissionId: string,
    data: EvaluateSubmissionDTO
  ): Promise<IAssignmentSubmission> {
    const submission = await AssignmentSubmission.findById(submissionId).populate('assignment');
    if (!submission) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Submission not found');
    }

    const assignment = submission.assignment as unknown as IAssignment;

    if (role === ROLES.TEACHER) {
      const teacher = await this.getTeacherForUser(userId);
      if (assignment.teacher.toString() !== teacher._id.toString()) {
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          'You can only evaluate submissions for your assigned classes'
        );
      }
    } else if (role !== ROLES.ADMIN && role !== ROLES.SUPER_ADMIN) {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Unauthorized to evaluate submissions');
    }

    // Marks range validation
    if (data.marksObtained < 0 || data.marksObtained > assignment.totalMarks) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        `Marks obtained (${data.marksObtained}) must be between 0 and total marks (${assignment.totalMarks})`
      );
    }

    // Re-evaluation audit trail
    if (submission.evaluationStatus === 'evaluated' && submission.marksObtained !== undefined) {
      if (!data.reason || data.reason.trim().length < 3) {
        throw new ApiError(
          HTTP_STATUS.BAD_REQUEST,
          'A descriptive reason (min 3 chars) is required when re-evaluating a submission'
        );
      }

      const historyEntry: IEvaluationHistory = {
        previousMarks: submission.marksObtained,
        newMarks: data.marksObtained,
        previousFeedback: submission.feedback,
        newFeedback: data.feedback,
        evaluatedBy: new Types.ObjectId(userId),
        reason: data.reason,
        timestamp: new Date(),
      };

      submission.evaluationHistory.push(historyEntry);
    }

    submission.marksObtained = data.marksObtained;
    if (data.feedback !== undefined) {
      submission.feedback = data.feedback;
    }
    submission.evaluatedBy = new Types.ObjectId(userId);
    submission.evaluatedAt = new Date();
    submission.evaluationStatus = 'evaluated';
    submission.submissionStatus = 'evaluated';

    await submission.save();
    return submission;
  }

  /**
   * Return submission for correction
   */
  public async returnSubmission(
    userId: string,
    role: string,
    submissionId: string,
    data: ReturnSubmissionDTO
  ): Promise<IAssignmentSubmission> {
    const submission = await AssignmentSubmission.findById(submissionId).populate('assignment');
    if (!submission) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Submission not found');
    }

    const assignment = submission.assignment as unknown as IAssignment;

    if (role === ROLES.TEACHER) {
      const teacher = await this.getTeacherForUser(userId);
      if (assignment.teacher.toString() !== teacher._id.toString()) {
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          'You can only return submissions for your assigned classes'
        );
      }
    }

    submission.evaluationStatus = 'returned';
    submission.feedback = `Returned for revision: ${data.reason}`;
    submission.evaluatedBy = new Types.ObjectId(userId);
    submission.evaluatedAt = new Date();

    await submission.save();
    return submission;
  }

  /**
   * Get evaluation audit history
   */
  public async getEvaluationHistory(
    userId: string,
    role: string,
    submissionId: string
  ): Promise<IEvaluationHistory[]> {
    const submission = await AssignmentSubmission.findById(submissionId)
      .populate('assignment')
      .populate('student');

    if (!submission) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Submission not found');
    }

    const assignment = submission.assignment as unknown as IAssignment;
    const student = submission.student as unknown as any;

    if (role === ROLES.STUDENT) {
      if (student.user.toString() !== userId) {
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          'You can only view evaluation history of your own submission'
        );
      }
    } else if (role === ROLES.TEACHER) {
      const teacher = await this.getTeacherForUser(userId);
      if (assignment.teacher.toString() !== teacher._id.toString()) {
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          'You can only view evaluation history for your assigned classes'
        );
      }
    }

    return submission.evaluationHistory;
  }
}

export const submissionService = new SubmissionService();
