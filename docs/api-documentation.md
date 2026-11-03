# Teacher Management System — API Documentation

Base URL: `http://localhost:5000/api/v1`

---

## 1. Authentication & Session Management

### 1.1 Login
- **Endpoint:** `POST /auth/login`
- **Access:** Public
- **Rate Limit:** 5 requests / 15 minutes per IP
- **Request Body:**
```json
{
  "email": "prof.sharma@msec.ac.in",
  "password": "TeacherPassword123"
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "67265a782a1708848d799f11",
      "email": "prof.sharma@msec.ac.in",
      "role": "Teacher",
      "isActive": true,
      "lastLogin": "2026-11-02T21:40:00.000Z"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsIn...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsIn..."
    }
  },
  "meta": { "timestamp": "2026-11-02T21:40:00.000Z" }
}
```

### 1.2 Rotate Refresh Token
- **Endpoint:** `POST /auth/refresh-token`
- **Access:** Public (Requires valid Refresh Token)
- **Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsIn..."
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Access token refreshed successfully",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsIn...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsIn..."
  }
}
```

### 1.3 Logout
- **Endpoint:** `POST /auth/logout`
- **Access:** Bearer JWT Access Token
- **Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Logged out successfully",
  "data": null
}
```

### 1.4 Current User Profile
- **Endpoint:** `GET /auth/me`
- **Access:** Bearer JWT Access Token
- **Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Resource fetched successfully",
  "data": {
    "id": "67265a782a1708848d799f11",
    "email": "prof.sharma@msec.ac.in",
    "role": "Teacher",
    "isActive": true,
    "lastLogin": "2026-11-02T21:40:00.000Z"
  }
}
```

### 1.5 Change Password
- **Endpoint:** `PUT /auth/change-password`
- **Access:** Bearer JWT Access Token
- **Request Body:**
```json
{
  "currentPassword": "TeacherPassword123",
  "newPassword": "NewStrongPassword456"
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Password changed successfully",
  "data": null
}
```

---

## 2. Academic Year Management

### 2.1 List Academic Years
- **Endpoint:** `GET /academics/years`
- **Access:** Authenticated
- **Query Params:** `?status=Active`
- **Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": [
    {
      "_id": "67265a882a1708848d799f22",
      "year": "2026-2027",
      "startDate": "2026-08-01T00:00:00.000Z",
      "endDate": "2027-05-31T00:00:00.000Z",
      "semesterType": "ODD",
      "isCurrent": true,
      "status": "Active"
    }
  ]
}
```

### 2.2 Create Academic Year
- **Endpoint:** `POST /academics/years`
- **Access:** Super Admin, Admin
- **Request Body:**
```json
{
  "year": "2026-2027",
  "startDate": "2026-08-01",
  "endDate": "2027-05-31",
  "semesterType": "ODD",
  "isCurrent": true
}
```

### 2.3 Set Current Academic Year
- **Endpoint:** `PUT /academics/years/:id/set-current`
- **Access:** Super Admin, Admin

---

## 3. Department Management

### 3.1 List Departments
- **Endpoint:** `GET /departments`
- **Access:** Authenticated

### 3.2 Create Department
- **Endpoint:** `POST /departments`
- **Access:** Super Admin, Admin
- **Request Body:**
```json
{
  "name": "Computer Science & Engineering",
  "code": "CSE",
  "description": "Department of CSE"
}
```

---

## 4. Class & Section Management

### 4.1 Create Academic Class
- **Endpoint:** `POST /classes`
- **Access:** Super Admin, Admin
- **Request Body:**
```json
{
  "name": "B.E. Computer Science and Engineering",
  "code": "BE-CSE",
  "department": "67265a882a1708848d799f33",
  "degree": "B.E.",
  "durationYears": 4
}
```

