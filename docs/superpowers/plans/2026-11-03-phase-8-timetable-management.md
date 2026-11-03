# Phase 8 – Timetable & Scheduling Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete, enterprise-grade Timetable and Scheduling Management System for MSEC supporting timetable creation, period entry management, an explainable conflict detection engine (teacher, section, classroom, laboratory, leave, exam conflicts), teacher personal timetables with workload metrics, student/parent class schedules, substitution/rescheduling management with approval workflows, and administrative timetable analytics.

**Architecture:** 3-tier REST architecture (Routes $\to$ Controllers $\to$ Services $\to$ Models) using TypeScript strict mode, Express, MongoDB/Mongoose, and Zod validation. The conflict detection engine operates pre-save to guarantee scheduling integrity at application and database tiers while supporting audited administrator overrides.

**Tech Stack:** Node.js 20+, TypeScript 5.7+ (strict mode), Express 4.21, MongoDB / Mongoose 8.9, Zod 3.24, Jest 29, Supertest 7.

---

## Global Constraints
- Backend only: strictly zero frontend, UI, CSS, or dashboard screens.
- Zero breaking changes to Phases 1–7 (all 92 existing integration tests must continue to pass).
- Reuse existing authentication, academic, teacher, class, section, subject, examination, student, and parent models.
- Prevent duplicate active timetables for the same section during overlapping periods.
- Prevent overlapping timetable entries without explicit audited administrator overrides.
- Draft timetables must remain strictly hidden from students and parents.
- Preserve historical and archived timetables without destructive mutations.

---

### Task 1: Data Models & Database Indexes
**Files:**
- Create: `src/models/timetable.model.ts`
- Create: `src/models/timetableEntry.model.ts`
- Create: `src/models/timetableChange.model.ts`
- Create: `src/models/timetableConflictOverride.model.ts`
- Create: `src/models/teacherLeave.model.ts`
- Modify: `src/models/index.ts`

- [ ] 1.1 Create `Timetable` model (`src/models/timetable.model.ts`):
  - `name`: string (required, trimmed)
  - `academicYear`: Types.ObjectId (ref: AcademicYear, required)
  - `semester`: number (required, 1-8)
  - `department`: Types.ObjectId (ref: Department, required)
  - `class`: Types.ObjectId (ref: Class, required)
  - `section`: Types.ObjectId (ref: Section, required)
  - `effectiveFrom`: Date (required)
  - `effectiveTo`: Date (required)
  - `timetableType`: enum `['regular', 'temporary', 'examination', 'special']` (default: `'regular'`)
  - `status`: enum `['draft', 'published', 'archived']` (default: `'draft'`)
  - `version`: number (default: 1)
  - `createdBy`: Types.ObjectId (ref: User, required)
  - `publishedBy`: Types.ObjectId (ref: User)
  - `publishedAt`: Date
  - Indexes: `{ section: 1, effectiveFrom: 1, effectiveTo: 1, status: 1 }`, `{ academicYear: 1, semester: 1 }`
- [ ] 1.2 Create `TimetableEntry` model (`src/models/timetableEntry.model.ts`):
  - `timetable`: Types.ObjectId (ref: Timetable, required)
  - `dayOfWeek`: enum `['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']`
  - `periodNumber`: number (required, 1-10)
  - `startTime`: string (e.g. "09:00", required)
  - `endTime`: string (e.g. "09:55", required)
  - `subject`: Types.ObjectId (ref: Subject, optional for break)
  - `teacher`: Types.ObjectId (ref: Teacher, optional for break)
  - `additionalTeachers`: Types.ObjectId[] (ref: Teacher)
  - `section`: Types.ObjectId (ref: Section, required)
  - `classroom`: string (required, e.g. "Room 301", "Lab 2")
  - `lectureType`: enum `['theory', 'practical', 'tutorial', 'lab', 'project', 'break', 'other']` (default: `'theory'`)
  - `academicYear`: Types.ObjectId (ref: AcademicYear, required)
  - `semester`: number (required)
  - `status`: enum `['active', 'cancelled', 'rescheduled', 'substituted']` (default: `'active'`)
  - `isBreak`: boolean (default: false)
  - `createdBy`: Types.ObjectId (ref: User, required)
  - Compound indexes: `{ timetable: 1, dayOfWeek: 1, periodNumber: 1 }`, `{ teacher: 1, dayOfWeek: 1, startTime: 1 }`, `{ section: 1, dayOfWeek: 1, startTime: 1 }`, `{ classroom: 1, dayOfWeek: 1, startTime: 1 }`
