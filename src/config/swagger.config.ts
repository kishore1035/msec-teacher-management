import swaggerJsdoc from 'swagger-jsdoc';

export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'MSEC Teacher Management Dashboard & Academic ERP API (Complete Production Release — Phases 1–12)',
      version: '1.0.0',
      description:
        'Enterprise Educational ERP Backend REST API.\n\n' +
        '**Default Seeded Demo Credentials (Development Mode):**\n' +
        '- **Admin:** `admin@msec.ac.in` / `AdminPassword123`\n' +
        '- **Teacher:** `prof.sharma@msec.ac.in` / `TeacherPassword123`\n' +
        '- **Student:** `student@msec.ac.in` / `StudentPassword123`\n' +
        '- **Parent:** `parent@msec.ac.in` / `ParentPassword123`\n\n' +
        'Use `POST /auth/login` below to obtain an `accessToken`, then click **Authorize** and paste the token.',
    },
    servers: [
      {
        url: '/api/v1',
        description: 'API v1 Gateway',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', example: 'admin@msec.ac.in' },
            password: { type: 'string', example: 'AdminPassword123' },
          },
        },
        CreateAnnouncementRequest: {
          type: 'object',
          required: ['title', 'content'],
          properties: {
            title: { type: 'string', example: 'Semester End Examination Notice' },
            content: {
              type: 'string',
              example: 'All 5th Semester examinations begin next Monday at 9:30 AM.',
            },
            summary: { type: 'string', example: '5th Sem Exam Schedule' },
            announcementType: {
              type: 'string',
              enum: [
                'general',
                'academic',
                'examination',
                'attendance',
                'assignment',
                'timetable',
                'event',
                'emergency',
                'other',
              ],
              example: 'examination',
            },
            priority: {
              type: 'string',
              enum: ['low', 'normal', 'high', 'urgent'],
              example: 'high',
            },
            targetAudience: {
              type: 'string',
              enum: ['all', 'teachers', 'students', 'parents', 'administrators', 'selected'],
              example: 'all',
            },
            status: {
              type: 'string',
              enum: ['draft', 'scheduled', 'published', 'archived'],
              example: 'published',
            },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    paths: {
      '/health': {
        get: {
          tags: ['System Health'],
          summary: 'Service health check endpoint',
          security: [],
          responses: { '200': { description: 'Server is healthy' } },
        },
      },
      '/health/live': {
        get: {
          tags: ['System Health'],
          summary: 'Liveness probe verifying Node.js application process and memory metrics',
          security: [],
          responses: { '200': { description: 'Process is alive' } },
        },
      },
      '/health/ready': {
        get: {
          tags: ['System Health'],
          summary: 'Readiness probe verifying MongoDB, file storage, and AI provider readiness',
          security: [],
          responses: {
            '200': { description: 'Dependencies are ready' },
            '503': { description: 'One or more dependencies are unavailable' },
          },
        },
      },
      '/auth/login': {
        post: {
          tags: ['Phase 1: Authentication'],
          summary: 'Authenticate user and issue JWT access & refresh tokens',
          security: [],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LoginRequest' },
              },
            },
          },
          responses: { '200': { description: 'Login successful with tokens' } },
        },
      },
      '/auth/refresh': {
        post: {
          tags: ['Phase 1: Authentication'],
          summary: 'Rotate refresh token and issue new access/refresh token pair',
          security: [],
          responses: { '200': { description: 'Token pair rotated' } },
        },
      },
      '/auth/logout': {
        post: {
          tags: ['Phase 1: Authentication'],
          summary: 'Invalidate current device session',
          responses: { '200': { description: 'Logged out of current session' } },
        },
      },
      '/auth/logout-all': {
        post: {
          tags: ['Phase 1: Authentication'],
          summary: 'Invalidate all active sessions across devices',
          responses: { '200': { description: 'All sessions invalidated' } },
        },
      },
      '/auth/sessions': {
        get: {
          tags: ['Phase 1: Authentication'],
          summary: 'List active sessions for current user',
          responses: { '200': { description: 'Active device sessions' } },
        },
      },
      '/auth/me': {
        get: {
          tags: ['Phase 1: Authentication'],
          summary: 'Get current authenticated user profile',
          responses: { '200': { description: 'Current user profile' } },
        },
      },
      '/academics/years': {
        get: {
          tags: ['Phase 2: Academic Core'],
          summary: 'List academic years',
          responses: { '200': { description: 'Academic years list' } },
        },
      },
      '/departments': {
        get: {
          tags: ['Phase 2: Academic Core'],
          summary: 'List departments',
          responses: { '200': { description: 'Departments list' } },
        },
      },
      '/classes': {
        get: {
          tags: ['Phase 2: Academic Core'],
          summary: 'List classes',
          responses: { '200': { description: 'Classes list' } },
        },
      },
      '/sections': {
        get: {
          tags: ['Phase 2: Academic Core'],
          summary: 'List sections',
          responses: { '200': { description: 'Sections list' } },
        },
      },
      '/subjects': {
        get: {
          tags: ['Phase 2: Academic Core'],
          summary: 'List subjects',
          responses: { '200': { description: 'Subjects list' } },
        },
      },
      '/attendance/policy': {
        get: {
          tags: ['Phase 3: Attendance'],
          summary: 'Get active institutional attendance policy',
          responses: { '200': { description: 'Active attendance policy' } },
        },
      },
      '/attendance/shortages': {
        get: {
          tags: ['Phase 3: Attendance'],
          summary: 'Detect attendance shortages across sections',
          responses: { '200': { description: 'Attendance shortage report' } },
        },
      },
      '/assignments': {
        get: {
          tags: ['Phase 4: Assignments'],
          summary: 'List assignments',
          responses: { '200': { description: 'Paginated assignments' } },
        },
      },
      '/examinations': {
        get: {
          tags: ['Phase 5: Examinations & Results'],
          summary: 'List examinations',
          responses: { '200': { description: 'Examinations list' } },
        },
      },
      '/progress/at-risk': {
        get: {
          tags: ['Phase 6: Student Progress & Analytics'],
          summary: 'List at-risk students with explainable risk indicators',
          responses: { '200': { description: 'At-risk students' } },
        },
      },
      '/study-materials': {
        get: {
          tags: ['Phase 7: Study Materials'],
          summary: 'List study materials',
          responses: { '200': { description: 'Study materials list' } },
        },
      },
      '/timetables': {
        get: {
          tags: ['Phase 8: Timetables'],
          summary: 'List timetables',
          responses: { '200': { description: 'Timetables list' } },
        },
      },
      '/announcements': {
        get: {
          tags: ['Phase 9: Announcements'],
          summary: 'List announcements visible to the authenticated user',
          responses: { '200': { description: 'Paginated list of announcements' } },
        },
        post: {
          tags: ['Phase 9: Announcements'],
          summary: 'Create a new announcement (draft, scheduled, or immediately published)',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateAnnouncementRequest' },
              },
            },
          },
          responses: { '201': { description: 'Announcement created' } },
        },
      },
      '/announcements/{id}': {
        get: {
          tags: ['Phase 9: Announcements'],
          summary: 'Get announcement details by ID',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Announcement details' } },
        },
        put: {
          tags: ['Phase 9: Announcements'],
          summary: 'Update an announcement and record edit history',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Announcement updated' } },
        },
        delete: {
          tags: ['Phase 9: Announcements'],
          summary: 'Delete draft announcement or archive published announcement',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Announcement deleted or archived' } },
        },
      },
      '/announcements/{id}/publish': {
        patch: {
          tags: ['Phase 9: Announcements'],
          summary: 'Publish announcement, snapshot resolved recipients, and generate notifications',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Announcement published' } },
        },
      },
      '/announcements/{id}/archive': {
        patch: {
          tags: ['Phase 9: Announcements'],
          summary: 'Archive announcement',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Announcement archived' } },
        },
      },
      '/announcements/{id}/analytics': {
        get: {
          tags: ['Phase 9: Announcements'],
          summary: 'Get readership and delivery analytics for an announcement',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Announcement readership metrics' } },
        },
      },
      '/announcements/analytics/overview': {
        get: {
          tags: ['Phase 9: Announcements'],
          summary: 'Get aggregate announcement & readership analytics overview',
          responses: { '200': { description: 'Overview analytics' } },
        },
      },
      '/notifications': {
        get: {
          tags: ['Phase 9: Notifications'],
          summary: 'List active notifications for the authenticated user',
          responses: { '200': { description: 'Paginated user notifications' } },
        },
      },
      '/notifications/unread-count': {
        get: {
          tags: ['Phase 9: Notifications'],
          summary: 'Get unread notification count for the authenticated user',
          responses: { '200': { description: 'Unread notification count' } },
        },
      },
      '/notifications/history': {
        get: {
          tags: ['Phase 9: Notifications'],
          summary: 'Get full notification history filtered by category, status, and date range',
          responses: { '200': { description: 'Paginated notification history' } },
        },
      },
      '/notifications/{id}': {
        get: {
          tags: ['Phase 9: Notifications'],
          summary: 'Get single notification by ID (recipient-only)',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Notification details' } },
        },
      },
      '/notifications/{id}/read': {
        patch: {
          tags: ['Phase 9: Notifications'],
          summary: 'Mark a single notification as read',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Notification marked as read' } },
        },
      },
      '/notifications/read-all': {
        patch: {
          tags: ['Phase 9: Notifications'],
          summary: 'Mark all unread notifications as read',
          responses: { '200': { description: 'All notifications marked as read' } },
        },
      },
      '/notifications/preferences': {
        get: {
          tags: ['Phase 9: Notification Preferences'],
          summary: 'Get current user notification preferences',
          responses: { '200': { description: 'User notification preferences' } },
        },
        put: {
          tags: ['Phase 9: Notification Preferences'],
          summary: 'Update current user notification preferences, quiet hours, and timezone',
          responses: { '200': { description: 'Updated notification preferences' } },
        },
      },
      '/notifications/devices': {
        post: {
          tags: ['Phase 9: Notification Delivery'],
          summary: 'Register a push notification device token',
          responses: { '201': { description: 'Device registered' } },
        },
      },
      '/notifications/delivery-status': {
        get: {
          tags: ['Phase 9: Notification Delivery'],
          summary: 'Get notification delivery status breakdown and channel logs',
          responses: { '200': { description: 'Delivery status breakdown' } },
        },
      },
      '/doubts': {
        post: {
          tags: ['Phase 10: Student Doubts'],
          summary: 'Create a student doubt (auto-assigns teacher based on subject/section)',
          responses: { '201': { description: 'Doubt submitted successfully' } },
        },
        get: {
          tags: ['Phase 10: Student Doubts'],
          summary: 'List doubts (Students see own; Teachers see assigned subject/section; Admins see all)',
          responses: { '200': { description: 'Paginated doubts list' } },
        },
      },
      '/doubts/{id}': {
        get: {
          tags: ['Phase 10: Student Doubts'],
          summary: 'Get doubt details and conversation thread (internal notes filtered for students)',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Doubt and message history' } },
        },
        put: {
          tags: ['Phase 10: Student Doubts'],
          summary: 'Update doubt details',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Updated doubt' } },
        },
      },
      '/doubts/{id}/assign': {
        patch: {
          tags: ['Phase 10: Student Doubts'],
          summary: 'Assign or reassign a doubt to an authorized teacher',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Doubt assigned successfully' } },
        },
      },
      '/doubts/{id}/status': {
        patch: {
          tags: ['Phase 10: Student Doubts'],
          summary: 'Update doubt status (open, assigned, in_progress, answered, resolved, closed)',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Doubt status updated' } },
        },
      },
      '/doubts/{id}/reopen': {
        patch: {
          tags: ['Phase 10: Student Doubts'],
          summary: 'Reopen an answered or resolved doubt within the reopening window',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Doubt reopened' } },
        },
      },
      '/doubts/{id}/messages': {
        post: {
          tags: ['Phase 10: Doubt Conversation'],
          summary: 'Add a reply or internal staff note to a doubt thread',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '201': { description: 'Message added' } },
        },
        get: {
          tags: ['Phase 10: Doubt Conversation'],
          summary: 'List doubt conversation messages (internal notes hidden from students/parents)',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Doubt messages' } },
        },
      },
      '/doubts/analytics/overview': {
        get: {
          tags: ['Phase 10: Doubt Analytics'],
          summary: 'Get doubt management overview analytics (Admin only)',
          responses: { '200': { description: 'Doubt overview analytics' } },
        },
      },
      '/doubts/analytics/subjects': {
        get: {
          tags: ['Phase 10: Doubt Analytics'],
          summary: 'Get subject-wise doubt analytics (Admin only)',
          responses: { '200': { description: 'Subject-wise doubt breakdown' } },
        },
      },
      '/doubts/analytics/teachers': {
        get: {
          tags: ['Phase 10: Doubt Analytics'],
          summary: 'Get teacher-wise doubt workload analytics (Admin only)',
          responses: { '200': { description: 'Teacher workload metrics' } },
        },
      },
      '/parents': {
        post: {
          tags: ['Phase 10: Parent Management'],
          summary: 'Create a parent/guardian profile (Admin only)',
          responses: { '201': { description: 'Parent profile created' } },
        },
        get: {
          tags: ['Phase 10: Parent Management'],
          summary: 'List parent profiles (Admin/Teacher)',
          responses: { '200': { description: 'Paginated parents list' } },
        },
      },
      '/parents/{id}': {
        get: {
          tags: ['Phase 10: Parent Management'],
          summary: 'Get parent profile by ID',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Parent profile details' } },
        },
        put: {
          tags: ['Phase 10: Parent Management'],
          summary: 'Update parent profile (Admin only)',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Updated parent profile' } },
        },
      },
      '/parents/{id}/link-student': {
        post: {
          tags: ['Phase 10: Parent Management'],
          summary: 'Link a student to a parent profile with relationship audit history (Admin only)',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Student linked to parent' } },
        },
      },
      '/parents/{id}/unlink-student/{studentId}': {
        delete: {
          tags: ['Phase 10: Parent Management'],
          summary: 'Unlink a student from a parent profile (Admin only)',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'studentId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'Student unlinked from parent' } },
        },
      },
      '/parents/me/children': {
        get: {
          tags: ['Phase 10: Parent Academic Portal'],
          summary: 'Get all linked children for the authenticated parent',
          responses: { '200': { description: 'Linked children list' } },
        },
      },
      '/parents/me/children/{studentId}/overview': {
        get: {
          tags: ['Phase 10: Parent Academic Portal'],
          summary: 'Get child academic overview, profile, and published announcements',
          parameters: [{ name: 'studentId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Child academic overview' } },
        },
      },
      '/parents/me/children/{studentId}/attendance': {
        get: {
          tags: ['Phase 10: Parent Academic Portal'],
          summary: 'Get child attendance summary and shortage warnings',
          parameters: [{ name: 'studentId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Child attendance report' } },
        },
      },
      '/parents/me/children/{studentId}/assignments': {
        get: {
          tags: ['Phase 10: Parent Academic Portal'],
          summary: 'Get child published assignments and submission status',
          parameters: [{ name: 'studentId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Child assignments and submissions' } },
        },
      },
      '/parents/me/children/{studentId}/results': {
        get: {
          tags: ['Phase 10: Parent Academic Portal'],
          summary: 'Get child published examination results (unpublished results strictly hidden)',
          parameters: [{ name: 'studentId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Child published results' } },
        },
      },
      '/parents/me/children/{studentId}/progress': {
        get: {
          tags: ['Phase 10: Parent Academic Portal'],
          summary: 'Get child academic progress and risk indicators',
          parameters: [{ name: 'studentId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Child academic progress' } },
        },
      },
      '/parents/me/children/{studentId}/timetable': {
        get: {
          tags: ['Phase 10: Parent Academic Portal'],
          summary: 'Get child published section timetable',
          parameters: [{ name: 'studentId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Child published timetable' } },
        },
      },
      '/parent-communications': {
        post: {
          tags: ['Phase 10: Parent-Teacher Communication'],
          summary: 'Create a parent-teacher communication thread for a linked student',
          responses: { '201': { description: 'Communication thread created' } },
        },
        get: {
          tags: ['Phase 10: Parent-Teacher Communication'],
          summary: 'List parent-teacher communication threads scoped to the authenticated user',
          responses: { '200': { description: 'Paginated communication threads' } },
        },
      },
      '/parent-communications/meeting-requests': {
        post: {
          tags: ['Phase 10: Parent-Teacher Communication'],
          summary: 'Create a parent-teacher meeting request (in_person, online, phone)',
          responses: { '201': { description: 'Meeting request created' } },
        },
      },
      '/parent-communications/{id}': {
        get: {
          tags: ['Phase 10: Parent-Teacher Communication'],
          summary: 'Get communication thread details and message history',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Communication thread details' } },
        },
      },
      '/parent-communications/{id}/messages': {
        post: {
          tags: ['Phase 10: Parent-Teacher Communication'],
          summary: 'Send a message in a parent-teacher communication thread',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '201': { description: 'Message sent' } },
        },
        get: {
          tags: ['Phase 10: Parent-Teacher Communication'],
          summary: 'Get all messages in a parent-teacher communication thread',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Thread messages' } },
        },
      },
      '/parent-communications/{id}/close': {
        patch: {
          tags: ['Phase 10: Parent-Teacher Communication'],
          summary: 'Close or resolve a parent-teacher communication thread',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Thread closed' } },
        },
      },
      '/teachers': {
        get: {
          tags: ['Phase 11: Teacher Management'],
          summary: 'Search and filter teacher profiles',
          responses: { '200': { description: 'Paginated teacher profiles' } },
        },
        post: {
          tags: ['Phase 11: Teacher Management'],
          summary: 'Create a new teacher profile linked to an existing User account',
          responses: { '201': { description: 'Teacher profile created' } },
        },
      },
      '/teachers/me': {
        get: {
          tags: ['Phase 11: Teacher Management'],
          summary: 'Get authenticated teacher profile and assignment summary',
          responses: { '200': { description: 'Authenticated teacher profile' } },
        },
      },
      '/teachers/{id}': {
        get: {
          tags: ['Phase 11: Teacher Management'],
          summary: 'Get teacher profile details by ID',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Teacher profile details' } },
        },
        patch: {
          tags: ['Phase 11: Teacher Management'],
          summary: 'Update teacher profile or activate/deactivate teacher status',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Teacher profile updated' } },
        },
      },
      '/teachers/{id}/classes': {
        get: {
          tags: ['Phase 11: Teacher Management'],
          summary: 'View teacher assigned classes, sections, and subjects',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Teacher assigned classes and subjects' } },
        },
      },
      '/teachers/{id}/timetable': {
        get: {
          tags: ['Phase 11: Teacher Management'],
          summary: 'View teacher timetable with date-aware substitution overrides',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Teacher timetable' } },
        },
      },
      '/teachers/{id}/workload': {
        get: {
          tags: ['Phase 11: Teacher Management'],
          summary: 'View teacher weekly workload, teaching hours, and substitution summary',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Teacher workload summary' } },
        },
      },
      '/teachers/{id}/leave-history': {
        get: {
          tags: ['Phase 11: Teacher Management'],
          summary: 'View teacher leave request history and summary',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Teacher leave history' } },
        },
      },
      '/teachers/{id}/substitutions': {
        get: {
          tags: ['Phase 11: Teacher Management'],
          summary: 'View teacher substitution history (as substitute and when absent)',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Teacher substitution history' } },
        },
      },
      '/leave-requests': {
        post: {
          tags: ['Phase 11: Leave Management'],
          summary: 'Submit a full-day or partial-day/half-day leave request with automatic timetable impact resolution',
          responses: { '201': { description: 'Leave request submitted' } },
        },
        get: {
          tags: ['Phase 11: Leave Management'],
          summary: 'List leave requests with filters',
          responses: { '200': { description: 'Paginated leave requests' } },
        },
      },
      '/leave-requests/{id}': {
        get: {
          tags: ['Phase 11: Leave Management'],
          summary: 'Get leave request details including affected timetable entries and approval history',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Leave request details' } },
        },
      },
      '/leave-requests/{id}/approve': {
        patch: {
          tags: ['Phase 11: Leave Management'],
          summary: 'Approve a pending leave request (blocks self-approval)',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Leave request approved' } },
        },
      },
      '/leave-requests/{id}/reject': {
        patch: {
          tags: ['Phase 11: Leave Management'],
          summary: 'Reject a pending leave request with review comments',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Leave request rejected' } },
        },
      },
      '/leave-requests/{id}/cancel': {
        patch: {
          tags: ['Phase 11: Leave Management'],
          summary: 'Cancel a leave request and cascade-cancel linked active substitutions',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Leave request cancelled' } },
        },
      },
      '/leaves/policies': {
        get: {
          tags: ['Phase 11: Leave Management'],
          summary: 'List configurable institutional leave policies',
          responses: { '200': { description: 'Leave policies list' } },
        },
        post: {
          tags: ['Phase 11: Leave Management'],
          summary: 'Create a configurable leave policy',
          responses: { '201': { description: 'Leave policy created' } },
        },
      },
      '/leaves/policies/{id}': {
        patch: {
          tags: ['Phase 11: Leave Management'],
          summary: 'Update an institutional leave policy',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Leave policy updated' } },
        },
      },
      '/leaves/balances': {
        get: {
          tags: ['Phase 11: Leave Management'],
          summary: 'Get teacher dynamic leave balances evaluated against active policy',
          responses: { '200': { description: 'Teacher leave balances' } },
        },
      },
      '/substitutions': {
        post: {
          tags: ['Phase 11: Substitutions'],
          summary: 'Assign or propose a teacher substitution with conflict detection',
          responses: { '201': { description: 'Substitution created' } },
        },
        get: {
          tags: ['Phase 11: Substitutions'],
          summary: 'List teacher substitutions with filters',
          responses: { '200': { description: 'Paginated substitutions' } },
        },
      },
      '/substitutions/available-teachers': {
        get: {
          tags: ['Phase 11: Substitutions'],
          summary: 'Find and rank available substitute teachers for a timetable slot',
          responses: { '200': { description: 'Ranked available substitute teachers' } },
        },
      },
      '/substitutions/conflicts': {
        get: {
          tags: ['Phase 11: Substitutions'],
          summary: 'Check substitution conflicts for a candidate substitute teacher and slot',
          responses: { '200': { description: 'Conflict check result' } },
        },
      },
      '/substitutions/{id}': {
        get: {
          tags: ['Phase 11: Substitutions'],
          summary: 'Get substitution details by ID',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Substitution details' } },
        },
      },
      '/substitutions/{id}/approve': {
        patch: {
          tags: ['Phase 11: Substitutions'],
          summary: 'Approve a proposed substitution and synchronize TimetableChange override',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Substitution approved' } },
        },
      },
      '/substitutions/{id}/reject': {
        patch: {
          tags: ['Phase 11: Substitutions'],
          summary: 'Reject a proposed substitution',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Substitution rejected' } },
        },
      },
      '/substitutions/{id}/complete': {
        patch: {
          tags: ['Phase 11: Substitutions'],
          summary: 'Mark an approved substitution as completed with topics covered',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Substitution completed' } },
        },
      },
      '/substitutions/{id}/cancel': {
        patch: {
          tags: ['Phase 11: Substitutions'],
          summary: 'Cancel a substitution and revert TimetableChange override',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Substitution cancelled' } },
        },
      },
      '/analytics/teacher-workload': {
        get: {
          tags: ['Phase 11: Workload Analytics'],
          summary: 'Get teacher-wise teaching hours, periods, leave usage, and substitution workload analytics',
          responses: { '200': { description: 'Teacher workload analytics' } },
        },
      },
      '/analytics/department-workload': {
        get: {
          tags: ['Phase 11: Workload Analytics'],
          summary: 'Get department-wise teaching hours and workload distribution analytics',
          responses: { '200': { description: 'Department workload analytics' } },
        },
      },
      '/analytics/leave-summary': {
        get: {
          tags: ['Phase 11: Workload Analytics'],
          summary: 'Get institutional leave usage summary by status and leave type',
          responses: { '200': { description: 'Leave summary analytics' } },
        },
      },
      '/analytics/substitution-summary': {
        get: {
          tags: ['Phase 11: Workload Analytics'],
          summary: 'Get institutional substitution summary and top substitute teachers',
          responses: { '200': { description: 'Substitution summary analytics' } },
        },
      },
      '/ai/lesson-plan': {
        post: {
          tags: ['Phase 12: AI Teaching Assistant'],
          summary: 'Generate an AI draft lesson plan for an assigned subject/section',
          responses: { '201': { description: 'AI lesson plan draft generated' } },
        },
      },
      '/ai/quiz': {
        post: {
          tags: ['Phase 12: AI Teaching Assistant'],
          summary: 'Generate an AI draft quiz with answer key',
          responses: { '201': { description: 'AI quiz draft generated' } },
        },
      },
      '/ai/question-paper': {
        post: {
          tags: ['Phase 12: AI Teaching Assistant'],
          summary: 'Generate an AI draft examination question paper with marking scheme',
          responses: { '201': { description: 'AI question paper draft generated' } },
        },
      },
      '/ai/assignment': {
        post: {
          tags: ['Phase 12: AI Teaching Assistant'],
          summary: 'Generate an AI draft assignment problem set',
          responses: { '201': { description: 'AI assignment draft generated' } },
        },
      },
      '/ai/topic-explanation': {
        post: {
          tags: ['Phase 12: AI Teaching Assistant'],
          summary: 'Generate an AI draft topic explanation with worked examples',
          responses: { '201': { description: 'AI topic explanation draft generated' } },
        },
      },
      '/ai/rubric': {
        post: {
          tags: ['Phase 12: AI Teaching Assistant'],
          summary: 'Generate an AI evaluation rubric matrix',
          responses: { '201': { description: 'AI rubric draft generated' } },
        },
      },
      '/ai/study-material-summary': {
        post: {
          tags: ['Phase 12: AI Teaching Assistant'],
          summary: 'Generate an AI summary of authorized study materials with prompt-injection & PII protection',
          responses: { '201': { description: 'AI study material summary draft generated' } },
        },
      },
      '/ai/content': {
        get: {
          tags: ['Phase 12: AI Teaching Assistant'],
          summary: 'List AI-generated drafts and reviewed content',
          responses: { '200': { description: 'Paginated AI-generated content list' } },
        },
      },
      '/ai/content/{id}': {
        get: {
          tags: ['Phase 12: AI Teaching Assistant'],
          summary: 'Get AI-generated content details and revision history',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'AI content details' } },
        },
        patch: {
          tags: ['Phase 12: AI Teaching Assistant'],
          summary: 'Edit AI-generated content while preserving original generatedOutput in revisionHistory',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'AI content updated' } },
        },
        delete: {
          tags: ['Phase 12: AI Teaching Assistant'],
          summary: 'Delete an AI-generated content draft',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'AI content deleted' } },
        },
      },
      '/ai/content/{id}/approve': {
        post: {
          tags: ['Phase 12: AI Teaching Assistant'],
          summary: 'Approve AI-generated content and optionally convert to StudyMaterial or Assignment',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'AI content approved' } },
        },
      },
      '/ai/content/{id}/reject': {
        post: {
          tags: ['Phase 12: AI Teaching Assistant'],
          summary: 'Reject AI-generated content with review comments',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'AI content rejected' } },
        },
      },
      '/ai/usage': {
        get: {
          tags: ['Phase 12: AI Teaching Assistant'],
          summary: 'Get current user AI usage summary and remaining quota',
          responses: { '200': { description: 'User AI usage summary' } },
        },
      },
      '/ai/usage/analytics': {
        get: {
          tags: ['Phase 12: AI Teaching Assistant'],
          summary: 'Get institution-wide AI usage analytics (Admin)',
          responses: { '200': { description: 'Institution AI usage analytics' } },
        },
      },
      '/dashboard/admin': {
        get: {
          tags: ['Phase 12: Role Dashboards'],
          summary: 'Get aggregated Administrator Dashboard overview',
          responses: { '200': { description: 'Admin dashboard data' } },
        },
      },
      '/dashboard/teacher': {
        get: {
          tags: ['Phase 12: Role Dashboards'],
          summary: 'Get aggregated Teacher Dashboard overview',
          responses: { '200': { description: 'Teacher dashboard data' } },
        },
      },
      '/dashboard/student': {
        get: {
          tags: ['Phase 12: Role Dashboards'],
          summary: 'Get aggregated Student Dashboard overview (strictly hiding unpublished exam results)',
          responses: { '200': { description: 'Student dashboard data' } },
        },
      },
      '/dashboard/parent': {
        get: {
          tags: ['Phase 12: Role Dashboards'],
          summary: 'Get aggregated Parent Dashboard overview for verified linked children',
          responses: { '200': { description: 'Parent dashboard data' } },
        },
      },
      '/analytics/overview': {
        get: {
          tags: ['Phase 12: Centralized Analytics & Reports'],
          summary: 'Get cross-module academic analytics overview',
          responses: { '200': { description: 'Academic analytics overview' } },
        },
      },
      '/analytics/attendance': {
        get: {
          tags: ['Phase 12: Centralized Analytics & Reports'],
          summary: 'Get centralized attendance analytics and shortage list',
          responses: { '200': { description: 'Attendance analytics' } },
        },
      },
      '/analytics/assignments': {
        get: {
          tags: ['Phase 12: Centralized Analytics & Reports'],
          summary: 'Get centralized assignment completion and evaluation analytics',
          responses: { '200': { description: 'Assignments analytics' } },
        },
      },
      '/analytics/examinations': {
        get: {
          tags: ['Phase 12: Centralized Analytics & Reports'],
          summary: 'Get centralized examination results, grade distribution, and topper/low-performer analysis',
          responses: { '200': { description: 'Examinations analytics' } },
        },
      },
      '/analytics/student-progress': {
        get: {
          tags: ['Phase 12: Centralized Analytics & Reports'],
          summary: 'Get centralized student progress and at-risk student analytics',
          responses: { '200': { description: 'Student progress analytics' } },
        },
      },
      '/reports/generate': {
        post: {
          tags: ['Phase 12: Centralized Analytics & Reports'],
          summary: 'Generate an academic report job exported as PDF, Excel (.xlsx), or CSV',
          responses: { '201': { description: 'Report generated' } },
        },
      },
      '/reports': {
        get: {
          tags: ['Phase 12: Centralized Analytics & Reports'],
          summary: 'List generated report jobs',
          responses: { '200': { description: 'Paginated report jobs' } },
        },
      },
      '/reports/{id}': {
        get: {
          tags: ['Phase 12: Centralized Analytics & Reports'],
          summary: 'Get report job details',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Report job details' } },
        },
        delete: {
          tags: ['Phase 12: Centralized Analytics & Reports'],
          summary: 'Delete report job and remove exported file from storage',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Report job deleted' } },
        },
      },
      '/reports/{id}/status': {
        get: {
          tags: ['Phase 12: Centralized Analytics & Reports'],
          summary: 'Get report job processing status and expiry state',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Report job status' } },
        },
      },
      '/reports/{id}/download': {
        get: {
          tags: ['Phase 12: Centralized Analytics & Reports'],
          summary: 'Download exported report file (PDF, Excel, or CSV)',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Binary report stream' } },
        },
      },
    },
  },
  apis: [],
});


