# MSEC Teacher Management Dashboard & Academic ERP Backend

Enterprise-grade educational ERP backend built with **Node.js**, **TypeScript**, **Express.js**, **MongoDB**, **Mongoose**, **Zod**, **JWT**, and **Socket.IO**, implementing all **12 development phases** plus **End-to-End Integration, Security Audit & Production Readiness**.

---

## 1. Project Overview

The **MSEC Teacher Management Dashboard & Academic ERP Backend** provides a unified, secure, role-isolated REST and real-time backend for managing:
- **Phase 1:** Stateless Dual-JWT Authentication, Rotating Refresh Tokens, Multi-Device Session Tracking & Role-Based Access Control (`Super Admin`, `Admin`, `Teacher`, `Student`, `Parent`).
- **Phase 2:** Academic Core (`AcademicYear`, `Department`, `Class`, `Section`, `Subject`, `Teacher`, `TeacherAssignment`).
- **Phase 3:** Attendance Sessions, Bulk Attendance Marking, Policy-Driven Shortage Detection (`AttendancePolicy`), and Audited Corrections.
- **Phase 4:** Assignment Lifecycle (`draft` -> `published` -> `closed` -> `archived`), Student Submissions, Resubmissions, Late Rules, Attachment Storage, and Audited Evaluations.
- **Phase 5:** Examinations (`IA1`, `IA2`, `IA3`, `semester`, `practical`), Conflict-Free Schedules, Dynamic Grading Policies (`BEST_2_OF_3`, `AVERAGE_ALL`, `WEIGHTED`), Marks Entry, Confidential Result Publication, and Post-Publication Audit Trails.
- **Phase 6:** Multi-Source Student Academic Progress Tracking, Explainable At-Risk Student Classification (`RiskRule`), and Historical Snapshots.
- **Phase 7:** Study Materials, Multi-Format File Storage, Immutable Version History (`StudyMaterialVersion`), and Role-Scoped Visibility (`class`, `subject`, `institution`).
- **Phase 8:** Master Timetables, 6-Vector Pre-Save Conflict Engine, Audited Conflict Overrides, and Non-Destructive Daily Changes (`TimetableChange`).
- **Phase 9:** Targeted Announcements, Recipient Snapshot Preservation, Multi-Channel Notification Delivery (`in_app`, `email`, `sms`, `push`), Quiet Hours, and Socket.IO Real-Time Delivery.
- **Phase 10:** Student Doubt Management with Auto-Teacher Assignment, Private Internal Staff Notes, Multi-Guardian Parent Profiles, Verified Parent Academic Portal, and Parent-Teacher Communication / Meeting Requests.
- **Phase 11:** Dynamic Leave Policies, Half-Day/Partial-Day Leave Requests, Timetable Impact Resolution, Self-Approval Prevention, Substitute Teacher Conflict Engine, and Teacher Workload Analytics.
- **Phase 12:** Provider-Independent AI Teaching Assistant (`Google Gemini` & Deterministic Academic Fallback), Mandatory Faculty Review Workflow, Prompt-Injection & PII Sanitization, Role-Isolated Dashboards, and Multi-Format Academic Report Exports (`PDF`, `Excel`, `CSV`).

---

## 2. Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Runtime** | Node.js v20+ LTS |
| **Language** | TypeScript 5.7 (Strict Mode) |
| **Web Framework** | Express.js 4.21 |
| **Database & ODM** | MongoDB 7.0+ & Mongoose 8.9 |
| **Validation** | Zod 3.24 |
| **Authentication** | JSON Web Tokens (`jsonwebtoken`) + `bcrypt` |
| **Real-Time** | Socket.IO 4.8 |
| **AI Integration** | `@google/genai` (`gemini-3.8-flash`) + Provider Abstraction (`IAIProvider`) |
| **Security** | `helmet`, `cors`, `express-rate-limit`, Custom NoSQL & Log Sanitizers |
| **Logging** | Winston + Morgan |
| **API Docs** | OpenAPI 3.0.3 (`swagger-jsdoc` + `swagger-ui-express`) |
| **Testing** | Jest 29 + Supertest + `mongodb-memory-server` |

---

## 3. Architecture Overview

The backend enforces a strict 4-tier layered architecture:
1. **Routes (`src/routes/`):** Endpoint declarations, authentication (`authenticate`), RBAC (`authorize`), rate limiting, file upload (`multer`), and Zod schema validation (`validateRequest`).
2. **Controllers (`src/controllers/`):** HTTP request extraction and standardized `ApiResponse` formatting. Zero database queries live in controllers.
3. **Services (`src/services/`):** Domain business logic, dynamic policy engines, RBAC ownership verification, multi-collection workflows, AI provider orchestration, and report generation.
4. **Models (`src/models/`):** 40 Mongoose schemas with compound unique indexes, pre-save hooks, and `.toJSON()` transforms that strip sensitive fields (`password`, `refreshTokens`, `resolvedRecipientsSnapshot`).

See [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md) for full architectural diagrams and data-flow specifications.

---

## 4. Folder Structure

