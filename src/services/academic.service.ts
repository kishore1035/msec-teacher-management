import { Types } from 'mongoose';
import { AcademicYear, IAcademicYear } from '../models/academicYear.model';
import { Department, IDepartment } from '../models/department.model';
import { Class, IClass } from '../models/class.model';
import { Section, ISection } from '../models/section.model';
import { Subject, ISubject } from '../models/subject.model';
import { TeacherAssignment, ITeacherAssignment } from '../models/teacherAssignment.model';
import { Teacher } from '../models/teacher.model';
import { ApiError } from '../utils/apiError';

export class AcademicService {
  // ==========================================
  // ACADEMIC YEARS
  // ==========================================

  static async createAcademicYear(
    input: Partial<IAcademicYear>,
    userId?: string
  ): Promise<IAcademicYear> {
    if (new Date(input.startDate!) >= new Date(input.endDate!)) {
      throw ApiError.badRequest('End date must be strictly after start date');
    }

    const existing = await AcademicYear.findOne({ year: input.year });
    if (existing) {
      throw ApiError.conflict(`Academic year ${input.year} already exists`);
    }

    if (input.isCurrent) {
      await AcademicYear.updateMany({}, { isCurrent: false });
    }

    const academicYear = await AcademicYear.create({
      ...input,
      createdBy: userId ? new Types.ObjectId(userId) : undefined,
    });

    return academicYear;
  }

  static async getAcademicYears(query: { status?: string }): Promise<IAcademicYear[]> {
    const filter = query.status ? { status: query.status } : {};
    return AcademicYear.find(filter).sort({ startDate: -1 });
  }

  static async getCurrentAcademicYear(): Promise<IAcademicYear> {
    const current = await AcademicYear.findOne({ isCurrent: true, status: 'Active' });
    if (!current) {
      throw ApiError.notFound('No active academic year marked as current');
    }
    return current;
  }

  static async getAcademicYearById(id: string): Promise<IAcademicYear> {
    const year = await AcademicYear.findById(id);
    if (!year) {
      throw ApiError.notFound('Academic year not found');
    }
    return year;
  }

  static async updateAcademicYear(
    id: string,
    input: Partial<IAcademicYear>
  ): Promise<IAcademicYear> {
    const year = await AcademicYear.findById(id);
    if (!year) {
      throw ApiError.notFound('Academic year not found');
    }

    const start = input.startDate ? new Date(input.startDate) : year.startDate;
    const end = input.endDate ? new Date(input.endDate) : year.endDate;

    if (start >= end) {
      throw ApiError.badRequest('End date must be strictly after start date');
    }

    Object.assign(year, input);
    await year.save();
    return year;
  }

  static async setCurrentAcademicYear(id: string): Promise<IAcademicYear> {
    const target = await AcademicYear.findById(id);
    if (!target) {
      throw ApiError.notFound('Academic year not found');
    }

    if (target.status !== 'Active') {
      throw ApiError.badRequest('Cannot mark an archived academic year as current');
    }

    await AcademicYear.updateMany({ _id: { $ne: target._id } }, { isCurrent: false });
    target.isCurrent = true;
    await target.save();

    return target;
  }

  // ==========================================
  // DEPARTMENTS
  // ==========================================

  static async createDepartment(input: Partial<IDepartment>): Promise<IDepartment> {
    const existing = await Department.findOne({
      $or: [{ code: input.code?.toUpperCase() }, { name: input.name }],
    });

    if (existing) {
      throw ApiError.conflict('Department with the given name or code already exists');
    }

    if (input.hod) {
      const teacher = await Teacher.findById(input.hod);
      if (!teacher) {
        throw ApiError.badRequest('Referenced HOD teacher does not exist');
      }
    }

    const department = await Department.create({
      ...input,
      code: input.code?.toUpperCase(),
    });

    return department;
  }

  static async getDepartments(query: { status?: string }): Promise<IDepartment[]> {
    const filter = query.status ? { status: query.status } : {};
    return Department.find(filter).populate('hod', 'firstName lastName employeeId designation').sort({ name: 1 });
  }

  static async getDepartmentById(id: string): Promise<IDepartment> {
    const dept = await Department.findById(id).populate('hod', 'firstName lastName employeeId designation');
    if (!dept) {
      throw ApiError.notFound('Department not found');
    }
    return dept;
  }

