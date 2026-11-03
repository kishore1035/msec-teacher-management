import { Types } from 'mongoose';
import {
  Timetable,
  ITimetable,
  TimetableEntry,
  ITimetableEntry,
  AcademicYear,
  Department,
  Class,
  Section,
  Subject,
  Teacher,
} from '../models';
import { ApiError } from '../utils/apiError';
import { calculatePagination } from '../utils/pagination';
import {
  TimetableConflictService,
  IConflictCheckInput,
} from './timetableConflict.service';

export class TimetableService {
  /**
   * Create a new timetable with reference and overlap validation
   */
  static async createTimetable(
    data: {
      name: string;
      academicYear: string | Types.ObjectId;
      semester: number;
      department: string | Types.ObjectId;
      class: string | Types.ObjectId;
      section: string | Types.ObjectId;
      effectiveFrom: Date;
      effectiveTo: Date;
      timetableType?: 'regular' | 'temporary' | 'examination' | 'special';
      status?: 'draft' | 'published' | 'archived';
    },
    userId: string | Types.ObjectId
  ): Promise<ITimetable> {
    // 1. Validate Academic References
    const [academicYear, department, academicClass, section] = await Promise.all([
      AcademicYear.findById(data.academicYear),
      Department.findById(data.department),
      Class.findById(data.class),
      Section.findById(data.section),
    ]);

    if (!academicYear) throw new ApiError(404, 'Academic year not found');
    if (!department) throw new ApiError(404, 'Department not found');
    if (!academicClass) throw new ApiError(404, 'Class not found');
    if (!section) throw new ApiError(404, 'Section not found');

    if (section.class.toString() !== academicClass._id.toString()) {
      throw new ApiError(400, 'Section does not belong to the specified class');
    }

    if (academicClass.department.toString() !== department._id.toString()) {
      throw new ApiError(400, 'Class does not belong to the specified department');
    }

    if (section.semester !== data.semester) {
      throw new ApiError(
        400,
        `Section semester (${section.semester}) does not match timetable semester (${data.semester})`
      );
    }

    // 2. Prevent overlapping published timetables for the same section
    const overlappingTimetable = await Timetable.findOne({
      section: data.section,
      status: 'published',
      effectiveFrom: { $lte: data.effectiveTo },
      effectiveTo: { $gte: data.effectiveFrom },
    });

    if (overlappingTimetable && data.status === 'published') {
      throw new ApiError(
        409,
        `An active published timetable already exists for this section in the specified date range (${overlappingTimetable.name})`
      );
    }

    return await Timetable.create({
      ...data,
      createdBy: userId,
      status: data.status || 'draft',
      version: 1,
    });
  }

  /**
   * Update timetable details
   */
  static async updateTimetable(
    timetableId: string,
    updates: Partial<{
      name: string;
      academicYear: string | Types.ObjectId;
      semester: number;
      department: string | Types.ObjectId;
      class: string | Types.ObjectId;
      section: string | Types.ObjectId;
      effectiveFrom: Date;
      effectiveTo: Date;
      timetableType: 'regular' | 'temporary' | 'examination' | 'special';
      status: 'draft' | 'published' | 'archived';
    }>
  ): Promise<ITimetable> {
    const timetable = await Timetable.findById(timetableId);
    if (!timetable) throw new ApiError(404, 'Timetable not found');

    if (timetable.status === 'archived') {
      throw new ApiError(400, 'Archived timetables cannot be modified');
    }

    // If publishing, verify no conflict with another published timetable
    const newStatus = updates.status || timetable.status;
    const effectiveFrom = updates.effectiveFrom || timetable.effectiveFrom;
    const effectiveTo = updates.effectiveTo || timetable.effectiveTo;
    const section = updates.section || timetable.section;

    if (newStatus === 'published') {
      const conflict = await Timetable.findOne({
        _id: { $ne: timetable._id },
        section,
        status: 'published',
        effectiveFrom: { $lte: effectiveTo },
        effectiveTo: { $gte: effectiveFrom },
      });

      if (conflict) {
        throw new ApiError(
          409,
          `An active published timetable already exists for this section in the date range (${conflict.name})`
        );
      }
    }

    // Bump version if published timetable is being updated
    if (timetable.status === 'published' && Object.keys(updates).length > 0) {
      timetable.version += 1;
    }

    Object.assign(timetable, updates);
    return await timetable.save();
  }

  /**
   * Publish timetable
   */
  static async publishTimetable(
    timetableId: string,
    userId: string | Types.ObjectId
  ): Promise<ITimetable> {
    const timetable = await Timetable.findById(timetableId);
    if (!timetable) throw new ApiError(404, 'Timetable not found');

    if (timetable.status === 'published') {
      throw new ApiError(400, 'Timetable is already published');
    }

    // Check for conflicting active published timetables
    const conflict = await Timetable.findOne({
      _id: { $ne: timetable._id },
      section: timetable.section,
      status: 'published',
      effectiveFrom: { $lte: timetable.effectiveTo },
      effectiveTo: { $gte: timetable.effectiveFrom },
    });

    if (conflict) {
      // Archive conflicting older timetable
      conflict.status = 'archived';
      await conflict.save();
    }

    timetable.status = 'published';
    timetable.publishedBy = new Types.ObjectId(userId.toString());
    timetable.publishedAt = new Date();

    return await timetable.save();
  }

