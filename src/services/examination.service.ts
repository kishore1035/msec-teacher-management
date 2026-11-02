import { Types } from 'mongoose';
import {
  Examination,
  IExamination,
  ExaminationStatus,
  ExaminationType,
} from '../models/examination.model';
import {
  ExaminationSchedule,
  IExaminationSchedule,
  ScheduleStatus,
} from '../models/examinationSchedule.model';
import { ExaminationResult } from '../models/examinationResult.model';
import { Teacher } from '../models/teacher.model';
import { Student } from '../models/student.model';
import { Section } from '../models/section.model';
import { Subject } from '../models/subject.model';
import { AcademicYear } from '../models/academicYear.model';
import { TeacherAssignment } from '../models/teacherAssignment.model';
import { ApiError } from '../utils/apiError';
import { HTTP_STATUS } from '../constants/statusCodes';
import { ROLES } from '../constants/roles.constant';
import { calculatePagination } from '../utils/pagination';
import { PaginatedResult } from './assignment.service';

export interface CreateExaminationDTO {
  name: string;
  examinationCode: string;
  examinationType: ExaminationType;
  academicYear: string;
  semester: number;
  section?: string;
  subject?: string;
  startDate: Date;
  endDate: Date;
  maximumMarks: number;
  passingMarks: number;
  duration: number;
  instructions?: string;
}

export interface UpdateExaminationDTO {
  name?: string;
  startDate?: Date;
  endDate?: Date;
  maximumMarks?: number;
  passingMarks?: number;
  duration?: number;
  instructions?: string;
  status?: ExaminationStatus;
}

export interface CreateScheduleDTO {
  subject: string;
  section: string;
  examDate: Date;
  startTime: string;
  endTime: string;
  venue: string;
  invigilators?: string[];
  instructions?: string;
}

export interface UpdateScheduleDTO {
  examDate?: Date;
  startTime?: string;
  endTime?: string;
  venue?: string;
  invigilators?: string[];
  instructions?: string;
  status?: ScheduleStatus;
  rescheduleReason?: string;
}

export class ExaminationService {
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
   * Create a new Examination
   */
  public async createExamination(
    userId: string,
    role: string,
    data: CreateExaminationDTO
  ): Promise<IExamination> {
    const academicYear = await AcademicYear.findById(data.academicYear);
    if (!academicYear) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Academic year not found');
    }

