import { Types } from 'mongoose';
import { AttendancePolicy, IAttendancePolicy } from '../models/attendancePolicy.model';
import { AttendanceSession, IAttendanceSession } from '../models/attendanceSession.model';
import { AttendanceRecord, IAttendanceRecord } from '../models/attendanceRecord.model';
import { Teacher } from '../models/teacher.model';
import { Student } from '../models/student.model';
import { Parent } from '../models/parent.model';
import { Section } from '../models/section.model';
import { Subject } from '../models/subject.model';
import { AcademicYear } from '../models/academicYear.model';
import { TeacherAssignment } from '../models/teacherAssignment.model';
import { AuthenticatedUser } from '../types/auth.types';
import { ROLES } from '../constants/roles.constant';
import { ApiError } from '../utils/apiError';

export interface AttendanceCalculationResult {
  studentId: string;
  usn: string;
  studentName: string;
  totalSessions: number;
  countableSessions: number;
  attendedSessions: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  excusedCount: number;
  percentage: number;
  thresholdApplied: number;
  isShortage: boolean;
  isWarning: boolean;
}

export class AttendanceService {
  // ==========================================
  // ATTENDANCE POLICY
  // ==========================================

  static async createPolicy(
    input: Partial<IAttendancePolicy>,
    user?: AuthenticatedUser
  ): Promise<IAttendancePolicy> {
    const academicYear = await AcademicYear.findById(input.academicYear);
    if (!academicYear) {
      throw ApiError.badRequest('Referenced academic year does not exist');
    }

    // Archive previous active policy for this academic year to preserve calculation history
    await AttendancePolicy.updateMany(
      { academicYear: input.academicYear, status: 'Active' },
      { status: 'Archived' }
    );

    const policy = await AttendancePolicy.create({
      ...input,
      effectiveDate: input.effectiveDate || new Date(),
      createdBy: user ? new Types.ObjectId(user.id) : undefined,
      updatedBy: user ? new Types.ObjectId(user.id) : undefined,
      status: 'Active',
    });

    return policy;
  }

  static async getActivePolicy(academicYearId?: string | Types.ObjectId): Promise<IAttendancePolicy> {
    const filter: Record<string, unknown> = { status: 'Active' };
    if (academicYearId) {
      const idStr = academicYearId instanceof Types.ObjectId ? academicYearId.toString() : String(academicYearId);
      if (Types.ObjectId.isValid(idStr)) {
        filter['academicYear'] = new Types.ObjectId(idStr);
      }
    }

    let policy = await AttendancePolicy.findOne(filter).sort({ effectiveDate: -1 });

    if (!policy) {
      // Default institutional fallback policy if no explicit record exists
      policy = new AttendancePolicy({
        institutionThreshold: 75,
        warningThreshold: 85,
        lateTreatment: 'Present',
        excusedTreatment: 'ExcludeFromTotal',
        effectiveDate: new Date(),
        status: 'Active',
      });
    }

    return policy;
  }

  static async updatePolicy(
    id: string,
    input: Partial<IAttendancePolicy>,
    user?: AuthenticatedUser
  ): Promise<IAttendancePolicy> {
    const policy = await AttendancePolicy.findById(id);
    if (!policy) {
      throw ApiError.notFound('Attendance policy not found');
    }

    Object.assign(policy, input);
    if (user) {
      policy.updatedBy = new Types.ObjectId(user.id);
    }
    await policy.save();

    return policy;
  }

  // ==========================================
  // ATTENDANCE SESSIONS
  // ==========================================

