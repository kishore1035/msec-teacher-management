import { Types } from 'mongoose';
import {
  Teacher,
  ITeacher,
  User,
  Department,
  Section,
  TeacherAssignment,
  Timetable,
  TimetableEntry,
  TeacherLeave,
  Substitution,
} from '../models';
import { ApiError } from '../utils/apiError';
import { calculatePagination } from '../utils/pagination';
import { ROLES } from '../constants/roles.constant';
import { TimetableAccessService } from './timetableAccess.service';
import { timeToMinutes } from './timetableConflict.service';

export interface IActorUser {
  id: string;
  role: string;
}

const extractId = (ref: unknown): string => {
  if (!ref) return '';
  if (typeof ref === 'object' && ref !== null && '_id' in ref) {
    return String((ref as { _id: unknown })._id);
  }
  return String(ref);
};

export class TeacherManagementService {
  /**
   * Ensure actor is either an admin or the owner teacher
   */
  static assertTeacherOrAdminAccess(teacher: ITeacher, actor: IActorUser): void {
    const isAdmin = actor.role === ROLES.SUPER_ADMIN || actor.role === ROLES.ADMIN;
    if (!isAdmin && extractId(teacher.user) !== actor.id) {
      throw ApiError.forbidden('You are only authorized to access your own teacher profile and records');
    }
  }

  /**
   * Create a new teacher profile linked to an existing User account
   */
  static async createTeacherProfile(input: {
    user: string;
    employeeId: string;
    firstName: string;
    lastName: string;
    department: string;
    designation: string;
    qualification: string;
    qualifications?: string[];
    specialization?: string[];
    joiningDate?: string | Date;
    employmentCategory?: ITeacher['employmentCategory'];
    phone: string;
    alternatePhone?: string;
    address?: string;
    emergencyContact?: string;
    officeRoom?: string;
    bio?: string;
    profilePhotoUrl?: string;
    maxWeeklyHours?: number;
    isActive?: boolean;
    status?: ITeacher['status'];
  }): Promise<ITeacher> {
    const [userRecord, departmentRecord] = await Promise.all([
      User.findById(input.user),
      Department.findById(input.department),
    ]);

    if (!userRecord) {
      throw ApiError.notFound('Referenced User account not found');
    }

    if (!departmentRecord) {
      throw ApiError.notFound('Department not found');
    }

    const normalizedEmployeeId = input.employeeId.trim().toUpperCase();

    const [existingByUser, existingByEmpId] = await Promise.all([
      Teacher.findOne({ user: input.user }),
      Teacher.findOne({ employeeId: normalizedEmployeeId }),
    ]);

    if (existingByUser) {
      throw ApiError.conflict('A teacher profile is already linked to this user account');
    }

    if (existingByEmpId) {
      throw ApiError.conflict(`Teacher with employee ID ${normalizedEmployeeId} already exists`);
    }

    const qualifications =
      input.qualifications && input.qualifications.length > 0
        ? input.qualifications
        : [input.qualification];

    const status = input.status || (input.isActive === false ? 'Inactive' : 'Active');
    const isActive =
      input.isActive !== undefined
        ? input.isActive
        : status === 'Active' || status === 'On Leave';

    const teacher = await Teacher.create({
      user: new Types.ObjectId(input.user),
      employeeId: normalizedEmployeeId,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      department: new Types.ObjectId(input.department),
      designation: input.designation.trim(),
      qualification: input.qualification.trim(),
      qualifications,
      specialization: input.specialization || [],
      joiningDate: input.joiningDate ? new Date(input.joiningDate) : new Date(),
      employmentCategory: input.employmentCategory || 'regular',
      phone: input.phone.trim(),
      alternatePhone: input.alternatePhone,
      address: input.address,
      emergencyContact: input.emergencyContact,
      officeRoom: input.officeRoom,
      bio: input.bio,
      profilePhotoUrl: input.profilePhotoUrl,
      maxWeeklyHours: input.maxWeeklyHours ?? 24,
      isActive,
      status,
    });

    return (await Teacher.findById(teacher._id)
      .populate('user', 'name email role isActive')
      .populate('department', 'name code')) as ITeacher;
  }

