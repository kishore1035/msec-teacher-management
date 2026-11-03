import request from 'supertest';
import { app } from '../../src/app';
import {
  User,
  Department,
  Class,
  AcademicYear,
  Section,
  Subject,
  Teacher,
  TeacherAssignment,
  Student,
  Parent,
  AttendancePolicy,
  AttendanceSession,
  AttendanceRecord,
  Assignment,
  AssignmentSubmission,
  Examination,
  ExaminationResult,
  Timetable,
  TimetableEntry,
  Announcement,
  Notification,
  Doubt,
} from '../../src/models';
import { ROLES } from '../../src/constants/roles.constant';
import { ParentService } from '../../src/services/parent.service';
import { NotificationDeliveryService } from '../../src/services/notificationDelivery.service';

describe('Phase 10: Doubt Management & Parent Communication Integration Tests', () => {
  let adminToken: string;
  let teacher1Token: string;
  let teacher1UserId: string;
  let teacher1DocId: string;
  let teacher2UserId: string;
  let teacher2DocId: string;
  let teacher3Token: string; // Unauthorized teacher from another section/subject
  let teacher3DocId: string;

  let student1Token: string;
  let student1UserId: string;
  let student1DocId: string;
  let student2Token: string;
  let student2DocId: string;

  let parent1Token: string;
  let parent1UserId: string;
  let parent1DocId: string;
  let parent2Token: string;
  let parent2UserId: string;

  let academicYearId: string;
  let dept1Id: string;
  let class1Id: string;
  let sectionAId: string;
  let subjectDbmsId: string;
  let subjectOsId: string;

  beforeEach(async () => {
    NotificationDeliveryService.resetProviders();

    // 1. Create Admin
    await User.create({
      email: 'admin@msec.ac.in',
      password: 'Password123',
      role: ROLES.ADMIN,
      isActive: true,
    });
    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@msec.ac.in', password: 'Password123' });
    adminToken = adminLogin.body.data.tokens.accessToken;

    // 2. Academic Foundation
    const academicYear = await AcademicYear.create({
      year: '2026-2027',
      startDate: new Date('2026-08-01'),
      endDate: new Date('2027-05-31'),
      semesterType: 'ODD',
      isCurrent: true,
    });
    academicYearId = academicYear._id.toString();

    const dept1 = await Department.create({
      name: 'Computer Science & Engineering',
      code: 'CSE',
    });
    dept1Id = dept1._id.toString();

    const cls1 = await Class.create({
      name: 'B.E. CSE',
      code: 'BECSE',
      department: dept1._id,
      degree: 'B.E.',
      durationYears: 4,
    });
    class1Id = cls1._id.toString();

    const secA = await Section.create({
      class: cls1._id,
      academicYear: academicYear._id,
      semester: 5,
      sectionName: 'A',
      roomNumber: 'LHC-301',
      capacity: 60,
    });
    sectionAId = secA._id.toString();

    const secB = await Section.create({
      class: cls1._id,
      academicYear: academicYear._id,
      semester: 5,
      sectionName: 'B',
      roomNumber: 'LHC-302',
      capacity: 60,
    });

    const subDbms = await Subject.create({
      name: 'Database Management Systems',
      code: '21CS51',
      department: dept1._id,
      semester: 5,
      credits: 4,
      type: 'Theory',
    });
    subjectDbmsId = subDbms._id.toString();

    const subOs = await Subject.create({
      name: 'Operating Systems',
      code: '21CS52',
      department: dept1._id,
      semester: 5,
      credits: 4,
      type: 'Theory',
    });
    subjectOsId = subOs._id.toString();

    // 3. Teachers & Assignments
    const t1User = await User.create({
      email: 'teacher1@msec.ac.in',
      password: 'Password123',
      role: ROLES.TEACHER,
      isActive: true,
    });
    teacher1UserId = t1User._id.toString();
    const t1Doc = await Teacher.create({
      user: t1User._id,
      employeeId: 'MSEC-T101',
      firstName: 'Ananya',
      lastName: 'Sharma',
      department: dept1._id,
      designation: 'Associate Professor',
      qualification: 'Ph.D.',
      phone: '9876543210',
      status: 'Active',
    });
    teacher1DocId = t1Doc._id.toString();

    const t2User = await User.create({
      email: 'teacher2@msec.ac.in',
      password: 'Password123',
      role: ROLES.TEACHER,
      isActive: true,
    });
    teacher2UserId = t2User._id.toString();
    const t2Doc = await Teacher.create({
      user: t2User._id,
      employeeId: 'MSEC-T102',
      firstName: 'Ramesh',
      lastName: 'Iyer',
      department: dept1._id,
      designation: 'Assistant Professor',
      qualification: 'M.Tech',
      phone: '9876543211',
      status: 'Active',
    });
    teacher2DocId = t2Doc._id.toString();

    const t3User = await User.create({
      email: 'teacher3@msec.ac.in',
      password: 'Password123',
      role: ROLES.TEACHER,
      isActive: true,
    });
    const t3Doc = await Teacher.create({
      user: t3User._id,
      employeeId: 'MSEC-T103',
      firstName: 'Kavitha',
      lastName: 'Menon',
      department: dept1._id,
      designation: 'Assistant Professor',
      qualification: 'M.Tech',
      phone: '9876543212',
      status: 'Active',
    });
    teacher3DocId = t3Doc._id.toString();

    // Assign Teacher 1 -> DBMS in Section A
    await TeacherAssignment.create({
      teacher: t1Doc._id,
      subject: subDbms._id,
      section: secA._id,
      academicYear: academicYear._id,
      semester: 5,
      isPrimary: true,
      status: 'Active',
    });

    // Assign Teacher 2 -> OS in Section A
    await TeacherAssignment.create({
      teacher: t2Doc._id,
      subject: subOs._id,
      section: secA._id,
      academicYear: academicYear._id,
      semester: 5,
      isPrimary: true,
      status: 'Active',
    });

    // Assign Teacher 3 -> OS in Section B only
    await TeacherAssignment.create({
      teacher: t3Doc._id,
      subject: subOs._id,
      section: secB._id,
      academicYear: academicYear._id,
      semester: 5,
      isPrimary: true,
      status: 'Active',
    });

    const t1Login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'teacher1@msec.ac.in', password: 'Password123' });
    teacher1Token = t1Login.body.data.tokens.accessToken;

    const t3Login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'teacher3@msec.ac.in', password: 'Password123' });
    teacher3Token = t3Login.body.data.tokens.accessToken;

    // 4. Students & Parents
    const s1User = await User.create({
      email: 'student1@msec.ac.in',
      password: 'Password123',
      role: ROLES.STUDENT,
      isActive: true,
    });
    student1UserId = s1User._id.toString();
    const s1Doc = await Student.create({
      user: s1User._id,
      usn: '1MS24CS001',
      rollNumber: '01',
      firstName: 'Vikram',
      lastName: 'Aditya',
      department: dept1._id,
      class: cls1._id,
      section: secA._id,
      semester: 5,
      academicYear: academicYear._id,
      status: 'Active',
    });
    student1DocId = s1Doc._id.toString();

    const s2User = await User.create({
      email: 'student2@msec.ac.in',
      password: 'Password123',
      role: ROLES.STUDENT,
      isActive: true,
    });
    const s2Doc = await Student.create({
      user: s2User._id,
      usn: '1MS24CS002',
      rollNumber: '02',
      firstName: 'Meera',
      lastName: 'Krishnan',
      department: dept1._id,
      class: cls1._id,
      section: secA._id,
      semester: 5,
      academicYear: academicYear._id,
      status: 'Active',
    });
    student2DocId = s2Doc._id.toString();

    const p1User = await User.create({
      email: 'parent1@msec.ac.in',
      password: 'Password123',
      role: ROLES.PARENT,
      isActive: true,
    });
    parent1UserId = p1User._id.toString();
    const p1Doc = await Parent.create({
      user: p1User._id,
      fatherName: 'Suresh Aditya',
      relationshipType: 'father',
      primaryPhone: '9880011223',
      verificationStatus: 'verified',
      students: [s1Doc._id],
      childrenLinks: [
        {
          student: s1Doc._id,
          relationshipType: 'father',
          isPrimaryGuardian: true,
          verificationStatus: 'verified',
          linkedAt: new Date(),
        },
      ],
    });
    parent1DocId = p1Doc._id.toString();
    await Student.findByIdAndUpdate(s1Doc._id, {
      parent: p1Doc._id,
      $addToSet: { parents: p1Doc._id },
    });

    const p2User = await User.create({
      email: 'parent2@msec.ac.in',
      password: 'Password123',
      role: ROLES.PARENT,
      isActive: true,
    });
    parent2UserId = p2User._id.toString();
    const p2Doc = await Parent.create({
      user: p2User._id,
      motherName: 'Lakshmi Krishnan',
      relationshipType: 'mother',
      primaryPhone: '9880011224',
      verificationStatus: 'verified',
      students: [s2Doc._id],
      childrenLinks: [
        {
          student: s2Doc._id,
          relationshipType: 'mother',
          isPrimaryGuardian: true,
          verificationStatus: 'verified',
          linkedAt: new Date(),
        },
      ],
    });
    await Student.findByIdAndUpdate(s2Doc._id, {
      parent: p2Doc._id,
      $addToSet: { parents: p2Doc._id },
    });

    const s1Login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'student1@msec.ac.in', password: 'Password123' });
    student1Token = s1Login.body.data.tokens.accessToken;

    const s2Login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'student2@msec.ac.in', password: 'Password123' });
    student2Token = s2Login.body.data.tokens.accessToken;

    const p1Login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'parent1@msec.ac.in', password: 'Password123' });
    parent1Token = p1Login.body.data.tokens.accessToken;

    const p2Login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'parent2@msec.ac.in', password: 'Password123' });
    parent2Token = p2Login.body.data.tokens.accessToken;
  });

  // =========================================================================
  // 1–8. STUDENT DOUBT MANAGEMENT & CONVERSATION SYSTEM
  // =========================================================================
  describe('Module 1 & 2: Student Doubt Management & Conversation System', () => {
    it('1 & 2. should create a student doubt, automatically assign the subject teacher, and notify the teacher', async () => {
      const res = await request(app)
        .post('/api/v1/doubts')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({
          title: 'Confusion in B+ Tree Node Splitting during Insertion',
          description: 'When inserting into a full leaf node of order 4, how is the middle key promoted?',
          subject: subjectDbmsId,
          category: 'conceptual',
          priority: 'high',
          topic: 'B+ Tree Indexing',
          tags: ['indexing', 'b-plus-tree'],
          attachments: [
            {
              fileName: 'bplus-diagram.png',
              originalName: 'bplus-diagram.png',
              fileType: 'image/png',
              fileSize: 24500,
              filePath: 'uploads/doubts/bplus-diagram.png',
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.title).toContain('B+ Tree');
      expect(res.body.data.status).toBe('assigned');
      expect(res.body.data.assignedTeacher._id).toBe(teacher1DocId);
      expect(res.body.data.attachments).toHaveLength(1);

      // Verify teacher received a notification
      const teacherNotifs = await Notification.find({
        recipient: teacher1UserId,
        notificationType: 'doubt_update',
      });
      expect(teacherNotifs.length).toBeGreaterThanOrEqual(1);
    });

    it('3. should allow authorized teacher or admin to manually reassign a doubt to another teacher', async () => {
      const createRes = await request(app)
        .post('/api/v1/doubts')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({
          title: 'Buffer Pool Replacement Policy vs OS Page Cache',
          description: 'How does DBMS clock sweep interact with OS virtual memory paging?',
          subject: subjectDbmsId,
          category: 'conceptual',
        });

      const doubtId = createRes.body.data._id;

      // Reassign from Teacher 1 to Teacher 2 (OS specialist)
      const assignRes = await request(app)
        .patch(`/api/v1/doubts/${doubtId}/assign`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({
          assignedTeacher: teacher2DocId,
          reason: 'Cross-subject OS memory management question',
        });

      expect(assignRes.status).toBe(200);
      expect(assignRes.body.data.assignedTeacher._id).toBe(teacher2DocId);
      expect(assignRes.body.data.assignmentHistory).toHaveLength(2);

      // Verify Teacher 2 was notified
      const t2Notifs = await Notification.find({
        recipient: teacher2UserId,
        notificationType: 'doubt_update',
      });
      expect(t2Notifs.length).toBeGreaterThanOrEqual(1);
    });

    it('4 & 5. should support message exchange, notify students on teacher response, and strictly hide internal staff notes from students', async () => {
      const createRes = await request(app)
        .post('/api/v1/doubts')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({
          title: 'Two-Phase Locking Deadlock Prevention',
          description: 'Difference between Wait-Die and Wound-Wait timestamp schemes?',
          subject: subjectDbmsId,
          category: 'examination',
          priority: 'high',
        });
      const doubtId = createRes.body.data._id;

      // Teacher adds an internal staff note
      const internalNoteRes = await request(app)
        .post(`/api/v1/doubts/${doubtId}/messages`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({
          message: 'Internal note: Include this topic in next week remedial tutorial.',
          isInternalNote: true,
        });
      expect(internalNoteRes.status).toBe(201);
      expect(internalNoteRes.body.data.isInternalNote).toBe(true);

      // Student attempts to post an internal note -> 403 Forbidden
      const studentInternalAttempt = await request(app)
        .post(`/api/v1/doubts/${doubtId}/messages`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({
          message: 'Trying to spoof internal note',
          isInternalNote: true,
        });
      expect(studentInternalAttempt.status).toBe(403);

      // Teacher posts public explanation
      const teacherReplyRes = await request(app)
        .post(`/api/v1/doubts/${doubtId}/messages`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({
          message: 'In Wait-Die (non-preemptive), older transactions wait for younger ones. In Wound-Wait (preemptive), older transactions preempt younger ones.',
          isInternalNote: false,
        });
      expect(teacherReplyRes.status).toBe(201);

      // Check doubt status transitioned to answered and student was notified
      const updatedDoubt = await Doubt.findById(doubtId);
      expect(updatedDoubt?.status).toBe('answered');
      expect(updatedDoubt?.firstRespondedAt).toBeDefined();

      const studentNotifs = await Notification.find({
        recipient: student1UserId,
        notificationType: 'doubt_update',
      });
      expect(studentNotifs.length).toBeGreaterThanOrEqual(1);

      // Student fetches messages -> must ONLY see the public reply (1 message), NEVER the internal note!
      const studentMessagesRes = await request(app)
        .get(`/api/v1/doubts/${doubtId}/messages`)
        .set('Authorization', `Bearer ${student1Token}`);
      expect(studentMessagesRes.status).toBe(200);
      expect(studentMessagesRes.body.data).toHaveLength(1);
      expect(studentMessagesRes.body.data[0].isInternalNote).toBe(false);

      // Teacher fetches messages -> sees both internal note and public reply (2 messages)
      const teacherMessagesRes = await request(app)
        .get(`/api/v1/doubts/${doubtId}/messages`)
        .set('Authorization', `Bearer ${teacher1Token}`);
      expect(teacherMessagesRes.status).toBe(200);
      expect(teacherMessagesRes.body.data).toHaveLength(2);
    });

    it('6 & 7. should enforce student doubt isolation and prevent unauthorized teachers from accessing or managing doubts', async () => {
      const createRes = await request(app)
        .post('/api/v1/doubts')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({
          title: 'Normalization 3NF vs BCNF Dependency Preservation',
          description: 'Can you show a counterexample where BCNF is not dependency preserving?',
          subject: subjectDbmsId,
        });
      const doubtId = createRes.body.data._id;

      // Student 2 tries to view Student 1's doubt -> 403 Forbidden
      const student2View = await request(app)
        .get(`/api/v1/doubts/${doubtId}`)
        .set('Authorization', `Bearer ${student2Token}`);
      expect(student2View.status).toBe(403);

      // Student 2 lists doubts -> sees 0 doubts
      const student2List = await request(app)
        .get('/api/v1/doubts')
        .set('Authorization', `Bearer ${student2Token}`);
      expect(student2List.status).toBe(200);
      expect(student2List.body.data).toHaveLength(0);

      // Teacher 3 (assigned only to Section B) tries to view or reply to Section A doubt -> 403 Forbidden
      const teacher3View = await request(app)
        .get(`/api/v1/doubts/${doubtId}`)
        .set('Authorization', `Bearer ${teacher3Token}`);
      expect(teacher3View.status).toBe(403);

      const teacher3StatusAttempt = await request(app)
        .patch(`/api/v1/doubts/${doubtId}/status`)
        .set('Authorization', `Bearer ${teacher3Token}`)
        .send({ status: 'resolved' });
      expect(teacher3StatusAttempt.status).toBe(403);
    });

    it('8. should allow teachers to mark doubts resolved and allow students to reopen doubts within configurable rules', async () => {
      const createRes = await request(app)
        .post('/api/v1/doubts')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({
          title: 'SQL Correlated Subqueries Optimization',
          description: 'How are correlated subqueries rewritten into hash joins?',
          subject: subjectDbmsId,
        });
      const doubtId = createRes.body.data._id;

      // Teacher marks doubt as resolved
      const resolveRes = await request(app)
        .patch(`/api/v1/doubts/${doubtId}/status`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({
          status: 'resolved',
          reason: 'Explained query decorrelation in detail',
        });
      expect(resolveRes.status).toBe(200);
      expect(resolveRes.body.data.status).toBe('resolved');
      expect(resolveRes.body.data.resolvedAt).toBeDefined();

      // Student reopens the resolved doubt
      const reopenRes = await request(app)
        .patch(`/api/v1/doubts/${doubtId}/reopen`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({
          reason: 'Need clarification on NULL handling when decorrelating EXISTS vs NOT EXISTS',
        });
      expect(reopenRes.status).toBe(200);
      expect(reopenRes.body.data.status).toBe('in_progress');
      expect(reopenRes.body.data.reopenCount).toBe(1);
    });
  });

  // =========================================================================
  // 9. DOUBT MANAGEMENT ANALYTICS
  // =========================================================================
  describe('Module 3: Doubt Management Analytics', () => {
    it('9. should compute overview, subject-wise, and teacher workload analytics for administrators and block non-admins', async () => {
      // Create 2 doubts
      const d1 = await request(app)
        .post('/api/v1/doubts')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({
          title: 'ACID Isolation Levels Serializable vs Repeatable Read',
          description: 'Phantom read behavior in MVCC',
          subject: subjectDbmsId,
          topic: 'Transactions & Concurrency',
        });

      await request(app)
        .patch(`/api/v1/doubts/${d1.body.data._id}/status`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ status: 'resolved' });

      await request(app)
        .post('/api/v1/doubts')
        .set('Authorization', `Bearer ${student2Token}`)
        .send({
          title: 'Virtual Memory Page Fault Handling',
          description: 'Steps in handling major page fault in Linux kernel',
          subject: subjectOsId,
          topic: 'Virtual Memory',
        });

      // Overview Analytics
      const overviewRes = await request(app)
        .get('/api/v1/doubts/analytics/overview')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(overviewRes.status).toBe(200);
      expect(overviewRes.body.data.totalDoubts).toBe(2);
      expect(overviewRes.body.data.resolvedDoubts).toBe(1);
      expect(overviewRes.body.data.pendingDoubts).toBe(1);
      expect(Array.isArray(overviewRes.body.data.frequentlyRaisedTopics)).toBe(true);

      // Subject Analytics
      const subjRes = await request(app)
        .get('/api/v1/doubts/analytics/subjects')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(subjRes.status).toBe(200);
      expect(subjRes.body.data.length).toBeGreaterThanOrEqual(2);

      // Teacher Workload Analytics
      const teacherRes = await request(app)
        .get('/api/v1/doubts/analytics/teachers')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(teacherRes.status).toBe(200);
      expect(teacherRes.body.data.length).toBeGreaterThanOrEqual(2);
      expect(teacherRes.body.data[0]).toHaveProperty('assignedCount');
      expect(teacherRes.body.data[0]).toHaveProperty('activePendingCount');

      // Non-admin (Teacher/Student) blocked from institution analytics -> 403
      const teacherForbidden = await request(app)
        .get('/api/v1/doubts/analytics/overview')
        .set('Authorization', `Bearer ${teacher1Token}`);
      expect(teacherForbidden.status).toBe(403);
    });
  });

  // =========================================================================
  // 10–13. PARENT MANAGEMENT & RELATIONSHIP VERIFICATION
  // =========================================================================
  describe('Module 4: Parent Management & Relationship Security', () => {
    it('10, 11, 12. should support parent creation, multiple guardians per student, multiple children per parent, and relationship history preservation', async () => {
      // Create a second guardian (Mother) for Student 1 (who already has Father parent1)
      const createMotherRes = await request(app)
        .post('/api/v1/parents')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: 'savitha',
          lastName: 'Aditya',
          email: 'mother.aditya@msec.ac.in',
          password: 'Password123',
          motherName: 'Savitha Aditya',
          relationshipType: 'mother',
          primaryPhone: '9880099887',
          verificationStatus: 'verified',
          students: [student1DocId],
        });

      expect(createMotherRes.status).toBe(201);
      expect(createMotherRes.body.data.relationshipType).toBe('mother');
      expect(createMotherRes.body.data.students).toHaveLength(1);

      // Verify Student 1 now has 2 guardians in student.parents
      const student1InDb = await Student.findById(student1DocId);
      expect(student1InDb?.parents).toHaveLength(2);

      // Link Student 2 as a second child under Parent 1 (Multiple children per parent)
      const linkSecondChildRes = await request(app)
        .post(`/api/v1/parents/${parent1DocId}/children`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          studentId: student2DocId,
          relationshipType: 'guardian',
          isPrimaryGuardian: false,
          verificationStatus: 'verified',
          reason: 'Verified local guardian authorization form',
        });

      expect(linkSecondChildRes.status).toBe(200);
      expect(linkSecondChildRes.body.data.students).toHaveLength(2);

      // Parent 1 fetches /api/v1/parents/me/children -> sees both children
      const myChildrenRes = await request(app)
        .get('/api/v1/parents/me/children')
        .set('Authorization', `Bearer ${parent1Token}`);
      expect(myChildrenRes.status).toBe(200);
      expect(myChildrenRes.body.data.children).toHaveLength(2);

      // Unlink Student 2 from Parent 1 and verify relationshipHistory is preserved
      const unlinkRes = await request(app)
        .delete(`/api/v1/parents/${parent1DocId}/children/${student2DocId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(unlinkRes.status).toBe(200);
      expect(unlinkRes.body.data.students).toHaveLength(1);
      expect(
        unlinkRes.body.data.relationshipHistory.some((h: any) => h.action === 'unlinked')
      ).toBe(true);
    });

    it('13. should reject unauthorized parent-child linking by non-administrators', async () => {
      const parentSelfLinkAttempt = await request(app)
        .post(`/api/v1/parents/${parent1DocId}/children`)
        .set('Authorization', `Bearer ${parent1Token}`)
        .send({
          studentId: student2DocId,
          relationshipType: 'guardian',
        });
      expect(parentSelfLinkAttempt.status).toBe(403);

      const studentLinkAttempt = await request(app)
        .post(`/api/v1/parents/${parent1DocId}/children`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({
          studentId: student2DocId,
        });
      expect(studentLinkAttempt.status).toBe(403);
    });
  });

  // =========================================================================
  // 14–16. PARENT ACADEMIC PORTAL APIs
  // =========================================================================
  describe('Module 5: Parent Academic Portal APIs & Confidentiality', () => {
    beforeEach(async () => {
      // Seed Attendance Policy, Session & Record for Student 1 (Shortage case: 50%)
      await AttendancePolicy.create({
        academicYear: academicYearId,
        institutionThreshold: 75,
        warningThreshold: 85,
        lateTreatment: 'Present',
        excusedTreatment: 'ExcludeFromTotal',
        effectiveDate: new Date('2026-08-01'),
        status: 'Active',
      });

      const sess1 = await AttendanceSession.create({
        academicYear: academicYearId,
        section: sectionAId,
        subject: subjectDbmsId,
        teacher: teacher1DocId,
        date: new Date('2026-10-01'),
        semester: 5,
        periodNumber: 1,
        startTime: '09:00',
        endTime: '10:00',
        sessionType: 'Regular',
        status: 'Completed',
      });

      const sess2 = await AttendanceSession.create({
        academicYear: academicYearId,
        section: sectionAId,
        subject: subjectDbmsId,
        teacher: teacher1DocId,
        date: new Date('2026-10-02'),
        semester: 5,
        periodNumber: 1,
        startTime: '09:00',
        endTime: '10:00',
        sessionType: 'Regular',
        status: 'Completed',
      });

      await AttendanceRecord.create([
        {
          session: sess1._id,
          student: student1DocId,
          status: 'Present',
          markedBy: teacher1UserId,
        },
        {
          session: sess2._id,
          student: student1DocId,
          status: 'Absent',
          markedBy: teacher1UserId,
        },
      ]);

      // Seed Published Assignment & Draft Assignment
      const pubAssignment = await Assignment.create({
        title: 'DBMS Normalization Lab',
        description: 'Normalize schema to BCNF',
        subject: subjectDbmsId,
        section: sectionAId,
        academicYear: academicYearId,
        semester: 5,
        teacher: teacher1DocId,
        dueDate: new Date(Date.now() + 5 * 86400000),
        totalMarks: 50,
        passingMarks: 20,
        status: 'published',
        createdBy: teacher1UserId,
      });

      await Assignment.create({
        title: 'Hidden Draft Assignment',
        description: 'Draft not visible to parents',
        subject: subjectDbmsId,
        section: sectionAId,
        academicYear: academicYearId,
        semester: 5,
        teacher: teacher1DocId,
        dueDate: new Date(Date.now() + 10 * 86400000),
        totalMarks: 50,
        passingMarks: 20,
        status: 'draft',
        createdBy: teacher1UserId,
      });

      await AssignmentSubmission.create({
        assignment: pubAssignment._id,
        student: student1DocId,
        submissionText: 'Submitted BCNF decomposition',
        submissionStatus: 'submitted',
        submittedAt: new Date(),
        isLate: false,
      });

      // Seed Published Exam Result AND Unpublished (Pending/Evaluated) Exam Result
      const exam1 = await Examination.create({
        name: 'Internal Assessment 1',
        examinationCode: 'IA1-ODD-2026',
        examinationType: 'IA1',
        academicYear: academicYearId,
        semester: 5,
        section: sectionAId,
        subject: subjectDbmsId,
        startDate: new Date('2026-10-10'),
        endDate: new Date('2026-10-15'),
        maximumMarks: 50,
        passingMarks: 20,
        duration: 90,
        status: 'published',
        createdBy: teacher1UserId,
      });

      const exam2Draft = await Examination.create({
        name: 'Internal Assessment 2 (Draft)',
        examinationCode: 'IA2-ODD-2026',
        examinationType: 'IA2',
        academicYear: academicYearId,
        semester: 5,
        section: sectionAId,
        subject: subjectOsId,
        startDate: new Date('2026-11-10'),
        endDate: new Date('2026-11-15'),
        maximumMarks: 50,
        passingMarks: 20,
        duration: 90,
        status: 'completed',
        createdBy: teacher1UserId,
      });

      await ExaminationResult.create({
        examination: exam1._id,
        student: student1DocId,
        subject: subjectDbmsId,
        academicYear: academicYearId,
        semester: 5,
        marksObtained: 44,
        maximumMarks: 50,
        passingMarks: 20,
        percentage: 88,
        grade: 'A+',
        gradePoint: 9,
        isPassed: true,
        evaluationStatus: 'published',
        evaluatedBy: teacher1UserId,
      });

      await ExaminationResult.create({
        examination: exam2Draft._id,
        student: student1DocId,
        subject: subjectOsId,
        academicYear: academicYearId,
        semester: 5,
        marksObtained: 39,
        maximumMarks: 50,
        passingMarks: 20,
        percentage: 78,
        grade: 'A',
        gradePoint: 8,
        isPassed: true,
        evaluationStatus: 'evaluated', // Unpublished result — must be hidden from parent!
        evaluatedBy: teacher2UserId,
      });

      // Seed Published Timetable
      const tt = await Timetable.create({
        name: 'CSE Section A Master Timetable',
        academicYear: academicYearId,
        semester: 5,
        department: dept1Id,
        class: class1Id,
        section: sectionAId,
        effectiveFrom: new Date('2026-08-01'),
        effectiveTo: new Date('2026-12-31'),
        status: 'published',
        createdBy: teacher1UserId,
      });

      await TimetableEntry.create({
        timetable: tt._id,
        dayOfWeek: 'Monday',
        periodNumber: 1,
        startTime: '09:00',
        endTime: '10:00',
        subject: subjectDbmsId,
        teacher: teacher1DocId,
        section: sectionAId,
        classroom: 'LHC-301',
        lectureType: 'theory',
        academicYear: academicYearId,
        semester: 5,
        status: 'active',
        createdBy: teacher1UserId,
      });

      // Seed Published Announcement
      await Announcement.create({
        title: 'Parent-Teacher Conclave Notice',
        content: 'Odd semester PTM scheduled on Saturday.',
        announcementType: 'academic',
        priority: 'normal',
        targetAudience: 'parents',
        status: 'published',
        publishedAt: new Date(),
        createdBy: teacher1UserId,
      });
    });

    it('14. should allow parent to view linked child profile, attendance summary, shortage warnings, assignments, progress, and timetable', async () => {
      // Profile & Announcements
      const profileRes = await request(app)
        .get(`/api/v1/parents/me/children/${student1DocId}/profile`)
        .set('Authorization', `Bearer ${parent1Token}`);
      expect(profileRes.status).toBe(200);
      expect(profileRes.body.data.student.usn).toBe('1MS24CS001');
      expect(profileRes.body.data.recentAnnouncements.length).toBeGreaterThanOrEqual(1);

      // Attendance & Shortage Warning (50% < 75%)
      const attRes = await request(app)
        .get(`/api/v1/parents/me/children/${student1DocId}/attendance`)
        .set('Authorization', `Bearer ${parent1Token}`);
      expect(attRes.status).toBe(200);
      expect(attRes.body.data.summary.percentage).toBe(50);
      expect(attRes.body.data.summary.isShortage).toBe(true);
      expect(attRes.body.data.summary.shortageWarningMessage).toContain('below the mandatory');

      // Assignments (only published visible, draft hidden)
      const assignRes = await request(app)
        .get(`/api/v1/parents/me/children/${student1DocId}/assignments`)
        .set('Authorization', `Bearer ${parent1Token}`);
      expect(assignRes.status).toBe(200);
      expect(assignRes.body.data.assignments).toHaveLength(1);
      expect(assignRes.body.data.assignments[0].title).toBe('DBMS Normalization Lab');
      expect(assignRes.body.data.summary.submittedCount).toBe(1);

      // Progress
      const progRes = await request(app)
        .get(`/api/v1/parents/me/children/${student1DocId}/progress`)
        .set('Authorization', `Bearer ${parent1Token}`);
      expect(progRes.status).toBe(200);
      expect(progRes.body.data.overallProgress).toBeDefined();
      expect(Array.isArray(progRes.body.data.subjectWiseProgress)).toBe(true);

      // Timetable
      const ttRes = await request(app)
        .get(`/api/v1/parents/me/children/${student1DocId}/timetable`)
        .set('Authorization', `Bearer ${parent1Token}`);
      expect(ttRes.status).toBe(200);
      expect(ttRes.body.data.entries).toHaveLength(1);
    });

    it('15 & 16. should allow parent to view published examination results while strictly hiding unpublished results and blocking access to unlinked children', async () => {
      const resultsRes = await request(app)
        .get(`/api/v1/parents/me/children/${student1DocId}/results`)
        .set('Authorization', `Bearer ${parent1Token}`);

      expect(resultsRes.status).toBe(200);
      // Only IA1 (published) must be returned; IA2 (draft) must be excluded!
      expect(resultsRes.body.data.publishedResults).toHaveLength(1);
      expect(resultsRes.body.data.publishedResults[0].marksObtained).toBe(44);
      expect(resultsRes.body.data.publishedResults[0].evaluationStatus).toBe('published');

      // Parent 1 tries to access unlinked Student 2's results or attendance -> 403 Forbidden
      const unlinkedResults = await request(app)
        .get(`/api/v1/parents/me/children/${student2DocId}/results`)
        .set('Authorization', `Bearer ${parent1Token}`);
      expect(unlinkedResults.status).toBe(403);

      const unlinkedAttendance = await request(app)
        .get(`/api/v1/parents/me/children/${student2DocId}/attendance`)
        .set('Authorization', `Bearer ${parent1Token}`);
      expect(unlinkedAttendance.status).toBe(403);
    });
  });

  // =========================================================================
  // 17–20. PARENT-TEACHER COMMUNICATION, MEETING REQUESTS & NOTIFICATIONS
  // =========================================================================
  describe('Module 6 & 7: Parent-Teacher Communication, Meeting Requests & Notifications', () => {
    it('17. should allow parents and authorized teachers to exchange messages, block unauthorized teachers/parents, and close threads', async () => {
      // Parent 1 contacts Teacher 1 regarding Student 1
      const initRes = await request(app)
        .post('/api/v1/parent-communications')
        .set('Authorization', `Bearer ${parent1Token}`)
        .send({
          student: student1DocId,
          teacher: teacher1DocId,
          subject: subjectDbmsId,
          communicationType: 'academic_progress',
          subjectLine: 'Vikram Attendance & Lab Progress Inquiry',
          message: 'Hello Prof. Sharma, could you share how Vikram is performing in the DBMS lab sessions?',
        });

      expect(initRes.status).toBe(201);
      const commId = initRes.body.data._id;
      expect(initRes.body.data.status).toBe('open');

      // Verify Teacher 1 received a notification
      const teacherNotifs = await Notification.find({
        recipient: teacher1UserId,
        notificationType: 'parent_communication',
      });
      expect(teacherNotifs.length).toBeGreaterThanOrEqual(1);

      // Teacher 1 replies with academic feedback
      const replyRes = await request(app)
        .post(`/api/v1/parent-communications/${commId}/messages`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({
          message: 'Vikram has completed Lab 1 & 2 well, but needs to attend morning theory lectures regularly.',
        });
      expect(replyRes.status).toBe(201);

      // Verify Parent 1 received a notification for the teacher reply
      const parentNotifs = await Notification.find({
        recipient: parent1UserId,
        notificationType: 'parent_communication',
      });
      expect(parentNotifs.length).toBeGreaterThanOrEqual(1);

      // Fetch thread details and verify complete message history (2 messages)
      const threadRes = await request(app)
        .get(`/api/v1/parent-communications/${commId}`)
        .set('Authorization', `Bearer ${parent1Token}`);
      expect(threadRes.status).toBe(200);
      expect(threadRes.body.data.communication.status).toBe('replied');
      expect(threadRes.body.data.messages).toHaveLength(2);

      // Unauthorized Parent 2 tries to view Parent 1's thread -> 403 Forbidden
      const p2Forbidden = await request(app)
        .get(`/api/v1/parent-communications/${commId}`)
        .set('Authorization', `Bearer ${parent2Token}`);
      expect(p2Forbidden.status).toBe(403);

      // Parent 1 tries to message Teacher 3 (who only teaches Section B, not Student 1's Section A) -> 403 Forbidden
      const unauthorizedTeacherComm = await request(app)
        .post('/api/v1/parent-communications')
        .set('Authorization', `Bearer ${parent1Token}`)
        .send({
          student: student1DocId,
          teacher: teacher3DocId,
          communicationType: 'general',
          subjectLine: 'Unauthorized Section Teacher',
          message: 'Trying to message teacher not assigned to Section A',
        });
      expect(unauthorizedTeacherComm.status).toBe(403);

      // Close thread
      const closeRes = await request(app)
        .patch(`/api/v1/parent-communications/${commId}/close`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ reason: 'Query resolved with parent' });
      expect(closeRes.status).toBe(200);
      expect(closeRes.body.data.status).toBe('closed');
    });

    it('18 & 19. should support meeting requests and targeted parent notifications without leaking other student data', async () => {
      const meetingRes = await request(app)
        .post('/api/v1/parent-communications/meeting-requests')
        .set('Authorization', `Bearer ${parent1Token}`)
        .send({
          student: student1DocId,
          teacher: teacher1DocId,
          subject: subjectDbmsId,
          subjectLine: 'Request for In-Person Attendance Review Meeting',
          message: 'Would like to meet on Friday afternoon to discuss Vikram attendance recovery plan.',
          requestedDates: ['2026-11-15T10:00:00.000Z'],
          preferredMode: 'in_person',
          agenda: 'Attendance shortage & IA preparation',
        });

      expect(meetingRes.status).toBe(201);
      expect(meetingRes.body.data.communicationType).toBe('meeting_request');
      expect(meetingRes.body.data.meetingDetails.preferredMode).toBe('in_person');
      expect(meetingRes.body.data.meetingDetails.meetingStatus).toBe('requested');

      // Verify meeting_request notification was delivered to Teacher 1
      const meetingNotifs = await Notification.find({
        recipient: teacher1UserId,
        notificationType: 'meeting_request',
      });
      expect(meetingNotifs.length).toBe(1);

      // Trigger ParentService.notifyParentsOfStudent for Student 1 (e.g., attendance shortage alert)
      const notifyRes = await ParentService.notifyParentsOfStudent({
        studentId: student1DocId,
        title: 'Attendance Shortage Alert: Vikram Aditya',
        message: 'Vikram Aditya attendance in DBMS is 50.0%, below the 75.0% requirement.',
        notificationType: 'attendance_warning',
        category: 'attendance',
        priority: 'high',
        eventKeySuffix: 'shortage_oct_2026',
      });
      expect(notifyRes.notifiedParentsCount).toBe(1);

      // Verify Parent 1 received the notification and Parent 2 did NOT receive Student 1's notification
      const p1ShortageNotifs = await Notification.find({
        recipient: parent1UserId,
        notificationType: 'attendance_warning',
      });
      const p2ShortageNotifs = await Notification.find({
        recipient: parent2UserId,
        notificationType: 'attendance_warning',
      });
      expect(p1ShortageNotifs).toHaveLength(1);
      expect(p2ShortageNotifs).toHaveLength(0);
    });
  });
});
