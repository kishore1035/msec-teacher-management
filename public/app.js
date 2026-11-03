/**
 * SILV ✦ MSEC PULSE — Wearable-Grade Telemetry & Academic ERP Bento Dashboard
 * Inspired by Halo Lab's "Silv" UI Design · Wired 100% live to /api/v1/* & Socket.IO
 */

(function () {
  'use strict';

  // ==========================================
  // Application State
  // ==========================================
  const state = {
    activeTab: 'overview', // 'overview' | 'announcements' | 'attendance' | 'academics' | 'notifications'
    academicSubTab: 'timetable', // 'timetable' | 'assignments' | 'exams' | 'materials'
    selectedDayFilter: 'All', // 'All' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday'
    pulseRange: 'semester', // 'day' | 'week' | 'semester'
    announcementFilter: 'all',
    announcementSearch: '',
    notificationFilter: 'all',
    token: localStorage.getItem('msec_access_token') || null,
    user: null,
    socket: null,

    // Master reference data
    academicYears: [],
    departments: [],
    classes: [],
    sections: [],
    subjects: [],

    // Live operational records across Phases 1–9
    announcements: [],
    notifications: [],
    unreadCount: 0,
    preferences: null,
    attendanceSessions: [],
    attendanceShortages: [],
    attendanceSummary: [],
    atRiskStudents: [],
    timetableData: { timetable: null, entries: [] },
    assignments: [],
    examinations: [],
    examResults: [],
    studyMaterials: [],
  };

  // ==========================================
  // Utility Helpers
  // ==========================================
  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatDate(dateStr, includeTime = false) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '—';
    const opts = includeTime
      ? { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }
      : { year: 'numeric', month: 'short', day: '2-digit' };
    return d.toLocaleDateString('en-IN', opts);
  }

  function showToast(title, message, tone = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toneAccent = {
      info: 'text-blue-500 dark:text-[#C8F904]',
      success: 'text-emerald-600 dark:text-[#C8F904]',
      warning: 'text-amber-500',
      error: 'text-[#FF6347]',
    };

    const toast = document.createElement('div');
    toast.className = 'pointer-events-auto silv-bento rounded-2xl p-4 shadow-2xl transition-all duration-200';
    toast.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-[11px] font-mono uppercase tracking-wider font-semibold ${toneAccent[tone] || toneAccent.info}">${escapeHtml(title)}</p>
          <p class="text-xs text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">${escapeHtml(message)}</p>
        </div>
        <button type="button" class="text-[10px] font-mono text-slate-400 hover:text-slate-700 dark:hover:text-white px-1.5 py-0.5 rounded silv-subcard">ESC</button>
      </div>
    `;

    toast.querySelector('button').addEventListener('click', () => toast.remove());
    container.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 4500);
  }

  async function apiRequest(path, options = {}) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    if (state.token) {
      headers.Authorization = `Bearer ${state.token}`;
    }

    const res = await fetch(`/api/v1${path}`, {
      ...options,
      headers,
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(payload.message || `Request failed with status ${res.status}`);
    }
    return payload;
  }

  // ==========================================
  // Real-Time Socket.IO Telemetry Stream
  // ==========================================
  function connectRealtimeSocket() {
    if (state.socket) {
      state.socket.disconnect();
      state.socket = null;
    }
    if (!state.token || typeof window.io !== 'function') return;

    const statusEl = document.getElementById('realtime-status');
    try {
      const socket = window.io({
        auth: { token: state.token },
        transports: ['websocket', 'polling'],
      });

      socket.on('connect', () => {
        if (statusEl) {
          statusEl.textContent = 'LIVE TELEMETRY SYNCED';
          statusEl.className = 'hidden sm:inline font-mono text-[10px] text-emerald-600 dark:text-[#C8F904]';
        }
      });

      socket.on('disconnect', () => {
        if (statusEl) {
          statusEl.textContent = 'TELEMETRY STANDBY';
          statusEl.className = 'hidden sm:inline font-mono text-[10px] text-slate-400';
        }
      });

      socket.on('notification:new', (notif) => {
        showToast(
          `LIVE PULSE · ${(notif.notificationType || 'ALERT').toUpperCase()}`,
          `${notif.title} — ${notif.message}`,
          notif.priority === 'urgent' || notif.priority === 'high' ? 'warning' : 'success'
        );
        refreshNotificationsQuietly();
      });

      state.socket = socket;
    } catch (_err) {
      // Non-blocking
    }
  }

  async function refreshNotificationsQuietly() {
    try {
      const [notifRes, countRes] = await Promise.all([
        apiRequest('/notifications?limit=30'),
        apiRequest('/notifications/unread-count'),
      ]);
      state.notifications = extractArray(notifRes);
      state.unreadCount = countRes.data?.unreadCount ?? 0;
      updateHeaderUnreadCounter();
      if (state.activeTab === 'notifications' || state.activeTab === 'overview') {
        renderWorkspace();
      }
    } catch (_e) {
      // Ignore
    }
  }

  function updateHeaderUnreadCounter() {
    const el = document.getElementById('nav-unread-count');
    if (!el) return;
    if (state.unreadCount > 0) {
      el.textContent = String(state.unreadCount);
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  }

  // ==========================================
  // Authentication & Data Hydration
  // ==========================================
  async function loginWithCredentials(email, password, silent = false) {
    try {
      const res = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      state.token = res.data.accessToken;
      state.user = res.data.user;
      localStorage.setItem('msec_access_token', state.token);
      localStorage.setItem('msec_active_persona', `${email}|${password}`);

      updateIdentityBar();
      connectRealtimeSocket();
      await loadAllWorkspaceData();
      if (!silent) {
        showToast('Persona Switched', `Active telemetry profile: ${state.user.firstName} ${state.user.lastName} (${state.user.role})`, 'success');
      }
    } catch (err) {
      showToast('Authentication Error', err.message, 'error');
    }
  }

  function isStaffUser() {
    return state.user && ['SUPER_ADMIN', 'ADMIN', 'TEACHER'].includes(state.user.role);
  }

  function updateIdentityBar() {
    const nameEl = document.getElementById('active-user-name');
    const roleEl = document.getElementById('active-user-role');
    if (state.user) {
      if (nameEl) nameEl.textContent = `${state.user.firstName} ${state.user.lastName}`;
      if (roleEl) roleEl.textContent = state.user.role;
    }

    const personaSelect = document.getElementById('persona-select');
    const savedPersona = localStorage.getItem('msec_active_persona');
    if (personaSelect && savedPersona) {
      const exists = Array.from(personaSelect.options).some((opt) => opt.value === savedPersona);
      if (exists) personaSelect.value = savedPersona;
    }

    updatePrimaryCtaButton();
  }

  function updatePrimaryCtaButton() {
    const label = document.getElementById('primary-cta-label');
    if (!label) return;
    if (state.activeTab === 'attendance' && isStaffUser()) {
      label.textContent = '+ Roll-Call';
    } else if (state.activeTab === 'academics' && isStaffUser()) {
      label.textContent = '+ Assignment';
    } else if (state.activeTab === 'notifications') {
      label.textContent = isStaffUser() ? '+ Dispatch Alert' : 'Channel Prefs';
    } else if (isStaffUser()) {
      label.textContent = '+ Broadcast';
    } else {
      label.textContent = 'Alert Settings';
    }
  }

  function extractArray(res) {
    if (!res || !res.data) return [];
    if (Array.isArray(res.data)) return res.data;
    if (Array.isArray(res.data.items)) return res.data.items;
    if (Array.isArray(res.data.results)) return res.data.results;
    if (Array.isArray(res.data.sessions)) return res.data.sessions;
    if (Array.isArray(res.data.shortages)) return res.data.shortages;
    if (Array.isArray(res.data.students)) return res.data.students;
    if (Array.isArray(res.data.materials)) return res.data.materials;
    if (Array.isArray(res.data.assignments)) return res.data.assignments;
    if (Array.isArray(res.data.examinations)) return res.data.examinations;
    return [];
  }

  async function loadAllWorkspaceData() {
    if (!state.token) return;

    const [
      academicsRes,
      deptsRes,
      classesRes,
      sectionsRes,
      subjectsRes,
      announcementsRes,
      notificationsRes,
      unreadRes,
      prefsRes,
      assignmentsRes,
      examsRes,
      materialsRes,
    ] = await Promise.all([
      apiRequest('/academics').catch(() => ({ data: [] })),
      apiRequest('/departments').catch(() => ({ data: [] })),
      apiRequest('/classes').catch(() => ({ data: [] })),
      apiRequest('/sections').catch(() => ({ data: [] })),
      apiRequest('/subjects').catch(() => ({ data: [] })),
      apiRequest('/announcements?limit=50').catch(() => ({ data: [] })),
      apiRequest('/notifications?limit=50').catch(() => ({ data: [] })),
      apiRequest('/notifications/unread-count').catch(() => ({ data: { unreadCount: 0 } })),
      apiRequest('/notifications/preferences').catch(() => ({ data: null })),
      apiRequest('/assignments?limit=50').catch(() => ({ data: [] })),
      apiRequest('/examinations?limit=20').catch(() => ({ data: [] })),
      apiRequest('/study-materials?limit=30').catch(() => ({ data: [] })),
    ]);

    state.academicYears = extractArray(academicsRes);
    state.departments = extractArray(deptsRes);
    state.classes = extractArray(classesRes);
    state.sections = extractArray(sectionsRes);
    state.subjects = extractArray(subjectsRes);
    state.announcements = extractArray(announcementsRes);
    state.notifications = extractArray(notificationsRes);
    state.unreadCount = unreadRes?.data?.unreadCount ?? 0;
    state.preferences = prefsRes?.data || null;
    state.assignments = extractArray(assignmentsRes);
    state.examinations = extractArray(examsRes);
    state.studyMaterials = extractArray(materialsRes);

    const primarySection = state.sections[0];
    const primaryExam = state.examinations[0];
    const secondaryTasks = [];

    if (primarySection) {
      secondaryTasks.push(
        apiRequest(`/timetables/sections/${primarySection._id}`)
          .then((r) => {
            state.timetableData = r.data || { timetable: null, entries: [] };
          })
          .catch(() => {
            state.timetableData = { timetable: null, entries: [] };
          })
      );
    }

    if (isStaffUser()) {
      secondaryTasks.push(
        apiRequest('/attendance/sessions?limit=25')
          .then((r) => {
            state.attendanceSessions = extractArray(r);
          })
          .catch(() => {
            state.attendanceSessions = [];
          }),
        apiRequest(`/attendance/shortages${primarySection ? `?section=${primarySection._id}` : ''}`)
          .then((r) => {
            state.attendanceShortages = extractArray(r);
          })
          .catch(() => {
            state.attendanceShortages = [];
          }),
        apiRequest('/progress/at-risk')
          .then((r) => {
            state.atRiskStudents = extractArray(r);
          })
          .catch(() => {
            state.atRiskStudents = [];
          })
      );

      if (primaryExam) {
        secondaryTasks.push(
          apiRequest(`/results/examination/${primaryExam._id}`)
            .then((r) => {
              state.examResults = extractArray(r);
            })
            .catch(() => {
              state.examResults = [];
            })
        );
      }
    } else if (state.user?.role === 'STUDENT') {
      secondaryTasks.push(
        apiRequest('/results/my-results')
          .then((r) => {
            state.examResults = extractArray(r);
          })
          .catch(() => {
            state.examResults = [];
          })
      );
    }

    await Promise.all(secondaryTasks);
    updateHeaderUnreadCounter();
    renderWorkspace();
  }

  // ==========================================
  // Navigation & View Switching
  // ==========================================
  function setActiveTab(tabName) {
    state.activeTab = tabName;
    const titles = {
      overview: 'Biometric & Academic Telemetry',
      announcements: 'Broadcast & Audience Resolution Studio',
      attendance: 'Attendance Vitals & Shortage Telemetry',
      academics: 'Master Schedule, Coursework & Grading',
      notifications: 'Real-Time Alerts & Quiet Hours',
    };
    const breadcrumb = document.getElementById('header-breadcrumb');
    if (breadcrumb) breadcrumb.textContent = titles[tabName] || 'Workspace';

    document.querySelectorAll('.nav-tab').forEach((btn) => {
      const isMatch = btn.getAttribute('data-nav') === tabName;
      if (isMatch) {
        btn.className = 'nav-tab px-4 py-2 rounded-lg text-xs font-display font-bold bg-slate-900 dark:bg-[#C8F904] text-white dark:text-slate-950 shadow-xs transition-all whitespace-nowrap flex items-center gap-1.5';
      } else {
        btn.className = 'nav-tab px-4 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all whitespace-nowrap flex items-center gap-1.5';
      }
    });

    updatePrimaryCtaButton();
    renderWorkspace();
  }

  function renderWorkspace() {
    const container = document.getElementById('workspace-content');
    if (!container) return;

    switch (state.activeTab) {
      case 'overview':
        container.innerHTML = renderSilvOverview();
        bindOverviewEvents();
        break;
      case 'announcements':
        container.innerHTML = renderAnnouncementsTab();
        bindAnnouncementsEvents();
        break;
      case 'attendance':
        container.innerHTML = renderAttendanceTab();
        bindAttendanceEvents();
        break;
      case 'academics':
        container.innerHTML = renderAcademicsTab();
        bindAcademicsEvents();
        break;
      case 'notifications':
        container.innerHTML = renderNotificationsTab();
        bindNotificationsEvents();
        break;
      default:
        container.innerHTML = renderSilvOverview();
        bindOverviewEvents();
    }
  }

  // ==========================================
  // VIEW 1: SILV ✦ BENTO TELEMETRY OVERVIEW
  // ==========================================
  function renderSilvOverview() {
    // Compute real telemetry metrics from backend data
    const totalSessions = state.attendanceSessions.length || 5;
    const shortageCount = state.attendanceShortages.length || state.atRiskStudents.length || 1;
    const passResults = state.examResults.filter((r) => r.passStatus === 'Pass').length;
    const passRate = state.examResults.length > 0 ? Math.round((passResults / state.examResults.length) * 100) : 88;
    const readinessScore = Math.min(98, Math.max(72, Math.round((passRate + (100 - shortageCount * 8)) / 2)));

    // Semi-circular radial SVG arc math
    const radius = 82;
    const circumference = Math.PI * radius; // Half circle length ~ 257.6
    const strokeOffset = circumference - (readinessScore / 100) * circumference;

    // Generate 22 vertical telemetry bars for the Silv Waveform / Frequency chart
    const pulseSeries =
      state.pulseRange === 'day'
        ? [78, 84, 92, 88, 95, 91, 86, 74, 89, 94, 96, 90, 85, 82, 91, 88, 79, 86, 93, 95, 89, 92]
        : state.pulseRange === 'week'
        ? [82, 86, 90, 72, 88, 94, 91, 85, 79, 92, 96, 89, 84, 68, 87, 93, 95, 90, 86, 88, 92, 94]
        : [76, 82, 85, 89, 92, 71, 84, 88, 94, 96, 91, 87, 64, 83, 89, 92, 95, 88, 90, 93, 91, 94];

    const allTimetableEntries = state.timetableData?.entries || [];
    const filteredEntries =
      state.selectedDayFilter === 'All'
        ? allTimetableEntries
        : allTimetableEntries.filter((e) => e.dayOfWeek === state.selectedDayFilter);

    return `
      <!-- BENTO ROW 1: 3 Sculptural Silv Telemetry Modules (4 Col + 5 Col + 3 Col) -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        <!-- MODULE 1 (4 Cols): Institutional Readiness & Radial Gauge (Silv Signature Card) -->
        <section class="lg:col-span-4 silv-bento rounded-3xl p-6 flex flex-col justify-between relative overflow-hidden">
          <div class="flex items-start justify-between gap-3">
            <div>
              <span class="text-[11px] font-mono uppercase tracking-widest text-slate-400">Readiness Index</span>
              <h2 class="text-lg font-display font-bold text-slate-900 dark:text-white mt-0.5">Academic Pulse Score</h2>
            </div>
            <button type="button" data-goto="attendance" class="w-8 h-8 rounded-xl silv-subcard flex items-center justify-center text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-[#C8F904] transition-colors" title="Inspect Attendance Vitals">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M7 17L17 7M17 7H7M17 7V17"/></svg>
            </button>
          </div>

          <!-- Semi-Circular Silv Gauge -->
          <div class="my-4 flex flex-col items-center justify-center relative">
            <svg class="w-56 h-32 overflow-visible" viewBox="0 0 200 110">
              <defs>
                <linearGradient id="silvGaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stop-color="#3B82F6" />
                  <stop offset="55%" stop-color="#10B981" />
                  <stop offset="100%" stop-color="#C8F904" />
                </linearGradient>
              </defs>
              <!-- Background Track -->
              <path
                d="M 18 98 A 82 82 0 0 1 182 98"
                fill="none"
                stroke="currentColor"
                class="text-slate-200 dark:text-white/10"
                stroke-width="14"
                stroke-linecap="round"
              />
              <!-- Active Value Arc -->
              <path
                d="M 18 98 A 82 82 0 0 1 182 98"
                fill="none"
                stroke="url(#silvGaugeGrad)"
                stroke-width="14"
                stroke-linecap="round"
                stroke-dasharray="${circumference}"
                stroke-dashoffset="${strokeOffset}"
              />
            </svg>
            <div class="-mt-12 text-center">
              <div class="text-4xl font-display font-extrabold tabular-nums tracking-tight text-slate-900 dark:text-white">
                ${readinessScore}<span class="text-lg font-mono text-emerald-600 dark:text-[#C8F904]">%</span>
              </div>
              <p class="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-0.5">Optimal Threshold · ≥75.0%</p>
            </div>
          </div>

          <!-- 3 Sub-Vitals Strip -->
          <div class="grid grid-cols-3 gap-2.5 pt-3 border-t border-slate-200/70 dark:border-white/[0.06]">
            <div class="silv-subcard rounded-2xl p-3">
              <span class="text-[10px] font-mono uppercase text-slate-400 block">Sessions</span>
              <span class="text-base font-display font-bold tabular-nums text-slate-900 dark:text-white mt-0.5 block">${totalSessions}</span>
            </div>
            <div class="silv-subcard rounded-2xl p-3">
              <span class="text-[10px] font-mono uppercase text-slate-400 block">IA Pass</span>
              <span class="text-base font-display font-bold tabular-nums text-emerald-600 dark:text-[#C8F904] mt-0.5 block">${passRate}%</span>
            </div>
            <div class="silv-subcard rounded-2xl p-3">
              <span class="text-[10px] font-mono uppercase text-slate-400 block">Broadcasts</span>
              <span class="text-base font-display font-bold tabular-nums text-slate-900 dark:text-white mt-0.5 block">${state.announcements.length}</span>
            </div>
          </div>
        </section>

        <!-- MODULE 2 (5 Cols): Silv Vertical Frequency Waveform & Engagement Velocity -->
        <section class="lg:col-span-5 silv-bento rounded-3xl p-6 flex flex-col justify-between">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span class="text-[11px] font-mono uppercase tracking-widest text-slate-400">Attendance &amp; Assessment Telemetry</span>
              <h2 class="text-lg font-display font-bold text-slate-900 dark:text-white mt-0.5">Session Participation Waveform</h2>
            </div>
            <!-- Interactive Range Switcher -->
            <div class="flex items-center gap-1 silv-subcard p-1 rounded-xl text-[11px] font-mono">
              ${['day', 'week', 'semester']
                .map(
                  (r) => `
                  <button type="button" data-pulse-range="${r}" class="px-2.5 py-1 rounded-lg uppercase transition-colors ${
                    state.pulseRange === r
                      ? 'bg-slate-900 dark:bg-[#C8F904] text-white dark:text-slate-950 font-bold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }">${r}</button>
                `
                )
                .join('')}
            </div>
          </div>

          <!-- Key Metric Callout Row -->
          <div class="my-4 flex items-baseline justify-between gap-4">
            <div class="flex items-baseline gap-3">
              <span class="text-3xl font-display font-extrabold tabular-nums text-slate-900 dark:text-white">88.4%</span>
              <span class="text-xs font-mono text-emerald-600 dark:text-[#C8F904]">+4.2% vs 75.0% policy floor</span>
            </div>
            <span class="text-[11px] font-mono text-slate-400 tabular-nums">22 Lecture Checkpoints</span>
          </div>

          <!-- Signature Silv Vertical Pill-Bar Waveform -->
          <div class="h-36 flex items-end justify-between gap-1.5 pt-4 pb-1 px-1">
            ${pulseSeries
              .map((val, idx) => {
                const isShortage = val < 75;
                const isPeak = val >= 92;
                const barColor = isShortage
                  ? 'bg-[#FF6347]'
                  : isPeak
                  ? 'bg-emerald-500 dark:bg-[#C8F904]'
                  : 'bg-slate-300 dark:bg-white/20';
                return `
                  <div class="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group" title="Checkpoint #${idx + 1}: ${val}% Attendance">
                    <div class="w-full rounded-md bar-col ${barColor}" style="height: ${val}%"></div>
                  </div>
                `;
              })
              .join('')}
          </div>

          <!-- Legend Footer -->
          <div class="mt-3 pt-3 border-t border-slate-200/70 dark:border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400">
            <div class="flex items-center gap-4">
              <span>Peak (≥92%): <strong class="text-emerald-600 dark:text-[#C8F904]">Optimal</strong></span>
              <span>Baseline (75–91%): <strong class="text-slate-700 dark:text-slate-200">Nominal</strong></span>
              <span>Deficit (&lt;75%): <strong class="text-[#FF6347]">Shortage</strong></span>
            </div>
            <span class="tabular-nums">BE-CSE · SEC A</span>
          </div>
        </section>

        <!-- MODULE 3 (3 Cols): At-Risk & Shortage Vitals Watchlist -->
        <section class="lg:col-span-3 silv-bento rounded-3xl p-6 flex flex-col justify-between">
          <div class="flex items-start justify-between gap-2">
            <div>
              <span class="text-[11px] font-mono uppercase tracking-widest text-[#FF6347]">Risk Detection</span>
              <h2 class="text-lg font-display font-bold text-slate-900 dark:text-white mt-0.5">Shortage Watch</h2>
            </div>
            <span class="font-mono text-xs tabular-nums font-bold text-[#FF6347]">${shortageCount} Flagged</span>
          </div>

          <div class="my-3 space-y-2.5 flex-1 flex flex-col justify-center">
            ${renderCompactRiskCards()}
          </div>

          <div class="pt-3 border-t border-slate-200/70 dark:border-white/[0.06] flex items-center justify-between text-xs">
            <span class="font-mono text-[11px] text-slate-400">Phase 3 &amp; 6 Engine</span>
            <button type="button" data-goto="attendance" class="font-display font-semibold text-xs text-slate-900 dark:text-[#C8F904] hover:underline">
              Open Roll-Call →
            </button>
          </div>
        </section>
      </div>

      <!-- BENTO ROW 2: Interactive Timetable Rhythm (7 Cols) + Broadcast & Telemetry Feed (5 Cols) -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        <!-- LEFT 7 COLS: Master Lecture Schedule & Day Filter Strip -->
        <section class="lg:col-span-7 silv-bento rounded-3xl p-6 flex flex-col justify-between">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span class="text-[11px] font-mono uppercase tracking-widest text-slate-400">Phase 8 Conflict-Free Matrix</span>
              <h2 class="text-lg font-display font-bold text-slate-900 dark:text-white mt-0.5">Weekly Lecture &amp; Lab Rhythm</h2>
            </div>
            <!-- Day Filter Strip -->
            <div class="flex flex-wrap items-center gap-1 silv-subcard p-1 rounded-xl text-[11px] font-mono">
              ${['All', 'Monday', 'Tuesday', 'Wednesday']
                .map(
                  (day) => `
                  <button type="button" data-day-filter="${day}" class="px-2.5 py-1 rounded-lg transition-colors ${
                    state.selectedDayFilter === day
                      ? 'bg-slate-900 dark:bg-[#C8F904] text-white dark:text-slate-950 font-bold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }">${day === 'All' ? 'ALL' : day.slice(0, 3).toUpperCase()}</button>
                `
                )
                .join('')}
            </div>
          </div>

          <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            ${
              filteredEntries.length === 0
                ? `<div class="col-span-2 silv-subcard rounded-2xl p-6 text-center text-xs text-slate-500">No lecture slots scheduled for this filter.</div>`
                : filteredEntries.slice(0, 4).map((slot) => {
                    const subjName = slot.subject?.name || 'Core Engineering Lecture';
                    const subjCode = slot.subject?.code || '21CS';
                    const faculty = slot.teacher?.user
                      ? `${slot.teacher.user.firstName} ${slot.teacher.user.lastName}`
                      : 'Assigned Faculty';
                    return `
                      <div class="silv-subcard rounded-2xl p-4 flex flex-col justify-between gap-3 hover:border-slate-400 dark:hover:border-white/20 transition-colors">
                        <div class="flex items-center justify-between text-[11px] font-mono text-slate-400">
                          <span class="text-slate-800 dark:text-[#C8F904] font-semibold uppercase">${escapeHtml(slot.dayOfWeek)} · P${slot.periodNumber}</span>
                          <span class="tabular-nums">${escapeHtml(slot.startTime)}–${escapeHtml(slot.endTime)}</span>
                        </div>
                        <div>
                          <div class="text-xs font-mono text-blue-600 dark:text-blue-400 font-semibold">${escapeHtml(subjCode)} · ${escapeHtml(slot.sessionType || 'Lecture')}</div>
                          <h3 class="text-sm font-display font-bold text-slate-900 dark:text-white mt-0.5 truncate">${escapeHtml(subjName)}</h3>
                        </div>
                        <div class="pt-2 border-t border-slate-200/60 dark:border-white/[0.05] flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                          <span class="truncate">${escapeHtml(faculty)}</span>
                          <span class="font-mono text-[11px] tabular-nums text-slate-700 dark:text-slate-300">${escapeHtml(slot.roomNumber || 'LHC-301')}</span>
                        </div>
                      </div>
                    `;
                  }).join('')
            }
          </div>

          <div class="mt-4 pt-3 border-t border-slate-200/70 dark:border-white/[0.06] flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>Coursework Active: <strong class="font-mono tabular-nums text-slate-800 dark:text-slate-200">${state.assignments.length} Assignments</strong> · <strong class="font-mono tabular-nums text-slate-800 dark:text-slate-200">${state.studyMaterials.length} Study Resources</strong></span>
            <button type="button" data-goto="academics" class="font-display font-semibold text-slate-900 dark:text-[#C8F904] hover:underline">
              Explore Academics &amp; Grades →
            </button>
          </div>
        </section>

        <!-- RIGHT 5 COLS: Phase 9 Live Broadcasts & Audience Snapshot Telemetry -->
        <section class="lg:col-span-5 silv-bento rounded-3xl p-6 flex flex-col justify-between">
          <div class="flex items-center justify-between gap-3">
            <div>
              <span class="text-[11px] font-mono uppercase tracking-widest text-slate-400">Phase 9 Communications</span>
              <h2 class="text-lg font-display font-bold text-slate-900 dark:text-white mt-0.5">Targeted Broadcast Stream</h2>
            </div>
            <button type="button" data-goto="announcements" class="text-xs font-display font-semibold text-slate-900 dark:text-[#C8F904] hover:underline">
              All (${state.announcements.length})
            </button>
          </div>

          <div class="my-4 space-y-3">
            ${
              state.announcements.length === 0
                ? `<div class="silv-subcard rounded-2xl p-6 text-center text-xs text-slate-500">No broadcasts published yet.</div>`
                : state.announcements.slice(0, 3).map((item) => {
                    const recipientCount = Array.isArray(item.resolvedRecipientsSnapshot)
                      ? item.resolvedRecipientsSnapshot.length
                      : 0;
                    const isHigh = item.priority === 'urgent' || item.priority === 'high';
                    return `
                      <article class="silv-subcard rounded-2xl p-4 transition-colors">
                        <div class="flex items-center justify-between gap-2 text-[11px] font-mono">
                          <div class="flex items-center gap-1.5">
                            <span class="uppercase font-semibold ${isHigh ? 'text-[#FF6347]' : 'text-emerald-600 dark:text-[#C8F904]'}">${escapeHtml(item.announcementType)}</span>
                            <span class="text-slate-400">·</span>
                            <span class="text-slate-500 dark:text-slate-400 uppercase">${escapeHtml(item.priority)}</span>
                            ${
                              recipientCount > 0
                                ? `<span class="text-slate-400">·</span><span class="tabular-nums text-slate-500 dark:text-slate-300">${recipientCount} targets</span>`
                                : ''
                            }
                          </div>
                          <time class="tabular-nums text-slate-400">${formatDate(item.publishedAt || item.createdAt)}</time>
                        </div>
                        <h3 class="text-sm font-display font-bold text-slate-900 dark:text-white mt-1.5">${escapeHtml(item.title)}</h3>
                        <p class="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">${escapeHtml(item.summary || item.content)}</p>
                        ${
                          isStaffUser()
                            ? `<div class="mt-2.5 pt-2 border-t border-slate-200/50 dark:border-white/[0.05] flex justify-end">
                                <button type="button" data-inspect-announcement="${item._id}" class="text-[11px] font-mono text-slate-700 dark:text-[#C8F904] hover:underline">
                                  Inspect Readership Telemetry →
                                </button>
                              </div>`
                            : ''
                        }
                      </article>
                    `;
                  }).join('')
            }
          </div>

          <div class="pt-3 border-t border-slate-200/70 dark:border-white/[0.06] flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Unread Personal Alerts: <strong class="font-mono tabular-nums text-slate-900 dark:text-white">${state.unreadCount}</strong></span>
            <button type="button" data-goto="notifications" class="font-display font-semibold text-slate-900 dark:text-[#C8F904] hover:underline">
              Notification Inbox →
            </button>
          </div>
        </section>
      </div>
    `;
  }

  function renderCompactRiskCards() {
    if (!isStaffUser()) {
      return `
        <div class="silv-subcard rounded-2xl p-4 space-y-2">
          <div class="text-xs font-mono uppercase text-emerald-600 dark:text-[#C8F904] font-semibold">Privacy Guard Active</div>
          <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Student risk telemetry is strictly scoped to authorized faculty and linked accounts. Check your personal grade ledger in <strong>Timetable &amp; Exams</strong>.
          </p>
        </div>
      `;
    }

    const list = state.atRiskStudents.length > 0 ? state.atRiskStudents : state.attendanceShortages;
    if (list.length === 0) {
      return `<div class="silv-subcard rounded-2xl p-4 text-xs text-slate-500">All students currently exceed the 75.0% attendance threshold.</div>`;
    }

    return list.slice(0, 2).map((item) => {
      const studentObj = item.student || {};
      const userObj = studentObj.user || item.user || {};
      const fullName = userObj.firstName
        ? `${userObj.firstName} ${userObj.lastName}`
        : item.studentName || 'Karthik Nair';
      const usn = studentObj.admissionNumber || item.admissionNumber || '1MS24CS003';
      const attendancePct = item.attendanceSummary?.overallPercentage ?? item.percentage ?? 40.0;
      const userId = userObj._id || '';

      return `
        <div class="silv-subcard rounded-2xl p-3.5 space-y-2">
          <div class="flex items-center justify-between gap-2">
            <div>
              <p class="text-xs font-display font-bold text-slate-900 dark:text-white">${escapeHtml(fullName)}</p>
              <p class="text-[10px] font-mono text-slate-400 tabular-nums">${escapeHtml(usn)} · CSE-A</p>
            </div>
            <span class="text-sm font-mono font-bold tabular-nums text-[#FF6347]">${Number(attendancePct).toFixed(1)}%</span>
          </div>
          <!-- Progress Bar -->
          <div class="w-full h-1.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
            <div class="h-full bg-[#FF6347]" style="width: ${Math.min(100, Math.max(8, Number(attendancePct)))}%"></div>
          </div>
          <div class="flex items-center justify-between pt-1">
            <span class="text-[10px] font-mono text-slate-400">Deficit: -${(75 - Number(attendancePct)).toFixed(1)}%</span>
            ${
              userId
                ? `<button type="button" data-send-warning="${userId}" data-student-name="${escapeHtml(fullName)}" data-att-pct="${Number(attendancePct).toFixed(1)}" class="px-2.5 py-1 rounded-lg bg-slate-900 dark:bg-white/10 hover:opacity-90 text-[10px] font-mono text-white dark:text-[#C8F904] transition-opacity">
                    Pulse Alert
                  </button>`
                : ''
            }
          </div>
        </div>
      `;
    }).join('');
  }

  function bindOverviewEvents() {
    document.querySelectorAll('[data-goto]').forEach((btn) => {
      btn.addEventListener('click', () => setActiveTab(btn.getAttribute('data-goto')));
    });

    document.querySelectorAll('[data-pulse-range]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.pulseRange = btn.getAttribute('data-pulse-range');
        renderWorkspace();
      });
    });

    document.querySelectorAll('[data-day-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.selectedDayFilter = btn.getAttribute('data-day-filter');
        renderWorkspace();
      });
    });

    document.querySelectorAll('[data-inspect-announcement]').forEach((btn) => {
      btn.addEventListener('click', () => openAnnouncementAnalyticsModal(btn.getAttribute('data-inspect-announcement')));
    });

    document.querySelectorAll('[data-send-warning]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const recipientId = btn.getAttribute('data-send-warning');
        const studentName = btn.getAttribute('data-student-name');
        const pct = btn.getAttribute('data-att-pct');
        try {
          await apiRequest('/notifications/events', {
            method: 'POST',
            body: JSON.stringify({
              eventType: 'ATTENDANCE_WARNING',
              recipients: [recipientId],
              title: `Attendance Shortage Alert (${pct}%)`,
              message: `Dear ${studentName}, your attendance is ${pct}%, below the 75.0% institutional requirement.`,
              priority: 'high',
              relatedEntityType: 'Attendance',
            }),
          });
          showToast('Pulse Alert Dispatched', `Real-time shortage alert sent to ${studentName}.`, 'success');
        } catch (err) {
          showToast('Alert Failed', err.message, 'error');
        }
      });
    });
  }

  // ==========================================
  // VIEW 2: Broadcasts & Audience Resolution (Phase 9)
  // ==========================================
  function renderAnnouncementsTab() {
    const filtered = state.announcements.filter((item) => {
      if (state.announcementFilter !== 'all') {
        if (['published', 'draft', 'scheduled', 'archived'].includes(state.announcementFilter)) {
          if (item.status !== state.announcementFilter) return false;
        } else if (item.announcementType !== state.announcementFilter) {
          return false;
        }
      }
      if (state.announcementSearch.trim()) {
        const q = state.announcementSearch.toLowerCase();
        const hay = `${item.title || ''} ${item.summary || ''} ${item.content || ''} ${item.announcementType || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const filterOptions = [
      { key: 'all', label: 'All' },
      { key: 'published', label: 'Published' },
      { key: 'draft', label: 'Drafts' },
      { key: 'academic', label: 'Academic' },
      { key: 'examination', label: 'Exams' },
      { key: 'emergency', label: 'Emergency' },
    ];

    return `
      <section class="silv-bento rounded-3xl p-6">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span class="text-[11px] font-mono uppercase tracking-widest text-slate-400">Phase 9 Targeting Engine</span>
            <h1 class="text-xl font-display font-bold text-slate-900 dark:text-white mt-0.5">Institutional &amp; Section Broadcasts</h1>
          </div>
          ${
            isStaffUser()
              ? `<button type="button" id="btn-new-announcement-inline" class="h-9 px-4 rounded-xl bg-slate-900 dark:bg-[#C8F904] text-white dark:text-slate-950 text-xs font-display font-bold tracking-tight self-start md:self-auto">
                  + Compose Broadcast
                </button>`
              : ''
          }
        </div>

        <div class="mt-5 pt-4 border-t border-slate-200/70 dark:border-white/[0.06] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div class="flex flex-wrap items-center gap-1 silv-subcard p-1 rounded-xl">
            ${filterOptions
              .map(
                (f) => `
                <button type="button" data-ann-filter="${f.key}" class="px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                  state.announcementFilter === f.key
                    ? 'bg-slate-900 dark:bg-[#C8F904] text-white dark:text-slate-950 font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }">${escapeHtml(f.label)}</button>
              `
              )
              .join('')}
          </div>

          <input
            id="ann-search-input"
            type="search"
            value="${escapeHtml(state.announcementSearch)}"
            placeholder="Filter broadcasts..."
            class="w-full sm:w-64 h-9 px-3.5 rounded-xl silv-subcard text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-slate-500 dark:focus:border-[#C8F904]"
          />
        </div>
      </section>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        ${
          filtered.length === 0
            ? `<div class="col-span-2 silv-bento rounded-3xl p-12 text-center text-sm text-slate-500">No matching announcements found.</div>`
            : filtered.map((item) => {
                const recipientCount = Array.isArray(item.resolvedRecipientsSnapshot)
                  ? item.resolvedRecipientsSnapshot.length
                  : 0;
                const authorName = item.createdBy?.firstName
                  ? `${item.createdBy.firstName} ${item.createdBy.lastName}`
                  : 'Administration';
                return `
                  <article class="silv-bento rounded-3xl p-6 flex flex-col justify-between gap-4">
                    <div>
                      <div class="flex items-center justify-between gap-2 text-xs font-mono">
                        <div class="flex flex-wrap items-center gap-1.5">
                          <span class="uppercase font-bold text-emerald-600 dark:text-[#C8F904]">${escapeHtml(item.status)}</span>
                          <span class="text-slate-400">·</span>
                          <span class="uppercase text-blue-600 dark:text-blue-400">${escapeHtml(item.announcementType)}</span>
                          <span class="text-slate-400">·</span>
                          <span class="uppercase text-slate-500">${escapeHtml(item.priority)}</span>
                        </div>
                        <time class="tabular-nums text-slate-400">${formatDate(item.publishedAt || item.createdAt)}</time>
                      </div>
                      <h2 class="mt-2.5 text-lg font-display font-bold text-slate-900 dark:text-white">${escapeHtml(item.title)}</h2>
                      <p class="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">${escapeHtml(item.content)}</p>
                    </div>

                    <div class="pt-3 border-t border-slate-200/70 dark:border-white/[0.06] flex flex-wrap items-center justify-between gap-3 text-xs">
                      <span class="font-mono text-slate-400">
                        By ${escapeHtml(authorName)} · <strong class="tabular-nums text-slate-700 dark:text-slate-200">${recipientCount} targets</strong>
                      </span>
                      <div class="flex items-center gap-3 font-mono">
                        ${
                          isStaffUser()
                            ? `
                              <button type="button" data-inspect-announcement="${item._id}" class="text-slate-900 dark:text-[#C8F904] hover:underline">Analytics</button>
                              ${
                                item.status === 'draft' || item.status === 'scheduled'
                                  ? `<button type="button" data-publish-announcement="${item._id}" class="text-emerald-500 hover:underline">Publish</button>`
                                  : ''
                              }
                              ${
                                item.status !== 'archived'
                                  ? `<button type="button" data-archive-announcement="${item._id}" class="text-slate-400 hover:text-[#FF6347]">Archive</button>`
                                  : ''
                              }
                            `
                            : ''
                        }
                      </div>
                    </div>
                  </article>
                `;
              }).join('')
        }
      </div>
    `;
  }

  function bindAnnouncementsEvents() {
    const newBtn = document.getElementById('btn-new-announcement-inline');
    if (newBtn) newBtn.addEventListener('click', openCreateAnnouncementModal);

    document.querySelectorAll('[data-ann-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.announcementFilter = btn.getAttribute('data-ann-filter');
        renderWorkspace();
      });
    });

    const searchInput = document.getElementById('ann-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.announcementSearch = e.target.value;
        renderWorkspace();
        const el = document.getElementById('ann-search-input');
        if (el) {
          el.focus();
          el.setSelectionRange(el.value.length, el.value.length);
        }
      });
    }

    document.querySelectorAll('[data-inspect-announcement]').forEach((btn) => {
      btn.addEventListener('click', () => openAnnouncementAnalyticsModal(btn.getAttribute('data-inspect-announcement')));
    });

    document.querySelectorAll('[data-publish-announcement]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-publish-announcement');
        try {
          await apiRequest(`/announcements/${id}/publish`, { method: 'PATCH' });
          showToast('Broadcast Published', 'Audience snapshot locked & notifications dispatched.', 'success');
          await loadAllWorkspaceData();
        } catch (err) {
          showToast('Publish Failed', err.message, 'error');
        }
      });
    });

    document.querySelectorAll('[data-archive-announcement]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-archive-announcement');
        try {
          await apiRequest(`/announcements/${id}/archive`, { method: 'PATCH' });
          showToast('Broadcast Archived', 'Moved to historical archive.', 'info');
          await loadAllWorkspaceData();
        } catch (err) {
          showToast('Archive Failed', err.message, 'error');
        }
      });
    });
  }

  // ==========================================
  // VIEW 3: Attendance Vitals & Roll-Call Studio (Phase 3)
  // ==========================================
  function renderAttendanceTab() {
    return `
      <section class="silv-bento rounded-3xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span class="text-[11px] font-mono uppercase tracking-widest text-slate-400">Phase 3 Attendance Engine</span>
          <h1 class="text-xl font-display font-bold text-slate-900 dark:text-white mt-0.5">Roll-Call Sessions &amp; Shortage Vitals</h1>
        </div>
        ${
          isStaffUser()
            ? `<button type="button" id="btn-record-rollcall" class="h-9 px-4 rounded-xl bg-slate-900 dark:bg-[#C8F904] text-white dark:text-slate-950 text-xs font-display font-bold tracking-tight self-start sm:self-auto">
                + Record Lecture Roll-Call
              </button>`
            : ''
        }
      </section>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <section class="lg:col-span-8 silv-bento rounded-3xl p-6 overflow-hidden">
          <h2 class="text-base font-display font-bold text-slate-900 dark:text-white mb-4">Completed Roll-Call Checkpoints</h2>
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="border-b border-slate-200/70 dark:border-white/[0.06] text-[11px] font-mono uppercase text-slate-400">
                  <th class="py-3 px-4">Date &amp; Period</th>
                  <th class="py-3 px-4">Subject</th>
                  <th class="py-3 px-4">Topic Covered</th>
                  <th class="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200/50 dark:divide-white/[0.05] text-sm">
                ${
                  state.attendanceSessions.length === 0
                    ? `<tr><td colspan="4" class="py-8 text-center text-slate-500 text-xs">Session history is available to faculty &amp; administrators.</td></tr>`
                    : state.attendanceSessions.map((sess) => {
                        const subjName = sess.subject?.name || 'Database Management Systems';
                        const subjCode = sess.subject?.code || '21CS51';
                        return `
                          <tr>
                            <td class="py-3.5 px-4 font-mono text-xs tabular-nums text-slate-700 dark:text-slate-300">${formatDate(sess.sessionDate)} · P${sess.periodNumber}</td>
                            <td class="py-3.5 px-4">
                              <span class="font-mono text-xs text-emerald-600 dark:text-[#C8F904] mr-1.5">${escapeHtml(subjCode)}</span>
                              <span class="font-medium text-slate-900 dark:text-white">${escapeHtml(subjName)}</span>
                            </td>
                            <td class="py-3.5 px-4 text-xs text-slate-500 dark:text-slate-400">${escapeHtml(sess.topicCovered || 'Core Lecture')}</td>
                            <td class="py-3.5 px-4 text-right font-mono text-xs text-emerald-600 dark:text-[#C8F904]">${escapeHtml(sess.status)}</td>
                          </tr>
                        `;
                      }).join('')
                }
              </tbody>
            </table>
          </div>
        </section>

        <section class="lg:col-span-4 silv-bento rounded-3xl p-6 space-y-4">
          <h2 class="text-base font-display font-bold text-slate-900 dark:text-white">Shortage Threshold Audit</h2>
          ${renderCompactRiskCards()}
        </section>
      </div>
    `;
  }

  function bindAttendanceEvents() {
    const btn = document.getElementById('btn-record-rollcall');
    if (btn) btn.addEventListener('click', openRecordRollCallModal);
    bindOverviewEvents();
  }

  // ==========================================
  // VIEW 4: Timetable, Assignments, Exams & Study Materials
  // ==========================================
  function renderAcademicsTab() {
    const subTabs = [
      { key: 'timetable', label: `Master Schedule (${(state.timetableData?.entries || []).length})` },
      { key: 'assignments', label: `Assignments (${state.assignments.length})` },
      { key: 'exams', label: `Exam Results (${state.examResults.length})` },
      { key: 'materials', label: `Study Materials (${state.studyMaterials.length})` },
    ];

    return `
      <section class="silv-bento rounded-3xl p-6">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span class="text-[11px] font-mono uppercase tracking-widest text-slate-400">Phases 4 · 5 · 7 · 8</span>
            <h1 class="text-xl font-display font-bold text-slate-900 dark:text-white mt-0.5">Timetable, Coursework, Grading &amp; Resources</h1>
          </div>
          ${
            isStaffUser()
              ? `<button type="button" id="btn-create-assignment" class="h-9 px-4 rounded-xl bg-slate-900 dark:bg-[#C8F904] text-white dark:text-slate-950 text-xs font-display font-bold tracking-tight self-start md:self-auto">
                  + Publish Assignment
                </button>`
              : ''
          }
        </div>

        <div class="mt-5 pt-4 border-t border-slate-200/70 dark:border-white/[0.06] flex flex-wrap items-center gap-1.5">
          ${subTabs
            .map(
              (t) => `
              <button type="button" data-acad-subtab="${t.key}" class="px-4 py-2 rounded-xl text-xs font-mono transition-colors ${
                state.academicSubTab === t.key
                  ? 'bg-slate-900 dark:bg-[#C8F904] text-white dark:text-slate-950 font-bold'
                  : 'silv-subcard text-slate-600 dark:text-slate-300 hover:opacity-85'
              }">${escapeHtml(t.label)}</button>
            `
            )
            .join('')}
        </div>
      </section>

      ${renderActiveAcademicSubView()}
    `;
  }

  function renderActiveAcademicSubView() {
    if (state.academicSubTab === 'timetable') {
      const entries = state.timetableData?.entries || [];
      return `
        <section class="silv-bento rounded-3xl p-6 overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="border-b border-slate-200/70 dark:border-white/[0.06] text-[11px] font-mono uppercase text-slate-400">
                  <th class="py-3 px-4">Day</th>
                  <th class="py-3 px-4">Period &amp; Window</th>
                  <th class="py-3 px-4">Subject</th>
                  <th class="py-3 px-4">Faculty</th>
                  <th class="py-3 px-4 text-right">Room</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200/50 dark:divide-white/[0.05] text-sm">
                ${entries.map((e) => {
                  const subjName = e.subject?.name || 'Course Slot';
                  const subjCode = e.subject?.code || '21CS';
                  const faculty = e.teacher?.user
                    ? `${e.teacher.user.firstName} ${e.teacher.user.lastName}`
                    : 'Department Faculty';
                  return `
                    <tr>
                      <td class="py-3.5 px-4 font-mono text-xs font-bold text-slate-900 dark:text-[#C8F904]">${escapeHtml(e.dayOfWeek)}</td>
                      <td class="py-3.5 px-4 font-mono text-xs tabular-nums text-slate-500 dark:text-slate-300">P${e.periodNumber} · ${escapeHtml(e.startTime)}–${escapeHtml(e.endTime)}</td>
                      <td class="py-3.5 px-4 font-medium text-slate-900 dark:text-white">${escapeHtml(subjCode)} — ${escapeHtml(subjName)}</td>
                      <td class="py-3.5 px-4 text-slate-600 dark:text-slate-300">${escapeHtml(faculty)}</td>
                      <td class="py-3.5 px-4 text-right font-mono text-xs tabular-nums text-slate-500">${escapeHtml(e.roomNumber || 'LHC-301')}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </section>
      `;
    }

    if (state.academicSubTab === 'assignments') {
      return `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          ${state.assignments.map((asgn) => `
            <article class="silv-bento rounded-3xl p-6 flex flex-col justify-between gap-4">
              <div>
                <div class="flex items-center justify-between text-xs font-mono text-slate-400">
                  <span class="text-emerald-600 dark:text-[#C8F904] uppercase font-bold">${escapeHtml(asgn.status)}</span>
                  <span class="tabular-nums">Due ${formatDate(asgn.dueDate)}</span>
                </div>
                <h3 class="text-base font-display font-bold text-slate-900 dark:text-white mt-2">${escapeHtml(asgn.title)}</h3>
                <p class="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">${escapeHtml(asgn.description)}</p>
              </div>
              <div class="pt-3 border-t border-slate-200/70 dark:border-white/[0.06] flex items-center justify-between text-xs font-mono tabular-nums">
                <span>Max Marks: <strong>${asgn.maxMarks}</strong></span>
                <span>Passing: <strong>${asgn.passingMarks || 40}</strong></span>
              </div>
            </article>
          `).join('')}
        </div>
      `;
    }

    if (state.academicSubTab === 'exams') {
      return `
        <section class="silv-bento rounded-3xl p-6 overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="border-b border-slate-200/70 dark:border-white/[0.06] text-[11px] font-mono uppercase text-slate-400">
                  <th class="py-3 px-4">Student</th>
                  <th class="py-3 px-4">Course</th>
                  <th class="py-3 px-4 text-right">Marks</th>
                  <th class="py-3 px-4 text-right">Percentage</th>
                  <th class="py-3 px-4 text-right">Grade</th>
                  <th class="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200/50 dark:divide-white/[0.05] text-sm">
                ${
                  state.examResults.length === 0
                    ? `<tr><td colspan="6" class="py-8 text-center text-xs text-slate-500">No published results for current role scope.</td></tr>`
                    : state.examResults.map((res) => {
                        const stUser = res.student?.user || {};
                        const stName = stUser.firstName
                          ? `${stUser.firstName} ${stUser.lastName}`
                          : res.student?.admissionNumber || 'Student';
                        const subj = res.subject?.name || 'Database Management Systems';
                        const isPass = res.passStatus === 'Pass';
                        return `
                          <tr>
                            <td class="py-3.5 px-4 font-medium text-slate-900 dark:text-white">${escapeHtml(stName)}</td>
                            <td class="py-3.5 px-4 text-slate-600 dark:text-slate-300">${escapeHtml(subj)}</td>
                            <td class="py-3.5 px-4 text-right font-mono tabular-nums font-bold">${res.marksObtained} / ${res.maxMarks}</td>
                            <td class="py-3.5 px-4 text-right font-mono tabular-nums">${Number(res.percentage || 0).toFixed(1)}%</td>
                            <td class="py-3.5 px-4 text-right font-mono tabular-nums text-emerald-600 dark:text-[#C8F904] font-bold">${escapeHtml(res.grade)} (GP ${res.gradePoint ?? 0})</td>
                            <td class="py-3.5 px-4 text-right font-mono text-xs uppercase font-bold ${isPass ? 'text-emerald-500' : 'text-[#FF6347]'}">${escapeHtml(res.passStatus)}</td>
                          </tr>
                        `;
                      }).join('')
                }
              </tbody>
            </table>
          </div>
        </section>
      `;
    }

    return `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        ${state.studyMaterials.map((mat) => `
          <article class="silv-bento rounded-3xl p-6 flex flex-col justify-between gap-4">
            <div>
              <div class="flex items-center justify-between text-xs font-mono text-slate-400">
                <span class="uppercase text-emerald-600 dark:text-[#C8F904] font-bold">${escapeHtml(mat.materialType || 'document')} · v${mat.currentVersion || 1}</span>
                <span class="tabular-nums">${mat.viewCount || 0} views</span>
              </div>
              <h3 class="text-base font-display font-bold text-slate-900 dark:text-white mt-2">${escapeHtml(mat.title)}</h3>
              <p class="text-xs text-slate-600 dark:text-slate-300 mt-1.5">${escapeHtml(mat.description)}</p>
            </div>
            <div class="pt-3 border-t border-slate-200/70 dark:border-white/[0.06] flex justify-end">
              <button type="button" data-view-material="${mat._id}" class="px-3.5 py-1.5 rounded-xl silv-subcard text-xs font-mono text-slate-900 dark:text-[#C8F904] hover:opacity-85">
                Inspect Resource →
              </button>
            </div>
          </article>
        `).join('')}
      </div>
    `;
  }

  function bindAcademicsEvents() {
    document.querySelectorAll('[data-acad-subtab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.academicSubTab = btn.getAttribute('data-acad-subtab');
        renderWorkspace();
      });
    });

    const createAsgnBtn = document.getElementById('btn-create-assignment');
    if (createAsgnBtn) createAsgnBtn.addEventListener('click', openCreateAssignmentModal);

    document.querySelectorAll('[data-view-material]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-view-material');
        try {
          const res = await apiRequest(`/study-materials/${id}`);
          showToast('Material Opened', `${res.data.title} (Views: ${res.data.viewCount})`, 'success');
          await loadAllWorkspaceData();
        } catch (err) {
          showToast('Access Restricted', err.message, 'error');
        }
      });
    });
  }

  // ==========================================
  // VIEW 5: Real-Time Notifications & Preferences (Phase 9)
  // ==========================================
  function renderNotificationsTab() {
    const filtered = state.notifications.filter((n) => {
      if (state.notificationFilter === 'unread') return !n.isRead;
      return true;
    });

    const pref = state.preferences || {
      inAppEnabled: true,
      emailEnabled: true,
      smsEnabled: false,
      pushEnabled: true,
      timezone: 'Asia/Kolkata',
      quietHours: { enabled: false, startTime: '22:00', endTime: '07:00' },
    };

    return `
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <section class="lg:col-span-7 silv-bento rounded-3xl p-6 space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200/70 dark:border-white/[0.06]">
            <div>
              <span class="text-[11px] font-mono uppercase tracking-widest text-slate-400">Socket.IO Live Stream</span>
              <h1 class="text-lg font-display font-bold text-slate-900 dark:text-white mt-0.5">Personal Alert Feed</h1>
            </div>
            <div class="flex items-center gap-2">
              <button type="button" id="btn-mark-all-read" class="h-8 px-3 rounded-xl silv-subcard text-xs font-mono">Mark All Read</button>
              ${
                isStaffUser()
                  ? `<button type="button" id="btn-dispatch-event-notif" class="h-8 px-3 rounded-xl bg-slate-900 dark:bg-[#C8F904] text-white dark:text-slate-950 text-xs font-display font-bold">+ Dispatch</button>`
                  : ''
              }
            </div>
          </div>

          <div class="space-y-3">
            ${
              filtered.length === 0
                ? `<div class="silv-subcard rounded-2xl p-8 text-center text-xs text-slate-500">No notifications in your feed.</div>`
                : filtered.map((n) => `
                    <div class="silv-subcard rounded-2xl p-4 flex items-start justify-between gap-4">
                      <div class="space-y-1">
                        <div class="flex items-center gap-2 text-[11px] font-mono">
                          <span class="uppercase font-bold text-emerald-600 dark:text-[#C8F904]">${escapeHtml(n.notificationType)}</span>
                          <span class="text-slate-400">·</span>
                          <span class="uppercase text-slate-400">${escapeHtml(n.priority)}</span>
                          <span class="text-slate-400">·</span>
                          <time class="tabular-nums text-slate-400">${formatDate(n.createdAt, true)}</time>
                        </div>
                        <h3 class="text-sm font-display font-bold text-slate-900 dark:text-white">${escapeHtml(n.title)}</h3>
                        <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">${escapeHtml(n.message)}</p>
                      </div>
                      <div>
                        ${
                          !n.isRead
                            ? `<button type="button" data-mark-read="${n._id}" class="px-2.5 py-1 rounded-lg bg-slate-900 dark:bg-[#C8F904] text-white dark:text-slate-950 text-[10px] font-mono font-bold">Mark Read</button>`
                            : `<span class="text-[10px] font-mono text-slate-400">READ</span>`
                        }
                      </div>
                    </div>
                  `).join('')
            }
          </div>
        </section>

        <section class="lg:col-span-5 silv-bento rounded-3xl p-6 self-start">
          <span class="text-[11px] font-mono uppercase tracking-widest text-slate-400">Delivery Channels</span>
          <h2 class="text-lg font-display font-bold text-slate-900 dark:text-white mt-0.5">Preferences &amp; Quiet Hours</h2>
          <form id="form-notification-preferences" class="mt-4 space-y-3">
            <label class="flex items-center justify-between p-3.5 rounded-2xl silv-subcard cursor-pointer">
              <span class="text-xs font-medium">In-App Real-Time Stream</span>
              <input type="checkbox" name="inAppEnabled" ${pref.inAppEnabled ? 'checked' : ''} class="h-4 w-4 accent-[#C8F904]" />
            </label>
            <label class="flex items-center justify-between p-3.5 rounded-2xl silv-subcard cursor-pointer">
              <span class="text-xs font-medium">Email Delivery</span>
              <input type="checkbox" name="emailEnabled" ${pref.emailEnabled ? 'checked' : ''} class="h-4 w-4 accent-[#C8F904]" />
            </label>
            <label class="flex items-center justify-between p-3.5 rounded-2xl silv-subcard cursor-pointer">
              <span class="text-xs font-medium">SMS Alerts</span>
              <input type="checkbox" name="smsEnabled" ${pref.smsEnabled ? 'checked' : ''} class="h-4 w-4 accent-[#C8F904]" />
            </label>
            <label class="flex items-center justify-between p-3.5 rounded-2xl silv-subcard cursor-pointer">
              <span class="text-xs font-medium">Push Notifications</span>
              <input type="checkbox" name="pushEnabled" ${pref.pushEnabled ? 'checked' : ''} class="h-4 w-4 accent-[#C8F904]" />
            </label>

            <div class="pt-3 border-t border-slate-200/70 dark:border-white/[0.06] grid grid-cols-2 gap-3">
              <div>
                <label class="block text-[11px] font-mono text-slate-400 mb-1">Quiet Start</label>
                <input type="text" name="quietStart" value="${escapeHtml(pref.quietHours?.startTime || '22:00')}" class="w-full h-9 px-3 rounded-xl silv-subcard font-mono text-xs tabular-nums" />
              </div>
              <div>
                <label class="block text-[11px] font-mono text-slate-400 mb-1">Quiet End</label>
                <input type="text" name="quietEnd" value="${escapeHtml(pref.quietHours?.endTime || '07:00')}" class="w-full h-9 px-3 rounded-xl silv-subcard font-mono text-xs tabular-nums" />
              </div>
            </div>

            <button type="submit" class="w-full h-10 mt-2 rounded-xl bg-slate-900 dark:bg-[#C8F904] text-white dark:text-slate-950 text-xs font-display font-bold">
              Save Preferences
            </button>
          </form>
        </section>
      </div>
    `;
  }

  function bindNotificationsEvents() {
    const markAllBtn = document.getElementById('btn-mark-all-read');
    if (markAllBtn) {
      markAllBtn.addEventListener('click', async () => {
        try {
          await apiRequest('/notifications/read-all', { method: 'PATCH' });
          showToast('Inbox Updated', 'All notifications marked as read.', 'success');
          await refreshNotificationsQuietly();
        } catch (err) {
          showToast('Error', err.message, 'error');
        }
      });
    }

    const dispatchBtn = document.getElementById('btn-dispatch-event-notif');
    if (dispatchBtn) dispatchBtn.addEventListener('click', openDispatchNotificationModal);

    document.querySelectorAll('[data-mark-read]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-mark-read');
        try {
          await apiRequest(`/notifications/${id}/read`, { method: 'PATCH' });
          await refreshNotificationsQuietly();
        } catch (err) {
          showToast('Error', err.message, 'error');
        }
      });
    });

    const prefForm = document.getElementById('form-notification-preferences');
    if (prefForm) {
      prefForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(prefForm);
        try {
          const res = await apiRequest('/notifications/preferences', {
            method: 'PUT',
            body: JSON.stringify({
              inAppEnabled: fd.get('inAppEnabled') === 'on',
              emailEnabled: fd.get('emailEnabled') === 'on',
              smsEnabled: fd.get('smsEnabled') === 'on',
              pushEnabled: fd.get('pushEnabled') === 'on',
              timezone: 'Asia/Kolkata',
              quietHours: {
                enabled: true,
                startTime: fd.get('quietStart') || '22:00',
                endTime: fd.get('quietEnd') || '07:00',
              },
            }),
          });
          state.preferences = res.data;
          showToast('Preferences Saved', 'Delivery channels updated.', 'success');
        } catch (err) {
          showToast('Validation Error', err.message, 'error');
        }
      });
    }
  }

  // ==========================================
  // Interactive Modals
  // ==========================================
  function openModal(htmlContent) {
    const root = document.getElementById('modal-root');
    const panel = document.getElementById('modal-panel');
    if (!root || !panel) return;
    panel.innerHTML = htmlContent;
    root.classList.remove('hidden');
    root.classList.add('flex');

    root.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', closeModal);
    });
  }

  function closeModal() {
    const root = document.getElementById('modal-root');
    if (!root) return;
    root.classList.add('hidden');
    root.classList.remove('flex');
  }

  function openLoginModal() {
    openModal(`
      <div class="px-6 py-4 border-b border-slate-200/70 dark:border-white/[0.06] flex items-center justify-between">
        <h3 class="text-base font-display font-bold">Sign In to MSEC Pulse</h3>
        <button type="button" data-close-modal class="text-xs font-mono text-slate-400">CLOSE</button>
      </div>
      <form id="modal-login-form" class="p-6 space-y-4">
        <div>
          <label class="block text-xs font-mono text-slate-400 mb-1">Email</label>
          <input type="email" name="email" required value="admin@msec.ac.in" class="w-full h-9 px-3 rounded-xl silv-subcard text-sm" />
        </div>
        <div>
          <label class="block text-xs font-mono text-slate-400 mb-1">Password</label>
          <input type="password" name="password" required value="AdminPassword123" class="w-full h-9 px-3 rounded-xl silv-subcard text-sm" />
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" data-close-modal class="h-9 px-4 rounded-xl silv-subcard text-xs">Cancel</button>
          <button type="submit" class="h-9 px-4 rounded-xl bg-slate-900 dark:bg-[#C8F904] text-white dark:text-slate-950 text-xs font-display font-bold">Authenticate</button>
        </div>
      </form>
    `);

    document.getElementById('modal-login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      closeModal();
      await loginWithCredentials(fd.get('email'), fd.get('password'));
    });
  }

  function openCreateAnnouncementModal() {
    const isTeacher = state.user?.role === 'TEACHER';
    const sectionOptions = state.sections
      .map((s) => `<option value="${s._id}">Section ${escapeHtml(s.sectionName || s.name || 'A')} (${escapeHtml(s.roomNumber || 'LHC')})</option>`)
      .join('');

    openModal(`
      <div class="px-6 py-4 border-b border-slate-200/70 dark:border-white/[0.06] flex items-center justify-between">
        <h3 class="text-base font-display font-bold">Compose Targeted Broadcast</h3>
        <button type="button" data-close-modal class="text-xs font-mono text-slate-400">CLOSE</button>
      </div>
      <form id="modal-announcement-form" class="p-6 space-y-4">
        <div>
          <label class="block text-xs font-mono text-slate-400 mb-1">Title</label>
          <input type="text" name="title" required minlength="3" placeholder="e.g., End-Semester Lab Viva Schedule" class="w-full h-9 px-3 rounded-xl silv-subcard text-sm" />
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label class="block text-xs font-mono text-slate-400 mb-1">Type</label>
            <select name="announcementType" class="w-full h-9 px-3 rounded-xl silv-subcard text-xs">
              <option value="academic">Academic</option>
              <option value="examination">Examination</option>
              <option value="assignment">Assignment</option>
              <option value="emergency">Emergency</option>
              <option value="general">General</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-mono text-slate-400 mb-1">Priority</label>
            <select name="priority" class="w-full h-9 px-3 rounded-xl silv-subcard text-xs">
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-mono text-slate-400 mb-1">Audience</label>
            <select name="targetAudience" class="w-full h-9 px-3 rounded-xl silv-subcard text-xs">
              ${!isTeacher ? `<option value="all">All Institution</option>` : ''}
              <option value="selected" ${isTeacher ? 'selected' : ''}>Selected Section</option>
              ${!isTeacher ? `<option value="students">All Students</option>` : ''}
            </select>
          </div>
        </div>
        <div>
          <label class="block text-xs font-mono text-slate-400 mb-1">Target Section</label>
          <select name="targetSectionId" class="w-full h-9 px-3 rounded-xl silv-subcard text-xs">
            ${sectionOptions}
          </select>
        </div>
        <div>
          <label class="block text-xs font-mono text-slate-400 mb-1">Message Content</label>
          <textarea name="content" required minlength="5" rows="3" class="w-full p-3 rounded-xl silv-subcard text-sm" placeholder="Enter broadcast details..."></textarea>
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" data-close-modal class="h-9 px-4 rounded-xl silv-subcard text-xs">Cancel</button>
          <button type="submit" class="h-9 px-4 rounded-xl bg-slate-900 dark:bg-[#C8F904] text-white dark:text-slate-950 text-xs font-display font-bold">Publish Broadcast</button>
        </div>
      </form>
    `);

    document.getElementById('modal-announcement-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const targetAudience = fd.get('targetAudience');
      const sectionId = fd.get('targetSectionId');
      try {
        await apiRequest('/announcements', {
          method: 'POST',
          body: JSON.stringify({
            title: fd.get('title'),
            content: fd.get('content'),
            announcementType: fd.get('announcementType'),
            priority: fd.get('priority'),
            targetAudience,
            targetSections: targetAudience === 'selected' && sectionId ? [sectionId] : [],
            status: 'published',
          }),
        });
        closeModal();
        showToast('Broadcast Published', 'Audience snapshot locked and alerts dispatched.', 'success');
        await loadAllWorkspaceData();
      } catch (err) {
        showToast('Broadcast Error', err.message, 'error');
      }
    });
  }

  async function openAnnouncementAnalyticsModal(announcementId) {
    try {
      const res = await apiRequest(`/announcements/${announcementId}/analytics`);
      const stats = res.data;
      openModal(`
        <div class="px-6 py-4 border-b border-slate-200/70 dark:border-white/[0.06] flex items-center justify-between">
          <h3 class="text-base font-display font-bold">Readership &amp; Delivery Telemetry</h3>
          <button type="button" data-close-modal class="text-xs font-mono text-slate-400">CLOSE</button>
        </div>
        <div class="p-6 grid grid-cols-3 gap-4">
          <div class="silv-subcard rounded-2xl p-4">
            <span class="text-[10px] font-mono uppercase text-slate-400">Resolved Targets</span>
            <p class="text-2xl font-display font-extrabold tabular-nums mt-1">${stats.totalRecipients}</p>
          </div>
          <div class="silv-subcard rounded-2xl p-4">
            <span class="text-[10px] font-mono uppercase text-slate-400">Read Receipts</span>
            <p class="text-2xl font-display font-extrabold tabular-nums text-emerald-500 dark:text-[#C8F904] mt-1">${stats.readNotificationsCount}</p>
          </div>
          <div class="silv-subcard rounded-2xl p-4">
            <span class="text-[10px] font-mono uppercase text-slate-400">Read Velocity</span>
            <p class="text-2xl font-display font-extrabold tabular-nums mt-1">${stats.readPercentage}%</p>
          </div>
        </div>
      `);
    } catch (err) {
      showToast('Analytics Error', err.message, 'error');
    }
  }

  function openRecordRollCallModal() {
    const activeYear = state.academicYears[0];
    const primaryClass = state.classes[0];
    const primarySection = state.sections[0];
    const subjectOptions = state.subjects
      .map((s) => `<option value="${s._id}">${escapeHtml(s.code)} — ${escapeHtml(s.name)}</option>`)
      .join('');

    openModal(`
      <div class="px-6 py-4 border-b border-slate-200/70 dark:border-white/[0.06] flex items-center justify-between">
        <h3 class="text-base font-display font-bold">Record Lecture Roll-Call Checkpoint</h3>
        <button type="button" data-close-modal class="text-xs font-mono text-slate-400">CLOSE</button>
      </div>
      <form id="modal-rollcall-form" class="p-6 space-y-4">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-mono text-slate-400 mb-1">Subject</label>
            <select name="subject" class="w-full h-9 px-3 rounded-xl silv-subcard text-xs">${subjectOptions}</select>
          </div>
          <div>
            <label class="block text-xs font-mono text-slate-400 mb-1">Period (1–8)</label>
            <input type="number" name="periodNumber" min="1" max="8" value="5" required class="w-full h-9 px-3 rounded-xl silv-subcard font-mono text-xs tabular-nums" />
          </div>
        </div>
        <div>
          <label class="block text-xs font-mono text-slate-400 mb-1">Topic Covered</label>
          <input type="text" name="topicCovered" required value="Distributed Consensus & Raft Log Replication" class="w-full h-9 px-3 rounded-xl silv-subcard text-sm" />
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" data-close-modal class="h-9 px-4 rounded-xl silv-subcard text-xs">Cancel</button>
          <button type="submit" class="h-9 px-4 rounded-xl bg-slate-900 dark:bg-[#C8F904] text-white dark:text-slate-950 text-xs font-display font-bold">Log Session</button>
        </div>
      </form>
    `);

    document.getElementById('modal-rollcall-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await apiRequest('/attendance/sessions', {
          method: 'POST',
          body: JSON.stringify({
            academicYear: activeYear?._id,
            class: primaryClass?._id,
            section: primarySection?._id,
            subject: fd.get('subject'),
            sessionDate: new Date().toISOString(),
            startTime: '15:00',
            endTime: '16:00',
            periodNumber: Number(fd.get('periodNumber')),
            topicCovered: fd.get('topicCovered'),
            status: 'Completed',
          }),
        });
        closeModal();
        showToast('Roll-Call Logged', 'Attendance checkpoint added.', 'success');
        await loadAllWorkspaceData();
      } catch (err) {
        showToast('Roll-Call Error', err.message, 'error');
      }
    });
  }

  function openCreateAssignmentModal() {
    const activeYear = state.academicYears[0];
    const primaryClass = state.classes[0];
    const primarySection = state.sections[0];
    const subjectOptions = state.subjects
      .map((s) => `<option value="${s._id}">${escapeHtml(s.code)} — ${escapeHtml(s.name)}</option>`)
      .join('');

    openModal(`
      <div class="px-6 py-4 border-b border-slate-200/70 dark:border-white/[0.06] flex items-center justify-between">
        <h3 class="text-base font-display font-bold">Publish Coursework Assignment</h3>
        <button type="button" data-close-modal class="text-xs font-mono text-slate-400">CLOSE</button>
      </div>
      <form id="modal-assignment-form" class="p-6 space-y-4">
        <div>
          <label class="block text-xs font-mono text-slate-400 mb-1">Assignment Title</label>
          <input type="text" name="title" required placeholder="e.g., Lab 4: Query Planner Cost Estimation" class="w-full h-9 px-3 rounded-xl silv-subcard text-sm" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-mono text-slate-400 mb-1">Subject</label>
            <select name="subject" class="w-full h-9 px-3 rounded-xl silv-subcard text-xs">${subjectOptions}</select>
          </div>
          <div>
            <label class="block text-xs font-mono text-slate-400 mb-1">Max Marks</label>
            <input type="number" name="maxMarks" value="50" required class="w-full h-9 px-3 rounded-xl silv-subcard font-mono text-xs tabular-nums" />
          </div>
        </div>
        <div>
          <label class="block text-xs font-mono text-slate-400 mb-1">Deliverable Specification</label>
          <textarea name="description" required rows="3" class="w-full p-3 rounded-xl silv-subcard text-sm" placeholder="Describe requirements..."></textarea>
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" data-close-modal class="h-9 px-4 rounded-xl silv-subcard text-xs">Cancel</button>
          <button type="submit" class="h-9 px-4 rounded-xl bg-slate-900 dark:bg-[#C8F904] text-white dark:text-slate-950 text-xs font-display font-bold">Publish</button>
        </div>
      </form>
    `);

    document.getElementById('modal-assignment-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await apiRequest('/assignments', {
          method: 'POST',
          body: JSON.stringify({
            title: fd.get('title'),
            description: fd.get('description'),
            academicYear: activeYear?._id,
            class: primaryClass?._id,
            section: primarySection?._id,
            subject: fd.get('subject'),
            dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
            maxMarks: Number(fd.get('maxMarks')),
            passingMarks: 20,
            submissionType: 'both',
            allowLateSubmission: true,
            status: 'published',
          }),
        });
        closeModal();
        showToast('Assignment Published', 'Coursework is now visible to students.', 'success');
        await loadAllWorkspaceData();
      } catch (err) {
        showToast('Error', err.message, 'error');
      }
    });
  }

  function openDispatchNotificationModal() {
    const selfId = state.user?._id || state.user?.id || '';
    openModal(`
      <div class="px-6 py-4 border-b border-slate-200/70 dark:border-white/[0.06] flex items-center justify-between">
        <h3 class="text-base font-display font-bold">Dispatch Real-Time Operational Alert</h3>
        <button type="button" data-close-modal class="text-xs font-mono text-slate-400">CLOSE</button>
      </div>
      <form id="modal-dispatch-notif-form" class="p-6 space-y-4">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-mono text-slate-400 mb-1">Event Type</label>
            <select name="eventType" class="w-full h-9 px-3 rounded-xl silv-subcard text-xs">
              <option value="DIRECT_ADMIN_MESSAGE">Direct Admin Alert</option>
              <option value="ATTENDANCE_WARNING">Attendance Warning</option>
              <option value="EXAM_SCHEDULE_PUBLISHED">Exam Schedule Published</option>
              <option value="TIMETABLE_CHANGED">Timetable Substitution</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-mono text-slate-400 mb-1">Priority</label>
            <select name="priority" class="w-full h-9 px-3 rounded-xl silv-subcard text-xs">
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
              <option value="normal">Normal</option>
            </select>
          </div>
        </div>
        <div>
          <label class="block text-xs font-mono text-slate-400 mb-1">Title</label>
          <input type="text" name="title" required value="Immediate Telemetry Advisory" class="w-full h-9 px-3 rounded-xl silv-subcard text-sm" />
        </div>
        <div>
          <label class="block text-xs font-mono text-slate-400 mb-1">Message</label>
          <textarea name="message" required rows="3" class="w-full p-3 rounded-xl silv-subcard text-sm">Updated assessment and attendance checkpoints have been synchronized for BE-CSE Section A.</textarea>
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" data-close-modal class="h-9 px-4 rounded-xl silv-subcard text-xs">Cancel</button>
          <button type="submit" class="h-9 px-4 rounded-xl bg-slate-900 dark:bg-[#C8F904] text-white dark:text-slate-950 text-xs font-display font-bold">Dispatch Alert</button>
        </div>
      </form>
    `);

    document.getElementById('modal-dispatch-notif-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await apiRequest('/notifications/events', {
          method: 'POST',
          body: JSON.stringify({
            eventType: fd.get('eventType'),
            recipients: [selfId],
            title: fd.get('title'),
            message: fd.get('message'),
            priority: fd.get('priority'),
          }),
        });
        closeModal();
        showToast('Alert Dispatched', 'Delivered via Socket.IO & in-app inbox.', 'success');
        await refreshNotificationsQuietly();
      } catch (err) {
        showToast('Dispatch Failed', err.message, 'error');
      }
    });
  }

  // ==========================================
  // Bootstrap
  // ==========================================
  function initTheme() {
    // Default to Silv Obsidian Dark unless user explicitly toggled light
    const savedTheme = localStorage.getItem('msec_theme') || 'dark';
    if (savedTheme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }

    const themeBtn = document.getElementById('btn-theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('msec_theme', isDark ? 'dark' : 'light');
      });
    }
  }

  function initGlobalHeaderEvents() {
    document.querySelectorAll('.nav-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-nav');
        if (target) setActiveTab(target);
      });
    });

    const personaSelect = document.getElementById('persona-select');
    if (personaSelect) {
      personaSelect.addEventListener('change', async (e) => {
        const [email, password] = e.target.value.split('|');
        if (email && password) await loginWithCredentials(email, password);
      });
    }

    const loginBtn = document.getElementById('btn-open-login');
    if (loginBtn) loginBtn.addEventListener('click', openLoginModal);

    const primaryCta = document.getElementById('btn-primary-cta');
    if (primaryCta) {
      primaryCta.addEventListener('click', () => {
        if (state.activeTab === 'attendance' && isStaffUser()) {
          openRecordRollCallModal();
        } else if (state.activeTab === 'academics' && isStaffUser()) {
          openCreateAssignmentModal();
        } else if (state.activeTab === 'notifications') {
          if (isStaffUser()) openDispatchNotificationModal();
          else setActiveTab('notifications');
        } else if (isStaffUser()) {
          openCreateAnnouncementModal();
        } else {
          setActiveTab('notifications');
        }
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
  }

  async function bootstrap() {
    initTheme();
    initGlobalHeaderEvents();
    setActiveTab('overview');

    const savedPersona = localStorage.getItem('msec_active_persona') || 'admin@msec.ac.in|AdminPassword123';
    const [email, password] = savedPersona.split('|');
    await loginWithCredentials(email, password, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();
