import mongoose from 'mongoose';
import { env } from './env.config';
import { logger } from './logger.config';

let isConnected = false;
let memoryServerInstance: { stop: () => Promise<boolean> } | null = null;

const seedDevelopmentDataIfEmpty = async () => {
  try {
    const { User } = await import('../models/user.model');
    const count = await User.countDocuments();
    if (count > 0) return;

    const { ROLES } = await import('../constants/roles.constant');
    const { AcademicYear } = await import('../models/academicYear.model');
    const { Department } = await import('../models/department.model');
    const { Class } = await import('../models/class.model');
    const { Section } = await import('../models/section.model');
    const { Subject } = await import('../models/subject.model');
    const { Teacher } = await import('../models/teacher.model');
    const { TeacherAssignment } = await import('../models/teacherAssignment.model');
    const { Student } = await import('../models/student.model');
    const { Parent } = await import('../models/parent.model');
    const { AttendancePolicy } = await import('../models/attendancePolicy.model');
    const { AttendanceSession } = await import('../models/attendanceSession.model');
    const { AttendanceRecord } = await import('../models/attendanceRecord.model');
    const { Assignment } = await import('../models/assignment.model');
    const { Examination } = await import('../models/examination.model');
    const { ExaminationSchedule } = await import('../models/examinationSchedule.model');
    const { GradingPolicy } = await import('../models/gradingPolicy.model');
    const { ExaminationResult } = await import('../models/examinationResult.model');
    const { StudyMaterial } = await import('../models/studyMaterial.model');
    const { Timetable } = await import('../models/timetable.model');
    const { TimetableEntry } = await import('../models/timetableEntry.model');
    const { StudentProgress } = await import('../models/studentProgress.model');
    const { AnnouncementService } = await import('../services/announcement.service');
    const { NotificationService } = await import('../services/notification.service');

    // 1. Users
    const adminUser = await User.create({
      email: 'admin@msec.ac.in',
      password: 'AdminPassword123',
      role: ROLES.ADMIN,
      isActive: true,
    });

    const teacherUser = await User.create({
      email: 'prof.sharma@msec.ac.in',
      password: 'TeacherPassword123',
      role: ROLES.TEACHER,
      isActive: true,
    });

    const teacher2User = await User.create({
      email: 'prof.iyer@msec.ac.in',
      password: 'TeacherPassword123',
      role: ROLES.TEACHER,
      isActive: true,
    });

    const studentUser = await User.create({
      email: 'student@msec.ac.in',
      password: 'StudentPassword123',
      role: ROLES.STUDENT,
      isActive: true,
    });

    const student2User = await User.create({
      email: 'ananya.rao@msec.ac.in',
      password: 'StudentPassword123',
      role: ROLES.STUDENT,
      isActive: true,
    });

    const student3User = await User.create({
      email: 'karthik.nair@msec.ac.in',
      password: 'StudentPassword123',
      role: ROLES.STUDENT,
      isActive: true,
    });

    const parentUser = await User.create({
      email: 'parent@msec.ac.in',
      password: 'ParentPassword123',
      role: ROLES.PARENT,
      isActive: true,
    });

    // 2. Academic Year, Departments, Classes, Sections, Subjects
    const ay = await AcademicYear.create({
      year: '2026-2027',
      startDate: new Date('2026-08-01'),
      endDate: new Date('2027-05-31'),
      semesterType: 'ODD',
      isCurrent: true,
    });

    const deptCSE = await Department.create({
      name: 'Computer Science & Engineering',
      code: 'CSE',
      description: 'Department of Computer Science & Engineering',
    });

    const deptECE = await Department.create({
      name: 'Electronics & Communication Engineering',
      code: 'ECE',
      description: 'Department of Electronics & Communication Engineering',
    });

    const clsCSE = await Class.create({
      name: 'B.E. Computer Science & Engineering',
      code: 'BE-CSE',
      department: deptCSE._id,
      degree: 'B.E.',
      durationYears: 4,
    });

    const clsECE = await Class.create({
      name: 'B.E. Electronics & Communication',
      code: 'BE-ECE',
      department: deptECE._id,
      degree: 'B.E.',
      durationYears: 4,
    });

    const teacher = await Teacher.create({
      user: teacherUser._id,
      employeeId: 'MSEC-CSE-101',
      firstName: 'Arvind',
      lastName: 'Sharma',
      department: deptCSE._id,
      designation: 'Professor & HOD',
      qualification: 'Ph.D. (IISc)',
      phone: '9876543210',
      officeRoom: 'CSE-204',
      status: 'Active',
    });

    const teacher2 = await Teacher.create({
      user: teacher2User._id,
      employeeId: 'MSEC-CSE-104',
      firstName: 'Meenakshi',
      lastName: 'Iyer',
      department: deptCSE._id,
      designation: 'Associate Professor',
      qualification: 'Ph.D.',
      phone: '9876543212',
      officeRoom: 'CSE-210',
      status: 'Active',
    });

    const sectionA = await Section.create({
      class: clsCSE._id,
      academicYear: ay._id,
      semester: 5,
      sectionName: 'A',
      classTeacher: teacher._id,
      roomNumber: 'LHC-301',
      capacity: 60,
    });

    await Section.create({
      class: clsECE._id,
      academicYear: ay._id,
      semester: 5,
      sectionName: 'B',
      classTeacher: teacher2._id,
      roomNumber: 'LHC-305',
      capacity: 60,
    });

    const subDBMS = await Subject.create({
      name: 'Database Management Systems',
      code: '21CS51',
      department: deptCSE._id,
      semester: 5,
      credits: 4,
      subjectType: 'Theory',
      modules: [
        { moduleNumber: 1, title: 'Relational Model & Relational Algebra', topics: ['ER Modeling', 'Normalization', 'Relational Calculus'] },
        { moduleNumber: 2, title: 'Transaction Processing & Concurrency Control', topics: ['ACID Properties', 'Two-Phase Locking', 'MVCC'] },
      ],
    });

    const subOS = await Subject.create({
      name: 'Operating Systems & Kernel Architecture',
      code: '21CS52',
      department: deptCSE._id,
      semester: 5,
      credits: 4,
      subjectType: 'Theory',
      modules: [
        { moduleNumber: 1, title: 'Process Synchronization & Scheduling', topics: ['CFS Scheduler', 'Semaphores', 'Deadlock Avoidance'] },
      ],
    });

    const subCN = await Subject.create({
      name: 'Computer Networks & Protocols',
      code: '21CS53',
      department: deptCSE._id,
      semester: 5,
      credits: 3,
      subjectType: 'Theory',
    });

    await TeacherAssignment.create([
      {
        teacher: teacher._id,
        subject: subDBMS._id,
        section: sectionA._id,
        academicYear: ay._id,
        semester: 5,
        status: 'Active',
      },
      {
        teacher: teacher._id,
        subject: subOS._id,
        section: sectionA._id,
        academicYear: ay._id,
        semester: 5,
        status: 'Active',
      },
      {
        teacher: teacher2._id,
        subject: subCN._id,
        section: sectionA._id,
        academicYear: ay._id,
        semester: 5,
        status: 'Active',
      },
    ]);

    // 3. Students & Parents
    const s1 = await Student.create({
      user: studentUser._id,
      usn: '1MS24CS001',
      rollNumber: '01',
      firstName: 'Rohan',
      lastName: 'Verma',
      gender: 'Male',
      department: deptCSE._id,
      class: clsCSE._id,
      section: sectionA._id,
      semester: 5,
      academicYear: ay._id,
      phone: '9123456780',
      status: 'Active',
    });

    const s2 = await Student.create({
      user: student2User._id,
      usn: '1MS24CS002',
      rollNumber: '02',
      firstName: 'Ananya',
      lastName: 'Rao',
      gender: 'Female',
      department: deptCSE._id,
      class: clsCSE._id,
      section: sectionA._id,
      semester: 5,
      academicYear: ay._id,
      phone: '9123456781',
      status: 'Active',
    });

    const s3 = await Student.create({
      user: student3User._id,
      usn: '1MS24CS003',
      rollNumber: '03',
      firstName: 'Karthik',
      lastName: 'Nair',
      gender: 'Male',
      department: deptCSE._id,
      class: clsCSE._id,
      section: sectionA._id,
      semester: 5,
      academicYear: ay._id,
      phone: '9123456782',
      status: 'Active',
    });

    const parent = await Parent.create({
      user: parentUser._id,
      fatherName: 'Suresh Verma',
      motherName: 'Kavitha Verma',
      primaryPhone: '9123456789',
      students: [s1._id],
    });
    s1.parent = parent._id;
    await s1.save();

    // 4. Attendance Policy, Sessions & Records
    await AttendancePolicy.create({
      name: 'MSEC Standard Undergraduate Attendance Policy 2026',
      academicYear: ay._id,
      institutionThreshold: 75,
      warningThreshold: 85,
      lateTreatment: 'Present',
      excusedTreatment: 'ExcludeFromTotal',
      isActive: true,
    });

    const sessionDates = [
      new Date(Date.now() - 5 * 86400000),
      new Date(Date.now() - 4 * 86400000),
      new Date(Date.now() - 3 * 86400000),
      new Date(Date.now() - 2 * 86400000),
      new Date(Date.now() - 1 * 86400000),
    ];

    for (let i = 0; i < sessionDates.length; i++) {
      const sess = await AttendanceSession.create({
        academicYear: ay._id,
        department: deptCSE._id,
        class: clsCSE._id,
        section: sectionA._id,
        subject: subDBMS._id,
        teacher: teacher._id,
        semester: 5,
        date: sessionDates[i],
        periodNumber: 1,
        startTime: '09:00',
        endTime: '10:00',
        topicCovered: `Module ${i < 3 ? 1 : 2} Lecture ${i + 1}`,
        status: 'Completed',
        totalStudents: 3,
        presentCount: i < 3 ? 2 : 3,
        absentCount: i < 3 ? 1 : 0,
      });

      await AttendanceRecord.create([
        {
          session: sess._id,
          student: s1._id,
          status: i === 4 ? 'Late' : 'Present',
          markedBy: teacherUser._id,
        },
        {
          session: sess._id,
          student: s2._id,
          status: 'Present',
          markedBy: teacherUser._id,
        },
        {
          session: sess._id,
          student: s3._id,
          status: i < 3 ? 'Absent' : 'Present', // 40% attendance -> shortage alert!
          remarks: i < 3 ? 'Unexcused absence' : undefined,
          markedBy: teacherUser._id,
        },
      ]);
    }

    // 5. Assignments
    await Assignment.create([
      {
        title: 'B+ Tree Indexing & Query Cost Optimization Lab',
        description: 'Implement a disk-backed B+ Tree index in C++/TypeScript and benchmark range query execution plans on 100k tuples.',
        instructions: 'Submit source code archive along with execution plan analysis PDF.',
        academicYear: ay._id,
        semester: 5,
        section: sectionA._id,
        subject: subDBMS._id,
        teacher: teacher._id,
        assignmentType: 'practical',
        totalMarks: 50,
        passingMarks: 20,
        assignedDate: new Date(Date.now() - 7 * 86400000),
        dueDate: new Date(Date.now() + 5 * 86400000),
        allowLateSubmission: true,
        maxResubmissions: 2,
        status: 'published',
        createdBy: teacherUser._id,
      },
      {
        title: 'POSIX Threads & Dining Philosophers Deadlock Analysis',
        description: 'Analyze monitor-based and semaphore-based solutions to avoid starvation under high contention.',
        academicYear: ay._id,
        semester: 5,
        section: sectionA._id,
        subject: subOS._id,
        teacher: teacher._id,
        assignmentType: 'homework',
        totalMarks: 30,
        passingMarks: 12,
        assignedDate: new Date(Date.now() - 4 * 86400000),
        dueDate: new Date(Date.now() + 8 * 86400000),
        allowLateSubmission: false,
        maxResubmissions: 1,
        status: 'published',
        createdBy: teacherUser._id,
      },
    ]);

    // 6. Examinations, Grading Policy & Published Results
    const gradingPolicy = await GradingPolicy.create({
      name: 'VTU / MSEC CBCS 10-Point Grading Scale',
      academicYear: ay._id,
      passingPercentage: 40,
      iaAggregationMethod: 'BEST_2_OF_3',
      isActive: true,
      gradeScale: [
        { grade: 'O', minPercentage: 90, maxPercentage: 100, gradePoints: 10, description: 'Outstanding' },
        { grade: 'A+', minPercentage: 80, maxPercentage: 89.99, gradePoints: 9, description: 'Excellent' },
        { grade: 'A', minPercentage: 70, maxPercentage: 79.99, gradePoints: 8, description: 'Very Good' },
        { grade: 'B+', minPercentage: 60, maxPercentage: 69.99, gradePoints: 7, description: 'Good' },
        { grade: 'B', minPercentage: 50, maxPercentage: 59.99, gradePoints: 6, description: 'Above Average' },
        { grade: 'C', minPercentage: 40, maxPercentage: 49.99, gradePoints: 5, description: 'Pass' },
        { grade: 'F', minPercentage: 0, maxPercentage: 39.99, gradePoints: 0, description: 'Fail' },
      ],
    });

    const examIA1 = await Examination.create({
      name: 'Internal Assessment 1 (Odd Semester 2026)',
      code: 'IA1-ODD-2026',
      examType: 'IA1',
      academicYear: ay._id,
      department: deptCSE._id,
      class: clsCSE._id,
      semester: 5,
      startDate: new Date('2026-10-10'),
      endDate: new Date('2026-10-15'),
      maximumMarks: 50,
      passingMarks: 20,
      weightage: 20,
      status: 'published',
      isPublished: true,
      publishedAt: new Date(Date.now() - 2 * 86400000),
      createdBy: adminUser._id,
    });

    await ExaminationSchedule.create({
      examination: examIA1._id,
      subject: subDBMS._id,
      section: sectionA._id,
      examDate: new Date('2026-10-12'),
      startTime: '09:30',
      endTime: '11:00',
      roomNumber: 'LHC-301',
      invigilator: teacher._id,
      maximumMarks: 50,
      passingMarks: 20,
      status: 'completed',
    });

    await ExaminationResult.create([
      {
        examination: examIA1._id,
        student: s1._id,
        subject: subDBMS._id,
        section: sectionA._id,
        academicYear: ay._id,
        semester: 5,
        marksObtained: 44,
        maximumMarks: 50,
        percentage: 88,
        grade: 'A+',
        gradePoints: 9,
        PassStatus: 'Pass',
        attendanceStatus: 'Present',
        isPublished: true,
        evaluatedBy: teacherUser._id,
        gradingPolicyUsed: gradingPolicy._id,
      },
      {
        examination: examIA1._id,
        student: s2._id,
        subject: subDBMS._id,
        section: sectionA._id,
        academicYear: ay._id,
        semester: 5,
        marksObtained: 47,
        maximumMarks: 50,
        percentage: 94,
        grade: 'O',
        gradePoints: 10,
        PassStatus: 'Pass',
        attendanceStatus: 'Present',
        isPublished: true,
        evaluatedBy: teacherUser._id,
        gradingPolicyUsed: gradingPolicy._id,
      },
      {
        examination: examIA1._id,
        student: s3._id,
        subject: subDBMS._id,
        section: sectionA._id,
        academicYear: ay._id,
        semester: 5,
        marksObtained: 17,
        maximumMarks: 50,
        percentage: 34,
        grade: 'F',
        gradePoints: 0,
        PassStatus: 'Fail',
        attendanceStatus: 'Present',
        isPublished: true,
        evaluatedBy: teacherUser._id,
        gradingPolicyUsed: gradingPolicy._id,
      },
    ]);

    // 7. Student Progress & At-Risk Analytics
    await StudentProgress.create([
      {
        student: s1._id,
        academicYear: ay._id,
        semester: 5,
        section: sectionA._id,
        overallAttendancePercentage: 100,
        assignmentCompletionPercentage: 100,
        overallAcademicPercentage: 88,
        cgpa: 8.9,
        sgpa: 9.0,
        performanceTrend: 'improving',
        riskLevel: 'low',
        riskScore: 5,
        riskIndicators: [],
        subjectProgress: [
          {
            subject: subDBMS._id,
            attendancePercentage: 100,
            assignmentsCompleted: 2,
            totalAssignments: 2,
            assignmentAveragePercentage: 90,
            iaPercentage: 88,
            examPercentage: 88,
            overallSubjectPercentage: 89,
            grade: 'A+',
            isPassing: true,
          },
        ],
      },
      {
        student: s3._id,
        academicYear: ay._id,
        semester: 5,
        section: sectionA._id,
        overallAttendancePercentage: 40,
        assignmentCompletionPercentage: 50,
        overallAcademicPercentage: 34,
        cgpa: 5.2,
        sgpa: 4.5,
        performanceTrend: 'declining',
        riskLevel: 'high',
        riskScore: 78,
        riskIndicators: [
          {
            code: 'LOW_ATTENDANCE',
            description: 'Attendance is 40.0%, critically below the 75% institutional threshold.',
            severity: 'high',
            scoreContribution: 45,
          },
          {
            code: 'POOR_IA_PERFORMANCE',
            description: 'Internal Assessment average is 34.0%, below the 40% passing mark.',
            severity: 'high',
            scoreContribution: 33,
          },
        ],
        subjectProgress: [
          {
            subject: subDBMS._id,
            attendancePercentage: 40,
            assignmentsCompleted: 1,
            totalAssignments: 2,
            assignmentAveragePercentage: 45,
            iaPercentage: 34,
            examPercentage: 34,
            overallSubjectPercentage: 36,
            grade: 'F',
            isPassing: false,
          },
        ],
      },
    ]);

    // 8. Study Materials
    await StudyMaterial.create([
      {
        title: 'DBMS Module 1 & 2 Complete Lecture Notes — Relational Algebra & MVCC',
        description: 'Comprehensive syllabus notes with B+ Tree diagrams, concurrency schedules, and solved VTU past paper questions.',
        academicYear: ay._id,
        department: deptCSE._id,
        class: clsCSE._id,
        section: sectionA._id,
        subject: subDBMS._id,
        teacher: teacher._id,
        semester: 5,
        materialType: 'lecture_notes',
        unit: 'Module 1 & 2',
        topic: 'Relational Algebra, ACID & Concurrency Control',
        tags: ['dbms', 'mvcc', 'relational-algebra', 'b-tree'],
        visibility: 'section',
        status: 'published',
        publishedAt: new Date(Date.now() - 6 * 86400000),
        viewCount: 142,
        downloadCount: 89,
        currentVersion: 1,
        createdBy: teacherUser._id,
      },
      {
        title: 'Linux Kernel Process Scheduler & CFS Reference Guide',
        description: 'Deep-dive reference covering red-black trees in the Completely Fair Scheduler, context switches, and POSIX pthreads.',
        academicYear: ay._id,
        department: deptCSE._id,
        class: clsCSE._id,
        section: sectionA._id,
        subject: subOS._id,
        teacher: teacher._id,
        semester: 5,
        materialType: 'reference',
        unit: 'Module 1',
        topic: 'Process Scheduling & Synchronization',
        tags: ['os', 'linux-kernel', 'cfs', 'threads'],
        visibility: 'subject',
        status: 'published',
        publishedAt: new Date(Date.now() - 3 * 86400000),
        viewCount: 98,
        downloadCount: 64,
        currentVersion: 1,
        createdBy: teacherUser._id,
      },
    ]);

    // 9. Timetable & Schedule Entries
    const timetable = await Timetable.create({
      name: '5th Semester B.E. CSE — Section A Master Timetable (Odd 2026)',
      academicYear: ay._id,
      department: deptCSE._id,
      class: clsCSE._id,
      section: sectionA._id,
      semester: 5,
      effectiveFrom: new Date('2026-08-01'),
      effectiveTo: new Date('2027-01-31'),
      status: 'published',
      publishedAt: new Date('2026-08-01'),
      publishedBy: adminUser._id,
      createdBy: adminUser._id,
    });

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;
    for (const day of days) {
      await TimetableEntry.create([
        {
          timetable: timetable._id,
          section: sectionA._id,
          dayOfWeek: day,
          periodNumber: 1,
          startTime: '09:00',
          endTime: '10:00',
          subject: subDBMS._id,
          teacher: teacher._id,
          sessionType: 'Lecture',
          classroom: 'LHC-301',
          status: 'scheduled',
        },
        {
          timetable: timetable._id,
          section: sectionA._id,
          dayOfWeek: day,
          periodNumber: 2,
          startTime: '10:00',
          endTime: '11:00',
          subject: subOS._id,
          teacher: teacher._id,
          sessionType: 'Lecture',
          classroom: 'LHC-301',
          status: 'scheduled',
        },
        {
          timetable: timetable._id,
          section: sectionA._id,
          dayOfWeek: day,
          periodNumber: 3,
          startTime: '11:15',
          endTime: '12:15',
          subject: subCN._id,
          teacher: teacher2._id,
          sessionType: 'Lecture',
          classroom: 'LHC-301',
          status: 'scheduled',
        },
      ]);
    }

    // 10. Phase 9 Announcements & Notifications
    await AnnouncementService.createAnnouncement(
      adminUser._id.toString(),
      ROLES.ADMIN,
      {
        title: 'Internal Assessment 2 (IA-2) Timetable & Hall Allocation Published',
        content:
          'Internal Assessment 2 for all 5th Semester B.E. branches will be conducted from November 16 to November 20, 2026. Students must carry their institutional ID cards and report 15 minutes prior to the session.',
        summary: 'IA-2 scheduled for Nov 16–20, 2026 across all 5th Semester sections.',
        announcementType: 'examination',
        priority: 'high',
        targetAudience: 'all',
        status: 'published',
      }
    );

    await AnnouncementService.createAnnouncement(
      teacherUser._id.toString(),
      ROLES.TEACHER,
      {
        title: 'CS501 DBMS Lab Evaluation & B+ Tree Submission Reminder',
        content:
          'Section A students are reminded to upload their B+ Tree Indexing benchmark reports before Friday 5:00 PM. Live viva-voce will be held during the practical slot in Lab 2.',
        summary: 'DBMS B+ Tree lab submission due Friday 5:00 PM.',
        announcementType: 'assignment',
        priority: 'normal',
        targetAudience: 'students',
        targetSections: [sectionA._id.toString()],
        targetSubjects: [subDBMS._id.toString()],
        status: 'published',
      }
    );

    await AnnouncementService.createAnnouncement(
      adminUser._id.toString(),
      ROLES.ADMIN,
      {
        title: 'Annual Research Symposium & Industry Conclave — Call for Papers',
        content:
          'MSEC Bengaluru invites faculty and undergraduate research teams to submit abstracts for the 2026 IEEE/MSEC Technical Symposium.',
        summary: 'Call for papers open for the 2026 Technical Symposium.',
        announcementType: 'event',
        priority: 'normal',
        targetAudience: 'all',
        status: 'published',
      }
    );

    await NotificationService.notifyAttendanceWarning({
      recipients: [student3User._id, parentUser._id],
      studentId: s3._id,
      subjectId: subDBMS._id,
      percentage: 40.0,
      threshold: 75,
      periodKey: '2026-11',
    });

    logger.info('Seeded comprehensive demo dataset across Phases 1–9 for development');
  } catch (err) {
    logger.warn('Development seed skipped:', err);
  }
};