  /**
   * Archive timetable
   */
  static async archiveTimetable(timetableId: string): Promise<ITimetable> {
    const timetable = await Timetable.findById(timetableId);
    if (!timetable) throw new ApiError(404, 'Timetable not found');

    timetable.status = 'archived';
    return await timetable.save();
  }

  /**
   * Delete timetable and cascade delete entries
   */
  static async deleteTimetable(timetableId: string): Promise<void> {
    const timetable = await Timetable.findById(timetableId);
    if (!timetable) throw new ApiError(404, 'Timetable not found');

    await TimetableEntry.deleteMany({ timetable: timetable._id });
    await timetable.deleteOne();
  }

  /**
   * Get single timetable with populated entries
   */
  static async getTimetableById(timetableId: string): Promise<{
    timetable: ITimetable;
    entries: ITimetableEntry[];
  }> {
    const timetable = await Timetable.findById(timetableId)
      .populate('academicYear', 'year isCurrent')
      .populate('department', 'departmentName departmentCode')
      .populate('class', 'className')
      .populate('section', 'sectionName semester')
      .populate('createdBy', 'name email role')
      .populate('publishedBy', 'name email role');

    if (!timetable) throw new ApiError(404, 'Timetable not found');

    const entries = await TimetableEntry.find({
      timetable: timetable._id,
      status: { $ne: 'cancelled' },
    })
      .populate('subject', 'name code')
      .populate('teacher', 'firstName lastName employeeId')
      .populate('additionalTeachers', 'firstName lastName employeeId')
      .sort({ dayOfWeek: 1, periodNumber: 1 });

    return { timetable, entries };
  }

  /**
   * List timetables with filters and pagination
   */
  static async listTimetables(query: {
    page?: number;
    limit?: number;
    academicYear?: string;
    semester?: number;
    department?: string;
    class?: string;
    section?: string;
    status?: string;
    timetableType?: string;
  }) {
    const filter: Record<string, unknown> = {};
    if (query.academicYear) filter.academicYear = query.academicYear;
    if (query.semester) filter.semester = query.semester;
    if (query.department) filter.department = query.department;
    if (query.class) filter.class = query.class;
    if (query.section) filter.section = query.section;
    if (query.status) filter.status = query.status;
    if (query.timetableType) filter.timetableType = query.timetableType;

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [timetables, total] = await Promise.all([
      Timetable.find(filter)
        .populate('academicYear', 'year')
        .populate('department', 'departmentName departmentCode')
        .populate('class', 'className')
        .populate('section', 'sectionName semester')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Timetable.countDocuments(filter),
    ]);

    const pagination = calculatePagination(page, limit, total);

    return {
      timetables,
      meta: pagination,
    };
  }

  /**
   * Create Timetable Entry with conflict detection and audited overrides
   */
  static async createTimetableEntry(
    timetableId: string,
    entryData: {
      dayOfWeek: ITimetableEntry['dayOfWeek'];
      periodNumber: number;
      startTime: string;
      endTime: string;
      subject?: string;
      teacher?: string;
      additionalTeachers?: string[];
      classroom: string;
      lectureType?: ITimetableEntry['lectureType'];
      isBreak?: boolean;
      allowOverride?: boolean;
      overrideReason?: string;
    },
    user: { _id: Types.ObjectId | string; role: string }
  ): Promise<ITimetableEntry> {
    const timetable = await Timetable.findById(timetableId);
    if (!timetable) throw new ApiError(404, 'Timetable not found');

    if (timetable.status === 'archived') {
      throw new ApiError(400, 'Cannot add entries to an archived timetable');
    }

    // Validate subject if provided
    if (entryData.subject) {
      const subject = await Subject.findById(entryData.subject);
      if (!subject) throw new ApiError(404, 'Subject not found');
      if (subject.semester !== timetable.semester) {
        throw new ApiError(
          400,
          `Subject semester (${subject.semester}) does not match timetable semester (${timetable.semester})`
        );
      }
    }

    // Validate teacher if provided
    if (entryData.teacher) {
      const teacher = await Teacher.findById(entryData.teacher);
      if (!teacher) throw new ApiError(404, 'Teacher not found');
    }

    // Check duplicate entry for the same period in this timetable
    const existingPeriodEntry = await TimetableEntry.findOne({
      timetable: timetable._id,
      dayOfWeek: entryData.dayOfWeek,
      periodNumber: entryData.periodNumber,
      status: 'active',
    });

    if (existingPeriodEntry) {
      throw new ApiError(
        409,
        `Period ${entryData.periodNumber} is already scheduled on ${entryData.dayOfWeek} for this timetable`
      );
    }

    // Run Conflict Detection Engine
    const conflictInput: IConflictCheckInput = {
      timetableId: timetable._id,
      section: timetable.section,
      teacher: entryData.teacher,
      additionalTeachers: entryData.additionalTeachers,
      classroom: entryData.classroom,
      dayOfWeek: entryData.dayOfWeek,
      startTime: entryData.startTime,
      endTime: entryData.endTime,
      effectiveFrom: timetable.effectiveFrom,
      effectiveTo: timetable.effectiveTo,
      lectureType: entryData.lectureType,
    };

    const conflictResult = await TimetableConflictService.detectConflicts(conflictInput);

    if (conflictResult.hasConflicts) {
      // Check if override is permitted
      const isAdmin = user.role === 'Super Admin' || user.role === 'Admin';
      if (entryData.allowOverride && entryData.overrideReason && isAdmin) {
        // Record all conflicts in the audit log
        for (const conflict of conflictResult.conflicts) {
          await TimetableConflictService.recordOverride(
            timetable._id,
            conflict.conflictType,
            conflict.description,
            entryData.overrideReason,
            user._id
          );
        }
      } else {
        const errorDetails = conflictResult.conflicts
          .map((c) => `[${c.conflictType}] ${c.description}`)
          .join('; ');
        throw new ApiError(
          409,
          `Timetable conflict detected: ${errorDetails}. Provide allowOverride=true with a valid overrideReason if authorized.`
        );
      }
    }

    return await TimetableEntry.create({
      timetable: timetable._id,
      dayOfWeek: entryData.dayOfWeek,
      periodNumber: entryData.periodNumber,
      startTime: entryData.startTime,
      endTime: entryData.endTime,
      subject: entryData.subject,
      teacher: entryData.teacher,
      additionalTeachers: entryData.additionalTeachers || [],
      section: timetable.section,
      classroom: entryData.classroom,
      lectureType: entryData.lectureType || 'theory',
      academicYear: timetable.academicYear,
      semester: timetable.semester,
      status: 'active',
      isBreak: entryData.isBreak || false,
      createdBy: user._id,
    });
  }