    if (data.section) {
      const section = await Section.findById(data.section);
      if (!section) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Section not found');
      if (section.semester !== data.semester) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Section semester does not match exam semester');
      }
    }

    if (data.subject) {
      const subject = await Subject.findById(data.subject);
      if (!subject) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Subject not found');
      if (subject.semester !== data.semester) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Subject semester does not match exam semester');
      }
    }

    // Teacher authorization check
    if (role === ROLES.TEACHER) {
      const teacher = await this.getTeacherForUser(userId);
      if (data.subject && data.section) {
        const assignment = await TeacherAssignment.findOne({
          teacher: teacher._id,
          subject: data.subject,
          section: data.section,
          status: 'Active',
        });
        if (!assignment) {
          throw new ApiError(
            HTTP_STATUS.FORBIDDEN,
            'You are not actively assigned to teach this subject and section'
          );
        }
      }
    }

    // Check duplicate examination code
    const existingCode = await Examination.findOne({
      examinationCode: data.examinationCode.toUpperCase(),
    });
    if (existingCode) {
      throw new ApiError(
        HTTP_STATUS.CONFLICT,
        `Examination with code ${data.examinationCode} already exists`
      );
    }

    const exam = await Examination.create({
      ...data,
      examinationCode: data.examinationCode.toUpperCase(),
      status: 'draft',
      createdBy: new Types.ObjectId(userId),
    });

    return exam;
  }

  /**
   * List examinations with query filters
   */
  public async getExaminations(
    _userId: string,
    _role: string,
    query: {
      page?: number;
      limit?: number;
      academicYear?: string;
      semester?: number;
      section?: string;
      subject?: string;
      examinationType?: string;
      status?: string;
    }
  ): Promise<PaginatedResult<IExamination>> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};
    if (query.academicYear) filter.academicYear = query.academicYear;
    if (query.semester) filter.semester = query.semester;
    if (query.section) filter.section = query.section;
    if (query.subject) filter.subject = query.subject;
    if (query.examinationType) filter.examinationType = query.examinationType;
    if (query.status) filter.status = query.status;

    const [items, total] = await Promise.all([
      Examination.find(filter)
        .populate('academicYear', 'year')
        .populate('subject', 'name code')
        .populate('section', 'sectionName semester')
        .sort({ startDate: -1 })
        .skip(skip)
        .limit(limit),
      Examination.countDocuments(filter),
    ]);

    return {
      items,
      meta: calculatePagination(page, limit, total),
    };
  }

  /**
   * Get single examination by ID
   */
  public async getExaminationById(id: string): Promise<IExamination> {
    const exam = await Examination.findById(id)
      .populate('academicYear', 'year')
      .populate('subject', 'name code')
      .populate('section', 'sectionName semester');

    if (!exam) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Examination not found');
    }
    return exam;
  }

  /**
   * Update examination
   */
  public async updateExamination(
    _userId: string,
    _role: string,
    id: string,
    data: UpdateExaminationDTO
  ): Promise<IExamination> {
    const exam = await Examination.findById(id);
    if (!exam) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Examination not found');
    }

    if (exam.status === 'published' && data.maximumMarks && data.maximumMarks !== exam.maximumMarks) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        'Cannot modify maximum marks of a published examination'
      );
    }

    Object.assign(exam, data);
    await exam.save();
    return exam;
  }

  /**
   * Update examination lifecycle status
   */
  public async updateExaminationStatus(
    _userId: string,
    _role: string,
    id: string,
    status: ExaminationStatus
  ): Promise<IExamination> {
    const exam = await Examination.findById(id);
    if (!exam) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Examination not found');
    }

    exam.status = status;
    await exam.save();
    return exam;
  }

  /**
   * Delete examination with safeguard check
   */
  public async deleteExamination(
    _userId: string,
    _role: string,
    id: string
  ): Promise<void> {
    const exam = await Examination.findById(id);
    if (!exam) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Examination not found');
    }

    const resultsCount = await ExaminationResult.countDocuments({ examination: exam._id });
    if (resultsCount > 0) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        'Cannot delete examination with recorded results. Cancel the examination instead.'
      );
    }

    await ExaminationSchedule.deleteMany({ examination: exam._id });
    await Examination.findByIdAndDelete(id);
  }

  // ==========================================
  // EXAMINATION SCHEDULE
  // ==========================================

  /**
   * Schedule an examination
   */
  public async scheduleExamination(
    _userId: string,
    _role: string,
    examId: string,
    data: CreateScheduleDTO
  ): Promise<IExaminationSchedule> {
    const exam = await Examination.findById(examId);
    if (!exam) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Examination not found');
    }

    const [section, subject] = await Promise.all([
      Section.findById(data.section),
      Subject.findById(data.subject),
    ]);

    if (!section) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Section not found');
    if (!subject) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Subject not found');

    if (section.semester !== exam.semester || subject.semester !== exam.semester) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        'Semester mismatch: Exam, Section, and Subject semesters must match'
      );
    }

    // Overlapping schedule collision check for the same section
    const examDateOnly = new Date(data.examDate);
    const existingConflict = await ExaminationSchedule.findOne({
      section: data.section,
      examDate: examDateOnly,
      startTime: data.startTime,
      status: { $ne: 'cancelled' },
    });

    if (existingConflict) {
      throw new ApiError(
        HTTP_STATUS.CONFLICT,
        `An examination is already scheduled for section ${section.sectionName} on ${data.examDate} at ${data.startTime}`
      );
    }

    const invigilatorObjectIds = (data.invigilators || []).map((id) => new Types.ObjectId(id));

    const schedule = await ExaminationSchedule.create({
      examination: exam._id,
      subject: subject._id,
      section: section._id,
      examDate: examDateOnly,
      startTime: data.startTime,
      endTime: data.endTime,
      venue: data.venue,
      invigilators: invigilatorObjectIds,
      instructions: data.instructions,
      status: 'scheduled',
    });

    // Automatically transition exam status to scheduled if draft
    if (exam.status === 'draft') {
      exam.status = 'scheduled';
      await exam.save();
    }

    return schedule;
  }

  /**
   * Get schedules for an examination
   */
  public async getSchedulesForExam(examId: string): Promise<IExaminationSchedule[]> {
    return ExaminationSchedule.find({ examination: examId })
      .populate('subject', 'name code')
      .populate('section', 'sectionName semester')
      .populate('invigilators', 'firstName lastName employeeId')
      .sort({ examDate: 1, startTime: 1 });
  }

  /**
   * Update examination schedule
   */
  public async updateSchedule(
    _userId: string,
    _role: string,
    scheduleId: string,
    data: UpdateScheduleDTO
  ): Promise<IExaminationSchedule> {
    const schedule = await ExaminationSchedule.findById(scheduleId);
    if (!schedule) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Schedule not found');
    }

    if (data.examDate || data.startTime) {
      const checkDate = data.examDate ? new Date(data.examDate) : schedule.examDate;
      const checkStartTime = data.startTime || schedule.startTime;

      const conflict = await ExaminationSchedule.findOne({
        _id: { $ne: schedule._id },
        section: schedule.section,
        examDate: checkDate,
        startTime: checkStartTime,
        status: { $ne: 'cancelled' },
      });

      if (conflict) {
        throw new ApiError(
          HTTP_STATUS.CONFLICT,
          `Slot collision: An exam is already scheduled at ${checkStartTime}`
        );
      }
    }

    Object.assign(schedule, data);
    if (data.status === 'rescheduled' && !data.rescheduleReason) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Reschedule reason is required');
    }

    await schedule.save();
    return schedule;
  }

  /**
   * Get timetable schedule for authenticated teacher or student
   */
  public async getMySchedule(
    userId: string,
    role: string
  ): Promise<IExaminationSchedule[]> {
    if (role === ROLES.TEACHER) {
      const teacher = await this.getTeacherForUser(userId);
      return ExaminationSchedule.find({
        invigilators: teacher._id,
        status: { $ne: 'cancelled' },
      })
        .populate('examination', 'name examinationType maximumMarks')
        .populate('subject', 'name code')
        .populate('section', 'sectionName semester')
        .sort({ examDate: 1, startTime: 1 });
    } else if (role === ROLES.STUDENT) {
      const student = await Student.findOne({ user: userId });
      if (!student) throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Student profile not found');

      return ExaminationSchedule.find({
        section: student.section,
        status: { $ne: 'cancelled' },
      })
        .populate('examination', 'name examinationType maximumMarks')
        .populate('subject', 'name code')
        .populate('section', 'sectionName semester')
        .sort({ examDate: 1, startTime: 1 });
    }

    return [];
  }
}

export const examinationService = new ExaminationService();
