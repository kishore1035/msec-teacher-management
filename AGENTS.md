# AGENTS.md — Agent & Developer Operational Manual

Welcome to the **MSEC Teacher Management Dashboard & Academic Backend**. This document serves as the single source of truth for AI agents and human engineers contributing to this repository.

---

## 1. System Vision & Architecture

The Teacher Management System is an enterprise educational ERP backend built exclusively with:
- **Runtime:** Node.js (v20+ LTS)
- **Language:** TypeScript (strict mode, zero implicit any, strict null checks)
- **Framework:** Express.js 4.x
- **Database & ODM:** MongoDB with Mongoose 8.x
- **Authentication:** Stateless dual JWT (15-min Access Tokens + 7-day Rotating Refresh Tokens) with multi-device session tracking and cryptographic token-reuse invalidation.
- **Validation:** Request body, query, and params validated using Zod.
- **Testing:** Automated integration tests using Jest and `mongodb-memory-server`.

---

## 2. Directory Structure & Layering Rules

```
src/
├── config/             # Zod-validated environment, Mongoose connection, Winston logger
├── constants/          # System roles, HTTP status codes, standard messages
├── types/              # Express request augmentations, JWT payloads, DTOs
├── utils/              # ApiError, ApiResponse, asyncHandler, jwt, password, pagination
├── middleware/         # auth, rbac, validate, error, rateLimiter
├── models/             # Mongoose schemas, compound indexes, pre-save hooks
├── validators/         # Zod schemas for all endpoints
├── services/           # Reusable business logic, calculations, multi-doc operations
├── controllers/        # Request parsing and standardized ApiResponse formatting
├── routes/             # REST endpoints mounted under /api/v1
└── app.ts / server.ts  # Express app setup and HTTP server lifecycle
```

### Layering Rules:
1. **Never write DB queries in Controllers.** Always encapsulate business rules, aggregations, and DB operations in Services.
2. **Never expose raw Mongoose documents with sensitive fields.** Passwords and refresh tokens must use `select: false` and be deleted in `.toJSON()`.
3. **Never hardcode institutional thresholds.** Attendance thresholds and grading criteria must be read dynamically from active configuration records (`AttendancePolicy`).
4. **Use compound unique indexes** to guarantee data integrity at the database layer (e.g. unique sections per term, unique sessions per period, unique student attendance records per session).

---

## 3. Implemented Modules

| Phase | Module | Key Models | Primary Endpoints |
| :--- | :--- | :--- | :--- |
| **Phase 1** | Authentication & RBAC | `User` | `/api/v1/auth/*` |
| **Phase 2** | Academic Core & Classes | `AcademicYear`, `Department`, `Class`, `Section`, `Subject`, `Teacher`, `TeacherAssignment` | `/api/v1/academics/*`, `/api/v1/departments/*`, `/api/v1/classes/*`, `/api/v1/sections/*`, `/api/v1/subjects/*`, `/api/v1/teacher-assignments/*`, `/api/v1/teachers/me/*` |
| **Phase 3** | Attendance & Shortages | `AttendanceSession`, `AttendanceRecord`, `AttendancePolicy`, `Student`, `Parent` | `/api/v1/attendance/*` |
| **Phase 4** | Assignment & Submissions | `Assignment`, `AssignmentSubmission` | `/api/v1/assignments/*`, `/api/v1/submissions/*`, `/api/v1/attachments/*` |
| **Phase 5** | Assessments, Exams & Results | `Examination`, `ExaminationSchedule`, `GradingPolicy`, `ExaminationResult`, `QuestionAssessment` | `/api/v1/examinations/*`, `/api/v1/examination-schedules/*`, `/api/v1/examination-results/*`, `/api/v1/internal-assessments/*`, `/api/v1/results/*` |
| **Phase 6** | Student Progress & Performance Analytics | `RiskRule`, `StudentProgress` | `/api/v1/progress/*`, `/api/v1/analytics/*`, `/api/v1/reports/*` |
| **Phase 7** | Study Materials & Resource Management | `StudyMaterial`, `StudyMaterialVersion` | `/api/v1/study-materials/*` |
| **Phase 8** | Timetable & Scheduling Management | `Timetable`, `TimetableEntry`, `TimetableChange`, `TimetableConflictOverride`, `TeacherLeave` | `/api/v1/timetables/*`, `/api/v1/timetable-entries/*`, `/api/v1/timetable-changes/*` |
| **Phase 9** | Announcements & Notifications Management | `Announcement`, `Notification`, `NotificationPreference`, `NotificationDevice` | `/api/v1/announcements/*`, `/api/v1/notifications/*` |
| **Phase 10** | Doubt Management & Parent Communication | `Doubt`, `DoubtMessage`, `Parent`, `ParentCommunication`, `ParentCommunicationMessage` | `/api/v1/doubts/*`, `/api/v1/parents/*`, `/api/v1/parent-communications/*` |
| **Phase 11** | Leave, Substitution & Teacher Management | `Teacher`, `TeacherLeave` (`LeaveRequest`), `LeavePolicy`, `Substitution` | `/api/v1/teachers/*`, `/api/v1/leave-requests/*`, `/api/v1/leaves/*`, `/api/v1/substitutions/*`, `/api/v1/analytics/*` |