- [ ] 1.3 Create `TimetableChange` model (`src/models/timetableChange.model.ts`):
  - `timetable`: Types.ObjectId (ref: Timetable, required)
  - `entry`: Types.ObjectId (ref: TimetableEntry, required)
  - `changeType`: enum `['cancellation', 'rescheduling', 'substitution', 'classroom_change', 'temporary_override']`
  - `effectiveDate`: Date (required)
  - `originalTeacher`: Types.ObjectId (ref: Teacher)
  - `substituteTeacher`: Types.ObjectId (ref: Teacher)
  - `originalClassroom`: string
  - `newClassroom`: string
  - `originalStartTime`: string
  - `newStartTime`: string
  - `originalEndTime`: string
  - `newEndTime`: string
  - `originalDayOfWeek`: string
  - `newDayOfWeek`: string
  - `originalPeriodNumber`: number
  - `newPeriodNumber`: number
  - `reason`: string (required, min 3 chars)
  - `status`: enum `['pending', 'approved', 'rejected']` (default: `'pending'`)
  - `requestedBy`: Types.ObjectId (ref: User, required)
  - `approvedBy`: Types.ObjectId (ref: User)
  - `approvedAt`: Date
  - `rejectionReason`: string
- [ ] 1.4 Create `TimetableConflictOverride` model (`src/models/timetableConflictOverride.model.ts`):
  - `timetable`: Types.ObjectId (ref: Timetable, required)
  - `entry`: Types.ObjectId (ref: TimetableEntry)
  - `conflictType`: string (required)
  - `conflictDetails`: string (required)
  - `reason`: string (required, min 3 chars)
  - `overriddenBy`: Types.ObjectId (ref: User, required)
- [ ] 1.5 Create `TeacherLeave` model (`src/models/teacherLeave.model.ts`):
  - `teacher`: Types.ObjectId (ref: Teacher, required)
  - `startDate`: Date (required)
  - `endDate`: Date (required)
  - `leaveType`: enum `['casual', 'sick', 'earned', 'maternity', 'paternity', 'duty', 'other']`
  - `reason`: string (required)
  - `status`: enum `['pending', 'approved', 'rejected', 'cancelled']` (default: `'approved'`)
  - `approvedBy`: Types.ObjectId (ref: User)
- [ ] 1.6 Export all models in `src/models/index.ts`.

---

### Task 2: Zod Request Schemas
**Files:**
- Create: `src/validators/timetable.validator.ts`

- [ ] 2.1 Define Zod schemas for Timetable CRUD (`createTimetableSchema`, `updateTimetableSchema`, `queryTimetableSchema`).
- [ ] 2.2 Define Zod schemas for Timetable Entries (`createTimetableEntrySchema`, `updateTimetableEntrySchema`).
- [ ] 2.3 Define Zod schemas for Conflict Checking & Override (`checkConflictSchema`, `overrideConflictSchema`).
- [ ] 2.4 Define Zod schemas for Timetable Changes (`createTimetableChangeSchema`, `approveRejectChangeSchema`).
- [ ] 2.5 Define Zod schemas for Timetable Analytics (`queryAnalyticsSchema`).

---

### Task 3: Conflict Detection Engine
**Files:**
- Create: `src/services/timetableConflict.service.ts`

- [ ] 3.1 Implement time interval overlap helper `timeSlotsOverlap(start1, end1, start2, end2)` converting "HH:mm" to minutes.
- [ ] 3.2 Implement date range overlap helper `dateRangesOverlap(start1, end1, start2, end2)`.
- [ ] 3.3 Implement `detectConflicts(entryData, options)`:
  - Teacher conflict check (teacher or additional teachers already scheduled for overlapping time on same day in active timetables).
  - Section conflict check (section already has another class scheduled at the same time).
  - Classroom conflict check (classroom already booked by another section at the same time).
  - Laboratory conflict check (concurrent session occupancy for lab rooms).
  - Teacher availability check (checks `teacher.status === 'On Leave'` and active approved `TeacherLeave` records).
  - Examination conflict check (checks `ExaminationSchedule` for overlapping section exams or teacher invigilation on the given date/day).
- [ ] 3.4 Implement conflict override auditing in `overrideConflict(conflictData, user)`.

---

### Task 4: Timetable & Entry Management Service
**Files:**
- Create: `src/services/timetable.service.ts`

- [ ] 4.1 Implement `createTimetable` with academic reference validation, date checks, and duplicate active timetable prevention for same section.
- [ ] 4.2 Implement `updateTimetable` preserving previous version or archiving.
- [ ] 4.3 Implement `publishTimetable` and `archiveTimetable`.
- [ ] 4.4 Implement `getTimetableById` with entries and `listTimetables` with pagination.
- [ ] 4.5 Implement `createTimetableEntry` invoking conflict detection; rejects if conflicts exist unless audited override is supplied.
- [ ] 4.6 Implement `getTimetableEntries`, `updateTimetableEntry`, and `deleteTimetableEntry`.