  /**
   * Update teacher profile (Admin can update all fields + activate/deactivate; Teacher can update allowed personal fields)
   */
  static async updateTeacherProfile(
    teacherId: string,
    updates: Partial<{
      employeeId: string;
      firstName: string;
      lastName: string;
      department: string;
      designation: string;
      qualification: string;
      qualifications: string[];
      specialization: string[];
      joiningDate: string | Date;
      employmentCategory: ITeacher['employmentCategory'];
      phone: string;
      alternatePhone: string;
      address: string;
      emergencyContact: string;
      officeRoom: string;
      bio: string;
      profilePhotoUrl: string;
      maxWeeklyHours: number;
      isActive: boolean;
      status: ITeacher['status'];
    }>,
    actor: IActorUser
  ): Promise<ITeacher> {
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      throw ApiError.notFound('Teacher profile not found');
    }

    this.assertTeacherOrAdminAccess(teacher, actor);

    const isAdmin = actor.role === ROLES.SUPER_ADMIN || actor.role === ROLES.ADMIN;

    if (!isAdmin) {
      // Teachers can only update personal/contact/academic bio fields, not HR/administrative fields
      const restrictedFields = [
        'employeeId',
        'department',
        'designation',
        'employmentCategory',
        'joiningDate',
        'maxWeeklyHours',
        'isActive',
        'status',
      ] as const;

      for (const field of restrictedFields) {
        if (updates[field] !== undefined) {
          throw ApiError.forbidden(`Teachers cannot modify administrative field: ${field}`);
        }
      }
    }

    if (updates.employeeId) {
      const normalizedEmpId = updates.employeeId.trim().toUpperCase();
      if (normalizedEmpId !== teacher.employeeId) {
        const duplicate = await Teacher.findOne({
          _id: { $ne: teacher._id },
          employeeId: normalizedEmpId,
        });
        if (duplicate) {
          throw ApiError.conflict(`Teacher with employee ID ${normalizedEmpId} already exists`);
        }
        teacher.employeeId = normalizedEmpId;
      }
    }

    if (updates.department) {
      const dept = await Department.findById(updates.department);
      if (!dept) {
        throw ApiError.notFound('Department not found');
      }
      teacher.department = new Types.ObjectId(updates.department);
    }

    if (updates.firstName !== undefined) teacher.firstName = updates.firstName.trim();
    if (updates.lastName !== undefined) teacher.lastName = updates.lastName.trim();
    if (updates.designation !== undefined) teacher.designation = updates.designation.trim();
    if (updates.qualification !== undefined) teacher.qualification = updates.qualification.trim();
    if (updates.qualifications !== undefined) teacher.qualifications = updates.qualifications;
    if (updates.specialization !== undefined) teacher.specialization = updates.specialization;
    if (updates.joiningDate !== undefined) teacher.joiningDate = new Date(updates.joiningDate);
    if (updates.employmentCategory !== undefined) {
      teacher.employmentCategory = updates.employmentCategory;
    }
    if (updates.phone !== undefined) teacher.phone = updates.phone.trim();
    if (updates.alternatePhone !== undefined) teacher.alternatePhone = updates.alternatePhone;
    if (updates.address !== undefined) teacher.address = updates.address;
    if (updates.emergencyContact !== undefined) teacher.emergencyContact = updates.emergencyContact;
    if (updates.officeRoom !== undefined) teacher.officeRoom = updates.officeRoom;
    if (updates.bio !== undefined) teacher.bio = updates.bio;
    if (updates.profilePhotoUrl !== undefined) teacher.profilePhotoUrl = updates.profilePhotoUrl;
    if (updates.maxWeeklyHours !== undefined) teacher.maxWeeklyHours = updates.maxWeeklyHours;

