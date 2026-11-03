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
  Timetable,
  TimetableEntry,
  TimetableChange,
  Notification,
} from '../../src/models';
import { ROLES } from '../../src/constants/roles.constant';
import { NotificationDeliveryService } from '../../src/services/notificationDelivery.service';

describe('Phase 11: Leave, Substitution & Teacher Management Integration Tests', () => {
  let adminToken: string;

  let teacher1Token: string;
  let teacher1UserId: string;
  let teacher1DocId: string;

  let teacher2Token: string;
  let teacher2UserId: string;
  let teacher2DocId: string;

  let teacher3Token: string;
  let teacher3DocId: string;

  let studentToken: string;
  let studentUserId: string;

  let academicYearId: string;
  let deptCseId: string;
  let entryTeacher1MondayPeriod1Id: string;
  let entryTeacher1MondayPeriod2Id: string;
  let entryTeacher3MondayPeriod1Id: string;

  beforeEach(async () => {
    NotificationDeliveryService.resetProviders();

    // 1. Create Admin
    const adminUser = await User.create({
      email: 'admin.phase11@msec.ac.in',
      password: 'Password123',
      role: ROLES.ADMIN,
      isActive: true,
    });

    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin.phase11@msec.ac.in', password: 'Password123' });
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

    const [deptCse, deptEce] = await Promise.all([
      Department.create({
        name: 'Computer Science & Engineering',
        code: 'CSE',
      }),
      Department.create({
        name: 'Electronics & Communication Engineering',
        code: 'ECE',
      }),
    ]);
    deptCseId = deptCse._id.toString();

    const classCse = await Class.create({
      name: '3rd Year B.E. CSE',
      code: 'CSE-3',
      department: deptCse._id,
      degree: 'B.E.',
      durationYears: 4,
    });

    const [sectionA, sectionB] = await Promise.all([
      Section.create({
        class: classCse._id,
        academicYear: academicYear._id,
        semester: 5,
        sectionName: 'A',
        roomNumber: 'CSE-301',
        capacity: 60,
      }),
      Section.create({
        class: classCse._id,
        academicYear: academicYear._id,
        semester: 5,
        sectionName: 'B',
        roomNumber: 'CSE-302',
        capacity: 60,
      }),
    ]);

    const [subjectDbms, subjectOs] = await Promise.all([
      Subject.create({
        name: 'Database Management Systems',
        code: 'CS501',
        department: deptCse._id,
        semester: 5,
        type: 'Theory',
        credits: 4,
      }),
      Subject.create({
        name: 'Operating Systems',
        code: 'CS502',
        department: deptCse._id,
        semester: 5,
        type: 'Theory',
        credits: 4,
      }),
    ]);

    // 3. Create Teachers
    const [t1User, t2User, t3User] = await Promise.all([
      User.create({
        email: 'teacher1.p11@msec.ac.in',
        password: 'Password123',
        role: ROLES.TEACHER,
        isActive: true,
      }),
      User.create({
        email: 'teacher2.p11@msec.ac.in',
        password: 'Password123',
        role: ROLES.TEACHER,
        isActive: true,
      }),
      User.create({
        email: 'teacher3.p11@msec.ac.in',
        password: 'Password123',
        role: ROLES.TEACHER,
        isActive: true,
      }),
    ]);
    teacher1UserId = t1User._id.toString();
    teacher2UserId = t2User._id.toString();

    const [t1Doc, t2Doc, t3Doc] = await Promise.all([
      Teacher.create({
        user: t1User._id,
        employeeId: 'EMP-P11-01',
        firstName: 'Ananya',
        lastName: 'Rao',
        department: deptCse._id,
        designation: 'Associate Professor',
        qualification: 'Ph.D. in Computer Science',
        qualifications: ['Ph.D. in Computer Science', 'M.Tech CSE'],
        specialization: ['Database Management Systems', 'Data Mining'],
        employmentCategory: 'regular',
        phone: '9876543201',
        maxWeeklyHours: 20,
        status: 'Active',
        isActive: true,
      }),
      Teacher.create({
        user: t2User._id,
        employeeId: 'EMP-P11-02',
        firstName: 'Vikram',
        lastName: 'Menon',
        department: deptCse._id,
        designation: 'Assistant Professor',
        qualification: 'M.Tech in CSE',
        qualifications: ['M.Tech in CSE'],
        specialization: ['Database Management Systems', 'Operating Systems'],
        employmentCategory: 'regular',
        phone: '9876543202',
        maxWeeklyHours: 24,
        status: 'Active',
        isActive: true,
      }),
      Teacher.create({
        user: t3User._id,
        employeeId: 'EMP-P11-03',
        firstName: 'Priya',
        lastName: 'Nair',
        department: deptEce._id,
        designation: 'Assistant Professor',
        qualification: 'M.Tech in VLSI',
        qualifications: ['M.Tech in VLSI'],
        specialization: ['Embedded Systems'],
        employmentCategory: 'contract',
        phone: '9876543203',
        maxWeeklyHours: 18,
        status: 'Active',
        isActive: true,
      }),
    ]);
    teacher1DocId = t1Doc._id.toString();
    teacher2DocId = t2Doc._id.toString();
    teacher3DocId = t3Doc._id.toString();

    const [t1Login, t2Login, t3Login] = await Promise.all([
      request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'teacher1.p11@msec.ac.in', password: 'Password123' }),
      request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'teacher2.p11@msec.ac.in', password: 'Password123' }),
      request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'teacher3.p11@msec.ac.in', password: 'Password123' }),
    ]);
    teacher1Token = t1Login.body.data.tokens.accessToken;
    teacher2Token = t2Login.body.data.tokens.accessToken;
    teacher3Token = t3Login.body.data.tokens.accessToken;

    // Assign subjects
    await Promise.all([
      TeacherAssignment.create({
        teacher: t1Doc._id,
        subject: subjectDbms._id,
        section: sectionA._id,
        academicYear: academicYear._id,
        semester: 5,
        status: 'Active',
      }),
      TeacherAssignment.create({
        teacher: t2Doc._id,
        subject: subjectDbms._id,
        section: sectionB._id,
        academicYear: academicYear._id,
        semester: 5,
        status: 'Active',
      }),
      TeacherAssignment.create({
        teacher: t3Doc._id,
        subject: subjectOs._id,
        section: sectionB._id,
        academicYear: academicYear._id,
        semester: 5,
        status: 'Active',
      }),
    ]);

    // 4. Create Student in Section A
    const sUser = await User.create({
      email: 'student1.p11@msec.ac.in',
      password: 'Password123',
      role: ROLES.STUDENT,
      isActive: true,
    });
    studentUserId = sUser._id.toString();

    await Student.create({
      user: sUser._id,
      usn: '1MS24CS001',
      rollNumber: '01',
      firstName: 'Rohan',
      lastName: 'Sharma',
      department: deptCse._id,
      class: classCse._id,
      section: sectionA._id,
      academicYear: academicYear._id,
      semester: 5,
      status: 'Active',
    });

    const sLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'student1.p11@msec.ac.in', password: 'Password123' });
    studentToken = sLogin.body.data.tokens.accessToken;

    // 5. Create Published Timetables & Entries
    // Note: 2026-11-16 is a Monday
    const [ttA, ttB] = await Promise.all([
      Timetable.create({
        name: 'CSE 5A Timetable',
        academicYear: academicYear._id,
        semester: 5,
        department: deptCse._id,
        class: classCse._id,
        section: sectionA._id,
        effectiveFrom: new Date('2026-08-01'),
        effectiveTo: new Date('2027-05-31'),
        status: 'published',
        createdBy: adminUser._id,
      }),
      Timetable.create({
        name: 'CSE 5B Timetable',
        academicYear: academicYear._id,
        semester: 5,
        department: deptCse._id,
        class: classCse._id,
        section: sectionB._id,
        effectiveFrom: new Date('2026-08-01'),
        effectiveTo: new Date('2027-05-31'),
        status: 'published',
        createdBy: adminUser._id,
      }),
    ]);

    // Teacher 1 teaches Monday Period 1 (09:00-09:55) & Period 2 (10:00-10:55) in Section A
    // Teacher 3 teaches Monday Period 1 (09:00-09:55) in Section B (so Teacher 3 has a conflict on Monday Period 1!)
    // Teacher 2 is FREE on Monday Period 1!
    const [e1, e2, e3] = await Promise.all([
      TimetableEntry.create({
        timetable: ttA._id,
        dayOfWeek: 'Monday',
        periodNumber: 1,
        startTime: '09:00',
        endTime: '09:55',
        subject: subjectDbms._id,
        teacher: t1Doc._id,
        section: sectionA._id,
        classroom: 'CSE-301',
        lectureType: 'theory',
        academicYear: academicYear._id,
        semester: 5,
        status: 'active',
        createdBy: adminUser._id,
      }),
      TimetableEntry.create({
        timetable: ttA._id,
        dayOfWeek: 'Monday',
        periodNumber: 2,
        startTime: '10:00',
        endTime: '10:55',
        subject: subjectDbms._id,
        teacher: t1Doc._id,
        section: sectionA._id,
        classroom: 'CSE-301',
        lectureType: 'theory',
        academicYear: academicYear._id,
        semester: 5,
        status: 'active',
        createdBy: adminUser._id,
      }),
      TimetableEntry.create({
        timetable: ttB._id,
        dayOfWeek: 'Monday',
        periodNumber: 1,
        startTime: '09:00',
        endTime: '09:55',
        subject: subjectOs._id,
        teacher: t3Doc._id,
        section: sectionB._id,
        classroom: 'CSE-302',
        lectureType: 'theory',
        academicYear: academicYear._id,
        semester: 5,
        status: 'active',
        createdBy: adminUser._id,
      }),
    ]);
    entryTeacher1MondayPeriod1Id = e1._id.toString();
    entryTeacher1MondayPeriod2Id = e2._id.toString();
    entryTeacher3MondayPeriod1Id = e3._id.toString();
  });

  // =========================================================================
  // 1. TEACHER MANAGEMENT TESTS
  // =========================================================================
  describe('Module 1: Teacher Profile Management', () => {
    it('should allow admin to create, update, search, and activate/deactivate teacher profiles', async () => {
      const newTeacherUser = await User.create({
        email: 'teacher4.p11@msec.ac.in',
        password: 'Password123',
        role: ROLES.TEACHER,
        isActive: true,
      });

      // Create teacher profile
      const createRes = await request(app)
        .post('/api/v1/teachers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          user: newTeacherUser._id.toString(),
          employeeId: 'EMP-P11-04',
          firstName: 'Karthik',
          lastName: 'Subramanian',
          department: deptCseId,
          designation: 'Professor',
          qualification: 'Ph.D. in AI',
          qualifications: ['Ph.D. in AI', 'M.E. CSE'],
          specialization: ['Machine Learning', 'Computer Vision'],
          employmentCategory: 'regular',
          phone: '9876543204',
          officeRoom: 'CSE-105',
          maxWeeklyHours: 18,
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.data.employeeId).toBe('EMP-P11-04');
      expect(createRes.body.data.specialization).toContain('Machine Learning');
      const createdTeacherId = createRes.body.data._id;

      // Deactivate teacher profile
      const deactivateRes = await request(app)
        .patch(`/api/v1/teachers/${createdTeacherId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false });

      expect(deactivateRes.status).toBe(200);
      expect(deactivateRes.body.data.isActive).toBe(false);
      expect(deactivateRes.body.data.status).toBe('Inactive');

      // Reactivate teacher profile
      const reactivateRes = await request(app)
        .patch(`/api/v1/teachers/${createdTeacherId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: true });

      expect(reactivateRes.status).toBe(200);
      expect(reactivateRes.body.data.isActive).toBe(true);
      expect(reactivateRes.body.data.status).toBe('Active');

      // Search and filter teachers
      const searchRes = await request(app)
        .get('/api/v1/teachers?search=Machine Learning&department=' + deptCseId)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(searchRes.status).toBe(200);
      expect(searchRes.body.data.length).toBe(1);
      expect(searchRes.body.data[0].employeeId).toBe('EMP-P11-04');
    });

    it('should allow teachers to view their own profile, classes, timetable, and workload while blocking cross-teacher access', async () => {
      // GET /me
      const meRes = await request(app)
        .get('/api/v1/teachers/me')
        .set('Authorization', `Bearer ${teacher1Token}`);
      expect(meRes.status).toBe(200);
      expect(meRes.body.data.teacher.employeeId).toBe('EMP-P11-01');

      // Teacher 1 updates personal bio & phone
      const updateSelfRes = await request(app)
        .patch(`/api/v1/teachers/${teacher1DocId}`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ bio: 'Database Researcher', alternatePhone: '9123456780' });
      expect(updateSelfRes.status).toBe(200);
      expect(updateSelfRes.body.data.bio).toBe('Database Researcher');

      // Teacher 1 cannot modify administrative fields like designation or employeeId
      const forbiddenFieldRes = await request(app)
        .patch(`/api/v1/teachers/${teacher1DocId}`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ designation: 'Dean' });
      expect(forbiddenFieldRes.status).toBe(403);

      // View classes & subjects
      const classesRes = await request(app)
        .get(`/api/v1/teachers/${teacher1DocId}/classes`)
        .set('Authorization', `Bearer ${teacher1Token}`);
      expect(classesRes.status).toBe(200);
      expect(classesRes.body.data.subjects.length).toBe(1);

      // View timetable
      const ttRes = await request(app)
        .get(`/api/v1/teachers/${teacher1DocId}/timetable`)
        .set('Authorization', `Bearer ${teacher1Token}`);
      expect(ttRes.status).toBe(200);
      expect(ttRes.body.data.summary.totalLectures).toBe(2);

      // View workload
      const workloadRes = await request(app)
        .get(`/api/v1/teachers/${teacher1DocId}/workload`)
        .set('Authorization', `Bearer ${teacher1Token}`);
      expect(workloadRes.status).toBe(200);
      expect(workloadRes.body.data.workload.weeklyTeachingPeriods).toBe(2);

      // Cross-teacher access blocked
      const crossAccessRes = await request(app)
        .get(`/api/v1/teachers/${teacher2DocId}/leave-history`)
        .set('Authorization', `Bearer ${teacher1Token}`);
      expect(crossAccessRes.status).toBe(403);
    });
  });

  // =========================================================================
  // 2. LEAVE POLICY & LEAVE REQUEST MANAGEMENT TESTS
  // =========================================================================
  describe('Module 2: Configurable Leave Policies & Leave Request Workflow', () => {
    let policyId: string;

    beforeEach(async () => {
      const policyRes = await request(app)
        .post('/api/v1/leaves/policies')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'MSEC 2026-2027 Faculty Leave Policy',
          academicYear: academicYearId,
          effectiveFrom: '2026-08-01',
          effectiveTo: '2027-07-31',
          applicableEmploymentCategories: ['regular', 'contract'],
          leaveTypes: [
            {
              leaveType: 'casual',
              displayName: 'Casual Leave',
              annualQuota: 12,
              allowHalfDay: true,
              allowPartialDay: true,
              requiresAttachment: false,
              maxConsecutiveDays: 5,
              isPaid: true,
              applicableCategories: ['regular', 'contract'],
            },
            {
              leaveType: 'sick',
              displayName: 'Medical / Sick Leave',
              annualQuota: 10,
              allowHalfDay: true,
              allowPartialDay: false,
              requiresAttachmentAfterDays: 2,
              isPaid: true,
              applicableCategories: ['regular'],
            },
          ],
          approvalWorkflow: {
            requiresApproval: true,
            approverRoles: [ROLES.SUPER_ADMIN, ROLES.ADMIN],
            preventSelfApproval: true,
            autoApproveTypes: [],
          },
        });

      expect(policyRes.status).toBe(201);
      policyId = policyRes.body.data._id;
    });

    it('should update leave policies and compute dynamic leave balances accurately', async () => {
      const updateRes = await request(app)
        .patch(`/api/v1/leaves/policies/${policyId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ description: 'Updated faculty leave policy for AY 2026-2027' });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.description).toBe('Updated faculty leave policy for AY 2026-2027');

      const balanceRes = await request(app)
        .get('/api/v1/leaves/balances')
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(balanceRes.status).toBe(200);
      expect(balanceRes.body.data.balances.length).toBe(2);
      const casualBal = balanceRes.body.data.balances.find(
        (b: { leaveType: string }) => b.leaveType === 'casual'
      );
      expect(casualBal.annualQuota).toBe(12);
      expect(casualBal.remainingDays).toBe(12);
    });

    it('should submit full-day and half-day leave requests, automatically identify affected timetable entries, and block overlapping requests', async () => {
      // Submit full-day leave on Monday 2026-11-16
      const leaveRes = await request(app)
        .post('/api/v1/leave-requests')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({
          leaveType: 'casual',
          startDate: '2026-11-16',
          endDate: '2026-11-16',
          reason: 'Attending family function',
        });

      expect(leaveRes.status).toBe(201);
      expect(leaveRes.body.data.status).toBe('pending');
      expect(leaveRes.body.data.totalDays).toBe(1);
      // Teacher 1 has 2 Monday lectures (Period 1 & Period 2) -> both should be identified!
      expect(leaveRes.body.data.affectedTimetableEntries.length).toBe(2);

      // Overlapping leave on the same date must be rejected with 409
      const overlapRes = await request(app)
        .post('/api/v1/leave-requests')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({
          leaveType: 'casual',
          startDate: '2026-11-16',
          endDate: '2026-11-17',
          reason: 'Duplicate overlapping leave',
        });
      expect(overlapRes.status).toBe(409);

      // Submit half-day leave on Monday 2026-11-23 (first_half, period 1-4)
      const halfDayRes = await request(app)
        .post('/api/v1/leave-requests')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({
          leaveType: 'casual',
          startDate: '2026-11-23',
          endDate: '2026-11-23',
          isPartialDay: true,
          dayPart: 'first_half',
          startTime: '09:00',
          endTime: '09:55',
          reason: 'Morning dental appointment',
        });

      expect(halfDayRes.status).toBe(201);
      expect(halfDayRes.body.data.totalDays).toBe(0.5);
      // Only Period 1 (09:00-09:55) overlaps 09:00-09:55!
      expect(halfDayRes.body.data.affectedTimetableEntries.length).toBe(1);
      expect(halfDayRes.body.data.affectedTimetableEntries[0].periodNumber).toBe(1);
    });

    it('should enforce policy rules (attachment requirement, consecutive days limit, employment category eligibility)', async () => {
      // Sick leave > 2 days requires attachment per policy
      const missingAttachmentRes = await request(app)
        .post('/api/v1/leave-requests')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({
          leaveType: 'sick',
          startDate: '2026-12-01',
          endDate: '2026-12-04',
          reason: 'Viral fever recovery',
        });
      expect(missingAttachmentRes.status).toBe(400);
      expect(missingAttachmentRes.body.message).toMatch(/attachment is required/i);

      // Contract teacher (Teacher 3) trying to apply for 'sick' leave restricted to 'regular' category
      const contractIneligibleRes = await request(app)
        .post('/api/v1/leave-requests')
        .set('Authorization', `Bearer ${teacher3Token}`)
        .send({
          leaveType: 'sick',
          startDate: '2026-12-01',
          endDate: '2026-12-01',
          reason: 'Medical checkup',
        });
      expect(contractIneligibleRes.status).toBe(400);
      expect(contractIneligibleRes.body.message).toMatch(/not applicable/i);
    });

    it('should approve and reject leave requests, prevent self-approval, and trigger notifications', async () => {
      const submitRes = await request(app)
        .post('/api/v1/leave-requests')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({
          leaveType: 'casual',
          startDate: '2026-11-16',
          endDate: '2026-11-16',
          reason: 'Personal work',
        });
      const leaveId = submitRes.body.data._id;

      // Teacher cannot approve leave request (RBAC 403)
      const selfApproveRes = await request(app)
        .patch(`/api/v1/leave-requests/${leaveId}/approve`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ reviewComments: 'Trying to self-approve' });
      expect(selfApproveRes.status).toBe(403);

      // Admin approves leave request
      const approveRes = await request(app)
        .patch(`/api/v1/leave-requests/${leaveId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reviewComments: 'Approved by Principal' });

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.data.status).toBe('approved');
      expect(approveRes.body.data.reviewComments).toBe('Approved by Principal');
      expect(approveRes.body.data.approvalHistory.length).toBe(2);

      // Verify Phase 9 notification sent to Teacher 1
      const notif = await Notification.findOne({
        recipient: teacher1UserId,
        notificationType: 'leave_update',
        relatedEntityId: leaveId,
      });
      expect(notif).not.toBeNull();
      expect(notif?.title).toMatch(/Approved/i);

      // Submit a second leave request and reject it
      const submitRes2 = await request(app)
        .post('/api/v1/leave-requests')
        .set('Authorization', `Bearer ${teacher2Token}`)
        .send({
          leaveType: 'casual',
          startDate: '2026-11-20',
          endDate: '2026-11-20',
          reason: 'Going out of station',
        });
      const leave2Id = submitRes2.body.data._id;

      const rejectRes = await request(app)
        .patch(`/api/v1/leave-requests/${leave2Id}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reviewComments: 'Inspection scheduled on this date' });

      expect(rejectRes.status).toBe(200);
      expect(rejectRes.body.data.status).toBe('rejected');
      expect(rejectRes.body.data.reviewComments).toBe('Inspection scheduled on this date');
    });
  });

  // =========================================================================
  // 3. TEACHER SUBSTITUTION & TIMETABLE INTEGRATION TESTS
  // =========================================================================
  describe('Module 3 & 4: Teacher Substitution Workflow, Conflict Detection & Timetable Integration', () => {
    let approvedLeaveId: string;

    beforeEach(async () => {
      // Teacher 1 submits and gets approved leave for Monday 2026-11-16
      const subRes = await request(app)
        .post('/api/v1/leave-requests')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({
          leaveType: 'casual',
          startDate: '2026-11-16',
          endDate: '2026-11-16',
          reason: 'Medical appointment',
        });
      approvedLeaveId = subRes.body.data._id;

      await request(app)
        .patch(`/api/v1/leave-requests/${approvedLeaveId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reviewComments: 'Approved' });
    });

    it('should find available substitute teachers and exclude teachers with class conflicts or on leave', async () => {
      // For Monday 2026-11-16 Period 1 (entryTeacher1MondayPeriod1Id):
      // - Teacher 1 is the absent teacher (and on approved leave) -> excluded
      // - Teacher 3 has a regular lecture on Monday Period 1 (09:00-09:55) -> excluded due to conflict
      // - Teacher 2 is free, teaches DBMS, and is in CSE department -> available & top-ranked!
      const availRes = await request(app)
        .get(
          `/api/v1/substitutions/available-teachers?timetableEntry=${entryTeacher1MondayPeriod1Id}&date=2026-11-16`
        )
        .set('Authorization', `Bearer ${adminToken}`);

      expect(availRes.status).toBe(200);
      expect(availRes.body.data.totalAvailable).toBe(1);
      const topCandidate = availRes.body.data.availableTeachers[0];
      expect(topCandidate.teacher.employeeId).toBe('EMP-P11-02');
      expect(topCandidate.isSubjectEligible).toBe(true);
      expect(topCandidate.isSameDepartment).toBe(true);

      // Verify conflict endpoint reports conflict for Teacher 3 on Monday Period 1
      const conflictRes = await request(app)
        .get(
          `/api/v1/substitutions/conflicts?substituteTeacher=${teacher3DocId}&timetableEntry=${entryTeacher1MondayPeriod1Id}&date=2026-11-16`
        )
        .set('Authorization', `Bearer ${adminToken}`);

      expect(conflictRes.status).toBe(200);
      expect(conflictRes.body.data.hasConflicts).toBe(true);
      expect(conflictRes.body.data.conflicts[0].conflictType).toBe('TEACHER_TIMETABLE_CONFLICT');
    });

    it('should reject substitutions when substitute teacher has a conflicting class or is on approved leave', async () => {
      // 1. Try assigning Teacher 3 (who has a Monday Period 1 lecture) as substitute -> 409 Conflict
      const classConflictSub = await request(app)
        .post('/api/v1/substitutions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          timetableEntry: entryTeacher1MondayPeriod1Id,
          leaveRequest: approvedLeaveId,
          substituteTeacher: teacher3DocId,
          date: '2026-11-16',
          reason: 'Cover DBMS Period 1',
        });
      expect(classConflictSub.status).toBe(409);
      expect(classConflictSub.body.message).toMatch(/TEACHER_TIMETABLE_CONFLICT/);

      // 2. Put Teacher 2 on approved leave on 2026-11-16 and verify substitution is rejected
      const t2Leave = await request(app)
        .post('/api/v1/leave-requests')
        .set('Authorization', `Bearer ${teacher2Token}`)
        .send({
          leaveType: 'casual',
          startDate: '2026-11-16',
          endDate: '2026-11-16',
          reason: 'Urgent leave',
        });
      await request(app)
        .patch(`/api/v1/leave-requests/${t2Leave.body.data._id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      const leaveConflictSub = await request(app)
        .post('/api/v1/substitutions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          timetableEntry: entryTeacher1MondayPeriod1Id,
          substituteTeacher: teacher2DocId,
          date: '2026-11-16',
          reason: 'Cover DBMS Period 1',
        });
      expect(leaveConflictSub.status).toBe(409);
      expect(leaveConflictSub.body.message).toMatch(/TEACHER_LEAVE_CONFLICT/);
    });

    it('should propose, approve, reflect in timetable lookups without mutating recurring TimetableEntry, complete, and cancel substitutions', async () => {
      // Teacher 1 proposes Teacher 2 as substitute for Monday 2026-11-16 Period 1
      const proposeRes = await request(app)
        .post('/api/v1/substitutions')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({
          timetableEntry: entryTeacher1MondayPeriod1Id,
          leaveRequest: approvedLeaveId,
          substituteTeacher: teacher2DocId,
          date: '2026-11-16',
          reason: 'On approved casual leave',
        });

      expect(proposeRes.status).toBe(201);
      expect(proposeRes.body.data.status).toBe('proposed');
      const substitutionId = proposeRes.body.data._id;

      // Prevent double-booking Teacher 2 for another lecture in the same slot (Period 1 on 2026-11-16)
      const doubleBookRes = await request(app)
        .post('/api/v1/substitutions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          timetableEntry: entryTeacher3MondayPeriod1Id,
          substituteTeacher: teacher2DocId,
          date: '2026-11-16',
          reason: 'Try double-booking Teacher 2 in Period 1',
        });
      expect(doubleBookRes.status).toBe(409);
      expect(doubleBookRes.body.message).toMatch(/SUBSTITUTE_DOUBLE_BOOKED/);

      // Admin approves substitution
      const approveRes = await request(app)
        .patch(`/api/v1/substitutions/${substitutionId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ approvalComments: 'Approved substitution for Period 1' });

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.data.status).toBe('approved');
      expect(approveRes.body.data.timetableChange).toBeDefined();

      // Verify notifications sent to substitute teacher and section student
      const [subTeacherNotif, studentNotif] = await Promise.all([
        Notification.findOne({
          recipient: teacher2UserId,
          notificationType: 'substitution_update',
          relatedEntityId: substitutionId,
        }),
        Notification.findOne({
          recipient: studentUserId,
          notificationType: 'substitution_update',
          relatedEntityId: substitutionId,
        }),
      ]);
      expect(subTeacherNotif).not.toBeNull();
      expect(studentNotif).not.toBeNull();

      // Verify date-specific timetable lookup for Teacher 2 shows the substituted lecture on 2026-11-16
      const t2ScheduleOnDate = await request(app)
        .get(`/api/v1/teachers/${teacher2DocId}/timetable?date=2026-11-16`)
        .set('Authorization', `Bearer ${teacher2Token}`);

      expect(t2ScheduleOnDate.status).toBe(200);
      const mondayLecturesT2 = t2ScheduleOnDate.body.data.scheduleByDay.Monday.lectures;
      expect(mondayLecturesT2.length).toBe(1);
      expect(mondayLecturesT2[0].status).toBe('substituted');

      // Verify recurring TimetableEntry in DB still belongs to Teacher 1 (non-destructive!)
      const originalEntry = await TimetableEntry.findById(entryTeacher1MondayPeriod1Id);
      expect(originalEntry?.teacher?.toString()).toBe(teacher1DocId);

      // Substitute teacher marks substitution as completed
      const completeRes = await request(app)
        .patch(`/api/v1/substitutions/${substitutionId}/complete`)
        .set('Authorization', `Bearer ${teacher2Token}`)
        .send({
          topicsCovered: 'Normalization & BCNF',
          remarks: 'Completed interactive exercises',
          attendanceRecorded: true,
        });

      expect(completeRes.status).toBe(200);
      expect(completeRes.body.data.status).toBe('completed');
      expect(completeRes.body.data.completionDetails.topicsCovered).toBe('Normalization & BCNF');

      // Create & approve substitution for Period 2, then cancel it and verify TimetableChange is reverted
      const subPeriod2 = await request(app)
        .post('/api/v1/substitutions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          timetableEntry: entryTeacher1MondayPeriod2Id,
          substituteTeacher: teacher2DocId,
          date: '2026-11-16',
          reason: 'Cover Period 2',
          autoApprove: true,
        });
      expect(subPeriod2.status).toBe(201);
      expect(subPeriod2.body.data.status).toBe('approved');
      const sub2Id = subPeriod2.body.data._id;

      const cancelSubRes = await request(app)
        .patch(`/api/v1/substitutions/${sub2Id}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ cancellationReason: 'Class rescheduled' });

      expect(cancelSubRes.status).toBe(200);
      expect(cancelSubRes.body.data.status).toBe('cancelled');

      const revertedChange = await TimetableChange.findById(subPeriod2.body.data.timetableChange);
      expect(revertedChange?.status).toBe('rejected');
    });

    it('should cancel an eligible leave request and automatically cancel linked active substitutions', async () => {
      // Submit a future leave request on Monday 2027-02-15
      const futureLeave = await request(app)
        .post('/api/v1/leave-requests')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({
          leaveType: 'casual',
          startDate: '2027-02-15',
          endDate: '2027-02-15',
          reason: 'Future conference',
        });
      const futureLeaveId = futureLeave.body.data._id;

      // Admin assigns a substitution linked to this leave
      const subRes = await request(app)
        .post('/api/v1/substitutions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          timetableEntry: entryTeacher1MondayPeriod1Id,
          leaveRequest: futureLeaveId,
          substituteTeacher: teacher2DocId,
          date: '2027-02-15',
          reason: 'Conference substitution',
        });
      expect(subRes.status).toBe(201);
      const subId = subRes.body.data._id;

      // Teacher 1 cancels the pending leave request
      const cancelLeaveRes = await request(app)
        .patch(`/api/v1/leave-requests/${futureLeaveId}/cancel`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ cancellationReason: 'Conference postponed' });

      expect(cancelLeaveRes.status).toBe(200);
      expect(cancelLeaveRes.body.data.status).toBe('cancelled');

      // Verify linked substitution was automatically cancelled
      const checkSub = await request(app)
        .get(`/api/v1/substitutions/${subId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(checkSub.body.data.status).toBe('cancelled');
    });
  });

  // =========================================================================
  // 4. WORKLOAD & SUMMARY ANALYTICS + RBAC TESTS
  // =========================================================================
  describe('Module 6 & 8: Teacher Workload Analytics & Strict RBAC Enforcement', () => {
    it('should compute teacher workload, department workload, leave summary, and substitution summary analytics', async () => {
      // Create an approved leave and completed substitution first
      const leaveRes = await request(app)
        .post('/api/v1/leave-requests')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({
          leaveType: 'casual',
          startDate: '2026-11-16',
          endDate: '2026-11-16',
          reason: 'Workshop',
        });
      await request(app)
        .patch(`/api/v1/leave-requests/${leaveRes.body.data._id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      const subRes = await request(app)
        .post('/api/v1/substitutions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          timetableEntry: entryTeacher1MondayPeriod1Id,
          leaveRequest: leaveRes.body.data._id,
          substituteTeacher: teacher2DocId,
          date: '2026-11-16',
          reason: 'Workshop cover',
        });
      await request(app)
        .patch(`/api/v1/substitutions/${subRes.body.data._id}/complete`)
        .set('Authorization', `Bearer ${teacher2Token}`)
        .send({ topicsCovered: 'Indexing' });

      // 1. Teacher workload analytics
      const twRes = await request(app)
        .get(`/api/v1/analytics/teacher-workload?department=${deptCseId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(twRes.status).toBe(200);
      expect(twRes.body.data.summary.totalTeachers).toBe(2);

      // 2. Department workload analytics
      const dwRes = await request(app)
        .get('/api/v1/analytics/department-workload')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(dwRes.status).toBe(200);
      expect(dwRes.body.data.totalDepartments).toBe(2);

      // 3. Leave summary analytics
      const lsRes = await request(app)
        .get('/api/v1/analytics/leave-summary')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(lsRes.status).toBe(200);
      expect(lsRes.body.data.totalApprovedDays).toBe(1);

      // 4. Substitution summary analytics
      const ssRes = await request(app)
        .get('/api/v1/analytics/substitution-summary')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(ssRes.status).toBe(200);
      expect(ssRes.body.data.byStatus.completed).toBe(1);
      expect(ssRes.body.data.topSubstituteTeachers[0].employeeId).toBe('EMP-P11-02');
    });

    it('should strictly block students from accessing teacher profiles, leave requests, substitutions, and workload analytics', async () => {
      const [tRes, lRes, sRes, aRes] = await Promise.all([
        request(app)
          .get('/api/v1/teachers')
          .set('Authorization', `Bearer ${studentToken}`),
        request(app)
          .get('/api/v1/leave-requests')
          .set('Authorization', `Bearer ${studentToken}`),
        request(app)
          .get('/api/v1/substitutions')
          .set('Authorization', `Bearer ${studentToken}`),
        request(app)
          .get('/api/v1/analytics/teacher-workload')
          .set('Authorization', `Bearer ${studentToken}`),
      ]);

      expect(tRes.status).toBe(403);
      expect(lRes.status).toBe(403);
      expect(sRes.status).toBe(403);
      expect(aRes.status).toBe(403);
    });
  });
});
