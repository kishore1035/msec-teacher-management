import { Types } from 'mongoose';
import { Teacher } from '../models/teacher.model';
import { Student } from '../models/student.model';
import { Parent } from '../models/parent.model';
import { Department } from '../models/department.model';
import { ClassModel } from '../models/class.model';
import { Section } from '../models/section.model';
import { TeacherAssignment } from '../models/teacherAssignment.model';
import { AttendanceSession } from '../models/attendanceSession.model';
import { AttendanceRecord } from '../models/attendanceRecord.model';
import { AttendancePolicy } from '../models/attendancePolicy.model';
import { Assignment } from '../models/assignment.model';
import { AssignmentSubmission } from '../models/assignmentSubmission.model';
import { ExaminationSchedule } from '../models/examinationSchedule.model';
import { ExaminationResult } from '../models/examinationResult.model';
import { StudentProgress } from '../models/studentProgress.model';
import { StudyMaterial } from '../models/studyMaterial.model';
import { Timetable } from '../models/timetable.model';
import { TimetableEntry } from '../models/timetableEntry.model';
import { TimetableChange } from '../models/timetableChange.model';
import { Announcement } from '../models/announcement.model';
import { Notification } from '../models/notification.model';
import { Doubt } from '../models/doubt.model';
import { ParentCommunication } from '../models/parentCommunication.model';
import { TeacherLeave } from '../models/teacherLeave.model';
import { Substitution } from '../models/substitution.model';
import { AIAssistantService } from './aiAssistant.service';
import { ApiError } from '../utils/apiError';
import { HTTP_STATUS } from '../constants/statusCodes';

