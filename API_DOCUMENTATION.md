# Complete API Documentation & Endpoint Inventory (`API_DOCUMENTATION.md`)

All versioned REST endpoints are mounted under `/api/v1`.
Interactive OpenAPI 3.0.3 documentation is served at `GET /api/v1/docs` and raw JSON at `GET /api/v1/openapi.json`.

---

## 1. Standard Response Envelope

### Success Response
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Operation successful",
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "totalPages": 3
  }
}
```

### Error Response
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    { "field": "email", "message": "Invalid email address" }
  ]
}
```

---

## 2. System Health & Observability Endpoints

| Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | Public | Service metadata JSON (or interactive console if `Accept: text/html`) |
| `GET` | `/health` & `/api/v1/health` | Public | Overall service health summary |
| `GET` | `/health/live` & `/api/v1/health/live` | Public | Liveness probe (process uptime & memory RSS/heap) |
| `GET` | `/health/ready` & `/api/v1/health/ready` | Public | Readiness probe (`200` if MongoDB + Storage + AI ready, `503` otherwise) |
| `GET` | `/api/v1/openapi.json` | Public | OpenAPI 3.0.3 JSON specification |
| `GET` | `/api/v1/docs` | Public | Swagger UI interactive explorer |

---

## 3. Phase 1 — Authentication & Session Management (`/api/v1/auth`)