    // Synchronize activation and employment status
    if (updates.status !== undefined && updates.isActive === undefined) {
      teacher.status = updates.status;
      teacher.isActive = updates.status === 'Active' || updates.status === 'On Leave';
    } else if (updates.isActive !== undefined && updates.status === undefined) {
      teacher.isActive = updates.isActive;
      if (!updates.isActive && teacher.status === 'Active') {
        teacher.status = 'Inactive';
      } else if (updates.isActive && teacher.status === 'Inactive') {
        teacher.status = 'Active';
      }
    } else if (updates.isActive !== undefined && updates.status !== undefined) {
      teacher.isActive = updates.isActive;
      teacher.status = updates.status;
    }

    await teacher.save();

    return (await Teacher.findById(teacher._id)
      .populate('user', 'name email role isActive')
      .populate('department', 'name code')) as ITeacher;
  }

  /**
   * Get authenticated teacher's own profile
   */
  static async getMyProfile(userId: string) {
    const teacher = await Teacher.findOne({ user: userId })
      .populate('user', 'name email role isActive')
      .populate('department', 'name code description');

    if (!teacher) {
      throw ApiError.notFound('Teacher profile not found for current user');
    }

    const [activeAssignmentsCount, classTeacherSectionsCount] = await Promise.all([
      TeacherAssignment.countDocuments({ teacher: teacher._id, status: 'Active' }),
      Section.countDocuments({ classTeacher: teacher._id, status: 'Active' }),
    ]);

    return {
      teacher,
      summary: {
        activeAssignmentsCount,
        classTeacherSectionsCount,
      },
    };
  }

  /**
   * Get teacher profile details by ID
   */
  static async getTeacherById(teacherId: string, actor: IActorUser): Promise<ITeacher> {
    const teacher = await Teacher.findById(teacherId)
      .populate('user', 'name email role isActive')
      .populate('department', 'name code description');

    if (!teacher) {
      throw ApiError.notFound('Teacher profile not found');
    }

    this.assertTeacherOrAdminAccess(teacher, actor);

    return teacher;
  }

  /**
   * Search and filter teacher profiles
   */
  static async listTeachers(query: {
    page?: number;
    limit?: number;
    search?: string;
    department?: string;
    designation?: string;
    specialization?: string;
    employmentCategory?: string;
    status?: string;
    isActive?: boolean;
  }) {
    const filter: Record<string, unknown> = {};

    if (query.department) filter.department = query.department;
    if (query.designation) {
      filter.designation = { $regex: query.designation, $options: 'i' };
    }
    if (query.specialization) {
      filter.specialization = { $elemMatch: { $regex: query.specialization, $options: 'i' } };
    }
    if (query.employmentCategory) filter.employmentCategory = query.employmentCategory;
    if (query.status) filter.status = query.status;
    if (query.isActive !== undefined) filter.isActive = query.isActive;

    if (query.search) {
      const regex = new RegExp(query.search.trim(), 'i');
      filter.$or = [
        { firstName: regex },
        { lastName: regex },
        { employeeId: regex },
        { designation: regex },
        { qualification: regex },
        { specialization: regex },
      ];
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [teachers, total] = await Promise.all([
      Teacher.find(filter)
        .populate('user', 'name email role isActive')
        .populate('department', 'name code')
        .sort({ firstName: 1, lastName: 1 })
        .skip(skip)
        .limit(limit),
      Teacher.countDocuments(filter),
    ]);

    return {
      teachers,
      meta: calculatePagination(page, limit, total),
    };
  }

  /**
   * View teacher's assigned classes, sections, and subjects
   */
  static async getTeacherClassesAndSubjects(
    teacherId: string,
    query: { academicYear?: string; semester?: number },
    actor: IActorUser
  ) {
    const teacher = await Teacher.findById(teacherId).populate('department', 'name code');
    if (!teacher) {
      throw ApiError.notFound('Teacher profile not found');
    }

    this.assertTeacherOrAdminAccess(teacher, actor);

    const assignmentFilter: Record<string, unknown> = {
      teacher: teacher._id,
      status: 'Active',
    };
    if (query.academicYear) assignmentFilter.academicYear = query.academicYear;
    if (query.semester) assignmentFilter.semester = query.semester;

    const sectionFilter: Record<string, unknown> = {
      classTeacher: teacher._id,
      status: 'Active',
    };
    if (query.academicYear) sectionFilter.academicYear = query.academicYear;
    if (query.semester) sectionFilter.semester = query.semester;

    const [assignments, classTeacherSections] = await Promise.all([
      TeacherAssignment.find(assignmentFilter)
        .populate('subject', 'name code type credits semester')
        .populate({
          path: 'section',
          select: 'sectionName semester roomNumber capacity class',
          populate: { path: 'class', select: 'name code degree' },
        })
        .populate('academicYear', 'year isCurrent'),
      Section.find(sectionFilter)
        .populate('class', 'name code degree')
        .populate('academicYear', 'year isCurrent'),
    ]);

    const uniqueSubjectsMap = new Map<string, unknown>();
    const uniqueSectionsMap = new Map<string, unknown>();

    for (const a of assignments) {
      if (a.subject) {
        uniqueSubjectsMap.set(extractId(a.subject), a.subject);
      }
      if (a.section) {
        uniqueSectionsMap.set(extractId(a.section), a.section);
      }
    }

    for (const sec of classTeacherSections) {
      uniqueSectionsMap.set(sec._id.toString(), sec);
    }

    return {
      teacher: {
        _id: teacher._id,
        employeeId: teacher.employeeId,
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        designation: teacher.designation,
        department: teacher.department,
      },
      assignments,
      classTeacherSections,
      subjects: Array.from(uniqueSubjectsMap.values()),
      sections: Array.from(uniqueSectionsMap.values()),
    };
  }

  /**
   * View teacher's timetable
   */
  static async getTeacherTimetable(
    teacherId: string,
    query: { academicYear?: string; semester?: number; date?: string },
    actor: IActorUser
  ) {
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      throw ApiError.notFound('Teacher profile not found');
    }

    this.assertTeacherOrAdminAccess(teacher, actor);

    return await TimetableAccessService.getTeacherSchedule(teacher._id, {
      academicYear: query.academicYear,
      semester: query.semester,
      date: query.date ? new Date(query.date) : undefined,
    });
  }

  /**
   * View teacher's leave history
   */
  static async getTeacherLeaveHistory(
    teacherId: string,
    query: {
      status?: string;
      startDate?: string;
      endDate?: string;
      academicYear?: string;
      page?: number;
      limit?: number;
    },
    actor: IActorUser
  ) {
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      throw ApiError.notFound('Teacher profile not found');
    }

    this.assertTeacherOrAdminAccess(teacher, actor);

    const filter: Record<string, unknown> = { teacher: teacher._id };
    if (query.status) filter.status = query.status;
    if (query.academicYear) filter.academicYear = query.academicYear;
    if (query.startDate || query.endDate) {
      if (query.startDate) filter.endDate = { $gte: new Date(query.startDate) };
      if (query.endDate) filter.startDate = { $lte: new Date(query.endDate) };
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [leaves, total, allTeacherLeaves] = await Promise.all([
      TeacherLeave.find(filter)
        .populate('reviewedBy', 'name email role')
        .populate('approvedBy', 'name email role')
        .sort({ startDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      TeacherLeave.countDocuments(filter),
      TeacherLeave.find({ teacher: teacher._id }).select('leaveType status totalDays startDate endDate'),
    ]);

    let approvedDays = 0;
    let pendingRequests = 0;
    let approvedRequests = 0;
    let rejectedRequests = 0;
    let cancelledRequests = 0;

    for (const l of allTeacherLeaves) {
      const days = l.totalDays || 1;
      if (l.status === 'approved') {
        approvedDays += days;
        approvedRequests += 1;
      } else if (l.status === 'pending') {
        pendingRequests += 1;
      } else if (l.status === 'rejected') {
        rejectedRequests += 1;
      } else if (l.status === 'cancelled') {
        cancelledRequests += 1;
      }
    }

    return {
      teacher: {
        _id: teacher._id,
        employeeId: teacher.employeeId,
        firstName: teacher.firstName,
        lastName: teacher.lastName,
      },
      summary: {
        totalRequests: allTeacherLeaves.length,
        approvedRequests,
        approvedDays,
        pendingRequests,
        rejectedRequests,
        cancelledRequests,
      },
      leaveRequests: leaves,
      meta: calculatePagination(page, limit, total),
    };
  }

  /**
   * View teacher's substitution history (both as substitute and when absent)
   */
  static async getTeacherSubstitutionHistory(
    teacherId: string,
    query: {
      status?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    },
    actor: IActorUser
  ) {
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      throw ApiError.notFound('Teacher profile not found');
    }

    this.assertTeacherOrAdminAccess(teacher, actor);

    const filter: Record<string, unknown> = {
      $or: [{ substituteTeacher: teacher._id }, { absentTeacher: teacher._id }],
    };

    if (query.status) filter.status = query.status;
    if (query.startDate || query.endDate) {
      const dateFilter: Record<string, Date> = {};
      if (query.startDate) dateFilter.$gte = new Date(query.startDate);
      if (query.endDate) dateFilter.$lte = new Date(query.endDate);
      filter.date = dateFilter;
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [substitutions, total, asSubstituteCount, completedAsSubstituteCount, asAbsentCount] =
      await Promise.all([
        Substitution.find(filter)
          .populate('absentTeacher', 'firstName lastName employeeId')
          .populate('substituteTeacher', 'firstName lastName employeeId')
          .populate('subject', 'name code')
          .populate('section', 'sectionName semester')
          .populate('assignedBy', 'name email role')
          .populate('approvedBy', 'name email role')
          .sort({ date: -1, periodNumber: 1 })
          .skip(skip)
          .limit(limit),
        Substitution.countDocuments(filter),
        Substitution.countDocuments({
          substituteTeacher: teacher._id,
          status: { $in: ['approved', 'completed'] },
        }),
        Substitution.countDocuments({
          substituteTeacher: teacher._id,
          status: 'completed',
        }),
        Substitution.countDocuments({
          absentTeacher: teacher._id,
          status: { $in: ['approved', 'completed'] },
        }),
      ]);

    return {
      teacher: {
        _id: teacher._id,
        employeeId: teacher.employeeId,
        firstName: teacher.firstName,
        lastName: teacher.lastName,
      },
      summary: {
        totalSubstitutions: total,
        assignedAsSubstitute: asSubstituteCount,
        completedAsSubstitute: completedAsSubstituteCount,
        coveredWhenAbsent: asAbsentCount,
      },
      substitutions,
      meta: calculatePagination(page, limit, total),
    };
  }

  /**
   * View teacher's workload summary
   */
  static async getTeacherWorkloadSummary(
    teacherId: string,
    query: { academicYear?: string; semester?: number; startDate?: string; endDate?: string },
    actor: IActorUser
  ) {
    const teacher = await Teacher.findById(teacherId).populate('department', 'name code');
    if (!teacher) {
      throw ApiError.notFound('Teacher profile not found');
    }

    this.assertTeacherOrAdminAccess(teacher, actor);

    const timetableFilter: Record<string, unknown> = { status: 'published' };
    if (query.academicYear) timetableFilter.academicYear = query.academicYear;
    if (query.semester) timetableFilter.semester = query.semester;

    const publishedTimetables = await Timetable.find(timetableFilter).select('_id');
    const timetableIds = publishedTimetables.map((t) => t._id);

    const [entries, activeAssignments, classTeacherSections, leaves, substitutions] =
      await Promise.all([
        TimetableEntry.find({
          timetable: { $in: timetableIds },
          $or: [{ teacher: teacher._id }, { additionalTeachers: teacher._id }],
          status: { $ne: 'cancelled' },
          isBreak: false,
        })
          .populate('subject', 'name code')
          .populate('section', 'sectionName semester'),
        TeacherAssignment.find({
          teacher: teacher._id,
          status: 'Active',
          ...(query.academicYear ? { academicYear: query.academicYear } : {}),
          ...(query.semester ? { semester: query.semester } : {}),
        })
          .populate('subject', 'name code')
          .populate('section', 'sectionName semester'),
        Section.find({
          classTeacher: teacher._id,
          status: 'Active',
          ...(query.academicYear ? { academicYear: query.academicYear } : {}),
        }).select('sectionName semester'),
        TeacherLeave.find({
          teacher: teacher._id,
          status: 'approved',
          ...(query.startDate ? { endDate: { $gte: new Date(query.startDate) } } : {}),
          ...(query.endDate ? { startDate: { $lte: new Date(query.endDate) } } : {}),
        }),
        Substitution.find({
          $or: [{ substituteTeacher: teacher._id }, { absentTeacher: teacher._id }],
          status: { $in: ['proposed', 'approved', 'completed'] },
          ...(query.startDate || query.endDate
            ? {
                date: {
                  ...(query.startDate ? { $gte: new Date(query.startDate) } : {}),
                  ...(query.endDate ? { $lte: new Date(query.endDate) } : {}),
                },
              }
            : {}),
        }),
      ]);

    let weeklyMinutes = 0;
    const periodsByDay: Record<string, number> = {
      Monday: 0,
      Tuesday: 0,
      Wednesday: 0,
      Thursday: 0,
      Friday: 0,
      Saturday: 0,
    };

    for (const entry of entries) {
      const duration = timeToMinutes(entry.endTime) - timeToMinutes(entry.startTime);
      if (duration > 0) {
        weeklyMinutes += duration;
      }
      const currentDayCount = periodsByDay[entry.dayOfWeek];
      if (currentDayCount !== undefined) {
        periodsByDay[entry.dayOfWeek] = currentDayCount + 1;
      }
    }

    const weeklyTeachingHours = Number((weeklyMinutes / 60).toFixed(2));
    const maxWeeklyHours = teacher.maxWeeklyHours || 24;
    const utilizationPercentage = Number(
      Math.min(100, (weeklyTeachingHours / maxWeeklyHours) * 100).toFixed(2)
    );

    const uniqueSubjectIds = new Set(activeAssignments.map((a) => extractId(a.subject)));
    const uniqueSectionIds = new Set(activeAssignments.map((a) => extractId(a.section)));

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const completedSubstitutions = substitutions.filter(
      (s) => extractId(s.substituteTeacher) === teacher._id.toString() && s.status === 'completed'
    ).length;

    const upcomingSubstitutions = substitutions.filter(
      (s) =>
        extractId(s.substituteTeacher) === teacher._id.toString() &&
        (s.status === 'approved' || s.status === 'proposed') &&
        new Date(s.date) >= todayStart
    ).length;

    const totalApprovedLeaveDays = leaves.reduce((sum, l) => sum + (l.totalDays || 1), 0);

    return {
      teacher: {
        _id: teacher._id,
        employeeId: teacher.employeeId,
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        designation: teacher.designation,
        department: teacher.department,
        employmentCategory: teacher.employmentCategory || 'regular',
        status: teacher.status,
      },
      workload: {
        weeklyTeachingPeriods: entries.length,
        weeklyTeachingHours,
        maxWeeklyHours,
        utilizationPercentage,
        periodsByDay,
        assignedSubjectsCount: uniqueSubjectIds.size,
        assignedSectionsCount: uniqueSectionIds.size,
        classTeacherSectionsCount: classTeacherSections.length,
        upcomingSubstitutions,
        completedSubstitutions,
        totalApprovedLeaveDays,
      },
    };
  }
}
