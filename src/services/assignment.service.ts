import { Types } from 'mongoose';
import {
  Assignment,
  IAssignment,
  AssignmentStatus,
  IAttachment,
} from '../models/assignment.model';
import { AssignmentSubmission } from '../models/assignmentSubmission.model';
import { Teacher } from '../models/teacher.model';
import { Student } from '../models/student.model';
import { Parent } from '../models/parent.model';
import { Section } from '../models/section.model';
import { Subject } from '../models/subject.model';
import { AcademicYear } from '../models/academicYear.model';
import { TeacherAssignment } from '../models/teacherAssignment.model';
import { storageService } from './storage.service';
import { ApiError } from '../utils/apiError';
import { HTTP_STATUS } from '../constants/statusCodes';
import { ROLES } from '../constants/roles.constant';
import { calculatePagination } from '../utils/pagination';
import { PaginationMeta } from '../types/common.types';

export interface PaginatedResult<T> {
  items: T[];
  meta: PaginationMeta;
}

export interface CreateAssignmentDTO {
  title: string;
  description: string;
  instructions?: string;
  academicYear: string;
  semester: number;
  section: string;
  subject: string;
  teacher?: string;
  assignmentType?: 'homework' | 'project' | 'practical' | 'presentation' | 'research' | 'other';
  totalMarks: number;
  passingMarks: number;
  assignedDate?: Date;
  dueDate: Date;
  allowLateSubmission?: boolean;
  lateSubmissionDeadline?: Date;
  maxResubmissions?: number;
}

export interface UpdateAssignmentDTO {
  title?: string;
  description?: string;
  instructions?: string;
  totalMarks?: number;
  passingMarks?: number;
  dueDate?: Date;
  allowLateSubmission?: boolean;
  lateSubmissionDeadline?: Date;
  maxResubmissions?: number;
  status?: AssignmentStatus;
}

export interface AssignmentQueryDTO {
  page?: number;
  limit?: number;
  academicYear?: string;
  semester?: number;
  section?: string;
  subject?: string;
  teacher?: string;
  status?: AssignmentStatus;
  assignmentType?: string;
  startDate?: Date;
  endDate?: Date;
}

