import { Types } from 'mongoose';
import { Doubt, IDoubt, DoubtStatus, DoubtCategory, DoubtPriority } from '../models/doubt.model';
import { DoubtMessage, IDoubtMessage } from '../models/doubtMessage.model';
import { Student, IStudent } from '../models/student.model';
import { Teacher, ITeacher } from '../models/teacher.model';
import { Parent } from '../models/parent.model';
import { Subject } from '../models/subject.model';
import { Section } from '../models/section.model';
import { TeacherAssignment } from '../models/teacherAssignment.model';
import { IAttachment } from '../models/assignment.model';
import { NotificationService } from './notification.service';
import { calculatePagination } from '../utils/pagination';
import { ApiError } from '../utils/apiError';
import { HTTP_STATUS } from '../constants/statusCodes';
import { ROLES } from '../constants/roles.constant';

const MAX_REOPEN_COUNT = 3;
const REOPEN_WINDOW_DAYS = 14;
const DEFAULT_OVERDUE_HOURS = 48;

export interface CreateDoubtInput {
  title: string;
  description: string;
  student?: string;
  subject: string;
  section?: string;
  academicYear?: string;
  semester?: number;
  assignedTeacher?: string;
  category?: DoubtCategory;
  priority?: DoubtPriority;
  topic?: string;
  tags?: string[];
  attachments?: IAttachment[];
}

const extractRefId = (ref: unknown): string => {
  if (!ref) return '';
  if (typeof ref === 'object' && ref !== null && '_id' in ref) {
    return String((ref as { _id: unknown })._id);
  }
  return String(ref);
};

export class DoubtService {
  /**
   * Check whether a teacher is authorized for a given section/subject or assigned to the doubt
   */
  public static async isTeacherAuthorizedForDoubt(
    teacher: ITeacher,
    doubt: Pick<IDoubt, 'assignedTeacher' | 'subject' | 'section'>
  ): Promise<boolean> {
    const assignedTeacherId = extractRefId(doubt.assignedTeacher);
    if (assignedTeacherId && assignedTeacherId === teacher._id.toString()) {
      return true;
    }

    const sectionId = extractRefId(doubt.section);
    const subjectId = extractRefId(doubt.subject);

    const [assignment, classTeacherSection] = await Promise.all([
      TeacherAssignment.findOne({
        teacher: teacher._id,
        section: sectionId,
        subject: subjectId,
        status: 'Active',
      }),
      Section.findOne({
        _id: sectionId,
        classTeacher: teacher._id,
      }),
    ]);

    return Boolean(assignment || classTeacherSection);
  }

  /**
   * Verify access to a specific doubt record
   */
  public static async verifyDoubtAccess(
    doubt: IDoubt,
    user: { id: string; role: string }
  ): Promise<{ student?: IStudent; teacher?: ITeacher }> {
    if (user.role === ROLES.SUPER_ADMIN || user.role === ROLES.ADMIN) {
      return {};
    }

    const doubtStudentId = extractRefId(doubt.student);

    if (user.role === ROLES.STUDENT) {
      const student = await Student.findOne({ user: user.id });
      if (!student || student._id.toString() !== doubtStudentId) {
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          'Students can only access their own doubts'
        );
      }
      return { student };
    }