  static async updateDepartment(id: string, input: Partial<IDepartment>): Promise<IDepartment> {
    const dept = await Department.findById(id);
    if (!dept) {
      throw ApiError.notFound('Department not found');
    }

    if (input.code && input.code.toUpperCase() !== dept.code) {
      const duplicate = await Department.findOne({ code: input.code.toUpperCase() });
      if (duplicate) {
        throw ApiError.conflict(`Department code ${input.code} is already in use`);
      }
      dept.code = input.code.toUpperCase();
    }

    if (input.hod) {
      const teacher = await Teacher.findById(input.hod);
      if (!teacher) {
        throw ApiError.badRequest('Referenced HOD teacher does not exist');
      }
    }

    Object.assign(dept, input);
    await dept.save();
    return dept;
  }

  // ==========================================
  // CLASSES
  // ==========================================

  static async createClass(input: {
    name: string;
    code: string;
    department: string;
    degree?: 'B.E.' | 'M.Tech' | 'MCA' | 'Other';
    durationYears?: number;
  }): Promise<IClass> {
    const dept = await Department.findById(input.department);
    if (!dept || dept.status !== 'Active') {
      throw ApiError.badRequest('Department does not exist or is inactive');
    }

    const existing = await Class.findOne({ code: input.code.toUpperCase() });
    if (existing) {
      throw ApiError.conflict(`Class with code ${input.code} already exists`);
    }

    const newClass = await Class.create({
      ...input,
      code: input.code.toUpperCase(),
      department: new Types.ObjectId(input.department),
    });

    return newClass;
  }

  static async getClasses(query: { department?: string; status?: string }): Promise<IClass[]> {
    const filter: Record<string, unknown> = {};
    if (query.department) filter['department'] = query.department;
    if (query.status) filter['status'] = query.status;

    return Class.find(filter).populate('department', 'name code').sort({ name: 1 });
  }

  static async getClassById(id: string): Promise<IClass> {
    const cls = await Class.findById(id).populate('department', 'name code');
    if (!cls) {
      throw ApiError.notFound('Class not found');
    }
    return cls;
  }

  static async updateClass(id: string, input: Partial<IClass>): Promise<IClass> {
    const cls = await Class.findById(id);
    if (!cls) {
      throw ApiError.notFound('Class not found');
    }

    if (input.department) {
      const dept = await Department.findById(input.department);
      if (!dept || dept.status !== 'Active') {
        throw ApiError.badRequest('Department does not exist or is inactive');
      }
    }

    Object.assign(cls, input);
    await cls.save();
    return cls;
  }

  // ==========================================
  // SECTIONS
  // ==========================================

  static async createSection(input: {
    class: string;
    academicYear: string;
    semester: number;
    sectionName: string;
    classTeacher?: string | null;
    roomNumber?: string;
    capacity?: number;
  }): Promise<ISection> {
    const [targetClass, academicYear] = await Promise.all([
      Class.findById(input.class),
      AcademicYear.findById(input.academicYear),
    ]);

    if (!targetClass || targetClass.status !== 'Active') {
      throw ApiError.badRequest('Class does not exist or is inactive');
    }
    if (!academicYear || academicYear.status !== 'Active') {
      throw ApiError.badRequest('Academic year does not exist or is inactive');
    }

    if (input.classTeacher) {
      const teacher = await Teacher.findById(input.classTeacher);
      if (!teacher || teacher.status !== 'Active') {
        throw ApiError.badRequest('Class teacher does not exist or is not active');
      }
    }

    const duplicate = await Section.findOne({
      class: input.class,
      academicYear: input.academicYear,
      semester: input.semester,
      sectionName: input.sectionName.toUpperCase(),
    });

    if (duplicate) {
      throw ApiError.conflict(
        `Section ${input.sectionName.toUpperCase()} for semester ${input.semester} already exists in this academic year`
      );
    }

    const section = await Section.create({
      ...input,
      sectionName: input.sectionName.toUpperCase(),
      class: new Types.ObjectId(input.class),
      academicYear: new Types.ObjectId(input.academicYear),
      classTeacher: input.classTeacher ? new Types.ObjectId(input.classTeacher) : undefined,
    });

    return section;
  }

  static async getSections(query: {
    class?: string;
    academicYear?: string;
    semester?: number;
  }): Promise<ISection[]> {
    const filter: Record<string, unknown> = {};
    if (query.class) filter['class'] = query.class;
    if (query.academicYear) filter['academicYear'] = query.academicYear;
    if (query.semester) filter['semester'] = query.semester;

    return Section.find(filter)
      .populate('class', 'name code degree')
      .populate('academicYear', 'year semesterType')
      .populate('classTeacher', 'firstName lastName employeeId')
      .sort({ semester: 1, sectionName: 1 });
  }