  static async createSession(
    input: {
      academicYear: string;
      section: string;
      subject: string;
      teacher: string;
      date: string;
      semester: number;
      periodNumber: number;
      startTime?: string;
      endTime?: string;
      sessionType?: 'Regular' | 'Lab' | 'Extra' | 'Tutorial';
    },
    user: AuthenticatedUser
  ): Promise<IAttendanceSession> {
    // 1. Verify existence of referenced documents
    const [academicYear, section, subject, teacher] = await Promise.all([
      AcademicYear.findById(input.academicYear),
      Section.findById(input.section),
      Subject.findById(input.subject),
      Teacher.findById(input.teacher),
    ]);

    if (!academicYear || academicYear.status !== 'Active') {
      throw ApiError.badRequest('Academic year does not exist or is inactive');
    }
    if (!section || section.status !== 'Active') {
      throw ApiError.badRequest('Section does not exist or is inactive');
    }
    if (!subject || subject.status !== 'Active') {
      throw ApiError.badRequest('Subject does not exist or is inactive');
    }
    if (!teacher || teacher.status !== 'Active') {
      throw ApiError.badRequest('Teacher does not exist or is inactive');
    }

    // 2. Teacher Authorization: If creator is Teacher, verify ownership and assignment
    if (user.role === ROLES.TEACHER) {
      if (teacher.user.toString() !== user.id) {
        throw ApiError.forbidden('Teachers can only create attendance sessions for their own faculty profile');
      }

      // Check active assignment
      const assignment = await TeacherAssignment.findOne({
        teacher: teacher._id,
        subject: subject._id,
        section: section._id,
        status: 'Active',
      });

      if (!assignment) {
        throw ApiError.forbidden(
          'You are not assigned to teach this subject in the specified section'
        );
      }
    }

    // Normalize date to UTC day start
    const sessionDate = new Date(input.date);
    sessionDate.setUTCHours(0, 0, 0, 0);

    // 3. Prevent duplicate sessions for same section, subject, date, and period
    const duplicate = await AttendanceSession.findOne({
      section: input.section,
      subject: input.subject,
      date: sessionDate,
      periodNumber: input.periodNumber,
    });

    if (duplicate) {
      throw ApiError.conflict(
        `Session already exists for Section, Subject, Date, and Period ${input.periodNumber}`
      );
    }

    const session = await AttendanceSession.create({
      academicYear: new Types.ObjectId(input.academicYear),
      section: new Types.ObjectId(input.section),
      subject: new Types.ObjectId(input.subject),
      teacher: new Types.ObjectId(input.teacher),
      date: sessionDate,
      semester: input.semester,
      periodNumber: input.periodNumber,
      startTime: input.startTime,
      endTime: input.endTime,
      sessionType: input.sessionType || 'Regular',
      status: 'Scheduled',
      createdBy: new Types.ObjectId(user.id),
    });

    return session;
  }

  static async getSessions(
    query: {
      section?: string;
      subject?: string;
      teacher?: string;
      date?: string;
      academicYear?: string;
      status?: string;
    },
    user: AuthenticatedUser
  ): Promise<IAttendanceSession[]> {
    const filter: Record<string, unknown> = {};

    if (query.section) filter['section'] = new Types.ObjectId(query.section);
    if (query.subject) filter['subject'] = new Types.ObjectId(query.subject);
    if (query.academicYear) filter['academicYear'] = new Types.ObjectId(query.academicYear);
    if (query.status) filter['status'] = query.status;

    if (query.date) {
      const d = new Date(query.date);
      d.setUTCHours(0, 0, 0, 0);
      filter['date'] = d;
    }

    if (user.role === ROLES.TEACHER) {
      const teacher = await Teacher.findOne({ user: user.id });
      if (teacher) {
        filter['teacher'] = teacher._id;
      }
    } else if (query.teacher) {
      filter['teacher'] = new Types.ObjectId(query.teacher);
    }

    return AttendanceSession.find(filter)
      .populate('subject', 'name code')
      .populate('teacher', 'firstName lastName employeeId')
      .populate('section', 'sectionName semester')
      .sort({ date: -1, periodNumber: 1 });
  }

  static async getSessionById(id: string): Promise<IAttendanceSession> {
    const session = await AttendanceSession.findById(id)
      .populate('subject', 'name code credits')
      .populate('teacher', 'firstName lastName employeeId designation')
      .populate('section', 'sectionName semester roomNumber')
      .populate('academicYear', 'year semesterType');

    if (!session) {
      throw ApiError.notFound('Attendance session not found');
    }
    return session;
  }