    if (user.role === ROLES.PARENT) {
      const parent = await Parent.findOne({ user: user.id });
      if (
        !parent ||
        !parent.students.some((s) => s.toString() === doubtStudentId)
      ) {
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          'Parents can only access doubts belonging to their linked children'
        );
      }
      return {};
    }

    if (user.role === ROLES.TEACHER) {
      const teacher = await Teacher.findOne({ user: user.id });
      if (!teacher) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Teacher profile not found');
      }
      const authorized = await this.isTeacherAuthorizedForDoubt(teacher, doubt);
      if (!authorized) {
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          'You are not authorized to access doubts outside your assigned subjects and sections'
        );
      }
      return { teacher };
    }

    throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Access denied');
  }

  /**
   * Create a new student doubt and automatically identify the appropriate teacher from TeacherAssignment
   */
  public static async createDoubt(
    input: CreateDoubtInput,
    user: { id: string; role: string }
  ): Promise<IDoubt> {
    let studentDoc: IStudent | null = null;

    if (user.role === ROLES.STUDENT) {
      studentDoc = await Student.findOne({ user: user.id });
      if (!studentDoc) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Student profile not found for current user');
      }
      if (input.student && input.student !== studentDoc._id.toString()) {
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          'Students cannot submit doubts on behalf of another student'
        );
      }
    } else if (user.role === ROLES.SUPER_ADMIN || user.role === ROLES.ADMIN) {
      if (!input.student) {
        throw new ApiError(
          HTTP_STATUS.BAD_REQUEST,
          'student ID is required when administrator creates a doubt'
        );
      }
      studentDoc = await Student.findById(input.student);
    } else {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        'Only students or administrators can submit a new doubt'
      );
    }

    if (!studentDoc) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Student not found');
    }

    const subjectDoc = await Subject.findById(input.subject);
    if (!subjectDoc) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Referenced subject not found');
    }

    const sectionId = input.section
      ? new Types.ObjectId(input.section)
      : studentDoc.section;
    const academicYearId = input.academicYear
      ? new Types.ObjectId(input.academicYear)
      : studentDoc.academicYear;
    const semester = input.semester ?? studentDoc.semester;

    const sectionDoc = await Section.findById(sectionId);
    if (!sectionDoc) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Referenced section not found');
    }

    // Automatically identify assigned teacher using TeacherAssignment if not explicitly provided
    let assignedTeacherDoc: ITeacher | null = null;
    if (input.assignedTeacher) {
      assignedTeacherDoc = await Teacher.findById(input.assignedTeacher);
      if (!assignedTeacherDoc) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Specified assigned teacher not found');
      }
    } else {
      const assignment = await TeacherAssignment.findOne({
        subject: subjectDoc._id,
        section: sectionId,
        status: 'Active',
      }).sort({ isPrimary: -1, createdAt: 1 });

      if (assignment) {
        assignedTeacherDoc = await Teacher.findById(assignment.teacher);
      }
    }

    const initialStatus: DoubtStatus = assignedTeacherDoc ? 'assigned' : 'open';
    const now = new Date();
    const actorId = new Types.ObjectId(user.id);

    const doubt = await Doubt.create({
      title: input.title,
      description: input.description,
      student: studentDoc._id,
      subject: subjectDoc._id,
      section: sectionId,
      academicYear: academicYearId,
      semester,
      assignedTeacher: assignedTeacherDoc?._id,
      category: input.category || 'conceptual',
      priority: input.priority || 'normal',
      status: initialStatus,
      topic: input.topic || input.title.slice(0, 80),
      tags: input.tags || [],
      attachments: input.attachments || [],
      assignmentHistory: assignedTeacherDoc
        ? [
            {
              newTeacher: assignedTeacherDoc._id,
              assignedBy: actorId,
              reason: input.assignedTeacher
                ? 'Explicitly assigned at creation'
                : 'Auto-assigned via active TeacherAssignment',
              assignedAt: now,
            },
          ]
        : [],
      statusHistory: [
        {
          newStatus: initialStatus,
          changedBy: actorId,
          reason: 'Doubt submitted',
          changedAt: now,
        },
      ],
    });

    // Notify assigned teacher if identified
    if (assignedTeacherDoc?.user) {
      await NotificationService.createEventNotification({
        recipient: assignedTeacherDoc.user,
        title: `New Student Doubt: ${doubt.title}`,
        message: `${studentDoc.firstName} ${studentDoc.lastName} (${studentDoc.usn}) submitted a ${doubt.category} doubt in ${subjectDoc.name}.`,
        notificationType: 'doubt_update',
        category: 'academic',
        priority: doubt.priority === 'high' ? 'high' : 'normal',
        relatedEntityType: 'Doubt',
        relatedEntityId: doubt._id,
        eventKey: `doubt_created:${doubt._id.toString()}:${assignedTeacherDoc.user.toString()}`,
      });
    }

    return doubt.populate([
      { path: 'student', select: 'firstName lastName usn rollNumber semester' },
      { path: 'subject', select: 'name code' },
      { path: 'section', select: 'sectionName semester roomNumber' },
      { path: 'assignedTeacher', select: 'firstName lastName employeeId designation' },
    ]);
  }

  /**
   * List doubts with strict role-scoped access and pagination
   */
  public static async getDoubts(
    query: {
      student?: string;
      subject?: string;
      section?: string;
      academicYear?: string;
      semester?: number;
      assignedTeacher?: string;
      category?: string;
      priority?: string;
      status?: string;
      search?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    },
    user: { id: string; role: string }
  ) {
    const filter: Record<string, unknown> = {};

    if (user.role === ROLES.STUDENT) {
      const student = await Student.findOne({ user: user.id });
      if (!student) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Student profile not found');
      }
      if (query.student && query.student !== student._id.toString()) {
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          'Students can only view their own doubts'
        );
      }
      filter.student = student._id;
    } else if (user.role === ROLES.PARENT) {
      const parent = await Parent.findOne({ user: user.id });
      if (!parent) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Parent profile not found');
      }
      if (
        query.student &&
        !parent.students.some((s) => s.toString() === query.student)
      ) {
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          'Parents can only view doubts for their linked children'
        );
      }
      filter.student = query.student
        ? new Types.ObjectId(query.student)
        : { $in: parent.students };
    } else if (user.role === ROLES.TEACHER) {
      const teacher = await Teacher.findOne({ user: user.id });
      if (!teacher) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Teacher profile not found');
      }

      const [assignments, classTeacherSections] = await Promise.all([
        TeacherAssignment.find({ teacher: teacher._id, status: 'Active' }).select(
          'subject section'
        ),
        Section.find({ classTeacher: teacher._id }).select('_id'),
      ]);

      const orConditions: Record<string, unknown>[] = [
        { assignedTeacher: teacher._id },
      ];
      for (const a of assignments) {
        orConditions.push({
          subject: a.subject,
          section: a.section,
        });
      }
      if (classTeacherSections.length > 0) {
        orConditions.push({
          section: { $in: classTeacherSections.map((s) => s._id) },
        });
      }

      filter.$or = orConditions;
    }

    if (query.student && (user.role === ROLES.SUPER_ADMIN || user.role === ROLES.ADMIN || user.role === ROLES.TEACHER)) {
      filter.student = new Types.ObjectId(query.student);
    }
    if (query.subject) filter.subject = new Types.ObjectId(query.subject);
    if (query.section) filter.section = new Types.ObjectId(query.section);
    if (query.academicYear) filter.academicYear = new Types.ObjectId(query.academicYear);
    if (query.semester !== undefined) filter.semester = Number(query.semester);
    if (query.assignedTeacher) {
      filter.assignedTeacher = new Types.ObjectId(query.assignedTeacher);
    }
    if (query.category) filter.category = query.category;
    if (query.priority) filter.priority = query.priority;
    if (query.status) filter.status = query.status;

    if (query.search) {
      const regex = new RegExp(query.search, 'i');
      filter.$and = [
        ...(Array.isArray(filter.$and) ? filter.$and : []),
        {
          $or: [{ title: regex }, { description: regex }, { topic: regex }],
        },
      ];
    }

    if (query.startDate || query.endDate) {
      const dateRange: Record<string, Date> = {};
      if (query.startDate) dateRange.$gte = new Date(query.startDate);
      if (query.endDate) dateRange.$lte = new Date(query.endDate);
      filter.createdAt = dateRange;
    }

    const total = await Doubt.countDocuments(filter);
    const meta = calculatePagination(query.page, query.limit, total);
    const skip = (meta.page - 1) * meta.limit;

    const items = await Doubt.find(filter)
      .populate('student', 'firstName lastName usn rollNumber semester')
      .populate('subject', 'name code')
      .populate('section', 'sectionName semester roomNumber')
      .populate('assignedTeacher', 'firstName lastName employeeId designation')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(meta.limit);

    return { items, meta };
  }

  /**
   * Get single doubt by ID with RBAC check
   */
  public static async getDoubtById(
    doubtId: string,
    user: { id: string; role: string }
  ): Promise<IDoubt> {
    const doubt = await Doubt.findById(doubtId)
      .populate('student', 'firstName lastName usn rollNumber semester')
      .populate('subject', 'name code')
      .populate('section', 'sectionName semester roomNumber')
      .populate('assignedTeacher', 'firstName lastName employeeId designation');

    if (!doubt) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Doubt not found');
    }

    await this.verifyDoubtAccess(doubt, user);
    return doubt;
  }

  /**
   * Update doubt details
   */
  public static async updateDoubt(
    doubtId: string,
    updates: {
      title?: string;
      description?: string;
      category?: DoubtCategory;
      priority?: DoubtPriority;
      topic?: string;
      tags?: string[];
      attachments?: IAttachment[];
    },
    user: { id: string; role: string }
  ): Promise<IDoubt> {
    const doubt = await Doubt.findById(doubtId);
    if (!doubt) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Doubt not found');
    }

    await this.verifyDoubtAccess(doubt, user);

    if (doubt.status === 'closed') {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Closed doubts cannot be modified');
    }

    if (updates.title !== undefined) doubt.title = updates.title;
    if (updates.description !== undefined) doubt.description = updates.description;
    if (updates.category !== undefined) doubt.category = updates.category;
    if (updates.priority !== undefined) doubt.priority = updates.priority;
    if (updates.topic !== undefined) doubt.topic = updates.topic;
    if (updates.tags !== undefined) doubt.tags = updates.tags;
    if (updates.attachments !== undefined) doubt.attachments = updates.attachments;

    await doubt.save();
    return this.getDoubtById(doubt._id.toString(), user);
  }

  /**
   * Assign or reassign a doubt to a teacher
   */
  public static async assignDoubt(
    doubtId: string,
    targetTeacherId: string,
    reason: string | undefined,
    user: { id: string; role: string }
  ): Promise<IDoubt> {
    const doubt = await Doubt.findById(doubtId);
    if (!doubt) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Doubt not found');
    }

    if (user.role === ROLES.TEACHER) {
      const actingTeacher = await Teacher.findOne({ user: user.id });
      if (!actingTeacher) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Teacher profile not found');
      }
      const authorized = await this.isTeacherAuthorizedForDoubt(actingTeacher, doubt);
      if (!authorized) {
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          'You are not authorized to reassign doubts outside your assigned subjects and sections'
        );
      }
    } else if (user.role !== ROLES.SUPER_ADMIN && user.role !== ROLES.ADMIN) {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        'Only authorized teachers or administrators can assign or reassign doubts'
      );
    }

    const newTeacher = await Teacher.findById(targetTeacherId);
    if (!newTeacher || newTeacher.status !== 'Active') {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Target teacher not found or inactive');
    }

    const previousTeacher = doubt.assignedTeacher;
    const previousStatus = doubt.status;
    doubt.assignedTeacher = newTeacher._id;

    if (doubt.status === 'open') {
      doubt.status = 'assigned';
      doubt.statusHistory.push({
        previousStatus,
        newStatus: 'assigned',
        changedBy: new Types.ObjectId(user.id),
        reason: reason || 'Doubt assigned to teacher',
        changedAt: new Date(),
      });
    }

    doubt.assignmentHistory.push({
      previousTeacher,
      newTeacher: newTeacher._id,
      assignedBy: new Types.ObjectId(user.id),
      reason: reason || 'Manual teacher assignment',
      assignedAt: new Date(),
    });

    await doubt.save();

    if (newTeacher.user) {
      await NotificationService.createEventNotification({
        recipient: newTeacher.user,
        title: `Doubt Assigned: ${doubt.title}`,
        message: `A student doubt "${doubt.title}" has been assigned to you.`,
        notificationType: 'doubt_update',
        category: 'academic',
        priority: doubt.priority === 'high' ? 'high' : 'normal',
        relatedEntityType: 'Doubt',
        relatedEntityId: doubt._id,
        eventKey: `doubt_assigned:${doubt._id.toString()}:${newTeacher.user.toString()}:${doubt.assignmentHistory.length}`,
      });
    }

    return this.getDoubtById(doubt._id.toString(), user);
  }

  /**
   * Update doubt status (teachers and administrators)
   */
  public static async updateDoubtStatus(
    doubtId: string,
    newStatus: DoubtStatus,
    reason: string | undefined,
    user: { id: string; role: string }
  ): Promise<IDoubt> {
    const doubt = await Doubt.findById(doubtId);
    if (!doubt) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Doubt not found');
    }

    if (user.role === ROLES.TEACHER) {
      const teacher = await Teacher.findOne({ user: user.id });
      if (!teacher) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Teacher profile not found');
      }
      const authorized = await this.isTeacherAuthorizedForDoubt(teacher, doubt);
      if (!authorized) {
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          'You are not authorized to update status for this doubt'
        );
      }
    } else if (user.role === ROLES.STUDENT) {
      const student = await Student.findOne({ user: user.id });
      if (!student || student._id.toString() !== doubt.student.toString()) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Students can only update their own doubts');
      }
      if (newStatus !== 'resolved' && newStatus !== 'closed') {
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          'Students can only mark their own doubt as resolved or closed, or use the reopen endpoint'
        );
      }
    } else if (user.role !== ROLES.SUPER_ADMIN && user.role !== ROLES.ADMIN) {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Unauthorized to update doubt status');
    }

    const previousStatus = doubt.status;
    const now = new Date();
    doubt.status = newStatus;

    if (newStatus === 'answered' && !doubt.answeredAt) {
      doubt.answeredAt = now;
      if (!doubt.firstRespondedAt) doubt.firstRespondedAt = now;
    }
    if (newStatus === 'resolved') {
      doubt.resolvedAt = now;
      if (!doubt.firstRespondedAt) doubt.firstRespondedAt = now;
    }
    if (newStatus === 'closed') {
      doubt.closedAt = now;
    }

    doubt.statusHistory.push({
      previousStatus,
      newStatus,
      changedBy: new Types.ObjectId(user.id),
      reason: reason || `Status updated to ${newStatus}`,
      changedAt: now,
    });

    await doubt.save();

    // Notify student when teacher/admin marks doubt as answered or resolved
    if (
      user.role !== ROLES.STUDENT &&
      (newStatus === 'answered' || newStatus === 'resolved')
    ) {
      const studentDoc = await Student.findById(doubt.student);
      if (studentDoc?.user) {
        await NotificationService.createEventNotification({
          recipient: studentDoc.user,
          title: `Doubt ${newStatus === 'resolved' ? 'Resolved' : 'Answered'}: ${doubt.title}`,
          message: `Your doubt "${doubt.title}" has been marked as ${newStatus}.`,
          notificationType: 'doubt_update',
          category: 'academic',
          priority: 'normal',
          relatedEntityType: 'Doubt',
          relatedEntityId: doubt._id,
          eventKey: `doubt_status:${doubt._id.toString()}:${newStatus}:${doubt.statusHistory.length}`,
        });
      }
    }

    return this.getDoubtById(doubt._id.toString(), user);
  }

  /**
   * Add a message or internal staff note to a doubt conversation
   */
  public static async addDoubtMessage(
    doubtId: string,
    payload: {
      message: string;
      attachments?: IAttachment[];
      isInternalNote?: boolean;
      markAsStatus?: 'in_progress' | 'answered' | 'resolved';
    },
    user: { id: string; role: string }
  ): Promise<IDoubtMessage> {
    const doubt = await Doubt.findById(doubtId);
    if (!doubt) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Doubt not found');
    }

    await this.verifyDoubtAccess(doubt, user);

    if (user.role === ROLES.PARENT) {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        'Parents cannot post directly to student doubt threads; use parent-teacher communication'
      );
    }

    const isStaff =
      user.role === ROLES.TEACHER ||
      user.role === ROLES.ADMIN ||
      user.role === ROLES.SUPER_ADMIN;

    if (payload.isInternalNote && !isStaff) {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        'Only authorized staff can create internal notes'
      );
    }

    if (doubt.status === 'closed') {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        'Cannot post messages to a closed doubt. Reopen the doubt first.'
      );
    }

    const msgDoc = await DoubtMessage.create({
      doubt: doubt._id,
      sender: new Types.ObjectId(user.id),
      senderRole: user.role,
      message: payload.message,
      attachments: payload.attachments || [],
      isInternalNote: Boolean(payload.isInternalNote),
    });

    const now = new Date();

    // Update doubt lifecycle timestamps & notify recipient if public message
    if (!payload.isInternalNote) {
      if (isStaff) {
        if (!doubt.firstRespondedAt) {
          doubt.firstRespondedAt = now;
        }
        const targetStatus: DoubtStatus =
          payload.markAsStatus ||
          (doubt.status === 'open' || doubt.status === 'assigned' || doubt.status === 'in_progress'
            ? 'answered'
            : doubt.status);

        if (targetStatus !== doubt.status) {
          const prev = doubt.status;
          doubt.status = targetStatus;
          if (targetStatus === 'answered') doubt.answeredAt = now;
          if (targetStatus === 'resolved') doubt.resolvedAt = now;
          doubt.statusHistory.push({
            previousStatus: prev,
            newStatus: targetStatus,
            changedBy: new Types.ObjectId(user.id),
            reason: 'Teacher responded to doubt',
            changedAt: now,
          });
        }
        await doubt.save();

        // Notify student
        const studentDoc = await Student.findById(doubt.student);
        if (studentDoc?.user) {
          await NotificationService.createEventNotification({
            recipient: studentDoc.user,
            title: `New Response on Doubt: ${doubt.title}`,
            message: payload.message.slice(0, 240),
            notificationType: 'doubt_update',
            category: 'academic',
            priority: doubt.priority === 'high' ? 'high' : 'normal',
            relatedEntityType: 'Doubt',
            relatedEntityId: doubt._id,
            eventKey: `doubt_msg:${msgDoc._id.toString()}:${studentDoc.user.toString()}`,
          });
        }
      } else if (user.role === ROLES.STUDENT) {
        // Student follow-up question transitions answered -> in_progress
        if (doubt.status === 'answered') {
          const prev = doubt.status;
          doubt.status = 'in_progress';
          doubt.statusHistory.push({
            previousStatus: prev,
            newStatus: 'in_progress',
            changedBy: new Types.ObjectId(user.id),
            reason: 'Student posted follow-up question',
            changedAt: now,
          });
          await doubt.save();
        }

        if (doubt.assignedTeacher) {
          const teacherDoc = await Teacher.findById(doubt.assignedTeacher);
          if (teacherDoc?.user) {
            await NotificationService.createEventNotification({
              recipient: teacherDoc.user,
              title: `Follow-up on Doubt: ${doubt.title}`,
              message: payload.message.slice(0, 240),
              notificationType: 'doubt_update',
              category: 'academic',
              priority: doubt.priority === 'high' ? 'high' : 'normal',
              relatedEntityType: 'Doubt',
              relatedEntityId: doubt._id,
              eventKey: `doubt_msg:${msgDoc._id.toString()}:${teacherDoc.user.toString()}`,
            });
          }
        }
      }
    }

    return msgDoc.populate('sender', 'firstName lastName email role');
  }

  /**
   * Retrieve paginated conversation messages for a doubt.
   * Internal staff notes (isInternalNote: true) are strictly hidden from students and parents.
   */
  public static async getDoubtMessages(
    doubtId: string,
    query: { page?: number; limit?: number },
    user: { id: string; role: string }
  ) {
    const doubt = await Doubt.findById(doubtId);
    if (!doubt) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Doubt not found');
    }

    await this.verifyDoubtAccess(doubt, user);

    const isStaff =
      user.role === ROLES.TEACHER ||
      user.role === ROLES.ADMIN ||
      user.role === ROLES.SUPER_ADMIN;

    const filter: Record<string, unknown> = {
      doubt: doubt._id,
    };

    if (!isStaff) {
      filter.isInternalNote = false;
    }

    const total = await DoubtMessage.countDocuments(filter);
    const meta = calculatePagination(query.page, query.limit, total);
    const skip = (meta.page - 1) * meta.limit;

    const items = await DoubtMessage.find(filter)
      .populate('sender', 'firstName lastName email role')
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(meta.limit);

    return { items, meta };
  }

  /**
   * Reopen an answered, resolved, or closed doubt under configurable rules
   */
  public static async reopenDoubt(
    doubtId: string,
    reason: string,
    user: { id: string; role: string }
  ): Promise<IDoubt> {
    const doubt = await Doubt.findById(doubtId);
    if (!doubt) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Doubt not found');
    }

    await this.verifyDoubtAccess(doubt, user);

    if (!['answered', 'resolved', 'closed'].includes(doubt.status)) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        `Doubt is currently "${doubt.status}" and does not need to be reopened`
      );
    }

    if (doubt.reopenCount >= MAX_REOPEN_COUNT) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        `Maximum reopen limit (${MAX_REOPEN_COUNT}) reached for this doubt`
      );
    }

    const referenceDate = doubt.resolvedAt || doubt.closedAt || doubt.answeredAt || doubt.updatedAt;
    const daysElapsed =
      (Date.now() - new Date(referenceDate).getTime()) / (1000 * 60 * 60 * 24);
    if (daysElapsed > REOPEN_WINDOW_DAYS && user.role === ROLES.STUDENT) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        `Doubt cannot be reopened after ${REOPEN_WINDOW_DAYS} days of resolution`
      );
    }

    const previousStatus = doubt.status;
    const nextStatus: DoubtStatus = doubt.assignedTeacher ? 'in_progress' : 'open';
    const now = new Date();

    doubt.status = nextStatus;
    doubt.reopenCount += 1;
    doubt.lastReopenedAt = now;
    doubt.resolvedAt = undefined;
    doubt.closedAt = undefined;

    doubt.statusHistory.push({
      previousStatus,
      newStatus: nextStatus,
      changedBy: new Types.ObjectId(user.id),
      reason,
      changedAt: now,
    });

    await doubt.save();

    if (doubt.assignedTeacher) {
      const teacherDoc = await Teacher.findById(doubt.assignedTeacher);
      if (teacherDoc?.user) {
        await NotificationService.createEventNotification({
          recipient: teacherDoc.user,
          title: `Doubt Reopened: ${doubt.title}`,
          message: `Doubt "${doubt.title}" was reopened. Reason: ${reason}`,
          notificationType: 'doubt_update',
          category: 'academic',
          priority: 'high',
          relatedEntityType: 'Doubt',
          relatedEntityId: doubt._id,
          eventKey: `doubt_reopen:${doubt._id.toString()}:${doubt.reopenCount}`,
        });
      }
    }

    return this.getDoubtById(doubt._id.toString(), user);
  }

  /**
   * Build common match filter for doubt analytics
   */
  private static buildAnalyticsMatch(query: {
    subject?: string;
    section?: string;
    academicYear?: string;
    semester?: number;
    startDate?: string;
    endDate?: string;
  }): Record<string, unknown> {
    const match: Record<string, unknown> = {};
    if (query.subject) match.subject = new Types.ObjectId(query.subject);
    if (query.section) match.section = new Types.ObjectId(query.section);
    if (query.academicYear) match.academicYear = new Types.ObjectId(query.academicYear);
    if (query.semester !== undefined) match.semester = Number(query.semester);
    if (query.startDate || query.endDate) {
      const dateRange: Record<string, Date> = {};
      if (query.startDate) dateRange.$gte = new Date(query.startDate);
      if (query.endDate) dateRange.$lte = new Date(query.endDate);
      match.createdAt = dateRange;
    }
    return match;
  }

  /**
   * Module 3: Doubt Overview Analytics (Admin only)
   */
  public static async getOverviewAnalytics(query: {
    subject?: string;
    section?: string;
    academicYear?: string;
    semester?: number;
    startDate?: string;
    endDate?: string;
    overdueHours?: number;
  }) {
    const match = this.buildAnalyticsMatch(query);
    const overdueHours = query.overdueHours || DEFAULT_OVERDUE_HOURS;
    const overdueCutoff = new Date(Date.now() - overdueHours * 60 * 60 * 1000);

    const [doubts, topicAgg] = await Promise.all([
      Doubt.find(match).lean(),
      Doubt.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              topic: { $ifNull: ['$topic', '$category'] },
              category: '$category',
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
    ]);

    let totalDoubts = 0;
    let openDoubts = 0;
    let pendingDoubts = 0;
    let answeredDoubts = 0;
    let resolvedDoubts = 0;
    let closedDoubts = 0;
    let overdueDoubts = 0;

    let responseTimeSumMs = 0;
    let responseTimeCount = 0;

    let resolutionTimeSumMs = 0;
    let resolutionTimeCount = 0;

    for (const d of doubts) {
      totalDoubts += 1;
      if (d.status === 'open') openDoubts += 1;
      if (d.status === 'open' || d.status === 'assigned' || d.status === 'in_progress') {
        pendingDoubts += 1;
        if (new Date(d.createdAt) < overdueCutoff) {
          overdueDoubts += 1;
        }
      }
      if (d.status === 'answered') answeredDoubts += 1;
      if (d.status === 'resolved') resolvedDoubts += 1;
      if (d.status === 'closed') closedDoubts += 1;

      if (d.firstRespondedAt && d.createdAt) {
        const diff = new Date(d.firstRespondedAt).getTime() - new Date(d.createdAt).getTime();
        if (diff >= 0) {
          responseTimeSumMs += diff;
          responseTimeCount += 1;
        }
      }

      if (d.resolvedAt && d.createdAt) {
        const diff = new Date(d.resolvedAt).getTime() - new Date(d.createdAt).getTime();
        if (diff >= 0) {
          resolutionTimeSumMs += diff;
          resolutionTimeCount += 1;
        }
      }
    }

    const averageResponseTimeMinutes =
      responseTimeCount > 0
        ? Number((responseTimeSumMs / responseTimeCount / 60000).toFixed(2))
        : 0;

    const averageResolutionTimeMinutes =
      resolutionTimeCount > 0
        ? Number((resolutionTimeSumMs / resolutionTimeCount / 60000).toFixed(2))
        : 0;

    const frequentlyRaisedTopics = topicAgg.map((t) => ({
      topic: t._id.topic,
      category: t._id.category,
      count: t.count,
    }));

    return {
      totalDoubts,
      openDoubts,
      pendingDoubts,
      answeredDoubts,
      resolvedDoubts,
      closedDoubts,
      overdueDoubts,
      averageResponseTimeMinutes,
      averageResolutionTimeMinutes,
      frequentlyRaisedTopics,
    };
  }

  /**
   * Module 3: Doubts by Subject Analytics (Admin only)
   */
  public static async getSubjectAnalytics(query: {
    subject?: string;
    section?: string;
    academicYear?: string;
    semester?: number;
    startDate?: string;
    endDate?: string;
  }) {
    const match = this.buildAnalyticsMatch(query);

    const rows = await Doubt.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$subject',
          totalDoubts: { $sum: 1 },
          openDoubts: {
            $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] },
          },
          pendingDoubts: {
            $sum: {
              $cond: [{ $in: ['$status', ['open', 'assigned', 'in_progress']] }, 1, 0],
            },
          },
          answeredDoubts: {
            $sum: { $cond: [{ $eq: ['$status', 'answered'] }, 1, 0] },
          },
          resolvedDoubts: {
            $sum: { $cond: [{ $in: ['$status', ['resolved', 'closed']] }, 1, 0] },
          },
          topics: { $addToSet: '$topic' },
        },
      },
      {
        $lookup: {
          from: 'subjects',
          localField: '_id',
          foreignField: '_id',
          as: 'subjectInfo',
        },
      },
      { $unwind: { path: '$subjectInfo', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          subjectId: '$_id',
          subjectName: { $ifNull: ['$subjectInfo.name', 'Unknown Subject'] },
          subjectCode: { $ifNull: ['$subjectInfo.code', 'N/A'] },
          totalDoubts: 1,
          openDoubts: 1,
          pendingDoubts: 1,
          answeredDoubts: 1,
          resolvedDoubts: 1,
          recurringTopics: {
            $filter: {
              input: '$topics',
              as: 't',
              cond: { $ne: ['$$t', null] },
            },
          },
        },
      },
      { $sort: { totalDoubts: -1 } },
    ]);

    return rows;
  }

  /**
   * Module 3: Teacher-Wise Doubt Workload Information (Admin only, neutral workload metrics without subjective rankings)
   */
  public static async getTeacherWorkloadAnalytics(query: {
    subject?: string;
    section?: string;
    academicYear?: string;
    semester?: number;
    startDate?: string;
    endDate?: string;
  }) {
    const match = this.buildAnalyticsMatch(query);
    match.assignedTeacher = { $exists: true, $ne: null };

    const rows = await Doubt.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$assignedTeacher',
          assignedCount: { $sum: 1 },
          activePendingCount: {
            $sum: {
              $cond: [{ $in: ['$status', ['open', 'assigned', 'in_progress']] }, 1, 0],
            },
          },
          answeredCount: {
            $sum: { $cond: [{ $eq: ['$status', 'answered'] }, 1, 0] },
          },
          resolvedCount: {
            $sum: { $cond: [{ $in: ['$status', ['resolved', 'closed']] }, 1, 0] },
          },
          avgResponseMs: {
            $avg: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$firstRespondedAt', null] },
                    { $ne: ['$createdAt', null] },
                  ],
                },
                { $subtract: ['$firstRespondedAt', '$createdAt'] },
                null,
              ],
            },
          },
        },
      },
      {
        $lookup: {
          from: 'teachers',
          localField: '_id',
          foreignField: '_id',
          as: 'teacherInfo',
        },
      },
      { $unwind: { path: '$teacherInfo', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          teacherId: '$_id',
          employeeId: '$teacherInfo.employeeId',
          teacherName: {
            $concat: [
              { $ifNull: ['$teacherInfo.firstName', ''] },
              ' ',
              { $ifNull: ['$teacherInfo.lastName', ''] },
            ],
          },
          assignedCount: 1,
          activePendingCount: 1,
          answeredCount: 1,
          resolvedCount: 1,
          averageResponseTimeMinutes: {
            $cond: [
              { $ne: ['$avgResponseMs', null] },
              { $round: [{ $divide: ['$avgResponseMs', 60000] }, 2] },
              0,
            ],
          },
        },
      },
      { $sort: { employeeId: 1 } },
    ]);

    return rows;
  }
}
