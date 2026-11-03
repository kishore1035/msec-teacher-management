# Phase 7 – Study Materials & Resource Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a comprehensive, policy-driven Study Materials Management System that enables teachers to upload, organize, version, distribute, and track academic resources for their assigned classes and subjects, while providing students with fast, secure, search-enabled access and administrators with institution-level resource analytics.

**Architecture:** 3-tier REST architecture (Routes $\to$ Controllers $\to$ Services $\to$ Models) using TypeScript strict mode, Express, MongoDB/Mongoose, and Multer file upload handling with the existing storage abstraction (`IStorageService`, `LocalStorageService`). Materials are indexed with compound and text search indexes, versioned immutably via `StudyMaterialVersion`, and guarded with strict role-based access controls.

**Tech Stack:** Node.js 20+, TypeScript 5.7+ (strict mode), Express 4.21, MongoDB / Mongoose 8.9, Multer 1.4, Zod 3.24, Jest 29, Supertest 7.

**Spec:** Phase 7 specifications from User Request.

## Global Constraints
- Backend only: strictly zero frontend, UI, CSS, or dashboard screens.
- Zero breaking changes to Phases 1–6 (all 78 existing integration tests must continue to pass).
- Multi-attachment support: PDF, DOC/DOCX, PPT/PPTX, XLS/XLSX, standard images, MP4/WEBM videos up to 50MB.
- Reuse file storage abstraction (`LocalStorageService`) and Multer; store relative metadata in MongoDB, never binary content.
- Prevent path traversal on downloads; clean up orphaned files if database operations fail.
- Version history: updating materials or replacing attachments preserves prior versions in `StudyMaterialVersion`.
- Strict RBAC: Teachers can only manage materials for assigned subjects/sections; students can access only published materials for their enrolled section/subject or institution-wide; draft materials are strictly hidden from students.

---

### Task 1: Data Models & Database Indexes
**Files:**
- Create: `src/models/studyMaterial.model.ts`
- Create: `src/models/studyMaterialVersion.model.ts`
- Modify: `src/models/index.ts`

- [ ] 1.1 Create `StudyMaterial` model with fields:
  - `title`: string (required, trimmed)
  - `description`: string (required, trimmed)
  - `materialType`: enum (`notes`, `lecture`, `presentation`, `reference`, `textbook`, `question_paper`, `syllabus`, `video`, `other`)
  - `subject`: Types.ObjectId (ref: Subject, required)
  - `section`: Types.ObjectId (ref: Section, optional for subject/institution-wide)
  - `academicYear`: Types.ObjectId (ref: AcademicYear, required)
  - `semester`: number (required)
  - `teacher`: Types.ObjectId (ref: Teacher, required)
  - `topic`: string (optional, trimmed)
  - `unit`: string (optional, e.g. "Unit 1", "Module 2")
  - `tags`: string[] (indexed)
  - `attachments`: IAttachment[]
  - `visibility`: enum (`class`, `subject`, `institution`) (default: `class`)
  - `status`: enum (`draft`, `published`, `archived`) (default: `draft`)
  - `version`: number (default: 1)
  - `downloadCount`: number (default: 0)
  - `viewCount`: number (default: 0)
  - `publishedAt`: Date (optional)
  - `createdBy`: Types.ObjectId (ref: User, required)
  - `updatedBy`: Types.ObjectId (ref: User)
  - timestamps
- [ ] 1.2 Create `StudyMaterialVersion` model to archive historical revisions:
  - `material`: Types.ObjectId (ref: StudyMaterial, required)
  - `versionNumber`: number (required)
  - `title`: string
  - `description`: string
  - `attachments`: IAttachment[]
  - `changeDescription`: string
  - `updatedBy`: Types.ObjectId (ref: User, required)
  - `createdAt`: Date
- [ ] 1.3 Add indexes:
  - Search text index: `{ title: 'text', description: 'text', topic: 'text', tags: 'text' }`
  - Filter indexes: `{ subject: 1, section: 1, academicYear: 1, semester: 1, status: 1 }`
  - Teacher index: `{ teacher: 1, status: 1 }`
  - Version index: `{ material: 1, versionNumber: -1 }`
- [ ] 1.4 Export new models from `src/models/index.ts`.
- [ ] 1.5 Run `npx tsc --noEmit` and commit models.

---

### Task 2: File Upload Middleware & Request Validators (Zod)
**Files:**
- Modify: `src/middleware/upload.middleware.ts`
- Create: `src/validators/studyMaterial.validator.ts`

- [ ] 2.1 Update `src/middleware/upload.middleware.ts` to support video MIME types (`video/mp4`, `video/webm`) and video file extensions (`.mp4`, `.webm`) with configurable size limits (up to 50MB). Export `uploadMaterialFiles`.
- [ ] 2.2 Create Zod schemas in `src/validators/studyMaterial.validator.ts`:
  - `createStudyMaterialSchema`
  - `updateStudyMaterialSchema`
  - `materialQuerySchema`
  - `searchMaterialsSchema`
  - `materialIdParamSchema`
  - `attachmentIdParamSchema`
  - `versionIdParamSchema`
  - `analyticsQuerySchema`
- [ ] 2.3 Run `npx tsc --noEmit` and commit validators and upload middleware.

---

### Task 3: Study Material Core & Version Service
**Files:**
- Create: `src/services/studyMaterial.service.ts`

