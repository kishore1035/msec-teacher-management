import { Router } from 'express';
import { StudyMaterialController } from '../controllers/studyMaterial.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { uploadMaterialFiles } from '../middleware/upload.middleware';
import { ROLES } from '../constants/roles.constant';
import {
  createStudyMaterialSchema,
  updateStudyMaterialSchema,
  materialQuerySchema,
  searchMaterialsSchema,
  materialIdParamSchema,
  attachmentIdParamSchema,
  versionIdParamSchema,
  materialAnalyticsQuerySchema,
} from '../validators/studyMaterial.validator';

const router = Router();

// ==========================================
// 1. Static / Named Routes (Must be before /:id)
// ==========================================

// Student Resource Views
router.get(
  '/my-resources',
  authenticate,
  authorize([ROLES.STUDENT]),
  StudyMaterialController.getMyResources
);

// Full-Text & Filter Search
router.get(
  '/search',
  authenticate,
  validateRequest(searchMaterialsSchema),
  StudyMaterialController.searchMaterials
);

// Subject-Specific Resources
router.get(
  '/subjects/:subjectId',
  authenticate,
  StudyMaterialController.getMaterialsBySubject
);

// Resource Analytics
router.get(
  '/analytics/overview',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(materialAnalyticsQuerySchema),
  StudyMaterialController.getOverviewAnalytics
);

router.get(
  '/analytics/subject',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(materialAnalyticsQuerySchema),
  StudyMaterialController.getSubjectAnalytics
);

router.get(
  '/analytics/teacher',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(materialAnalyticsQuerySchema),
  StudyMaterialController.getTeacherAnalytics
);

router.get(
  '/analytics/popular',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(materialAnalyticsQuerySchema),
  StudyMaterialController.getPopularMaterials
);

// Attachments Direct Download & Delete by AttachmentId
router.get(
  '/attachments/:attachmentId/download',
  authenticate,
  validateRequest(attachmentIdParamSchema),
  StudyMaterialController.downloadAttachment
);

router.delete(
  '/attachments/:attachmentId',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(attachmentIdParamSchema),
  StudyMaterialController.deleteAttachment
);

// ==========================================
// 2. Core Material Collection & Upload
// ==========================================

router.post(
  '/',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  uploadMaterialFiles.array('files', 10),
  validateRequest(createStudyMaterialSchema),
  StudyMaterialController.createStudyMaterial
);

router.get(
  '/',
  authenticate,
  validateRequest(materialQuerySchema),
  StudyMaterialController.getStudyMaterials
);

// ==========================================
// 3. Parametric Routes (/:id)
// ==========================================

router.get(
  '/:id',
  authenticate,
  validateRequest(materialIdParamSchema),
  StudyMaterialController.getStudyMaterialById
);

router.put(
  '/:id',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  uploadMaterialFiles.array('files', 10),
  validateRequest(updateStudyMaterialSchema),
  StudyMaterialController.updateStudyMaterial
);

router.patch(
  '/:id/publish',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(materialIdParamSchema),
  StudyMaterialController.publishStudyMaterial
);

router.patch(
  '/:id/archive',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(materialIdParamSchema),
  StudyMaterialController.archiveStudyMaterial
);

router.delete(
  '/:id',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(materialIdParamSchema),
  StudyMaterialController.deleteStudyMaterial
);

// Attachments on a Material
router.post(
  '/:id/attachments',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  uploadMaterialFiles.single('file'),
  validateRequest(materialIdParamSchema),
  StudyMaterialController.addAttachment
);

router.get(
  '/:id/attachments',
  authenticate,
  validateRequest(materialIdParamSchema),
  StudyMaterialController.getAttachments
);

// Version History on a Material
router.get(
  '/:id/versions',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(materialIdParamSchema),
  StudyMaterialController.getMaterialVersions
);

router.get(
  '/:id/versions/:versionId',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER]),
  validateRequest(versionIdParamSchema),
  StudyMaterialController.getMaterialVersionById
);

export const studyMaterialRouter = router;
export default router;
