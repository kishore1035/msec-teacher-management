# Phase 4 – Assignment & Submission Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a robust, enterprise-grade assignment and submission management backend supporting the complete academic lifecycle from teacher creation and file attachments to student submissions, late handling, evaluation with an audit trail, and analytics.

**Architecture:** Layered 3-tier REST architecture (Routes -> Controllers -> Services -> Models) leveraging Mongoose schemas with compound indexes, Zod validation, an abstracted local/cloud storage provider with path-traversal prevention, Multer file upload filters, and resource-level RBAC for teachers, students, parents, and administrators.

**Tech Stack:** Node.js (v20+), TypeScript (strict mode), Express.js 4.x, MongoDB & Mongoose 8.x, Multer 1.4.x, Zod 3.x, Jest & Supertest, mongodb-memory-server.

**Spec:** Phase 4 prompt specification provided in conversation.

## Global Constraints
- Strictly backend only; zero frontend, UI, or HTML views.
- Strict TypeScript (`noImplicitAny`, strict null checks, strict boolean expressions).
- Do not store raw file binaries in MongoDB; store structured metadata and paths via storage abstraction.
- Prevent path traversal and enforce safe, sanitized UUID-based file storage names.
- Teachers can only manage assignments and grade submissions for their own active teacher assignments.
- Students can only view published assignments for their section and submit their own work.
- Parents can only view submission status and published grades for their linked children.
- Preserve evaluation history with reasons and immutable audit trail.
- Do not break Phase 1, Phase 2, or Phase 3 endpoints or tests.

## Review Focus
1. Path traversal or unsafe arbitrary file downloads via attachment IDs — sanitize and resolve against upload root only with authorization.
2. Deadline edge cases — submissions occurring precisely at or after `dueDate` must correctly calculate `isLate` and honor `allowLateSubmission` / `lateSubmissionDeadline`.
3. Marks overflow or negative marks — evaluation must enforce `0 <= marksObtained <= assignment.totalMarks`.
4. Resubmission abuse — students cannot resubmit after assignment closure, max attempt exceedance, or while pending initial evaluation.
5. Student section tampering — students cannot submit to assignments belonging to other classes or sections.

---

### Task 1: Storage Service Abstraction & Safe Upload Middleware

**Files:**
- Create: `src/services/storage.service.ts`
- Create: `src/middleware/upload.middleware.ts`
- Test: `tests/integration/assignment.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface StoredFile {
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    path: string;
    uploadedAt: Date;
  }
  export interface IStorageService {
    saveFile(file: Express.Multer.File, subfolder?: string): Promise<StoredFile>;
    getFileStream(filePath: string): NodeJS.ReadableStream;
    deleteFile(filePath: string): Promise<void>;
    getAbsolutePath(filePath: string): string;
  }
  export const storageService: IStorageService;
  export const uploadAssignmentFiles: RequestHandler;
  ```

- [ ] **Step 1: Write failing test in integration test suite for file upload validation**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement `StorageService` with path traversal defense & Multer middleware**
  - Allowed MIME types: PDF, DOC/DOCX, PPT/PPTX, TXT, ZIP, Images (JPEG, PNG, WEBP).
  - Max file size: 25MB.
  - Safe sanitized disk storage path under `uploads/assignments/`.
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit**
  ```bash
  git add src/services/storage.service.ts src/middleware/upload.middleware.ts
  git commit -m "feat(phase-4): add storage abstraction and secure upload middleware"
  ```

---

### Task 2: Assignment & AssignmentSubmission Mongoose Schemas & Indexes

**Files:**
- Create: `src/models/assignment.model.ts`
- Create: `src/models/assignmentSubmission.model.ts`
- Modify: `src/models/index.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface IAttachment {
    _id?: Types.ObjectId;
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    path: string;
    uploadedAt: Date;
  }
  export interface IEvaluationHistory {
    previousMarks?: number;
    newMarks: number;
    previousFeedback?: string;
    newFeedback?: string;
    evaluatedBy: Types.ObjectId;
    reason: string;
    timestamp: Date;
  }
  export interface IAssignment extends Document { ... }
  export interface IAssignmentSubmission extends Document { ... }
  ```

- [ ] **Step 1: Define `IAssignment` and `IAssignmentSubmission` models with compound indexes**
  - `Assignment`: `{ section: 1, subject: 1, status: 1 }`, `{ teacher: 1, status: 1 }`, `{ academicYear: 1, semester: 1 }`
  - `AssignmentSubmission`: `{ assignment: 1, student: 1 }` (unique), `{ student: 1, submissionStatus: 1 }`, `{ assignment: 1, evaluationStatus: 1 }`