### 4.2 Create Section
- **Endpoint:** `POST /sections`
- **Access:** Super Admin, Admin
- **Request Body:**
```json
{
  "class": "67265a882a1708848d799f44",
  "academicYear": "67265a882a1708848d799f22",
  "semester": 5,
  "sectionName": "A",
  "classTeacher": "67265a882a1708848d799f55",
  "roomNumber": "L301",
  "capacity": 60
}
```

---

## 5. Subject Management

### 5.1 Create Subject
- **Endpoint:** `POST /subjects`
- **Access:** Super Admin, Admin
- **Request Body:**
```json
{
  "name": "Database Management Systems",
  "code": "21CS51",
  "department": "67265a882a1708848d799f33",
  "semester": 5,
  "credits": 4,
  "subjectType": "Theory",
  "modules": [
    {
      "moduleNumber": 1,
      "title": "Introduction to DBMS",
      "topics": ["ER Models", "Relational Algebra", "SQL Queries"]
    }
  ]
}
```

---

## 6. Teacher Assignment Management

### 6.1 Assign Teacher to Subject & Section
- **Endpoint:** `POST /teacher-assignments`
- **Access:** Super Admin, Admin
- **Request Body:**
```json
{
  "teacher": "67265a882a1708848d799f55",
  "subject": "67265a882a1708848d799f66",
  "section": "67265a882a1708848d799f77",
  "academicYear": "67265a882a1708848d799f22",
  "semester": 5,
  "isPrimary": true
}
```

### 6.2 Deactivate/Remove Assignment (Soft-Delete)
- **Endpoint:** `DELETE /teacher-assignments/:id`
- **Access:** Super Admin, Admin

---

## 7. Teacher Personal Endpoints

### 7.1 My Assigned Classes
- **Endpoint:** `GET /teachers/me/classes`
- **Access:** Teacher

### 7.2 My Assigned Subjects
- **Endpoint:** `GET /teachers/me/subjects`
- **Access:** Teacher

### 7.3 My Active Assignments
- **Endpoint:** `GET /teachers/me/assignments`
- **Access:** Teacher
```json
{
  "success": true,
  "statusCode": 200,
  "data": [
    {
      "_id": "67265a882a1708848d799f88",
      "semester": 5,
      "isPrimary": true,
      "status": "Active",
      "subject": {
        "name": "Database Management Systems",
        "code": "21CS51",
        "credits": 4
      },
      "section": {
        "sectionName": "A",
        "semester": 5,
        "roomNumber": "L301"
      },
      "academicYear": {
        "year": "2026-2027",
        "isCurrent": true
      }
    }
  ]
}
```

---

## 8. Announcements & Notifications Management (Phase 9)

### 8.1 Announcement Workflows & Audience Targeting Engine
- **Lifecycle:** `draft` -> `scheduled` -> `published` -> `archived`.
- **Audience Resolution (`AudienceTargetingService`):**
  - Resolves recipients using `targetAudience` (`all`, `teachers`, `students`, `parents`, `administrators`, `selected`) combined with `targetDepartments`, `targetClasses`, `targetSections`, `targetSubjects`, and `specificRecipients`.
  - Automatically deduplicates overlapping target groups (`Set<string>`).
  - **Teacher Scope Enforcement:** Teachers cannot target `all`, `administrators`, `teachers`, or entire departments; they are restricted to sections, classes, and subjects actively assigned to them via `TeacherAssignment` or `Section.classTeacher`.
  - **Parent-Child Linkage:** Parents receive announcements only when their linked children (`Parent.students`) match the targeted academic filters.
  - **Publication Snapshot (`resolvedRecipientsSnapshot`):** At publication time, the resolved recipient list is snapshotted so students transferring sections later do not retroactively gain or lose access to historical announcements.