  static async getSectionById(id: string): Promise<ISection> {
    const section = await Section.findById(id)
      .populate('class', 'name code degree')
      .populate('academicYear', 'year semesterType')
      .populate('classTeacher', 'firstName lastName employeeId');

    if (!section) {
      throw ApiError.notFound('Section not found');
    }
    return section;
  }

  static async updateSection(id: string, input: Partial<ISection>): Promise<ISection> {
    const section = await Section.findById(id);
    if (!section) {
      throw ApiError.notFound('Section not found');
    }

    if (input.classTeacher) {
      const teacher = await Teacher.findById(input.classTeacher);
      if (!teacher || teacher.status !== 'Active') {
        throw ApiError.badRequest('Class teacher does not exist or is not active');
      }
    }

    Object.assign(section, input);
    await section.save();
    return section;
  }

  // ==========================================
  // SUBJECTS
  // ==========================================

  static async createSubject(input: {
    name: string;
    code: string;
    department: string;
    semester: number;
    credits: number;
    subjectType?: 'Theory' | 'Practical' | 'Elective' | 'Project';
    description?: string;
    modules?: Array<{ moduleNumber: number; title: string; topics: string[]; description?: string }>;
  }): Promise<ISubject> {
    const dept = await Department.findById(input.department);
    if (!dept || dept.status !== 'Active') {
      throw ApiError.badRequest('Department does not exist or is inactive');
    }

    const existing = await Subject.findOne({ code: input.code.toUpperCase() });
    if (existing) {
      throw ApiError.conflict(`Subject with code ${input.code} already exists`);
    }

    const subject = await Subject.create({
      ...input,
      code: input.code.toUpperCase(),
      department: new Types.ObjectId(input.department),
    });

    return subject;
  }

  static async getSubjects(query: {
    department?: string;
    semester?: number;
    subjectType?: string;
  }): Promise<ISubject[]> {
    const filter: Record<string, unknown> = {};
    if (query.department) filter['department'] = query.department;
    if (query.semester) filter['semester'] = query.semester;
    if (query.subjectType) filter['subjectType'] = query.subjectType;

    return Subject.find(filter).populate('department', 'name code').sort({ semester: 1, code: 1 });
  }

  static async getSubjectById(id: string): Promise<ISubject> {
    const subject = await Subject.findById(id).populate('department', 'name code');
    if (!subject) {
      throw ApiError.notFound('Subject not found');
    }
    return subject;
  }

  static async updateSubject(id: string, input: Partial<ISubject>): Promise<ISubject> {
    const subject = await Subject.findById(id);
    if (!subject) {
      throw ApiError.notFound('Subject not found');
    }

    if (input.code && input.code.toUpperCase() !== subject.code) {
      const duplicate = await Subject.findOne({ code: input.code.toUpperCase() });
      if (duplicate) {
        throw ApiError.conflict(`Subject code ${input.code} already exists`);
      }
      subject.code = input.code.toUpperCase();
    }

    Object.assign(subject, input);
    await subject.save();
    return subject;
  }

  // ==========================================
  // TEACHER ASSIGNMENTS
  // ==========================================

  static async createTeacherAssignment(
    input: {
      teacher: string;
      subject: string;
      section: string;
      academicYear: string;
      semester: number;
      isPrimary?: boolean;
    },
    userId?: string
  ): Promise<ITeacherAssignment> {
    const [teacher, subject, section, academicYear] = await Promise.all([
      Teacher.findById(input.teacher),
      Subject.findById(input.subject),
      Section.findById(input.section),
      AcademicYear.findById(input.academicYear),
    ]);

    if (!teacher || teacher.status !== 'Active') {
      throw ApiError.badRequest('Teacher does not exist or is inactive');
    }
    if (!subject || subject.status !== 'Active') {
      throw ApiError.badRequest('Subject does not exist or is inactive');
    }
    if (!section || section.status !== 'Active') {
      throw ApiError.badRequest('Section does not exist or is inactive');
    }
    if (!academicYear || academicYear.status !== 'Active') {
      throw ApiError.badRequest('Academic year does not exist or is inactive');
    }

    // Validation: Subject semester must match Section semester
    if (subject.semester !== section.semester) {
      throw ApiError.badRequest(
        `Semester mismatch: Subject is for semester ${subject.semester}, but Section is for semester ${section.semester}`
      );
    }

    // Check duplicate active assignment
    const duplicate = await TeacherAssignment.findOne({
      teacher: input.teacher,
      subject: input.subject,
      section: input.section,
      academicYear: input.academicYear,
      status: 'Active',
    });

    if (duplicate) {
      throw ApiError.conflict('Active assignment already exists for this teacher, subject, and section');
    }

    const assignment = await TeacherAssignment.create({
      teacher: new Types.ObjectId(input.teacher),
      subject: new Types.ObjectId(input.subject),
      section: new Types.ObjectId(input.section),
      academicYear: new Types.ObjectId(input.academicYear),
      semester: input.semester,
      isPrimary: input.isPrimary ?? true,
      assignedBy: userId ? new Types.ObjectId(userId) : undefined,
      status: 'Active',
    });

    return assignment;
  }

