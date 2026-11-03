# Phase 6 – Student Progress Tracking & Performance Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a comprehensive, policy-driven student progress tracking, performance analytics, at-risk detection, and academic progress report generation engine for the MSEC Teacher Management Dashboard backend.

**Architecture:** 3-tier REST architecture (Routes $\to$ Controllers $\to$ Services $\to$ Models) adhering strictly to strict TypeScript, Express, MongoDB/Mongoose, and Zod validation. The analytics engine performs multi-collection aggregations over Attendance, Assignments, Submissions, Examinations, and Results without duplicating source records, persists auditable snapshots in `StudentProgress`, and evaluates explainable risk scores using dynamic `RiskRule` configurations.

**Tech Stack:** Node.js 20+, TypeScript 5.7+ (strict mode), Express 4.21, MongoDB / Mongoose 8.9, Zod 3.24, Jest 29, Supertest 7, Winston.

**Spec:** Phase 6 specifications from User Request.

## Global Constraints
- Backend only: strictly zero frontend, UI, CSS, or dashboard screens.
- Zero breaking changes to Phase 1, Phase 2, Phase 3, Phase 4, or Phase 5 endpoints.
- All existing 62 automated tests must continue passing.
- Dynamic configurable rules: never hardcode risk thresholds or performance weighting formulas; load from `RiskRule` and `GradingPolicy`.
- Missing marks handling: never interpret missing or unassigned assessments as zero.
- Historical snapshots: preserve academic history and never overwrite previous snapshot records.
- Strict RBAC: Students can only access their own records; parents can only access linked children; teachers can only access assigned sections/subjects; admins have full access.

---

### Task 1: Data Models & Database Indexes
**Files:**
- Create: `src/models/riskRule.model.ts`
- Create: `src/models/studentProgress.model.ts`
- Modify: `src/models/index.ts`

- [ ] 1.1 Create `RiskRule` model with fields: `name`, `isDefault`, `academicYear`, `attendanceThreshold`, `assignmentCompletionThreshold`, `iaPassPercentageThreshold`, `examPassPercentageThreshold`, `consecutiveDeclinesThreshold`, `failedSubjectsThreshold`, `riskWeights`, `riskScoreTiers`, `createdBy`, `timestamps`.
- [ ] 1.2 Create `StudentProgress` model with fields: `student`, `academicYear`, `semester`, `section`, `subject` (optional), `attendancePercentage`, `assignmentCompletionRate`, `assignmentAverageMarks`, `iaMarks`, `examinationMarks`, `overallAcademicPercentage`, `previousAcademicPerformance`, `currentAcademicPerformance`, `progressTrend` (`improving`, `declining`, `stable`, `irregular`), `riskLevel` (`low`, `medium`, `high`), `riskIndicators` array, `isSnapshot`, `snapshotDate`, `lastCalculatedAt`.
- [ ] 1.3 Add compound unique index on `{ student: 1, academicYear: 1, semester: 1, subject: 1, isSnapshot: 1 }` and compound index on `{ student: 1, isSnapshot: 1, snapshotDate: 1 }`.
- [ ] 1.4 Export `RiskRule` and `StudentProgress` from `src/models/index.ts`.
- [ ] 1.5 Run `npx tsc --noEmit` and commit models.

---

### Task 2: Request Validators (Zod)
**Files:**
- Create: `src/validators/progress.validator.ts`

- [ ] 2.1 Define Zod schemas for `createRiskRuleSchema`, `studentProgressQuerySchema`, `atRiskQuerySchema`, `classAnalyticsQuerySchema`, `subjectAnalyticsQuerySchema`, `teacherInsightsQuerySchema`, `progressReportQuerySchema`, and `generateReportBodySchema`.
- [ ] 2.2 Validate all query parameters, IDs, pagination, and date ranges.
- [ ] 2.3 Run `npx tsc --noEmit` and commit validators.

---

### Task 3: Risk Detection Engine & Policy Service
**Files:**
- Create: `src/services/riskDetection.service.ts`

- [ ] 3.1 Implement `getActiveRiskRule(academicYearId?)`: returns configured or institutional default risk rule.
- [ ] 3.2 Implement `createOrUpdateRiskRule(ruleData, userId)` for administrative customization of thresholds.
- [ ] 3.3 Implement `evaluateStudentRisk(studentId, academicYearId, semester)`:
  - Gathers attendance %, assignment completion %, IA percentage, exam marks trend, and failed subjects count.
  - Generates transparent, explainable indicators with severity (`low`, `medium`, `high`) and score contribution.
  - Categorizes into `low`, `medium`, or `high` risk strictly based on actual records.
- [ ] 3.4 Implement `getAtRiskStudents(filters, userRole, userId)`: filters by section/department/class with teacher assignment scoping.
- [ ] 3.5 Run `npx tsc --noEmit` and commit service.

---

### Task 4: Student Progress Profile & Trend Tracking Service
**Files:**
- Create: `src/services/studentProgress.service.ts`

- [ ] 4.1 Implement `calculateStudentProgress(studentId, options)`:
  - Integrates attendance from `AttendanceSession` & `AttendanceRecord`.
  - Integrates assignments from `Assignment` & `AssignmentSubmission`.
  - Integrates marks from `Examination` & `ExaminationResult`.
  - Handles missing marks appropriately (does not treat missing exams as 0).
  - Calculates dynamic overall percentage using dynamic policy or equal weighting.
  - Determines progress trend (`improving`, `declining`, `stable`, `irregular`) by analyzing consecutive assessment performance deltas.
  - Evaluates risk level and attaches risk indicators via `RiskDetectionService`.
  - Saves current progress record and creates historical snapshot if requested (`isSnapshot: true`).