### 8.2 Create / Schedule / Publish Announcement
- **Endpoint:** `POST /announcements`
- **Access:** Super Admin, Admin, Teacher
- **Request Body:**
```json
{
  "title": "Internal Assessment 2 Schedule Released",
  "content": "IA-2 examinations for 5th Semester CSE will begin on November 15, 2026.",
  "summary": "IA-2 schedule for 5th Sem CSE",
  "announcementType": "examination",
  "priority": "high",
  "targetAudience": "students",
  "targetSections": ["67265a882a1708848d799f77"],
  "status": "published"
}
```
- **Response (201 Created):**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Announcement created successfully",
  "data": {
    "_id": "67265b992a1708848d799fa1",
    "title": "Internal Assessment 2 Schedule Released",
    "announcementType": "examination",
    "priority": "high",
    "targetAudience": "students",
    "status": "published",
    "publishedAt": "2026-11-02T22:00:00.000Z",
    "targetRecipientCount": 58
  }
}
```

### 8.3 Announcement Readership Analytics
- **Endpoint:** `GET /announcements/:id/analytics`
- **Access:** Super Admin, Admin, Announcement Creator (Teacher)
- **Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Announcement readership analytics retrieved successfully",
  "data": {
    "announcementId": "67265b992a1708848d799fa1",
    "title": "Internal Assessment 2 Schedule Released",
    "status": "published",
    "priority": "high",
    "totalTargeted": 58,
    "totalNotificationsCreated": 58,
    "readCount": 42,
    "unreadCount": 16,
    "readPercentage": 72.41,
    "deliveryBreakdown": {
      "delivered": 58,
      "partial": 0,
      "failed": 0,
      "pending": 0,
      "sent": 0
    }
  }
}
```

### 8.4 Notification Delivery Providers, Retry & Failure Handling
- **Channels Supported:** `in_app`, `email`, `sms`, `push`.
- **Provider Abstractions:** `IEmailNotificationProvider`, `ISmsNotificationProvider`, `IPushNotificationProvider` in `src/services/notificationDelivery.service.ts`.
- **Honest Confirmation:** External channels are marked `skipped` unless enabled via environment variables (`EMAIL_PROVIDER_ENABLED=true`, `SMS_PROVIDER_ENABLED=true`, `PUSH_PROVIDER_ENABLED=true`) and confirmed by the provider (`confirmed: true`).
- **Retry with Exponential Backoff:** Transient provider errors are retried up to `NOTIFICATION_MAX_RETRIES` (default `3`) with exponential backoff (`NOTIFICATION_RETRY_BASE_MS * 2^(attempt-1)`).
- **Idempotency & Fault Isolation:** Delivered `(notificationId, channel)` pairs are tracked to prevent duplicate sends during retries. External provider failures result in `partial` status and never block in-app notification persistence.

### 8.5 Notification Preferences & Mandatory Alerts
- **Endpoints:** `GET /notifications/preferences`, `PUT /notifications/preferences`
- **Request Body (`PUT /notifications/preferences`):**
```json
{
  "emailEnabled": true,
  "smsEnabled": false,
  "pushEnabled": true,
  "timezone": "Asia/Kolkata",
  "quietHours": {
    "enabled": true,
    "startTime": "22:00",
    "endTime": "07:00",
    "allowUrgent": true
  },
  "categoryPreferences": {
    "academic": { "inApp": true, "email": true, "sms": false, "push": true }
  }
}
```
- **Mandatory Alert Rule:** Users cannot disable `inAppEnabled` globally or disable `emergency` / `security` category notifications.

### 8.6 Real-Time Socket.IO Authentication & Channel Isolation
- **Connection Handshake:** Clients connect to the HTTP server port with `{ auth: { token: "<JWT_ACCESS_TOKEN>" } }` or `Authorization: Bearer <JWT_ACCESS_TOKEN>`.
- **Session Verification:** `SocketService` validates the JWT signature and verifies the active `sessionId` against `User.refreshTokens`.
- **User Isolation:** Each authenticated socket joins `user:<userId>` exclusively. Attempts to subscribe to another user's channel via `subscribe:channel` are rejected.
- **Server-to-Client Events:**
  - `connected`: `{ userId, channel, timestamp }`
  - `notification:new`: Emitted in real time when a notification is created for the user.
  - `notification:read`: `{ notificationId, readAt }`
  - `notification:read_all`: `{ modifiedCount, readAt }`
  - `notifications:synced`: Emitted in response to client `notifications:sync` upon reconnection.

