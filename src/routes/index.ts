import { Router } from 'express';
import { authRouter } from './auth.routes';
import { academicRouter } from './academic.routes';
import { departmentRouter } from './department.routes';
import { classRouter } from './class.routes';
import { sectionRouter } from './section.routes';
import { subjectRouter } from './subject.routes';
import { teacherAssignmentRouter } from './teacherAssignment.routes';
import { teacherRouter } from './teacher.routes';
import { attendanceRouter } from './attendance.routes';
import { assignmentRouter, submissionRouter, attachmentRouter } from './assignment.routes';
import {
  examinationRouter,
  examinationScheduleRouter,
  examinationResultRouter,
  internalAssessmentRouter,
  resultRouter,
} from './examination.routes';
import progressRouter from './progress.routes';
import analyticsRouter from './analytics.routes';
import reportRouter from './report.routes';
import studyMaterialRouter from './studyMaterial.routes';
import { timetableRouter } from './timetable.routes';
import { timetableEntryRouter } from './timetableEntry.routes';
import { timetableChangeRouter } from './timetableChange.routes';
import { announcementRouter } from './announcement.routes';
import { notificationRouter } from './notification.routes';
import { doubtRouter } from './doubt.routes';
import { parentRouter } from './parent.routes';
import { parentCommunicationRouter } from './parentCommunication.routes';
import { leaveRequestRouter, leaveRouter } from './leave.routes';
import { substitutionRouter } from './substitution.routes';
import { aiRouter } from './ai.routes';
import { dashboardRouter } from './dashboard.routes';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from '../config/swagger.config';
import { HealthController } from '../controllers/health.controller';

const router = Router();

router.get('/health', HealthController.getHealth);
router.get('/health/live', HealthController.getLiveness);
router.get('/health/ready', HealthController.getReadiness);

router.get('/openapi.json', (_req, res) => {
  res.status(200).json(swaggerSpec);
});

router.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

router.use('/auth', authRouter);
router.use('/academics', academicRouter);
router.use('/departments', departmentRouter);
router.use('/classes', classRouter);
router.use('/sections', sectionRouter);
router.use('/subjects', subjectRouter);
router.use('/teacher-assignments', teacherAssignmentRouter);
router.use('/teachers', teacherRouter);
router.use('/attendance', attendanceRouter);
router.use('/assignments', assignmentRouter);
router.use('/submissions', submissionRouter);
router.use('/attachments', attachmentRouter);
router.use('/examinations', examinationRouter);
router.use('/examination-schedules', examinationScheduleRouter);
router.use('/examination-results', examinationResultRouter);
router.use('/internal-assessments', internalAssessmentRouter);
router.use('/results', resultRouter);
router.use('/progress', progressRouter);
router.use('/analytics', analyticsRouter);
router.use('/reports', reportRouter);
router.use('/study-materials', studyMaterialRouter);
router.use('/timetables', timetableRouter);
router.use('/timetable-entries', timetableEntryRouter);
router.use('/timetable-changes', timetableChangeRouter);
router.use('/announcements', announcementRouter);
router.use('/notifications', notificationRouter);
router.use('/doubts', doubtRouter);
router.use('/parents', parentRouter);
router.use('/parent-communications', parentCommunicationRouter);
router.use('/leave-requests', leaveRequestRouter);
router.use('/leaves', leaveRouter);
router.use('/substitutions', substitutionRouter);
router.use('/ai', aiRouter);
router.use('/dashboard', dashboardRouter);

export const apiRouter = router;



