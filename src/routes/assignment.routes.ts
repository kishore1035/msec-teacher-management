import { Router } from 'express';
import { AssignmentController } from '../controllers/assignment.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { uploadAssignmentFiles } from '../middleware/upload.middleware';
import { ROLES } from '../constants/roles.constant';
import {
  createAssignmentValidator,
  updateAssignmentValidator,
  assignmentQueryValidator,
  submitAssignmentValidator,
  evaluateSubmissionValidator,
  returnSubmissionValidator,
  analyticsQueryValidator,
} from '../validators/assignment.validator';

export const assignmentRouter = Router();
export const submissionRouter = Router();
export const attachmentRouter = Router();

// ==========================================
// 1. ASSIGNMENT ROUTES (/api/v1/assignments)
// ==========================================

assignmentRouter.post(
  '/',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  uploadAssignmentFiles.array('attachments', 5),
  validateRequest(createAssignmentValidator),
  AssignmentController.createAssignment
);

assignmentRouter.get(
  '/',
  authenticate,
  validateRequest(assignmentQueryValidator),
  AssignmentController.getAssignments
);

// Student's own submissions
assignmentRouter.get(
  '/my-submissions',
  authenticate,
  authorize([ROLES.STUDENT]),
  AssignmentController.getMySubmissions
);

// Analytics endpoints
assignmentRouter.get(
  '/analytics/overview',
  authenticate,
  validateRequest(analyticsQueryValidator),
  AssignmentController.getOverviewAnalytics
);

assignmentRouter.get(
  '/analytics/class',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(analyticsQueryValidator),
  AssignmentController.getClassAnalytics
);

assignmentRouter.get(
  '/analytics/subject',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(analyticsQueryValidator),
  AssignmentController.getSubjectAnalytics
);

assignmentRouter.get(
  '/analytics/student/:studentId',
  authenticate,
  AssignmentController.getStudentAnalytics
);

// Single assignment details
assignmentRouter.get(
  '/:id',
  authenticate,
  AssignmentController.getAssignmentById
);

assignmentRouter.put(
  '/:id',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(updateAssignmentValidator),
  AssignmentController.updateAssignment
);

assignmentRouter.patch(
  '/:id/publish',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  AssignmentController.publishAssignment
);

assignmentRouter.patch(
  '/:id/close',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  AssignmentController.closeAssignment
);

assignmentRouter.delete(
  '/:id',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  AssignmentController.deleteAssignment
);

// Assignment attachments
assignmentRouter.post(
  '/:id/attachments',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  uploadAssignmentFiles.array('attachments', 5),
  AssignmentController.addAttachments
);

assignmentRouter.delete(
  '/:id/attachments/:attachmentId',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  AssignmentController.removeAttachment
);

// Student Submissions for an Assignment
assignmentRouter.post(
  '/:assignmentId/submit',
  authenticate,
  authorize([ROLES.STUDENT]),
  uploadAssignmentFiles.array('attachments', 5),
  validateRequest(submitAssignmentValidator),
  AssignmentController.submitAssignment
);

assignmentRouter.put(
  '/:assignmentId/resubmit',
  authenticate,
  authorize([ROLES.STUDENT]),
  uploadAssignmentFiles.array('attachments', 5),
  validateRequest(submitAssignmentValidator),
  AssignmentController.resubmitAssignment
);

assignmentRouter.get(
  '/:assignmentId/submissions',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  AssignmentController.getSubmissionsForAssignment
);

assignmentRouter.get(
  '/:assignmentId/submissions/:submissionId',
  authenticate,
  AssignmentController.getSubmissionById
);

// ==========================================
// 2. SUBMISSION ROUTES (/api/v1/submissions)
// ==========================================

submissionRouter.patch(
  '/:submissionId/evaluate',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(evaluateSubmissionValidator),
  AssignmentController.evaluateSubmission
);

submissionRouter.patch(
  '/:submissionId/return',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(returnSubmissionValidator),
  AssignmentController.returnSubmission
);

submissionRouter.get(
  '/:submissionId/evaluation-history',
  authenticate,
  AssignmentController.getEvaluationHistory
);

// ==========================================
// 3. ATTACHMENT ROUTES (/api/v1/attachments)
// ==========================================

attachmentRouter.get(
  '/:attachmentId',
  authenticate,
  AssignmentController.downloadAttachment
);