---

## 9. Doubt Management & Parent Communication (Phase 10)

### 9.1 Student Doubt Creation & Auto-Assignment
- **Endpoint:** `POST /doubts`
- **Access:** Student (Self), Admin
- **Request Body:**
```json
{
  "title": "Clarification on AVL Tree Double Rotations",
  "description": "When inserting a node into the right subtree of the left child, how are balance factors updated after LR rotation?",
  "subject": "66d0a123456789abcdef0105",
  "category": "conceptual",
  "priority": "high",
  "tags": ["avl-tree", "rotations", "data-structures"]
}
```
- **Response (201 Created):**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Doubt submitted successfully",
  "data": {
    "_id": "672681002a1708848d799fb1",
    "title": "Clarification on AVL Tree Double Rotations",
    "student": "66d0a123456789abcdef0201",
    "subject": { "_id": "66d0a123456789abcdef0105", "name": "Data Structures", "code": "CS301" },
    "section": { "_id": "66d0a123456789abcdef0104", "name": "A" },
    "assignedTeacher": { "_id": "66d0a123456789abcdef0301", "employeeId": "EMP-CS-01" },
    "category": "conceptual",
    "priority": "high",
    "status": "assigned"
  }
}
```

### 9.2 Doubt Conversation & Staff Internal Notes
- **Endpoint:** `POST /doubts/:id/messages`
- **Access:** Student (Own doubt, `isInternalNote` forbidden), Assigned Teacher, Admin
- **Request Body:**
```json
{
  "message": "Here is the step-by-step derivation of balance factors after LR rotation.",
  "isInternalNote": false,
  "markAsStatus": "answered"
}
```
- **Privacy Guarantee:** Messages with `isInternalNote: true` can only be created by Teachers/Admins and are strictly filtered out of all Student and Parent responses (`GET /doubts/:id` and `GET /doubts/:id/messages`).

### 9.3 Doubt Analytics (Admin Only)
- **Endpoints:**
  - `GET /doubts/analytics/overview`
  - `GET /doubts/analytics/subjects`
  - `GET /doubts/analytics/teachers`
- **Response (`GET /doubts/analytics/overview`):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Doubt overview analytics retrieved successfully",
  "data": {
    "totalDoubts": 24,
    "openDoubts": 3,
    "pendingDoubts": 7,
    "answeredDoubts": 6,
    "resolvedDoubts": 10,
    "closedDoubts": 1,
    "overdueDoubts": 1,
    "averageResponseTimeMinutes": 42.5,
    "averageResolutionTimeHours": 5.2,
    "frequentlyRaisedTopics": [
      { "topic": "avl-tree", "count": 6 },
      { "topic": "dynamic-programming", "count": 4 }
    ]
  }
}
```

### 9.4 Parent Management & Student Linking
- **Endpoints:**
  - `POST /parents` (Admin)
  - `GET /parents` (Admin, Teacher)
  - `GET /parents/:id` (Admin, Teacher, Self Parent)
  - `PUT /parents/:id` (Admin)
  - `POST /parents/:id/link-student` (Admin)
  - `DELETE /parents/:id/unlink-student/:studentId` (Admin)
- **Request Body (`POST /parents/:id/link-student`):**
```json
{
  "studentId": "66d0a123456789abcdef0201",
  "relationshipType": "father",
  "isPrimaryGuardian": true,
  "reason": "Verified during semester registration"
}
```

### 9.5 Parent Academic Portal APIs
- **Endpoints:**
  - `GET /parents/me/children`
  - `GET /parents/me/children/:studentId/overview`
  - `GET /parents/me/children/:studentId/attendance`
  - `GET /parents/me/children/:studentId/assignments`
  - `GET /parents/me/children/:studentId/results`
  - `GET /parents/me/children/:studentId/progress`
  - `GET /parents/me/children/:studentId/timetable`
