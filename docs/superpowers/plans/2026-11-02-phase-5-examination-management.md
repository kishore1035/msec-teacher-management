# Phase 5 – Assessments, Examinations & Results Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete examination and assessment management backend supporting internal assessments (IA1, IA2, IA3), semester exams, timetable scheduling with conflict prevention, bulk marks entry, configurable dynamic grading, result verification/publication, post-publication audit trails, and analytics.

**Architecture:** Layered 3-tier REST architecture (Routes -> Controllers -> Services -> Models) leveraging Mongoose schemas with compound indexes, Zod validation, dynamic policy-based grading and IA calculation engines (no hardcoding), and resource-level RBAC for teachers, students, parents, and administrators.

**Tech Stack:** Node.js (v20+), TypeScript (strict mode), Express.js 4.x, MongoDB & Mongoose 8.x, Zod 3.x, Jest & Supertest, mongodb-memory-server.

**Spec:** Phase 5 prompt specification provided in conversation.

## Global Constraints
- Strictly backend only; zero frontend, UI, or HTML views.
- Strict TypeScript (`noImplicitAny`, strict null checks, strict boolean expressions).
- Do not hardcode grading scales (VTU or otherwise) or internal assessment calculation formulas. All must be driven by configuration models (`GradingPolicy` / `InternalAssessmentPolicy`).
- Overlapping exam schedules for the same section must be prevented via validation and compound unique indexes.
- Teachers can only enter marks and view examination schedules for their assigned subjects and sections.
- Students can only view their own published results; parents can only view published results for linked children. Draft/unpublished marks must remain strictly inaccessible.
- All post-publication marks modifications must enforce an immutable audit history with previous marks, new marks, modifier ID, and mandatory change reason.
- Zero regressions: never break Phase 1, Phase 2, Phase 3, or Phase 4 endpoints or tests.

## Review Focus
1. Schedule collision prevention: Multiple examinations scheduled for the exact same section on the same date/time slot must be rejected.
2. Marks boundary enforcement: `0 <= marksObtained <= examination.maximumMarks` (or `isAbsent = true` / `isExempted = true`).
3. Unpublished result leak: Students/parents querying `/results/*` must never receive unpublished or pending results.
4. Duplicate result entries: Multiple marks records for the same student, subject, and examination must be prevented via compound unique indexes.
5. Internal assessment calculation edge cases: Handling absent/exempted students in Best-of-N or weighted averages without corrupting total score.

---

### Task 1: Examination & Schedule Mongoose Models & Compound Indexes

**Files:**
- Create: `src/models/examination.model.ts`
- Create: `src/models/examinationSchedule.model.ts`
- Create: `src/models/gradingPolicy.model.ts`
- Modify: `src/models/index.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface IExamination extends Document { ... }
  export interface IExaminationSchedule extends Document { ... }
  export interface IGradingPolicy extends Document { ... }
  ```

- [ ] **Step 1: Write model schemas with enums and compound indexes**
  - `ExaminationSchedule`: compound unique index on `{ section: 1, examDate: 1, startTime: 1 }`
  - `GradingPolicy`: configurable grading tiers (`minPercentage`, `grade`, `gradePoint`, `description`) and IA calculation methods (`BEST_2_OF_3`, `AVERAGE_ALL`, `WEIGHTED`)
- [ ] **Step 2: Export in `src/models/index.ts`**
- [ ] **Step 3: Verify TypeScript compilation via `npx tsc --noEmit`**
- [ ] **Step 4: Commit**

---

### Task 2: ExaminationResult & Question Assessment Models

**Files:**
- Create: `src/models/examinationResult.model.ts`
- Create: `src/models/questionAssessment.model.ts`
- Modify: `src/models/index.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface IResultAudit {
    previousMarks?: number;
    newMarks: number;
    previousGrade?: string;
    newGrade?: string;
    changedBy: Types.ObjectId;
    reason: string;
    timestamp: Date;
  }
  export interface IExaminationResult extends Document { ... }
  ```