interface CacheEntry {
  data: Record<string, any>;
  expiresAt: number;
}

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export class DashboardService {
  private static cache = new Map<string, CacheEntry>();
  private static readonly CACHE_TTL_MS = 10000; // 10 seconds short-TTL role-isolated cache

  public static clearCache(): void {
    this.cache.clear();
  }

  private static getCached(key: string, bypass?: boolean): Record<string, any> | null {
    if (bypass) return null;
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  private static setCached(key: string, data: Record<string, any>): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + this.CACHE_TTL_MS,
    });
  }

  /**
   * Computes attendance percentage & shortage status using active institutional AttendancePolicy.
   */
  public static async computeStudentAttendanceSummary(
    studentId: Types.ObjectId,
    sectionId?: Types.ObjectId
  ): Promise<{
    totalSessions: number;
    attendedUnits: number;
    countableSessions: number;
    attendancePercentage: number;
    isShortage: boolean;
    isWarning: boolean;
    threshold: number;
  }> {
    const policy =
      (await AttendancePolicy.findOne({ isActive: true }).lean()) || {
        minimumPercentage: 75,
        warningThreshold: 85,
        lateTreatment: 'Present',
        excusedTreatment: 'ExcludeFromTotal',
      };

    const threshold = (policy as any).minimumPercentage || 75;
    const warningThreshold = (policy as any).warningThreshold || 85;

    const sessionMatch: Record<string, any> = { status: { $in: ['Completed', 'completed'] } };
    if (sectionId) {
      sessionMatch.section = sectionId;
    }

    const records = await AttendanceRecord.find({ student: studentId })
      .populate({
        path: 'session',
        match: { status: { $nin: ['Cancelled', 'cancelled'] } },
        select: 'status section subject date',
      })
      .lean();

    const validRecords = records.filter((r: any) => r.session != null);
    let countableSessions = 0;
    let attendedUnits = 0;

    for (const rec of validRecords) {
      const status = (rec.status || '').toLowerCase();
      if (status === 'present') {
        countableSessions += 1;
        attendedUnits += 1;
      } else if (status === 'late') {
        countableSessions += 1;
        if ((policy as any).lateTreatment === 'CountAsHalf') {
          attendedUnits += 0.5;
        } else if ((policy as any).lateTreatment === 'Absent') {
          attendedUnits += 0;
        } else {
          attendedUnits += 1;
        }
      } else if (status === 'excused') {
        if ((policy as any).excusedTreatment === 'Present') {
          countableSessions += 1;
          attendedUnits += 1;
        } else if ((policy as any).excusedTreatment === 'Absent') {
          countableSessions += 1;
        }
        // ExcludeFromTotal -> do not increment countableSessions
      } else {
        // absent
        countableSessions += 1;
      }
    }

    const percentage =
      countableSessions > 0
        ? Number(((attendedUnits / countableSessions) * 100).toFixed(2))
        : 100;

    return {
      totalSessions: validRecords.length,
      attendedUnits,
      countableSessions,
      attendancePercentage: percentage,
      isShortage: countableSessions > 0 && percentage < threshold,
      isWarning:
        countableSessions > 0 && percentage >= threshold && percentage <= warningThreshold,
      threshold,
    };
  }

  /**
   * 1. Admin Dashboard Aggregation (`GET /api/v1/dashboard/admin`)
   */
  public static async getAdminDashboard(
    userId: string,
    query: Record<string, any> = {}
  ): Promise<Record<string, any>> {
    const cacheKey = `dashboard:admin:${userId}:${JSON.stringify(query)}`;
    const cached = this.getCached(cacheKey, query.refreshCache);
    if (cached) return cached;

    const now = new Date();
    const policy = await AttendancePolicy.findOne({ isActive: true }).lean();
    const minAttendanceThreshold = (policy as any)?.minimumPercentage || 75;

    const [
      activeTeachersCount,
      totalStudentsCount,
      totalDepartmentsCount,
      totalClassesCount,
      totalSectionsCount,
      totalAttendanceSessions,
      publishedAssignmentsCount,
      pendingSubmissionsCount,
      evaluatedSubmissionsCount,
      upcomingExams,
      recentAnnouncements,
      pendingLeaveRequests,
      substitutionStatusAgg,
      progressRiskAgg,
      publishedResultsAgg,
      recentDoubts,
    ] = await Promise.all([
      Teacher.countDocuments({ status: 'Active' }),
      Student.countDocuments({ status: { $in: ['Active', 'active'] } }),
      Department.countDocuments(),
      ClassModel.countDocuments({ status: 'Active' }),
      Section.countDocuments(),
      AttendanceSession.countDocuments({ status: { $in: ['Completed', 'completed'] } }),
      Assignment.countDocuments({ status: 'published' }),
      AssignmentSubmission.countDocuments({ status: { $in: ['submitted', 'late', 'resubmitted'] } }),
      AssignmentSubmission.countDocuments({ status: 'evaluated' }),
      ExaminationSchedule.find({ examDate: { $gte: now } })
        .populate('examination', 'name examType semester')
        .populate('subject', 'name code')
        .populate('section', 'sectionName')
        .sort({ examDate: 1 })
        .limit(10)
        .lean(),
      Announcement.find({ status: 'published' })
        .sort({ publishedAt: -1, createdAt: -1 })
        .limit(5)
        .select('title category priority publishedAt createdAt')
        .lean(),
      TeacherLeave.find({ status: 'pending' })
        .populate('teacher', 'employeeId designation firstName lastName')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      Substitution.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]),
      StudentProgress.aggregate([
        { $match: { isSnapshot: false } },
        {
          $group: {
            _id: '$riskClassification.level',
            count: { $sum: 1 },
            avgAttendance: { $avg: '$attendanceSummary.overallPercentage' },
          },
        },
      ]),
      ExaminationResult.aggregate([
        { $match: { evaluationStatus: 'published' } },
        {
          $group: {
            _id: null,
            totalPublishedResults: { $sum: 1 },
            passedCount: {
              $sum: { $cond: [{ $eq: ['$isPassed', true] }, 1, 0] },
            },
            avgPercentage: { $avg: '$percentage' },
          },
        },
      ]),
      Doubt.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select('title category status priority createdAt')
        .lean(),
    ]);

    // Calculate student attendance shortage count across active students
    const studentAttendanceAgg = await AttendanceRecord.aggregate([
      {
        $group: {
          _id: '$student',
          total: { $sum: 1 },
          presentCount: {
            $sum: {
              $cond: [{ $in: ['$status', ['Present', 'present', 'Late', 'late']] }, 1, 0],
            },
          },
        },
      },
      {
        $project: {
          percentage: {
            $cond: [
              { $gt: ['$total', 0] },
              { $multiply: [{ $divide: ['$presentCount', '$total'] }, 100] },
              100,
            ],
          },
        },
      },
    ]);

    const shortageCount = studentAttendanceAgg.filter(
      (s) => s.percentage < minAttendanceThreshold
    ).length;
    const overallAttendancePercentage =
      studentAttendanceAgg.length > 0
        ? Number(
            (
              studentAttendanceAgg.reduce((acc, cur) => acc + cur.percentage, 0) /
              studentAttendanceAgg.length
            ).toFixed(2)
          )
        : 100;

    const subMap: Record<string, number> = {
      proposed: 0,
      approved: 0,
      rejected: 0,
      completed: 0,
      cancelled: 0,
    };
    for (const s of substitutionStatusAgg) {
      if (s._id) subMap[s._id] = s.count;
    }

    const resultStats = publishedResultsAgg[0] || {
      totalPublishedResults: 0,
      passedCount: 0,
      avgPercentage: 0,
    };

    const payload = {
      role: 'admin',
      generatedAt: now.toISOString(),
      institutionCounts: {
        activeTeachers: activeTeachersCount,
        totalStudents: totalStudentsCount,
        totalDepartments: totalDepartmentsCount,
        totalClasses: totalClassesCount,
        totalSections: totalSectionsCount,
      },
      attendanceOverview: {
        completedSessions: totalAttendanceSessions,
        overallAttendancePercentage,
        shortageThreshold: minAttendanceThreshold,
        studentsInShortageCount: shortageCount,
      },
      assignmentsAndEvaluations: {
        publishedAssignments: publishedAssignmentsCount,
        pendingEvaluations: pendingSubmissionsCount,
        completedEvaluations: evaluatedSubmissionsCount,
      },
      upcomingExaminations: upcomingExams,
      recentAnnouncements,
      pendingLeaveRequests: {
        count: pendingLeaveRequests.length,
        items: pendingLeaveRequests,
      },
      substitutionOverview: subMap,
      academicPerformanceOverview: {
        totalPublishedResults: resultStats.totalPublishedResults,
        passPercentage:
          resultStats.totalPublishedResults > 0
            ? Number(
                ((resultStats.passedCount / resultStats.totalPublishedResults) * 100).toFixed(2)
              )
            : 100,
        averageExamScorePercentage: Number((resultStats.avgPercentage || 0).toFixed(2)),
        riskDistribution: progressRiskAgg.map((r) => ({
          riskLevel: r._id || 'low',
          studentCount: r.count,
        })),
      },
      recentSystemActivity: {
        recentAnnouncementsCount: recentAnnouncements.length,
        recentDoubts,
      },
    };

    this.setCached(cacheKey, payload);
    return payload;
  }

  /**
   * 2. Teacher Dashboard Aggregation (`GET /api/v1/dashboard/teacher`)
   */
  public static async getTeacherDashboard(
    userId: string,
    query: Record<string, any> = {}
  ): Promise<Record<string, any>> {
    const cacheKey = `dashboard:teacher:${userId}:${JSON.stringify(query)}`;
    const cached = this.getCached(cacheKey, query.refreshCache);
    if (cached) return cached;

    const teacher = await Teacher.findOne({ user: new Types.ObjectId(userId) })
      .populate('user', 'firstName lastName email phone')
      .populate('department', 'name code')
      .lean();

    if (!teacher) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Teacher profile not found for current user');
    }

    const now = new Date();
    const todayDayName = DAY_NAMES[now.getDay()] || 'Monday';
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const assignments = await TeacherAssignment.find({
      teacher: teacher._id,
      status: 'Active',
    })
      .populate('subject', 'name code semester type credits')
      .populate('section', 'sectionName semester capacity')
      .populate('academicYear', 'year isCurrent')
      .lean();

    const assignedSectionIds = Array.from(
      new Set(assignments.map((a: any) => a.section?._id?.toString()).filter(Boolean))
    ).map((id) => new Types.ObjectId(id));

    const assignedSubjectIds = Array.from(
      new Set(assignments.map((a: any) => a.subject?._id?.toString()).filter(Boolean))
    ).map((id) => new Types.ObjectId(id));

    const teacherAssignmentsDocs = await Assignment.find({
      teacher: teacher._id,
      status: { $in: ['published', 'closed'] },
    })
      .select('_id title subject section dueDate totalMarks status')
      .lean();

    const teacherAssignmentIds = teacherAssignmentsDocs.map((a) => a._id);

    const [
      todaysTimetableEntries,
      todaysTimetableChanges,
      pendingSubmissions,
      recentSubmissions,
      completedSessionsCount,
      upcomingExams,
      recentAnnouncements,
      pendingDoubts,
      leaveRequests,
      upcomingSubstitutions,
      aiUsageSummary,
      classTeacherSections,
      atRiskStudents,
      openParentThreads,
      teacherStudyMaterials,
      unreadNotificationsCount,
    ] = await Promise.all([
      TimetableEntry.find({
        teacher: teacher._id,
        dayOfWeek: todayDayName,
      })
        .populate('subject', 'name code')
        .populate('section', 'name sectionName semester')
        .sort({ periodNumber: 1, startTime: 1 })
        .lean(),
      TimetableChange.find({
        date: { $gte: startOfToday, $lte: endOfToday },
        $or: [{ originalTeacher: teacher._id }, { substituteTeacher: teacher._id }],
      })
        .populate('subject', 'name code')
        .populate('section', 'name sectionName')
        .lean(),
      AssignmentSubmission.countDocuments({
        assignment: { $in: teacherAssignmentIds },
        $or: [
          { submissionStatus: { $in: ['submitted', 'late', 'resubmitted'] }, evaluationStatus: 'pending' },
          { status: { $in: ['submitted', 'late', 'resubmitted'] } },
        ],
      }),
      AssignmentSubmission.find({
        assignment: { $in: teacherAssignmentIds },
      })
        .populate('student', 'rollNumber usn firstName lastName')
        .populate('assignment', 'title dueDate totalMarks')
        .sort({ submittedAt: -1 })
        .limit(10)
        .lean(),
      AttendanceSession.countDocuments({
        teacher: teacher._id,
        status: { $in: ['Completed', 'completed'] },
      }),
      ExaminationSchedule.find({
        section: { $in: assignedSectionIds },
        subject: { $in: assignedSubjectIds },
        examDate: { $gte: startOfToday },
      })
        .populate('examination', 'name examType examinationType')
        .populate('subject', 'name code')
        .populate('section', 'name sectionName')
        .sort({ examDate: 1 })
        .limit(10)
        .lean(),
      Announcement.find({ status: 'published' })
        .sort({ publishedAt: -1, createdAt: -1 })
        .limit(5)
        .select('title announcementType category priority publishedAt')
        .lean(),
      Doubt.find({
        $or: [
          { assignedTeacher: teacher._id },
          { section: { $in: assignedSectionIds }, subject: { $in: assignedSubjectIds } },
        ],
        status: { $in: ['open', 'assigned', 'in_progress'] },
      })
        .populate('subject', 'name code')
        .populate('section', 'name sectionName')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      TeacherLeave.find({ teacher: teacher._id })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('leaveType startDate endDate totalDays status appliedDate createdAt')
        .lean(),
      Substitution.find({
        $or: [{ substituteTeacher: teacher._id }, { absentTeacher: teacher._id }, { originalTeacher: teacher._id }],
        date: { $gte: startOfToday },
        status: { $in: ['proposed', 'approved'] },
      })
        .populate('subject', 'name code')
        .populate('section', 'name sectionName')
        .sort({ date: 1, periodNumber: 1 })
        .limit(10)
        .lean(),
      AIAssistantService.getUserUsageSummary({ id: userId, role: 'teacher' }),
      Section.find({ classTeacher: teacher._id })
        .populate('class', 'name code')
        .select('name sectionName semester roomNumber capacity class')
        .lean(),
      StudentProgress.find({
        section: { $in: assignedSectionIds },
        isSnapshot: false,
        riskLevel: { $in: ['high', 'medium'] },
      })
        .populate('student', 'usn rollNumber firstName lastName')
        .sort({ riskScore: -1 })
        .limit(10)
        .lean(),
      ParentCommunication.find({
        teacher: teacher._id,
        status: { $in: ['open', 'in_progress', 'scheduled'] },
      })
        .populate('student', 'usn rollNumber firstName lastName')
        .populate('parent', 'fatherName motherName guardianName primaryPhone')
        .sort({ updatedAt: -1 })
        .limit(10)
        .lean(),
      StudyMaterial.find({ teacher: teacher._id })
        .select('title materialType status viewCount downloadCount version updatedAt')
        .sort({ updatedAt: -1 })
        .limit(10)
        .lean(),
      Notification.countDocuments({
        recipient: new Types.ObjectId(userId),
        isRead: false,
      }),
    ]);

    // Check shortage students in assigned sections
    const assignedStudents = await Student.find({
      section: { $in: assignedSectionIds },
      status: { $in: ['Active', 'active'] },
    })
      .select('_id rollNumber usn section')
      .lean();

    let shortageStudentsCount = 0;
    for (const st of assignedStudents.slice(0, 50)) {
      const summary = await this.computeStudentAttendanceSummary(st._id, st.section as any);
      if (summary.isShortage) {
        shortageStudentsCount += 1;
      }
    }

    const totalMaterialViews = teacherStudyMaterials.reduce(
      (sum: number, m: any) => sum + (m.viewCount || 0),
      0
    );
    const totalMaterialDownloads = teacherStudyMaterials.reduce(
      (sum: number, m: any) => sum + (m.downloadCount || 0),
      0
    );

    const payload = {
      role: 'teacher',
      generatedAt: now.toISOString(),
      teacherProfile: {
        id: teacher._id,
        employeeId: teacher.employeeId,
        name: `${(teacher as any).firstName || (teacher.user as any)?.firstName || ''} ${(teacher as any).lastName || (teacher.user as any)?.lastName || ''}`.trim(),
        email: (teacher.user as any)?.email,
        designation: teacher.designation,
        department: teacher.department,
        status: teacher.status,
      },
      classTeacherSections,
      assignedClassesAndSubjects: assignments.map((a: any) => ({
        assignmentId: a._id,
        subject: a.subject,
        section: a.section,
        class: a.class,
        academicYear: a.academicYear,
        role: a.role,
      })),
      todaysTimetable: {
        dayOfWeek: todayDayName,
        regularClasses: todaysTimetableEntries,
        scheduleOverrides: todaysTimetableChanges,
      },
      pendingAssignmentEvaluations: {
        pendingCount: pendingSubmissions,
        totalActiveAssignments: teacherAssignmentsDocs.length,
      },
      recentStudentSubmissions: recentSubmissions,
      attendanceOverview: {
        completedSessionsConducted: completedSessionsCount,
        assignedStudentsCount: assignedStudents.length,
        shortageAlertsCount: shortageStudentsCount,
      },
      atRiskStudentsSummary: {
        count: atRiskStudents.length,
        items: atRiskStudents,
      },
      upcomingExaminations: upcomingExams,
      studyMaterialsSummary: {
        recentCount: teacherStudyMaterials.length,
        totalViews: totalMaterialViews,
        totalDownloads: totalMaterialDownloads,
        items: teacherStudyMaterials,
      },
      recentAnnouncements,
      pendingStudentDoubts: {
        count: pendingDoubts.length,
        items: pendingDoubts,
      },
      parentCommunicationsSummary: {
        openThreadsCount: openParentThreads.length,
        items: openParentThreads,
      },
      leaveRequestStatus: leaveRequests,
      upcomingSubstitutions,
      unreadNotificationsCount,
      aiAssistantUsageSummary: aiUsageSummary.currentUsage,
    };

    this.setCached(cacheKey, payload);
    return payload;
  }

  /**
   * 3. Student Dashboard Aggregation (`GET /api/v1/dashboard/student`)
   */
  public static async getStudentDashboard(
    userId: string,
    query: Record<string, any> = {}
  ): Promise<Record<string, any>> {
    const cacheKey = `dashboard:student:${userId}:${JSON.stringify(query)}`;
    const cached = this.getCached(cacheKey, query.refreshCache);
    if (cached) return cached;

    const student = await Student.findOne({ user: new Types.ObjectId(userId) })
      .populate('user', 'firstName lastName email phone')
      .populate('department', 'name code')
      .populate('class', 'name code semester')
      .populate('section', 'name semester')
      .populate('academicYear', 'name isCurrent')
      .lean();

    if (!student) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Student profile not found for current user');
    }

    const now = new Date();
    const todayDayName = DAY_NAMES[now.getDay()] || 'Monday';
    const sectionId = (student.section as any)?._id || student.section;

    // Find active published timetable for student's section
    const publishedTimetables = await Timetable.find({
      section: sectionId,
      status: 'published',
    })
      .select('_id name semester')
      .lean();
    const timetableIds = publishedTimetables.map((t) => t._id);

    const [
      attendanceSummary,
      todaysSchedule,
      publishedAssignments,
      studentSubmissions,
      publishedExamResults,
      studentProgressDocs,
      studyMaterials,
      recentAnnouncements,
      unreadNotifications,
      activeDoubts,
    ] = await Promise.all([
      this.computeStudentAttendanceSummary(student._id, sectionId),
      TimetableEntry.find({
        timetable: { $in: timetableIds },
        dayOfWeek: todayDayName,
      })
        .populate('subject', 'name code')
        .populate({
          path: 'teacher',
          select: 'employeeId designation',
          populate: { path: 'user', select: 'firstName lastName' },
        })
        .sort({ periodNumber: 1, startTime: 1 })
        .lean(),
      Assignment.find({
        section: sectionId,
        status: 'published', // Strictly exclude draft assignments
      })
        .populate('subject', 'name code')
        .sort({ dueDate: 1 })
        .limit(15)
        .lean(),
      AssignmentSubmission.find({
        student: student._id,
      })
        .select('assignment status marksObtained isLate submittedAt')
        .lean(),
      ExaminationResult.find({
        student: student._id,
        evaluationStatus: 'published', // Strictly exclude unpublished examination results!
      })
        .populate('examination', 'name examType semester')
        .populate('subject', 'name code credits')
        .sort({ updatedAt: -1 })
        .limit(15)
        .lean(),
      StudentProgress.find({
        student: student._id,
        isSnapshot: false,
      })
        .sort({ updatedAt: -1 })
        .limit(1)
        .lean(),
      StudyMaterial.find({
        status: 'published', // Strictly exclude draft study materials
        $or: [
          { visibility: 'institution' },
          { visibility: 'class', section: sectionId },
          { visibility: 'subject', semester: student.semester },
        ],
      })
        .populate('subject', 'name code')
        .sort({ publishedAt: -1, createdAt: -1 })
        .limit(10)
        .select('title description materialType subject topic visibility publishedAt')
        .lean(),
      Announcement.find({
        status: 'published',
      })
        .sort({ publishedAt: -1, createdAt: -1 })
        .limit(5)
        .select('title content category priority publishedAt')
        .lean(),
      Notification.find({
        recipient: new Types.ObjectId(userId),
        isRead: false,
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('title message type priority isRead createdAt')
        .lean(),
      Doubt.find({
        student: student._id,
        status: { $ne: 'closed' },
      })
        .populate('subject', 'name code')
        .sort({ updatedAt: -1 })
        .limit(10)
        .select('title category priority status updatedAt')
        .lean(),
    ]);

    const submittedAssignmentIds = new Set(
      studentSubmissions.map((s) => s.assignment.toString())
    );
    const pendingAssignments = publishedAssignments.filter(
      (a) => !submittedAssignmentIds.has(a._id.toString())
    );

    const payload = {
      role: 'student',
      generatedAt: now.toISOString(),
      studentProfile: {
        id: student._id,
        rollNumber: student.rollNumber,
        usn: student.usn,
        name: `${(student.user as any)?.firstName || ''} ${(student.user as any)?.lastName || ''}`.trim(),
        email: (student.user as any)?.email,
        semester: student.semester,
        department: student.department,
        class: student.class,
        section: student.section,
        academicYear: student.academicYear,
      },
      todaysTimetable: {
        dayOfWeek: todayDayName,
        entries: todaysSchedule,
      },
      attendanceStatus: attendanceSummary,
      pendingAssignments: {
        count: pendingAssignments.length,
        items: pendingAssignments,
      },
      publishedExaminationResults: publishedExamResults,
      academicProgress: studentProgressDocs[0] || null,
      availableStudyMaterials: studyMaterials,
      recentAnnouncements,
      unreadNotifications: {
        count: unreadNotifications.length,
        items: unreadNotifications,
      },
      activeDoubts: {
        count: activeDoubts.length,
        items: activeDoubts,
      },
    };

    this.setCached(cacheKey, payload);
    return payload;
  }

  /**
   * 4. Parent Dashboard Aggregation (`GET /api/v1/dashboard/parent`)
   */
  public static async getParentDashboard(
    userId: string,
    query: Record<string, any> = {}
  ): Promise<Record<string, any>> {
    const cacheKey = `dashboard:parent:${userId}:${JSON.stringify(query)}`;
    const cached = this.getCached(cacheKey, query.refreshCache);
    if (cached) return cached;

    const parent = await Parent.findOne({ user: new Types.ObjectId(userId) })
      .populate('user', 'firstName lastName email phone')
      .lean();

    if (!parent) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Parent profile not found for current user');
    }

    const linkedStudentIds = (parent.students || []).map((id: any) => new Types.ObjectId(id));

    // If a specific studentId filter is requested, verify the child is linked to this parent
    if (query.studentId) {
      const isLinked = linkedStudentIds.some((id) => id.toString() === query.studentId);
      if (!isLinked) {
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          'You are only authorized to view dashboard data for your verified linked children'
        );
      }
    }

    const targetStudentIds = query.studentId
      ? [new Types.ObjectId(query.studentId)]
      : linkedStudentIds;

    const childrenDocs = await Student.find({
      _id: { $in: targetStudentIds },
    })
      .populate('user', 'firstName lastName email')
      .populate('department', 'name code')
      .populate('class', 'name code semester')
      .populate('section', 'name semester')
      .populate('academicYear', 'name isCurrent')
      .lean();

    const now = new Date();
    const todayDayName = DAY_NAMES[now.getDay()] || 'Monday';

    const childrenOverview = await Promise.all(
      childrenDocs.map(async (child: any) => {
        const sectionId = child.section?._id || child.section;
        const publishedTimetables = await Timetable.find({
          section: sectionId,
          status: 'published',
        })
          .select('_id name')
          .lean();
        const ttIds = publishedTimetables.map((t) => t._id);

        const [
          attendanceSummary,
          publishedAssignments,
          submissions,
          publishedExamResults,
          progressDoc,
          timetableEntries,
        ] = await Promise.all([
          this.computeStudentAttendanceSummary(child._id, sectionId),
          Assignment.find({
            section: sectionId,
            status: 'published', // Strictly exclude draft assignments
          })
            .populate('subject', 'name code')
            .sort({ dueDate: 1 })
            .limit(10)
            .lean(),
          AssignmentSubmission.find({ student: child._id })
            .select('assignment status marksObtained')
            .lean(),
          ExaminationResult.find({
            student: child._id,
            evaluationStatus: 'published', // Strictly exclude unpublished results!
          })
            .populate('examination', 'name examType semester')
            .populate('subject', 'name code')
            .sort({ updatedAt: -1 })
            .limit(10)
            .lean(),
          StudentProgress.findOne({ student: child._id, isSnapshot: false })
            .sort({ updatedAt: -1 })
            .lean(),
          TimetableEntry.find({
            timetable: { $in: ttIds },
          })
            .populate('subject', 'name code')
            .sort({ dayOfWeek: 1, periodNumber: 1 })
            .lean(),
        ]);

        const submittedSet = new Set(submissions.map((s) => s.assignment.toString()));
        const pendingAssignments = publishedAssignments.filter(
          (a) => !submittedSet.has(a._id.toString())
        );

        return {
          studentProfile: {
            id: child._id,
            rollNumber: child.rollNumber,
            usn: child.usn,
            name: `${child.user?.firstName || ''} ${child.user?.lastName || ''}`.trim(),
            semester: child.semester,
            department: child.department,
            class: child.class,
            section: child.section,
          },
          attendanceSummary,
          pendingAssignments: {
            count: pendingAssignments.length,
            items: pendingAssignments,
          },
          publishedExaminationResults: publishedExamResults,
          academicProgress: progressDoc || null,
          timetable: {
            todayDayOfWeek: todayDayName,
            entries: timetableEntries,
          },
        };
      })
    );

    const [recentAnnouncements, parentCommunications, unreadNotifications] = await Promise.all([
      Announcement.find({ status: 'published' })
        .sort({ publishedAt: -1, createdAt: -1 })
        .limit(5)
        .select('title content category priority publishedAt')
        .lean(),
      ParentCommunication.find({
        parent: parent._id,
        student: { $in: targetStudentIds },
      })
        .populate('student', 'rollNumber usn')
        .populate('teacher', 'employeeId designation')
        .sort({ updatedAt: -1 })
        .limit(10)
        .select('subject category status priority meetingDetails updatedAt')
        .lean(),
      Notification.find({
        recipient: new Types.ObjectId(userId),
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('title message type priority isRead createdAt')
        .lean(),
    ]);

    const payload = {
      role: 'parent',
      generatedAt: now.toISOString(),
      parentProfile: {
        id: parent._id,
        name: `${(parent.user as any)?.firstName || ''} ${(parent.user as any)?.lastName || ''}`.trim(),
        email: (parent.user as any)?.email,
        relationship: parent.relationshipType,
        linkedChildrenCount: linkedStudentIds.length,
      },
      children: childrenOverview,
      recentAnnouncements,
      parentTeacherCommunications: parentCommunications,
      importantNotifications: unreadNotifications,
    };

    this.setCached(cacheKey, payload);
    return payload;
  }
}
