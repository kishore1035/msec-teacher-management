# Automated Testing & Verification Guide (`TESTING.md`)

## 1. Testing Architecture

The repository uses **Jest 29**, **Supertest**, and **`mongodb-memory-server`** to run isolated, deterministic integration tests against the full Express + Mongoose stack without requiring external database infrastructure.

- **Zero External State:** Every test suite boots an isolated in-memory MongoDB instance and clears collections between tests.
- **Real Middleware & RBAC Execution:** Tests authenticate through `/api/v1/auth/login` and exercise real JWT verification, Zod validation, RBAC guards, and Mongoose indexes.

---

## 2. Test Suite Inventory (`tests/integration/`)

| Suite File | Phase(s) Covered | Key Verified Scenarios |
| :--- | :--- | :--- |
| `auth.test.ts` | Phase 1 | Registration, login, JWT verification, refresh token rotation, token reuse detection, session revocation, RBAC |
| `academic.test.ts` | Phase 2 | Academic years, departments, classes, sections, subjects, teacher profiles, teacher assignments |
| `attendance.test.ts` | Phase 3 | Attendance policies, session creation, bulk attendance marking, shortage detection, audited corrections |
| `assignment.test.ts` | Phase 4 | Assignment lifecycle, student submissions, late submission rules, resubmission limits, teacher evaluations |
| `examination.test.ts` | Phase 5 | Dynamic grading policies, exam scheduling conflict prevention, bulk marks entry, IA aggregation, result publication confidentiality |
| `progressAnalytics.test.ts` | Phase 6 | Multi-source student progress calculation, explainable at-risk detection, snapshot preservation |
| `studyMaterial.test.ts` | Phase 7 | Study material uploads, immutable version history, visibility scoping (`class`, `subject`, `institution`), download counters |
| `timetable.test.ts` | Phase 8 | Timetable creation, 6-vector conflict detection, audited admin overrides, temporary changes |
| `announcementNotification.test.ts` | Phase 9 | Audience targeting, recipient snapshot preservation, notification deduplication, quiet hours, mandatory alert protection |
| `doubtParentCommunication.test.ts` | Phase 10 | Doubt auto-assignment, internal staff note privacy, verified parent-child linkage, parent academic portal, parent-teacher threads |
| `leaveSubstitutionTeacher.test.ts` | Phase 11 | Dynamic leave policies, partial/half-day leave requests, self-approval block, substitute conflict detection, workload analytics |
| `phase12AiReportsDashboard.test.ts` | Phase 12 | AI draft generation, faculty review/edit/approve/convert workflow, quota limits, PII/prompt-injection defense, role dashboards, PDF/Excel/CSV reports |
| `finalPhaseEndToEndSecurity.test.ts` | Final Phase | Health/liveness/readiness probes, NoSQL injection & prototype pollution sanitization, log secret redaction, end-to-end cross-module workflow |

---

## 3. Running Tests & Verification Commands

```bash
# Run all 13 integration test suites sequentially
npm test

# Run a single integration test suite
npx jest tests/integration/finalPhaseEndToEndSecurity.test.ts --runInBand

# Run TypeScript compiler verification
npx tsc --noEmit

# Build production bundle
npm run build
```
