import { Types } from 'mongoose';
import {
  User,
  Teacher,
  Student,
  Parent,
  Department,
  Class,
  Section,
  Subject,
  TeacherAssignment,
  TargetAudience,
  IAnnouncement,
} from '../models';
import { ROLES, UserRole } from '../constants/roles.constant';
import { ApiError } from '../utils/apiError';
import { HTTP_STATUS } from '../constants/statusCodes';

export interface AudienceTargetingInput {
  targetAudience: TargetAudience;
  targetRoles?: string[];
  targetDepartments?: (string | Types.ObjectId)[];
  targetClasses?: (string | Types.ObjectId)[];
  targetSections?: (string | Types.ObjectId)[];
  targetSubjects?: (string | Types.ObjectId)[];
  specificRecipients?: (string | Types.ObjectId)[];
}

export class AudienceTargetingService {
  /**
   * Validate that all referenced target IDs exist in the database
   */
  public static async validateTargetReferences(input: AudienceTargetingInput): Promise<void> {
    const toObjectIds = (ids?: (string | Types.ObjectId)[]) =>
      (ids || []).map((id) => new Types.ObjectId(id.toString()));

    const deptIds = toObjectIds(input.targetDepartments);
    const classIds = toObjectIds(input.targetClasses);
    const sectionIds = toObjectIds(input.targetSections);
    const subjectIds = toObjectIds(input.targetSubjects);
    const recipientIds = toObjectIds(input.specificRecipients);

    if (deptIds.length > 0) {
      const count = await Department.countDocuments({ _id: { $in: deptIds } });
      if (count !== new Set(deptIds.map((d) => d.toString())).size) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'One or more targetDepartments do not exist');
      }
    }

    if (classIds.length > 0) {
      const count = await Class.countDocuments({ _id: { $in: classIds } });
      if (count !== new Set(classIds.map((c) => c.toString())).size) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'One or more targetClasses do not exist');
      }
    }

    if (sectionIds.length > 0) {
      const count = await Section.countDocuments({ _id: { $in: sectionIds } });
      if (count !== new Set(sectionIds.map((s) => s.toString())).size) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'One or more targetSections do not exist');
      }
    }

    if (subjectIds.length > 0) {
      const count = await Subject.countDocuments({ _id: { $in: subjectIds } });
      if (count !== new Set(subjectIds.map((s) => s.toString())).size) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'One or more targetSubjects do not exist');
      }
    }

    if (recipientIds.length > 0) {
      const count = await User.countDocuments({ _id: { $in: recipientIds } });
      if (count !== new Set(recipientIds.map((r) => r.toString())).size) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'One or more specificRecipients do not exist');
      }
    }
  }

  /**
   * Enforce Teacher Targeting Restrictions:
   * Teachers can only publish announcements for classes, sections, and subjects assigned to them.
   */
  public static async validateTeacherAuthorization(
    teacherUserId: string,
    input: AudienceTargetingInput
  ): Promise<void> {
    const teacher = await Teacher.findOne({ user: teacherUserId });
    if (!teacher) {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Teacher profile not found for this user');
    }

    // Teachers cannot broadcast to entire institution, all administrators, or all teachers
    if (
      input.targetAudience === 'all' ||
      input.targetAudience === 'administrators' ||
      input.targetAudience === 'teachers'
    ) {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        'Teachers are not authorized to publish institution-wide, administrator, or staff-wide announcements'
      );
    }

    if (input.targetDepartments && input.targetDepartments.length > 0) {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        'Teachers cannot target entire departments; please target authorized sections, classes, or subjects'
      );
    }

    // Fetch active assignments and class-teacher sections for this teacher
    const [assignments, classTeacherSections] = await Promise.all([
      TeacherAssignment.find({ teacher: teacher._id, status: 'Active' }).lean(),
      Section.find({ classTeacher: teacher._id, status: 'Active' }).lean(),
    ]);

    const authorizedSectionIds = new Set<string>([
      ...assignments.map((a) => a.section.toString()),
      ...classTeacherSections.map((s) => s._id.toString()),
    ]);

    const authorizedSubjectIds = new Set<string>(
      assignments.map((a) => a.subject.toString())
    );

    // Fetch class IDs corresponding to the teacher's authorized sections
    const authorizedSectionsDocs = await Section.find({
      _id: { $in: Array.from(authorizedSectionIds).map((id) => new Types.ObjectId(id)) },
    })
      .select('class')
      .lean();

    const authorizedClassIds = new Set<string>(
      authorizedSectionsDocs.map((s) => s.class.toString())
    );

    const hasSections = (input.targetSections?.length ?? 0) > 0;
    const hasClasses = (input.targetClasses?.length ?? 0) > 0;
    const hasSubjects = (input.targetSubjects?.length ?? 0) > 0;
    const hasSpecific = (input.specificRecipients?.length ?? 0) > 0;

    if (!hasSections && !hasClasses && !hasSubjects && !hasSpecific) {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        'Teachers must specify at least one authorized section, class, subject, or student/parent recipient'
      );
    }

    for (const secId of input.targetSections || []) {
      if (!authorizedSectionIds.has(secId.toString())) {
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          `Teacher is not authorized to target section ${secId.toString()}`
        );
      }
    }

    for (const clsId of input.targetClasses || []) {
      if (!authorizedClassIds.has(clsId.toString())) {
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          `Teacher is not authorized to target class ${clsId.toString()}`
        );
      }
    }

    for (const subId of input.targetSubjects || []) {
      if (!authorizedSubjectIds.has(subId.toString())) {
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          `Teacher is not authorized to target subject ${subId.toString()}`
        );
      }
    }

    if (hasSpecific) {
      // Specific recipients targeted by a teacher must belong to the teacher's authorized sections (students or their parents)
      const allowedStudents = await Student.find({
        section: {
          $in: Array.from(authorizedSectionIds).map((id) => new Types.ObjectId(id)),
        },
        status: 'Active',
      })
        .select('_id user parent')
        .lean();

      const allowedUserIds = new Set<string>(allowedStudents.map((s) => s.user.toString()));
      const studentObjIds = allowedStudents.map((s) => s._id);

      const allowedParents = await Parent.find({
        $or: [
          { students: { $in: studentObjIds } },
          {
            _id: {
              $in: allowedStudents
                .map((s) => s.parent)
                .filter((p): p is Types.ObjectId => Boolean(p)),
            },
          },
        ],
      })
        .select('user')
        .lean();

      for (const p of allowedParents) {
        allowedUserIds.add(p.user.toString());
      }

      for (const recId of input.specificRecipients || []) {
        if (!allowedUserIds.has(recId.toString())) {
          throw new ApiError(
            HTTP_STATUS.FORBIDDEN,
            `Teacher is not authorized to target specific recipient ${recId.toString()}`
          );
        }
      }
    }
  }

  /**
   * Resolve deduplicated recipient User ObjectIds for an announcement or targeting configuration.
   * Ensures parents only receive announcements for their linked children.
   * Respects teacher scope if creator is a teacher.
   */
  public static async resolveRecipients(
    input: AudienceTargetingInput,
    creatorUserId?: string,
    creatorRole?: UserRole | string
  ): Promise<Types.ObjectId[]> {
    const recipientUserIds = new Set<string>();

    const toObjectIds = (ids?: (string | Types.ObjectId)[]) =>
      (ids || []).map((id) => new Types.ObjectId(id.toString()));

    const deptIds = toObjectIds(input.targetDepartments);
    const classIds = toObjectIds(input.targetClasses);
    let sectionIds = toObjectIds(input.targetSections);
    const subjectIds = toObjectIds(input.targetSubjects);
    const specificIds = toObjectIds(input.specificRecipients);

    // If creator is a teacher and targeted subjects without explicit sections, scope to the teacher's assigned sections for those subjects
    let teacherDocId: Types.ObjectId | null = null;
    if (creatorRole === ROLES.TEACHER && creatorUserId) {
      const teacher = await Teacher.findOne({ user: creatorUserId }).select('_id').lean();
      if (teacher) {
        teacherDocId = teacher._id;
      }
    }

    // Helper: Resolve sections linked to targetSubjects
    const resolveSubjectSections = async (): Promise<Types.ObjectId[]> => {
      if (subjectIds.length === 0) return [];
      const assignmentQuery: Record<string, unknown> = {
        subject: { $in: subjectIds },
        status: 'Active',
      };
      if (teacherDocId) {
        assignmentQuery.teacher = teacherDocId;
      }
      const assignments = await TeacherAssignment.find(assignmentQuery)
        .select('section')
        .lean();

      if (assignments.length > 0) {
        return assignments.map((a) => a.section);
      }

      // Fallback: match sections by subject's department and semester
      const subjects = await Subject.find({ _id: { $in: subjectIds } })
        .select('department semester')
        .lean();
      if (subjects.length === 0) return [];

      const deptList = subjects.map((s) => s.department);
      const semList = subjects.map((s) => s.semester);
      const classes = await Class.find({ department: { $in: deptList } })
        .select('_id')
        .lean();
      const matchingSections = await Section.find({
        class: { $in: classes.map((c) => c._id) },
        semester: { $in: semList },
        status: 'Active',
      })
        .select('_id')
        .lean();
      return matchingSections.map((s) => s._id);
    };

    // Helper: Resolve active Student documents matching academic filters
    const resolveMatchingStudents = async () => {
      const hasAcademicFilters =
        deptIds.length > 0 ||
        classIds.length > 0 ||
        sectionIds.length > 0 ||
        subjectIds.length > 0;

      if (!hasAcademicFilters) {
        return Student.find({ status: 'Active' }).select('_id user parent').lean();
      }

      const orConditions: Record<string, unknown>[] = [];
      if (deptIds.length > 0) {
        orConditions.push({ department: { $in: deptIds } });
      }
      if (classIds.length > 0) {
        orConditions.push({ class: { $in: classIds } });
      }
      if (sectionIds.length > 0) {
        orConditions.push({ section: { $in: sectionIds } });
      }
      if (subjectIds.length > 0) {
        const subSectionIds = await resolveSubjectSections();
        if (subSectionIds.length > 0) {
          // If both sectionIds and subjectIds were provided by a teacher, intersect or union appropriately
          if (sectionIds.length > 0) {
            const secSet = new Set(sectionIds.map((id) => id.toString()));
            const filtered = subSectionIds.filter((id) => secSet.has(id.toString()));
            orConditions.push({
              section: { $in: filtered.length > 0 ? filtered : subSectionIds },
            });
          } else {
            orConditions.push({ section: { $in: subSectionIds } });
          }
        }
      }

      if (orConditions.length === 0) {
        return [];
      }

      return Student.find({
        status: 'Active',
        $or: orConditions,
      })
        .select('_id user parent')
        .lean();
    };

    // Helper: Resolve active Parent User IDs linked to a given list of Student docs
    const resolveParentsForStudents = async (
      students: Array<{ _id: Types.ObjectId; user: Types.ObjectId; parent?: Types.ObjectId }>
    ): Promise<string[]> => {
      if (students.length === 0) return [];
      const studentObjIds = students.map((s) => s._id);
      const parentDocIds = students
        .map((s) => s.parent)
        .filter((p): p is Types.ObjectId => Boolean(p));

      const parents = await Parent.find({
        $or: [
          { students: { $in: studentObjIds } },
          ...(parentDocIds.length > 0 ? [{ _id: { $in: parentDocIds } }] : []),
        ],
      })
        .select('user')
        .lean();

      if (parents.length === 0) return [];
      const activeUsers = await User.find({
        _id: { $in: parents.map((p) => p.user) },
        isActive: true,
      })
        .select('_id')
        .lean();

      return activeUsers.map((u) => u._id.toString());
    };

    // 1. Target Audience = 'all'
    if (input.targetAudience === 'all') {
      const users = await User.find({ isActive: true }).select('_id').lean();
      for (const u of users) {
        recipientUserIds.add(u._id.toString());
      }
    }

    // 2. Target Audience = 'administrators'
    else if (input.targetAudience === 'administrators') {
      const admins = await User.find({
        role: { $in: [ROLES.ADMIN, ROLES.SUPER_ADMIN] },
        isActive: true,
      })
        .select('_id')
        .lean();
      for (const a of admins) {
        recipientUserIds.add(a._id.toString());
      }
    }

    // 3. Target Audience = 'teachers'
    else if (input.targetAudience === 'teachers') {
      const hasFilters =
        deptIds.length > 0 || sectionIds.length > 0 || subjectIds.length > 0;
      if (!hasFilters) {
        const teachers = await Teacher.find({ status: 'Active' }).select('user').lean();
        const activeTeacherUsers = await User.find({
          _id: { $in: teachers.map((t) => t.user) },
          isActive: true,
        })
          .select('_id')
          .lean();
        for (const u of activeTeacherUsers) {
          recipientUserIds.add(u._id.toString());
        }
      } else {
        const teacherDocIdSet = new Set<string>();
        if (deptIds.length > 0) {
          const deptTeachers = await Teacher.find({
            department: { $in: deptIds },
            status: 'Active',
          })
            .select('_id')
            .lean();
          deptTeachers.forEach((t) => teacherDocIdSet.add(t._id.toString()));
        }
        if (sectionIds.length > 0 || subjectIds.length > 0) {
          const assignQuery: Record<string, unknown> = { status: 'Active' };
          if (sectionIds.length > 0) assignQuery.section = { $in: sectionIds };
          if (subjectIds.length > 0) assignQuery.subject = { $in: subjectIds };
          const assigns = await TeacherAssignment.find(assignQuery).select('teacher').lean();
          assigns.forEach((a) => teacherDocIdSet.add(a.teacher.toString()));
        }
        const teachers = await Teacher.find({
          _id: { $in: Array.from(teacherDocIdSet).map((id) => new Types.ObjectId(id)) },
        })
          .select('user')
          .lean();
        const activeUsers = await User.find({
          _id: { $in: teachers.map((t) => t.user) },
          isActive: true,
        })
          .select('_id')
          .lean();
        activeUsers.forEach((u) => recipientUserIds.add(u._id.toString()));
      }
    }

    // 4. Target Audience = 'students'
    else if (input.targetAudience === 'students') {
      const students = await resolveMatchingStudents();
      if (students.length > 0) {
        const activeUsers = await User.find({
          _id: { $in: students.map((s) => s.user) },
          isActive: true,
        })
          .select('_id')
          .lean();
        activeUsers.forEach((u) => recipientUserIds.add(u._id.toString()));
      }
    }

    // 5. Target Audience = 'parents'
    else if (input.targetAudience === 'parents') {
      const students = await resolveMatchingStudents();
      const parentUserIds = await resolveParentsForStudents(students);
      parentUserIds.forEach((id) => recipientUserIds.add(id));
    }

    // 6. Target Audience = 'selected'
    else if (input.targetAudience === 'selected') {
      const roles = (input.targetRoles || []).map((r) => r.toUpperCase());
      const includeStudents =
        roles.length === 0 || roles.includes(ROLES.STUDENT) || roles.includes('STUDENTS');
      const includeParents =
        roles.includes(ROLES.PARENT) || roles.includes('PARENTS');
      const includeTeachers =
        roles.includes(ROLES.TEACHER) || roles.includes('TEACHERS');
      const includeAdmins =
        roles.includes(ROLES.ADMIN) ||
        roles.includes(ROLES.SUPER_ADMIN) ||
        roles.includes('ADMINISTRATORS');

      const hasAcademicFilters =
        deptIds.length > 0 ||
        classIds.length > 0 ||
        sectionIds.length > 0 ||
        subjectIds.length > 0;

      if (hasAcademicFilters) {
        const matchingStudents = await resolveMatchingStudents();

        if (includeStudents && matchingStudents.length > 0) {
          const activeStudentUsers = await User.find({
            _id: { $in: matchingStudents.map((s) => s.user) },
            isActive: true,
          })
            .select('_id')
            .lean();
          activeStudentUsers.forEach((u) => recipientUserIds.add(u._id.toString()));
        }

        if (includeParents && matchingStudents.length > 0) {
          const parentIds = await resolveParentsForStudents(matchingStudents);
          parentIds.forEach((id) => recipientUserIds.add(id));
        }

        if (includeTeachers) {
          const teacherIds = await this.resolveRecipients(
            {
              targetAudience: 'teachers',
              targetDepartments: deptIds,
              targetSections: sectionIds,
              targetSubjects: subjectIds,
            },
            creatorUserId,
            creatorRole
          );
          teacherIds.forEach((id) => recipientUserIds.add(id.toString()));
        }
      } else {
        // Role-only filters under 'selected'
        if (roles.length > 0) {
          if (includeStudents) {
            const students = await resolveMatchingStudents();
            const activeUsers = await User.find({
              _id: { $in: students.map((s) => s.user) },
              isActive: true,
            })
              .select('_id')
              .lean();
            activeUsers.forEach((u) => recipientUserIds.add(u._id.toString()));
          }
          if (includeParents) {
            const students = await resolveMatchingStudents();
            const parentIds = await resolveParentsForStudents(students);
            parentIds.forEach((id) => recipientUserIds.add(id));
          }
          if (includeTeachers) {
            const teachers = await Teacher.find({ status: 'Active' }).select('user').lean();
            const activeUsers = await User.find({
              _id: { $in: teachers.map((t) => t.user) },
              isActive: true,
            })
              .select('_id')
              .lean();
            activeUsers.forEach((u) => recipientUserIds.add(u._id.toString()));
          }
          if (includeAdmins) {
            const admins = await User.find({
              role: { $in: [ROLES.ADMIN, ROLES.SUPER_ADMIN] },
              isActive: true,
            })
              .select('_id')
              .lean();
            admins.forEach((a) => recipientUserIds.add(a._id.toString()));
          }
        }
      }
    }

    // Always include active specificRecipients if provided
    if (specificIds.length > 0) {
      const activeSpecific = await User.find({
        _id: { $in: specificIds },
        isActive: true,
      })
        .select('_id')
        .lean();
      activeSpecific.forEach((u) => recipientUserIds.add(u._id.toString()));
    }

    return Array.from(recipientUserIds).map((id) => new Types.ObjectId(id));
  }

  /**
   * Check whether a specific user is in the resolved audience for a published announcement.
   * Uses the immutable `resolvedRecipientsSnapshot` captured at publication time so
   * students changing sections later do not retroactively see or lose historical announcements.
   * Also allows parents to view announcements targeted to their linked children.
   */
  public static async isUserInAnnouncementAudience(
    announcement: IAnnouncement & { resolvedRecipientsSnapshot?: Types.ObjectId[] },
    userId: string,
    userRole: string
  ): Promise<boolean> {
    if (userRole === ROLES.ADMIN || userRole === ROLES.SUPER_ADMIN) {
      return true;
    }

    if (announcement.createdBy.toString() === userId) {
      return true;
    }

    // Draft, scheduled, or archived/expired announcements are not visible to regular recipients
    if (announcement.status !== 'published') {
      return false;
    }

    if (announcement.expiresAt && new Date(announcement.expiresAt) <= new Date()) {
      return false;
    }

    const snapshot = announcement.resolvedRecipientsSnapshot || [];
    const snapshotSet = new Set(snapshot.map((id) => id.toString()));

    if (snapshotSet.has(userId)) {
      return true;
    }

    // Parents can also view announcements addressed to their linked children
    if (userRole === ROLES.PARENT) {
      const parent = await Parent.findOne({ user: userId }).select('_id students').lean();
      if (!parent) return false;

      const linkedStudents = await Student.find({
        $or: [
          { _id: { $in: parent.students || [] } },
          { parent: parent._id },
        ],
      })
        .select('user')
        .lean();

      for (const st of linkedStudents) {
        if (snapshotSet.has(st.user.toString())) {
          return true;
        }
      }
    }

    return false;
  }
}