- [ ] **Step 1: Write `ExaminationResult` schema with compound unique index on `{ examination: 1, student: 1, subject: 1 }`**
- [ ] **Step 2: Include `auditHistory` sub-document array, absent/exempted flags, and publication status**
- [ ] **Step 3: Write flexible `Question` / `AssessmentComponent` schema**
- [ ] **Step 4: Export in `src/models/index.ts` and verify with `npx tsc --noEmit`**
- [ ] **Step 5: Commit**

---

### Task 3: Zod Request Validators for Examination, Scheduling & Results

**Files:**
- Create: `src/validators/examination.validator.ts`

**Interfaces:**
- Produces:
  ```typescript
  export const createExaminationValidator: ZodSchema;
  export const updateExaminationValidator: ZodSchema;
  export const createScheduleValidator: ZodSchema;
  export const updateScheduleValidator: ZodSchema;
  export const bulkMarksEntryValidator: ZodSchema;
  export const correctResultValidator: ZodSchema;
  export const gradingPolicyValidator: ZodSchema;
  export const examinationQueryValidator: ZodSchema;
  ```

- [ ] **Step 1: Write schemas validating dates (`startDate <= endDate`), time format, marks bounds (`passingMarks <= maximumMarks`)**
- [ ] **Step 2: Verify compilation with `npx tsc --noEmit`**
- [ ] **Step 3: Commit**

---

### Task 4: Examination & Timetable Scheduling Service

**Files:**
- Create: `src/services/examination.service.ts`

**Interfaces:**
- Produces:
  ```typescript
  export class ExaminationService {
    createExamination(userId: string, role: string, data: CreateExamDTO): Promise<IExamination>;
    getExaminations(userId: string, role: string, query: ExamQueryDTO): Promise<PaginatedResult<IExamination>>;
    getExaminationById(id: string): Promise<IExamination>;
    updateExamination(userId: string, role: string, id: string, data: UpdateExamDTO): Promise<IExamination>;
    updateExaminationStatus(userId: string, role: string, id: string, status: string): Promise<IExamination>;
    deleteExamination(userId: string, role: string, id: string): Promise<void>;
    scheduleExamination(userId: string, role: string, examId: string, data: ScheduleDTO): Promise<IExaminationSchedule>;
    getSchedulesForExam(examId: string): Promise<IExaminationSchedule[]>;
    updateSchedule(userId: string, role: string, scheduleId: string, data: UpdateScheduleDTO): Promise<IExaminationSchedule>;
    getMySchedule(userId: string, role: string): Promise<IExaminationSchedule[]>;
  }
  ```

- [ ] **Step 1: Implement examination creation and lifecycle state management**
- [ ] **Step 2: Implement timetable scheduling with slot collision detection for section**
- [ ] **Step 3: Implement invigilator and teacher schedule views**
- [ ] **Step 4: Verify with `npx tsc --noEmit` and commit**

---

### Task 5: Result Calculation, Grading Policy & Marks Entry Engine

**Files:**
- Create: `src/services/result.service.ts`

**Interfaces:**
- Produces:
  ```typescript
  export class ResultService {
    bulkEnterMarks(userId: string, role: string, examId: string, marksData: BulkMarksDTO): Promise<IExaminationResult[]>;
    getMarksForExam(userId: string, role: string, examId: string, query: ResultQueryDTO): Promise<PaginatedResult<IExaminationResult>>;
    updateResult(userId: string, role: string, resultId: string, data: UpdateMarksDTO): Promise<IExaminationResult>;
    correctPublishedResult(userId: string, role: string, resultId: string, data: CorrectMarksDTO): Promise<IExaminationResult>;
    publishExaminationResults(userId: string, role: string, examId: string): Promise<{ count: number }>;
    getMyResults(userId: string): Promise<IExaminationResult[]>;
    getStudentResults(userId: string, role: string, studentId: string): Promise<IExaminationResult[]>;
    getResultHistory(userId: string, role: string, resultId: string): Promise<IResultAudit[]>;
    getInternalAssessmentsForStudent(studentId: string, academicYearId?: string): Promise<any>;
    configureGradingPolicy(userId: string, data: GradingPolicyDTO): Promise<IGradingPolicy>;
    getActiveGradingPolicy(academicYearId?: string): Promise<IGradingPolicy>;
  }
  ```