- **Security & Confidentiality Rules:**
  - Parents can only access data for students actively linked in their `Parent.students` list. Attempts to query unlinked student IDs return `403 Forbidden`.
  - Unpublished examination results (`evaluationStatus !== 'published'` or `examination.status !== 'published'`) and draft assignments (`status === 'draft'`) are strictly excluded.

### 9.6 Parent-Teacher Communication & Meeting Requests
- **Endpoints:**
  - `POST /parent-communications`
  - `GET /parent-communications`
  - `GET /parent-communications/:id`
  - `POST /parent-communications/:id/messages`
  - `GET /parent-communications/:id/messages`
  - `PATCH /parent-communications/:id/close`
  - `POST /parent-communications/meeting-requests`
- **Request Body (`POST /parent-communications/meeting-requests`):**
```json
{
  "student": "66d0a123456789abcdef0201",
  "teacher": "66d0a123456789abcdef0301",
  "subject": "Discussion on Mid-Semester Performance",
  "message": "Requesting a 15-minute meeting to discuss upcoming IA preparation.",
  "priority": "normal",
  "meetingRequest": {
    "requestedDate": "2026-11-10T10:30:00.000Z",
    "preferredSlot": "10:30 AM - 10:45 AM",
    "mode": "in_person",
    "agenda": "Review IA-2 study plan and attendance",
    "locationOrLink": "Department Cabin 204"
  }
}
```

---

## 10. Leave, Substitution & Teacher Management (Phase 11)

### 10.1 Teacher Profile & Directory APIs
- **Endpoints:**
  - `GET /teachers` (Search & filter by `search`, `department`, `designation`, `specialization`, `employmentCategory`, `status`, `isActive`)
  - `POST /teachers` (Admin — create teacher profile linked to User)
  - `GET /teachers/me` (Teacher — own profile & summary)
  - `GET /teachers/:id` (Admin, Self Teacher)
  - `PATCH /teachers/:id` (Admin — full update & activate/deactivate; Teacher — personal bio/contact update)
  - `GET /teachers/:id/classes` (Assigned subjects, sections, and classTeacher sections)
  - `GET /teachers/:id/timetable` (Weekly or date-specific schedule with non-destructive substitution overrides)
  - `GET /teachers/:id/workload` (Weekly periods, hours, utilization percentage, substitutions, and leave days)
  - `GET /teachers/:id/leave-history` (Paginated leave history & summary)
  - `GET /teachers/:id/substitutions` (Paginated substitution history & summary)

### 10.2 Leave Policies, Balances & Leave Requests
- **Endpoints:**
  - `GET /leaves/policies`
  - `POST /leaves/policies` (Admin)
  - `PATCH /leaves/policies/:id` (Admin)
  - `GET /leaves/balances`
  - `POST /leave-requests`
  - `GET /leave-requests`
  - `GET /leave-requests/:id`
  - `PATCH /leave-requests/:id/approve` (Admin — blocks self-approval)
  - `PATCH /leave-requests/:id/reject` (Admin — blocks self-review)
  - `PATCH /leave-requests/:id/cancel` (Teacher/Admin — cascade-cancels linked substitutions)

### 10.3 Teacher Substitution Management
- **Endpoints:**
  - `POST /substitutions`
  - `GET /substitutions`
  - `GET /substitutions/available-teachers`
  - `GET /substitutions/conflicts`
  - `GET /substitutions/:id`
  - `PATCH /substitutions/:id/approve` (Admin)
  - `PATCH /substitutions/:id/reject` (Admin)
  - `PATCH /substitutions/:id/complete` (Substitute Teacher / Admin)
  - `PATCH /substitutions/:id/cancel` (Admin / Absent Teacher)

### 10.4 Teacher Workload & Institutional Summary Analytics
- **Endpoints:**
  - `GET /analytics/teacher-workload`
  - `GET /analytics/department-workload`
  - `GET /analytics/leave-summary`
  - `GET /analytics/substitution-summary`