  static async getTeacherAssignments(query: {
    teacher?: string;
    section?: string;
    subject?: string;
    academicYear?: string;
    status?: string;
  }): Promise<ITeacherAssignment[]> {
    const filter: Record<string, unknown> = {};
    if (query.teacher) filter['teacher'] = query.teacher;
    if (query.section) filter['section'] = query.section;
    if (query.subject) filter['subject'] = query.subject;
    if (query.academicYear) filter['academicYear'] = query.academicYear;
    if (query.status) filter['status'] = query.status;

    return TeacherAssignment.find(filter)
      .populate('teacher', 'firstName lastName employeeId designation')
      .populate('subject', 'name code credits semester')
      .populate({
        path: 'section',
        select: 'sectionName semester roomNumber',
        populate: { path: 'class', select: 'name code' },
      })
      .populate('academicYear', 'year isCurrent')
      .sort({ createdAt: -1 });
  }

  static async getTeacherAssignmentById(id: string): Promise<ITeacherAssignment> {
    const assignment = await TeacherAssignment.findById(id)
      .populate('teacher', 'firstName lastName employeeId designation')
      .populate('subject', 'name code credits semester')
      .populate({
        path: 'section',
        select: 'sectionName semester roomNumber',
        populate: { path: 'class', select: 'name code' },
      })
      .populate('academicYear', 'year isCurrent');

    if (!assignment) {
      throw ApiError.notFound('Teacher assignment not found');
    }
    return assignment;
  }

  static async updateTeacherAssignment(
    id: string,
    input: Partial<ITeacherAssignment>
  ): Promise<ITeacherAssignment> {
    const assignment = await TeacherAssignment.findById(id);
    if (!assignment) {
      throw ApiError.notFound('Teacher assignment not found');
    }

    Object.assign(assignment, input);
    await assignment.save();
    return assignment;
  }

  static async deleteTeacherAssignment(id: string): Promise<void> {
    const assignment = await TeacherAssignment.findById(id);
    if (!assignment) {
      throw ApiError.notFound('Teacher assignment not found');
    }

    // Soft delete to preserve historical records
    assignment.status = 'Inactive';
    await assignment.save();
  }

  // ==========================================
  // TEACHER-SPECIFIC ME OPERATIONS
  // ==========================================

  static async getTeacherByUserId(userId: string): Promise<Types.ObjectId> {
    const teacher = await Teacher.findOne({ user: userId });
    if (!teacher) {
      throw ApiError.notFound('Teacher profile not linked to this user account');
    }
    return teacher._id;
  }

  static async getMyAssignments(userId: string): Promise<ITeacherAssignment[]> {
    const teacherId = await this.getTeacherByUserId(userId);
    return TeacherAssignment.find({ teacher: teacherId, status: 'Active' })
      .populate('subject', 'name code credits semester subjectType')
      .populate({
        path: 'section',
        select: 'sectionName semester roomNumber capacity',
        populate: { path: 'class', select: 'name code degree' },
      })
      .populate('academicYear', 'year isCurrent');
  }

  static async getMyClasses(userId: string): Promise<unknown[]> {
    const teacherId = await this.getTeacherByUserId(userId);
    const assignments = await TeacherAssignment.find({ teacher: teacherId, status: 'Active' })
      .populate({
        path: 'section',
        select: 'sectionName semester roomNumber capacity',
        populate: { path: 'class', select: 'name code degree' },
      });

    // Extract unique sections
    const sectionMap = new Map<string, unknown>();
    for (const a of assignments) {
      if (a.section) {
        sectionMap.set(a.section._id.toString(), a.section);
      }
    }
    return Array.from(sectionMap.values());
  }

  static async getMySubjects(userId: string): Promise<unknown[]> {
    const teacherId = await this.getTeacherByUserId(userId);
    const assignments = await TeacherAssignment.find({ teacher: teacherId, status: 'Active' })
      .populate('subject', 'name code credits semester subjectType');

    // Extract unique subjects
    const subjectMap = new Map<string, unknown>();
    for (const a of assignments) {
      if (a.subject) {
        subjectMap.set(a.subject._id.toString(), a.subject);
      }
    }
    return Array.from(subjectMap.values());
  }
}