- [ ] 4.2 Implement `getStudentProgress(studentId, requestingUser, options)` with strict RBAC (student=self, parent=linked child, teacher=assigned section, admin=all).
- [ ] 4.3 Implement `getStudentSubjectWiseProgress(studentId, requestingUser)` returning detailed breakdown per subject.
- [ ] 4.4 Implement `getStudentProgressHistory(studentId, requestingUser)` returning historical snapshots.
- [ ] 4.5 Implement `getStudentProgressTrends(studentId, requestingUser)` returning time-series performance metrics.
- [ ] 4.6 Run `npx tsc --noEmit` and commit service.

---

### Task 5: Class & Subject Performance Analytics & Teacher Insights Service
**Files:**
- Create: `src/services/classSubjectAnalytics.service.ts`

- [ ] 5.1 Implement Class Analytics methods:
  - `getClassOverview(filters)`: total students, class average, attendance average, assignment completion rate, exam pass rate.
  - `getClassPerformance(filters)`: subject-wise averages, grade distribution, top-performing students, students requiring attention.
  - `getClassAttendance(filters)`: detailed attendance statistics and trends.
  - `getClassAssignments(filters)`: assignment submission and evaluation rates.
- [ ] 5.2 Implement Subject Analytics methods:
  - `getSubjectOverview(filters)`: subject average, highest/lowest marks, pass/fail percentage.
  - `getSubjectPerformance(filters)`: student grade distribution and assessment breakdown.
  - `getSubjectComparison(filters)`: compares performance across sections and computes data-backed difficulty index (only when sample size $\ge 5$).
- [ ] 5.3 Implement Teacher Performance Insights:
  - `getTeacherOverview(teacherUserId, filters)`: validates `TeacherAssignment` authorization and computes aggregated metrics across assigned sections/subjects.
  - `getTeacherStudentsAtRisk(teacherUserId, filters)`: returns students at risk within the teacher's assigned classes.
- [ ] 5.4 Run `npx tsc --noEmit` and commit service.

---

### Task 6: Progress Report Generation Service
**Files:**
- Create: `src/services/progressReport.service.ts`

- [ ] 6.1 Implement `generateStudentReport(studentId, requestingUser, options)`: generates comprehensive structured JSON report containing student info, attendance summary, assignment summary, IA marks, exam results, overall performance, trends, and risk warnings.
- [ ] 6.2 Implement `generateClassReport(sectionId, requestingUser, options)`: generates class-level summary report.
- [ ] 6.3 Implement export handlers supporting JSON, CSV/Excel (`text/csv` / `application/vnd.ms-excel`), and formatted text/printable report.
- [ ] 6.4 Enforce RBAC on report generation and export.
- [ ] 6.5 Run `npx tsc --noEmit` and commit service.

---

### Task 7: Controllers & REST Routes
**Files:**
- Create: `src/controllers/progress.controller.ts`
- Create: `src/controllers/analytics.controller.ts`
- Create: `src/controllers/report.controller.ts`
- Create: `src/routes/progress.routes.ts`
- Create: `src/routes/analytics.routes.ts`
- Create: `src/routes/report.routes.ts`
- Modify: `src/routes/index.ts`

- [ ] 7.1 Implement Progress controller and mount `/api/v1/progress` routes.
- [ ] 7.2 Implement Analytics controller and mount `/api/v1/analytics` routes.
- [ ] 7.3 Implement Report controller and mount `/api/v1/reports` routes.
- [ ] 7.4 Verify all endpoints match the specification.
- [ ] 7.5 Run `npx tsc --noEmit` and commit controllers and routes.

---

### Task 8: Comprehensive Automated Integration Tests
**Files:**
- Create: `tests/integration/progressAnalytics.test.ts`

- [ ] 8.1 Write integration tests covering all 19 scenarios:
  1. Student progress profile calculation.
  2. Subject-wise performance breakdown.
  3. Semester-wise and historical snapshot comparison.
  4. Attendance data integration.
  5. Assignment submissions integration.
  6. Examination results integration.
  7. Consistent improvement detection.
  8. Declining performance detection.
  9. Risk classification (`low`, `medium`, `high`) with explainable indicators.
  10. Configurable risk rules (customizing thresholds updates risk scoring).
  11. Missing marks handling (missing exam does not evaluate as 0%).
  12. Class performance analytics (averages, top performers, at-risk count).
  13. Subject analytics (averages, pass/fail, difficulty indicator).
  14. Teacher access restrictions (teachers can only access assigned sections/subjects).
  15. Student access restrictions (students cannot view other students' progress).
  16. Parent access restrictions (parents cannot view unlinked students' progress).
  17. Structured progress report generation and export.
  18. Historical snapshot preservation (snapshots are preserved upon recalculation).
  19. Full suite regression check across Phases 1–5.
- [ ] 8.2 Run `npx jest tests/integration/progressAnalytics.test.ts` and ensure 100% pass rate.
- [ ] 8.3 Run full test suite `npm test` across all 6 test files.

---

### Task 9: Documentation, Git Commit & Push
**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `task.md`

- [ ] 9.1 Update `README.md` with Phase 6 endpoints, performance calculation rules, and risk detection logic.
- [ ] 9.2 Update `AGENTS.md` with Phase 6 architectural rules and data invariants.
- [ ] 9.3 Update `task.md` artifact.
- [ ] 9.4 Git add, commit, and push to GitHub `origin main`.
- [ ] 9.5 Present complete Phase 6 report to the user and wait for approval before Phase 7.