- [ ] **Step 2: Export in `src/models/index.ts`**
- [ ] **Step 3: Compile via `npx tsc --noEmit` to verify type cleanliness**
- [ ] **Step 4: Commit**
  ```bash
  git add src/models/assignment.model.ts src/models/assignmentSubmission.model.ts src/models/index.ts
  git commit -m "feat(phase-4): add Assignment and AssignmentSubmission models with indexes"
  ```

---

### Task 3: Zod Request Validators for Assignments, Submissions & Evaluations

**Files:**
- Create: `src/validators/assignment.validator.ts`

**Interfaces:**
- Produces:
  ```typescript
  export const createAssignmentSchema: ZodSchema;
  export const updateAssignmentSchema: ZodSchema;
  export const assignmentQuerySchema: ZodSchema;
  export const submitAssignmentSchema: ZodSchema;
  export const evaluateSubmissionSchema: ZodSchema;
  export const returnSubmissionSchema: ZodSchema;
  export const analyticsQuerySchema: ZodSchema;
  ```

- [ ] **Step 1: Write Zod schemas with cross-field validations**
  - `passingMarks <= totalMarks`
  - `dueDate >= assignedDate`
  - If `allowLateSubmission === true`, then `lateSubmissionDeadline >= dueDate`
  - Marks obtained must be between `0` and assignment's total marks.
  - Reason required when re-evaluating or returning submissions.
- [ ] **Step 2: Compile with `npx tsc --noEmit`**
- [ ] **Step 3: Commit**
  ```bash
  git add src/validators/assignment.validator.ts
  git commit -m "feat(phase-4): add Zod validators for assignments and submissions"
  ```

---

### Task 4: Assignment Core Service & Teacher/Admin Lifecycle Operations

**Files:**
- Create: `src/services/assignment.service.ts`

**Interfaces:**
- Produces:
  ```typescript
  export class AssignmentService {
    createAssignment(userId: string, role: string, data: CreateAssignmentDTO, files?: Express.Multer.File[]): Promise<IAssignment>;
    getAssignments(userId: string, role: string, query: AssignmentQueryDTO): Promise<PaginatedResult<IAssignment>>;
    getAssignmentById(userId: string, role: string, id: string): Promise<IAssignment>;
    updateAssignment(userId: string, role: string, id: string, data: UpdateAssignmentDTO): Promise<IAssignment>;
    publishAssignment(userId: string, role: string, id: string): Promise<IAssignment>;
    closeAssignment(userId: string, role: string, id: string): Promise<IAssignment>;
    deleteAssignment(userId: string, role: string, id: string): Promise<void>;
    addAttachments(userId: string, role: string, id: string, files: Express.Multer.File[]): Promise<IAssignment>;
    removeAttachment(userId: string, role: string, id: string, attachmentId: string): Promise<IAssignment>;
  }
  ```

- [ ] **Step 1: Implement assignment creation with teacher-assignment authorization check**
- [ ] **Step 2: Implement draft visibility filters (students only see 'published' / 'closed')**
- [ ] **Step 3: Implement publish, close, update, and attachment lifecycle methods**
- [ ] **Step 4: Commit**
  ```bash
  git add src/services/assignment.service.ts
  git commit -m "feat(phase-4): implement assignment core service and lifecycle logic"
  ```

---

### Task 5: Submission, Late Rules, Resubmission & Evaluation Service

**Files:**
- Create: `src/services/submission.service.ts`

**Interfaces:**
- Produces:
  ```typescript
  export class SubmissionService {
    submitAssignment(userId: string, assignmentId: string, data: SubmitDTO, files?: Express.Multer.File[]): Promise<IAssignmentSubmission>;
    resubmitAssignment(userId: string, assignmentId: string, data: SubmitDTO, files?: Express.Multer.File[]): Promise<IAssignmentSubmission>;
    getSubmissionsForAssignment(userId: string, role: string, assignmentId: string, query: PaginationDTO): Promise<PaginatedResult<IAssignmentSubmission>>;
    getSubmissionById(userId: string, role: string, assignmentId: string, submissionId: string): Promise<IAssignmentSubmission>;
    getMySubmissions(userId: string, query: PaginationDTO): Promise<PaginatedResult<IAssignmentSubmission>>;
    evaluateSubmission(userId: string, role: string, submissionId: string, data: EvaluateDTO): Promise<IAssignmentSubmission>;
    returnSubmission(userId: string, role: string, submissionId: string, data: ReturnDTO): Promise<IAssignmentSubmission>;
    getEvaluationHistory(userId: string, role: string, submissionId: string): Promise<IEvaluationHistory[]>;
  }
  ```

