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

## 5. Development & Testing Commands

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

## 6. Contribution Standards for Future Phases

1. **Test-Driven:** Before adding a feature, add automated integration test assertions in `tests/integration/`.
2. **Zero Breaking Changes:** Never break Phase 1, Phase 2, or Phase 3 endpoints.
3. **No UI / Frontend:** Keep this repository strictly focused on the backend REST API.
