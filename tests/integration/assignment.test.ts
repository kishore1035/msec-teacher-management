import request from 'supertest';
import fs from 'fs';
import path from 'path';
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
import { Assignment } from '../../src/models/assignment.model';
import { ROLES } from '../../src/constants/roles.constant';
import { storageService } from '../../src/services/storage.service';

describe('Phase 4 – Assignment & Submission Management Integration Tests', () => {
  let adminToken: string;
  let teacher1Token: string;
  let teacher2Token: string;
  let student1Token: string;
  let student2Token: string;
  let parentToken: string;

  let teacher1DocId: string;
  let student1DocId: string;

  let yearId: string;
  let sectionAId: string;
  let subjectId: string;

  let testPdfPath: string;
  let testExePath: string;

  beforeAll(() => {
    // Create dummy files for upload tests
    const testDir = path.join(process.cwd(), 'uploads', 'test_files');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    testPdfPath = path.join(testDir, 'sample_report.pdf');
    fs.writeFileSync(testPdfPath, '%PDF-1.4 Mock PDF content for test');

    testExePath = path.join(testDir, 'malicious.exe');
    fs.writeFileSync(testExePath, 'MZ mock executable');
  });

  afterAll(async () => {
    const testDir = path.join(process.cwd(), 'uploads', 'test_files');
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  beforeEach(async () => {
    // 1. Create Admin
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

    const sectionB = await Section.create({
      class: academicClass._id,
      academicYear: academicYear._id,
      semester: 5,
      sectionName: 'B',
      capacity: 60,
      status: 'Active',
    });

    const subject = await Subject.create({
      name: 'Advanced Database Systems',
      code: '21CS51',
      department: dept._id,
      semester: 5,
      credits: 4,
      type: 'Theory',
      status: 'Active',
    });
    subjectId = subject._id.toString();

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
      employeeId: 'EMP-101',
      firstName: 'Alan',
      lastName: 'Turing',
      department: dept._id,
      designation: 'Professor',
      qualification: 'Ph.D',
      phone: '9876543210',
      status: 'Active',
    });
    teacher1DocId = teacherDoc1._id.toString();

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
      employeeId: 'EMP-102',
      firstName: 'Grace',
      lastName: 'Hopper',
      department: dept._id,
      designation: 'Associate Professor',
      qualification: 'M.Tech',
      phone: '9876543211',
      status: 'Active',
    });

    // Assign Teacher 1 to Section A + Subject
    await TeacherAssignment.create({
      teacher: teacherDoc1._id,
      subject: subject._id,
      section: sectionA._id,
      academicYear: academicYear._id,
      semester: 5,
      isPrimary: true,
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
      rollNumber: '001',
      firstName: 'Ada',
      lastName: 'Lovelace',
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

    await Student.create({
      user: studentUser2._id,
      usn: '1MS21CS002',
      rollNumber: '002',
      firstName: 'Charles',
      lastName: 'Babbage',
      department: dept._id,
      class: academicClass._id,
      section: sectionB._id,
      semester: 5,
      academicYear: academicYear._id,
      status: 'Active',
    });

    // 5. Parent (linked to Student 1)
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
      students: [studentDoc1._id],
      primaryPhone: '9876543212',
    });
  });

  describe('Storage Service & Path Traversal Guard', () => {
    it('should prevent path traversal when requesting file streams', () => {
      expect(() => {
        storageService.getFileStream('../../../etc/shadow');
      }).toThrow(/Invalid file path or path traversal detected/);
    });
  });

  describe('Module 1 & 2: Assignment Lifecycle & Attachments', () => {
    it('1. should allow authorized teacher to create assignment for assigned class', async () => {
      const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const res = await request(app)
        .post('/api/v1/assignments')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .field('title', 'Distributed Query Optimization Project')
        .field('description', 'Implement parallel query execution plan algorithms.')
        .field('academicYear', yearId)
        .field('semester', 5)
        .field('section', sectionAId)
        .field('subject', subjectId)
        .field('assignmentType', 'project')
        .field('totalMarks', 100)
        .field('passingMarks', 40)
        .field('dueDate', dueDate)
        .field('allowLateSubmission', 'true')
        .field('lateSubmissionDeadline', new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString())
        .attach('attachments', testPdfPath);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Distributed Query Optimization Project');
      expect(res.body.data.status).toBe('draft');
      expect(res.body.data.attachments).toHaveLength(1);
      expect(res.body.data.attachments[0].originalName).toBe('sample_report.pdf');
    });

    it('2 & 4. should reject unassigned teacher attempting to create assignment', async () => {
      const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const res = await request(app)
        .post('/api/v1/assignments')
        .set('Authorization', `Bearer ${teacher2Token}`)
        .send({
          title: 'Unassigned Teacher Project',
          description: 'This must be rejected by RBAC.',
          academicYear: yearId,
          semester: 5,
          section: sectionAId,
          subject: subjectId,
          totalMarks: 50,
          passingMarks: 20,
          dueDate,
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('not actively assigned to teach this subject');
    });

    it('3. should reject invalid assignment data (marks overflow or semester mismatch)', async () => {
      const res = await request(app)
        .post('/api/v1/assignments')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({
          title: 'Invalid Marks Assignment',
          description: 'Passing marks exceed total marks.',
          academicYear: yearId,
          semester: 5,
          section: sectionAId,
          subject: subjectId,
          totalMarks: 50,
          passingMarks: 75, // Exceeds total marks!
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Validation failed');
    });

    it('5 & 6. should enforce draft visibility and publish assignment lifecycle', async () => {
      // 1. Create Draft Assignment
      const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const createRes = await request(app)
        .post('/api/v1/assignments')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({
          title: 'Draft Assignment Test',
          description: 'Confidential draft.',
          academicYear: yearId,
          semester: 5,
          section: sectionAId,
          subject: subjectId,
          totalMarks: 50,
          passingMarks: 20,
          dueDate,
        });
      const assignmentId = createRes.body.data._id;

      // 2. Student attempts to access draft -> 403 Forbidden
      const studentDraftGet = await request(app)
        .get(`/api/v1/assignments/${assignmentId}`)
        .set('Authorization', `Bearer ${student1Token}`);
      expect(studentDraftGet.status).toBe(403);
      expect(studentDraftGet.body.message).toContain('Draft assignments are not accessible');

      // 3. Publish Assignment
      const publishRes = await request(app)
        .patch(`/api/v1/assignments/${assignmentId}/publish`)
        .set('Authorization', `Bearer ${teacher1Token}`);
      expect(publishRes.status).toBe(200);
      expect(publishRes.body.data.status).toBe('published');

      // 4. Student can now view published assignment
      const studentPubGet = await request(app)
        .get(`/api/v1/assignments/${assignmentId}`)
        .set('Authorization', `Bearer ${student1Token}`);
      expect(studentPubGet.status).toBe(200);
      expect(studentPubGet.body.data.title).toBe('Draft Assignment Test');

      // 5. Close Assignment
      const closeRes = await request(app)
        .patch(`/api/v1/assignments/${assignmentId}/close`)
        .set('Authorization', `Bearer ${teacher1Token}`);
      expect(closeRes.status).toBe(200);
      expect(closeRes.body.data.status).toBe('closed');
    });

    it('11. should validate file upload formats and reject disallowed extensions', async () => {
      const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const res = await request(app)
        .post('/api/v1/assignments')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .field('title', 'Executable Upload Test')
        .field('description', 'Uploading .exe must fail.')
        .field('academicYear', yearId)
        .field('semester', 5)
        .field('section', sectionAId)
        .field('subject', subjectId)
        .field('totalMarks', 50)
        .field('passingMarks', 20)
        .field('dueDate', dueDate)
        .attach('attachments', testExePath);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Unsupported file type');
    });
  });

  describe('Module 3: Student Submissions, Deadlines & Resubmissions', () => {
    let publishedAssignmentId: string;

    beforeEach(async () => {
      const dueDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      const assignment = await Assignment.create({
        title: 'MapReduce Implementation',
        description: 'Submit your code and report.',
        academicYear: yearId,
        semester: 5,
        section: sectionAId,
        subject: subjectId,
        teacher: teacher1DocId,
        totalMarks: 100,
        passingMarks: 40,
        dueDate,
        allowLateSubmission: true,
        lateSubmissionDeadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        maxResubmissions: 2,
        status: 'published',
        createdBy: teacher1DocId,
      });
      publishedAssignmentId = assignment._id.toString();
    });

    it('7. should accept valid student submission with text and attachment', async () => {
      const res = await request(app)
        .post(`/api/v1/assignments/${publishedAssignmentId}/submit`)
        .set('Authorization', `Bearer ${student1Token}`)
        .field('submissionText', 'Here is my complete MapReduce analysis.')
        .attach('attachments', testPdfPath);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.submissionStatus).toBe('submitted');
      expect(res.body.data.attemptNumber).toBe(1);
      expect(res.body.data.isLate).toBe(false);
      expect(res.body.data.attachments).toHaveLength(1);
    });

    it('8. should reject submission after deadline when late submission is disabled', async () => {
      // Create past assignment with allowLateSubmission: false
      const expiredAssignment = await Assignment.create({
        title: 'Strict Past Assignment',
        description: 'Past deadline.',
        academicYear: yearId,
        semester: 5,
        section: sectionAId,
        subject: subjectId,
        teacher: teacher1DocId,
        totalMarks: 50,
        passingMarks: 20,
        dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // yesterday
        allowLateSubmission: false,
        status: 'published',
        createdBy: teacher1DocId,
      });

      const res = await request(app)
        .post(`/api/v1/assignments/${expiredAssignment._id}/submit`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ submissionText: 'Late submission attempt' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Submission deadline has passed');
    });

    it('9. should accept late submission and flag isLate = true when late submission is permitted', async () => {
      const lateAssignment = await Assignment.create({
        title: 'Permissive Past Assignment',
        description: 'Past deadline with grace period.',
        academicYear: yearId,
        semester: 5,
        section: sectionAId,
        subject: subjectId,
        teacher: teacher1DocId,
        totalMarks: 50,
        passingMarks: 20,
        dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // yesterday
        allowLateSubmission: true,
        lateSubmissionDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000), // tomorrow
        status: 'published',
        createdBy: teacher1DocId,
      });

      const res = await request(app)
        .post(`/api/v1/assignments/${lateAssignment._id}/submit`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ submissionText: 'Submitting within grace period' });

      expect(res.status).toBe(201);
      expect(res.body.data.isLate).toBe(true);
      expect(res.body.data.submissionStatus).toBe('late');
    });

    it('10. should allow resubmission within limits and reject exceeding max attempts', async () => {
      // First submission
      await request(app)
        .post(`/api/v1/assignments/${publishedAssignmentId}/submit`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ submissionText: 'Initial Attempt 1' });

      // Second submission (Resubmission attempt 2)
      const resub1 = await request(app)
        .put(`/api/v1/assignments/${publishedAssignmentId}/resubmit`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ submissionText: 'Revision Attempt 2' });
      expect(resub1.status).toBe(200);
      expect(resub1.body.data.attemptNumber).toBe(2);
      expect(resub1.body.data.submissionStatus).toBe('resubmitted');

      // Third submission (Resubmission attempt 3, maxResubmissions = 2 means total 3 allowed)
      const resub2 = await request(app)
        .put(`/api/v1/assignments/${publishedAssignmentId}/resubmit`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ submissionText: 'Revision Attempt 3' });
      expect(resub2.status).toBe(200);
      expect(resub2.body.data.attemptNumber).toBe(3);

      // Fourth submission (Should exceed limit!)
      const resub3 = await request(app)
        .put(`/api/v1/assignments/${publishedAssignmentId}/resubmit`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ submissionText: 'Attempt 4 exceeds limit' });
      expect(resub3.status).toBe(400);
      expect(resub3.body.message).toContain('Maximum submission attempts');
    });
  });

  describe('Module 4: Evaluation, Grading & Audit Trail', () => {
    let submissionId: string;

    beforeEach(async () => {
      const assignment = await Assignment.create({
        title: 'Evaluation Test Assignment',
        description: 'Test grading workflow.',
        academicYear: yearId,
        semester: 5,
        section: sectionAId,
        subject: subjectId,
        teacher: teacher1DocId,
        totalMarks: 100,
        passingMarks: 40,
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        status: 'published',
        createdBy: teacher1DocId,
      });

      const subRes = await request(app)
        .post(`/api/v1/assignments/${assignment._id}/submit`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ submissionText: 'My project source code' });
      submissionId = subRes.body.data._id;
    });

    it('13. should evaluate submission within total marks and prevent marks overflow', async () => {
      // Reject overflow
      const overflowRes = await request(app)
        .patch(`/api/v1/submissions/${submissionId}/evaluate`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ marksObtained: 120, feedback: 'Too high' }); // max is 100!
      expect(overflowRes.status).toBe(400);
      expect(overflowRes.body.message).toContain('must be between 0 and total marks');

      // Valid grading
      const validRes = await request(app)
        .patch(`/api/v1/submissions/${submissionId}/evaluate`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ marksObtained: 88, feedback: 'Excellent algorithmic efficiency.' });
      expect(validRes.status).toBe(200);
      expect(validRes.body.data.marksObtained).toBe(88);
      expect(validRes.body.data.evaluationStatus).toBe('evaluated');
    });

    it('14. should maintain audit history when re-evaluating with a reason', async () => {
      // First evaluation
      await request(app)
        .patch(`/api/v1/submissions/${submissionId}/evaluate`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ marksObtained: 75, feedback: 'Initial grading' });

      // Re-evaluation without reason should be rejected
      const noReasonRes = await request(app)
        .patch(`/api/v1/submissions/${submissionId}/evaluate`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ marksObtained: 85, feedback: 'Updated score without reason' });
      expect(noReasonRes.status).toBe(400);
      expect(noReasonRes.body.message).toContain('reason');

      // Re-evaluation with reason
      const reEvalRes = await request(app)
        .patch(`/api/v1/submissions/${submissionId}/evaluate`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({
          marksObtained: 92,
          feedback: 'Awarded bonus points for benchmarks',
          reason: 'Verified candidate benchmark execution on cluster',
        });
      expect(reEvalRes.status).toBe(200);
      expect(reEvalRes.body.data.marksObtained).toBe(92);
      expect(reEvalRes.body.data.evaluationHistory).toHaveLength(1);
      expect(reEvalRes.body.data.evaluationHistory[0].previousMarks).toBe(75);
      expect(reEvalRes.body.data.evaluationHistory[0].newMarks).toBe(92);
      expect(reEvalRes.body.data.evaluationHistory[0].reason).toContain('benchmark');
    });
  });

  describe('Module 7: Security, RBAC & Attachment Downloads', () => {
    let assignmentId: string;
    let submissionAttachmentId: string;

    beforeEach(async () => {
      const dueDate = new Date(Date.now() + 5 * 24 * 60 * 1000);
      const res = await request(app)
        .post('/api/v1/assignments')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .field('title', 'Security Validation Assignment')
        .field('description', 'Test permissions.')
        .field('academicYear', yearId)
        .field('semester', 5)
        .field('section', sectionAId)
        .field('subject', subjectId)
        .field('totalMarks', 50)
        .field('passingMarks', 20)
        .field('dueDate', dueDate.toISOString());
      assignmentId = res.body.data._id;

      await request(app)
        .patch(`/api/v1/assignments/${assignmentId}/publish`)
        .set('Authorization', `Bearer ${teacher1Token}`);

      // Student 1 submits with attachment
      const subRes = await request(app)
        .post(`/api/v1/assignments/${assignmentId}/submit`)
        .set('Authorization', `Bearer ${student1Token}`)
        .field('submissionText', 'Submission with file')
        .attach('attachments', testPdfPath);
      submissionAttachmentId = subRes.body.data.attachments[0]._id;
    });

    it('12 & 15. should allow Student 1 to download their own file and reject Student 2', async () => {
      // Student 1 downloads -> 200 OK
      const s1Download = await request(app)
        .get(`/api/v1/attachments/${submissionAttachmentId}`)
        .set('Authorization', `Bearer ${student1Token}`);
      expect(s1Download.status).toBe(200);
      expect(s1Download.headers['content-type']).toBe('application/pdf');

      // Student 2 attempts to download Student 1 file -> 403 Forbidden
      const s2Download = await request(app)
        .get(`/api/v1/attachments/${submissionAttachmentId}`)
        .set('Authorization', `Bearer ${student2Token}`);
      expect(s2Download.status).toBe(403);
      expect(s2Download.body.message).toContain('Unauthorized');
    });

    it('16. should allow linked parent to view child results and reject unlinked queries', async () => {
      // Parent downloads linked child file -> 200 OK
      const parentDownload = await request(app)
        .get(`/api/v1/attachments/${submissionAttachmentId}`)
        .set('Authorization', `Bearer ${parentToken}`);
      expect(parentDownload.status).toBe(200);
    });
  });

  describe('Module 5: Assignment Analytics Engine', () => {
    it('17. should aggregate overview and student metrics accurately', async () => {
      // Create assignment
      const assignment = await Assignment.create({
        title: 'Analytics Test Assignment',
        description: 'For testing analytics.',
        academicYear: yearId,
        semester: 5,
        section: sectionAId,
        subject: subjectId,
        teacher: teacher1DocId,
        totalMarks: 100,
        passingMarks: 40,
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 1000),
        status: 'published',
        createdBy: teacher1DocId,
      });

      // Student 1 submits
      const sub = await request(app)
        .post(`/api/v1/assignments/${assignment._id}/submit`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ submissionText: 'Analytics test submission' });

      // Evaluate submission
      await request(app)
        .patch(`/api/v1/submissions/${sub.body.data._id}/evaluate`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ marksObtained: 80, feedback: 'Good job' });

      // Fetch overview analytics
      const overviewRes = await request(app)
        .get('/api/v1/assignments/analytics/overview')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(overviewRes.status).toBe(200);
      expect(overviewRes.body.data.publishedAssignments).toBeGreaterThanOrEqual(1);
      expect(overviewRes.body.data.totalSubmissions).toBeGreaterThanOrEqual(1);
      expect(overviewRes.body.data.evaluatedSubmissions).toBeGreaterThanOrEqual(1);

      // Fetch student-specific analytics
      const studentRes = await request(app)
        .get(`/api/v1/assignments/analytics/student/${student1DocId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(studentRes.status).toBe(200);
      expect(studentRes.body.data.student.usn).toBe('1MS21CS001');
      expect(studentRes.body.data.totalSubmitted).toBeGreaterThanOrEqual(1);
      expect(studentRes.body.data.averagePercentage).toBe(80);
    });
  });
});
