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
import { Examination } from '../../src/models/examination.model';
import { ExaminationResult } from '../../src/models/examinationResult.model';
import { ROLES } from '../../src/constants/roles.constant';

describe('Phase 5 – Assessments, Examinations & Results Management Integration Tests', () => {
  let adminToken: string;
  let teacher1Token: string;
  let teacher2Token: string;
  let student1Token: string;
  let parentToken: string;

  let teacher1DocId: string;
  let student1DocId: string;
  let student2DocId: string;

  let yearId: string;
  let sectionAId: string;
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

    const studentDoc2 = await Student.create({
      user: studentUser2._id,
      usn: '1MS21CS002',
      rollNumber: '002',
      firstName: 'Charles',
      lastName: 'Babbage',
      department: dept._id,
      class: academicClass._id,
      section: sectionA._id,
      semester: 5,
      academicYear: academicYear._id,
      status: 'Active',
    });
    student2DocId = studentDoc2._id.toString();

    // 5. Parent
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

  describe('Module 1: Examination Lifecycle Management', () => {
    it('1. should allow administrator to create an examination', async () => {
      const res = await request(app)
        .post('/api/v1/examinations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Odd Semester 2026 Internal Assessment 1',
          examinationCode: 'IA1-2026-CSE',
          examinationType: 'IA1',
          academicYear: yearId,
          semester: 5,
          startDate: '2026-09-15',
          endDate: '2026-09-20',
          maximumMarks: 50,
          passingMarks: 20,
          duration: 90,
          instructions: 'Standard VTU examination guidelines apply.',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.examinationCode).toBe('IA1-2026-CSE');
      expect(res.body.data.status).toBe('draft');
    });

    it('4. should reject examination with invalid academic references or semester mismatch', async () => {
      const res = await request(app)
        .post('/api/v1/examinations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Invalid Exam Test',
          examinationCode: 'INV-2026-001',
          examinationType: 'IA1',
          academicYear: yearId,
          semester: 7, // Mismatch with subject semester 5
          subject: subjectId,
          startDate: '2026-09-15',
          endDate: '2026-09-20',
          maximumMarks: 50,
          passingMarks: 20,
          duration: 90,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Semester mismatch');
    });
  });

  describe('Module 2: Examination Timetable Scheduling & Conflict Prevention', () => {
    let examId: string;

    beforeEach(async () => {
      const exam = await Examination.create({
        name: 'IA1 CSE Sem 5',
        examinationCode: 'IA1-CSE-SEM5',
        examinationType: 'IA1',
        academicYear: yearId,
        semester: 5,
        startDate: new Date('2026-09-15'),
        endDate: new Date('2026-09-20'),
        maximumMarks: 50,
        passingMarks: 20,
        duration: 90,
        createdBy: teacher1DocId,
      });
      examId = exam._id.toString();
    });

    it('2. should schedule examination slot with venue and invigilator', async () => {
      const res = await request(app)
        .post(`/api/v1/examinations/${examId}/schedule`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          subject: subjectId,
          section: sectionAId,
          examDate: '2026-09-16',
          startTime: '09:30',
          endTime: '11:00',
          venue: 'Lecture Hall 201',
          invigilators: [teacher1DocId],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.venue).toBe('Lecture Hall 201');
      expect(res.body.data.status).toBe('scheduled');
    });

    it('3. should prevent overlapping examination schedules for the same section', async () => {
      // First schedule
      await request(app)
        .post(`/api/v1/examinations/${examId}/schedule`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          subject: subjectId,
          section: sectionAId,
          examDate: '2026-09-16',
          startTime: '09:30',
          endTime: '11:00',
          venue: 'LH-201',
        });

      // Second schedule in identical slot for same section -> 409 Conflict
      const conflictRes = await request(app)
        .post(`/api/v1/examinations/${examId}/schedule`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          subject: subjectId,
          section: sectionAId,
          examDate: '2026-09-16',
          startTime: '09:30',
          endTime: '11:00',
          venue: 'LH-202',
        });

      expect(conflictRes.status).toBe(409);
      expect(conflictRes.body.message).toContain('already scheduled');
    });
  });

  describe('Module 4, 5 & 6: Marks Entry, Dynamic Grading & Results', () => {
    let examId: string;

    beforeEach(async () => {
      const exam = await Examination.create({
        name: 'IA1 Database Systems',
        examinationCode: 'IA1-DBS-2026',
        examinationType: 'IA1',
        academicYear: yearId,
        semester: 5,
        startDate: new Date('2026-09-15'),
        endDate: new Date('2026-09-20'),
        maximumMarks: 50,
        passingMarks: 20,
        duration: 90,
        createdBy: teacher1DocId,
      });
      examId = exam._id.toString();
    });

    it('5 & 6. should allow assigned teacher to bulk enter marks and reject unassigned teacher', async () => {
      // Unassigned Teacher 2 attempt -> 403 Forbidden
      const unassignedRes = await request(app)
        .post(`/api/v1/examinations/${examId}/marks`)
        .set('Authorization', `Bearer ${teacher2Token}`)
        .send({
          subject: subjectId,
          marks: [{ student: student1DocId, marksObtained: 42 }],
        });
      expect(unassignedRes.status).toBe(403);
      expect(unassignedRes.body.message).toContain('not actively assigned to teach this subject');

      // Assigned Teacher 1 bulk entry
      const successRes = await request(app)
        .post(`/api/v1/examinations/${examId}/marks`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({
          subject: subjectId,
          marks: [
            { student: student1DocId, marksObtained: 45 }, // 45/50 = 90% (Grade O)
            { student: student2DocId, marksObtained: 15 }, // 15/50 = 30% (Grade F)
          ],
        });

      expect(successRes.status).toBe(200);
      expect(successRes.body.data).toHaveLength(2);
      expect(successRes.body.data[0].percentage).toBe(90);
      expect(successRes.body.data[0].grade).toBe('O');
      expect(successRes.body.data[0].isPassed).toBe(true);
      expect(successRes.body.data[1].percentage).toBe(30);
      expect(successRes.body.data[1].grade).toBe('F');
      expect(successRes.body.data[1].isPassed).toBe(false);
    });

    it('7 & 8. should enforce maximum marks bounds and prevent duplicate results', async () => {
      // Marks overflow rejection (> 50)
      const overflowRes = await request(app)
        .post(`/api/v1/examinations/${examId}/marks`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({
          subject: subjectId,
          marks: [{ student: student1DocId, marksObtained: 65 }],
        });
      expect(overflowRes.status).toBe(400);
      expect(overflowRes.body.message).toContain('between 0 and maximum marks');

      // Enter initial marks
      await request(app)
        .post(`/api/v1/examinations/${examId}/marks`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({
          subject: subjectId,
          marks: [{ student: student1DocId, marksObtained: 40 }],
        });

      // Subsequent bulk entry updates the existing record without creating duplicate entries
      await request(app)
        .post(`/api/v1/examinations/${examId}/marks`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({
          subject: subjectId,
          marks: [{ student: student1DocId, marksObtained: 42 }],
        });

      const totalResultCount = await ExaminationResult.countDocuments({
        examination: examId,
        student: student1DocId,
        subject: subjectId,
      });
      expect(totalResultCount).toBe(1);
    });

    it('10 & 11. should calculate results using dynamic configurable grading policy', async () => {
      // Configure custom grading policy where passing threshold is 50%
      await request(app)
        .post('/api/v1/internal-assessments/configuration')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Stricter Policy',
          isDefault: true,
          minimumPassingPercentage: 50,
          iaCalculationMethod: 'BEST_2_OF_3',
        });

      const marksRes = await request(app)
        .post(`/api/v1/examinations/${examId}/marks`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({
          subject: subjectId,
          marks: [{ student: student1DocId, marksObtained: 22 }], // 22/50 = 44% -> Fail under 50% threshold!
        });

      expect(marksRes.status).toBe(200);
      expect(marksRes.body.data[0].isPassed).toBe(false);
    });

    it('12. should handle absent and exempted students correctly', async () => {
      const res = await request(app)
        .post(`/api/v1/examinations/${examId}/marks`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({
          subject: subjectId,
          marks: [
            { student: student1DocId, isAbsent: true, remarks: 'Medical absence' },
            { student: student2DocId, isExempted: true, remarks: 'Sports quota' },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.data[0].grade).toBe('AB');
      expect(res.body.data[0].isPassed).toBe(false);
      expect(res.body.data[1].grade).toBe('EX');
      expect(res.body.data[1].isPassed).toBe(true);
    });

    it('9. should calculate internal assessment summary (IA1, IA2, IA3 aggregation)', async () => {
      // 1. Create IA2 and IA3 exams
      const ia2 = await Examination.create({
        name: 'IA2 Database Systems',
        examinationCode: 'IA2-DBS-2026',
        examinationType: 'IA2',
        academicYear: yearId,
        semester: 5,
        startDate: new Date('2026-10-15'),
        endDate: new Date('2026-10-20'),
        maximumMarks: 50,
        passingMarks: 20,
        duration: 90,
        createdBy: teacher1DocId,
      });

      const ia3 = await Examination.create({
        name: 'IA3 Database Systems',
        examinationCode: 'IA3-DBS-2026',
        examinationType: 'IA3',
        academicYear: yearId,
        semester: 5,
        startDate: new Date('2026-11-15'),
        endDate: new Date('2026-11-20'),
        maximumMarks: 50,
        passingMarks: 20,
        duration: 90,
        createdBy: teacher1DocId,
      });

      // Enter marks: IA1 = 40 (80%), IA2 = 45 (90%), IA3 = 30 (60%)
      await request(app)
        .post(`/api/v1/examinations/${examId}/marks`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ subject: subjectId, marks: [{ student: student1DocId, marksObtained: 40 }] });

      await request(app)
        .post(`/api/v1/examinations/${ia2._id}/marks`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ subject: subjectId, marks: [{ student: student1DocId, marksObtained: 45 }] });

      await request(app)
        .post(`/api/v1/examinations/${ia3._id}/marks`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ subject: subjectId, marks: [{ student: student1DocId, marksObtained: 30 }] });

      // Fetch internal assessment calculation: Best 2 of 3 (90% and 80% -> average 85%)
      const iaRes = await request(app)
        .get(`/api/v1/internal-assessments/student/${student1DocId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(iaRes.status).toBe(200);
      expect(iaRes.body.data.calculationMethod).toBe('BEST_2_OF_3');
      expect(iaRes.body.data.subjects[0].calculatedInternalPercentage).toBe(85);
      expect(iaRes.body.data.subjects[0].calculatedGrade).toBe('A+');
    });
  });

  describe('Module 7: Result Publication, Access Controls & Correction Audit', () => {
    let examId: string;
    let resultId: string;

    beforeEach(async () => {
      const exam = await Examination.create({
        name: 'Semester Final Exam',
        examinationCode: 'SEM-FIN-2026',
        examinationType: 'semester',
        academicYear: yearId,
        semester: 5,
        startDate: new Date('2026-12-01'),
        endDate: new Date('2026-12-10'),
        maximumMarks: 100,
        passingMarks: 40,
        duration: 180,
        createdBy: teacher1DocId,
      });
      examId = exam._id.toString();

      // Enter marks for Student 1 and Student 2
      const marksRes = await request(app)
        .post(`/api/v1/examinations/${examId}/marks`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({
          subject: subjectId,
          marks: [
            { student: student1DocId, marksObtained: 85 },
            { student: student2DocId, marksObtained: 72 },
          ],
        });
      resultId = marksRes.body.data[0]._id;
    });

    it('14, 15 & 16. should enforce result publication lifecycle and role-based visibility', async () => {
      // 1. Before publication: Student 1 cannot view results via /my-results -> empty array
      const prePubRes = await request(app)
        .get('/api/v1/results/my-results')
        .set('Authorization', `Bearer ${student1Token}`);
      expect(prePubRes.status).toBe(200);
      expect(prePubRes.body.data).toHaveLength(0);

      // Parent also cannot view unpublished results -> empty array
      const parentPrePub = await request(app)
        .get(`/api/v1/results/student/${student1DocId}`)
        .set('Authorization', `Bearer ${parentToken}`);
      expect(parentPrePub.status).toBe(200);
      expect(parentPrePub.body.data).toHaveLength(0);

      // 2. Publish results via Admin endpoint
      const pubRes = await request(app)
        .post(`/api/v1/results/${examId}/publish`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(pubRes.status).toBe(200);
      expect(pubRes.body.data.count).toBe(2);

      // 3. After publication: Student 1 views only their own result
      const postPubRes = await request(app)
        .get('/api/v1/results/my-results')
        .set('Authorization', `Bearer ${student1Token}`);
      expect(postPubRes.status).toBe(200);
      expect(postPubRes.body.data).toHaveLength(1);
      expect(postPubRes.body.data[0].marksObtained).toBe(85);

      // Student 1 attempts to query Student 2 results -> 403 Forbidden
      const unauthorizedStudentRes = await request(app)
        .get(`/api/v1/results/student/${student2DocId}`)
        .set('Authorization', `Bearer ${student1Token}`);
      expect(unauthorizedStudentRes.status).toBe(403);

      // Parent views linked child's (Student 1) published results -> 200 OK
      const parentPostPub = await request(app)
        .get(`/api/v1/results/student/${student1DocId}`)
        .set('Authorization', `Bearer ${parentToken}`);
      expect(parentPostPub.status).toBe(200);
      expect(parentPostPub.body.data).toHaveLength(1);
      expect(parentPostPub.body.data[0].marksObtained).toBe(85);
    });

    it('17. should allow published result correction with mandatory reason and immutable audit history', async () => {
      // Publish result first
      await request(app)
        .post(`/api/v1/results/${examId}/publish`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Attempt correction without reason -> 400 Bad Request
      const noReasonRes = await request(app)
        .patch(`/api/v1/results/${resultId}/correct`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ marksObtained: 90 });
      expect(noReasonRes.status).toBe(400);
      expect(noReasonRes.body.message).toContain('Validation failed');

      // Valid correction with reason
      const correctRes = await request(app)
        .patch(`/api/v1/results/${resultId}/correct`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({
          marksObtained: 92,
          reason: 'Re-totaling verification found uncounted 7 marks in Section B',
        });

      expect(correctRes.status).toBe(200);
      expect(correctRes.body.data.marksObtained).toBe(92);
      expect(correctRes.body.data.auditHistory).toHaveLength(1);
      expect(correctRes.body.data.auditHistory[0].previousMarks).toBe(85);
      expect(correctRes.body.data.auditHistory[0].newMarks).toBe(92);
      expect(correctRes.body.data.auditHistory[0].reason).toContain('Re-totaling');
    });
  });

  describe('Module 8: Examination Analytics Engine', () => {
    it('18. should calculate overview statistics, averages, and grade distributions', async () => {
      const exam = await Examination.create({
        name: 'Analytics Final Exam',
        examinationCode: 'ANL-2026',
        examinationType: 'semester',
        academicYear: yearId,
        semester: 5,
        startDate: new Date('2026-12-01'),
        endDate: new Date('2026-12-10'),
        maximumMarks: 100,
        passingMarks: 40,
        duration: 180,
        createdBy: teacher1DocId,
      });

      // Enter marks
      await request(app)
        .post(`/api/v1/examinations/${exam._id}/marks`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({
          subject: subjectId,
          marks: [
            { student: student1DocId, marksObtained: 90 },
            { student: student2DocId, marksObtained: 30 },
          ],
        });

      // Overview analytics
      const overviewRes = await request(app)
        .get('/api/v1/examinations/analytics/overview')
        .query({ examination: exam._id.toString() })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(overviewRes.status).toBe(200);
      expect(overviewRes.body.data.totalStudentsEvaluated).toBe(2);
      expect(overviewRes.body.data.passedCount).toBe(1);
      expect(overviewRes.body.data.failedCount).toBe(1);
      expect(overviewRes.body.data.passPercentage).toBe(50);
      expect(overviewRes.body.data.averageMarks).toBe(60);

      // Grade distribution
      const gradesRes = await request(app)
        .get('/api/v1/examinations/analytics/grades')
        .query({ examination: exam._id.toString() })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(gradesRes.status).toBe(200);
      expect(gradesRes.body.data).toHaveLength(2);
    });
  });
});
