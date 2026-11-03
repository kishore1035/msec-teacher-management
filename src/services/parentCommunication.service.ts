import { Types } from 'mongoose';
import {
  ParentCommunication,
  IParentCommunication,
  ParentCommunicationType,
  IMeetingDetails,
} from '../models/parentCommunication.model';
import {
  ParentCommunicationMessage,
  IParentCommunicationMessage,
} from '../models/parentCommunicationMessage.model';
import { Parent, IParent } from '../models/parent.model';
import { Student, IStudent } from '../models/student.model';
import { Teacher, ITeacher } from '../models/teacher.model';
import { Section } from '../models/section.model';
import { Subject } from '../models/subject.model';
import { TeacherAssignment } from '../models/teacherAssignment.model';
import { IAttachment } from '../models/assignment.model';
import { NotificationService } from './notification.service';
import { calculatePagination } from '../utils/pagination';
import { ApiError } from '../utils/apiError';
import { HTTP_STATUS } from '../constants/statusCodes';
import { ROLES } from '../constants/roles.constant';

export interface CreateParentCommunicationInput {
  parent?: string;
  student: string;
  teacher: string;
  subject?: string;
  communicationType?: ParentCommunicationType;
  subjectLine: string;
  message: string;
  attachments?: IAttachment[];
  meetingDetails?: {
    requestedDates?: string[];
    preferredMode?: 'in_person' | 'online' | 'phone';
    agenda?: string;
    scheduledAt?: string;
    locationOrLink?: string;
  };
}

export class ParentCommunicationService {
  /**
   * Verify whether a teacher is authorized to communicate regarding a specific student
   * (must teach the student's section or be the section's classTeacher)
   */
  public static async isTeacherAuthorizedForStudent(
    teacherId: Types.ObjectId,
    student: IStudent,
    subjectId?: Types.ObjectId
  ): Promise<boolean> {
    const assignmentQuery: Record<string, unknown> = {
      teacher: teacherId,
      section: student.section,
      status: 'Active',
    };
    if (subjectId) {
      assignmentQuery.subject = subjectId;
    }

    const [assignment, classTeacherSection] = await Promise.all([
      TeacherAssignment.findOne(assignmentQuery),
      Section.findOne({
        _id: student.section,
        classTeacher: teacherId,
      }),
    ]);

    return Boolean(assignment || classTeacherSection);
  }

  /**
   * Verify access to an existing ParentCommunication thread
   */
  public static async verifyThreadAccess(
    communication: IParentCommunication,
    user: { id: string; role: string }
  ): Promise<{ parent?: IParent; teacher?: ITeacher }> {
    if (user.role === ROLES.SUPER_ADMIN || user.role === ROLES.ADMIN) {
      return {};
    }

    const extractId = (ref: unknown): string => {
      if (!ref) return '';
      if (typeof ref === 'object' && ref !== null && '_id' in ref) {
        return String((ref as { _id: unknown })._id);
      }
      return String(ref);
    };

    const commParentId = extractId(communication.parent);
    const commTeacherId = extractId(communication.teacher);

    if (user.role === ROLES.PARENT) {
      const parent = await Parent.findOne({ user: user.id });
      if (!parent || parent._id.toString() !== commParentId) {
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          'You can only access your own parent-teacher communications'
        );
      }
      return { parent };
    }