export class AssignmentService {
  /**
   * Helper: Resolve Teacher profile for current user
   */
  private async getTeacherForUser(userId: string): Promise<Types.ObjectId> {
    const teacher = await Teacher.findOne({ user: userId });
    if (!teacher || teacher.status !== 'Active') {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        'Active Teacher profile required for this operation'
      );
    }
    return teacher._id;
  }

  /**
   * Helper: Check if teacher is assigned to section & subject
   */
  private async verifyTeacherAssignment(
    teacherId: Types.ObjectId,
    sectionId: string,
    subjectId: string
  ): Promise<void> {
    const assignment = await TeacherAssignment.findOne({
      teacher: teacherId,
      section: sectionId,
      subject: subjectId,
      status: 'Active',
    });

    if (!assignment) {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        'You are not actively assigned to teach this subject in the specified section'
      );
    }
  }

  /**
   * Create an assignment
   */
  public async createAssignment(
    userId: string,
    role: string,
    data: CreateAssignmentDTO,
    files?: Express.Multer.File[]
  ): Promise<IAssignment> {
    // 1. Validate Academic References
    const [academicYear, section, subject] = await Promise.all([
      AcademicYear.findById(data.academicYear),
      Section.findById(data.section),
      Subject.findById(data.subject),
    ]);

    if (!academicYear) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Academic year not found');
    }
    if (!section) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Section not found');
    }
    if (!subject) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Subject not found');
    }

    if (subject.semester !== data.semester || section.semester !== data.semester) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        'Semester mismatch: Subject, Section, and Assignment semester must match'
      );
    }

    // 2. Resolve & Verify Teacher
    let resolvedTeacherId: Types.ObjectId;
    if (role === ROLES.TEACHER) {
      resolvedTeacherId = await this.getTeacherForUser(userId);
      await this.verifyTeacherAssignment(resolvedTeacherId, data.section, data.subject);
    } else if (role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN) {
      if (!data.teacher) {
        throw new ApiError(
          HTTP_STATUS.BAD_REQUEST,
          'Teacher ID is required when administrator creates an assignment'
        );
      }
      const teacherDoc = await Teacher.findById(data.teacher);
      if (!teacherDoc) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Specified Teacher not found');
      }
      resolvedTeacherId = teacherDoc._id;
    } else {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Insufficient permissions to create assignments');
    }

    // 3. Process Uploaded Attachments
    const attachments: IAttachment[] = [];
    if (files && files.length > 0) {
      for (const file of files) {
        const saved = await storageService.saveFile(file, 'assignments');
        attachments.push(saved);
      }
    }

    // 4. Create Assignment
    const assignment = await Assignment.create({
      ...data,
      teacher: resolvedTeacherId,
      attachments,
      status: 'draft',
      createdBy: new Types.ObjectId(userId),
    });

    return assignment;
  }

  /**
   * List assignments with role-based visibility filters
   */
  public async getAssignments(
    userId: string,
    role: string,
    query: AssignmentQueryDTO
  ): Promise<PaginatedResult<IAssignment>> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;
    const filter: Record<string, any> = {};

    if (role === ROLES.STUDENT) {
      const student = await Student.findOne({ user: userId });
      if (!student) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Student profile not found');
      }
      // Students can only see published or closed assignments in their section
      filter.section = student.section;
      filter.status = { $in: ['published', 'closed'] };
    } else if (role === ROLES.PARENT) {
      const parent = await Parent.findOne({ user: userId });
      if (!parent || parent.students.length === 0) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Parent profile not linked to any student');
      }
      const students = await Student.find({ _id: { $in: parent.students } });
      const sectionIds = students.map((s) => s.section);
      filter.section = { $in: sectionIds };
      filter.status = { $in: ['published', 'closed'] };
    } else if (role === ROLES.TEACHER) {
      const teacher = await Teacher.findOne({ user: userId });
      if (teacher) {
        filter.teacher = teacher._id;
      }
    }

    // Explicit query filters (if allowed)
    if (query.academicYear) filter.academicYear = query.academicYear;
    if (query.semester) filter.semester = query.semester;
    if (query.section && role !== ROLES.STUDENT) filter.section = query.section;
    if (query.subject) filter.subject = query.subject;
    if (query.status && role !== ROLES.STUDENT && role !== ROLES.PARENT) {
      filter.status = query.status;
    }
    if (query.assignmentType) filter.assignmentType = query.assignmentType;
    if (query.teacher && (role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN)) {
      filter.teacher = query.teacher;
    }
    if (query.startDate || query.endDate) {
      filter.dueDate = {};
      if (query.startDate) filter.dueDate.$gte = new Date(query.startDate);
      if (query.endDate) filter.dueDate.$lte = new Date(query.endDate);
    }

    const [items, total] = await Promise.all([
      Assignment.find(filter)
        .populate('subject', 'name code')
        .populate('section', 'sectionName semester')
        .populate('teacher', 'firstName lastName employeeId')
        .sort({ dueDate: 1 })
        .skip(skip)
        .limit(limit),
      Assignment.countDocuments(filter),
    ]);

    return {
      items,
      meta: calculatePagination(page, limit, total),
    };
  }

  /**
   * Get single assignment by ID with permission checks
   */
  public async getAssignmentById(
    userId: string,
    role: string,
    assignmentId: string
  ): Promise<IAssignment> {
    const assignment = await Assignment.findById(assignmentId)
      .populate('academicYear', 'year')
      .populate('subject', 'name code')
      .populate('section', 'sectionName semester')
      .populate('teacher', 'firstName lastName employeeId');

    if (!assignment) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Assignment not found');
    }

    // Role visibility enforcement
    if (role === ROLES.STUDENT) {
      const student = await Student.findOne({ user: userId });
      if (!student || student.section.toString() !== assignment.section._id.toString()) {
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          'You are not enrolled in the section for this assignment'
        );
      }
      if (assignment.status === 'draft') {
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          'Draft assignments are not accessible to students'
        );
      }
    } else if (role === ROLES.PARENT) {
      const parent = await Parent.findOne({ user: userId });
      if (!parent) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Parent record not found');
      }
      const students = await Student.find({ _id: { $in: parent.students } });
      const hasEnrolledChild = students.some(
        (s) => s.section.toString() === assignment.section._id.toString()
      );
      if (!hasEnrolledChild || assignment.status === 'draft') {
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          'Access forbidden to draft or unlinked student assignment'
        );
      }
    }

    return assignment;
  }

  /**
   * Update assignment details
   */
  public async updateAssignment(
    userId: string,
    role: string,
    assignmentId: string,
    data: UpdateAssignmentDTO
  ): Promise<IAssignment> {
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Assignment not found');
    }

    if (role === ROLES.TEACHER) {
      const teacherId = await this.getTeacherForUser(userId);
      if (assignment.teacher.toString() !== teacherId.toString()) {
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          'You can only modify assignments created for your classes'
        );
      }
    }

    // Check if marks can be updated when submissions exist
    if (data.totalMarks !== undefined || data.passingMarks !== undefined) {
      const submissionCount = await AssignmentSubmission.countDocuments({
        assignment: assignment._id,
      });
      if (submissionCount > 0 && data.totalMarks !== assignment.totalMarks) {
        throw new ApiError(
          HTTP_STATUS.BAD_REQUEST,
          'Cannot alter total marks after students have submitted their work'
        );
      }
    }

    Object.assign(assignment, data);
    await assignment.save();

    return assignment;
  }

  /**
   * Publish an assignment
   */
  public async publishAssignment(
    userId: string,
    role: string,
    assignmentId: string
  ): Promise<IAssignment> {
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Assignment not found');
    }

    if (role === ROLES.TEACHER) {
      const teacherId = await this.getTeacherForUser(userId);
      if (assignment.teacher.toString() !== teacherId.toString()) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Unauthorized to publish this assignment');
      }
    }

    assignment.status = 'published';
    await assignment.save();
    return assignment;
  }

  /**
   * Close an assignment
   */
  public async closeAssignment(
    userId: string,
    role: string,
    assignmentId: string
  ): Promise<IAssignment> {
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Assignment not found');
    }

    if (role === ROLES.TEACHER) {
      const teacherId = await this.getTeacherForUser(userId);
      if (assignment.teacher.toString() !== teacherId.toString()) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Unauthorized to close this assignment');
      }
    }

    assignment.status = 'closed';
    await assignment.save();
    return assignment;
  }

  /**
   * Delete an assignment (with safeguards)
   */
  public async deleteAssignment(
    userId: string,
    role: string,
    assignmentId: string
  ): Promise<void> {
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Assignment not found');
    }

    if (role === ROLES.TEACHER) {
      const teacherId = await this.getTeacherForUser(userId);
      if (assignment.teacher.toString() !== teacherId.toString()) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Unauthorized to delete this assignment');
      }
    }

    // Safeguard: Check if submissions exist
    const submissionsCount = await AssignmentSubmission.countDocuments({
      assignment: assignment._id,
    });
    if (submissionsCount > 0) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        'Cannot delete assignment with existing student submissions. Consider closing or archiving it instead.'
      );
    }

    // Clean up stored attachments
    for (const attachment of assignment.attachments) {
      await storageService.deleteFile(attachment.path);
    }

    await Assignment.findByIdAndDelete(assignmentId);
  }

  /**
   * Add attachment files to assignment
   */
  public async addAttachments(
    userId: string,
    role: string,
    assignmentId: string,
    files: Express.Multer.File[]
  ): Promise<IAssignment> {
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Assignment not found');
    }

    if (role === ROLES.TEACHER) {
      const teacherId = await this.getTeacherForUser(userId);
      if (assignment.teacher.toString() !== teacherId.toString()) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Unauthorized to edit this assignment');
      }
    }

    for (const file of files) {
      const saved = await storageService.saveFile(file, 'assignments');
      assignment.attachments.push(saved);
    }

    await assignment.save();
    return assignment;
  }

  /**
   * Delete an attachment from assignment
   */
  public async removeAttachment(
    userId: string,
    role: string,
    assignmentId: string,
    attachmentId: string
  ): Promise<IAssignment> {
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Assignment not found');
    }

    if (role === ROLES.TEACHER) {
      const teacherId = await this.getTeacherForUser(userId);
      if (assignment.teacher.toString() !== teacherId.toString()) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Unauthorized to edit this assignment');
      }
    }

    const attachmentIndex = assignment.attachments.findIndex(
      (a) => a._id?.toString() === attachmentId
    );

    if (attachmentIndex === -1) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Attachment not found in this assignment');
    }

    const [removed] = assignment.attachments.splice(attachmentIndex, 1);
    if (removed) {
      await storageService.deleteFile(removed.path);
    }

    await assignment.save();
    return assignment;
  }
}

export const assignmentService = new AssignmentService();