  static async updateSession(
    id: string,
    input: Partial<IAttendanceSession>,
    user: AuthenticatedUser
  ): Promise<IAttendanceSession> {
    const session = await AttendanceSession.findById(id);
    if (!session) {
      throw ApiError.notFound('Attendance session not found');
    }

    if (user.role === ROLES.TEACHER) {
      const teacher = await Teacher.findOne({ user: user.id });
      if (!teacher || session.teacher.toString() !== teacher._id.toString()) {
        throw ApiError.forbidden('You can only update sessions assigned to you');
      }
    }

    Object.assign(session, input);
    await session.save();
    return session;
  }

  static async cancelSession(
    id: string,
    reason: string,
    user: AuthenticatedUser
  ): Promise<IAttendanceSession> {
    const session = await AttendanceSession.findById(id);
    if (!session) {
      throw ApiError.notFound('Attendance session not found');
    }

    if (user.role === ROLES.TEACHER) {
      const teacher = await Teacher.findOne({ user: user.id });
      if (!teacher || session.teacher.toString() !== teacher._id.toString()) {
        throw ApiError.forbidden('You can only cancel sessions assigned to you');
      }
    }

    session.status = 'Cancelled';
    session.cancellationReason = reason;
    await session.save();

    return session;
  }

  // ==========================================
  // ATTENDANCE RECORDS (MARKING & AUDIT)
  // ==========================================

  static async bulkMarkAttendance(
    sessionId: string,
    records: Array<{
      student: string;
      status: 'Present' | 'Absent' | 'Late' | 'Excused';
      remarks?: string;
    }>,
    user: AuthenticatedUser
  ): Promise<{ insertedCount: number; updatedCount: number }> {
    const session = await AttendanceSession.findById(sessionId);
    if (!session) {
      throw ApiError.notFound('Attendance session not found');
    }

    if (session.status === 'Cancelled') {
      throw ApiError.badRequest('Cannot mark attendance for a cancelled session');
    }

    // Role check: Teacher must be assigned to this session
    if (user.role === ROLES.TEACHER) {
      const teacher = await Teacher.findOne({ user: user.id });
      if (!teacher || session.teacher.toString() !== teacher._id.toString()) {
        throw ApiError.forbidden('You cannot mark attendance for a session assigned to another faculty member');
      }
    }

    // Verify all students belong to the session's section
    const studentIds = records.map((r) => new Types.ObjectId(r.student));
    const validStudents = await Student.find({
      _id: { $in: studentIds },
      section: session.section,
      status: 'Active',
    });

    if (validStudents.length !== records.length) {
      throw ApiError.badRequest(
        'One or more students do not belong to the enrolled section or are inactive'
      );
    }

    // Execute bulk upsert operations
    let insertedCount = 0;
    let updatedCount = 0;

    for (const record of records) {
      const existing = await AttendanceRecord.findOne({
        session: session._id,
        student: new Types.ObjectId(record.student),
      });

      if (existing) {
        if (existing.status !== record.status) {
          existing.auditHistory.push({
            modifiedBy: new Types.ObjectId(user.id),
            previousStatus: existing.status,
            newStatus: record.status,
            reason: 'Bulk roll-call update',
            modifiedAt: new Date(),
          });
          existing.status = record.status;
          existing.lastModifiedBy = new Types.ObjectId(user.id);
          existing.correctionReason = 'Bulk roll-call update';
        }
        if (record.remarks) existing.remarks = record.remarks;
        await existing.save();
        updatedCount++;
      } else {
        await AttendanceRecord.create({
          session: session._id,
          student: new Types.ObjectId(record.student),
          status: record.status,
          remarks: record.remarks,
          markedBy: new Types.ObjectId(user.id),
          markedAt: new Date(),
        });
        insertedCount++;
      }
    }

    // Mark session as completed
    session.status = 'Completed';
    await session.save();

    return { insertedCount, updatedCount };
  }

  static async getSessionRecords(sessionId: string): Promise<IAttendanceRecord[]> {
    return AttendanceRecord.find({ session: new Types.ObjectId(sessionId) })
      .populate('student', 'firstName lastName usn rollNumber')
      .populate('markedBy', 'email role')
      .populate('auditHistory.modifiedBy', 'email role')
      .sort({ 'student.rollNumber': 1 });
  }