    if (user.role === ROLES.TEACHER) {
      const teacher = await Teacher.findOne({ user: user.id });
      if (!teacher || teacher._id.toString() !== commTeacherId) {
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          'You can only access parent-teacher communications assigned to you'
        );
      }
      return { teacher };
    }

    throw new ApiError(
      HTTP_STATUS.FORBIDDEN,
      'You are not authorized to access parent-teacher communications'
    );
  }

  /**
   * Create a new Parent-Teacher communication thread (or meeting request)
   */
  public static async createCommunication(
    input: CreateParentCommunicationInput,
    user: { id: string; role: string }
  ): Promise<IParentCommunication> {
    const student = await Student.findById(input.student);
    if (!student) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Referenced student not found');
    }

    const teacher = await Teacher.findById(input.teacher);
    if (!teacher || teacher.status !== 'Active') {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Referenced teacher not found or inactive');
    }

    let subjectObjId: Types.ObjectId | undefined;
    if (input.subject) {
      const subjectDoc = await Subject.findById(input.subject);
      if (!subjectDoc) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Referenced subject not found');
      }
      subjectObjId = subjectDoc._id;
    }

    let parentDoc: IParent | null = null;

    if (user.role === ROLES.PARENT) {
      parentDoc = await Parent.findOne({ user: user.id });
      if (!parentDoc) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Parent profile not found');
      }
      if (input.parent && input.parent !== parentDoc._id.toString()) {
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          'Parents cannot initiate communication on behalf of another parent'
        );
      }
    } else if (user.role === ROLES.TEACHER) {
      const actingTeacher = await Teacher.findOne({ user: user.id });
      if (!actingTeacher || actingTeacher._id.toString() !== teacher._id.toString()) {
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          'Teachers can only initiate communication under their own profile'
        );
      }
      if (input.parent) {
        parentDoc = await Parent.findById(input.parent);
      } else if (student.parent) {
        parentDoc = await Parent.findById(student.parent);
      } else {
        parentDoc = await Parent.findOne({ students: student._id });
      }
    } else if (user.role === ROLES.SUPER_ADMIN || user.role === ROLES.ADMIN) {
      if (input.parent) {
        parentDoc = await Parent.findById(input.parent);
      } else if (student.parent) {
        parentDoc = await Parent.findById(student.parent);
      } else {
        parentDoc = await Parent.findOne({ students: student._id });
      }
    } else {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        'Only parents, teachers, or administrators can initiate parent-teacher communication'
      );
    }

    if (!parentDoc) {
      throw new ApiError(
        HTTP_STATUS.NOT_FOUND,
        'Linked parent profile not found for this student'
      );
    }

    // Verify that the parent is linked to the student
    const isLinked = parentDoc.students.some(
      (sid) => sid.toString() === student._id.toString()
    );
    if (!isLinked || parentDoc.verificationStatus === 'rejected') {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        'Parent is not authorized or linked to the specified student'
      );
    }

    // Verify that the teacher is authorized for the student's section/subject
    const isTeacherAuthorized = await this.isTeacherAuthorizedForStudent(
      teacher._id,
      student,
      subjectObjId
    );
    if (!isTeacherAuthorized) {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        'Selected teacher is not assigned to this student section or subject'
      );
    }

    const commType: ParentCommunicationType = input.communicationType || 'general';
    const now = new Date();
    const actorId = new Types.ObjectId(user.id);

    let meetingDetails: IMeetingDetails | undefined;
    if (commType === 'meeting_request' || input.meetingDetails) {
      meetingDetails = {
        requestedDates: (input.meetingDetails?.requestedDates || []).map(
          (d) => new Date(d)
        ),
        preferredMode: input.meetingDetails?.preferredMode || 'in_person',
        agenda: input.meetingDetails?.agenda || input.subjectLine,
        scheduledAt: input.meetingDetails?.scheduledAt
          ? new Date(input.meetingDetails.scheduledAt)
          : undefined,
        locationOrLink: input.meetingDetails?.locationOrLink,
        meetingStatus: 'requested',
      };
    }

    const communication = await ParentCommunication.create({
      parent: parentDoc._id,
      student: student._id,
      teacher: teacher._id,
      subject: subjectObjId,
      section: student.section,
      initiatedBy: actorId,
      initiatedByRole: user.role,
      communicationType: commType,
      subjectLine: input.subjectLine,
      message: input.message,
      attachments: input.attachments || [],
      status: 'open',
      meetingDetails,
      auditLog: [
        {
          action: commType === 'meeting_request' ? 'meeting_requested' : 'created',
          performedBy: actorId,
          timestamp: now,
          details: `Thread initiated by ${user.role}`,
        },
      ],
    });

    // Store initial message in ParentCommunicationMessage collection for complete conversation history
    await ParentCommunicationMessage.create({
      communication: communication._id,
      sender: actorId,
      senderRole: user.role,
      message: input.message,
      attachments: input.attachments || [],
    });

    // Notify recipient via Phase 9 NotificationService
    const notifType =
      commType === 'meeting_request' ? 'meeting_request' : 'parent_communication';
    if (user.role === ROLES.PARENT && teacher.user) {
      await NotificationService.createEventNotification({
        recipient: teacher.user,
        title:
          commType === 'meeting_request'
            ? `Meeting Request: ${input.subjectLine}`
            : `Parent Message: ${input.subjectLine}`,
        message: `Guardian of ${student.firstName} ${student.lastName} (${student.usn}): ${input.message.slice(0, 200)}`,
        notificationType: notifType,
        category: 'academic',
        priority: commType === 'meeting_request' ? 'high' : 'normal',
        relatedEntityType: 'ParentCommunication',
        relatedEntityId: communication._id,
        eventKey: `parent_comm_init:${communication._id.toString()}:${teacher.user.toString()}`,
      });
    } else if (user.role !== ROLES.PARENT && parentDoc.user) {
      await NotificationService.createEventNotification({
        recipient: parentDoc.user,
        title:
          commType === 'meeting_request'
            ? `Teacher Meeting Request: ${input.subjectLine}`
            : `Academic Feedback from Teacher: ${input.subjectLine}`,
        message: `Regarding ${student.firstName} ${student.lastName}: ${input.message.slice(0, 200)}`,
        notificationType: notifType,
        category: 'academic',
        priority: commType === 'meeting_request' ? 'high' : 'normal',
        relatedEntityType: 'ParentCommunication',
        relatedEntityId: communication._id,
        eventKey: `parent_comm_init:${communication._id.toString()}:${parentDoc.user.toString()}`,
      });
    }

    return communication.populate([
      { path: 'parent', select: 'fatherName motherName guardianName relationshipType primaryPhone' },
      { path: 'student', select: 'firstName lastName usn rollNumber semester' },
      { path: 'teacher', select: 'firstName lastName employeeId designation' },
      { path: 'subject', select: 'name code' },
    ]);
  }

  /**
   * Create a dedicated parent-teacher meeting request
   */
  public static async createMeetingRequest(
    input: {
      parent?: string;
      student: string;
      teacher: string;
      subject?: string;
      subjectLine?: string;
      message: string;
      requestedDates?: string[];
      preferredMode?: 'in_person' | 'online' | 'phone';
      agenda?: string;
      scheduledAt?: string;
      locationOrLink?: string;
      attachments?: IAttachment[];
    },
    user: { id: string; role: string }
  ): Promise<IParentCommunication> {
    return this.createCommunication(
      {
        parent: input.parent,
        student: input.student,
        teacher: input.teacher,
        subject: input.subject,
        communicationType: 'meeting_request',
        subjectLine: input.subjectLine || 'Parent-Teacher Meeting Request',
        message: input.message,
        attachments: input.attachments,
        meetingDetails: {
          requestedDates: input.requestedDates,
          preferredMode: input.preferredMode,
          agenda: input.agenda,
          scheduledAt: input.scheduledAt,
          locationOrLink: input.locationOrLink,
        },
      },
      user
    );
  }

  /**
   * List parent-teacher communications with role-scoped filtering and pagination
   */
  public static async getCommunications(
    query: {
      parent?: string;
      student?: string;
      teacher?: string;
      subject?: string;
      communicationType?: string;
      status?: string;
      page?: number;
      limit?: number;
    },
    user: { id: string; role: string }
  ) {
    const filter: Record<string, unknown> = {};

    if (user.role === ROLES.PARENT) {
      const parent = await Parent.findOne({ user: user.id });
      if (!parent) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Parent profile not found');
      }
      filter.parent = parent._id;
    } else if (user.role === ROLES.TEACHER) {
      const teacher = await Teacher.findOne({ user: user.id });
      if (!teacher) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Teacher profile not found');
      }
      filter.teacher = teacher._id;
    } else if (user.role !== ROLES.SUPER_ADMIN && user.role !== ROLES.ADMIN) {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        'Unauthorized to view parent-teacher communications'
      );
    }

    if (query.parent && (user.role === ROLES.ADMIN || user.role === ROLES.SUPER_ADMIN)) {
      filter.parent = new Types.ObjectId(query.parent);
    }
    if (query.student) filter.student = new Types.ObjectId(query.student);
    if (query.teacher && user.role !== ROLES.TEACHER) {
      filter.teacher = new Types.ObjectId(query.teacher);
    }
    if (query.subject) filter.subject = new Types.ObjectId(query.subject);
    if (query.communicationType) filter.communicationType = query.communicationType;
    if (query.status) filter.status = query.status;

    const total = await ParentCommunication.countDocuments(filter);
    const meta = calculatePagination(query.page, query.limit, total);
    const skip = (meta.page - 1) * meta.limit;

    const items = await ParentCommunication.find(filter)
      .populate('parent', 'fatherName motherName guardianName relationshipType primaryPhone')
      .populate('student', 'firstName lastName usn rollNumber semester')
      .populate('teacher', 'firstName lastName employeeId designation')
      .populate('subject', 'name code')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(meta.limit);

    return { items, meta };
  }

  /**
   * Get single communication thread by ID along with its paginated/complete messages
   */
  public static async getCommunicationById(
    communicationId: string,
    user: { id: string; role: string }
  ) {
    const communication = await ParentCommunication.findById(communicationId)
      .populate('parent', 'fatherName motherName guardianName relationshipType primaryPhone user')
      .populate('student', 'firstName lastName usn rollNumber semester section')
      .populate('teacher', 'firstName lastName employeeId designation user')
      .populate('subject', 'name code');

    if (!communication) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Communication thread not found');
    }

    await this.verifyThreadAccess(communication, user);

    const messages = await ParentCommunicationMessage.find({
      communication: communication._id,
    })
      .populate('sender', 'firstName lastName email role')
      .sort({ createdAt: 1 });

    return {
      communication,
      messages,
    };
  }

  /**
   * Add a reply message to an existing Parent-Teacher communication thread
   */
  public static async addMessage(
    communicationId: string,
    payload: {
      message: string;
      attachments?: IAttachment[];
      meetingUpdate?: {
        scheduledAt?: string;
        locationOrLink?: string;
        meetingStatus?: 'requested' | 'confirmed' | 'rescheduled' | 'completed' | 'cancelled';
      };
    },
    user: { id: string; role: string }
  ): Promise<IParentCommunicationMessage> {
    const communication = await ParentCommunication.findById(communicationId);
    if (!communication) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Communication thread not found');
    }

    await this.verifyThreadAccess(communication, user);

    if (communication.status === 'closed') {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        'Cannot post messages to a closed communication thread'
      );
    }

    const msgDoc = await ParentCommunicationMessage.create({
      communication: communication._id,
      sender: new Types.ObjectId(user.id),
      senderRole: user.role,
      message: payload.message,
      attachments: payload.attachments || [],
    });

    communication.status = 'replied';

    if (
      payload.meetingUpdate &&
      (user.role === ROLES.TEACHER ||
        user.role === ROLES.ADMIN ||
        user.role === ROLES.SUPER_ADMIN)
    ) {
      const existingMeeting: IMeetingDetails = communication.meetingDetails || {};
      if (payload.meetingUpdate.scheduledAt) {
        existingMeeting.scheduledAt = new Date(payload.meetingUpdate.scheduledAt);
      }
      if (payload.meetingUpdate.locationOrLink !== undefined) {
        existingMeeting.locationOrLink = payload.meetingUpdate.locationOrLink;
      }
      if (payload.meetingUpdate.meetingStatus) {
        existingMeeting.meetingStatus = payload.meetingUpdate.meetingStatus;
      }
      communication.meetingDetails = existingMeeting;
    }

    communication.auditLog.push({
      action: 'message_added',
      performedBy: new Types.ObjectId(user.id),
      timestamp: new Date(),
      details: `Reply added by ${user.role}`,
    });

    await communication.save();

    // Notify the counterparty
    if (user.role === ROLES.PARENT) {
      const teacherDoc = await Teacher.findById(communication.teacher);
      if (teacherDoc?.user) {
        await NotificationService.createEventNotification({
          recipient: teacherDoc.user,
          title: `Parent Reply: ${communication.subjectLine}`,
          message: payload.message.slice(0, 240),
          notificationType: 'parent_communication',
          category: 'academic',
          priority: 'normal',
          relatedEntityType: 'ParentCommunication',
          relatedEntityId: communication._id,
          eventKey: `parent_comm_msg:${msgDoc._id.toString()}:${teacherDoc.user.toString()}`,
        });
      }
    } else {
      const parentDoc = await Parent.findById(communication.parent);
      if (parentDoc?.user) {
        await NotificationService.createEventNotification({
          recipient: parentDoc.user,
          title: `Teacher Reply: ${communication.subjectLine}`,
          message: payload.message.slice(0, 240),
          notificationType: 'parent_communication',
          category: 'academic',
          priority: 'normal',
          relatedEntityType: 'ParentCommunication',
          relatedEntityId: communication._id,
          eventKey: `parent_comm_msg:${msgDoc._id.toString()}:${parentDoc.user.toString()}`,
        });
      }
    }

    return msgDoc.populate('sender', 'firstName lastName email role');
  }

  /**
   * Close a Parent-Teacher communication thread
   */
  public static async closeCommunication(
    communicationId: string,
    reason: string | undefined,
    user: { id: string; role: string }
  ): Promise<IParentCommunication> {
    const communication = await ParentCommunication.findById(communicationId);
    if (!communication) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Communication thread not found');
    }

    await this.verifyThreadAccess(communication, user);

    if (communication.status === 'closed') {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        'Communication thread is already closed'
      );
    }

    const now = new Date();
    communication.status = 'closed';
    communication.closedAt = now;
    communication.closedBy = new Types.ObjectId(user.id);
    communication.auditLog.push({
      action: 'closed',
      performedBy: new Types.ObjectId(user.id),
      timestamp: now,
      details: reason || `Closed by ${user.role}`,
    });

    await communication.save();

    return communication.populate([
      { path: 'parent', select: 'fatherName motherName guardianName relationshipType primaryPhone' },
      { path: 'student', select: 'firstName lastName usn rollNumber semester' },
      { path: 'teacher', select: 'firstName lastName employeeId designation' },
      { path: 'subject', select: 'name code' },
    ]);
  }
}