---

### Task 5: Teacher & Student Timetable Service
**Files:**
- Create: `src/services/timetableAccess.service.ts`

- [ ] 5.1 Implement `getTeacherSchedule`:
  - Retrieves active published entries where teacher is assigned.
  - Applies approved `TimetableChange` records (substitutions/cancellations).
  - Calculates free periods (unassigned periods among standard 1-7).
  - Computes weekly teaching hours (total minutes / 60) and subject-wise teaching hours.
- [ ] 5.2 Implement `getTeacherToday` and `getTeacherWeekly`.
- [ ] 5.3 Implement `getSectionSchedule`:
  - Retrieves active published timetable for section with approved changes.
  - Groups by day of the week.
- [ ] 5.4 Implement `getStudentSchedule` & `getStudentToday` (resolving student's section and checking student/parent access control).

---

### Task 6: Timetable Changes & Substitutions Service
**Files:**
- Create: `src/services/timetableChange.service.ts`

- [ ] 6.1 Implement `createChange`:
  - Handles cancellation, rescheduling, teacher substitution, classroom changes, temporary overrides.
  - Runs conflict detection on substitute teacher or new time/room before submitting.
  - Automatically approves if created by Admin or sets pending for approval.
- [ ] 6.2 Implement `approveChange` and `rejectChange`.
- [ ] 6.3 Implement `listChanges` with filters (`timetable`, `status`, `teacher`, `date`).

---

### Task 7: Timetable Analytics Engine
**Files:**
- Create: `src/services/timetableAnalytics.service.ts`

- [ ] 7.1 Implement `getTeacherWorkloadAnalytics`:
  - Aggregates weekly lecture hours per teacher, identifies highest and lowest teaching workloads.
- [ ] 7.2 Implement `getClassroomUtilizationAnalytics`:
  - Computes classroom occupied hours, utilization rate (hours / standard week), and finds free classrooms for a specified day and period.
- [ ] 7.3 Implement `getSubjectDistributionAnalytics`:
  - Computes lecture count and hours per subject across sections.
- [ ] 7.4 Implement `getConflictReport`:
  - Lists overridden conflicts and historical scheduling alerts.

---

### Task 8: Controllers & Express REST Routes
**Files:**
- Create: `src/controllers/timetable.controller.ts`
- Create: `src/routes/timetable.routes.ts`
- Create: `src/routes/timetableEntry.routes.ts`
- Create: `src/routes/timetableChange.routes.ts`
- Modify: `src/routes/index.ts`

- [ ] 8.1 Implement `timetable.controller.ts` covering all handlers.
- [ ] 8.2 Define Express routes with proper precedence (static routes before `/:id`).
- [ ] 8.3 Mount routes in `src/routes/index.ts` under `/api/v1/timetables`, `/api/v1/timetable-entries`, and `/api/v1/timetable-changes`.

---

### Task 9: Automated Integration Tests
**Files:**
- Create: `tests/integration/timetable.test.ts`

- [ ] 9.1 Test Timetable creation, publication, and archive.
- [ ] 9.2 Test Timetable entry creation.
- [ ] 9.3 Test Teacher overlap detection.
- [ ] 9.4 Test Section overlap detection.
- [ ] 9.5 Test Classroom overlap detection.
- [ ] 9.6 Test Laboratory capacity / overlap rules.
- [ ] 9.7 Test Teacher leave conflicts.
- [ ] 9.8 Test Examination conflicts.
- [ ] 9.9 Test Conflict override authorization and audit logging.
- [ ] 9.10 Test Timetable change approval (substitution & rescheduling).
- [ ] 9.11 Test Teacher timetable access (today, weekly, teaching hours, free periods).
- [ ] 9.12 Test Student timetable access (assigned section, drafts hidden).
- [ ] 9.13 Test Parent timetable access (linked child).
- [ ] 9.14 Test Temporary timetable changes reflected in daily schedule.
- [ ] 9.15 Test Historical timetable preservation.
- [ ] 9.16 Test Timetable Analytics (teacher workload, classroom utilization, subject distribution).
- [ ] 9.17 Test Regression against Phases 1–7.

---

### Task 10: Verification, Documentation & Git Push
- [ ] 10.1 Run TypeScript type check: `npx tsc --noEmit`.
- [ ] 10.2 Run full test suite: `npm test` across all 8 suites.
- [ ] 10.3 Update `README.md` and `AGENTS.md`.
- [ ] 10.4 Commit and push all work to GitHub `main` branch.
