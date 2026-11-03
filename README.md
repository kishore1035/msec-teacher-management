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

For detailed payloads, see [`docs/api-documentation.md`](docs/api-documentation.md).
