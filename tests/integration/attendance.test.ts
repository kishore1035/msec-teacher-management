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
import { ROLES } from '../../src/constants/roles.constant';
import { Types } from 'mongoose';

describe('Phase 3 – Attendance Management & Shortage Detection Tests', () => {
  let adminToken: string;
  let teacherToken: string;
  let otherTeacherToken: string;
  let student1Token: string;
  let parentToken: string;

  let teacherDocId: string;
  let otherTeacherDocId: string;
  let student1DocId: string;
  let student2DocId: string;
  let yearId: string;
  let deptId: string;
  let classId: string;
  let sectionId: string;
  let otherSectionId: string;
  let subjectId: string;

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
      name: 'Computer Science',
      code: 'CSE',
      status: 'Active',
    });
    deptId = dept._id.toString();

    const cls = await Class.create({
      name: 'B.E. Computer Science',
      code: 'BE-CSE',
      department: dept._id,
      degree: 'B.E.',
      durationYears: 4,
      status: 'Active',
    });
    classId = cls._id.toString();

    const sec = await Section.create({
      class: cls._id,
      academicYear: academicYear._id,
      semester: 5,
      sectionName: 'A',
      capacity: 60,
      status: 'Active',
    });
    sectionId = sec._id.toString();

    const otherSec = await Section.create({
      class: cls._id,
      academicYear: academicYear._id,
      semester: 5,
      sectionName: 'B',
      capacity: 60,
      status: 'Active',
    });
    otherSectionId = otherSec._id.toString();

    const sub = await Subject.create({
      name: 'Database Management Systems',
      code: '21CS51',
      department: dept._id,
      semester: 5,
      credits: 4,
      subjectType: 'Theory',
      status: 'Active',
    });
    subjectId = sub._id.toString();

    // 3. Teachers
    const tUser1 = await User.create({
      email: 'teacher1@msec.ac.in',
      password: 'TeacherPassword123',
      role: ROLES.TEACHER,
      isActive: true,
    });
    const tLogin1 = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'teacher1@msec.ac.in', password: 'TeacherPassword123' });
    teacherToken = tLogin1.body.data.tokens.accessToken;

    const tDoc1 = await Teacher.create({
      user: tUser1._id,
      employeeId: 'EMP-001',
      firstName: 'Rajesh',
      lastName: 'Sharma',
      department: dept._id,
      designation: 'Assistant Professor',
      qualification: 'M.Tech',
      phone: '9876543211',
      status: 'Active',
    });
    teacherDocId = tDoc1._id.toString();

    const tUser2 = await User.create({
      email: 'teacher2@msec.ac.in',
      password: 'TeacherPassword123',
      role: ROLES.TEACHER,
      isActive: true,
    });
    const tLogin2 = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'teacher2@msec.ac.in', password: 'TeacherPassword123' });
    otherTeacherToken = tLogin2.body.data.tokens.accessToken;

    const tDoc2 = await Teacher.create({
      user: tUser2._id,
      employeeId: 'EMP-002',
      firstName: 'Kavitha',
      lastName: 'Nair',
      department: dept._id,
      designation: 'Associate Professor',
      qualification: 'Ph.D.',
      phone: '9876543212',
      status: 'Active',
    });
    otherTeacherDocId = tDoc2._id.toString();

    // Assign Teacher 1 to Section A, Subject 21CS51
    await TeacherAssignment.create({
      teacher: tDoc1._id,
      subject: sub._id,
      section: sec._id,
      academicYear: academicYear._id,
      semester: 5,
      isPrimary: true,
      status: 'Active',
    });

    // 4. Students
    const sUser1 = await User.create({
      email: 'student1@msec.ac.in',
      password: 'StudentPassword123',
      role: ROLES.STUDENT,
      isActive: true,
    });
    const sLogin1 = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'student1@msec.ac.in', password: 'StudentPassword123' });
    student1Token = sLogin1.body.data.tokens.accessToken;

    const sDoc1 = await Student.create({
      user: sUser1._id,
      usn: '1MS21CS001',
      rollNumber: '01',
      firstName: 'Aarav',
      lastName: 'Patel',
      department: dept._id,
      class: cls._id,
      section: sec._id,
      semester: 5,
      academicYear: academicYear._id,
      status: 'Active',
    });
    student1DocId = sDoc1._id.toString();

    const sUser2 = await User.create({
      email: 'student2@msec.ac.in',
      password: 'StudentPassword123',
      role: ROLES.STUDENT,
      isActive: true,
    });
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'student2@msec.ac.in', password: 'StudentPassword123' });

    const sDoc2 = await Student.create({
      user: sUser2._id,
      usn: '1MS21CS002',
      rollNumber: '02',
      firstName: 'Bhavna',
      lastName: 'Reddy',
      department: dept._id,
      class: cls._id,
      section: sec._id,
      semester: 5,
      academicYear: academicYear._id,
      status: 'Active',
    });
    student2DocId = sDoc2._id.toString();

    // 5. Parent (Linked to Student 1 only)
    const pUser = await User.create({
      email: 'parent@msec.ac.in',
      password: 'ParentPassword123',
      role: ROLES.PARENT,
      isActive: true,
    });
    const pLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'parent@msec.ac.in', password: 'ParentPassword123' });
    parentToken = pLogin.body.data.tokens.accessToken;

    await Parent.create({
      user: pUser._id,
      fatherName: 'Vikram Patel',
      primaryPhone: '9876543299',
      students: [sDoc1._id],
    });
  });

  describe('Attendance Sessions', () => {
    it('1. should allow authorized teacher to create attendance session for assigned class', async () => {
      const res = await request(app)
        .post('/api/v1/attendance/sessions')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          academicYear: yearId,
          section: sectionId,
          subject: subjectId,
          teacher: teacherDocId,
          date: '2026-09-10',
          semester: 5,
          periodNumber: 1,
          startTime: '09:00',
          endTime: '10:00',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('Scheduled');
    });

    it('2. should prevent duplicate session for same section, subject, date, and period', async () => {
      await request(app)
        .post('/api/v1/attendance/sessions')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          academicYear: yearId,
          section: sectionId,
          subject: subjectId,
          teacher: teacherDocId,
          date: '2026-09-10',
          semester: 5,
          periodNumber: 2,
        });

      const duplicateRes = await request(app)
        .post('/api/v1/attendance/sessions')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          academicYear: yearId,
          section: sectionId,
          subject: subjectId,
          teacher: teacherDocId,
          date: '2026-09-10',
          semester: 5,
          periodNumber: 2,
        });

      expect(duplicateRes.status).toBe(409);
      expect(duplicateRes.body.message).toContain('already exists');
    });

    it('6 & 16. should reject unassigned teacher attempting to create a session', async () => {
      const res = await request(app)
        .post('/api/v1/attendance/sessions')
        .set('Authorization', `Bearer ${otherTeacherToken}`)
        .send({
          academicYear: yearId,
          section: sectionId,
          subject: subjectId,
          teacher: otherTeacherDocId,
          date: '2026-09-10',
          semester: 5,
          periodNumber: 3,
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('not assigned to teach');
    });
  });

  describe('Attendance Records & Bulk Roll-Call', () => {
    let activeSessionId: string;

    beforeEach(async () => {
      const sessionRes = await request(app)
        .post('/api/v1/attendance/sessions')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          academicYear: yearId,
          section: sectionId,
          subject: subjectId,
          teacher: teacherDocId,
          date: '2026-09-11',
          semester: 5,
          periodNumber: 1,
        });
      activeSessionId = sessionRes.body.data._id;
    });

    it('3. should perform bulk roll-call attendance marking in one atomic operation', async () => {
      const res = await request(app)
        .post(`/api/v1/attendance/sessions/${activeSessionId}/records`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          records: [
            { student: student1DocId, status: 'Present' },
            { student: student2DocId, status: 'Absent', remarks: 'Medical leave' },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.insertedCount).toBe(2);

      // Verify records in DB
      const getRecords = await request(app)
        .get(`/api/v1/attendance/sessions/${activeSessionId}/records`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(getRecords.status).toBe(200);
      expect(getRecords.body.data.length).toBe(2);
    });

    it('4. should prevent duplicate records by updating existing records seamlessly', async () => {
      await request(app)
        .post(`/api/v1/attendance/sessions/${activeSessionId}/records`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          records: [{ student: student1DocId, status: 'Present' }],
        });

      // Re-submit roll call with updated status
      const updateRes = await request(app)
        .post(`/api/v1/attendance/sessions/${activeSessionId}/records`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          records: [{ student: student1DocId, status: 'Late' }],
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.updatedCount).toBe(1);
    });

    it('5. should reject attendance marking for a student not enrolled in the section', async () => {
      // Create student enrolled in Section B
      const outsideStudent = await Student.create({
        user: new Types.ObjectId(),
        usn: '1MS21CS099',
        rollNumber: '99',
        firstName: 'External',
        lastName: 'Student',
        department: new Types.ObjectId(deptId),
        class: new Types.ObjectId(classId),
        section: new Types.ObjectId(otherSectionId),
        semester: 5,
        academicYear: new Types.ObjectId(yearId),
      });

      const res = await request(app)
        .post(`/api/v1/attendance/sessions/${activeSessionId}/records`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          records: [{ student: outsideStudent._id.toString(), status: 'Present' }],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('do not belong to the enrolled section');
    });

    it('13. should maintain audit history when correcting an attendance record', async () => {
      // Mark initial record
      await request(app)
        .post(`/api/v1/attendance/sessions/${activeSessionId}/records`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          records: [{ student: student1DocId, status: 'Absent' }],
        });

      const getRecords = await request(app)
        .get(`/api/v1/attendance/sessions/${activeSessionId}/records`)
        .set('Authorization', `Bearer ${teacherToken}`);
      const recordId = getRecords.body.data[0]._id;

      // Correct attendance record
      const patchRes = await request(app)
        .patch(`/api/v1/attendance/records/${recordId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'Present',
          correctionReason: 'Student arrived with on-duty sports slip approved by HOD',
        });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.status).toBe('Present');
      expect(patchRes.body.data.auditHistory.length).toBe(1);
      expect(patchRes.body.data.auditHistory[0].previousStatus).toBe('Absent');
      expect(patchRes.body.data.auditHistory[0].newStatus).toBe('Present');
      expect(patchRes.body.data.auditHistory[0].reason).toContain('sports slip');
    });
  });

  describe('Calculation Engine, Policies & Shortage Detection', () => {
    it('9, 10, 11 & 14. should accurately calculate percentages, apply policy rules, and exclude cancelled sessions', async () => {
      // Configure Attendance Policy:
      // Institution threshold: 75%
      // Late treatment: CountAsHalf (0.5)
      // Excused treatment: ExcludeFromTotal
      await request(app)
        .post('/api/v1/attendance/policy')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          academicYear: yearId,
          institutionThreshold: 75,
          warningThreshold: 85,
          lateTreatment: 'CountAsHalf',
          excusedTreatment: 'ExcludeFromTotal',
        });

      // Session 1: Present (1.0)
      const s1 = await request(app)
        .post('/api/v1/attendance/sessions')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          academicYear: yearId,
          section: sectionId,
          subject: subjectId,
          teacher: teacherDocId,
          date: '2026-09-01',
          semester: 5,
          periodNumber: 1,
        });
      await request(app)
        .post(`/api/v1/attendance/sessions/${s1.body.data._id}/records`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ records: [{ student: student1DocId, status: 'Present' }] });

      // Session 2: Late (0.5 under policy)
      const s2 = await request(app)
        .post('/api/v1/attendance/sessions')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          academicYear: yearId,
          section: sectionId,
          subject: subjectId,
          teacher: teacherDocId,
          date: '2026-09-02',
          semester: 5,
          periodNumber: 1,
        });
      await request(app)
        .post(`/api/v1/attendance/sessions/${s2.body.data._id}/records`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ records: [{ student: student1DocId, status: 'Late' }] });

      // Session 3: Excused (Excluded from total countable sessions under policy)
      const s3 = await request(app)
        .post('/api/v1/attendance/sessions')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          academicYear: yearId,
          section: sectionId,
          subject: subjectId,
          teacher: teacherDocId,
          date: '2026-09-03',
          semester: 5,
          periodNumber: 1,
        });
      await request(app)
        .post(`/api/v1/attendance/sessions/${s3.body.data._id}/records`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ records: [{ student: student1DocId, status: 'Excused' }] });

      // Session 4: Absent (0.0)
      const s4 = await request(app)
        .post('/api/v1/attendance/sessions')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          academicYear: yearId,
          section: sectionId,
          subject: subjectId,
          teacher: teacherDocId,
          date: '2026-09-04',
          semester: 5,
          periodNumber: 1,
        });
      await request(app)
        .post(`/api/v1/attendance/sessions/${s4.body.data._id}/records`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ records: [{ student: student1DocId, status: 'Absent' }] });

      // Session 5: Cancelled Session (MUST BE EXCLUDED)
      const s5 = await request(app)
        .post('/api/v1/attendance/sessions')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          academicYear: yearId,
          section: sectionId,
          subject: subjectId,
          teacher: teacherDocId,
          date: '2026-09-05',
          semester: 5,
          periodNumber: 1,
        });
      await request(app)
        .patch(`/api/v1/attendance/sessions/${s5.body.data._id}/cancel`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ reason: 'College holiday announced' });

      // Verification:
      // Countable sessions: Session 1 (Present), Session 2 (Late), Session 4 (Absent) = 3 countable sessions!
      // Attended: 1 (Present) + 0.5 (Late) = 1.5 attended!
      // Percentage: (1.5 / 3) * 100 = 50.00%
      const reportRes = await request(app)
        .get(`/api/v1/attendance/students/${student1DocId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(reportRes.status).toBe(200);
      expect(reportRes.body.data.summary.totalSessions).toBe(4); // Excludes cancelled s5
      expect(reportRes.body.data.summary.countableSessions).toBe(3); // Excludes excused s3
      expect(reportRes.body.data.summary.attendedSessions).toBe(1.5);
      expect(reportRes.body.data.summary.percentage).toBe(50);
    });

    it('12. should detect shortage and flag students falling below threshold', async () => {
      // Ensure policy is 75%
      await request(app)
        .post('/api/v1/attendance/policy')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          academicYear: yearId,
          institutionThreshold: 75,
          warningThreshold: 85,
        });

      // Session with Student 1 Present, Student 2 Absent
      const s = await request(app)
        .post('/api/v1/attendance/sessions')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          academicYear: yearId,
          section: sectionId,
          subject: subjectId,
          teacher: teacherDocId,
          date: '2026-09-01',
          semester: 5,
          periodNumber: 1,
        });

      await request(app)
        .post(`/api/v1/attendance/sessions/${s.body.data._id}/records`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          records: [
            { student: student1DocId, status: 'Present' },
            { student: student2DocId, status: 'Absent' },
          ],
        });

      const shortagesRes = await request(app)
        .get(`/api/v1/attendance/shortages?sectionId=${sectionId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(shortagesRes.status).toBe(200);
      const student2Stats = shortagesRes.body.data.find(
        (st: { studentId: string }) => st.studentId === student2DocId
      );
      expect(student2Stats.percentage).toBe(0);
      expect(student2Stats.isShortage).toBe(true);
    });
  });

  describe('Permissions & Access Restrictions', () => {
    it('7. should allow student to view only their own attendance, and reject viewing others', async () => {
      // Student 1 views own attendance
      const ownRes = await request(app)
        .get(`/api/v1/attendance/students/${student1DocId}`)
        .set('Authorization', `Bearer ${student1Token}`);
      expect(ownRes.status).toBe(200);

      // Student 1 attempts to view Student 2's attendance
      const forbiddenRes = await request(app)
        .get(`/api/v1/attendance/students/${student2DocId}`)
        .set('Authorization', `Bearer ${student1Token}`);
      expect(forbiddenRes.status).toBe(403);
    });

    it('8. should allow parent to view linked child attendance, and reject unlinked students', async () => {
      // Parent views linked child (Student 1)
      const linkedRes = await request(app)
        .get(`/api/v1/attendance/students/${student1DocId}`)
        .set('Authorization', `Bearer ${parentToken}`);
      expect(linkedRes.status).toBe(200);

      // Parent attempts to view unlinked student (Student 2)
      const unlinkedRes = await request(app)
        .get(`/api/v1/attendance/students/${student2DocId}`)
        .set('Authorization', `Bearer ${parentToken}`);
      expect(unlinkedRes.status).toBe(403);
    });

    it('15. should support date-range and summary reports', async () => {
      const summaryRes = await request(app)
        .get(`/api/v1/attendance/summary?sectionId=${sectionId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(summaryRes.status).toBe(200);
      expect(summaryRes.body.data.totalSessions).toBeDefined();
      expect(summaryRes.body.data.overallPercentage).toBeDefined();
    });
  });
});