---

## 4. Attendance Calculation Engine & Policy Treatment

Attendance percentage is calculated dynamically based on the active `AttendancePolicy`:
- **Total Sessions:** All completed sessions recorded for the section/subject.
- **Cancelled Sessions:** Strictly excluded from all totals and calculations.
- **Excused Treatment:**
  - `ExcludeFromTotal`: Countable sessions = `Total - Excused`. (Default institutional rule).
  - `Present`: Counted as full attendance (`+1.0`).
  - `Absent`: Counted as unexcused absence (`+0.0`).
- **Late Treatment:**
  - `Present`: Counted as full attendance (`+1.0`). (Default).
  - `CountAsHalf`: Counted as half-credit attendance (`+0.5`).
  - `Absent`: Counted as absent (`+0.0`).
- **Formula:**
  $$\text{Percentage} = \left( \frac{\text{Weighted Attended Sessions}}{\text{Countable Sessions}} \right) \times 100$$
- **Shortage Criteria:** $\text{Percentage} < \text{institutionThreshold}$ (default 75%).
- **Warning Criteria:** $\text{institutionThreshold} \le \text{Percentage} \le \text{warningThreshold}$ (default 85%).

---

## 5. Assignment Lifecycle & Storage Architecture

- **Lifecycle:** `draft` -> `published` -> `closed` -> `archived`. Draft assignments are strictly hidden from students.
- **Storage Abstraction:** File binaries are stored securely via `IStorageService` on disk (or S3/GCS in prod); only metadata and relative paths are preserved in MongoDB.
- **Path Traversal Defense:** All attachment streams and file paths are sanitized and resolved strictly within the root upload path.
- **Late Rules & Deadlines:** Submissions after `dueDate` are rejected unless `allowLateSubmission` is active; valid grace submissions are flagged with `isLate: true`.
- **Evaluation Audit Trail:** Every grade modification records the previous marks, new marks, evaluator ID, timestamp, and mandatory change reason.

---

## 6. Dynamic Grading Engine & Examination Invariants

- **Non-Hardcoded Dynamic Grading:** Grading policies are stored dynamically in `GradingPolicy`. Grade calculations, grade points, percentages, and pass/fail statuses are evaluated against the active institutional policy record rather than hardcoded rules.
- **Internal Assessment (IA) Aggregation:** Configurable aggregation rules (`BEST_2_OF_3`, `AVERAGE_ALL`, `WEIGHTED`) to compute continuous internal evaluation components seamlessly.
- **Examination Timetable Conflict Prevention:** Compound unique index on `{ section: 1, examDate: 1, startTime: 1 }` guarantees zero overlapping exam slots per section at the database tier.
- **Results Confidentiality & RBAC:**
  - Teachers can enter and modify marks only for subjects and sections actively assigned to them.
  - Results are confidential until explicit publication (`isPublished = true`). Draft results are strictly hidden from students and parents.
  - Students can only view their own individual published results; parents are restricted to viewing only their linked children's published results.
- **Post-Publication Modification Audit Trail:** Any result adjustment made after publication mandates an explanatory `reason` (minimum 3 characters) and automatically logs an immutable audit trail (`previousMarks`, `newMarks`, `previousGrade`, `newGrade`, `changedBy`, `reason`, `timestamp`).

---

## 7. Student Progress Tracking & Risk Detection Invariants