  static async updateRecord(
    recordId: string,
    input: {
      status: 'Present' | 'Absent' | 'Late' | 'Excused';
      correctionReason: string;
      remarks?: string;
    },
    user: AuthenticatedUser
  ): Promise<IAttendanceRecord> {
    const record = await AttendanceRecord.findById(recordId);
    if (!record) {
      throw ApiError.notFound('Attendance record not found');
    }

    const session = await AttendanceSession.findById(record.session);
    if (!session) {
      throw ApiError.notFound('Associated attendance session not found');
    }

    if (user.role === ROLES.TEACHER) {
      const teacher = await Teacher.findOne({ user: user.id });
      if (!teacher || session.teacher.toString() !== teacher._id.toString()) {
        throw ApiError.forbidden('You can only correct attendance records for sessions assigned to you');
      }
    }

    // Append to audit history
    record.auditHistory.push({
      modifiedBy: new Types.ObjectId(user.id),
      previousStatus: record.status,
      newStatus: input.status,
      reason: input.correctionReason,
      modifiedAt: new Date(),
    });

    record.status = input.status;
    record.correctionReason = input.correctionReason;
    record.lastModifiedBy = new Types.ObjectId(user.id);
    if (input.remarks) record.remarks = input.remarks;

    await record.save();
    return record;
  }

  // ==========================================
  // REPORTS & SHORTAGE DETECTION
  // ==========================================

  static calculateStudentPercentage(
    records: Array<{ status: string }>,
    policy: IAttendancePolicy
  ): {
    totalSessions: number;
    countableSessions: number;
    attendedSessions: number;
    presentCount: number;
    absentCount: number;
    lateCount: number;
    excusedCount: number;
    percentage: number;
  } {
    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;
    let excusedCount = 0;

    for (const r of records) {
      if (r.status === 'Present') presentCount++;
      else if (r.status === 'Absent') absentCount++;
      else if (r.status === 'Late') lateCount++;
      else if (r.status === 'Excused') excusedCount++;
    }

    const totalSessions = records.length;
    let countableSessions = totalSessions;

    // Excused Treatment
    if (policy.excusedTreatment === 'ExcludeFromTotal') {
      countableSessions -= excusedCount;
    }

    // Attended sessions calculation
    let attendedSessions = presentCount;

    if (policy.lateTreatment === 'Present') {
      attendedSessions += lateCount;
    } else if (policy.lateTreatment === 'CountAsHalf') {
      attendedSessions += lateCount * 0.5;
    }

    if (policy.excusedTreatment === 'Present') {
      attendedSessions += excusedCount;
    }

    const percentage =
      countableSessions > 0
        ? parseFloat(((attendedSessions / countableSessions) * 100).toFixed(2))
        : 100;

    return {
      totalSessions,
      countableSessions: Math.max(0, countableSessions),
      attendedSessions,
      presentCount,
      absentCount,
      lateCount,
      excusedCount,
      percentage,
    };
  }

  static async getStudentAttendanceHistory(
    studentId: string,
    query: {
      subjectId?: string;
      startDate?: string;
      endDate?: string;
    },
    user: AuthenticatedUser
  ): Promise<{
    student: unknown;
    summary: ReturnType<typeof AttendanceService.calculateStudentPercentage>;
    records: unknown[];
  }> {
    const student = await Student.findById(studentId).populate('section class department academicYear');
    if (!student) {
      throw ApiError.notFound('Student not found');
    }

    // Access control:
    if (user.role === ROLES.STUDENT && student.user.toString() !== user.id) {
      throw ApiError.forbidden('Students can only view their own attendance records');
    }

    if (user.role === ROLES.PARENT) {
      const parent = await Parent.findOne({ user: user.id });
      if (!parent || !parent.students.some((s) => s.toString() === student._id.toString())) {
        throw ApiError.forbidden('Parents can only view attendance for their linked children');
      }
    }

    const academicYearId = (student.academicYear as unknown as { _id?: Types.ObjectId })?._id || student.academicYear;
    const policy = await this.getActivePolicy(academicYearId as Types.ObjectId);

    const sectionId = (student.section as unknown as { _id?: Types.ObjectId })?._id || student.section;

    // Fetch sessions matching criteria that are NOT cancelled
    const sessionFilter: Record<string, unknown> = {
      section: sectionId,
      status: { $ne: 'Cancelled' },
    };

    if (query.subjectId) sessionFilter['subject'] = new Types.ObjectId(query.subjectId);
    if (query.startDate || query.endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (query.startDate) dateFilter['$gte'] = new Date(query.startDate);
      if (query.endDate) dateFilter['$lte'] = new Date(query.endDate);
      sessionFilter['date'] = dateFilter;
    }

    const validSessions = await AttendanceSession.find(sessionFilter);
    const validSessionIds = validSessions.map((s) => s._id);

    const records = await AttendanceRecord.find({
      student: student._id,
      session: { $in: validSessionIds },
    })
      .populate({
        path: 'session',
        select: 'date periodNumber sessionType status',
        populate: { path: 'subject', select: 'name code' },
      })
      .sort({ createdAt: -1 });

    const summary = this.calculateStudentPercentage(records, policy);

    return { student, summary, records };
  }

