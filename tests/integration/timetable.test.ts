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
import { Examination } from '../../src/models/examination.model';
import { ExaminationSchedule } from '../../src/models/examinationSchedule.model';
import { TeacherLeave } from '../../src/models/teacherLeave.model';
import { Timetable } from '../../src/models/timetable.model';
import { TimetableEntry } from '../../src/models/timetableEntry.model';
import { ROLES } from '../../src/constants/roles.constant';

describe('Phase 8 – Timetable & Scheduling Management Integration Tests', () => {
  let adminToken: string;
  let teacher1Token: string;
  let teacher1Id: string;
  let teacher2Id: string;
  let teacher3Id: string;
  let student1Token: string;
  let student1UserId: string;
  let parentToken: string;

  let yearId: string;
  let deptId: string;
  let classId: string;
  let sectionAId: string;
  let sectionBId: string;
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
    deptId = dept._id.toString();

    const academicClass = await Class.create({
      name: 'Bachelor of Engineering in CSE',
      code: 'BE-CSE',
      department: dept._id,
      degree: 'B.E.',
      durationYears: 4,
      status: 'Active',
    });
    classId = academicClass._id.toString();

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
    sectionBId = sectionB._id.toString();

    const subject1 = await Subject.create({
      name: 'Software Engineering & Agile',
      code: '21CS51',
      department: dept._id,
      semester: 5,
      credits: 4,
      subjectType: 'Theory',
      modules: [{ moduleNumber: 1, title: 'Agile', topics: ['Scrum'] }],
    });
    subject1Id = subject1._id.toString();

    const subject2 = await Subject.create({
      name: 'Computer Networks Lab',
      code: '21CSL57',
      department: dept._id,
      semester: 5,
      credits: 2,
      subjectType: 'Practical',
      modules: [{ moduleNumber: 1, title: 'Wireshark', topics: ['Packets'] }],
    });
    subject2Id = subject2._id.toString();

    // 3. Teachers
    const t1User = await User.create({
      email: 'teacher1@msec.ac.in',
      password: 'TeacherPassword123',
      role: ROLES.TEACHER,
      isActive: true,
    });
    const t1 = await Teacher.create({
      user: t1User._id,
      employeeId: 'MSEC-CS-001',
      firstName: 'Kavitha',
      lastName: 'Raman',
      department: dept._id,
      designation: 'Associate Professor',
      qualification: 'M.Tech, Ph.D',
      phone: '9876543210',
      status: 'Active',
    });
    teacher1Id = t1._id.toString();

    const t1Login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'teacher1@msec.ac.in', password: 'TeacherPassword123' });
    teacher1Token = t1Login.body.data.tokens.accessToken;

    const t2User = await User.create({
      email: 'teacher2@msec.ac.in',
      password: 'TeacherPassword123',
      role: ROLES.TEACHER,
      isActive: true,
    });
    const t2 = await Teacher.create({
      user: t2User._id,
      employeeId: 'MSEC-CS-002',
      firstName: 'Rajesh',
      lastName: 'Kumar',
      department: dept._id,
      designation: 'Assistant Professor',
      qualification: 'M.Tech',
      phone: '9876543211',
      status: 'Active',
    });
    teacher2Id = t2._id.toString();

    const t3User = await User.create({
      email: 'teacher3@msec.ac.in',
      password: 'TeacherPassword123',
      role: ROLES.TEACHER,
      isActive: true,
    });
    const t3 = await Teacher.create({
      user: t3User._id,
      employeeId: 'MSEC-CS-003',
      firstName: 'Ananya',
      lastName: 'Hegde',
      department: dept._id,
      designation: 'Lecturer',
      qualification: 'M.Tech',
      phone: '9876543212',
      status: 'Active',
    });
    teacher3Id = t3._id.toString();

    // 4. Students
    const s1User = await User.create({
      email: 'student1@msec.ac.in',
      password: 'StudentPassword123',
      role: ROLES.STUDENT,
      isActive: true,
    });
    student1UserId = s1User._id.toString();

    const s1 = await Student.create({
      user: s1User._id,
      usn: '1MS21CS001',
      rollNumber: 'CS01',
      firstName: 'Rahul',
      lastName: 'Dravid',
      department: dept._id,
      class: academicClass._id,
      section: sectionA._id,
      semester: 5,
      academicYear: academicYear._id,
      status: 'Active',
    });

    const s1Login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'student1@msec.ac.in', password: 'StudentPassword123' });
    student1Token = s1Login.body.data.tokens.accessToken;

    // 5. Parents
    const pUser = await User.create({
      email: 'parent1@msec.ac.in',
      password: 'ParentPassword123',
      role: ROLES.PARENT,
      isActive: true,
    });
    await Parent.create({
      user: pUser._id,
      fatherName: 'Sharad Dravid',
      primaryPhone: '9876543230',
      students: [s1._id],
    });

    const pLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'parent1@msec.ac.in', password: 'ParentPassword123' });
    parentToken = pLogin.body.data.tokens.accessToken;
  });

  describe('Module 1: Timetable Management Lifecycle', () => {
    it('1. should create a timetable in draft mode and validate dates', async () => {
      const res = await request(app)
        .post('/api/v1/timetables')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Odd Semester 2026 - Section A Regular Timetable',
          academicYear: yearId,
          semester: 5,
          department: deptId,
          class: classId,
          section: sectionAId,
          effectiveFrom: '2026-08-01',
          effectiveTo: '2026-12-31',
          timetableType: 'regular',
          status: 'draft',
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('_id');
      expect(res.body.data.status).toBe('draft');
      expect(res.body.data.version).toBe(1);
    });

    it('2. should publish timetable, update details, and archive cleanly', async () => {
      const createRes = await request(app)
        .post('/api/v1/timetables')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Section A Term Timetable',
          academicYear: yearId,
          semester: 5,
          department: deptId,
          class: classId,
          section: sectionAId,
          effectiveFrom: '2026-08-01',
          effectiveTo: '2026-12-31',
        });
      const timetableId = createRes.body.data._id;

      // Publish
      const pubRes = await request(app)
        .patch(`/api/v1/timetables/${timetableId}/publish`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(pubRes.status).toBe(200);
      expect(pubRes.body.data.status).toBe('published');

      // Update published timetable -> bumps version
      const updateRes = await request(app)
        .put(`/api/v1/timetables/${timetableId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Section A Term Timetable - Revised' });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.version).toBe(2);

      // Archive
      const archiveRes = await request(app)
        .patch(`/api/v1/timetables/${timetableId}/archive`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(archiveRes.status).toBe(200);
      expect(archiveRes.body.data.status).toBe('archived');
    });

    it('should reject creating overlapping published timetable for the same section', async () => {
      await Timetable.create({
        name: 'Existing Published Timetable',
        academicYear: yearId,
        semester: 5,
        department: deptId,
        class: classId,
        section: sectionAId,
        effectiveFrom: new Date('2026-08-01'),
        effectiveTo: new Date('2026-12-31'),
        status: 'published',
        createdBy: student1UserId,
      });

      const res = await request(app)
        .post('/api/v1/timetables')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Conflicting Timetable',
          academicYear: yearId,
          semester: 5,
          department: deptId,
          class: classId,
          section: sectionAId,
          effectiveFrom: '2026-09-01',
          effectiveTo: '2026-11-30',
          status: 'published',
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('active published timetable already exists');
    });
  });

  describe('Module 2 & 3: Timetable Entries & Conflict Detection Engine', () => {
    let timetableAId: string;
    let timetableBId: string;

    beforeEach(async () => {
      const ttA = await Timetable.create({
        name: 'CSE 5A Timetable',
        academicYear: yearId,
        semester: 5,
        department: deptId,
        class: classId,
        section: sectionAId,
        effectiveFrom: new Date('2026-08-01'),
        effectiveTo: new Date('2026-12-31'),
        status: 'published',
        createdBy: student1UserId,
      });
      timetableAId = ttA._id.toString();

      const ttB = await Timetable.create({
        name: 'CSE 5B Timetable',
        academicYear: yearId,
        semester: 5,
        department: deptId,
        class: classId,
        section: sectionBId,
        effectiveFrom: new Date('2026-08-01'),
        effectiveTo: new Date('2026-12-31'),
        status: 'published',
        createdBy: student1UserId,
      });
      timetableBId = ttB._id.toString();
    });

    it('3. should create valid timetable entry and reject duplicate period entry on same day', async () => {
      const entryRes = await request(app)
        .post(`/api/v1/timetables/${timetableAId}/entries`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          dayOfWeek: 'Monday',
          periodNumber: 1,
          startTime: '09:00',
          endTime: '09:55',
          subject: subject1Id,
          teacher: teacher1Id,
          classroom: 'Room 301',
          lectureType: 'theory',
        });

      expect(entryRes.status).toBe(201);
      expect(entryRes.body.data.classroom).toBe('Room 301');

      // Attempt to schedule duplicate period 1 on Monday for timetable A
      const dupRes = await request(app)
        .post(`/api/v1/timetables/${timetableAId}/entries`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          dayOfWeek: 'Monday',
          periodNumber: 1,
          startTime: '09:00',
          endTime: '09:55',
          subject: subject1Id,
          teacher: teacher2Id,
          classroom: 'Room 302',
          lectureType: 'theory',
        });

      expect(dupRes.status).toBe(409);
      expect(dupRes.body.message).toContain('already scheduled on Monday');
    });

    it('4. should detect teacher conflict when teacher is assigned to two overlapping lectures', async () => {
      // Schedule Teacher 1 for Section A on Monday 09:00 - 09:55
      await request(app)
        .post(`/api/v1/timetables/${timetableAId}/entries`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          dayOfWeek: 'Monday',
          periodNumber: 1,
          startTime: '09:00',
          endTime: '09:55',
          subject: subject1Id,
          teacher: teacher1Id,
          classroom: 'Room 301',
        });

      // Attempt to schedule Teacher 1 for Section B at the same time
      const conflictRes = await request(app)
        .post(`/api/v1/timetables/${timetableBId}/entries`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          dayOfWeek: 'Monday',
          periodNumber: 1,
          startTime: '09:00',
          endTime: '09:55',
          subject: subject1Id,
          teacher: teacher1Id,
          classroom: 'Room 302',
        });

      expect(conflictRes.status).toBe(409);
      expect(conflictRes.body.message).toContain('TEACHER_CONFLICT');
    });

    it('5. should detect section conflict when section has simultaneous lectures', async () => {
      // Add Period 1 for Section A (09:00 - 09:55)
      await request(app)
        .post(`/api/v1/timetables/${timetableAId}/entries`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          dayOfWeek: 'Monday',
          periodNumber: 1,
          startTime: '09:00',
          endTime: '09:55',
          subject: subject1Id,
          teacher: teacher1Id,
          classroom: 'Room 301',
        });

      // Attempt to add another lecture for Section A overlapping with Period 1
      const conflictRes = await request(app)
        .post(`/api/v1/timetables/${timetableAId}/entries`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          dayOfWeek: 'Monday',
          periodNumber: 2,
          startTime: '09:30', // overlaps 09:00 - 09:55
          endTime: '10:25',
          subject: subject1Id,
          teacher: teacher2Id,
          classroom: 'Room 302',
        });

      expect(conflictRes.status).toBe(409);
      expect(conflictRes.body.message).toContain('SECTION_CONFLICT');
    });

    it('6. should detect classroom conflict when classroom is allocated to two simultaneous lectures', async () => {
      // Room 301 allocated to Section A on Monday 10:00 - 10:55
      await request(app)
        .post(`/api/v1/timetables/${timetableAId}/entries`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          dayOfWeek: 'Monday',
          periodNumber: 2,
          startTime: '10:00',
          endTime: '10:55',
          subject: subject1Id,
          teacher: teacher1Id,
          classroom: 'Room 301',
        });

      // Attempt to allocate Room 301 to Section B at the same time
      const roomConflictRes = await request(app)
        .post(`/api/v1/timetables/${timetableBId}/entries`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          dayOfWeek: 'Monday',
          periodNumber: 2,
          startTime: '10:00',
          endTime: '10:55',
          subject: subject1Id,
          teacher: teacher2Id,
          classroom: 'Room 301',
        });

      expect(roomConflictRes.status).toBe(409);
      expect(roomConflictRes.body.message).toContain('CLASSROOM_CONFLICT');
    });

    it('7. should detect laboratory capacity / overlapping session conflict', async () => {
      // Book Network Lab for Section A on Tuesday 14:00 - 15:55
      await request(app)
        .post(`/api/v1/timetables/${timetableAId}/entries`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          dayOfWeek: 'Tuesday',
          periodNumber: 5,
          startTime: '14:00',
          endTime: '15:55',
          subject: subject2Id,
          teacher: teacher1Id,
          classroom: 'Network Lab 1',
          lectureType: 'lab',
        });

      // Attempt to book Network Lab 1 for Section B simultaneously
      const labConflictRes = await request(app)
        .post(`/api/v1/timetables/${timetableBId}/entries`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          dayOfWeek: 'Tuesday',
          periodNumber: 5,
          startTime: '14:00',
          endTime: '15:55',
          subject: subject2Id,
          teacher: teacher2Id,
          classroom: 'Network Lab 1',
          lectureType: 'lab',
        });

      expect(labConflictRes.status).toBe(409);
      expect(labConflictRes.body.message).toContain('LABORATORY_CONFLICT');
    });

    it('8. should detect teacher leave conflict during approved leave periods', async () => {
      // Record approved medical leave for Teacher 2
      await TeacherLeave.create({
        teacher: teacher2Id,
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-10-31'),
        leaveType: 'sick',
        reason: 'Medical surgery and recovery',
        status: 'approved',
      });

      // Attempt to assign Teacher 2 to a lecture within leave period
      const leaveConflictRes = await request(app)
        .post(`/api/v1/timetables/${timetableAId}/entries`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          dayOfWeek: 'Wednesday',
          periodNumber: 3,
          startTime: '11:15',
          endTime: '12:10',
          subject: subject1Id,
          teacher: teacher2Id,
          classroom: 'Room 302',
        });

      expect(leaveConflictRes.status).toBe(409);
      expect(leaveConflictRes.body.message).toContain('TEACHER_LEAVE_CONFLICT');
    });

    it('9. should detect examination conflict between lectures and scheduled exams', async () => {
      // Create examination schedule for Section A on Wednesday 09:30 - 12:30
      const exam = await Examination.create({
        name: 'IA1 Semester 5',
        examinationCode: 'IA1-S5-2026',
        examinationType: 'IA1',
        academicYear: yearId,
        semester: 5,
        section: sectionAId,
        subject: subject1Id,
        startDate: new Date('2026-09-01'),
        endDate: new Date('2026-09-30'),
        maximumMarks: 50,
        passingMarks: 18,
        duration: 90,
        status: 'scheduled',
        createdBy: student1UserId,
      });

      // Wednesday date: Sept 16, 2026
      await ExaminationSchedule.create({
        examination: exam._id,
        subject: subject1Id,
        section: sectionAId,
        examDate: new Date('2026-09-16'),
        startTime: '09:30',
        endTime: '11:00',
        venue: 'Auditorium Hall',
        invigilators: [teacher1Id],
        status: 'scheduled',
      });

      // Attempt to schedule regular lecture for Section A on Wednesday 10:00 - 10:55
      const examConflictRes = await request(app)
        .post(`/api/v1/timetables/${timetableAId}/entries`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          dayOfWeek: 'Wednesday',
          periodNumber: 2,
          startTime: '10:00',
          endTime: '10:55',
          subject: subject1Id,
          teacher: teacher3Id,
          classroom: 'Room 301',
        });

      expect(examConflictRes.status).toBe(409);
      expect(examConflictRes.body.message).toContain('EXAMINATION_CONFLICT');
    });

    it('10. should allow authorized administrator to override conflict with reason and audit log', async () => {
      // Room 301 booked for Section A on Friday 09:00 - 09:55
      await request(app)
        .post(`/api/v1/timetables/${timetableAId}/entries`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          dayOfWeek: 'Friday',
          periodNumber: 1,
          startTime: '09:00',
          endTime: '09:55',
          subject: subject1Id,
          teacher: teacher1Id,
          classroom: 'Room 301',
        });

      // Override room allocation for combined session
      const overrideRes = await request(app)
        .post(`/api/v1/timetables/${timetableBId}/entries`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          dayOfWeek: 'Friday',
          periodNumber: 1,
          startTime: '09:00',
          endTime: '09:55',
          subject: subject1Id,
          teacher: teacher3Id,
          classroom: 'Room 301',
          allowOverride: true,
          overrideReason: 'Combined guest lecture authorized by Head of Department',
        });

      expect(overrideRes.status).toBe(201);

      // Verify audit log
      const auditRes = await request(app)
        .get('/api/v1/timetables/conflicts')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(auditRes.status).toBe(200);
      expect(auditRes.body.data.length).toBeGreaterThanOrEqual(1);
      expect(auditRes.body.data[0].reason).toContain('Combined guest lecture authorized');
    });
  });

  describe('Module 4 & 5: Teacher, Student & Parent Timetable Access', () => {
    beforeEach(async () => {
      const ttA = await Timetable.create({
        name: 'CSE 5A Regular',
        academicYear: yearId,
        semester: 5,
        department: deptId,
        class: classId,
        section: sectionAId,
        effectiveFrom: new Date('2026-08-01'),
        effectiveTo: new Date('2026-12-31'),
        status: 'published',
        createdBy: student1UserId,
      });

      // Period 1 on Monday for Teacher 1
      await TimetableEntry.create({
        timetable: ttA._id,
        dayOfWeek: 'Monday',
        periodNumber: 1,
        startTime: '09:00',
        endTime: '09:55',
        subject: subject1Id,
        teacher: teacher1Id,
        section: sectionAId,
        classroom: 'Room 301',
        academicYear: yearId,
        semester: 5,
        status: 'active',
        createdBy: student1UserId,
      });

      // Period 2 on Monday for Teacher 1
      await TimetableEntry.create({
        timetable: ttA._id,
        dayOfWeek: 'Monday',
        periodNumber: 2,
        startTime: '10:00',
        endTime: '10:55',
        subject: subject1Id,
        teacher: teacher1Id,
        section: sectionAId,
        classroom: 'Room 301',
        academicYear: yearId,
        semester: 5,
        status: 'active',
        createdBy: student1UserId,
      });
    });

    it('12. should allow Teacher 1 to view personal weekly schedule, teaching hours, and free periods', async () => {
      const res = await request(app)
        .get('/api/v1/timetables/teachers/me/weekly')
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('summary');
      expect(res.body.data.summary.totalLectures).toBe(2);
      expect(res.body.data.summary.totalTeachingHours).toBeGreaterThan(1.5);
      expect(res.body.data.scheduleByDay.Monday.lectures.length).toBe(2);
      // Free periods among 1-7 (periods 3,4,5,6,7 are free on Monday)
      expect(res.body.data.scheduleByDay.Monday.freePeriods).toContain(3);
    });

    it('13. should allow student to view assigned section timetable and reject unauthorized section view', async () => {
      // Access own section (Section A)
      const ownRes = await request(app)
        .get('/api/v1/timetables/students/me')
        .set('Authorization', `Bearer ${student1Token}`);

      expect(ownRes.status).toBe(200);
      expect(ownRes.body.data.entries.length).toBe(2);

      // Section endpoint for Section A -> allowed
      const sectionARes = await request(app)
        .get(`/api/v1/timetables/sections/${sectionAId}`)
        .set('Authorization', `Bearer ${student1Token}`);
      expect(sectionARes.status).toBe(200);

      // Section endpoint for Section B -> rejected with 403
      const sectionBRes = await request(app)
        .get(`/api/v1/timetables/sections/${sectionBId}`)
        .set('Authorization', `Bearer ${student1Token}`);
      expect(sectionBRes.status).toBe(403);
    });

    it('14. should allow linked parent to view child section timetable and reject unlinked section', async () => {
      // Linked Section A
      const allowedRes = await request(app)
        .get(`/api/v1/timetables/sections/${sectionAId}`)
        .set('Authorization', `Bearer ${parentToken}`);
      expect(allowedRes.status).toBe(200);

      // Unlinked Section B
      const deniedRes = await request(app)
        .get(`/api/v1/timetables/sections/${sectionBId}`)
        .set('Authorization', `Bearer ${parentToken}`);
      expect(deniedRes.status).toBe(403);
    });
  });

  describe('Module 6: Timetable Changes & Substitutions', () => {
    let entryId: string;
    let timetableId: string;

    beforeEach(async () => {
      const tt = await Timetable.create({
        name: 'CSE 5A Changes Test',
        academicYear: yearId,
        semester: 5,
        department: deptId,
        class: classId,
        section: sectionAId,
        effectiveFrom: new Date('2026-08-01'),
        effectiveTo: new Date('2026-12-31'),
        status: 'published',
        createdBy: student1UserId,
      });
      timetableId = tt._id.toString();

      const entry = await TimetableEntry.create({
        timetable: tt._id,
        dayOfWeek: 'Thursday',
        periodNumber: 1,
        startTime: '09:00',
        endTime: '09:55',
        subject: subject1Id,
        teacher: teacher1Id,
        section: sectionAId,
        classroom: 'Room 301',
        academicYear: yearId,
        semester: 5,
        status: 'active',
        createdBy: student1UserId,
      });
      entryId = entry._id.toString();
    });

    it('11 & 15. should record substitution change, approve it, and reflect substitute teacher on that date', async () => {
      const changeDate = '2026-09-17'; // Thursday

      // Request substitution: Teacher 3 substitutes Teacher 1
      const changeRes = await request(app)
        .post('/api/v1/timetable-changes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          timetable: timetableId,
          entry: entryId,
          changeType: 'substitution',
          effectiveDate: changeDate,
          substituteTeacher: teacher3Id,
          reason: 'Teacher 1 attending academic conference',
        });

      expect(changeRes.status).toBe(201);
      expect(changeRes.body.data.status).toBe('approved'); // Admin auto-approved

      // Student views section timetable for change date -> teacher is now Teacher 3
      const viewRes = await request(app)
        .get(`/api/v1/timetables/sections/${sectionAId}?date=${changeDate}`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(viewRes.status).toBe(200);
      const substitutedLecture = viewRes.body.data.entries.find(
        (e: any) => e.status === 'substituted'
      );
      expect(substitutedLecture).toBeDefined();
      expect(substitutedLecture.teacher._id.toString()).toBe(teacher3Id);
    });

    it('16. should preserve historical timetable and archive without mutating underlying entries', async () => {
      // Archive timetable
      const archiveRes = await request(app)
        .patch(`/api/v1/timetables/${timetableId}/archive`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(archiveRes.status).toBe(200);
      expect(archiveRes.body.data.status).toBe('archived');

      // Entry still exists and can be retrieved historically
      const entriesRes = await request(app)
        .get(`/api/v1/timetables/${timetableId}/entries`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(entriesRes.status).toBe(200);
      expect(entriesRes.body.data.length).toBe(1);
    });
  });

  describe('Module 7: Timetable Analytics Engine', () => {
    beforeEach(async () => {
      const tt = await Timetable.create({
        name: 'CSE 5A Analytics',
        academicYear: yearId,
        semester: 5,
        department: deptId,
        class: classId,
        section: sectionAId,
        effectiveFrom: new Date('2026-08-01'),
        effectiveTo: new Date('2026-12-31'),
        status: 'published',
        createdBy: student1UserId,
      });

      // 3 entries
      await TimetableEntry.create([
        {
          timetable: tt._id,
          dayOfWeek: 'Monday',
          periodNumber: 1,
          startTime: '09:00',
          endTime: '09:55',
          subject: subject1Id,
          teacher: teacher1Id,
          section: sectionAId,
          classroom: 'Room 301',
          academicYear: yearId,
          semester: 5,
          lectureType: 'theory',
          status: 'active',
          createdBy: student1UserId,
        },
        {
          timetable: tt._id,
          dayOfWeek: 'Monday',
          periodNumber: 2,
          startTime: '10:00',
          endTime: '10:55',
          subject: subject1Id,
          teacher: teacher1Id,
          section: sectionAId,
          classroom: 'Room 301',
          academicYear: yearId,
          semester: 5,
          lectureType: 'theory',
          status: 'active',
          createdBy: student1UserId,
        },
        {
          timetable: tt._id,
          dayOfWeek: 'Tuesday',
          periodNumber: 1,
          startTime: '09:00',
          endTime: '09:55',
          subject: subject2Id,
          teacher: teacher2Id,
          section: sectionAId,
          classroom: 'Lab 1',
          academicYear: yearId,
          semester: 5,
          lectureType: 'lab',
          status: 'active',
          createdBy: student1UserId,
        },
      ]);
    });

    it('17. should compute teacher workload, classroom utilization, and subject distribution analytics', async () => {
      // Teacher workload
      const workloadRes = await request(app)
        .get('/api/v1/timetables/analytics/teacher-workload')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(workloadRes.status).toBe(200);
      expect(workloadRes.body.data.totalTeachersEvaluated).toBeGreaterThanOrEqual(2);
      expect(workloadRes.body.data.highestWorkload.name).toContain('Kavitha');

      // Classroom utilization
      const roomRes = await request(app)
        .get('/api/v1/timetables/analytics/classroom-utilization?dayOfWeek=Monday&periodNumber=1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(roomRes.status).toBe(200);
      expect(roomRes.body.data.totalClassroomsTracked).toBeGreaterThanOrEqual(2);
      expect(roomRes.body.data.freeClassroomsQuery.availableRooms).toContain('Lab 1');

      // Subject distribution
      const subRes = await request(app)
        .get('/api/v1/timetables/analytics/subject-distribution')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(subRes.status).toBe(200);
      expect(subRes.body.data.totalSubjectsEvaluated).toBe(2);
    });
  });
});
