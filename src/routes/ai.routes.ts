import { Router } from 'express';
import { AIAssistantController } from '../controllers/phase12.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { ROLES } from '../constants/roles.constant';
import { validateRequest } from '../middleware/validate.middleware';
import {
  generateLessonPlanSchema,
  generateQuizSchema,
  generateQuestionPaperSchema,
  generateAssignmentSchema,
  generateTopicExplanationSchema,
  generateRubricSchema,
  generateStudyMaterialSummarySchema,
  generateTeachingMaterialSchema,
  generateLearningOutcomesSchema,
  generateQuestionBankSchema,
  listAIContentSchema,
  aiContentIdParamSchema,
  updateAIContentSchema,
  approveAIContentSchema,
  rejectAIContentSchema,
  aiUsageQuerySchema,
  upsertAIUsagePolicySchema,
} from '../validators/phase12.validator';

const router = Router();

router.use(authenticate);

// Generation Endpoints (Strictly restricted to teachers and admins; outputs saved as drafts)
router.post(
  '/lesson-plan',
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(generateLessonPlanSchema),
  AIAssistantController.generateLessonPlan
);

router.post(
  '/quiz',
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(generateQuizSchema),
  AIAssistantController.generateQuiz
);

router.post(
  '/question-paper',
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(generateQuestionPaperSchema),
  AIAssistantController.generateQuestionPaper
);

router.post(
  '/assignment',
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(generateAssignmentSchema),
  AIAssistantController.generateAssignment
);

router.post(
  '/topic-explanation',
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(generateTopicExplanationSchema),
  AIAssistantController.generateTopicExplanation
);

router.post(
  '/rubric',
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(generateRubricSchema),
  AIAssistantController.generateRubric
);

router.post(
  '/study-material-summary',
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(generateStudyMaterialSummarySchema),
  AIAssistantController.generateStudyMaterialSummary
);

router.post(
  '/teaching-material',
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(generateTeachingMaterialSchema),
  AIAssistantController.generateTeachingMaterial
);

router.post(
  '/learning-outcomes',
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(generateLearningOutcomesSchema),
  AIAssistantController.generateLearningOutcomes
);

router.post(
  '/question-bank',
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(generateQuestionBankSchema),
  AIAssistantController.generateQuestionBank
);

// AI Content Management & Review Workflow
router.get(
  '/content',
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(listAIContentSchema),
  AIAssistantController.listContent
);

router.get(
  '/content/:id',
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(aiContentIdParamSchema),
  AIAssistantController.getContentById
);

router.patch(
  '/content/:id',
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(updateAIContentSchema),
  AIAssistantController.updateContent
);

router.post(
  '/content/:id/approve',
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(approveAIContentSchema),
  AIAssistantController.approveContent
);

router.post(
  '/content/:id/reject',
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(rejectAIContentSchema),
  AIAssistantController.rejectContent
);

router.delete(
  '/content/:id',
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(aiContentIdParamSchema),
  AIAssistantController.deleteContent
);

// AI Usage & Policy Endpoints
router.get(
  '/usage',
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  AIAssistantController.getUsageSummary
);

router.get(
  '/usage/analytics',
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(aiUsageQuerySchema),
  AIAssistantController.getUsageAnalytics
);

router.get(
  '/policies',
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  AIAssistantController.listPolicies
);

router.post(
  '/policies',
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  validateRequest(upsertAIUsagePolicySchema),
  AIAssistantController.upsertPolicy
);

export const aiRouter = router;
export default router;