- **Multi-Source Progress Aggregation:** Progress profiles combine attendance sessions, assignment submissions, internal assessments (IA1–IA3), and examination results dynamically without duplicating underlying operational records.
- **Explainable Academic Risk Classification:** Risk scores are calculated based on configurable institutional rules (`RiskRule`). Students are classified into `low`, `medium`, or `high` risk strictly with data-backed, explainable indicators (`LOW_ATTENDANCE`, `MISSING_ASSIGNMENTS`, `POOR_IA_PERFORMANCE`, `DECLINING_PERFORMANCE_TREND`, `MULTIPLE_FAILED_SUBJECTS`) detailing the exact numeric deficit.
- **Missing Marks Handling:** Assessments that were not scheduled or taken are never evaluated as zero percent; averages are calculated exclusively over evaluated items.
- **Historical Snapshot Preservation:** Academic progress recalculations preserve historical progress snapshots (`isSnapshot: true`) and never overwrite archived snapshots.
- **Strict Role-Scoped Analytics:**
  - Students can only view their own progress profiles, trends, and reports.
  - Parents can only access their linked children's progress.
  - Teachers are restricted to viewing analytics and insights for subjects and sections assigned to them.
  - Administrators have institution-level analytics and risk rule configuration authority.

---

## 8. Study Materials & Version Preservation Invariants

- **Storage Abstraction & Multi-Format Support:** File uploads are abstracted via `LocalStorageService` to handle documents, images, and videos (PDF, DOC/DOCX, PPT/PPTX, XLS/XLSX, TXT, ZIP, JPEG, PNG, MP4, WEBM) up to 50MB per file with path-traversal prevention.
- **Resource Visibility & Student Protection:**
  - `class`: Accessible exclusively to students in the designated section.
  - `subject`: Accessible to all students taking the designated subject across sections.
  - `institution`: Institution-wide access across departments.
  - Draft materials are strictly hidden from students.
  - Parents cannot access or download teacher study materials directly.
- **Immutable Historical Versioning:** Every update to a study material preserves the pre-update document in `StudyMaterialVersion`, including version number, prior file references, topics, and author metadata. Version archives are never mutated.
- **Atomic Engagement Counter Tracking:** Detail lookups atomically increment `viewCount`. Protected file downloads atomically increment `downloadCount`.
- **Search Optimization:** MongoDB compound text index on `{ title: 'text', description: 'text', topic: 'text', tags: 'text' }` paired with regex search fallback guarantees robust discovery.

---

## 9. Timetable & Scheduling Management Invariants

- **Compound Exclusivity & Non-Overlapping Timetables:** Compound indexes on `{ section: 1, effectiveFrom: 1, effectiveTo: 1, status: 1 }` guarantee zero conflicting active published timetables for the same section.
- **Pre-Save Multi-Vector Conflict Engine:** Pre-save conflict detection enforces 6 strict invariants:
  1. No double-booking teachers across concurrent lectures on overlapping dates.
  2. No overlapping lecture periods for the same section.
  3. No allocating a single classroom to multiple sections concurrently.
  4. Concurrent session limits for laboratories.
  5. Teacher availability enforcement against `status: 'On Leave'` and approved `TeacherLeave` intervals.
  6. Collision detection against scheduled examinations (`ExaminationSchedule`).
- **Audited Conflict Overrides:** Administrators can override detected conflicts only by supplying `allowOverride: true` and an explanatory reason (minimum 3 characters), which generates an immutable audit record in `TimetableConflictOverride`.
- **Non-Destructive Substitutions & Overrides:** Daily lecture substitutions, cancellations, and classroom changes are recorded in `TimetableChange`. Historical timetable entries remain intact.
- **Strict Role-Scoped Access:**
  - Students can only view their own section's published timetable (`draft` status strictly hidden).
  - Parents can only view section timetables for their linked children.
  - Teachers can access their personal daily and weekly schedules with calculated free periods and teaching hours.
  - Administrators maintain institution-wide analytics and approval authority.

---

## 10. Announcements, Audience Resolution & Real-Time Notification Invariants

- **Audience Resolution & Snapshot Preservation:** Recipients are resolved dynamically across role, department, class, section, subject, and specific user filters with strict `Set` deduplication. At publication time, `resolvedRecipientsSnapshot` is persisted so students changing sections later do not retroactively gain or lose access to historical announcements.
- **Strict Teacher Targeting & Parent-Child Scoping:**
  - Teachers can only target sections, classes, and subjects actively assigned to them (`TeacherAssignment` or `Section.classTeacher`).
  - Parents receive and view announcements only for their linked children (`Parent.students`).
  - Draft, scheduled, and expired announcements are strictly hidden from students and parents.