  static async getShortageList(query: {
    sectionId?: string;
    subjectId?: string;
    academicYearId?: string;
  }): Promise<AttendanceCalculationResult[]> {
    const policy = await this.getActivePolicy(query.academicYearId);
    const threshold = policy.institutionThreshold;
    const warning = policy.warningThreshold;

    const sessionFilter: Record<string, unknown> = { status: { $ne: 'Cancelled' } };
    if (query.sectionId) sessionFilter['section'] = new Types.ObjectId(query.sectionId);
    if (query.subjectId) sessionFilter['subject'] = new Types.ObjectId(query.subjectId);

    const validSessions = await AttendanceSession.find(sessionFilter);
    const validSessionIds = validSessions.map((s) => s._id);

    // Get all students for the target section
    const studentFilter: Record<string, unknown> = { status: 'Active' };
    if (query.sectionId) studentFilter['section'] = new Types.ObjectId(query.sectionId);

    const students = await Student.find(studentFilter);
    const results: AttendanceCalculationResult[] = [];

    for (const student of students) {
      const records = await AttendanceRecord.find({
        student: student._id,
        session: { $in: validSessionIds },
      });

      const metrics = this.calculateStudentPercentage(records, policy);

      const isShortage = metrics.percentage < threshold;
      const isWarning = metrics.percentage >= threshold && metrics.percentage <= warning;

      results.push({
        studentId: student._id.toString(),
        usn: student.usn,
        studentName: `${student.firstName} ${student.lastName}`,
        thresholdApplied: threshold,
        isShortage,
        isWarning,
        ...metrics,
      });
    }

    // Sort: lowest attendance percentage first
    return results.sort((a, b) => a.percentage - b.percentage);
  }

  static async getAttendanceSummary(query: {
    sectionId?: string;
    subjectId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{
    totalSessions: number;
    completedSessions: number;
    cancelledSessions: number;
    totalRecords: number;
    overallPercentage: number;
  }> {
    const sessionFilter: Record<string, unknown> = {};
    if (query.sectionId) sessionFilter['section'] = new Types.ObjectId(query.sectionId);
    if (query.subjectId) sessionFilter['subject'] = new Types.ObjectId(query.subjectId);
    if (query.startDate || query.endDate) {
      const d: Record<string, unknown> = {};
      if (query.startDate) d['$gte'] = new Date(query.startDate);
      if (query.endDate) d['$lte'] = new Date(query.endDate);
      sessionFilter['date'] = d;
    }

    const sessions = await AttendanceSession.find(sessionFilter);
    const totalSessions = sessions.length;
    const completedSessions = sessions.filter((s) => s.status === 'Completed').length;
    const cancelledSessions = sessions.filter((s) => s.status === 'Cancelled').length;

    const validCompletedIds = sessions.filter((s) => s.status === 'Completed').map((s) => s._id);

    const records = await AttendanceRecord.find({ session: { $in: validCompletedIds } });
    const presentCount = records.filter((r) => r.status === 'Present' || r.status === 'Late').length;
    const totalRecords = records.length;

    const overallPercentage =
      totalRecords > 0 ? parseFloat(((presentCount / totalRecords) * 100).toFixed(2)) : 100;

    return {
      totalSessions,
      completedSessions,
      cancelledSessions,
      totalRecords,
      overallPercentage,
    };
  }
}
