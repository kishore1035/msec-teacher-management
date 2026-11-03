import request from 'supertest';
import http from 'http';
import { io as ClientIO, Socket as ClientSocket } from 'socket.io-client';
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
  Announcement,
  Notification,
} from '../../src/models';
import { ROLES } from '../../src/constants/roles.constant';
import { AnnouncementService } from '../../src/services/announcement.service';
import { NotificationService } from '../../src/services/notification.service';
import {
  NotificationDeliveryService,
  IEmailNotificationProvider,
} from '../../src/services/notificationDelivery.service';
import { SocketService } from '../../src/services/socket.service';

describe('Phase 9: Announcements & Notifications Management Integration Tests', () => {
  let adminToken: string;
  let teacher1Token: string;
  let teacher1UserId: string;
  let teacher2Token: string;
  let student1Token: string;
  let student1UserId: string;
  let student1DocId: string;
  let student2Token: string;
  let student2UserId: string;
  let student2DocId: string;
  let parent1Token: string;
  let parent1UserId: string;
  let parent2Token: string;

  let dept1Id: string;
  let class1Id: string;
  let sectionAId: string;
  let sectionBId: string;
  let subject1Id: string;

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

    // 2. Create Academic Foundation (AcademicYear, Departments, Classes, Sections, Subjects)
    const academicYear = await AcademicYear.create({
      year: '2026-2027',
      startDate: new Date('2026-08-01'),
      endDate: new Date('2027-05-31'),
      semesterType: 'ODD',
      isCurrent: true,
    });

    const dept1 = await Department.create({
      name: 'Computer Science & Engineering',
      code: 'CSE',
    });
    dept1Id = dept1._id.toString();

    const dept2 = await Department.create({
      name: 'Electronics & Communication',
      code: 'ECE',
    });

    const cls1 = await Class.create({
      name: 'B.E. CSE',
      code: 'BECSE',
      department: dept1._id,
      degree: 'B.E.',
      durationYears: 4,
    });
    class1Id = cls1._id.toString();

    const cls2 = await Class.create({
      name: 'B.E. ECE',
      code: 'BEECE',
      department: dept2._id,
      degree: 'B.E.',
      durationYears: 4,
    });

    // 3. Create Teachers
    const t1User = await User.create({
      email: 'teacher1@msec.ac.in',
      password: 'Password123',
      role: ROLES.TEACHER,
      isActive: true,
    });
    teacher1UserId = t1User._id.toString();
    const t1Doc = await Teacher.create({
      user: t1User._id,
      employeeId: 'EMP101',
      firstName: 'Ananya',
      lastName: 'Rao',
      department: dept1._id,
      designation: 'Associate Professor',
      qualification: 'Ph.D.',
      phone: '9876543210',
      status: 'Active',
    });

    const t1Login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'teacher1@msec.ac.in', password: 'Password123' });
    teacher1Token = t1Login.body.data.tokens.accessToken;

    const t2User = await User.create({
      email: 'teacher2@msec.ac.in',
      password: 'Password123',
      role: ROLES.TEACHER,
      isActive: true,
    });
    await Teacher.create({
      user: t2User._id,
      employeeId: 'EMP102',
      firstName: 'Vikram',
      lastName: 'Menon',
      department: dept2._id,
      designation: 'Assistant Professor',
      qualification: 'M.Tech',
      phone: '9876543211',
      status: 'Active',
    });
    const t2Login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'teacher2@msec.ac.in', password: 'Password123' });
    teacher2Token = t2Login.body.data.tokens.accessToken;

    // 4. Create Sections & Subjects & TeacherAssignment
    const secA = await Section.create({
      class: cls1._id,
      academicYear: academicYear._id,
      semester: 5,
      sectionName: 'A',
      classTeacher: t1Doc._id,
      capacity: 60,
    });
    sectionAId = secA._id.toString();

    const secB = await Section.create({
      class: cls2._id,
      academicYear: academicYear._id,
      semester: 5,
      sectionName: 'B',
      capacity: 60,
    });
    sectionBId = secB._id.toString();

    const sub1 = await Subject.create({
      name: 'Operating Systems',
      code: 'CS501',
      department: dept1._id,
      semester: 5,
      credits: 4,
      subjectType: 'Theory',
    });
    subject1Id = sub1._id.toString();

    await Subject.create({
      name: 'Digital Signal Processing',
      code: 'EC501',
      department: dept2._id,
      semester: 5,
      credits: 4,
      subjectType: 'Theory',
    });

    await TeacherAssignment.create({
      teacher: t1Doc._id,
      subject: sub1._id,
      section: secA._id,
      academicYear: academicYear._id,
      semester: 5,
      status: 'Active',
    });

    // 5. Create Students & Parents
    const s1User = await User.create({
      email: 'student1@msec.ac.in',
      password: 'Password123',
      role: ROLES.STUDENT,
      isActive: true,
    });
    student1UserId = s1User._id.toString();

    const p1User = await User.create({
      email: 'parent1@msec.ac.in',
      password: 'Password123',
      role: ROLES.PARENT,
      isActive: true,
    });
    parent1UserId = p1User._id.toString();

    const s1Doc = await Student.create({
      user: s1User._id,
      usn: '1MS24CS001',
      rollNumber: '01',
      firstName: 'Rohan',
      lastName: 'Sharma',
      department: dept1._id,
      class: cls1._id,
      section: secA._id,
      semester: 5,
      academicYear: academicYear._id,
      phone: '9123456780',
      status: 'Active',
    });
    student1DocId = s1Doc._id.toString();

    const p1Doc = await Parent.create({
      user: p1User._id,
      fatherName: 'Rajesh Sharma',
      primaryPhone: '9123456789',
      students: [s1Doc._id],
    });
    s1Doc.parent = p1Doc._id;
    await s1Doc.save();

    const s2User = await User.create({
      email: 'student2@msec.ac.in',
      password: 'Password123',
      role: ROLES.STUDENT,
      isActive: true,
    });
    student2UserId = s2User._id.toString();

    const p2User = await User.create({
      email: 'parent2@msec.ac.in',
      password: 'Password123',
      role: ROLES.PARENT,
      isActive: true,
    });

    const s2Doc = await Student.create({
      user: s2User._id,
      usn: '1MS24EC001',
      rollNumber: '01',
      firstName: 'Meera',
      lastName: 'Nair',
      department: dept2._id,
      class: cls2._id,
      section: sectionBId,
      semester: 5,
      academicYear: academicYear._id,
      phone: '9123456790',
      status: 'Active',
    });
    student2DocId = s2Doc._id.toString();

    const p2Doc = await Parent.create({
      user: p2User._id,
      motherName: 'Lakshmi Nair',
      primaryPhone: '9123456799',
      students: [s2Doc._id],
    });
    s2Doc.parent = p2Doc._id;
    await s2Doc.save();

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
  // 1 & 2. ANNOUNCEMENT CREATION, EDIT HISTORY, AND PUBLICATION
  // =========================================================================
  describe('1 & 2. Announcement Creation & Publication', () => {
    it('should create a draft announcement, keep it hidden from students, preserve edit history, and publish it', async () => {
      // Create draft announcement by Admin
      const createRes = await request(app)
        .post('/api/v1/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Semester End Convocation Notice',
          content: 'Initial draft details for convocation.',
          summary: 'Convocation draft summary',
          announcementType: 'event',
          priority: 'high',
          targetAudience: 'all',
          status: 'draft',
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.data.status).toBe('draft');
      const annId = createRes.body.data._id;

      // Student cannot see draft in list or by ID
      const studentListDraft = await request(app)
        .get('/api/v1/announcements')
        .set('Authorization', `Bearer ${student1Token}`);
      expect(studentListDraft.status).toBe(200);
      expect(studentListDraft.body.data).toHaveLength(0);

      const studentGetDraft = await request(app)
        .get(`/api/v1/announcements/${annId}`)
        .set('Authorization', `Bearer ${student1Token}`);
      expect(studentGetDraft.status).toBe(403);

      // Update announcement and verify editHistory & auditLog are preserved
      const updateRes = await request(app)
        .put(`/api/v1/announcements/${annId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Updated Semester End Convocation Notice',
          content: 'Finalized schedule for convocation in Main Auditorium.',
          changeNote: 'Updated venue and finalized schedule',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.title).toBe('Updated Semester End Convocation Notice');
      expect(updateRes.body.data.editHistory).toHaveLength(1);
      expect(updateRes.body.data.editHistory[0].previousTitle).toBe(
        'Semester End Convocation Notice'
      );

      // Publish announcement
      const publishRes = await request(app)
        .patch(`/api/v1/announcements/${annId}/publish`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(publishRes.status).toBe(200);
      expect(publishRes.body.data.status).toBe('published');
      expect(publishRes.body.data.publishedAt).toBeDefined();
      expect(publishRes.body.data.targetRecipientCount).toBeGreaterThanOrEqual(7);

      // Now Student 1 can view the published announcement and has an in-app notification
      const studentListPub = await request(app)
        .get('/api/v1/announcements')
        .set('Authorization', `Bearer ${student1Token}`);
      expect(studentListPub.status).toBe(200);
      expect(studentListPub.body.data).toHaveLength(1);
      // Recipient lists must not be exposed to students
      expect(studentListPub.body.data[0].resolvedRecipientsSnapshot).toBeUndefined();
      expect(studentListPub.body.data[0].specificRecipients).toBeUndefined();
    });
  });

  // =========================================================================
  // 3 & 4. SCHEDULED PUBLISHING AND ANNOUNCEMENT EXPIRY
  // =========================================================================
  describe('3 & 4. Scheduled Announcement Publishing & Expiry', () => {
    it('should schedule future announcements, recalculate recipients upon publication, and hide expired announcements', async () => {
      const futurePublishAt = new Date(Date.now() + 60 * 60 * 1000); // +1h
      const futureExpiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // +2h

      const schedRes = await request(app)
        .post('/api/v1/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Scheduled Academic Calendar Release',
          content: 'Calendar will be visible at scheduled time.',
          announcementType: 'academic',
          priority: 'normal',
          targetAudience: 'students',
          targetSections: [sectionAId],
          publishAt: futurePublishAt.toISOString(),
          expiresAt: futureExpiresAt.toISOString(),
        });

      expect(schedRes.status).toBe(201);
      expect(schedRes.body.data.status).toBe('scheduled');
      const scheduledId = schedRes.body.data._id;

      // Before publishAt, student1 cannot see it and no notification is generated yet
      const beforeList = await request(app)
        .get('/api/v1/announcements')
        .set('Authorization', `Bearer ${student1Token}`);
      expect(beforeList.body.data).toHaveLength(0);

      // Trigger scheduled processor at futurePublishAt
      const procResult = await AnnouncementService.processScheduledAnnouncements(
        new Date(futurePublishAt.getTime() + 1000)
      );
      expect(procResult.publishedCount).toBe(1);
      expect(procResult.announcementIds).toContain(scheduledId);

      // Student 1 now receives the notification
      const s1Notifs = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${student1Token}`);
      expect(s1Notifs.body.data).toHaveLength(1);
      expect(s1Notifs.body.data[0].title).toBe('Scheduled Academic Calendar Release');

      // Now expire the announcement in DB and verify it is hidden from Student 1
      await Announcement.findByIdAndUpdate(scheduledId, {
        $set: { expiresAt: new Date(Date.now() - 10000) },
      });

      const afterExpiryList = await request(app)
        .get('/api/v1/announcements')
        .set('Authorization', `Bearer ${student1Token}`);
      expect(afterExpiryList.body.data).toHaveLength(0);

      const afterExpiryGet = await request(app)
        .get(`/api/v1/announcements/${scheduledId}`)
        .set('Authorization', `Bearer ${student1Token}`);
      expect(afterExpiryGet.status).toBe(403);
    });
  });

  // =========================================================================
  // 5, 6, 7, 8. AUDIENCE TARGETING, DEDUPLICATION, TEACHER RESTRICTIONS, PARENT-CHILD & SECTION CHANGE
  // =========================================================================
  describe('5, 6, 7, 8. Audience Targeting, Deduplication, Teacher RBAC & Parent-Child Resolution', () => {
    it('should deduplicate overlapping target groups and isolate section announcements', async () => {
      // Target Student 1 via department, class, section, subject, AND specificRecipients simultaneously
      const res = await request(app)
        .post('/api/v1/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'CSE Section A Lab Notice',
          content: 'OS Lab assessment tomorrow.',
          announcementType: 'academic',
          targetAudience: 'selected',
          targetRoles: ['STUDENT'],
          targetDepartments: [dept1Id],
          targetClasses: [class1Id],
          targetSections: [sectionAId],
          targetSubjects: [subject1Id],
          specificRecipients: [student1UserId],
          status: 'published',
        });

      expect(res.status).toBe(201);
      // Only Student 1 matches CSE/Section A; must be deduplicated to exactly 1 recipient
      expect(res.body.data.targetRecipientCount).toBe(1);

      const s1Notifs = await Notification.find({
        announcement: res.body.data._id,
        recipient: student1UserId,
      });
      expect(s1Notifs).toHaveLength(1);

      // Student 2 (in ECE Section B) must not receive or see it
      const s2Notifs = await Notification.find({
        announcement: res.body.data._id,
        recipient: student2UserId,
      });
      expect(s2Notifs).toHaveLength(0);
    });

    it('should prevent teachers from targeting institution-wide or unauthorized sections/subjects', async () => {
      // Teacher 1 tries institution-wide announcement -> 403
      const instWideRes = await request(app)
        .post('/api/v1/announcements')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({
          title: 'Unauthorized All Campus Broadcast',
          content: 'Should be rejected.',
          targetAudience: 'all',
          status: 'published',
        });
      expect(instWideRes.status).toBe(403);

      // Teacher 1 tries targeting Section B (not assigned to Teacher 1) -> 403
      const unauthorizedSecRes = await request(app)
        .post('/api/v1/announcements')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({
          title: 'Unauthorized Section B Notice',
          content: 'Should be rejected.',
          targetAudience: 'students',
          targetSections: [sectionBId],
          status: 'published',
        });
      expect(unauthorizedSecRes.status).toBe(403);

      // Teacher 1 targets authorized Section A and Subject 1 -> 201
      const validTeacherRes = await request(app)
        .post('/api/v1/announcements')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({
          title: 'CS501 Operating Systems Tutorial',
          content: 'Bring kernel lab manuals.',
          announcementType: 'academic',
          targetAudience: 'students',
          targetSections: [sectionAId],
          targetSubjects: [subject1Id],
          status: 'published',
        });
      expect(validTeacherRes.status).toBe(201);
      expect(validTeacherRes.body.data.targetRecipientCount).toBe(1);
    });

    it('should ensure parents receive announcements only for their linked children and handle student section changes without exposing historical announcements', async () => {
      // Publish announcement for parents of Section A
      const parentAnnRes = await request(app)
        .post('/api/v1/announcements')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({
          title: 'Parent-Teacher Meeting for CSE Section A',
          content: 'PTM scheduled this Saturday at 10:00 AM.',
          announcementType: 'event',
          targetAudience: 'parents',
          targetSections: [sectionAId],
          status: 'published',
        });

      expect(parentAnnRes.status).toBe(201);
      const annId = parentAnnRes.body.data._id;

      // Parent 1 (linked to Student 1 in Section A) receives notification and can view announcement
      const p1Notifs = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${parent1Token}`);
      expect(p1Notifs.body.data).toHaveLength(1);

      const p1View = await request(app)
        .get(`/api/v1/announcements/${annId}`)
        .set('Authorization', `Bearer ${parent1Token}`);
      expect(p1View.status).toBe(200);

      // Parent 2 (linked to Student 2 in Section B) does NOT receive notification and cannot view it
      const p2Notifs = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${parent2Token}`);
      expect(p2Notifs.body.data).toHaveLength(0);

      const p2View = await request(app)
        .get(`/api/v1/announcements/${annId}`)
        .set('Authorization', `Bearer ${parent2Token}`);
      expect(p2View.status).toBe(403);

      // Publish a student announcement for Section A, then move Student 2 into Section A AFTER publication
      const secAAnn = await request(app)
        .post('/api/v1/announcements')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({
          title: 'Historical Section A Quiz Notice',
          content: 'Historical announcement before Student 2 transferred.',
          targetAudience: 'students',
          targetSections: [sectionAId],
          status: 'published',
        });
      const historicalAnnId = secAAnn.body.data._id;

      // Move Student 2 to Section A after publication
      await Student.findByIdAndUpdate(student2DocId, { $set: { section: sectionAId } });

      // Student 2 must NOT retroactively see the historical announcement published prior to their section transfer
      const s2ViewHistorical = await request(app)
        .get(`/api/v1/announcements/${historicalAnnId}`)
        .set('Authorization', `Bearer ${student2Token}`);
      expect(s2ViewHistorical.status).toBe(403);
    });
  });

  // =========================================================================
  // 9 & 10. DOMAIN EVENT NOTIFICATIONS & DUPLICATE NOTIFICATION PREVENTION
  // =========================================================================
  describe('9 & 10. Domain Event Notifications & Deduplication', () => {
    it('should generate domain notifications (assignment, exam, attendance, timetable, leave/substitution, admin) and prevent duplicates for the same eventKey', async () => {
      const dummyEntityId = sectionAId;

      // 1. Assignment deadline notification (call twice -> only 1 created)
      const c1 = await NotificationService.notifyAssignmentDeadline({
        recipients: [student1UserId],
        assignmentId: dummyEntityId,
        assignmentTitle: 'OS Process Scheduling Lab',
        dueDate: new Date(Date.now() + 86400000),
      });
      const c1Dup = await NotificationService.notifyAssignmentDeadline({
        recipients: [student1UserId],
        assignmentId: dummyEntityId,
        assignmentTitle: 'OS Process Scheduling Lab',
        dueDate: new Date(Date.now() + 86400000),
      });
      expect(c1).toBe(1);
      expect(c1Dup).toBe(0);

      // 2. Examination schedule & result notifications
      const examCount = await NotificationService.notifyExaminationEvent({
        recipients: [student1UserId],
        examinationId: dummyEntityId,
        eventType: 'result',
        title: 'Mid-Term Results Published',
        message: 'Your Mid-Term Examination results are now available.',
      });
      expect(examCount).toBe(1);

      // 3. Attendance warning notification
      const attCount = await NotificationService.notifyAttendanceWarning({
        recipients: [student1UserId, parent1UserId],
        studentId: student1DocId,
        subjectId: subject1Id,
        percentage: 68.5,
        threshold: 75,
        periodKey: '2026-11',
      });
      expect(attCount).toBe(2);

      // 4. Timetable change & substitution notifications
      const ttCount = await NotificationService.notifyTimetableChange({
        recipients: [student1UserId],
        timetableChangeId: dummyEntityId,
        changeType: 'classroom_change',
        message: 'Period 2 moved to Room 304.',
      });
      expect(ttCount).toBe(1);

      const subCount = await NotificationService.notifyLeaveOrSubstitution({
        recipients: [teacher1UserId],
        entityId: dummyEntityId,
        updateType: 'substitution_update',
        title: 'Substitution Assigned',
        message: 'You have been assigned Period 4 substitution for CSE-A.',
      });
      expect(subCount).toBe(1);

      // 5. Direct administrative notification via REST API with eventKey deduplication
      const apiEvent1 = await request(app)
        .post('/api/v1/notifications/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          recipients: [student1UserId],
          title: 'Scholarship Document Verification',
          message: 'Please submit original certificates to the Admin Office.',
          notificationType: 'administrative',
          priority: 'high',
          eventKey: 'admin_scholarship_verify_2026',
        });
      expect(apiEvent1.status).toBe(201);
      expect(apiEvent1.body.data.createdCount).toBe(1);

      const apiEventDup = await request(app)
        .post('/api/v1/notifications/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          recipients: [student1UserId],
          title: 'Scholarship Document Verification',
          message: 'Please submit original certificates to the Admin Office.',
          notificationType: 'administrative',
          priority: 'high',
          eventKey: 'admin_scholarship_verify_2026',
        });
      expect(apiEventDup.status).toBe(201);
      expect(apiEventDup.body.data.createdCount).toBe(0);
    });
  });

  // =========================================================================
  // 11, 12, 18. READ/UNREAD OPERATIONS, UNREAD COUNT, HISTORY & PAGINATION
  // =========================================================================
  describe('11, 12, 18. Read Receipts, Unread Count, User Isolation, History & Pagination', () => {
    it('should accurately track unread count, mark single & all notifications as read, enforce user ownership, and paginate history', async () => {
      // Create 3 notifications for Student 1 across categories
      const n1 = await NotificationService.createEventNotification({
        recipient: student1UserId,
        title: 'Notice 1',
        message: 'Academic update 1',
        notificationType: 'announcement',
        category: 'academic',
        eventKey: 's1_n1',
      });
      await NotificationService.createEventNotification({
        recipient: student1UserId,
        title: 'Notice 2',
        message: 'Examination update 2',
        notificationType: 'examination_schedule',
        category: 'examination',
        eventKey: 's1_n2',
      });
      await NotificationService.createEventNotification({
        recipient: student1UserId,
        title: 'Notice 3',
        message: 'Timetable update 3',
        notificationType: 'timetable_change',
        category: 'timetable',
        eventKey: 's1_n3',
      });

      // Check unread count = 3
      const unreadRes1 = await request(app)
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', `Bearer ${student1Token}`);
      expect(unreadRes1.status).toBe(200);
      expect(unreadRes1.body.data.unreadCount).toBe(3);

      // Student 2 cannot read or mark Student 1's notification as read -> 403
      const crossUserGet = await request(app)
        .get(`/api/v1/notifications/${n1.notification._id.toString()}`)
        .set('Authorization', `Bearer ${student2Token}`);
      expect(crossUserGet.status).toBe(403);

      const crossUserMark = await request(app)
        .patch(`/api/v1/notifications/${n1.notification._id.toString()}/read`)
        .set('Authorization', `Bearer ${student2Token}`);
      expect(crossUserMark.status).toBe(403);

      // Student 1 marks n1 as read
      const markOneRes = await request(app)
        .patch(`/api/v1/notifications/${n1.notification._id.toString()}/read`)
        .set('Authorization', `Bearer ${student1Token}`);
      expect(markOneRes.status).toBe(200);
      expect(markOneRes.body.data.isRead).toBe(true);
      expect(markOneRes.body.data.readAt).toBeDefined();

      // Unread count is now 2
      const unreadRes2 = await request(app)
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', `Bearer ${student1Token}`);
      expect(unreadRes2.body.data.unreadCount).toBe(2);

      // Paginated history & category filtering
      const pageRes = await request(app)
        .get('/api/v1/notifications/history?page=1&limit=2')
        .set('Authorization', `Bearer ${student1Token}`);
      expect(pageRes.status).toBe(200);
      expect(pageRes.body.data).toHaveLength(2);
      expect(pageRes.body.meta.total).toBe(3);
      expect(pageRes.body.meta.totalPages).toBe(2);
      expect(pageRes.body.meta.hasNextPage).toBe(true);

      const catFilterRes = await request(app)
        .get('/api/v1/notifications/history?category=examination')
        .set('Authorization', `Bearer ${student1Token}`);
      expect(catFilterRes.body.data).toHaveLength(1);
      expect(catFilterRes.body.data[0].category).toBe('examination');

      // Mark all remaining notifications as read
      const markAllRes = await request(app)
        .patch('/api/v1/notifications/read-all')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({});
      expect(markAllRes.status).toBe(200);
      expect(markAllRes.body.data.modifiedCount).toBe(2);

      // Unread count is now 0
      const unreadRes3 = await request(app)
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', `Bearer ${student1Token}`);
      expect(unreadRes3.body.data.unreadCount).toBe(0);
    });
  });

  // =========================================================================
  // 13 & 14. NOTIFICATION PREFERENCES & MANDATORY NOTIFICATIONS
  // =========================================================================
  describe('13 & 14. Notification Preferences, Quiet Hours & Mandatory Notifications', () => {
    it('should manage user preferences, validate timezone and quiet hours, and prevent disabling mandatory security/emergency notifications', async () => {
      // Get default preferences
      const getPref = await request(app)
        .get('/api/v1/notifications/preferences')
        .set('Authorization', `Bearer ${student1Token}`);
      expect(getPref.status).toBe(200);
      expect(getPref.body.data.inAppEnabled).toBe(true);
      expect(getPref.body.data.timezone).toBe('Asia/Kolkata');

      // Reject invalid timezone
      const badTzRes = await request(app)
        .put('/api/v1/notifications/preferences')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ timezone: 'Invalid/Timezone_Name' });
      expect(badTzRes.status).toBe(400);

      // Reject invalid quiet-hour format
      const badQhRes = await request(app)
        .put('/api/v1/notifications/preferences')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({
          quietHours: { enabled: true, startTime: '25:99', endTime: '07:00' },
        });
      expect(badQhRes.status).toBe(400);

      // Reject disabling mandatory emergency or security notifications
      const disableEmergencyRes = await request(app)
        .put('/api/v1/notifications/preferences')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({
          categoryPreferences: {
            emergency: { inApp: false },
          },
        });
      expect(disableEmergencyRes.status).toBe(400);

      const disableSecurityRes = await request(app)
        .put('/api/v1/notifications/preferences')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({
          categoryPreferences: {
            security: { inApp: false },
          },
        });
      expect(disableSecurityRes.status).toBe(400);

      // Valid preference update + device registration
      const validPrefUpdate = await request(app)
        .put('/api/v1/notifications/preferences')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({
          emailEnabled: true,
          smsEnabled: true,
          quietHours: {
            enabled: true,
            startTime: '22:00',
            endTime: '06:30',
            allowUrgent: true,
          },
          timezone: 'UTC',
        });
      expect(validPrefUpdate.status).toBe(200);
      expect(validPrefUpdate.body.data.quietHours.enabled).toBe(true);
      expect(validPrefUpdate.body.data.timezone).toBe('UTC');

      const deviceRes = await request(app)
        .post('/api/v1/notifications/devices')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({
          deviceToken: 'fcm_device_token_student_1_xyz',
          platform: 'android',
          deviceName: 'Pixel 9',
        });
      expect(deviceRes.status).toBe(201);
      expect(deviceRes.body.data.deviceToken).toBe('fcm_device_token_student_1_xyz');
    });
  });

  // =========================================================================
  // 15. DELIVERY FAILURE, RETRY WITH BACKOFF, AND IDEMPOTENCY
  // =========================================================================
  describe('15. Notification Delivery Failure, Retry Logic & Provider Isolation', () => {
    it('should retry transient provider failures with backoff, succeed without duplicates, and keep in-app notification intact when external provider fails', async () => {
      let emailAttempts = 0;
      const flakyEmailProvider: IEmailNotificationProvider = {
        isConfigured: () => true,
        sendEmail: async ({ notificationId }) => {
          emailAttempts += 1;
          if (emailAttempts < 3) {
            throw new Error('Temporary SMTP connection timeout');
          }
          return {
            confirmed: true,
            messageId: `smtp-ok-${notificationId}`,
          };
        },
      };

      NotificationDeliveryService.setProviders({ email: flakyEmailProvider });

      const { notification } = await NotificationService.createEventNotification({
        recipient: student1UserId,
        title: 'Retry Verification Notice',
        message: 'Testing 3-attempt retry logic.',
        notificationType: 'announcement',
        category: 'general',
        eventKey: 'retry_test_1',
      });

      expect(emailAttempts).toBe(3);
      const emailRecord = notification.deliveryChannels.find((c) => c.channel === 'email');
      expect(emailRecord).toBeDefined();
      expect(emailRecord?.status).toBe('delivered');
      expect(emailRecord?.attempts).toBe(3);
      expect(emailRecord?.providerMessageId).toContain('smtp-ok-');

      // Re-running deliverNotification on an already-delivered notification must NOT re-send email
      await NotificationDeliveryService.deliverNotification(notification, [
        'in_app',
        'email',
      ]);
      expect(emailAttempts).toBe(3);

      // Now test total external provider failure: in-app notification must still succeed (partial status)
      const failingEmailProvider: IEmailNotificationProvider = {
        isConfigured: () => true,
        sendEmail: async () => ({
          confirmed: false,
          error: 'Permanent mailbox unavailable',
        }),
      };
      NotificationDeliveryService.setProviders({ email: failingEmailProvider });

      const { notification: partialNotif } =
        await NotificationService.createEventNotification({
          recipient: student1UserId,
          title: 'Provider Failure Resilience Notice',
          message: 'In-app must still be created even if email fails.',
          notificationType: 'announcement',
          category: 'general',
          eventKey: 'retry_test_fail_2',
        });

      expect(partialNotif._id).toBeDefined();
      expect(partialNotif.deliveryStatus).toBe('partial');
      const inAppRec = partialNotif.deliveryChannels.find((c) => c.channel === 'in_app');
      const failedEmailRec = partialNotif.deliveryChannels.find(
        (c) => c.channel === 'email'
      );
      expect(inAppRec?.status).toBe('delivered');
      expect(failedEmailRec?.status).toBe('failed');

      // Verify delivery-status API endpoint
      const statusRes = await request(app)
        .get('/api/v1/notifications/delivery-status')
        .set('Authorization', `Bearer ${student1Token}`);
      expect(statusRes.status).toBe(200);
      expect(statusRes.body.data.summary.partial).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // 16 & 17. SOCKET.IO AUTHENTICATION & USER CHANNEL ISOLATION
  // =========================================================================
  describe('16 & 17. Real-Time Socket.IO Authentication & User Channel Isolation', () => {
    let httpServer: http.Server;
    let port: number;

    beforeEach(async () => {
      httpServer = http.createServer(app);
      SocketService.initialize(httpServer);
      await new Promise<void>((resolve) => {
        httpServer.listen(0, '127.0.0.1', () => {
          const addr = httpServer.address();
          port = typeof addr === 'object' && addr ? addr.port : 0;
          resolve();
        });
      });
    });

    afterEach(async () => {
      await SocketService.close();
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
      });
    });

    it('should reject unauthenticated socket connections and isolate real-time notifications per user', async () => {
      // 1. Unauthenticated socket must be rejected
      const unauthSocket: ClientSocket = ClientIO(`http://127.0.0.1:${port}`, {
        transports: ['websocket'],
        reconnection: false,
      });

      const unauthError = await new Promise<Error>((resolve) => {
        unauthSocket.on('connect_error', (err) => resolve(err));
      });
      expect(unauthError.message).toContain('Authentication error');
      unauthSocket.close();

      // 2. Connect Student 1 and Student 2 with valid JWT tokens
      const s1Socket: ClientSocket = ClientIO(`http://127.0.0.1:${port}`, {
        auth: { token: student1Token },
        transports: ['websocket'],
        reconnection: false,
      });

      const s2Socket: ClientSocket = ClientIO(`http://127.0.0.1:${port}`, {
        auth: { token: student2Token },
        transports: ['websocket'],
        reconnection: false,
      });

      await Promise.all([
        new Promise<void>((resolve) => s1Socket.on('connected', () => resolve())),
        new Promise<void>((resolve) => s2Socket.on('connected', () => resolve())),
      ]);

      // 3. Student 2 attempts to subscribe to Student 1's channel -> must be forbidden
      const crossSubAttempt = await new Promise<{ success: boolean; error?: string }>(
        (resolve) => {
          s2Socket.emit(
            'subscribe:channel',
            `user:${student1UserId}`,
            (res: { success: boolean; error?: string }) => resolve(res)
          );
        }
      );
      expect(crossSubAttempt.success).toBe(false);
      expect(crossSubAttempt.error).toContain('Forbidden');

      // 4. Dispatch a notification to Student 1 and verify ONLY Student 1 receives it in real time
      let s2ReceivedUnexpected = false;
      s2Socket.on('notification:new', () => {
        s2ReceivedUnexpected = true;
      });

      const s1ReceivedPromise = new Promise<{ title: string }>((resolve) => {
        s1Socket.on('notification:new', (payload) => resolve(payload));
      });

      await NotificationService.createEventNotification({
        recipient: student1UserId,
        title: 'Real-Time Private Alert for Student 1',
        message: 'Delivered via Socket.IO room user:<id>',
        notificationType: 'announcement',
        eventKey: 'realtime_s1_only',
      });

      const s1Payload = await s1ReceivedPromise;
      expect(s1Payload.title).toBe('Real-Time Private Alert for Student 1');

      await new Promise((r) => setTimeout(r, 80));
      expect(s2ReceivedUnexpected).toBe(false);

      s1Socket.close();
      s2Socket.close();
    });
  });

  // =========================================================================
  // 19. ANNOUNCEMENT READERSHIP ANALYTICS
  // =========================================================================
  describe('19. Announcement Readership Analytics & Read Percentage', () => {
    it('should compute accurate read percentage and restrict analytics to authorized creators and administrators', async () => {
      // Admin publishes an announcement to all students (Student 1 and Student 2 = 2 recipients)
      const pubRes = await request(app)
        .post('/api/v1/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Campus Placement Orientation',
          content: 'Mandatory orientation for 5th semester students.',
          announcementType: 'event',
          priority: 'high',
          targetAudience: 'students',
          status: 'published',
        });

      expect(pubRes.status).toBe(201);
      const annId = pubRes.body.data._id;
      expect(pubRes.body.data.targetRecipientCount).toBe(2);

      // Student 1 marks their notification for this announcement as read
      const s1Notif = await Notification.findOne({
        announcement: annId,
        recipient: student1UserId,
      });
      expect(s1Notif).not.toBeNull();

      await request(app)
        .patch(`/api/v1/notifications/${s1Notif!._id.toString()}/read`)
        .set('Authorization', `Bearer ${student1Token}`);

      // Student 1 tries to access announcement readership analytics -> 403
      const studentAnalyticsAttempt = await request(app)
        .get(`/api/v1/announcements/${annId}/analytics`)
        .set('Authorization', `Bearer ${student1Token}`);
      expect(studentAnalyticsAttempt.status).toBe(403);

      // Teacher 2 (not creator) tries to access Admin's announcement analytics -> 403
      const otherTeacherAttempt = await request(app)
        .get(`/api/v1/announcements/${annId}/analytics`)
        .set('Authorization', `Bearer ${teacher2Token}`);
      expect(otherTeacherAttempt.status).toBe(403);

      // Admin fetches analytics -> 1 of 2 read = 50%
      const adminAnalyticsRes = await request(app)
        .get(`/api/v1/announcements/${annId}/analytics`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(adminAnalyticsRes.status).toBe(200);
      expect(adminAnalyticsRes.body.data.totalTargeted).toBe(2);
      expect(adminAnalyticsRes.body.data.readCount).toBe(1);
      expect(adminAnalyticsRes.body.data.unreadCount).toBe(1);
      expect(adminAnalyticsRes.body.data.readPercentage).toBe(50);

      // Analytics overview endpoint
      const overviewRes = await request(app)
        .get('/api/v1/announcements/analytics/overview')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(overviewRes.status).toBe(200);
      expect(overviewRes.body.data.totalAnnouncements).toBeGreaterThanOrEqual(1);
      expect(overviewRes.body.data.overallReadPercentage).toBe(50);
    });
  });
});
