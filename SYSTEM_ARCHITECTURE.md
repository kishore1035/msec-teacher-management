# System Architecture — MSEC Teacher Management Dashboard & Academic ERP Backend

## 1. High-Level Architectural Topology

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                        Client Applications / API Consumers              │
│             (Admin Portal, Teacher Console, Student & Parent Apps)      │
└───────────────────────────────┬─────────────────────────┬───────────────┘
                                │ HTTPS (REST / JSON)     │ WSS (Socket.IO)
                                ▼                         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Express.js API Gateway                          │
│  • Helmet Security Headers & CORS                                       │
│  • Body Parsers (Configurable Payload Limit)                            │
│  • NoSQL Injection & Prototype Pollution Sanitizer (security.middleware)│
│  • Rate Limiters (General, Auth Brute-Force, Communication)             │
│  • Health Probes (/health, /health/live, /health/ready)                 │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Authentication, RBAC & Validation Layer              │
│  • Dual-JWT Verification + Active Session Validation (auth.middleware)  │
│  • Role Guard: Super Admin | Admin | Teacher | Student | Parent         │
│  • Zod Request Validation (body, query, params)                         │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       Controllers (src/controllers/)                    │
│  • Stateless request/response orchestration                             │
│  • Standardized ApiResponse & ApiError formatting                       │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     Domain Services (src/services/)                     │
│  • Auth & Session Rotation    • Study Material Versioning               │
│  • Academic Core & Classes    • Timetable 6-Vector Conflict Engine      │
│  • Attendance & Policy Engine • Audience Targeting & Notifications      │
│  • Assignments & Evaluation   • Doubt Auto-Routing & Parent Portal      │
│  • Dynamic Grading & Results  • Leave Quotas & Substitution Engine      │
│  • Student Progress & Risk    • AI Assistant, Dashboards & Reports      │
└───────────┬───────────────────┴──────────────────┬──────────────────────┘
            │                                      │
            ▼                                      ▼
┌───────────────────────────────┐    ┌────────────────────────────────────┐
│   MongoDB 7 + Mongoose 8.9    │    │ External & Infrastructure Adapters │
│   (40 Models, Compound Unique │    │ • AIProviderRegistry (Gemini/Local)│
│    Indexes, Audit Trails)     │    │ • LocalStorageService (uploads/)   │
└───────────────────────────────┘    │ • Email / SMS / Push Providers     │
                                     └────────────────────────────────────┘
```

---

## 2. Core Architectural Principles

1. **Strict Separation of Concerns:**
   - **Controllers** never execute Mongoose queries directly.
   - **Services** encapsulate all business invariants, cross-module lookups, RBAC resource-ownership checks, and audit trail recording.
   - **Models** enforce structural validation, compound uniqueness, and strip confidential fields in `.toJSON()`.
2. **Non-Hardcoded Institutional Policy Engines:**
   - Attendance shortage and warning thresholds are evaluated dynamically from active `AttendancePolicy` documents.
   - Grade scales, passing marks, and IA aggregation methods (`BEST_2_OF_3`, `AVERAGE_ALL`, `WEIGHTED`) are evaluated from active `GradingPolicy` documents.
   - Student at-risk scoring is evaluated from configurable `RiskRule` documents.
   - Teacher leave quotas, half-day eligibility, and approval workflows are evaluated from `LeavePolicy` documents.
   - AI daily/monthly request and token quotas are enforced from `AIUsagePolicy` documents.
3. **Immutable Audit Trails & Historical Preservation:**
   - Attendance corrections append to `AttendanceRecord.auditHistory`.
   - Assignment re-evaluations append to `AssignmentSubmission.evaluationHistory`.
   - Post-publication result modifications require a mandatory reason and append to `ExaminationResult.auditHistory`.
   - Study material edits preserve prior versions in `StudyMaterialVersion`.
   - Timetable conflict overrides log to `TimetableConflictOverride`, and temporary changes/substitutions use `TimetableChange` without mutating recurring `TimetableEntry` records.
   - AI-generated content preserves the initial `generatedOutput` as `immutable: true` and tracks teacher revisions in `revisionHistory`.

---

## 3. Caching & Concurrency Strategy

- **Role-Isolated Short-TTL Dashboard Cache (`DashboardService`):**
  - Cache keys are strictly partitioned by `dashboard:<role>:<userId>:<queryHash>` with a 15-second TTL.
  - Cross-user cache sharing is impossible by design.
- **Idempotent Notification Deduplication:**
  - Compound partial unique indexes on `{ recipient: 1, eventKey: 1 }` and `{ recipient: 1, announcement: 1 }` guarantee at-most-once in-app notification creation per recipient and event.
- **Graceful Shutdown & Background Maintenance:**
  - `server.ts` runs an unref'd background timer to clean up expired report exports (`CentralReportAnalyticsService.cleanupExpiredReports()`) and cleanly drains Socket.IO, HTTP connections, and Mongoose pools on `SIGTERM`/`SIGINT`.