```text
├── Dockerfile                  # Multi-stage production container build
├── docker-compose.yml          # Local development stack (API + MongoDB 7)
├── .env.example                # Documented environment variable template
├── scripts/
│   ├── backup-db.sh            # Non-destructive MongoDB & uploads backup script
│   └── restore-db.sh           # Checksum-verified restore script
├── src/
│   ├── config/                 # Env validation, MongoDB connection, Logger, Swagger spec
│   ├── constants/              # Roles, HTTP status codes, standard messages
│   ├── controllers/            # Express route controllers + HealthController
│   ├── middleware/             # Auth, RBAC, Zod validation, Security sanitizer, Rate limiter, Upload, Error handler
│   ├── models/                 # 40 Mongoose models across Phases 1–12
│   ├── routes/                 # Modular Express routers mounted under /api/v1
│   ├── services/               # Domain services, AI provider registry, Storage, Socket.IO
│   ├── types/                  # Express request augmentations & TypeScript interfaces
│   ├── utils/                  # ApiError, ApiResponse, asyncHandler, JWT, Password, Pagination
│   ├── validators/             # Zod schemas for all endpoints
│   ├── app.ts                  # Express application pipeline
│   └── server.ts               # HTTP + Socket.IO server & graceful shutdown lifecycle
└── tests/
    └── integration/            # 13 comprehensive Jest + Supertest integration test suites
```

---

## 5. Prerequisites

- **Node.js:** v20.0.0 or higher
- **npm:** v10.0.0 or higher
- **MongoDB:** v6.0 / v7.0+ (In development mode, the backend automatically falls back to an embedded `mongodb-memory-server` instance with seeded demo data if a local MongoDB daemon is not running).

---

## 6. Local Installation

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template
cp .env.example .env
```

---

## 7. Environment Configuration

Configure `.env` based on `.env.example`:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `development` | `development`, `test`, or `production` |
| `PORT` | `3000` | HTTP server port |
| `MONGODB_URI` | `mongodb://localhost:27017/teacher_management_db` | MongoDB connection URI |
| `JWT_ACCESS_SECRET` | *(min 16 chars)* | Secret key for 15m access tokens |
| `JWT_REFRESH_SECRET` | *(min 16 chars)* | Secret key for 7d rotating refresh tokens |
| `CORS_ORIGIN` | `*` | Allowed CORS origins (comma-separated in production) |
| `REQUEST_PAYLOAD_LIMIT` | `10mb` | Express JSON/URL-encoded body limit |
| `MAX_FILE_UPLOAD_SIZE_MB` | `50` | Maximum file upload size in MB |
| `GEMINI_API_KEY` | *(optional)* | Server-side Google Gemini API key |
| `AI_PROVIDER` | `gemini` | `gemini`, `fallback`, or `custom` |
| `AI_MODEL` | `gemini-3.8-flash` | Configured AI model identifier |
| `AI_DAILY_REQUEST_LIMIT_TEACHER` | `50` | Default daily AI generation quota for teachers |
| `AI_DAILY_REQUEST_LIMIT_ADMIN` | `200` | Default daily AI generation quota for admins |
| `REPORT_EXPIRY_HOURS` | `168` | Hours before exported report files expire |

---

## 8. MongoDB Setup

- **Local / Production MongoDB:** Point `MONGODB_URI` to your MongoDB replica set or standalone instance. Mongoose automatically builds all compound unique and query indexes on startup (`autoIndex: true`).
- **Zero-Config Development Mode:** If `MONGODB_URI` is unreachable in `development` mode, `src/config/db.config.ts` automatically provisions an in-memory MongoDB instance and seeds demo accounts (`admin@msec.ac.in`, `prof.sharma@msec.ac.in`, `student@msec.ac.in`, `parent@msec.ac.in`).

---

## 9. AI Provider Setup

- Set `GEMINI_API_KEY` in `.env` to enable live generation via Google Gemini (`@google/genai`, default model `gemini-3.8-flash`).
- If `GEMINI_API_KEY` is omitted in local development or automated tests, `AIProviderRegistry` transparently uses `DeterministicAcademicAIProvider` so all 10 AI generation workflows (`lesson_plan`, `quiz`, `question_paper`, `assignment`, `topic_explanation`, `rubric`, `study_material_summary`, `teaching_material`, `learning_outcomes`, `question_bank`) function deterministically without external network failures.

---

## 10. File Storage Setup

All uploaded attachments and generated reports are managed through `LocalStorageService` under `uploads/`:
- `uploads/temp/` — Multer staging directory
- `uploads/assignments/` — Assignment & submission attachments
- `uploads/materials/` — Study material versions
- `uploads/announcements/` — Announcement attachments
- `uploads/reports/` — Generated PDF, Excel (`.xlsx`), and CSV report files

All paths are sanitized and verified with `path.resolve` containment checks to prevent path traversal.

---

## 11. Running the Development Server

```bash
npm run dev
```

- Server listens on `http://localhost:3000`
- Swagger UI: `http://localhost:3000/api/v1/docs`
- Health Check: `http://localhost:3000/health`

---

## 12. Running Tests

```bash
# Run the complete integration & security test suite (13 suites, 156 tests)
npm test

# Run with coverage report
npm run test:coverage
```

See [TESTING.md](./TESTING.md) for detailed test suite documentation.

---

## 13. Building for Production

```bash
# Type-check and compile TypeScript to dist/
npm run build
```

---

## 14. Starting Production Server

```bash
NODE_ENV=production npm start
```

---

## 15. API Documentation

- Interactive Swagger UI: `GET /api/v1/docs`
- Raw OpenAPI 3.0.3 JSON Spec: `GET /api/v1/openapi.json`
- Complete endpoint inventory: [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)

---

## 16. Database Backup and Restore

```bash
# Create a non-destructive gzipped MongoDB dump + uploads archive + SHA-256 manifest
bash scripts/backup-db.sh

# Verify SHA-256 checksums and restore from a backup directory
bash scripts/restore-db.sh ./backups/<TIMESTAMP>
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for backup frequency, retention policies, and disaster recovery procedures.

---

## 17. Deployment Instructions

```bash
# Build and launch with Docker Compose
docker compose up -d --build

# Check container readiness
curl -f http://localhost:3000/health/ready
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) and [SECURITY.md](./SECURITY.md) for full production deployment checklists.
