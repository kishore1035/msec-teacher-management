import { Types } from 'mongoose';
import {
  Parent,
  IParent,
  ParentRelationshipType,
  RelationshipVerificationStatus,
} from '../models/parent.model';
import { Student, IStudent } from '../models/student.model';
import { User } from '../models/user.model';
import { Assignment } from '../models/assignment.model';
import { AssignmentSubmission } from '../models/assignmentSubmission.model';
import { ExaminationResult } from '../models/examinationResult.model';
import { Announcement } from '../models/announcement.model';
import { AttendanceService } from './attendance.service';
import { StudentProgressService } from './studentProgress.service';
import { TimetableAccessService } from './timetableAccess.service';
import { NotificationService } from './notification.service';
import { AnnouncementPriority } from '../models/announcement.model';
import { NotificationType } from '../models/notification.model';
import { calculatePagination } from '../utils/pagination';
import { ApiError } from '../utils/apiError';
import { HTTP_STATUS } from '../constants/statusCodes';
import { ROLES } from '../constants/roles.constant';

const progressService = new StudentProgressService();

export interface CreateParentInput {
  user?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  fatherName?: string;
  motherName?: string;
  guardianName?: string;
  relationshipType?: ParentRelationshipType;
  primaryPhone: string;
  alternatePhone?: string;
  occupation?: string;
  address?: string;
  verificationStatus?: RelationshipVerificationStatus;
  students?: string[];
}

export class ParentService {
  /**
   * Create a new Parent profile (and optionally a User account if user ID is not supplied)
   */
  public static async createParent(
    input: CreateParentInput,
    actorUserId: string
  ): Promise<IParent> {
    let userId: Types.ObjectId;

    if (input.user) {
      const existingUser = await User.findById(input.user);
      if (!existingUser) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Referenced user account not found');
      }
      const existingParent = await Parent.findOne({ user: existingUser._id });
      if (existingParent) {
        throw new ApiError(
          HTTP_STATUS.CONFLICT,
          'A parent profile already exists for this user account'
        );
      }
      userId = existingUser._id;
    } else {
      if (!input.email) {
        throw new ApiError(
          HTTP_STATUS.BAD_REQUEST,
          'Either an existing user ID or email must be provided to create a parent'
        );
      }
      const duplicateEmail = await User.findOne({ email: input.email.toLowerCase() });
      if (duplicateEmail) {
        throw new ApiError(HTTP_STATUS.CONFLICT, 'Email address is already in use');
      }
      const createdUser = await User.create({
        email: input.email.toLowerCase(),
        password: input.password || 'ParentPass123!',
        role: ROLES.PARENT,
        isActive: true,
      });
      userId = createdUser._id;
    }

    const studentObjectIds: Types.ObjectId[] = [];
    if (input.students && input.students.length > 0) {
      const uniqueIds = Array.from(new Set(input.students));
      const foundStudents = await Student.find({ _id: { $in: uniqueIds } });
      if (foundStudents.length !== uniqueIds.length) {
        throw new ApiError(
          HTTP_STATUS.NOT_FOUND,
          'One or more referenced student records do not exist'
        );
      }
      for (const id of uniqueIds) {
        studentObjectIds.push(new Types.ObjectId(id));
      }
    }

    const relType: ParentRelationshipType = input.relationshipType || 'guardian';
    const verStatus: RelationshipVerificationStatus = input.verificationStatus || 'verified';
    const now = new Date();
    const actorObjId = new Types.ObjectId(actorUserId);

    const parent = await Parent.create({
      user: userId,
      fatherName: input.fatherName,
      motherName: input.motherName,
      guardianName: input.guardianName,
      relationshipType: relType,
      primaryPhone: input.primaryPhone,
      alternatePhone: input.alternatePhone,
      email: input.email,
      occupation: input.occupation,
      address: input.address,
      verificationStatus: verStatus,
      students: studentObjectIds,
      childrenLinks: studentObjectIds.map((sid) => ({
        student: sid,
        relationshipType: relType,
        isPrimaryGuardian: true,
        verificationStatus: verStatus,
        linkedAt: now,
        linkedBy: actorObjId,
      })),
      relationshipHistory: [
        {
          action: 'created',
          relationshipType: relType,
          verificationStatus: verStatus,
          performedBy: actorObjId,
          reason: 'Initial parent profile creation',
          timestamp: now,
        },
        ...studentObjectIds.map((sid) => ({
          action: 'linked' as const,
          student: sid,
          relationshipType: relType,
          verificationStatus: verStatus,
          performedBy: actorObjId,
          reason: 'Linked at parent profile creation',
          timestamp: now,
        })),
      ],
    });

