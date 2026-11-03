import request from 'supertest';
import { app } from '../../src/app';
import { User } from '../../src/models/user.model';
import { Teacher } from '../../src/models/teacher.model';
import { Student } from '../../src/models/student.model';
import { Parent } from '../../src/models/parent.model';
import { AcademicYear } from '../../src/models/academicYear.model';
import { Department } from '../../src/models/department.model';
import { Class } from '../../src/models/class.model';
import { Section } from '../../src/models/section.model';
import { Subject } from '../../src/models/subject.model';
import { TeacherAssignment } from '../../src/models/teacherAssignment.model';
import { AttendanceSession } from '../../src/models/attendanceSession.model';
import { AttendanceRecord } from '../../src/models/attendanceRecord.model';
import { Assignment } from '../../src/models/assignment.model';
import { AssignmentSubmission } from '../../src/models/assignmentSubmission.model';
import { Examination } from '../../src/models/examination.model';
import { ExaminationResult } from '../../src/models/examinationResult.model';
import { ROLES } from '../../src/constants/roles.constant';

describe('Phase 6 – Student Progress Tracking & Performance Analytics Integration Tests', () => {
  let adminToken: string;
  let teacher1Token: string;
  let teacher2Token: string;
  let student1Token: string;
  let student2Token: string;
  let parentToken: string;

  let student1DocId: string;
  let student2DocId: string;

  let yearId: string;
  let sectionAId: string;
  let subject1Id: string;
  let subject2Id: string;

  beforeEach(async () => {
    // 1. Admin
    await User.create({
      email: 'admin@msec.ac.in',
      password: 'AdminPassword123',
      role: ROLES.ADMIN,
      isActive: true,
    });
    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@msec.ac.in', password: 'AdminPassword123' });
    adminToken = adminLogin.body.data.tokens.accessToken;

    // 2. Academic Foundation
    const academicYear = await AcademicYear.create({
      year: '2026-2027',
      startDate: new Date('2026-08-01'),
      endDate: new Date('2027-05-31'),
      semesterType: 'ODD',
      isCurrent: true,
      status: 'Active',
    });
    yearId = academicYear._id.toString();

    const dept = await Department.create({
      name: 'Computer Science & Engineering',
      code: 'CSE',
      status: 'Active',
    });

    const academicClass = await Class.create({
      name: 'Bachelor of Engineering in CSE',
      code: 'BE-CSE',
      department: dept._id,
      degree: 'B.E.',
      durationYears: 4,
      status: 'Active',
    });

    const sectionA = await Section.create({
      class: academicClass._id,
      academicYear: academicYear._id,
      semester: 5,
      sectionName: 'A',
      capacity: 60,
      status: 'Active',
    });
    sectionAId = sectionA._id.toString();

    await Section.create({
      class: academicClass._id,
      academicYear: academicYear._id,
      semester: 5,
      sectionName: 'B',
      capacity: 60,
      status: 'Active',
    });

    const subject1 = await Subject.create({
      name: 'Advanced Database Systems',
      code: '21CS51',
      department: dept._id,
      semester: 5,
      credits: 4,
      type: 'Theory',
      status: 'Active',
    });
    subject1Id = subject1._id.toString();

    const subject2 = await Subject.create({
      name: 'Computer Networks',
      code: '21CS52',
      department: dept._id,
      semester: 5,
      credits: 4,
      type: 'Theory',
      status: 'Active',
    });
    subject2Id = subject2._id.toString();

    // 3. Teachers
    const teacherUser1 = await User.create({
      email: 'teacher1@msec.ac.in',
      password: 'TeacherPassword123',
      role: ROLES.TEACHER,
      isActive: true,
    });
    const teacher1Login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'teacher1@msec.ac.in', password: 'TeacherPassword123' });
    teacher1Token = teacher1Login.body.data.tokens.accessToken;

    const teacherDoc1 = await Teacher.create({
      user: teacherUser1._id,
      employeeId: 'EMP-T1',
      firstName: 'Alan',
      lastName: 'Turing',
      email: 'teacher1@msec.ac.in',
      department: dept._id,
      designation: 'Professor',
      qualification: 'Ph.D',
      phone: '9876543210',
      status: 'Active',
    });

    const teacherUser2 = await User.create({
      email: 'teacher2@msec.ac.in',
      password: 'TeacherPassword123',
      role: ROLES.TEACHER,
      isActive: true,
    });
    const teacher2Login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'teacher2@msec.ac.in', password: 'TeacherPassword123' });
    teacher2Token = teacher2Login.body.data.tokens.accessToken;

    await Teacher.create({
      user: teacherUser2._id,
      employeeId: 'EMP-T2',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'teacher2@msec.ac.in',
      department: dept._id,
      designation: 'Assistant Professor',
      qualification: 'M.Tech',
      phone: '9876543211',
      status: 'Active',
    });

    // Assign Teacher 1 to Section A & Subject 1
    await TeacherAssignment.create({
      teacher: teacherDoc1._id,
      subject: subject1._id,
      section: sectionA._id,
      academicYear: academicYear._id,
      semester: 5,
      status: 'Active',
    });

    // 4. Students
    const studentUser1 = await User.create({
      email: 'student1@msec.ac.in',
      password: 'StudentPassword123',
      role: ROLES.STUDENT,
      isActive: true,
    });
    const student1Login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'student1@msec.ac.in', password: 'StudentPassword123' });
    student1Token = student1Login.body.data.tokens.accessToken;

    const studentDoc1 = await Student.create({
      user: studentUser1._id,
      usn: '1MS21CS001',
      rollNumber: 'CS001',
      firstName: 'John',
      lastName: 'Doe',
      department: dept._id,
      class: academicClass._id,
      section: sectionA._id,
      semester: 5,
      academicYear: academicYear._id,
      status: 'Active',
    });
    student1DocId = studentDoc1._id.toString();

    const studentUser2 = await User.create({
      email: 'student2@msec.ac.in',
      password: 'StudentPassword123',
      role: ROLES.STUDENT,
      isActive: true,
    });
    const student2Login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'student2@msec.ac.in', password: 'StudentPassword123' });
    student2Token = student2Login.body.data.tokens.accessToken;

    const studentDoc2 = await Student.create({
      user: studentUser2._id,
      usn: '1MS21CS002',
      rollNumber: 'CS002',
      firstName: 'Jane',
      lastName: 'Smith',
      department: dept._id,
      class: academicClass._id,
      section: sectionA._id,
      semester: 5,
      academicYear: academicYear._id,
      status: 'Active',
    });
    student2DocId = studentDoc2._id.toString();

    // 5. Parent linked only to Student 1
    const parentUser = await User.create({
      email: 'parent@msec.ac.in',
      password: 'ParentPassword123',
      role: ROLES.PARENT,
      isActive: true,
    });
    const parentLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'parent@msec.ac.in', password: 'ParentPassword123' });
    parentToken = parentLogin.body.data.tokens.accessToken;

    await Parent.create({
      user: parentUser._id,
      fatherName: 'Robert Doe',
      primaryPhone: '+919876543210',
      students: [studentDoc1._id],
    });

    // 6. Attendance Setup
    const session1 = await AttendanceSession.create({
      academicYear: academicYear._id,
      section: sectionA._id,
      subject: subject1._id,
      teacher: teacherDoc1._id,
      date: new Date('2026-09-01'),
      semester: 5,
      periodNumber: 1,
      sessionType: 'Regular',
      status: 'Completed',
    });

    const session2 = await AttendanceSession.create({
      academicYear: academicYear._id,
      section: sectionA._id,
      subject: subject1._id,
      teacher: teacherDoc1._id,
      date: new Date('2026-09-02'),
      semester: 5,
      periodNumber: 2,
      sessionType: 'Regular',
      status: 'Completed',
    });

    // Student 1: Present in both sessions (100%)
    await AttendanceRecord.create({
      session: session1._id,
      student: studentDoc1._id,
      status: 'Present',
      markedBy: teacherUser1._id,
      markedAt: new Date(),
    });
    await AttendanceRecord.create({
      session: session2._id,
      student: studentDoc1._id,
      status: 'Present',
      markedBy: teacherUser1._id,
      markedAt: new Date(),
    });

    // Student 2: Absent in both sessions (0% attendance)
    await AttendanceRecord.create({
      session: session1._id,
      student: studentDoc2._id,
      status: 'Absent',
      markedBy: teacherUser1._id,
      markedAt: new Date(),
    });
    await AttendanceRecord.create({
      session: session2._id,
      student: studentDoc2._id,
      status: 'Absent',
      markedBy: teacherUser1._id,
      markedAt: new Date(),
    });

    // 7. Assignment Setup
    const assignment1 = await Assignment.create({
      title: 'B-Tree Indexing Project',
      description: 'Implement B+ Tree indexing algorithm',
      academicYear: academicYear._id,
      semester: 5,
      section: sectionA._id,
      subject: subject1._id,
      teacher: teacherDoc1._id,
      assignmentType: 'homework',
      totalMarks: 50,
      passingMarks: 20,
      assignedDate: new Date('2026-09-01'),
      dueDate: new Date('2026-09-15'),
      allowLateSubmission: false,
      maxResubmissions: 2,
      status: 'published',
      createdBy: teacherUser1._id,
    });

    // Student 1 submitted and evaluated: 45 / 50 (90%)
    await AssignmentSubmission.create({
      assignment: assignment1._id,
      student: studentDoc1._id,
      submittedAt: new Date('2026-09-10'),
      submissionStatus: 'evaluated',
      evaluationStatus: 'evaluated',
      marksObtained: 45,
      feedback: 'Excellent implementation',
      attemptNumber: 1,
      isLate: false,
    });

    // Student 2 has no submissions (0% completion)

    // 8. Examinations & Results Setup (IA1, IA2, IA3)
    const examIA1 = await Examination.create({
      name: 'Internal Assessment 1',
      examinationCode: 'IA1-2026',
      examinationType: 'IA1',
      academicYear: academicYear._id,
      semester: 5,
      section: sectionA._id,
      subject: subject1._id,
      startDate: new Date('2026-09-20'),
      endDate: new Date('2026-09-20'),
      maximumMarks: 50,
      passingMarks: 20,
      duration: 90,
      status: 'published',
      createdBy: adminLogin.body.data.user.id,
    });

    const examIA2 = await Examination.create({
      name: 'Internal Assessment 2',
      examinationCode: 'IA2-2026',
      examinationType: 'IA2',
      academicYear: academicYear._id,
      semester: 5,
      section: sectionA._id,
      subject: subject1._id,
      startDate: new Date('2026-10-20'),
      endDate: new Date('2026-10-20'),
      maximumMarks: 50,
      passingMarks: 20,
      duration: 90,
      status: 'published',
      createdBy: adminLogin.body.data.user.id,
    });

    // Student 1: 40/50 (80%) in IA1, 45/50 (90%) in IA2 -> Improving trend!
    await ExaminationResult.create({
      examination: examIA1._id,
      student: studentDoc1._id,
      subject: subject1._id,
      academicYear: academicYear._id,
      semester: 5,
      marksObtained: 40,
      maximumMarks: 50,
      passingMarks: 20,
      percentage: 80,
      grade: 'A+',
      gradePoint: 9,
      isPassed: true,
      isAbsent: false,
      isExempted: false,
      evaluationStatus: 'published',
    });

    await ExaminationResult.create({
      examination: examIA2._id,
      student: studentDoc1._id,
      subject: subject1._id,
      academicYear: academicYear._id,
      semester: 5,
      marksObtained: 45,
      maximumMarks: 50,
      passingMarks: 20,
      percentage: 90,
      grade: 'O',
      gradePoint: 10,
      isPassed: true,
      isAbsent: false,
      isExempted: false,
      evaluationStatus: 'published',
    });

    // Student 2: 15/50 (30% - Failed) in IA1, 10/50 (20% - Failed) in IA2 -> Declining & High Risk!
    await ExaminationResult.create({
      examination: examIA1._id,
      student: studentDoc2._id,
      subject: subject1._id,
      academicYear: academicYear._id,
      semester: 5,
      marksObtained: 15,
      maximumMarks: 50,
      passingMarks: 20,
      percentage: 30,
      grade: 'F',
      gradePoint: 0,
      isPassed: false,
      isAbsent: false,
      isExempted: false,
      evaluationStatus: 'published',
    });

    await ExaminationResult.create({
      examination: examIA2._id,
      student: studentDoc2._id,
      subject: subject1._id,
      academicYear: academicYear._id,
      semester: 5,
      marksObtained: 10,
      maximumMarks: 50,
      passingMarks: 20,
      percentage: 20,
      grade: 'F',
      gradePoint: 0,
      isPassed: false,
      isAbsent: false,
      isExempted: false,
      evaluationStatus: 'published',
    });
  });

  // ==========================================
  // MODULE 1, 4, 5, 6: STUDENT PROGRESS ENGINE
  // ==========================================

  describe('Module 1, 2, 4 & 5: Student Progress Profile, Improvement & Declining Detection', () => {
    it('1, 4, 5 & 6. should calculate student progress integrating attendance, assignments, and exams', async () => {
      const res = await request(app)
        .get(`/api/v1/progress/students/${student1DocId}`)
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('attendancePercentage', 100);
      expect(res.body.data).toHaveProperty('assignmentCompletionRate', 100);
      expect(res.body.data).toHaveProperty('assignmentAverageMarks', 90);
      expect(res.body.data).toHaveProperty('iaMarks', 85); // (80 + 90) / 2 = 85%
      expect(res.body.data.overallAcademicPercentage).toBeGreaterThanOrEqual(80);
    });

    it('2. should retrieve subject-wise progress breakdown', async () => {
      const res = await request(app)
        .get(`/api/v1/progress/students/${student1DocId}/subjects`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      const sub1 = res.body.data.find((s: any) => s.subjectCode === '21CS51');
      expect(sub1).toBeDefined();
      expect(sub1.attendancePercentage).toBe(100);
      expect(sub1.assignmentCompletionRate).toBe(100);
      expect(sub1.iaMarks).toBe(85);
    });

    it('7. should detect consistent improvement trend for progressing student', async () => {
      const res = await request(app)
        .get(`/api/v1/progress/students/${student1DocId}`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.progressTrend).toBe('improving');
    });

    it('8. should detect declining performance trend for student with dropping marks', async () => {
      const res = await request(app)
        .get(`/api/v1/progress/students/${student2DocId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.progressTrend).toBe('declining');
    });

    it('11. should handle missing or unassigned marks without treating them as zero', async () => {
      // Subject 2 has zero exams taken for Student 1
      const res = await request(app)
        .get(`/api/v1/progress/students/${student1DocId}/subjects`)
        .set('Authorization', `Bearer ${adminToken}`);

      const sub2 = res.body.data.find((s: any) => s.subjectId === subject2Id);
      expect(sub2).toBeDefined();
      expect(sub2.iaMarks).toBe(0);
      expect(sub2.examinationMarks).toBe(0);
      // Overall percentage should not crash or produce NaN
      expect(typeof sub2.overallAcademicPercentage).toBe('number');
      expect(isNaN(sub2.overallAcademicPercentage)).toBe(false);
    });
  });

  // ==========================================
  // MODULE 3: AT-RISK STUDENT DETECTION & CONFIGURABLE RULES
  // ==========================================

  describe('Module 3: At-Risk Student Detection & Configurable Rules', () => {
    it('9. should classify student 2 as high/medium risk with explainable indicators', async () => {
      const res = await request(app)
        .get(`/api/v1/progress/at-risk/${student2DocId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(['medium', 'high']).toContain(res.body.data.riskLevel);
      expect(res.body.data.riskScore).toBeGreaterThanOrEqual(30);
      expect(res.body.data.indicators.length).toBeGreaterThanOrEqual(2);

      // Check specific indicators
      const codes = res.body.data.indicators.map((i: any) => i.code);
      expect(codes).toContain('LOW_ATTENDANCE');
      expect(codes).toContain('MISSING_ASSIGNMENTS');
      expect(codes).toContain('POOR_IA_PERFORMANCE');
    });

    it('10. should allow administrator to configure custom risk rules and alter scoring dynamically', async () => {
      // Relax attendance threshold to 40%
      const ruleRes = await request(app)
        .post('/api/v1/progress/risk-rules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Lenient Attendance Policy Rule',
          isDefault: true,
          attendanceThreshold: 40,
          assignmentCompletionThreshold: 40,
          iaPassPercentageThreshold: 35,
          examPassPercentageThreshold: 35,
          riskWeights: {
            attendance: 20,
            assignments: 20,
            internalAssessments: 30,
            examinations: 30,
          },
          riskScoreTiers: {
            high: 70,
            medium: 35,
            low: 0,
          },
        });

      expect(ruleRes.status).toBe(201);
      expect(ruleRes.body.success).toBe(true);
      expect(ruleRes.body.data.name).toBe('Lenient Attendance Policy Rule');

      // Verify active rule
      const activeRes = await request(app)
        .get('/api/v1/progress/risk-rules')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(activeRes.status).toBe(200);
      expect(activeRes.body.data.name).toBe('Lenient Attendance Policy Rule');
      expect(activeRes.body.data.attendanceThreshold).toBe(40);
    });

    it('should retrieve list of at-risk students with pagination', async () => {
      const res = await request(app)
        .get('/api/v1/progress/at-risk')
        .query({ sectionId: sectionAId })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total).toBeGreaterThanOrEqual(1);
      const student2Item = res.body.data.students.find((s: any) => s.usn === '1MS21CS002');
      expect(student2Item).toBeDefined();
    });
  });

  // ==========================================
  // MODULE 5, 6 & 7: CLASS, SUBJECT & TEACHER ANALYTICS
  // ==========================================

  describe('Module 5, 6 & 7: Class & Subject Analytics and Teacher Insights', () => {
    it('12. should calculate class analytics overview, performance, attendance, and assignments', async () => {
      const overviewRes = await request(app)
        .get('/api/v1/analytics/class/overview')
        .query({ section: sectionAId, academicYear: yearId, semester: 5 })
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(overviewRes.status).toBe(200);
      expect(overviewRes.body.data.totalStudents).toBe(2);
      expect(overviewRes.body.data.attendanceAverage).toBe(50); // (100% + 0%) / 2 = 50%
      expect(overviewRes.body.data.assignmentCompletionRate).toBe(50); // (1/2) = 50%
      expect(overviewRes.body.data.examinationPassRate).toBe(50); // (2 passes out of 4 results) = 50%

      const perfRes = await request(app)
        .get('/api/v1/analytics/class/performance')
        .query({ section: sectionAId })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(perfRes.status).toBe(200);
      expect(perfRes.body.data.topPerformers.length).toBeGreaterThanOrEqual(1);
      expect(perfRes.body.data.topPerformers[0].usn).toBe('1MS21CS001');
      expect(perfRes.body.data.studentsRequiringAttention.some((s: any) => s.usn === '1MS21CS002')).toBe(true);
    });

    it('13. should calculate subject analytics and data-backed difficulty indicator', async () => {
      const subjectRes = await request(app)
        .get('/api/v1/analytics/subject/overview')
        .query({ subject: subject1Id, academicYear: yearId })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(subjectRes.status).toBe(200);
      expect(subjectRes.body.data.subjectCode).toBe('21CS51');
      expect(subjectRes.body.data.passPercentage).toBe(50);
      expect(subjectRes.body.data.failPercentage).toBe(50);
      // Sample size < 5 -> Insufficient Data indicator
      expect(subjectRes.body.data.difficultyIndicator.level).toBe('Insufficient Data');

      const compareRes = await request(app)
        .get('/api/v1/analytics/subject/comparison')
        .query({ subject: subject1Id })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(compareRes.status).toBe(200);
      expect(compareRes.body.data.sectionComparisons.length).toBeGreaterThanOrEqual(1);
    });

    it('14. should allow assigned teacher to view insights and reject unassigned teacher', async () => {
      // Teacher 1 is assigned to Section A
      const allowedRes = await request(app)
        .get('/api/v1/analytics/teacher/overview')
        .query({ section: sectionAId })
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(allowedRes.status).toBe(200);
      expect(allowedRes.body.data.assignedClasses.length).toBe(1);

      // Teacher 2 is unassigned to Section A
      const rejectedRes = await request(app)
        .get('/api/v1/analytics/teacher/overview')
        .query({ section: sectionAId })
        .set('Authorization', `Bearer ${teacher2Token}`);

      expect(rejectedRes.status).toBe(403);
      expect(rejectedRes.body.message).toContain('not authorized');
    });
  });

  // ==========================================
  // MODULE 10: RBAC & ACCESS RESTRICTIONS
  // ==========================================

  describe('Module 10: Security, RBAC & Access Restrictions', () => {
    it('15. should allow Student 1 to view their own progress and reject viewing Student 2', async () => {
      // Student 1 views own
      const ownRes = await request(app)
        .get(`/api/v1/progress/students/${student1DocId}`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(ownRes.status).toBe(200);

      // Student 2 views own
      const s2Res = await request(app)
        .get(`/api/v1/progress/students/${student2DocId}`)
        .set('Authorization', `Bearer ${student2Token}`);

      expect(s2Res.status).toBe(200);

      // Student 1 views Student 2
      const otherRes = await request(app)
        .get(`/api/v1/progress/students/${student2DocId}`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(otherRes.status).toBe(403);
      expect(otherRes.body.message).toContain('only view their own progress');
    });

    it('16. should allow linked parent to view child progress and reject unlinked student', async () => {
      // Parent views linked Student 1
      const linkedRes = await request(app)
        .get(`/api/v1/progress/students/${student1DocId}`)
        .set('Authorization', `Bearer ${parentToken}`);

      expect(linkedRes.status).toBe(200);
      expect(linkedRes.body.data.student.usn).toBe('1MS21CS001');

      // Parent views unlinked Student 2
      const unlinkedRes = await request(app)
        .get(`/api/v1/progress/students/${student2DocId}`)
        .set('Authorization', `Bearer ${parentToken}`);

      expect(unlinkedRes.status).toBe(403);
      expect(unlinkedRes.body.message).toContain('linked children');
    });
  });

  // ==========================================
  // MODULE 8: PROGRESS REPORT GENERATION & SNAPSHOTS
  // ==========================================

  describe('Module 8: Progress Report Generation & Snapshot Preservation', () => {
    it('17. should generate structured student report and support CSV export', async () => {
      // JSON report
      const jsonRes = await request(app)
        .get(`/api/v1/reports/students/${student1DocId}/progress`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(jsonRes.status).toBe(200);
      expect(jsonRes.body.success).toBe(true);
      expect(jsonRes.body.data.student.usn).toBe('1MS21CS001');
      expect(jsonRes.body.data.academicSummary.overallAcademicPercentage).toBeGreaterThanOrEqual(80);

      // CSV export
      const csvRes = await request(app)
        .get(`/api/v1/reports/students/${student1DocId}/progress`)
        .query({ format: 'csv' })
        .set('Authorization', `Bearer ${student1Token}`);

      expect(csvRes.status).toBe(200);
      expect(csvRes.header['content-type']).toContain('text/csv');
      expect(csvRes.text).toContain('Subject Code');
      expect(csvRes.text).toContain('21CS51');
    });

    it('18. should preserve historical snapshot upon report generation and retrieval in history', async () => {
      // Generate explicit report snapshot
      const genRes = await request(app)
        .post(`/api/v1/reports/students/${student1DocId}/generate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          semester: 5,
          notes: 'Midterm progress review snapshot',
          saveSnapshot: true,
        });

      expect(genRes.status).toBe(200);

      // Query student progress history
      const histRes = await request(app)
        .get(`/api/v1/progress/students/${student1DocId}/history`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(histRes.status).toBe(200);
      expect(histRes.body.data.snapshots.length).toBeGreaterThanOrEqual(1);
      expect(histRes.body.data.snapshots[0].notes).toBe('Midterm progress review snapshot');
      expect(histRes.body.data.snapshots[0].isSnapshot).toBe(true);
    });

    it('should generate class-level report for section A', async () => {
      const classRepRes = await request(app)
        .get(`/api/v1/reports/class/${sectionAId}`)
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(classRepRes.status).toBe(200);
      expect(classRepRes.body.data.section.name).toBe('A');
      expect(classRepRes.body.data.classOverview.totalStudents).toBe(2);
    });
  });
});