- [ ] 3.1 Implement Teacher-Assignment Authorization Guard: validates teacher is actively assigned to subject and section.
- [ ] 3.2 Implement `createStudyMaterial(userId, role, data, files)`: handles Multer files via `LocalStorageService`, saves attachments, sets status, and handles file cleanup if creation fails.
- [ ] 3.3 Implement `getStudyMaterials(userId, role, query)`: filters by subject, section, semester, teacher, tags, visibility, status (hiding draft from students), with pagination.
- [ ] 3.4 Implement `getStudyMaterialById(userId, role, materialId)`: retrieves single material and increments `viewCount` atomically.
- [ ] 3.5 Implement `updateStudyMaterial(userId, role, materialId, updateData, newFiles, changeDescription)`:
  - Archives current state into `StudyMaterialVersion`.
  - Increments version number.
  - Updates title, description, topic, unit, tags, attachments, and `updatedBy`.
- [ ] 3.6 Implement `publishStudyMaterial(userId, role, materialId)` and `archiveStudyMaterial(userId, role, materialId)`.
- [ ] 3.7 Implement `deleteStudyMaterial(userId, role, materialId)`: deletes attachments from disk via `IStorageService` and removes material document.
- [ ] 3.8 Implement Version History methods:
  - `getMaterialVersions(userId, role, materialId)`
  - `getMaterialVersionById(userId, role, materialId, versionId)`
- [ ] 3.9 Run `npx tsc --noEmit` and commit service.

---

### Task 4: Student Resource Access & Attachment Stream Service
**Files:**
- Create: `src/services/studyMaterialAccess.service.ts`

- [ ] 4.1 Implement `getMyResources(studentUserId, query)`: returns all published study materials matching the student's enrolled section, subjects, or institution-wide visibility.
- [ ] 4.2 Implement `searchMaterials(userId, role, searchParams)`: full-text search across title, description, topic, and tags with role-scoped filtering.
- [ ] 4.3 Implement `getMaterialsBySubject(userId, role, subjectId, query)`.
- [ ] 4.4 Implement `downloadAttachment(userId, role, attachmentId)`:
  - Finds parent `StudyMaterial` containing attachmentId.
  - Verifies user has access (published if student; assigned teacher or admin).
  - Increments `downloadCount` on the material.
  - Resolves file stream securely via `LocalStorageService.getFileStream` preventing path traversal.
  - Returns file stream, filename, and MIME type.
- [ ] 4.5 Implement `addAttachment(userId, role, materialId, file)` and `deleteAttachment(userId, role, attachmentId)`.
- [ ] 4.6 Run `npx tsc --noEmit` and commit service.

---

### Task 5: Resource Analytics Engine
**Files:**
- Create: `src/services/studyMaterialAnalytics.service.ts`

- [ ] 5.1 Implement `getOverviewAnalytics(filters)`: total materials uploaded, materials by status, total downloads, total views.
- [ ] 5.2 Implement `getSubjectAnalytics(filters)`: materials breakdown per subject, categories per subject, most active subjects.
- [ ] 5.3 Implement `getTeacherAnalytics(filters)`: materials uploaded per teacher, download counts per teacher.
- [ ] 5.4 Implement `getPopularMaterials(filters)`: top accessed and downloaded materials.
- [ ] 5.5 Enforce RBAC: accessible only to teachers and administrators.
- [ ] 5.6 Run `npx tsc --noEmit` and commit service.

---

### Task 6: Controllers & REST Routes
**Files:**
- Create: `src/controllers/studyMaterial.controller.ts`
- Create: `src/routes/studyMaterial.routes.ts`
- Modify: `src/routes/index.ts`

- [ ] 6.1 Implement `StudyMaterialController` mapping all service calls and formatting standard `ApiResponse`.
- [ ] 6.2 Implement `studyMaterialRouter` mounting all endpoints under `/api/v1/study-materials`.
- [ ] 6.3 Mount `studyMaterialRouter` in `src/routes/index.ts`.
- [ ] 6.4 Run `npx tsc --noEmit` and commit controllers and routes.

---

### Task 7: Automated Integration Tests
**Files:**
- Create: `tests/integration/studyMaterial.test.ts`

- [ ] 7.1 Write comprehensive integration tests covering all 17 requirements:
  1. Material creation by teacher for assigned subject and section.
  2. Material publication lifecycle (`draft` -> `published` -> `archived`).
  3. Draft material visibility (hidden from students, accessible to creator/admin).
  4. Teacher authorization (rejecting unassigned teacher).
  5. Student access restrictions (students view only published materials for enrolled classes).
  6. Subject and section validation (rejecting mismatched semester or invalid IDs).
  7. File type validation (rejecting disallowed extensions like `.exe`).
  8. File size restrictions.
  9. Unauthorized attachment downloads (blocking students from unassigned or draft attachments).
  10. Attachment replacement & addition.
  11. Material version history (creating revisions upon update).
  12. Full-text search by title, topic, and tags.
  13. Filtering and pagination.
  14. Material archival.
  15. Resource analytics (overview, subject breakdown, popular materials).
  16. File cleanup after failed operations or deletions.
  17. Full regression test across all 7 test files.
- [ ] 7.2 Run `npx jest tests/integration/studyMaterial.test.ts` and ensure 100% pass rate.
- [ ] 7.3 Run full test suite `npm test` across all 7 test files.

---

### Task 8: Documentation, Git Commit & Push
**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `task.md`

- [ ] 8.1 Update `README.md` with Phase 7 endpoints, supported file formats, and upload limits.
- [ ] 8.2 Update `AGENTS.md` with Phase 7 architectural rules, version management invariants, and file storage guidelines.
- [ ] 8.3 Update `task.md` checklist.
- [ ] 8.4 Git add, commit, and push to GitHub `origin main`.
- [ ] 8.5 Present complete Phase 7 summary to user and stop for approval before Phase 8.