export const connectDatabase = async (uri: string = env.MONGODB_URI): Promise<typeof mongoose> => {
  if (isConnected || mongoose.connection.readyState === 1) {
    isConnected = true;
    return mongoose;
  }

  mongoose.connection.on('connected', () => {
    isConnected = true;
    logger.info('MongoDB connection established successfully');
  });

  mongoose.connection.on('error', (err) => {
    logger.debug('MongoDB connection error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    isConnected = false;
  });

  try {
    const conn = await mongoose.connect(uri, {
      autoIndex: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 1500,
    });
    isConnected = true;
    if (env.NODE_ENV === 'development') {
      await seedDevelopmentDataIfEmpty();
    }
    return conn;
  } catch (error) {
    if (env.NODE_ENV !== 'test') {
      try {
        const { MongoMemoryServer } = await import('mongodb-memory-server');
        const mongoServer = await MongoMemoryServer.create();
        memoryServerInstance = mongoServer;
        const memUri = mongoServer.getUri();
        const conn = await mongoose.connect(memUri, {
          autoIndex: true,
          maxPoolSize: 10,
        });
        isConnected = true;
        logger.info('Connected to in-memory MongoDB instance for development');
        await seedDevelopmentDataIfEmpty();
        return conn;
      } catch (memErr) {
        logger.warn('MongoDB unavailable — running in resilient mode:', memErr);
        mongoose.set('bufferCommands', false);
        return mongoose;
      }
    }
    throw error;
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  if (!isConnected && mongoose.connection.readyState === 0) {
    return;
  }
  try {
    await mongoose.connection.close();
    if (memoryServerInstance) {
      await memoryServerInstance.stop();
      memoryServerInstance = null;
    }
    isConnected = false;
    logger.info('MongoDB connection closed');
  } catch (error) {
    logger.error('Error during MongoDB disconnection:', error);
  }
};

export const isDatabaseConnected = (): boolean => isConnected || mongoose.connection.readyState === 1;
