import request from 'supertest';
import { app } from '../../src/app';
import { User } from '../../src/models/user.model';
import { Teacher } from '../../src/models/teacher.model';
import { ROLES } from '../../src/constants/roles.constant';
import { Types } from 'mongoose';

describe('Academic Core & Class Management Integration Tests', () => {
  let adminToken: string;
  let teacherToken: string;
  let studentToken: string;
  let teacherUserId: string;
  let teacherDocId: string;

  beforeEach(async () => {
    // 1. Create Admin User
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

    // 2. Create Teacher User & Profile
    const teacherUser = await User.create({
      email: 'prof.sharma@msec.ac.in',
      password: 'TeacherPassword123',
      role: ROLES.TEACHER,
      isActive: true,
    });
    teacherUserId = teacherUser._id.toString();

    const teacherLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'prof.sharma@msec.ac.in', password: 'TeacherPassword123' });
    teacherToken = teacherLogin.body.data.tokens.accessToken;

    // 3. Create Student User
    await User.create({
      email: 'student@msec.ac.in',
      password: 'StudentPassword123',
      role: ROLES.STUDENT,
      isActive: true,
    });

    const studentLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'student@msec.ac.in', password: 'StudentPassword123' });
    studentToken = studentLogin.body.data.tokens.accessToken;
  });

  describe('Academic Year Management', () => {
    it('1. should create an academic year when requested by admin', async () => {
      const res = await request(app)
        .post('/api/v1/academics/years')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          year: '2026-2027',
          startDate: '2026-08-01',
          endDate: '2027-05-31',
          semesterType: 'ODD',
          isCurrent: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.year).toBe('2026-2027');
      expect(res.body.data.isCurrent).toBe(true);
    });

    it('2. should set an academic year as current and unset previously current year', async () => {
      const y1 = await request(app)
        .post('/api/v1/academics/years')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          year: '2025-2026',
          startDate: '2025-08-01',
          endDate: '2026-05-31',
          semesterType: 'EVEN',
          isCurrent: true,
        });

      const y2 = await request(app)
        .post('/api/v1/academics/years')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          year: '2026-2027',
          startDate: '2026-08-01',
          endDate: '2027-05-31',
          semesterType: 'ODD',
          isCurrent: false,
        });

      const setCurrentRes = await request(app)
        .put(`/api/v1/academics/years/${y2.body.data._id}/set-current`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(setCurrentRes.status).toBe(200);
      expect(setCurrentRes.body.data.isCurrent).toBe(true);

      // Verify y1 is no longer current
      const getOldYear = await request(app)
        .get(`/api/v1/academics/years/${y1.body.data._id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(getOldYear.body.data.isCurrent).toBe(false);
    });
  });

  describe('Departments & Classes', () => {
    it('3. should create a department and prevent duplicate department codes', async () => {
      const res = await request(app)
        .post('/api/v1/departments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Computer Science & Engineering',
          code: 'CSE',
          description: 'Department of Computer Science',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.code).toBe('CSE');

      // Duplicate code check
      const duplicateRes = await request(app)
        .post('/api/v1/departments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Computer Science Secondary',
          code: 'CSE',
        });
      expect(duplicateRes.status).toBe(409);
    });

    it('4. should create an academic class linked to a department', async () => {
      const deptRes = await request(app)
        .post('/api/v1/departments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Information Science', code: 'ISE' });

      const classRes = await request(app)
        .post('/api/v1/classes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'B.E. Information Science and Engineering',
          code: 'BE-ISE',
          department: deptRes.body.data._id,
          degree: 'B.E.',
          durationYears: 4,
        });

      expect(classRes.status).toBe(201);
      expect(classRes.body.data.code).toBe('BE-ISE');
    });
  });

  describe('Sections, Subjects & Teacher Assignments Workflow', () => {
    let deptId: string;
    let classId: string;
    let yearId: string;
    let sectionId: string;
    let subjectId: string;

    beforeEach(async () => {
      // Create Dept
      const deptRes = await request(app)
        .post('/api/v1/departments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Computer Science', code: 'CSE' });
      deptId = deptRes.body.data._id;

      // Link Teacher Profile
      const teacherDoc = await Teacher.create({
        user: new Types.ObjectId(teacherUserId),
        employeeId: 'EMP-CSE-001',
        firstName: 'Rajesh',
        lastName: 'Sharma',
        department: new Types.ObjectId(deptId),
        designation: 'Assistant Professor',
        qualification: 'M.Tech, Ph.D.',
        phone: '9876543210',
        status: 'Active',
      });
      teacherDocId = teacherDoc._id.toString();

      // Create Class
      const classRes = await request(app)
        .post('/api/v1/classes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'B.E. Computer Science',
          code: 'BE-CSE',
          department: deptId,
          degree: 'B.E.',
          durationYears: 4,
        });
      classId = classRes.body.data._id;

      // Create Academic Year
      const yearRes = await request(app)
        .post('/api/v1/academics/years')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          year: '2026-2027',
          startDate: '2026-08-01',
          endDate: '2027-05-31',
          semesterType: 'ODD',
          isCurrent: true,
        });
      yearId = yearRes.body.data._id;
    });

    it('5. should create a section with teacher assignment', async () => {
      const sectionRes = await request(app)
        .post('/api/v1/sections')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          class: classId,
          academicYear: yearId,
          semester: 5,
          sectionName: 'A',
          classTeacher: teacherDocId,
          roomNumber: 'L301',
          capacity: 65,
        });

      expect(sectionRes.status).toBe(201);
      expect(sectionRes.body.data.sectionName).toBe('A');
      expect(sectionRes.body.data.semester).toBe(5);
    });

    it('6. should create a subject with syllabus modules', async () => {
      const subRes = await request(app)
        .post('/api/v1/subjects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Database Management Systems',
          code: '21CS51',
          department: deptId,
          semester: 5,
          credits: 4,
          subjectType: 'Theory',
          modules: [
            {
              moduleNumber: 1,
              title: 'Introduction to DBMS',
              topics: ['Data Models', 'ER Diagrams', 'Relational Algebra'],
            },
          ],
        });

      expect(subRes.status).toBe(201);
      expect(subRes.body.data.code).toBe('21CS51');
      expect(subRes.body.data.modules.length).toBe(1);
    });

    it('7 & 8. should assign a teacher to a subject and prevent duplicate active assignments', async () => {
      const sectionRes = await request(app)
        .post('/api/v1/sections')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          class: classId,
          academicYear: yearId,
          semester: 5,
          sectionName: 'A',
        });
      sectionId = sectionRes.body.data._id;

      const subRes = await request(app)
        .post('/api/v1/subjects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Computer Networks',
          code: '21CS52',
          department: deptId,
          semester: 5,
          credits: 4,
          subjectType: 'Theory',
        });
      subjectId = subRes.body.data._id;

      // 7. Successful Assignment
      const assignRes = await request(app)
        .post('/api/v1/teacher-assignments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          teacher: teacherDocId,
          subject: subjectId,
          section: sectionId,
          academicYear: yearId,
          semester: 5,
          isPrimary: true,
        });

      expect(assignRes.status).toBe(201);
      expect(assignRes.body.success).toBe(true);

      // 8. Duplicate Prevention
      const duplicateAssign = await request(app)
        .post('/api/v1/teacher-assignments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          teacher: teacherDocId,
          subject: subjectId,
          section: sectionId,
          academicYear: yearId,
          semester: 5,
        });

      expect(duplicateAssign.status).toBe(409);
      expect(duplicateAssign.body.message).toContain('already exists');
    });

    it('9. should reject assignment when subject semester does not match section semester', async () => {
      const sectionRes = await request(app)
        .post('/api/v1/sections')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          class: classId,
          academicYear: yearId,
          semester: 5,
          sectionName: 'B',
        });

      const subSem7Res = await request(app)
        .post('/api/v1/subjects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Advanced Machine Learning',
          code: '21CS71',
          department: deptId,
          semester: 7,
          credits: 4,
        });

      const mismatchRes = await request(app)
        .post('/api/v1/teacher-assignments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          teacher: teacherDocId,
          subject: subSem7Res.body.data._id,
          section: sectionRes.body.data._id,
          academicYear: yearId,
          semester: 5,
        });

      expect(mismatchRes.status).toBe(400);
      expect(mismatchRes.body.message).toContain('Semester mismatch');
    });

    it('10. should deny unauthorized access to student attempting administrative writes', async () => {
      const res = await request(app)
        .post('/api/v1/departments')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ name: 'Hacked Department', code: 'HACK' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('11. should allow logged-in teacher to retrieve their own assigned classes, subjects, and assignments', async () => {
      // Provision section and subject
      const sectionRes = await request(app)
        .post('/api/v1/sections')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          class: classId,
          academicYear: yearId,
          semester: 5,
          sectionName: 'C',
        });

      const subRes = await request(app)
        .post('/api/v1/subjects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Software Engineering',
          code: '21CS53',
          department: deptId,
          semester: 5,
          credits: 3,
        });

      // Assign teacher
      await request(app)
        .post('/api/v1/teacher-assignments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          teacher: teacherDocId,
          subject: subRes.body.data._id,
          section: sectionRes.body.data._id,
          academicYear: yearId,
          semester: 5,
        });

      // Query /teachers/me/assignments
      const myAssignments = await request(app)
        .get('/api/v1/teachers/me/assignments')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(myAssignments.status).toBe(200);
      expect(myAssignments.body.data.length).toBe(1);

      // Query /teachers/me/classes
      const myClasses = await request(app)
        .get('/api/v1/teachers/me/classes')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(myClasses.status).toBe(200);
      expect(myClasses.body.data.length).toBe(1);

      // Query /teachers/me/subjects
      const mySubjects = await request(app)
        .get('/api/v1/teachers/me/subjects')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(mySubjects.status).toBe(200);
      expect(mySubjects.body.data.length).toBe(1);
    });

    it('12. should soft-deactivate teacher assignment and preserve historical record', async () => {
      const sectionRes = await request(app)
        .post('/api/v1/sections')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          class: classId,
          academicYear: yearId,
          semester: 5,
          sectionName: 'D',
        });

      const subRes = await request(app)
        .post('/api/v1/subjects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Web Technology',
          code: '21CS54',
          department: deptId,
          semester: 5,
          credits: 3,
        });

      const assignRes = await request(app)
        .post('/api/v1/teacher-assignments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          teacher: teacherDocId,
          subject: subRes.body.data._id,
          section: sectionRes.body.data._id,
          academicYear: yearId,
          semester: 5,
        });

      const assignmentId = assignRes.body.data._id;

      // Delete (soft deactivate)
      const deleteRes = await request(app)
        .delete(`/api/v1/teacher-assignments/${assignmentId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(deleteRes.status).toBe(200);

      // Verify assignment document still exists in DB as 'Inactive'
      const checkRes = await request(app)
        .get(`/api/v1/teacher-assignments/${assignmentId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(checkRes.status).toBe(200);
      expect(checkRes.body.data.status).toBe('Inactive');
    });
  });
});
