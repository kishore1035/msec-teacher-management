# Security Architecture & Audit Report (`SECURITY.md`)

## 1. Authentication & Session Security

- **Password Hashing:** Passwords are hashed using `bcrypt` (cost factor 10) inside the `User` pre-save hook (`src/models/user.model.ts`). Plaintext passwords are never stored or returned (`select: false` and deleted in `.toJSON()`).
- **Dual-JWT Architecture:**
  - Short-lived **Access Tokens** (`15m` default) carry `userId`, `email`, `role`, and `sessionId`.
  - Long-lived **Refresh Tokens** (`7d` default) are stored only as cryptographic SHA-256 hashes (`tokenHash`) in `User.refreshTokens`.
- **Refresh Token Rotation & Reuse Detection:**
  - Every `POST /api/v1/auth/refresh` invalidates the used refresh token hash and issues a new token pair.
  - Presenting an already-rotated or revoked refresh token triggers immediate revocation of all sessions for that user to mitigate token theft.
- **Session Verification on Every Protected Request:**
  - `authenticate` (`src/middleware/auth.middleware.ts`) verifies that the user account is active (`isActive: true`) and that `decoded.sessionId` still exists in `user.refreshTokens`, ensuring `POST /auth/logout` takes effect immediately even before the 15-minute access token expires.

---

## 2. Role-Based & Resource-Scoped Authorization (RBAC)

- **Horizontal & Vertical Privilege Escalation Prevention:**
  - **Students** can only access their own attendance, submissions, doubts, progress, and **published** examination results (`evaluationStatus === 'published'`).
  - **Parents** can only access data for students explicitly linked and verified in `Parent.students` / `Parent.childrenLinks` (`verificationStatus === 'verified'`). Parents cannot download teacher study materials or view unpublished examination results.
  - **Teachers** can only mark attendance, create/evaluate assignments, enter exam marks, answer doubts, target announcements, and generate AI content for subjects and sections actively assigned to them via `TeacherAssignment` or `Section.classTeacher`.
  - **Self-Approval Prevention:** Teachers with administrative roles are strictly blocked from approving their own leave requests (`LeaveService.reviewLeaveRequest`).
  - **Internal Note Isolation:** Doubt messages flagged with `isInternalNote: true` are filtered out at the database query layer whenever the requester is a `Student` or `Parent`.

---

## 3. Input Validation, NoSQL Injection & File Upload Security

- **Global NoSQL Operator & Prototype Pollution Sanitizer (`src/middleware/security.middleware.ts`):**
  - Strips any key starting with `$` (`$gt`, `$ne`, `$where`, `$regex`), containing `.`, or matching `__proto__`, `constructor`, `prototype` across `req.body`, `req.query`, and `req.params`.
- **Strict Schema Validation (`src/middleware/validate.middleware.ts`):**
  - Every endpoint validates input payloads and ObjectId parameters through Zod schemas before reaching controllers.
- **File Upload & Path Traversal Defense (`src/middleware/upload.middleware.ts` & `src/services/storage.service.ts`):**
  - Strict whitelist of both file extension and MIME type (`PDF`, `DOC/DOCX`, `PPT/PPTX`, `XLS/XLSX`, `TXT`, `ZIP`, `JPG/PNG/WEBP`, `MP4/WEBM`).
  - Configurable file size limits (`MAX_FILE_UPLOAD_SIZE_MB`).
  - `LocalStorageService` strips control characters and verifies via `path.resolve` that all read/write operations stay strictly inside the root `uploads/` directory.

---

## 4. AI Security & PII Redaction (`src/services/aiProvider.service.ts`)

- **Server-Side Credential Isolation:** `GEMINI_API_KEY` is read exclusively on the server and never exposed in responses or logs.
- **Automatic Student PII Redaction (`AISecuritySanitizer.sanitizePromptText`):**
  - Redacts USNs (`1MS24CS001` -> `[REDACTED_USN]`), email addresses (`[REDACTED_EMAIL]`), and phone numbers (`[REDACTED_PHONE]`) before prompts leave the server.
- **Prompt Injection Defense (`AISecuritySanitizer.wrapUntrustedReference`):**
  - Strips adversarial instructions (`ignore previous instructions`, `system prompt`, `reveal api key`) and wraps uploaded study material excerpts inside `<untrusted_reference_data>` delimiters.
- **Mandatory Faculty Review:**
  - All AI outputs are created with `reviewStatus: 'draft'` and cannot be viewed by students or parents until explicitly reviewed, approved, and converted by an authorized teacher or administrator.

---

## 5. Secure Logging & Error Handling

- **Credential Redaction in Logs (`sanitizeLogPayload`):**
  - Passwords, access tokens, refresh tokens, API keys, and secrets are automatically replaced with `'[REDACTED]'` before any error metadata is written to Winston logs.
- **Production Stack Trace Suppression:**
  - `error.middleware.ts` omits stack traces and internal error details when `NODE_ENV === 'production'`.