- [ ] **Step 1: Implement student section verification & deadline/late rules check**
- [ ] **Step 2: Implement submission and resubmission tracking (increments attemptNumber)**
- [ ] **Step 3: Implement teacher evaluation & re-evaluation with immutable audit history**
- [ ] **Step 4: Implement return for corrections logic**
- [ ] **Step 5: Commit**
  ```bash
  git add src/services/submission.service.ts
  git commit -m "feat(phase-4): implement submission, resubmission, and evaluation service"
  ```

---

### Task 6: Assignment Analytics & Secure Attachment Streaming

**Files:**
- Create: `src/services/assignmentAnalytics.service.ts`
- Create: `src/controllers/assignment.controller.ts`

**Interfaces:**
- Produces:
  ```typescript
  export class AssignmentAnalyticsService {
    getOverviewAnalytics(userId: string, role: string, filters: AnalyticsFilterDTO): Promise<OverviewAnalyticsResult>;
    getClassAnalytics(userId: string, role: string, filters: ClassAnalyticsFilterDTO): Promise<ClassAnalyticsResult>;
    getSubjectAnalytics(userId: string, role: string, filters: SubjectAnalyticsFilterDTO): Promise<SubjectAnalyticsResult>;
    getStudentAnalytics(userId: string, role: string, studentId: string): Promise<StudentAnalyticsResult>;
  }
  ```

- [ ] **Step 1: Implement aggregation pipelines for overview, class-wise, subject-wise, and student performance**
- [ ] **Step 2: Implement controllers mapping requests, responses, and secure attachment downloads**
- [ ] **Step 3: Verify attachment authorization (prevent arbitrary access)**
- [ ] **Step 4: Commit**
  ```bash
  git add src/services/assignmentAnalytics.service.ts src/controllers/assignment.controller.ts
  git commit -m "feat(phase-4): implement assignment analytics and controller layer"
  ```

---

### Task 7: REST Routes & Express Mounting

**Files:**
- Create: `src/routes/assignment.routes.ts`
- Modify: `src/routes/index.ts`

**Interfaces:**
- Mounts:
  - `/api/v1/assignments` -> Assignment Router
  - `/api/v1/submissions` -> Evaluation Router (or embedded in assignment routes)
  - `/api/v1/attachments` -> Attachment Download Router

- [ ] **Step 1: Define all endpoints with authentication, RBAC, and Zod validation middleware**
- [ ] **Step 2: Mount in `src/routes/index.ts`**
- [ ] **Step 3: Run `npx tsc --noEmit` to verify type completeness**
- [ ] **Step 4: Commit**
  ```bash
  git add src/routes/assignment.routes.ts src/routes/index.ts
  git commit -m "feat(phase-4): wire assignment routes into Express API router"
  ```

---

### Task 8: Integration Test Suite (All 18 Requirements)

**Files:**
- Create: `tests/integration/assignment.test.ts`

- [ ] **Step 1: Write integration tests covering:**
  1. Assignment creation by teacher.
  2. Assignment publication & state transition.
  3. Invalid assignment references (bad section, subject).
  4. Teacher assignment permission enforcement (unassigned teacher rejected).
  5. Student assignment visibility (published assignments only).
  6. Draft assignment access rejection for students.
  7. Successful student submission with text and attachment.
  8. Submission deadline enforcement (rejection after due date when late submission disabled).
  9. Late submission acceptance with `isLate: true` when enabled.
  10. Resubmission rules and attempt tracking.
  11. File upload validation (unsupported MIME type rejection, size boundary).
  12. Unauthorized attachment access rejection.
  13. Evaluation and marks validation (`marksObtained <= totalMarks`).
  14. Evaluation history audit trail.
  15. Student access restriction (cannot view or evaluate other students' work).
  16. Parent access restriction (can view only linked child's published grades).
  17. Assignment analytics calculation accuracy.
  18. Regression testing across Phase 1, Phase 2, Phase 3, and Phase 4.
- [ ] **Step 2: Run `npm test` and ensure all suites pass**
- [ ] **Step 3: Commit**
  ```bash
  git add tests/integration/assignment.test.ts
  git commit -m "test(phase-4): add integration test suite covering assignment lifecycle"
  ```

---

### Task 9: Documentation & Remote Push

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Update README.md with Phase 4 schema, endpoints, and storage guidelines**
- [ ] **Step 2: Update AGENTS.md with Phase 4 operational patterns**
- [ ] **Step 3: Build check `npm run build` and run full test suite `npm test`**
- [ ] **Step 4: Git push to `origin main`**
- [ ] **Step 5: Present completion report to user and await Phase 5 approval**
