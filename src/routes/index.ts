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

const router = Router();

router.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

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

export const apiRouter = router;