| Method | Path | Roles | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register` | Admin / Super Admin | Register a new institutional user account |
| `POST` | `/api/v1/auth/login` | Public (Rate-Limited) | Authenticate user and issue `accessToken` + `refreshToken` |
| `POST` | `/api/v1/auth/refresh` | Public | Rotate refresh token and detect token reuse attacks |
| `POST` | `/api/v1/auth/logout` | Authenticated | Invalidate current device session |
| `POST` | `/api/v1/auth/logout-all` | Authenticated | Revoke all active device sessions |
| `GET` | `/api/v1/auth/sessions` | Authenticated | List active sessions for the current user |
| `GET` | `/api/v1/auth/me` | Authenticated | Retrieve current authenticated user profile |
| `PATCH` | `/api/v1/auth/change-password` | Authenticated | Change password and invalidate other sessions |

---

## 4. Phase 2 — Academic Core & Classes

| Method | Path | Roles | Description |
| :--- | :--- | :--- | :--- |
| `POST / GET` | `/api/v1/academics/years` | Admin (POST), Auth (GET) | Create / list academic years |
| `GET` | `/api/v1/academics/years/current` | Authenticated | Get active academic year |
| `PATCH` | `/api/v1/academics/years/:id/activate` | Admin | Set academic year as active |
| `POST / GET` | `/api/v1/departments` | Admin (POST), Auth (GET) | Create / list academic departments |
| `GET / PUT / DELETE` | `/api/v1/departments/:id` | Admin (PUT/DEL), Auth (GET) | Manage department by ID |
| `POST / GET` | `/api/v1/classes` | Admin (POST), Auth (GET) | Create / list degree classes |
| `POST / GET` | `/api/v1/sections` | Admin (POST), Auth (GET) | Create / list class sections |
| `POST / GET` | `/api/v1/subjects` | Admin (POST), Auth (GET) | Create / list subjects and syllabus modules |
| `POST / GET` | `/api/v1/teacher-assignments` | Admin (POST), Auth (GET) | Assign teacher to subject & section |

---

## 5. Phase 3 — Attendance Management & Shortage Detection (`/api/v1/attendance`)

| Method | Path | Roles | Description |
| :--- | :--- | :--- | :--- |
| `GET / POST / PUT` | `/api/v1/attendance/policy` | Admin (POST/PUT), Auth (GET) | Manage configurable `AttendancePolicy` |
| `POST / GET` | `/api/v1/attendance/sessions` | Teacher / Admin | Create attendance session & mark bulk records |
| `GET` | `/api/v1/attendance/sessions/:id` | Teacher / Admin | Get session details and student attendance records |
| `PATCH` | `/api/v1/attendance/records/:id` | Teacher / Admin | Correct attendance status with mandatory audit trail |
| `GET` | `/api/v1/attendance/students/:studentId/summary` | Scoped Auth | Get dynamic attendance percentage & shortage status |
| `GET` | `/api/v1/attendance/shortages` | Teacher / Admin | Detect shortage & warning students across section/subject |

---

## 6. Phase 4 — Assignments & Submissions (`/api/v1/assignments`, `/submissions`, `/attachments`)

| Method | Path | Roles | Description |
| :--- | :--- | :--- | :--- |
| `POST / GET` | `/api/v1/assignments` | Teacher / Admin (POST), Scoped (GET) | Create & list assignments (drafts hidden from students) |
| `GET / PUT / DELETE` | `/api/v1/assignments/:id` | Scoped Auth | View, update, or archive assignment |
| `PATCH` | `/api/v1/assignments/:id/status` | Teacher / Admin | Transition status (`draft` -> `published` -> `closed` -> `archived`) |
| `POST` | `/api/v1/assignments/:id/submit` | Student | Submit or resubmit assignment with attachments |
| `GET` | `/api/v1/assignments/:id/submissions` | Teacher / Admin | List student submissions for an assignment |
| `POST` | `/api/v1/submissions/:id/evaluate` | Teacher / Admin | Evaluate submission with marks, feedback & audit history |
| `GET` | `/api/v1/attachments/:id/download` | Scoped Auth | Stream protected attachment with path-traversal protection |

---

## 7. Phase 5 — Examinations, Schedules & Results (`/api/v1/examinations`, `/examination-results`, `/results`)

| Method | Path | Roles | Description |
| :--- | :--- | :--- | :--- |
| `POST / GET` | `/api/v1/examinations/grading-policies` | Admin (POST), Auth (GET) | Configure dynamic `GradingPolicy` |
| `POST / GET` | `/api/v1/examinations` | Admin / Teacher (POST), Auth (GET) | Create / list examinations (`IA1`, `IA2`, `IA3`, `semester`) |
| `POST / GET` | `/api/v1/examination-schedules` | Admin / Teacher (POST), Auth (GET) | Schedule exam slots with conflict prevention |
| `POST` | `/api/v1/examination-results/bulk` | Teacher / Admin | Enter or update student marks in bulk |
| `PATCH` | `/api/v1/examinations/:id/publish-results` | Admin | Publish verified examination results |
| `GET` | `/api/v1/results/students/:studentId` | Scoped Auth | Get student results (unpublished strictly hidden from Student/Parent) |
| `GET` | `/api/v1/internal-assessments/summary` | Scoped Auth | Compute aggregated IA marks (`BEST_2_OF_3`, `AVERAGE_ALL`, `WEIGHTED`) |

---

## 8. Phase 6 — Student Progress & Performance Analytics (`/api/v1/progress`)

| Method | Path | Roles | Description |
| :--- | :--- | :--- | :--- |
| `POST / GET` | `/api/v1/progress/risk-rules` | Admin | Configure institutional at-risk classification rules |
| `POST` | `/api/v1/progress/calculate/:studentId` | Teacher / Admin | Recalculate student academic progress & risk indicators |
| `GET` | `/api/v1/progress/students/:studentId` | Scoped Auth | Get student progress profile & historical snapshots |
| `GET` | `/api/v1/progress/at-risk` | Teacher / Admin | List at-risk students (`low`, `medium`, `high`) with explainable deficits |

---

## 9. Phase 7 — Study Materials & Versioning (`/api/v1/study-materials`)

| Method | Path | Roles | Description |
| :--- | :--- | :--- | :--- |
| `POST / GET` | `/api/v1/study-materials` | Teacher / Admin (POST), Scoped (GET) | Upload & search study materials (`class`, `subject`, `institution`) |
| `GET / PUT / DELETE` | `/api/v1/study-materials/:id` | Scoped Auth | View details (increments `viewCount`), update (saves `StudyMaterialVersion`), or archive |
| `GET` | `/api/v1/study-materials/:id/versions` | Teacher / Admin | View immutable version history |
| `GET` | `/api/v1/study-materials/:id/attachments/:attachmentId/download` | Teacher / Admin / Student | Download material attachment (increments `downloadCount`; Parents blocked) |

---

## 10. Phase 8 — Timetable & Scheduling Management (`/api/v1/timetables`, `/timetable-entries`, `/timetable-changes`)

| Method | Path | Roles | Description |
| :--- | :--- | :--- | :--- |
| `POST / GET` | `/api/v1/timetables` | Admin (POST), Scoped (GET) | Create / list section timetables |
| `PATCH` | `/api/v1/timetables/:id/publish` | Admin | Publish timetable |
| `POST / GET` | `/api/v1/timetable-entries` | Admin (POST), Scoped (GET) | Add timetable slot with 6-vector conflict detection |
| `POST / GET` | `/api/v1/timetable-changes` | Admin / Teacher | Record daily substitution, cancellation, or room change |

---

## 11. Phase 9 — Announcements & Notifications (`/api/v1/announcements`, `/notifications`)

| Method | Path | Roles | Description |
| :--- | :--- | :--- | :--- |
| `POST / GET` | `/api/v1/announcements` | Teacher / Admin (POST), Scoped (GET) | Create & list targeted announcements |
| `PATCH` | `/api/v1/announcements/:id/publish` | Teacher / Admin | Publish announcement & freeze `resolvedRecipientsSnapshot` |
| `GET` | `/api/v1/announcements/:id/analytics` | Teacher / Admin | Readership and delivery analytics |
| `GET` | `/api/v1/notifications` | Authenticated | List user notifications |
| `GET` | `/api/v1/notifications/unread-count` | Authenticated | Get unread notification count |
| `PATCH` | `/api/v1/notifications/:id/read` | Authenticated | Mark notification as read |
| `PATCH` | `/api/v1/notifications/read-all` | Authenticated | Mark all unread notifications as read |
| `GET / PUT` | `/api/v1/notifications/preferences` | Authenticated | Manage notification channels & quiet hours (mandatory alerts protected) |

---

## 12. Phase 10 — Doubt Management & Parent Communication (`/api/v1/doubts`, `/parents`, `/parent-communications`)

| Method | Path | Roles | Description |
| :--- | :--- | :--- | :--- |
| `POST / GET` | `/api/v1/doubts` | Student (POST), Scoped (GET) | Submit doubt (auto-assigns teacher) & list scoped doubts |
| `PATCH` | `/api/v1/doubts/:id/assign` | Teacher / Admin | Assign or reassign doubt |
| `PATCH` | `/api/v1/doubts/:id/status` | Teacher / Admin / Student | Update doubt status (`answered`, `resolved`, `closed`) |
| `PATCH` | `/api/v1/doubts/:id/reopen` | Student | Reopen doubt within configured window |
| `POST / GET` | `/api/v1/doubts/:id/messages` | Scoped Auth | Exchange messages (`isInternalNote: true` strictly hidden from Students/Parents) |
| `POST / GET` | `/api/v1/parents` | Admin (POST), Teacher/Admin (GET) | Create & list parent profiles |
| `POST / DELETE` | `/api/v1/parents/:id/link-student` | Admin | Link or unlink student with relationship audit log |
| `GET` | `/api/v1/parents/me/children` | Parent | List verified linked children |
| `GET` | `/api/v1/parents/me/children/:studentId/*` | Parent | Access linked child's `overview`, `attendance`, `assignments`, `results`, `progress`, `timetable` |
| `POST / GET` | `/api/v1/parent-communications` | Parent / Teacher / Admin | Create & list verified parent-teacher communication threads & meeting requests |

---

## 13. Phase 11 — Leave, Substitution & Teacher Management (`/api/v1/teachers`, `/leave-requests`, `/leaves`, `/substitutions`)

| Method | Path | Roles | Description |
| :--- | :--- | :--- | :--- |
| `POST / GET` | `/api/v1/teachers` | Admin (POST), Auth (GET) | Create & search teacher profiles |
| `GET` | `/api/v1/teachers/:id/*` | Scoped Auth | View teacher `classes`, `timetable`, `workload`, `leave-history`, `substitutions` |
| `POST / GET` | `/api/v1/leaves/policies` | Admin (POST), Auth (GET) | Configure dynamic `LeavePolicy` |
| `GET` | `/api/v1/leaves/balances` | Teacher / Admin | Compute dynamic leave balances |
| `POST / GET` | `/api/v1/leave-requests` | Teacher / Admin | Submit leave request with automatic `affectedTimetableEntries` detection |
| `PATCH` | `/api/v1/leave-requests/:id/approve` | Admin | Approve leave request (blocks self-approval) |
| `PATCH` | `/api/v1/leave-requests/:id/cancel` | Teacher / Admin | Cancel leave request & cascade-cancel linked substitutions |
| `POST / GET` | `/api/v1/substitutions` | Admin / Teacher | Propose & list substitutions with conflict detection |
| `GET` | `/api/v1/substitutions/available-teachers` | Admin / Teacher | Rank available substitute teachers for a period |
| `PATCH` | `/api/v1/substitutions/:id/approve` | Admin | Approve substitution & sync `TimetableChange` |

---

## 14. Phase 12 — AI Teaching Assistant, Dashboards & Report Exports (`/api/v1/ai`, `/dashboard`, `/analytics`, `/reports`)

| Method | Path | Roles | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/ai/lesson-plan` | Teacher / Admin | Generate draft lesson plan |
| `POST` | `/api/v1/ai/quiz` | Teacher / Admin | Generate draft quiz with answer key |
| `POST` | `/api/v1/ai/question-paper` | Teacher / Admin | Generate draft examination question paper |
| `POST` | `/api/v1/ai/assignment` | Teacher / Admin | Generate draft assignment problem set |
| `POST` | `/api/v1/ai/topic-explanation` | Teacher / Admin | Generate draft topic explanation |
| `POST` | `/api/v1/ai/rubric` | Teacher / Admin | Generate draft evaluation rubric |
| `POST` | `/api/v1/ai/study-material-summary` | Teacher / Admin | Summarize authorized study materials with prompt-injection & PII defense |
| `POST` | `/api/v1/ai/teaching-material` | Teacher / Admin | Generate draft lecture notes |
| `POST` | `/api/v1/ai/learning-outcomes` | Teacher / Admin | Generate Bloom's taxonomy course outcomes |
| `POST` | `/api/v1/ai/question-bank` | Teacher / Admin | Generate categorized question bank |
| `GET / PATCH / DELETE` | `/api/v1/ai/content/:id` | Teacher / Admin | View, edit (preserving `generatedOutput` in `revisionHistory`), or delete AI draft |
| `POST` | `/api/v1/ai/content/:id/approve` | Teacher / Admin | Approve AI draft & optionally convert to `StudyMaterial` or `Assignment` |
| `POST` | `/api/v1/ai/content/:id/reject` | Teacher / Admin | Reject AI draft with review comments |
| `GET` | `/api/v1/ai/usage` & `/ai/usage/analytics` | Teacher / Admin | Track quota consumption & institution AI telemetry |
| `GET` | `/api/v1/dashboard/admin` | Admin | Institution-wide executive dashboard |
| `GET` | `/api/v1/dashboard/teacher` | Teacher | Assigned classes, schedule, pending evaluations, doubts, leaves |
| `GET` | `/api/v1/dashboard/student` | Student | Personal attendance, assignments, published results, progress |
| `GET` | `/api/v1/dashboard/parent` | Parent | Verified linked children's attendance, assignments, published results |
| `GET` | `/api/v1/analytics/*` | Scoped Auth | Centralized `overview`, `attendance`, `assignments`, `examinations`, `student-progress`, `teacher-workload` |
| `POST / GET` | `/api/v1/reports/generate` & `/reports` | Scoped Auth | Generate & list `PDF`, `Excel (.xlsx)`, and `CSV` reports |
| `GET` | `/api/v1/reports/:id/download` | Scoped Auth | Stream report file (`410 Gone` if expired) |
