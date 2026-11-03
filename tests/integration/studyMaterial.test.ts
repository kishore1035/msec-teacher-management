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
import { StudyMaterial } from '../../src/models/studyMaterial.model';
import { ROLES } from '../../src/constants/roles.constant';

describe('Phase 7 – Study Materials & Resource Management Integration Tests', () => {
  let adminToken: string;
  let teacher1Token: string;
  let teacher2Token: string;
  let student1Token: string;
  let student2Token: string;
  let parentToken: string;

  let yearId: string;
  let sectionAId: string;
  let subject1Id: string;

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

    const sectionB = await Section.create({
      class: academicClass._id,
      academicYear: academicYear._id,
      semester: 5,
      sectionName: 'B',
      capacity: 60,
      status: 'Active',
    });

    const subject1 = await Subject.create({
      name: 'Distributed Cloud Systems',
      code: '21CS51',
      department: dept._id,
      semester: 5,
      credits: 4,
      type: 'Theory',
      status: 'Active',
    });
    subject1Id = subject1._id.toString();

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
      firstName: 'Linus',
      lastName: 'Torvalds',
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
      firstName: 'Dennis',
      lastName: 'Ritchie',
      email: 'teacher2@msec.ac.in',
      department: dept._id,
      designation: 'Associate Professor',
      qualification: 'Ph.D',
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
      firstName: 'Alice',
      lastName: 'Smith',
      department: dept._id,
      class: academicClass._id,
      section: sectionA._id,
      semester: 5,
      academicYear: academicYear._id,
      status: 'Active',
    });

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
      rollNumber: 'CS002',
      firstName: 'Bob',
      lastName: 'Jones',
      department: dept._id,
      class: academicClass._id,
      section: sectionB._id, // Enrolled in Section B
      semester: 5,
      academicYear: academicYear._id,
      status: 'Active',
    });

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
      fatherName: 'George Smith',
      primaryPhone: '+919876543212',
      students: [studentDoc1._id],
    });
  });

  // ==========================================
  // MODULE 1, 2 & 3: MATERIAL MANAGEMENT & ATTACHMENTS
  // ==========================================

  describe('Module 1 & 2: Creation, Uploads, Validation & Lifecycle', () => {
    it('1 & 2. should allow assigned teacher to create study material with attachments and publish it', async () => {
      const res = await request(app)
        .post('/api/v1/study-materials')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .field('title', 'Distributed Consensus Notes')
        .field('description', 'Comprehensive lecture notes on Raft and Paxos algorithms')
        .field('materialType', 'notes')
        .field('subject', subject1Id)
        .field('section', sectionAId)
        .field('academicYear', yearId)
        .field('semester', 5)
        .field('topic', 'Consensus Algorithms')
        .field('unit', 'Unit 3')
        .field('tags', 'distributed,consensus,raft,paxos')
        .field('visibility', 'class')
        .field('status', 'draft')
        .attach('files', Buffer.from('Sample PDF content for testing'), 'consensus-notes.pdf');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Distributed Consensus Notes');
      expect(res.body.data.attachments.length).toBe(1);
      expect(res.body.data.attachments[0].originalName).toBe('consensus-notes.pdf');
      expect(res.body.data.status).toBe('draft');

      const materialId = res.body.data._id;

      // Publish material
      const publishRes = await request(app)
        .patch(`/api/v1/study-materials/${materialId}/publish`)
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(publishRes.status).toBe(200);
      expect(publishRes.body.data.status).toBe('published');
      expect(publishRes.body.data.publishedAt).toBeDefined();
    });

    it('4. should reject unassigned teacher attempting to create material for section A', async () => {
      const res = await request(app)
        .post('/api/v1/study-materials')
        .set('Authorization', `Bearer ${teacher2Token}`)
        .field('title', 'Unauthorized Lecture Notes')
        .field('description', 'Teacher 2 is not assigned to this section')
        .field('materialType', 'lecture')
        .field('subject', subject1Id)
        .field('section', sectionAId)
        .field('academicYear', yearId)
        .field('semester', 5);

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('not actively assigned');
    });

    it('6. should reject material when subject or section semester does not match', async () => {
      const res = await request(app)
        .post('/api/v1/study-materials')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .field('title', 'Mismatched Semester Material')
        .field('description', 'Semester 7 does not match Subject semester 5')
        .field('materialType', 'notes')
        .field('subject', subject1Id)
        .field('section', sectionAId)
        .field('academicYear', yearId)
        .field('semester', 7);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('does not match');
    });

    it('7. should reject file upload with disallowed file extensions (e.g. .exe)', async () => {
      const res = await request(app)
        .post('/api/v1/study-materials')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .field('title', 'Malicious Upload Test')
        .field('description', 'Attempting executable upload')
        .field('materialType', 'other')
        .field('subject', subject1Id)
        .field('section', sectionAId)
        .field('academicYear', yearId)
        .field('semester', 5)
        .attach('files', Buffer.from('executable binary code'), 'malware.exe');

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Unsupported file type');
    });
  });

  // ==========================================
  // MODULE 4: STUDENT RESOURCE ACCESS & RBAC
  // ==========================================

  describe('Module 4: Student Resource Access & Permissions', () => {
    let publishedMaterialId: string;
    let draftMaterialId: string;
    let attachmentId: string;

    beforeEach(async () => {
      // 1. Create a published material for Section A
      const pubRes = await request(app)
        .post('/api/v1/study-materials')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .field('title', 'Cloud Architecture Presentation')
        .field('description', 'Slides on microservices patterns')
        .field('materialType', 'presentation')
        .field('subject', subject1Id)
        .field('section', sectionAId)
        .field('academicYear', yearId)
        .field('semester', 5)
        .field('status', 'published')
        .attach('files', Buffer.from('Presentation slides content'), 'cloud-arch.pdf');

      publishedMaterialId = pubRes.body.data._id;
      attachmentId = pubRes.body.data.attachments[0]._id;

      // 2. Create a draft material for Section A
      const draftRes = await request(app)
        .post('/api/v1/study-materials')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .field('title', 'Draft Exam Question Bank')
        .field('description', 'Confidential question bank draft')
        .field('materialType', 'question_paper')
        .field('subject', subject1Id)
        .field('section', sectionAId)
        .field('academicYear', yearId)
        .field('semester', 5)
        .field('status', 'draft')
        .attach('files', Buffer.from('Draft questions'), 'draft-questions.docx');

      draftMaterialId = draftRes.body.data._id;
    });

    it('3. should hide draft materials from students but allow creator teacher to view', async () => {
      // Student 1 tries to access draft material
      const studentRes = await request(app)
        .get(`/api/v1/study-materials/${draftMaterialId}`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(studentRes.status).toBe(403);
      expect(studentRes.body.message).toContain('Draft materials are not accessible');

      // Teacher 1 accesses their own draft
      const teacherRes = await request(app)
        .get(`/api/v1/study-materials/${draftMaterialId}`)
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(teacherRes.status).toBe(200);
      expect(teacherRes.body.data.title).toBe('Draft Exam Question Bank');
    });

    it('5. should allow Student 1 to view Section A materials in my-resources and reject Student 2', async () => {
      // Student 1 (Section A) queries my-resources
      const s1Res = await request(app)
        .get('/api/v1/study-materials/my-resources')
        .set('Authorization', `Bearer ${student1Token}`);

      expect(s1Res.status).toBe(200);
      expect(s1Res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(s1Res.body.data[0].title).toBe('Cloud Architecture Presentation');

      // Student 2 (Section B) queries my-resources (no materials for section B)
      const s2Res = await request(app)
        .get('/api/v1/study-materials/my-resources')
        .set('Authorization', `Bearer ${student2Token}`);

      expect(s2Res.status).toBe(200);
      expect(s2Res.body.data.length).toBe(0);
    });

    it('9. should allow Student 1 to download authorized attachment and increment download count', async () => {
      const dlRes = await request(app)
        .get(`/api/v1/study-materials/attachments/${attachmentId}/download`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(dlRes.status).toBe(200);
      expect(dlRes.header['content-type']).toContain('application/pdf');

      // Verify download count incremented on material
      const mat = await StudyMaterial.findById(publishedMaterialId);
      expect(mat?.downloadCount).toBe(1);
    });

    it('should reject parent attempting to download study material attachments directly', async () => {
      const parentDlRes = await request(app)
        .get(`/api/v1/study-materials/attachments/${attachmentId}/download`)
        .set('Authorization', `Bearer ${parentToken}`);

      expect(parentDlRes.status).toBe(403);
      expect(parentDlRes.body.message).toContain('Parents do not have permission');
    });
  });

  // ==========================================
  // MODULE 5: VERSION MANAGEMENT
  // ==========================================

  describe('Module 5: Material Version Management', () => {
    it('10 & 11. should archive previous version upon update and increment version number', async () => {
      // 1. Create initial material (version 1)
      const initRes = await request(app)
        .post('/api/v1/study-materials')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .field('title', 'Distributed Caching Strategy')
        .field('description', 'Initial caching notes covering Redis and Memcached')
        .field('materialType', 'notes')
        .field('subject', subject1Id)
        .field('section', sectionAId)
        .field('academicYear', yearId)
        .field('semester', 5)
        .field('status', 'published')
        .attach('files', Buffer.from('Initial version file content'), 'caching-v1.pdf');

      const materialId = initRes.body.data._id;
      expect(initRes.body.data.version).toBe(1);

      // 2. Update material with changeDescription and new file (version 2)
      const updateRes = await request(app)
        .put(`/api/v1/study-materials/${materialId}`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .field('title', 'Distributed Caching Strategy (v2 Revised)')
        .field('description', 'Updated with Kafka topic caching and eviction algorithms')
        .field('changeDescription', 'Added eviction algorithms and Kafka caching patterns')
        .attach('files', Buffer.from('Version 2 added file content'), 'caching-v2-eviction.pdf');

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.version).toBe(2);
      expect(updateRes.body.data.title).toBe('Distributed Caching Strategy (v2 Revised)');

      // 3. Retrieve version history
      const versionsRes = await request(app)
        .get(`/api/v1/study-materials/${materialId}/versions`)
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(versionsRes.status).toBe(200);
      expect(versionsRes.body.data.length).toBe(1);
      expect(versionsRes.body.data[0].versionNumber).toBe(1);
      expect(versionsRes.body.data[0].title).toBe('Distributed Caching Strategy');
      expect(versionsRes.body.data[0].changeDescription).toBe(
        'Added eviction algorithms and Kafka caching patterns'
      );

      // 4. Retrieve specific version details
      const v1Res = await request(app)
        .get(`/api/v1/study-materials/${materialId}/versions/1`)
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(v1Res.status).toBe(200);
      expect(v1Res.body.data.versionNumber).toBe(1);
    });

    it('14. should archive material and reflect archived status', async () => {
      const mat = await StudyMaterial.create({
        title: 'Archived Reference Text',
        description: 'Old curriculum reference book',
        materialType: 'textbook',
        subject: subject1Id,
        section: sectionAId,
        academicYear: yearId,
        semester: 5,
        teacher: (await Teacher.findOne({ employeeId: 'EMP-T1' }))!._id,
        status: 'published',
        createdBy: (await User.findOne({ email: 'teacher1@msec.ac.in' }))!._id,
      });

      const archiveRes = await request(app)
        .patch(`/api/v1/study-materials/${mat._id}/archive`)
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(archiveRes.status).toBe(200);
      expect(archiveRes.body.data.status).toBe('archived');
    });
  });

  // ==========================================
  // MODULE 3, 4 & 6: SEARCH, FILTERING & ANALYTICS
  // ==========================================

  describe('Module 3 & 6: Search, Subject Filtering & Analytics Engine', () => {
    beforeEach(async () => {
      const teacher = (await Teacher.findOne({ employeeId: 'EMP-T1' }))!;
      const user = (await User.findOne({ email: 'teacher1@msec.ac.in' }))!;

      await StudyMaterial.create([
        {
          title: 'Kubernetes Cluster Setup Guide',
          description: 'Hands-on tutorial for Minikube and K8s manifests',
          materialType: 'lecture',
          subject: subject1Id,
          section: sectionAId,
          academicYear: yearId,
          semester: 5,
          teacher: teacher._id,
          topic: 'Container Orchestration',
          unit: 'Unit 4',
          tags: ['kubernetes', 'docker', 'containers', 'cloud'],
          visibility: 'class',
          status: 'published',
          downloadCount: 42,
          viewCount: 150,
          createdBy: user._id,
        },
        {
          title: 'Docker Microservices Tutorial',
          description: 'Guide to containerizing Node.js applications',
          materialType: 'lecture',
          subject: subject1Id,
          section: sectionAId,
          academicYear: yearId,
          semester: 5,
          teacher: teacher._id,
          topic: 'Microservices',
          unit: 'Unit 2',
          tags: ['docker', 'microservices'],
          visibility: 'subject',
          status: 'published',
          downloadCount: 28,
          viewCount: 95,
          createdBy: user._id,
        },
      ]);
    });

    it('12. should perform full-text and regex search across title, topic, and tags', async () => {
      const searchRes = await request(app)
        .get('/api/v1/study-materials/search')
        .query({ q: 'kubernetes' })
        .set('Authorization', `Bearer ${student1Token}`);

      expect(searchRes.status).toBe(200);
      expect(searchRes.body.data.length).toBeGreaterThanOrEqual(1);
      expect(searchRes.body.data[0].title).toContain('Kubernetes');
    });

    it('13. should filter materials by subject with pagination metadata', async () => {
      const filterRes = await request(app)
        .get(`/api/v1/study-materials/subjects/${subject1Id}`)
        .query({ page: 1, limit: 5 })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(filterRes.status).toBe(200);
      expect(filterRes.body.data.length).toBeGreaterThanOrEqual(2);
      expect(filterRes.body.meta).toHaveProperty('totalPages');
      expect(filterRes.body.meta).toHaveProperty('total');
    });

    it('15. should calculate overview analytics, subject breakdowns, and popular resources', async () => {
      const overviewRes = await request(app)
        .get('/api/v1/study-materials/analytics/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(overviewRes.status).toBe(200);
      expect(overviewRes.body.data.totalMaterials).toBeGreaterThanOrEqual(2);
      expect(overviewRes.body.data.totalDownloads).toBeGreaterThanOrEqual(70);
      expect(overviewRes.body.data.totalViews).toBeGreaterThanOrEqual(200);

      const subjectAnalyticsRes = await request(app)
        .get('/api/v1/study-materials/analytics/subject')
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(subjectAnalyticsRes.status).toBe(200);
      expect(Array.isArray(subjectAnalyticsRes.body.data)).toBe(true);

      const popularRes = await request(app)
        .get('/api/v1/study-materials/analytics/popular')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(popularRes.status).toBe(200);
      expect(popularRes.body.data.length).toBeGreaterThanOrEqual(2);
      expect(popularRes.body.data[0].downloadCount).toBeGreaterThanOrEqual(
        popularRes.body.data[1].downloadCount
      );
    });

    it('16. should delete material and clean up associated database records', async () => {
      const mat = await StudyMaterial.findOne({ title: 'Docker Microservices Tutorial' });
      expect(mat).toBeDefined();

      const delRes = await request(app)
        .delete(`/api/v1/study-materials/${mat!._id}`)
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(delRes.status).toBe(200);

      const deletedCheck = await StudyMaterial.findById(mat!._id);
      expect(deletedCheck).toBeNull();
    });
  });
});