- **Event Deduplication & Multi-Channel Delivery:**
  - Compound unique partial indexes on `{ recipient: 1, eventKey: 1 }` and `{ recipient: 1, announcement: 1 }` prevent duplicate notifications for the same event and recipient.
  - External providers (`IEmailNotificationProvider`, `ISmsNotificationProvider`, `IPushNotificationProvider`) support exponential backoff retries and idempotency keys without blocking in-app notification creation or falsely claiming delivery when unconfigured.
- **Mandatory Alert Protection:** Users can configure channel preferences, timezones, and quiet hours (`NotificationPreference`), but cannot disable mandatory `emergency` or `security` notifications.
- **Socket.IO Real-Time Channel Isolation:** Socket connections require a valid JWT with an active session and are isolated to `user:<userId>` rooms. Cross-user channel subscriptions are rejected.

---

## 11. Doubt Management & Parent Communication Invariants

- **Automatic Teacher Identification & Scoping:** Student doubts automatically resolve the assigned teacher from active `TeacherAssignment` records for `(section, subject, academicYear)` with fallback to `Section.classTeacher`. Teachers can view and manage only doubts belonging to their assigned subjects and sections.
- **Internal Staff Note Isolation:** Doubt messages with `isInternalNote: true` are strictly restricted to authorized teachers and administrators; they are never returned to students or parents.
- **Configurable Reopening Rules:** Students can reopen `answered` or `resolved` doubts within the configurable institutional window (`reopenWindowDays`, default 7 days), incrementing `reopenCount` and notifying the assigned teacher.
- **Multi-Guardian & Multi-Child Relationship Auditing:** Parents can be linked to multiple children and students can have multiple verified guardians (`father`, `mother`, `guardian`, `other`). Every link and unlink operation is recorded in `Parent.relationshipHistory` and synchronized with `Student.parents`.
- **Parent Academic Portal Confidentiality:** Parents can access attendance, published assignments, published examination results, academic progress, and published timetables strictly for their linked children (`Parent.students`). Unpublished examination results and draft assignments are never exposed.
- **Parent-Teacher Communication & Meeting Requests:** Communication threads (`ParentCommunication`) verify both parent-student linkage and teacher-student authorization before creation, support meeting scheduling (`in_person`, `online`, `phone`), and trigger Phase 9 notifications on replies and meeting updates.

---

## 12. Leave, Substitution & Teacher Management Invariants

- **Dynamic Leave Policies & Non-Hardcoded Quotas:** Institutional leave rules, annual quotas, half-day/partial-day permissions, attachment requirements, and employment category eligibility are evaluated dynamically from active `LeavePolicy` records.
- **Overlapping Leave Prevention & Timetable Impact Resolution:** Submitting a leave request validates against overlapping `pending` or `approved` leaves (with half-day/partial-day slot awareness) and automatically populates `affectedTimetableEntries` across published timetables.
- **Self-Approval Prevention & Cascade Cancellation:** Users are strictly blocked from approving or reviewing their own leave requests. Cancelling a leave request automatically cancels linked `proposed`/`approved` substitutions and reverts associated `TimetableChange` overrides.
- **Multi-Vector Substitution Conflict Engine:** Substitute teacher assignment checks active status, approved leaves (including partial-day slots), regular `TimetableEntry` collisions, and concurrent `Substitution` double-bookings.
- **Non-Destructive Timetable Synchronization:** Approved substitutions synchronize with `TimetableChange` (`changeType: 'substitution'`) so date-specific timetable lookups reflect the substitute teacher without mutating the recurring `TimetableEntry`.

---

## 13. Development & Testing Commands

```bash
# Install dependencies
npm install

# Run development server with live reload
npm run dev

# Run TypeScript type check
npx tsc --noEmit

# Run full test suite with in-memory MongoDB
npm test

# Build for production
npm run build
npm start
```

---

## 14. Contribution Standards for Future Phases

1. **Test-Driven:** Before adding a feature, add automated integration test assertions in `tests/integration/`.
2. **Zero Breaking Changes:** Never break Phase 1, Phase 2, Phase 3, Phase 4, Phase 5, Phase 6, Phase 7, Phase 8, Phase 9, Phase 10, or Phase 11 endpoints.
3. **No UI / Frontend:** Keep this repository strictly focused on the backend REST API.

