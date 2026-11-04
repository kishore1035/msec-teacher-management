# Database Schema & Indexing Reference (`DATABASE_SCHEMA.md`)

All 40 Mongoose models in `src/models/` enforce strict schema validation, ObjectId referential integrity, compound indexes, and `.toJSON()` security transforms.

---

## 1. Model Inventory by Phase

| Phase | Model Name | Collection | Purpose | Key Compound / Unique Indexes |
| :--- | :--- | :--- | :--- | :--- |
| **1** | `User` | `users` | Authentication credentials, roles, and rotating refresh token sessions | `{ email: 1 }` (unique), `{ role: 1, isActive: 1 }` |
| **2** | `AcademicYear` | `academicyears` | Institutional academic years and active term flags | `{ name: 1 }` (unique), `{ isActive: 1 }` |
| **2** | `Department` | `departments` | Academic departments and HOD references | `{ code: 1 }` (unique), `{ name: 1 }` (unique) |
| **2** | `Class` | `classes` | Degree programs / classes per department and semester | `{ code: 1, academicYear: 1 }` (unique) |
| **2** | `Section` | `sections` | Class sections, room numbers, and class teachers | `{ class: 1, name: 1, academicYear: 1, semester: 1 }` (unique) |
| **2** | `Subject` | `subjects` | Course subjects, credits, syllabus modules | `{ code: 1 }` (unique), `{ department: 1, semester: 1 }` |
| **2 / 11** | `Teacher` | `teachers` | Faculty profiles, qualifications, workload limits, status | `{ user: 1 }` (unique), `{ employeeId: 1 }` (unique) |
| **2** | `TeacherAssignment` | `teacherassignments` | Mapping of teachers to `(subject, section, academicYear)` | `{ teacher: 1, subject: 1, section: 1, academicYear: 1, status: 1 }` (unique) |
| **3** | `Student` | `students` | Student enrollment profiles, USN, section, guardian links | `{ user: 1 }` (unique), `{ usn: 1 }` (unique), `{ section: 1, status: 1 }` |
| **3 / 10** | `Parent` | `parents` | Guardian profiles, verified child links, relationship history | `{ user: 1 }` (unique), `{ students: 1, verificationStatus: 1 }` |
| **3** | `AttendancePolicy` | `attendancepolicies` | Configurable shortage/warning thresholds & late/excused rules | `{ academicYear: 1, department: 1, isActive: 1 }` |
| **3** | `AttendanceSession` | `attendancesessions` | Class lecture/lab attendance sessions | `{ section: 1, subject: 1, date: 1, periodNumber: 1 }` (unique) |
| **3** | `AttendanceRecord` | `attendancerecords` | Individual student attendance status & correction audit log | `{ session: 1, student: 1 }` (unique), `{ student: 1, status: 1 }` |
| **4** | `Assignment` | `assignments` | Course assignments, due dates, late rules, attachments | `{ section: 1, subject: 1, status: 1, dueDate: 1 }` |
| **4** | `AssignmentSubmission` | `assignmentsubmissions` | Student submissions, attempt counters, evaluation history | `{ assignment: 1, student: 1 }` (unique), `{ assignment: 1, evaluationStatus: 1 }` |
| **5** | `GradingPolicy` | `gradingpolicies` | Configurable grade tiers, passing %, and IA calculation method | `{ academicYear: 1, isDefault: 1 }` |
| **5** | `Examination` | `examinations` | IA1, IA2, IA3, semester, and practical examinations | `{ examinationCode: 1 }` (unique), `{ academicYear: 1, semester: 1 }` |
| **5** | `ExaminationSchedule` | `examinationschedules` | Exam timetable slots, venues, and invigilators | `{ section: 1, examDate: 1, startTime: 1 }` (unique) |
| **5** | `ExaminationResult` | `examinationresults` | Student marks, computed grades, publication state, audit trail | `{ examination: 1, student: 1, subject: 1 }` (unique), `{ student: 1, evaluationStatus: 1 }` |
| **5** | `QuestionAssessment` | `questionassessments` | Granular question-wise CO/PO marks breakdown | `{ examinationResult: 1 }` (unique) |
| **6** | `RiskRule` | `riskrules` | Configurable at-risk thresholds and indicator weights | `{ academicYear: 1, isActive: 1 }` |
| **6** | `StudentProgress` | `studentprogresses` | Aggregated student progress, risk levels, and historical snapshots | `{ student: 1, academicYear: 1, semester: 1, subject: 1, isSnapshot: 1 }` (partial unique) |
| **7** | `StudyMaterial` | `studymaterials` | Teaching resources, visibility scopes, engagement counters | Text index on `title, description, topic, tags`; `{ subject: 1, section: 1, semester: 1, status: 1 }` |
| **7** | `StudyMaterialVersion` | `studymaterialversions` | Immutable historical versions of study materials | `{ studyMaterial: 1, versionNumber: 1 }` (unique) |
| **8** | `Timetable` | `timetables` | Section master timetables with effective date ranges | `{ section: 1, effectiveFrom: 1, effectiveTo: 1, status: 1 }` |
| **8** | `TimetableEntry` | `timetableentries` | Recurring weekly period allocations | `{ timetable: 1, dayOfWeek: 1, periodNumber: 1 }`, `{ teacher: 1, dayOfWeek: 1, startTime: 1, endTime: 1 }` |
| **8** | `TimetableChange` | `timetablechanges` | Non-destructive daily substitutions, room swaps, cancellations | `{ timetableEntry: 1, date: 1, status: 1 }` |
| **8** | `TimetableConflictOverride` | `timetableconflictoverrides` | Immutable audit log of admin conflict overrides | `{ timetable: 1, createdAt: -1 }` |
| **8 / 11** | `TeacherLeave` | `teacherleaves` | Full-day and partial-day leave requests & affected timetable slots | `{ teacher: 1, startDate: 1, endDate: 1, status: 1 }` |
| **9** | `Announcement` | `announcements` | Targeted institutional/class announcements & recipient snapshots | `{ status: 1, priority: 1, createdAt: -1 }`, `{ targetSections: 1, status: 1 }` |
| **9** | `Notification` | `notifications` | User notifications with per-channel delivery tracking | `{ recipient: 1, eventKey: 1 }` (partial unique), `{ recipient: 1, announcement: 1 }` (partial unique) |
| **9** | `NotificationPreference` | `notificationpreferences` | User channel preferences, quiet hours, and push devices | `{ user: 1 }` (unique) |
| **10** | `Doubt` | `doubts` | Student academic doubts with auto-assigned teacher & history | `{ student: 1, status: 1, createdAt: -1 }`, `{ assignedTeacher: 1, status: 1, createdAt: -1 }` |
| **10** | `DoubtMessage` | `doubtmessages` | Doubt conversation messages & isolated internal staff notes | `{ doubt: 1, isInternalNote: 1, createdAt: 1 }` |
| **10** | `ParentCommunication` | `parentcommunications` | Verified parent-teacher communication threads & meeting requests | `{ parent: 1, student: 1, status: 1 }`, `{ teacher: 1, status: 1, lastMessageAt: -1 }` |
| **10** | `ParentCommunicationMessage` | `parentcommunicationmessages` | Messages within parent-teacher communication threads | `{ communication: 1, createdAt: 1 }` |
| **11** | `LeavePolicy` | `leavepolicies` | Dynamic leave quotas, half-day rules, and approval workflows | `{ academicYear: 1, isActive: 1 }` |
| **11** | `Substitution` | `substitutions` | Substitute teacher assignments, conflict checks, completion logs | `{ substituteTeacher: 1, date: 1, status: 1 }`, `{ timetableEntry: 1, date: 1, status: 1 }` |
| **12** | `AIGeneratedContent` | `aigeneratedcontents` | AI drafts, immutable `generatedOutput`, revisions, approval state | `{ createdBy: 1, contentType: 1, reviewStatus: 1, createdAt: -1 }` |
| **12** | `AIUsageLog` / `AIUsagePolicy` | `aiusagelogs` / `aiusagepolicies` | AI token/request telemetry and role/user quota policies | `{ user: 1, createdAt: -1 }`, `{ scope: 1, targetRole: 1, isActive: 1 }` |
| **12** | `ReportJob` | `reportjobs` | Exported PDF, Excel, and CSV report jobs and expiry tracking | `{ requestedBy: 1, status: 1, createdAt: -1 }`, `{ expiresAt: 1 }` |

---

## 2. Referential Integrity & Historical Preservation Rules

1. **Zero Destructive Cascading Deletes on Academic Records:**
   - Deactivating a `User` or `Teacher` sets `isActive: false` / `status: 'Inactive'` while preserving all historical `AttendanceSession`, `Assignment`, `ExaminationResult`, and `StudyMaterial` records.
   - Published `Announcement` deletion transitions the record to `status: 'archived'` rather than removing historical audit trails.
2. **Snapshot Isolation:**
   - `Announcement.resolvedRecipientsSnapshot` freezes the resolved user IDs at publication time.
   - `StudentProgress` preserves historical snapshots (`isSnapshot: true`) separately from the active live progress document (`isSnapshot: false`).
   - `StudyMaterialVersion` stores immutable snapshots before any update to `StudyMaterial`.
   - `AIGeneratedContent.generatedOutput` is marked `immutable: true` at the Mongoose schema level.