- [ ] **Step 1: Implement dynamic policy-based grade calculation (`calculateGradeAndPercentage`)**
- [ ] **Step 2: Implement bulk marks entry with teacher section/subject assignment verification**
- [ ] **Step 3: Implement post-publication correction with mandatory reason and immutable audit history**
- [ ] **Step 4: Implement internal assessment aggregator (IA1, IA2, IA3) using active policy formula**
- [ ] **Step 5: Verify with `npx tsc --noEmit` and commit**

---

### Task 6: Examination Analytics Engine & Controller Layer

**Files:**
- Create: `src/services/examinationAnalytics.service.ts`
- Create: `src/controllers/examination.controller.ts`

**Interfaces:**
- Produces:
  ```typescript
  export class ExaminationAnalyticsService {
    getOverviewAnalytics(filters: AnalyticsFilterDTO): Promise<any>;
    getClassAnalytics(filters: AnalyticsFilterDTO): Promise<any>;
    getSubjectAnalytics(filters: AnalyticsFilterDTO): Promise<any>;
    getGradeDistribution(filters: AnalyticsFilterDTO): Promise<any>;
    getStudentAnalytics(studentId: string): Promise<any>;
  }
  export class ExaminationController { ... }
  ```

- [ ] **Step 1: Implement aggregation pipelines for class average, highest/lowest marks, pass/fail percentage, grade distribution, and IA comparisons**
- [ ] **Step 2: Implement REST controllers mapping requests, responses, and error handling**
- [ ] **Step 3: Verify with `npx tsc --noEmit` and commit**

---

### Task 7: REST Routes & Express Router Mounting

**Files:**
- Create: `src/routes/examination.routes.ts`
- Modify: `src/routes/index.ts`

- [ ] **Step 1: Define endpoints for `/examinations`, `/examination-schedules`, `/examination-results`, `/internal-assessments`, `/results`**
- [ ] **Step 2: Mount routers in `src/routes/index.ts`**
- [ ] **Step 3: Verify TypeScript compilation with `npx tsc --noEmit`**
- [ ] **Step 4: Commit**

---

### Task 8: Comprehensive Integration Test Suite (19 Scenarios)

**Files:**
- Create: `tests/integration/examination.test.ts`

- [ ] **Step 1: Write integration tests covering:**
  1. Examination creation by Admin.
  2. Examination schedule creation with venue and invigilator.
  3. Overlapping examination schedule prevention (conflict rejection).
  4. Invalid academic references rejection.
  5. Teacher authorization (unassigned teacher rejected).
  6. Bulk marks entry by assigned teacher.
  7. Duplicate result prevention via compound unique index.
  8. Marks exceeding maximum marks rejection.
  9. Internal assessment calculations (IA1, IA2, IA3 aggregation).
  10. Configurable grading rules (dynamic policy application).
  11. Pass/fail calculation accuracy.
  12. Absent and exempted student handling.
  13. Result verification by administrator.
  14. Result publication lifecycle (`evaluationStatus = 'published'`).
  15. Student access restriction (can view only own published results; drafts 403).
  16. Parent access restriction (can view only linked child's published results).
  17. Published result correction with mandatory reason & audit history.
  18. Examination analytics calculations (averages, pass percentage, grade distribution).
  19. Full regression testing (all test suites passing).
- [ ] **Step 2: Run Jest integration test and verify all pass**
- [ ] **Step 3: Commit**

---

### Task 9: Documentation & Remote Push

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Update README.md with Phase 5 endpoints, schemas, and calculation rules**
- [ ] **Step 2: Update AGENTS.md with Phase 5 operational guidelines**
- [ ] **Step 3: Verify full test suite `npm test` and build check `npm run build`**
- [ ] **Step 4: Git push to `origin main`**
- [ ] **Step 5: Present completion report to user and await Phase 6 approval**