  /**
   * Get all entries for a timetable
   */
  static async getTimetableEntries(timetableId: string) {
    const timetable = await Timetable.findById(timetableId);
    if (!timetable) throw new ApiError(404, 'Timetable not found');

    return await TimetableEntry.find({
      timetable: timetable._id,
      status: { $ne: 'cancelled' },
    })
      .populate('subject', 'name code')
      .populate('teacher', 'firstName lastName employeeId designation')
      .populate('additionalTeachers', 'firstName lastName employeeId')
      .sort({ dayOfWeek: 1, periodNumber: 1 });
  }

  /**
   * Update timetable entry
   */
  static async updateTimetableEntry(
    entryId: string,
    updates: Partial<{
      dayOfWeek: ITimetableEntry['dayOfWeek'];
      periodNumber: number;
      startTime: string;
      endTime: string;
      subject: string;
      teacher: string;
      additionalTeachers: string[];
      classroom: string;
      lectureType: ITimetableEntry['lectureType'];
      isBreak: boolean;
      status: ITimetableEntry['status'];
      allowOverride?: boolean;
      overrideReason?: string;
    }>,
    user: { _id: Types.ObjectId | string; role: string }
  ) {
    const entry = await TimetableEntry.findById(entryId);
    if (!entry) throw new ApiError(404, 'Timetable entry not found');

    const timetable = await Timetable.findById(entry.timetable);
    if (!timetable) throw new ApiError(404, 'Parent timetable not found');

    // Run conflict detection on updated values
    const conflictInput: IConflictCheckInput = {
      timetableId: timetable._id,
      section: entry.section,
      teacher: updates.teacher || entry.teacher,
      additionalTeachers: updates.additionalTeachers || entry.additionalTeachers,
      classroom: updates.classroom || entry.classroom,
      dayOfWeek: updates.dayOfWeek || entry.dayOfWeek,
      startTime: updates.startTime || entry.startTime,
      endTime: updates.endTime || entry.endTime,
      effectiveFrom: timetable.effectiveFrom,
      effectiveTo: timetable.effectiveTo,
      lectureType: updates.lectureType || entry.lectureType,
      excludeEntryId: entry._id,
    };

    const conflictResult = await TimetableConflictService.detectConflicts(conflictInput);

    if (conflictResult.hasConflicts) {
      const isAdmin = user.role === 'Super Admin' || user.role === 'Admin';
      if (updates.allowOverride && updates.overrideReason && isAdmin) {
        for (const conflict of conflictResult.conflicts) {
          await TimetableConflictService.recordOverride(
            timetable._id,
            conflict.conflictType,
            conflict.description,
            updates.overrideReason,
            user._id,
            entry._id
          );
        }
      } else {
        const errorDetails = conflictResult.conflicts
          .map((c) => `[${c.conflictType}] ${c.description}`)
          .join('; ');
        throw new ApiError(409, `Timetable conflict detected: ${errorDetails}`);
      }
    }

    Object.assign(entry, updates);
    return await entry.save();
  }

  /**
   * Delete timetable entry
   */
  static async deleteTimetableEntry(entryId: string) {
    const entry = await TimetableEntry.findById(entryId);
    if (!entry) throw new ApiError(404, 'Timetable entry not found');

    await entry.deleteOne();
  }
}