    // Synchronize Student.parent and Student.parents references
    if (studentObjectIds.length > 0) {
      await Student.updateMany(
        { _id: { $in: studentObjectIds } },
        {
          $addToSet: { parents: parent._id },
        }
      );
      await Student.updateMany(
        { _id: { $in: studentObjectIds }, parent: null },
        { $set: { parent: parent._id } }
      );
    }

    return parent.populate([
      { path: 'user', select: 'firstName lastName email role isActive' },
      { path: 'students', select: 'firstName lastName usn rollNumber semester section' },
    ]);
  }

  /**
   * List parents with filters and pagination (Admin only)
   */
  public static async getParents(query: {
    studentId?: string;
    relationshipType?: string;
    verificationStatus?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const filter: Record<string, unknown> = {};

    if (query.studentId) {
      filter.students = new Types.ObjectId(query.studentId);
    }
    if (query.relationshipType) {
      filter.relationshipType = query.relationshipType;
    }
    if (query.verificationStatus) {
      filter.verificationStatus = query.verificationStatus;
    }
    if (query.search) {
      const regex = new RegExp(query.search, 'i');
      filter.$or = [
        { fatherName: regex },
        { motherName: regex },
        { guardianName: regex },
        { primaryPhone: regex },
        { email: regex },
      ];
    }

    const total = await Parent.countDocuments(filter);
    const meta = calculatePagination(query.page, query.limit, total);
    const skip = (meta.page - 1) * meta.limit;

    const items = await Parent.find(filter)
      .populate('user', 'firstName lastName email role isActive')
      .populate('students', 'firstName lastName usn rollNumber semester section')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(meta.limit);

    return { items, meta };
  }

  /**
   * Get single parent by ID
   */
  public static async getParentById(
    parentId: string,
    user: { id: string; role: string }
  ): Promise<IParent> {
    const parent = await Parent.findById(parentId)
      .populate('user', 'firstName lastName email role isActive')
      .populate({
        path: 'students',
        select: 'firstName lastName usn rollNumber semester section class department academicYear',
        populate: [
          { path: 'section', select: 'sectionName semester roomNumber' },
          { path: 'class', select: 'name code' },
          { path: 'department', select: 'name code' },
        ],
      });

    if (!parent) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Parent profile not found');
    }

    if (
      user.role !== ROLES.SUPER_ADMIN &&
      user.role !== ROLES.ADMIN &&
      parent.user._id.toString() !== user.id
    ) {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        'You do not have permission to view this parent profile'
      );
    }

    return parent;
  }

  /**
   * Update parent details and verification status
   */
  public static async updateParent(
    parentId: string,
    updates: {
      fatherName?: string;
      motherName?: string;
      guardianName?: string;
      relationshipType?: ParentRelationshipType;
      primaryPhone?: string;
      alternatePhone?: string;
      email?: string;
      occupation?: string;
      address?: string;
      verificationStatus?: RelationshipVerificationStatus;
      reason?: string;
    },
    actorUserId: string
  ): Promise<IParent> {
    const parent = await Parent.findById(parentId);
    if (!parent) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Parent profile not found');
    }

    const verificationChanged =
      updates.verificationStatus &&
      updates.verificationStatus !== parent.verificationStatus;

    if (updates.fatherName !== undefined) parent.fatherName = updates.fatherName;
    if (updates.motherName !== undefined) parent.motherName = updates.motherName;
    if (updates.guardianName !== undefined) parent.guardianName = updates.guardianName;
    if (updates.relationshipType !== undefined) parent.relationshipType = updates.relationshipType;
    if (updates.primaryPhone !== undefined) parent.primaryPhone = updates.primaryPhone;
    if (updates.alternatePhone !== undefined) parent.alternatePhone = updates.alternatePhone;
    if (updates.email !== undefined) parent.email = updates.email;
    if (updates.occupation !== undefined) parent.occupation = updates.occupation;
    if (updates.address !== undefined) parent.address = updates.address;
    if (updates.verificationStatus !== undefined) {
      parent.verificationStatus = updates.verificationStatus;
    }

    parent.relationshipHistory.push({
      action: verificationChanged ? 'verified' : 'updated',
      relationshipType: parent.relationshipType,
      verificationStatus: parent.verificationStatus,
      performedBy: new Types.ObjectId(actorUserId),
      reason: updates.reason || 'Updated parent profile details',
      timestamp: new Date(),
    });

    await parent.save();
    return this.getParentById(parent._id.toString(), {
      id: actorUserId,
      role: ROLES.ADMIN,
    });
  }

  /**
   * Link a student (child) to a parent account (Admin only)
   * Supports multiple parents per student and multiple children per parent.
   */
  public static async linkChildToParent(
    parentId: string,
    payload: {
      studentId: string;
      relationshipType?: ParentRelationshipType;
      isPrimaryGuardian?: boolean;
      verificationStatus?: RelationshipVerificationStatus;
      reason?: string;
    },
    actorUserId: string
  ): Promise<IParent> {
    const [parent, student] = await Promise.all([
      Parent.findById(parentId),
      Student.findById(payload.studentId),
    ]);

    if (!parent) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Parent profile not found');
    }
    if (!student) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Student profile not found');
    }

    const alreadyLinked = parent.students.some(
      (sid) => sid.toString() === student._id.toString()
    );
    if (alreadyLinked) {
      throw new ApiError(
        HTTP_STATUS.CONFLICT,
        'Student is already linked to this parent account'
      );
    }

    const relType: ParentRelationshipType =
      payload.relationshipType || parent.relationshipType || 'guardian';
    const verStatus: RelationshipVerificationStatus =
      payload.verificationStatus || 'verified';
    const now = new Date();
    const actorObjId = new Types.ObjectId(actorUserId);

    parent.students.push(student._id);
    parent.childrenLinks.push({
      student: student._id,
      relationshipType: relType,
      isPrimaryGuardian: Boolean(payload.isPrimaryGuardian),
      verificationStatus: verStatus,
      linkedAt: now,
      linkedBy: actorObjId,
    });
    parent.relationshipHistory.push({
      action: 'linked',
      student: student._id,
      relationshipType: relType,
      verificationStatus: verStatus,
      performedBy: actorObjId,
      reason: payload.reason || 'Child linked by administrator',
      timestamp: now,
    });

    await parent.save();

    // Update student's parent & parents references
    await Student.updateOne(
      { _id: student._id },
      {
        $addToSet: { parents: parent._id },
        ...(!student.parent ? { $set: { parent: parent._id } } : {}),
      }
    );

    return this.getParentById(parent._id.toString(), {
      id: actorUserId,
      role: ROLES.ADMIN,
    });
  }

  /**
   * Unlink a student (child) from a parent account (Admin only) while preserving relationshipHistory
   */
  public static async unlinkChildFromParent(
    parentId: string,
    studentId: string,
    actorUserId: string
  ): Promise<IParent> {
    const [parent, student] = await Promise.all([
      Parent.findById(parentId),
      Student.findById(studentId),
    ]);

    if (!parent) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Parent profile not found');
    }
    if (!student) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Student profile not found');
    }

    const isLinked = parent.students.some(
      (sid) => sid.toString() === student._id.toString()
    );
    if (!isLinked) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        'Student is not currently linked to this parent account'
      );
    }

    parent.students = parent.students.filter(
      (sid) => sid.toString() !== student._id.toString()
    );
    parent.childrenLinks = parent.childrenLinks.filter(
      (link) => link.student.toString() !== student._id.toString()
    );
    parent.relationshipHistory.push({
      action: 'unlinked',
      student: student._id,
      performedBy: new Types.ObjectId(actorUserId),
      reason: 'Child unlinked by administrator',
      timestamp: new Date(),
    });

    await parent.save();

    // Remove parent from student.parents and update primary student.parent if needed
    await Student.updateOne(
      { _id: student._id },
      { $pull: { parents: parent._id } }
    );

    if (student.parent && student.parent.toString() === parent._id.toString()) {
      const updatedStudent = await Student.findById(student._id);
      const nextPrimaryParent =
        updatedStudent?.parents && updatedStudent.parents.length > 0
          ? updatedStudent.parents[0]
          : null;
      await Student.updateOne(
        { _id: student._id },
        { $set: { parent: nextPrimaryParent } }
      );
    }

    return this.getParentById(parent._id.toString(), {
      id: actorUserId,
      role: ROLES.ADMIN,
    });
  }

  /**
   * Verify that the requesting Parent user is legitimately linked to the target student
   */
  public static async verifyParentChildAccess(
    parentUserId: string,
    studentId: string
  ): Promise<{ parent: IParent; student: IStudent }> {
    const parent = await Parent.findOne({ user: parentUserId });
    if (!parent) {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Parent profile not found');
    }

    if (parent.verificationStatus === 'rejected') {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        'Parent account relationship verification has been rejected'
      );
    }

    const isLinked = parent.students.some((sid) => sid.toString() === studentId);
    if (!isLinked) {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        'You are only authorized to access academic records for your linked children'
      );
    }

    const specificLink = parent.childrenLinks.find(
      (l) => l.student.toString() === studentId
    );
    if (specificLink && specificLink.verificationStatus === 'rejected') {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        'Guardian relationship verification for this student is rejected'
      );
    }

    const student = await Student.findById(studentId)
      .populate('department', 'name code')
      .populate('class', 'name code')
      .populate({
        path: 'section',
        select: 'sectionName semester roomNumber classTeacher',
        populate: {
          path: 'classTeacher',
          select: 'firstName lastName employeeId designation phone officeRoom',
        },
      })
      .populate('academicYear', 'name isCurrent');

    if (!student) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Linked student not found');
    }

    return { parent, student };
  }

  /**
   * Module 5: Get all linked children for the logged-in parent
   */
  public static async getMyChildren(parentUserId: string) {
    const parent = await Parent.findOne({ user: parentUserId }).populate({
      path: 'students',
      select:
        'firstName lastName usn rollNumber gender semester status department class section academicYear',
      populate: [
        { path: 'department', select: 'name code' },
        { path: 'class', select: 'name code' },
        { path: 'section', select: 'sectionName semester roomNumber' },
        { path: 'academicYear', select: 'name isCurrent' },
      ],
    });

    if (!parent) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Parent profile not found');
    }

    return {
      parentId: parent._id,
      relationshipType: parent.relationshipType,
      verificationStatus: parent.verificationStatus,
      children: parent.students,
      childrenLinks: parent.childrenLinks,
    };
  }

  /**
   * Module 5: Get child profile + published announcements relevant to the child
   */
  public static async getChildProfile(parentUserId: string, studentId: string) {
    const { student } = await this.verifyParentChildAccess(parentUserId, studentId);

    const sectionId =
      (student.section as unknown as { _id?: Types.ObjectId })?._id || student.section;
    const classId =
      (student.class as unknown as { _id?: Types.ObjectId })?._id || student.class;
    const deptId =
      (student.department as unknown as { _id?: Types.ObjectId })?._id || student.department;

    const now = new Date();
    const publishedAnnouncements = await Announcement.find({
      status: 'published',
      $and: [
        {
          $or: [
            { expiresAt: { $exists: false } },
            { expiresAt: null },
            { expiresAt: { $gt: now } },
          ],
        },
        {
          $or: [
            { targetAudience: { $in: ['all', 'parents', 'students'] } },
            { targetSections: sectionId },
            { targetClasses: classId },
            { targetDepartments: deptId },
            { resolvedRecipientsSnapshot: new Types.ObjectId(parentUserId) },
          ],
        },
      ],
    })
      .select('title summary content announcementType priority publishedAt createdAt')
      .sort({ publishedAt: -1 })
      .limit(10);

    return {
      student: {
        _id: student._id,
        usn: student.usn,
        rollNumber: student.rollNumber,
        firstName: student.firstName,
        lastName: student.lastName,
        gender: student.gender,
        semester: student.semester,
        status: student.status,
        department: student.department,
        class: student.class,
        section: student.section,
        academicYear: student.academicYear,
      },
      recentAnnouncements: publishedAnnouncements,
    };
  }

  /**
   * Module 5: Get child attendance summary, shortage warnings, and session records
   */
  public static async getChildAttendance(
    parentUserId: string,
    studentId: string,
    query: { subjectId?: string; startDate?: string; endDate?: string } = {}
  ) {
    const { student } = await this.verifyParentChildAccess(parentUserId, studentId);

    const history = await AttendanceService.getStudentAttendanceHistory(
      student._id.toString(),
      query,
      {
        id: parentUserId,
        email: '',
        role: ROLES.PARENT,
        isActive: true,
        sessionId: 'parent-portal',
      }
    );

    const academicYearId =
      (student.academicYear as unknown as { _id?: Types.ObjectId })?._id ||
      student.academicYear;
    const policy = await AttendanceService.getActivePolicy(academicYearId);

    const isShortage = history.summary.percentage < policy.institutionThreshold;
    const isWarning =
      history.summary.percentage >= policy.institutionThreshold &&
      history.summary.percentage <= policy.warningThreshold;

    return {
      student: {
        _id: student._id,
        usn: student.usn,
        firstName: student.firstName,
        lastName: student.lastName,
      },
      summary: {
        ...history.summary,
        institutionThreshold: policy.institutionThreshold,
        warningThreshold: policy.warningThreshold,
        isShortage,
        isWarning,
        shortageWarningMessage: isShortage
          ? `Attendance (${history.summary.percentage}%) is below the mandatory ${policy.institutionThreshold}% requirement.`
          : isWarning
          ? `Attendance (${history.summary.percentage}%) is within the warning zone (${policy.institutionThreshold}% - ${policy.warningThreshold}%).`
          : null,
      },
      records: history.records,
    };
  }

  /**
   * Module 5: Get child assignment status, deadlines, and missing/submitted breakdown
   */
  public static async getChildAssignments(
    parentUserId: string,
    studentId: string,
    query: { subjectId?: string; status?: string } = {}
  ) {
    const { student } = await this.verifyParentChildAccess(parentUserId, studentId);

    const sectionId =
      (student.section as unknown as { _id?: Types.ObjectId })?._id || student.section;

    const assignmentFilter: Record<string, unknown> = {
      section: sectionId,
      status: { $in: ['published', 'closed'] }, // Draft assignments strictly hidden
    };
    if (query.subjectId) {
      assignmentFilter.subject = new Types.ObjectId(query.subjectId);
    }

    const assignments = await Assignment.find(assignmentFilter)
      .populate('subject', 'name code')
      .populate('teacher', 'firstName lastName')
      .sort({ dueDate: 1 });

    const assignmentIds = assignments.map((a) => a._id);
    const submissions = await AssignmentSubmission.find({
      assignment: { $in: assignmentIds },
      student: student._id,
    });

    const submissionMap = new Map(
      submissions.map((sub) => [sub.assignment.toString(), sub])
    );

    const now = new Date();
    const items = assignments.map((assignment) => {
      const sub = submissionMap.get(assignment._id.toString());
      const isPastDue = new Date(assignment.dueDate) < now;
      const submissionStatus = sub
        ? sub.submissionStatus
        : isPastDue
        ? 'missing'
        : 'pending';

      return {
        assignmentId: assignment._id,
        title: assignment.title,
        description: assignment.description,
        subject: assignment.subject,
        dueDate: assignment.dueDate,
        totalMarks: assignment.totalMarks,
        maximumMarks: assignment.totalMarks,
        assignmentStatus: assignment.status,
        submissionStatus,
        isMissing: !sub && isPastDue,
        isLate: sub?.isLate || false,
        submittedAt: sub?.submittedAt || null,
        marksObtained: sub?.marksObtained ?? null,
        feedback: sub?.feedback || null,
      };
    });

    const filteredItems = query.status
      ? items.filter((i) => i.submissionStatus === query.status)
      : items;

    return {
      student: {
        _id: student._id,
        usn: student.usn,
        firstName: student.firstName,
        lastName: student.lastName,
      },
      summary: {
        totalAssignments: items.length,
        submittedCount: items.filter(
          (i) => i.submissionStatus === 'submitted' || i.submissionStatus === 'evaluated'
        ).length,
        pendingCount: items.filter((i) => i.submissionStatus === 'pending').length,
        missingCount: items.filter((i) => i.isMissing).length,
      },
      assignments: filteredItems,
    };
  }

  /**
   * Module 5: Get child published examination results and internal assessment performance
   * Unpublished / draft examination results are strictly excluded.
   */
  public static async getChildResults(parentUserId: string, studentId: string) {
    const { student } = await this.verifyParentChildAccess(parentUserId, studentId);

    // Explicitly query ONLY published examination results
    const publishedResults = await ExaminationResult.find({
      student: student._id,
      evaluationStatus: 'published',
    })
      .populate('examination', 'name examinationType maximumMarks passingMarks semester')
      .populate('subject', 'name code credits')
      .sort({ createdAt: -1 });

    // Compute internal assessment summary exclusively from published IA results
    const iaResults = publishedResults.filter((r) => {
      const examObj = r.examination as unknown as { examinationType?: string };
      return examObj && ['IA1', 'IA2', 'IA3'].includes(examObj.examinationType || '');
    });

    return {
      student: {
        _id: student._id,
        usn: student.usn,
        firstName: student.firstName,
        lastName: student.lastName,
        semester: student.semester,
      },
      publishedResults,
      internalAssessments: iaResults,
    };
  }

  /**
   * Module 5: Get child academic progress, subject-wise progress, and performance report
   */
  public static async getChildProgress(
    parentUserId: string,
    studentId: string,
    query: { academicYearId?: string; semester?: number } = {}
  ) {
    const { student } = await this.verifyParentChildAccess(parentUserId, studentId);

    const [overallProgress, subjectWiseProgress] = await Promise.all([
      progressService.calculateStudentProgress(student._id.toString(), {
        academicYearId: query.academicYearId,
        semester: query.semester,
      }),
      progressService.getStudentSubjectWiseProgress(
        student._id.toString(),
        { id: parentUserId, role: ROLES.PARENT },
        {
          academicYear: query.academicYearId,
          semester: query.semester,
        }
      ),
    ]);

    return {
      student: {
        _id: student._id,
        usn: student.usn,
        firstName: student.firstName,
        lastName: student.lastName,
        semester: student.semester,
      },
      overallProgress,
      subjectWiseProgress,
    };
  }

  /**
   * Module 5: Get child's published section timetable
   */
  public static async getChildTimetable(
    parentUserId: string,
    studentId: string,
    query: { dayOfWeek?: string; date?: string } = {}
  ) {
    const { student } = await this.verifyParentChildAccess(parentUserId, studentId);

    const sectionId =
      (student.section as unknown as { _id?: Types.ObjectId })?._id || student.section;

    const schedule = await TimetableAccessService.getSectionSchedule(sectionId, {
      includeDraft: false, // Never expose draft timetables to parents
      dayOfWeek: query.dayOfWeek as any,
      date: query.date ? new Date(query.date) : undefined,
    });

    return {
      student: {
        _id: student._id,
        usn: student.usn,
        firstName: student.firstName,
        lastName: student.lastName,
        semester: student.semester,
      },
      ...schedule,
    };
  }

  /**
   * Module 7: Notify all verified linked parents of a specific student without leaking other students' data
   */
  public static async notifyParentsOfStudent(params: {
    studentId: string | Types.ObjectId;
    title: string;
    message: string;
    notificationType: NotificationType;
    category?: string;
    priority?: AnnouncementPriority;
    relatedEntityType?: string;
    relatedEntityId?: string | Types.ObjectId;
    eventKeySuffix: string;
    isMandatory?: boolean;
  }): Promise<{ notifiedParentsCount: number }> {
    const studentObjId = new Types.ObjectId(params.studentId.toString());
    const parents = await Parent.find({
      students: studentObjId,
      verificationStatus: { $ne: 'rejected' },
    }).select('user childrenLinks');

    let notifiedParentsCount = 0;

    for (const parent of parents) {
      const link = parent.childrenLinks.find(
        (l) => l.student.toString() === studentObjId.toString()
      );
      if (link && link.verificationStatus === 'rejected') {
        continue;
      }

      if (parent.user) {
        const res = await NotificationService.createEventNotification({
          recipient: parent.user,
          title: params.title,
          message: params.message,
          notificationType: params.notificationType,
          category: params.category || 'academic',
          priority: params.priority || 'normal',
          relatedEntityType: params.relatedEntityType || 'Student',
          relatedEntityId: params.relatedEntityId || studentObjId,
          eventKey: `parent_notif:${parent.user.toString()}:${studentObjId.toString()}:${params.eventKeySuffix}`,
          isMandatory: params.isMandatory,
        });
        if (res.created) notifiedParentsCount += 1;
      }
    }

    return { notifiedParentsCount };
  }
}
