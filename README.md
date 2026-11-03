# MSEC Teacher Management Dashboard — Academic Backend

Enterprise modular backend for the Teacher Management System at educational institutions (MSEC Bengaluru). Engineered with Node.js, TypeScript strict mode, Express.js, MongoDB, Mongoose, and JWT RBAC.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose%208-green.svg)](https://mongoosejs.com/)
[![License: ISC](https://img.shields.io/badge/License-ISC-yellow.svg)](https://opensource.org/licenses/ISC)

---

## Architecture & Features

### Phase 1: Authentication & RBAC Infrastructure
- **Stateless Dual JWT Tokens:** 15-minute access tokens + 7-day revolving refresh tokens.
- **Session Tracking & Reuse Invalidation:** Multi-device session array with SHA-256 token hashing; detects and invalidates sessions upon token replay.
- **Password Security:** Salted bcrypt password hashing with 12 rounds.
- **RBAC:** Explicit hierarchical guards for `Super Admin`, `Admin`, `Teacher`, `Student`, and `Parent`.
- **Validation & Security:** Zod request schema validation, Helmet HTTP headers, CORS whitelisting, and Winston structured JSON logging.

### Phase 2: Academic Core & Class Management
- **Academic Years:** Calendar period creation, date validation, and single-current-term exclusivity.
- **Departments & Degree Classes:** Hierarchical branch structuring supporting B.E., M.Tech, MCA, and doctoral degrees.
- **Section Management:** Semester sections (A, B, C) with room allocations and class teacher references.
- **Course & Syllabus Directory:** Subject codes, credits, and Bloom's taxonomy syllabus modules.
- **Teacher Assignment Engine:** Mapping teachers to subject-section pairs with conflict and duplicate detection.
- **Teacher Personal Views:** Dedicated `/teachers/me/*` endpoints for assigned sections, subjects, and schedules.

### Phase 3: Attendance Management & Shortage Detection
- **Session Management:** Period-wise roll-call sessions with teacher assignment verification and duplicate protection.
- **Bulk Roll-Call:** One-click attendance marking for entire class rosters with student enrollment validation.
- **Audit History:** Full traceability for record corrections (previous status, new status, modifiedBy, reason).
- **Dynamic Policy Configuration:** Configurable institution/subject shortage thresholds, with customizable treatment for late arrivals (`Present`, `CountAsHalf`, `Absent`) and excused absences (`ExcludeFromTotal`, `Present`, `Absent`).
- **Shortage Detection:** Automated identification of students with $<75\%$ shortage and $75\%-85\%$ warning flags.
- **Comprehensive Reports:** Class-wise, subject-wise, student-wise, daily, monthly, and date-range attendance matrices.

### Phase 4: Assignment & Submission Management
- **Assignment Lifecycle:** Draft creation, section publication, closing, and archiving with teacher-assignment authorization guards.
- **Storage Abstraction & Secure Uploads:** Multer file validation (PDF, DOC/DOCX, PPT/PPTX, XLS/XLSX, TXT, ZIP, Images up to 25MB) with path-traversal prevention.
- **Student Submissions:** Rich text + file attachments, deadline enforcement, grace period late flagging (`isLate = true`).
- **Resubmission Management:** Controlled revision attempts (`maxResubmissions`) with versioned attempt tracking.
- **Evaluation & Grading Audit Trail:** Marks verification within bounds (`0 <= marksObtained <= totalMarks`), written feedback, return for revisions, and immutable re-evaluation audit logs.
- **Assignment Analytics Engine:** Aggregated overview counters (completion rate, average marks, late submissions), class-wise, subject-wise, and individual student progress metrics.
- **Protected File Streaming:** Secure attachment access at `/api/v1/attachments/:attachmentId` verifying role and enrollment boundaries.

### Phase 5: Assessments, Examinations & Results Management
- **Examination Management:** Full examination lifecycle (`draft`, `scheduled`, `ongoing`, `completed`, `published`, `cancelled`) across assessment types (`IA1`, `IA2`, `IA3`, `semester`, `practical`, `supplementary`, `other`).
- **Timetable Scheduling & Conflict Prevention:** Venue, invigilator, and time-slot scheduling backed by database-level compound unique indexes to guarantee zero overlapping exams for the same section.
- **Dynamic Grading Engine:** Zero hardcoded thresholds; institutional grade bands, grade points, percentages, and pass/fail criteria are loaded dynamically from active `GradingPolicy` records.
- **Marks Entry & Validation:** Bulk marks entry with bounds validation (`0 <= marksObtained <= maximumMarks`), absent/exempted status tracking, and teacher-assignment permission boundaries.
- **Continuous Internal Assessment (IA) Engine:** Dynamic calculation supporting `BEST_2_OF_3`, `AVERAGE_ALL`, and `WEIGHTED` evaluation models.
- **Results Confidentiality & RBAC:** Unpublished marks are strictly hidden from students and parents. Students can view only their own published results; parents are restricted to their linked children's published results.
- **Post-Publication Modification Audit Trail:** Post-publication marks alterations mandate an explanation reason and log an immutable audit trail (`previousMarks`, `newMarks`, `previousGrade`, `newGrade`, `changedBy`, `reason`, `timestamp`).
- **Examination Analytics Engine:** Class average, subject performance breakdown, highest/lowest marks, pass/fail percentages, and grade distributions.

### Phase 6: Student Progress Tracking & Performance Analytics
- **Student Progress Profile Engine:** Multi-source academic profiles integrating attendance, assignment submissions, IA marks, and examination results into dynamic overall percentages.
- **Trend Detection:** Chronological performance analysis tracking trajectory over time (`improving`, `declining`, `stable`, `irregular`).
- **Explainable At-Risk Student Detection:** Rule-driven risk scoring engine based on configurable institutional rules (`RiskRule`). Emits transparent indicators (`LOW_ATTENDANCE`, `MISSING_ASSIGNMENTS`, `POOR_IA_PERFORMANCE`, `DECLINING_PERFORMANCE_TREND`, `MULTIPLE_FAILED_SUBJECTS`) with severity levels and score contributions.
- **Class Performance Analytics:** Class overview, subject averages, grade distributions, top performers, students requiring attention, attendance rates, and assignment completion breakdowns.
- **Subject Analytics & Difficulty Indicator:** Average/highest/lowest marks, pass/fail rates, section comparisons, and data-backed difficulty indicators (with minimum sample size safeguards).
- **Teacher Performance Insights:** Academic overview and at-risk student monitoring scoped strictly to assigned subjects and sections.
- **Structured Progress Reports & Export Engine:** Comprehensive student and class progress reports with support for JSON representation, Excel/CSV exports (`text/csv` / `application/vnd.ms-excel`), and formatted summaries. Historical progress snapshots are preserved without data corruption.

### Phase 7: Study Materials & Resource Management
- **Study Material Lifecycle:** Draft creation, publication, closing, and archiving (`draft`, `published`, `archived`) with strict teacher-assignment authorization guards.
- **Multi-Attachment File Engine:** Upload and stream PDF, Office documents (DOC, DOCX, PPT, PPTX, XLS, XLSX), plain text, ZIP archives, images, and video formats (MP4, WEBM) up to 50MB per file with path-traversal prevention.
- **Resource Visibility & Student Access:** Granular visibility controls (`class`, `subject`, `institution`). Students can access published materials matching their section or enrolled subjects via `/api/v1/study-materials/my-resources`. Draft materials remain strictly hidden from students. Parents cannot access teacher study materials directly.
- **Full-Text & Tag Search:** Search resources using MongoDB text indexes and regex fallback across `title`, `description`, `topic`, and `tags`.
- **Subject-Wise Resource Directory:** Filter and paginate materials by subject, unit, semester, academic year, and material type.
- **Version History & Archive Tracking:** Automatic version preservation in `StudyMaterialVersion` on updates, storing previous document states, version number, changelog, and editor references.
- **Engagement Metrics & Analytics Engine:** Atomic incrementation of `viewCount` on detail retrieval and `downloadCount` on attachment download. Overview statistics, subject distribution breakdown, teacher upload contributions, and top-downloaded resources analytics.

### Phase 8: Timetable & Scheduling Management
- **Timetable Lifecycle & Exclusivity:** Full timetable lifecycle (`draft`, `published`, `archived`) with effective date validity ranges (`effectiveFrom`, `effectiveTo`). Conflict prevention index guarantees zero overlapping published timetables for the same section.
- **Period Entry Management:** Section lectures, multi-period practicals, tutorial slots, co-teachers (`additionalTeachers`), room and laboratory assignments.
- **Explainable Conflict Detection Engine:** Real-time pre-flight conflict detection identifying:
  1. *Teacher Conflicts:* Prevents overlapping lecture assignments for lead and co-teachers.
  2. *Section Conflicts:* Prevents double-booking class rosters for simultaneous lectures.
  3. *Classroom Conflicts:* Prevents allocating a single room to multiple sections simultaneously.
  4. *Laboratory Conflicts:* Protects dedicated lab rooms from overlapping simultaneous bookings.
  5. *Teacher Availability & Leave:* Validates active `status` and blocks scheduling during approved `TeacherLeave` intervals.
  6. *Examination Timetable Conflicts:* Prevents regular lecture scheduling that clashes with scheduled `ExaminationSchedule` slots.
- **Audited Administrator Conflict Overrides:** Permits authorized administrators (`Super Admin`, `Admin`) to override scheduling conflicts with a mandatory explanation reason, recording an immutable audit log (`TimetableConflictOverride`).
- **Role-Scoped Timetable Views:**
  - *Teachers:* Dedicated daily (`/teachers/me/today`) and weekly (`/teachers/me/weekly`) schedules with calculated free periods and workload metrics (total teaching hours and subject-wise teaching hours).
  - *Students:* Enrolled section schedule (`/students/me` and `/students/me/today`). Draft timetables remain strictly hidden.
  - *Parents:* Securely restricted to viewing only their linked children's published section timetables.
- **Dynamic Substitutions & Rescheduling:** Temporary overrides (`substitution`, `rescheduling`, `cancellation`, `classroom_change`) for specific dates with conflict validation on substitute teachers and rooms without mutating original timetable records.
- **Timetable Analytics Engine:** Aggregates weekly teacher workload summaries, classroom/laboratory utilization percentages, free room availability queries, and subject distribution counts.

### Phase 9: Announcements & Notifications Management
- **Announcement Lifecycle & History:** Full lifecycle (`draft`, `scheduled`, `published`, `archived`) across announcement types (`general`, `academic`, `examination`, `attendance`, `assignment`, `timetable`, `event`, `emergency`, `other`) and priorities (`low`, `normal`, `high`, `urgent`) with file attachments, scheduled publishing (`publishAt`), automatic expiry (`expiresAt`), `editHistory`, and `auditLog`.
- **Audience Targeting Engine:** Resolves recipients across roles, departments, classes, sections, subjects, and specific users with automatic deduplication, teacher authorization enforcement, parent-child linkage verification, and reproducible `resolvedRecipientsSnapshot` storage at publication time.
- **Event & Domain Notification Management:** Generates deduplicated notifications for published announcements, assignment deadlines, examination schedules & results, attendance shortage warnings, timetable changes, teacher leave & substitutions, and direct administrative notices.
- **Multi-Channel Delivery & Retry Engine:** Provider abstractions for In-App, Email, SMS, and Push notifications configured via environment variables, featuring exponential backoff retry logic, idempotency protection against duplicate sends, and fault isolation so external provider failures never block in-app notifications.
- **Notification Preferences & Mandatory Alerts:** Per-user channel toggles, category-level preferences, IANA timezone validation, and 24-hour quiet hours while strictly enforcing mandatory `emergency` and `security` alerts.
- **Read Receipts & Readership Analytics:** Mark single/all notifications as read, accurate unread counter, paginated notification history with category/date filters, and announcement readership statistics (`readCount`, `unreadCount`, `readPercentage`, delivery status breakdown).
- **Real-Time Socket.IO Delivery:** JWT-authenticated Socket.IO connections isolated per user (`user:<userId>`) with reconnect state synchronization and REST fallback.

### Phase 10: Doubt Management & Parent Communication
- **Student Doubt Management:** Subject-scoped doubt creation with file attachments, automatic teacher assignment via active `TeacherAssignment` records, manual reassignment by authorized staff, and full assignment/status audit trails.
- **Doubt Conversation System & Internal Staff Notes:** Threaded student-teacher Q&A (`DoubtMessage`), teacher explanations with resource attachments, status transitions (`answered`, `resolved`, `closed`), configurable student doubt reopening within institutional windows, and staff-only internal notes (`isInternalNote: true`) strictly hidden from students and parents.
- **Doubt Analytics Engine:** Administrator analytics (`/doubts/analytics/overview`, `/subjects`, `/teachers`) tracking total/open/pending/answered/resolved/overdue doubts, average first-response time, average resolution time, recurring academic topics, and teacher workload metrics without unsupported rankings.
- **Parent & Guardian Management:** Multi-guardian support per student and multi-child support per parent (`father`, `mother`, `guardian`, `other`) with verification status and immutable `relationshipHistory` audit logs on link/unlink operations.
- **Parent Academic Portal:** Dedicated `/parents/me/children/*` endpoints allowing verified parents to view linked children's academic overview, published announcements, attendance summaries & shortage warnings, published assignments & submissions, published examination results (strictly hiding unpublished marks), academic progress profiles, and published section timetables.
- **Parent-Teacher Communication & Meeting Requests:** Structured communication threads (`ParentCommunication`, `ParentCommunicationMessage`) between parents and assigned teachers with attachment support, meeting requests (`in_person`, `online`, `phone`), and automatic Phase 9 notifications.

### Phase 11: Leave, Substitution & Teacher Management
- **Teacher Profile & Directory Management:** Extends the existing `Teacher` profile with qualifications array, specializations, joining date, employment category (`regular`, `contract`, `visiting`, `adjunct`, `probationary`), active status toggling, and dedicated endpoints for assigned classes, date-aware timetables, leave history, substitution history, and workload summaries.
- **Dynamic Leave Policy & Leave Request Engine:** Configurable institutional leave policies (`LeavePolicy`) defining leave types, annual quotas, half-day/partial-day rules, attachment requirements, and approval workflows without hardcoded quotas. Supports full-day and half-day/partial-day leave requests (`LeaveRequest` / `TeacherLeave`), overlapping leave detection, automatic identification of affected timetable entries, self-approval prevention, and cascade cancellation.
- **Teacher Substitution Workflow & Suggestion Engine:** `Substitution` lifecycle (`proposed`, `approved`, `rejected`, `completed`, `cancelled`) with multi-vector conflict detection (preventing class overlaps, leave conflicts, and double-booking) and ranked substitute teacher suggestions based on subject eligibility, department match, and weekly teaching load.
- **Non-Destructive Timetable & Notification Integration:** Approved substitutions synchronize automatically with `TimetableChange` so date-specific timetable queries reflect the substitute teacher while preserving recurring `TimetableEntry` records. Leave and substitution events dispatch deduplicated Phase 9 notifications.
- **Teacher Workload & Institutional Summary Analytics:** Endpoints for teacher-wise workload, department-wise workload distribution, leave usage summaries, and substitution analytics.

---

## Getting Started

### Prerequisites
- Node.js v20.x or higher
- MongoDB v6.x or higher (optional for tests; tests use `mongodb-memory-server`)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/kishore1035/msec-teacher-management.git
cd msec-teacher-management
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

4. Run development server:
```bash
npm run dev
```

5. Run test suite:
```bash
npm test
```

6. Build for production:
```bash
npm run build
npm start
```

---

## API Summary (Base: `/api/v1`)

| Module | Route | Access |
| :--- | :--- | :--- |
| **Auth** | `POST /auth/login` | Public |
| **Auth** | `POST /auth/refresh-token` | Public |
| **Auth** | `POST /auth/logout` | Authenticated |
| **Auth** | `GET /auth/me` | Authenticated |
| **Auth** | `PUT /auth/change-password` | Authenticated |
| **Academics** | `GET, POST /academics/years` | Admin / Authenticated |
| **Academics** | `PUT /academics/years/:id/set-current` | Admin |
| **Departments** | `GET, POST, PUT /departments` | Admin / Authenticated |
| **Classes** | `GET, POST, PUT /classes` | Admin / Authenticated |
| **Sections** | `GET, POST, PUT /sections` | Admin / Authenticated |
| **Subjects** | `GET, POST, PUT /subjects` | Admin / Authenticated |
| **Teacher Assignments** | `GET, POST, PUT, DELETE /teacher-assignments` | Admin / Authenticated |
| **Teacher Management** | `GET, POST /teachers` | Admin (POST) / Admin & Teacher (GET) |
| **Teacher Management** | `GET /teachers/me` | Teacher |
| **Teacher Management** | `GET, PATCH /teachers/:id` | Admin / Self Teacher |
| **Teacher Management** | `GET /teachers/:id/classes` | Admin / Self Teacher |
| **Teacher Management** | `GET /teachers/:id/timetable` | Admin / Self Teacher |
| **Teacher Management** | `GET /teachers/:id/workload` | Admin / Self Teacher |
| **Teacher Management** | `GET /teachers/:id/leave-history` | Admin / Self Teacher |
| **Teacher Management** | `GET /teachers/:id/substitutions` | Admin / Self Teacher |
| **Teacher Me** | `GET /teachers/me/classes` | Teacher |
| **Teacher Me** | `GET /teachers/me/subjects` | Teacher |
| **Teacher Me** | `GET /teachers/me/assignments` | Teacher |
| **Attendance Policy** | `GET, POST, PUT /attendance/policy` | Admin / Authenticated |
| **Attendance Sessions** | `GET, POST, PATCH /attendance/sessions` | Teacher / Admin |
| **Attendance Sessions** | `PATCH /attendance/sessions/:id/cancel` | Teacher / Admin |
| **Attendance Records** | `POST /attendance/sessions/:id/records` | Teacher / Admin (Bulk Roll-Call) |
| **Attendance Records** | `PATCH /attendance/records/:id` | Teacher / Admin (Correction with Audit) |
| **Attendance Reports** | `GET /attendance/students/:id` | Student (Self) / Parent (Linked) / Teacher / Admin |
| **Attendance Reports** | `GET /attendance/shortages` | Teacher / Admin |
| **Attendance Reports** | `GET /attendance/summary` | Teacher / Admin |
| **Examinations** | `GET, POST /examinations` | Admin / Authenticated |
| **Examinations** | `GET, PUT, DELETE /examinations/:id` | Admin / Authenticated |
| **Examinations** | `PATCH /examinations/:id/status` | Admin |
| **Examinations** | `POST /examinations/:id/schedule` | Admin |
| **Examinations** | `POST /examinations/:id/marks` | Teacher / Admin (Bulk Marks Entry) |
| **Examinations** | `POST /examinations/:id/publish` | Admin (Publish Results) |
| **Examination Schedules** | `GET /examination-schedules` | Authenticated |
| **Examination Schedules** | `GET /examination-schedules/section/:sectionId` | Authenticated |
| **Examination Schedules** | `GET /examination-schedules/teacher` | Teacher |
| **Internal Assessments** | `GET /internal-assessments/section/:sectionId/subject/:subjectId` | Teacher / Admin |
| **Internal Assessments** | `GET /internal-assessments/student/:studentId` | Authenticated (RBAC Scoped) |
| **Results** | `GET /results/examination/:examinationId` | Teacher / Admin |
| **Results** | `GET /results/student/:studentId` | Authenticated (Self / Linked Child / Staff) |
| **Results** | `GET /results/analytics/examination/:examinationId` | Teacher / Admin |
| **Results** | `PATCH /results/:id/correct` | Teacher / Admin (Correction with Audit) |
| **Student Progress** | `GET /progress/students/:studentId` | Authenticated (Self / Linked Child / Assigned Staff) |
| **Student Progress** | `GET /progress/students/:studentId/subjects` | Authenticated (Self / Linked Child / Staff) |
| **Student Progress** | `GET /progress/students/:studentId/history` | Authenticated (Self / Linked Child / Staff) |
| **Student Progress** | `GET /progress/students/:studentId/trends` | Authenticated (Self / Linked Child / Staff) |
| **Risk Detection** | `GET /progress/at-risk` | Teacher / Admin |
| **Risk Detection** | `GET /progress/at-risk/:studentId` | Authenticated (Scoped) |
| **Risk Rules** | `GET, POST /progress/risk-rules` | Admin (POST) / Staff (GET) |
| **Class Analytics** | `GET /analytics/class/overview` | Teacher / Admin |
| **Class Analytics** | `GET /analytics/class/performance` | Teacher / Admin |
| **Class Analytics** | `GET /analytics/class/attendance` | Teacher / Admin |
| **Class Analytics** | `GET /analytics/class/assignments` | Teacher / Admin |
| **Subject Analytics** | `GET /analytics/subject/overview` | Teacher / Admin |
| **Subject Analytics** | `GET /analytics/subject/performance` | Teacher / Admin |
| **Subject Analytics** | `GET /analytics/subject/comparison` | Teacher / Admin |
| **Teacher Insights** | `GET /analytics/teacher/overview` | Teacher / Admin |
| **Teacher Insights** | `GET /analytics/teacher/students-at-risk` | Teacher / Admin |
| **Workload Analytics** | `GET /analytics/teacher-workload` | Teacher (Self) / Admin |
| **Workload Analytics** | `GET /analytics/department-workload` | Admin |
| **Workload Analytics** | `GET /analytics/leave-summary` | Admin |
| **Workload Analytics** | `GET /analytics/substitution-summary` | Admin |
| **Progress Reports** | `GET /reports/students/:studentId/progress` | Authenticated (Self / Linked Child / Staff) |
| **Progress Reports** | `POST /reports/students/:studentId/generate` | Teacher / Admin (Archived Snapshot) |
| **Progress Reports** | `GET /reports/class/:sectionId` | Teacher / Admin |
| **Study Materials** | `POST /study-materials` | Teacher / Admin (Upload multi-files & create) |
| **Study Materials** | `GET /study-materials` | Authenticated (Filtered list) |
| **Study Materials** | `GET /study-materials/my-resources` | Student (Enrolled section/subject resources) |
| **Study Materials** | `GET /study-materials/search` | Authenticated (Full-text & tag search) |
| **Study Materials** | `GET /study-materials/subjects/:subjectId` | Authenticated (Subject directory) |
| **Study Materials** | `GET /study-materials/analytics/overview` | Teacher / Admin |
| **Study Materials** | `GET /study-materials/analytics/subjects` | Teacher / Admin |
| **Study Materials** | `GET /study-materials/analytics/teachers` | Admin |
| **Study Materials** | `GET /study-materials/analytics/popular` | Authenticated |
| **Study Materials** | `GET /study-materials/attachments/:attachmentId/download` | Authenticated (Authorized Student/Staff streaming) |
| **Study Materials** | `GET /study-materials/:id` | Authenticated (Increments view count) |
| **Study Materials** | `PUT /study-materials/:id` | Teacher / Admin (Updates & archives version) |
| **Study Materials** | `DELETE /study-materials/:id` | Teacher / Admin |
| **Study Materials** | `PATCH /study-materials/:id/publish` | Teacher / Admin |
| **Study Materials** | `PATCH /study-materials/:id/archive` | Teacher / Admin |
| **Study Materials** | `GET /study-materials/:id/versions` | Teacher / Admin |
| **Timetables** | `POST, GET /timetables` | Admin (POST) / Authenticated (GET) |
| **Timetables** | `GET, PUT, DELETE /timetables/:id` | Admin (PUT/DELETE) / Authenticated (GET) |
| **Timetables** | `PATCH /timetables/:id/publish` | Admin (Publish & activate timetable) |
| **Timetables** | `PATCH /timetables/:id/archive` | Admin (Archive timetable) |
| **Timetable Entries** | `POST, GET /timetables/:id/entries` | Admin (POST) / Authenticated (GET) |
| **Timetable Entries** | `PUT, DELETE /timetable-entries/:entryId` | Admin |
| **Conflict Engine** | `POST /timetables/check-conflicts` | Staff / Admin (Pre-flight conflict check) |
| **Conflict Engine** | `GET /timetables/conflicts` | Admin (Audit trail) |
| **Conflict Engine** | `POST /timetables/conflicts/:id/override` | Admin (Override with reason) |
| **Teacher Timetable** | `GET /timetables/teachers/me` | Teacher (Weekly schedule & teaching hours) |
| **Teacher Timetable** | `GET /timetables/teachers/me/today` | Teacher (Today's lectures & free periods) |
| **Teacher Timetable** | `GET /timetables/teachers/me/weekly` | Teacher (Weekly matrix) |
| **Student Timetable** | `GET /timetables/students/me` | Student (Enrolled section schedule) |
| **Student Timetable** | `GET /timetables/students/me/today` | Student (Today's schedule) |
| **Section Timetable** | `GET /timetables/sections/:sectionId` | Authenticated (RBAC scoped) |
| **Timetable Changes** | `POST, GET /timetable-changes` | Teacher / Admin (Substitution/Reschedule) |
| **Timetable Changes** | `PUT /timetable-changes/:id/approve` | Admin (Approve substitution) |
| **Timetable Changes** | `PUT /timetable-changes/:id/reject` | Admin (Reject substitution) |
| **Timetable Analytics**| `GET /timetables/analytics/teacher-workload` | Admin (Teacher weekly hours) |
| **Timetable Analytics**| `GET /timetables/analytics/classroom-utilization`| Admin (Room usage & free room query) |
| **Timetable Analytics**| `GET /timetables/analytics/subject-distribution` | Admin (Subject lecture count) |
| **Timetable Analytics**| `GET /timetables/analytics/conflicts` | Admin (Conflict report) |
| **Announcements** | `POST, GET /announcements` | Admin / Teacher (POST) / Authenticated (GET) |
| **Announcements** | `GET, PUT, DELETE /announcements/:id` | Authenticated (GET) / Creator or Admin (PUT/DELETE) |
| **Announcements** | `PATCH /announcements/:id/publish` | Creator Teacher / Admin |
| **Announcements** | `PATCH /announcements/:id/archive` | Creator Teacher / Admin |
| **Announcement Analytics** | `GET /announcements/:id/analytics` | Creator Teacher / Admin |
| **Announcement Analytics** | `GET /announcements/analytics/overview` | Teacher / Admin |
| **Notifications** | `GET /notifications` | Authenticated (Recipient only) |
| **Notifications** | `GET /notifications/unread-count` | Authenticated |
| **Notifications** | `GET /notifications/history` | Authenticated (Category & date filters) |
| **Notifications** | `GET /notifications/:id` | Authenticated (Recipient only) |
| **Notifications** | `PATCH /notifications/:id/read` | Authenticated (Recipient only) |
| **Notifications** | `PATCH /notifications/read-all` | Authenticated |
| **Notification Preferences** | `GET, PUT /notifications/preferences` | Authenticated |
| **Notification Devices** | `POST /notifications/devices` | Authenticated |
| **Notification Delivery** | `GET /notifications/delivery-status` | Authenticated / Admin |
| **Notification Events** | `POST /notifications/events` | Teacher / Admin |
| **Student Doubts** | `POST, GET /doubts` | Student (Self) / Assigned Teacher / Admin |
| **Student Doubts** | `GET, PUT /doubts/:id` | Student (Own) / Assigned Teacher / Admin |
| **Student Doubts** | `PATCH /doubts/:id/assign` | Authorized Teacher / Admin |
| **Student Doubts** | `PATCH /doubts/:id/status` | Authorized Teacher / Admin |
| **Student Doubts** | `PATCH /doubts/:id/reopen` | Student (Own within window) / Admin |
| **Doubt Conversation** | `POST, GET /doubts/:id/messages` | Student (Own, non-internal) / Assigned Teacher / Admin |
| **Doubt Analytics** | `GET /doubts/analytics/overview` | Admin |
| **Doubt Analytics** | `GET /doubts/analytics/subjects` | Admin |
| **Doubt Analytics** | `GET /doubts/analytics/teachers` | Admin |
| **Parent Management** | `POST, GET /parents` | Admin (POST) / Admin & Teacher (GET) |
| **Parent Management** | `GET, PUT /parents/:id` | Self Parent / Teacher / Admin (GET), Admin (PUT) |
| **Parent Linking** | `POST /parents/:id/link-student` | Admin |
| **Parent Linking** | `DELETE /parents/:id/unlink-student/:studentId` | Admin |
| **Parent Portal** | `GET /parents/me/children` | Parent (Linked children only) |
| **Parent Portal** | `GET /parents/me/children/:studentId/overview` | Parent (Linked child) / Admin |
| **Parent Portal** | `GET /parents/me/children/:studentId/attendance` | Parent (Linked child) / Admin |
| **Parent Portal** | `GET /parents/me/children/:studentId/assignments` | Parent (Linked child) / Admin |
| **Parent Portal** | `GET /parents/me/children/:studentId/results` | Parent (Linked child, published only) / Admin |
| **Parent Portal** | `GET /parents/me/children/:studentId/progress` | Parent (Linked child) / Admin |
| **Parent Portal** | `GET /parents/me/children/:studentId/timetable` | Parent (Linked child) / Admin |
| **Parent Communication** | `POST, GET /parent-communications` | Parent (Linked child) / Assigned Teacher / Admin |
| **Parent Communication** | `POST /parent-communications/meeting-requests` | Parent / Assigned Teacher / Admin |
| **Parent Communication** | `GET /parent-communications/:id` | Participant Parent / Teacher / Admin |
| **Parent Communication** | `POST, GET /parent-communications/:id/messages` | Participant Parent / Teacher / Admin |
| **Parent Communication** | `PATCH /parent-communications/:id/close` | Participant Parent / Teacher / Admin |
| **Leave Policies** | `GET, POST /leaves/policies` | Admin (POST) / Admin & Teacher (GET) |
| **Leave Policies** | `PATCH /leaves/policies/:id` | Admin |
| **Leave Balances** | `GET /leaves/balances` | Teacher (Self) / Admin |
| **Leave Requests** | `POST, GET /leave-requests` | Teacher (Self) / Admin |
| **Leave Requests** | `GET /leave-requests/:id` | Teacher (Self) / Admin |
| **Leave Requests** | `PATCH /leave-requests/:id/approve` | Admin |
| **Leave Requests** | `PATCH /leave-requests/:id/reject` | Admin |
| **Leave Requests** | `PATCH /leave-requests/:id/cancel` | Teacher (Self) / Admin |
| **Substitutions** | `POST, GET /substitutions` | Teacher / Admin |
| **Substitutions** | `GET /substitutions/available-teachers` | Teacher / Admin |
| **Substitutions** | `GET /substitutions/conflicts` | Teacher / Admin |
| **Substitutions** | `GET /substitutions/:id` | Involved Teacher / Admin |
| **Substitutions** | `PATCH /substitutions/:id/approve` | Admin |
| **Substitutions** | `PATCH /substitutions/:id/reject` | Admin |
| **Substitutions** | `PATCH /substitutions/:id/complete` | Substitute Teacher / Admin |
| **Substitutions** | `PATCH /substitutions/:id/cancel` | Absent Teacher / Admin |
| **OpenAPI / Swagger** | `GET /docs`, `GET /openapi.json` | Public |

For detailed payloads, see [`docs/api-documentation.md`](docs/api-documentation.md).


