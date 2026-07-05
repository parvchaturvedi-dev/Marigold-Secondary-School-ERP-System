# MGPS ERP — Marigold Secondary School Management System

A complete, production-grade **School ERP** for Marigold Secondary School (Behror). It is a single
codebase that ships **three applications** sharing one backend and one database:

| App | Stack | Who uses it |
|-----|-------|-------------|
| **Backend API** | Node.js (Express 5, ESM) + Mongoose + MongoDB Atlas + Socket.IO | serves both frontends |
| **Web Portal** | React 19 + Vite + Tailwind CSS 4 | Admin, Clerk, Teacher, Student (desktop/tablet) |
| **Mobile App** | Expo SDK 54 (React Native, JS) | Admin, Clerk, Teacher, Student (Android/iOS) |

The web portal and the mobile app expose the **same features with full read + write parity** — a fee
collected on mobile appears instantly on the web, and vice-versa, because both write the same shapes
to the same backend.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Tech Stack](#2-tech-stack)
3. [Architecture](#3-architecture)
4. [Repository Layout](#4-repository-layout)
5. [Backend (`backend/`)](#5-backend-backend)
6. [Web Portal (`frontend/`)](#6-web-portal-frontend)
7. [Mobile App (`frontend-mobile/`)](#7-mobile-app-frontend-mobile)
8. [Data & Storage Model](#8-data--storage-model)
9. [Roles & Permissions](#9-roles--permissions)
10. [Feature Deep-Dives](#10-feature-deep-dives)
11. [REST API Reference](#11-rest-api-reference)
12. [Realtime & Push](#12-realtime--push)
13. [Getting Started (Local Dev)](#13-getting-started-local-dev)
14. [Build & Deploy](#14-build--deploy)
15. [Environment Variables](#15-environment-variables)
16. [Security Posture](#16-security-posture)
17. [Known Limitations & Go-Live Checklist](#17-known-limitations--go-live-checklist)

---

## 1. Overview

MGPS ERP digitises the day-to-day operations of a single school across four roles:

- **Admin** — full control: students, teachers, clerks, classes, subjects, fees, payroll,
  timetable, examinations, documents, users, settings, factory reset.
- **Clerk** — office operations: attendance, admissions, documents, most admin desks (scoped).
- **Teacher** — attendance marking, marks entry, assignments, meetings, their class roster,
  leave, notices.
- **Student** — fees, results, attendance, timetable, assignments, applications, leave, events,
  meetings, notices, digital ID card, personal encrypted vault.

Everything a user can *do* on the web, they can also do on mobile.

---

## 2. Tech Stack

**Backend**
`express` · `mongoose` · `socket.io` · `express-session` + `connect-mongo` · `multer` (uploads) ·
`express-rate-limit` · `cors` · `cookie-parser` · `dotenv`

**Web**
`react` 19 · `react-router-dom` · `vite` · `tailwindcss` 4 · `recharts` (charts) · `lucide-react`
(icons) · `axios` · `socket.io-client` · `jspdf` + `html2canvas` + `qrcode` + `jsbarcode` (ID cards
& receipts) · `@e965/xlsx` (Excel import)

**Mobile (Expo SDK 54)**
manual `AuthContext` routing · `@react-native-community/datetimepicker` · `expo-image-picker` ·
`expo-document-picker` · `expo-file-system` · `expo-print` + `expo-sharing` (ID card PDF) ·
`expo-location` (attendance geofence) · `expo-notifications` (push) · `socket.io-client` (realtime) ·
`@noble/ciphers` + `@noble/hashes` (vault encryption, interoperable with the web) · `@e965/xlsx`
(Excel import) · `expo-blur` / `expo-linear-gradient` (UI)

---

## 3. Architecture

```
        ┌─────────────────┐        ┌─────────────────┐
        │   Web Portal    │        │   Mobile App    │
        │ React + Vite    │        │  Expo RN (SDK54)│
        │ (Vercel)        │        │  (EAS build)    │
        └────────┬────────┘        └────────┬────────┘
                 │  REST /api (Bearer JWT + cookie session)
                 │  + Socket.IO (realtime)
                 ▼                          ▼
        ┌──────────────────────────────────────────┐
        │            Backend API (Express)          │
        │  requireAuth → requireRole guards         │
        │  routes/*  ·  utils/*  ·  realtime.js     │
        │                (Render)                   │
        └────────────────────┬─────────────────────┘
                             ▼
                  ┌─────────────────────┐
                  │  MongoDB Atlas       │
                  │  Mongoose models     │
                  └─────────────────────┘
```

**Auth.** The web uses a cookie session; the mobile app uses a **Bearer JWT** in the
`Authorization` header. Every `/api/*` route (except `/api/auth/login|session|logout` and
`/api/health`) runs through `requireAuth`, which re-hydrates the user **from the database** on every
request (so a role/permission change takes effect immediately). Mutating routes additionally run
`requireRole(...)` and **derive the actor identity from the session** — client-supplied
`role`/`username` fields are never trusted.

**Realtime.** `realtime.js` broadcasts a single `realtime:event` over Socket.IO whenever server
state changes. The web and mobile clients subscribe and refresh the affected views. Push
notifications (Expo) are fanned out server-side on the same events.

---

## 4. Repository Layout

```
mgps-erp/
├── backend/            # Express + Mongoose API (the server)
├── frontend/           # React web portal (Vite)
├── frontend-mobile/    # Expo React Native app
├── app.json            # (root) Expo config mirror
├── eas.json            # (root) EAS build config mirror
├── package.json        # npm workspace root (build/dev/start scripts for frontend+backend)
└── README.md           # this file
```

The root `package.json` is an **npm workspace** wrapping `frontend` and `backend` with convenience
scripts (`npm run build`, `npm run dev`, `npm start`). The mobile app is a standalone Expo project.

---

## 5. Backend (`backend/`)

Express 5, ESM (`"type": "module"`), Node 22. Entry point wires session, CORS, JSON body limit
(8 MB), Socket.IO, and mounts all route modules under `/api`.

```
backend/
├── server/
│   ├── index.js          # app entry: middleware, Socket.IO handshake (cookie + Bearer), route mounting
│   ├── db.js             # Mongo connection + isMongoConnected()/getDbStatus()
│   ├── realtime.js       # Socket.IO server, per-user socket tracking, emitRealtimeEvent()
│   ├── middleware/
│   │   └── auth.js       # requireAuth (session/Bearer → request.auth from DB), requireRole(...), optionalAuth
│   ├── models/           # Mongoose schemas (see table below)
│   ├── routes/           # REST route modules (see table below)
│   └── utils/            # cross-cutting helpers (see table below)
├── clear_device_lock.js  # ops script: release a student device-lock
├── db_check.js           # ops script: quick DB connectivity check
└── package.json
```

### `server/models/` — Mongoose schemas

| Model | Purpose |
|-------|---------|
| `User.js` | Identity accounts (admin/clerk/teacher/student). Holds `passwordHash`, `role`, `profile` (incl. `studentProfiles[]` for sibling/family accounts), `pushTokens[]`, device-lock. |
| `ModuleState.js` | Generic key→value store. Powers most admin master-data as JSON blobs keyed by namespace (see §8). |
| `AttendanceLog.js` | One record per attendance mark (student roster + staff clock-in/out). |
| `AttendanceSetting.js` | Attendance window times, **geofence** (lat/lng/radius, default 50 m), WiFi BSSID, QR rules. |
| `BiometricProfile.js` | Legacy biometric enrolment (UI removed; model retained for data). |
| `FraudAlert.js` | Logged mock-location / geofence-fraud events. |
| `Assignment.js` | Teacher/admin assignments with attachment + deadline. |
| `ExaminationState.js` | Single-document exam state: `exams`, `papers`, `schedules`, `marks`, `boardResults`, etc. |
| `BoardResultFile.js` | Binary PDF store for published board results (FK to a `boardResults[]` entry). |
| `LeaveRequest.js` | Leave workflow (student → class-teacher → admin). |
| `Application.js` | Applications with class-consensus voting + admin reply thread. |
| `Meeting.js` | Jitsi meetings with scope (class/staff/school) + attendance. |
| `Event.js` | School events with image, participation toggle + optional open/close window + participants. |
| `Notification.js` | In-app notifications with role/user/class/student targeting + `readBy[]`. |
| `Timetable.js` | Default + date-range-override timetables (periods × classes grid). |
| `AcademicCalendar.js` | Published academic-calendar PDF (binary + metadata). |
| `VaultItem.js` | Per-user client-side-encrypted vault items (notes/PDFs/images). |
| `AiReceipt.js` | Fee receipts generated via the AI desk. |
| `AiAuditLog.js` | Audit trail of AI-desk actions. |

### `server/routes/` — REST modules (all mounted at `/api/<name>`)

| Route file | Mount | Responsibility |
|------------|-------|----------------|
| `auth.js` | `/api/auth` | login (rate-limited), session, logout, admin user CRUD, password OTP reveal (rate-limited), change-password, profile photo. |
| `moduleState.js` | `/api/module-state` | GET/PUT namespaced master-data blobs; students blocked from PII namespaces; PUT admin/clerk-only + identity-sync. |
| `attendance.js` | `/api/attendance` | settings, directory, scan, **clock-in/out with geofence enforcement**, batch student marks, logs, overview. |
| `fees.js` | `/api/fees` | student's own ledger (`/me`) + per-student ledger for staff (class-scoped for teachers). |
| `payroll.js` | `/api/payroll` | staff self ledger (`/me`) + all-staff summary (admin). |
| `assignments.js` | `/api/assignments` | list/create/update assignments (auth-derived author) + session reset. |
| `examinations.js` | `/api/examinations` | exam-state read/write, **paper approval workflow**, **board-result PDF** upload/serve/delete. |
| `leaveRequests.js` | `/api/leave-requests` | create + class-teacher action (guarded) + admin action. |
| `applications.js` | `/api/applications` | create, class-consensus vote (in-class only), admin action, reply-read. |
| `meetings.js` | `/api/meetings` | list (role-scoped), create (host-checked), mark attendance (self only for students), end. |
| `events.js` | `/api/events` | list, create/update/delete (admin/clerk, image MIME-checked), participate (self-identity + window + dedupe). |
| `notifications.js` | `/api/notifications` | list (own inbox only), mark-read, register/unregister push token, broadcast (admin-only whole-role). |
| `timetable.js` | `/api/timetable` | effective timetable, templates, create/update/delete (admin/clerk). |
| `academicCalendar.js` | `/api/academic-calendar` | latest calendar, upload/delete PDF (admin/clerk). |
| `classInfo.js` | `/api/class-info` | roster + subjects for a class (role-gated). |
| `dashboard.js` | `/api/dashboard` | role-specific dashboard summary. |
| `search.js` | `/api/search` | role-scoped global search. |
| `vault.js` | `/api/vault` | encrypted personal vault CRUD with storage caps (enforced on real payload). |
| `gmail.js` | `/api/gmail` | send transactional email (admin/clerk only). |
| `adminReset.js` | `/api/admin` | factory reset (admin only, scoped, never deletes admins). |
| `ai.js` | `/api/ai` | AI desk (chat/voice/actions/receipts) — sensitive actions role-gated. |

### `server/utils/` — helpers

| File | Purpose |
|------|---------|
| `authToken.js` | Create/verify signed JWTs (timing-safe, expiry-checked). |
| `identity.js` | Sync `ModuleState` student/teacher/clerk lists → `User` identity accounts (incl. sibling **family** accounts). |
| `notify.js` | `createNotification()` — persist + fan out Expo push to the correctly-targeted recipients (incl. parent/family). |
| `push.js` | `sendExpoPush()` — chunked Expo push delivery, fire-and-forget. |
| `nameLookup.js` | Resolve a username → human display name (so the UI never shows raw IDs). |
| `mailer.js` | Nodemailer/Brevo transporter + error formatting. |
| `session.js` | Express-session configuration. |
| `loadEnv.js` | Load and validate environment variables. |

---

## 6. Web Portal (`frontend/`)

React 19 + Vite + Tailwind 4. **Aurora-gradient + glass** design system, indigo/violet palette.

```
frontend/src/
├── main.jsx / App.jsx        # bootstrap + top-level router
├── index.css                 # Tailwind + design-system classes (glass-card, btn-primary, animations)
├── routes/portalRoutes.js    # lazy page registry per role (title → page component)
├── layouts/                  # AdminLayout, ClerkLayout, TeacherLayout, StudentLayout (shell: sidebar+header+aurora)
├── services/api.js           # axios instance (base URL, auth)
├── pages/
│   ├── Admin/    (37 pages)  # full management suite
│   ├── Clerk/    (27 pages)  # office subset of Admin
│   ├── Teacher/  (17 pages)  # teaching workspace
│   ├── Student/  (18 pages)  # student portal
│   └── Auth/Login.jsx        # login + forced password reset
└── components/
    ├── ui/                   # Avatar, DropdownMenu
    └── common/               # shared hubs + data stores (below)
```

### `components/common/` — shared UI hubs

These "hubs" are role-agnostic feature components that every portal reuses:

| Component | Feature |
|-----------|---------|
| `Header.jsx` | Top bar: global search, notifications, **sibling account switcher**. |
| `Sidebar.jsx` | Role-based navigation menu. |
| `AttendanceControl.jsx` | Attendance marking (roster grid + **Mark-All-Present/Absent** bulk actions + geofence clock-in). |
| `AssignmentHub.jsx` | Create / list / submit assignments. |
| `ExaminationHub.jsx` | Exams, papers (**approval workflow**), schedules, marks, **board-result PDFs**. |
| `EventHub.jsx` | Events + participation (with open/close window + "Participated" lock). |
| `LeaveRequestUserHub.jsx` | Apply for / approve / forward leave. |
| `ApplicationUserHub.jsx` / `AdminApplicationInbox.jsx` | Student applications + consensus voting + admin inbox. |
| `JitsiMeetingHub.jsx` | Create / join / end Jitsi meetings. |
| `TimetableHub.jsx` | View / edit timetable grid. |
| `DocumentVault.jsx` | Encrypted personal vault. |
| `AcademicCalendarViewer.jsx` | View the published calendar PDF. |
| `ProfilePhotoUploader.jsx` · `idCardKit.jsx` · `AuroraBackground.jsx` · `Button.jsx` | Reusable UI. |

### `components/common/` — data-access "stores"

Thin client-side modules that read/write the backend (or `ModuleState`) and cache:
`auth.js`, `mongoState.js`, `masterData.js`, `financeData.js` (fee waterfall/promotion math),
`payrollData.js` (salary math), `applicationStore.js`, `assignmentStore.js`, `attendanceStore.js`,
`eventStore.js`, `examinationStore.js`, `leaveRequestStore.js`, `meetingStore.js`,
`notificationStore.js`, `timetableStore.js`, `academicCalendarStore.js`, `profileStore.js`,
`portalProfiles.js`, `realtime.js` (socket client), `api.js`, `gmail.js`.

---

## 7. Mobile App (`frontend-mobile/`)

Expo SDK 54, React Native, JavaScript. **Manual context routing** (no react-navigation stack) via
`AuthContext`. Plain solid cards + light/dark theme.

```
frontend-mobile/src/
├── auth/AuthContext.js         # session, login/logout, sibling switch, realtime connect, screen routing
├── theme/ThemeContext.js       # light/dark palette (persisted), useTheme()
├── api/                        # apiClient (Bearer) + per-domain API wrappers + moduleApi resolver
├── notifications/              # realtime.js (socket client) + registerPush.js (Expo push)
├── shared/                     # AuroraBackground, GlassCard, PageHeader, Skeleton, theme tokens, profile helpers
├── components/cards/           # ModuleCard, OverviewCard, StatCard, PageHeader
├── hooks/useDashboardSummary.js
├── data/modules.js             # student module grid
├── modules/<role>/             # per-role dashboard + module grid data (admin/clerk/teacher)
└── screens/
    ├── ConnectedModuleScreen.js  # generic renderer + ActionForm engine + registry dispatch
    ├── AttendanceScreen.js       # clock-in/out (geofence) + batch student marking + settings
    ├── TimetableScreen.js        # read-only timetable viewer
    ├── StudentModuleScreen.js / StudentDashboardScreen.js
    └── modules/
        ├── registry.js           # title → bespoke screen map (the routing table)
        ├── shared/formKit.js     # reusable UI kit: ScreenShell, Card, TextField, Select, MultiSelect,
        │                         #   Checkbox, DateField, ImageField, FileField, Toggle, Banner, Skeleton,
        │                         #   useBanner(), useModuleState() (cached), theme-aware
        ├── students/  · faculty/ · clerks/ · subjects/ · classes/   # management CRUD screens
        ├── users/     · settings/ · vault/ · documents/            # admin/self screens
        ├── finance/   · payroll/                                   # money screens
        ├── examinations/ (ExaminationManageScreen + read views)   # exam mgmt + marks + board results
        ├── timetable/ (TimetableEditorScreen)
        └── fees/ · meetings/ · academic/ · idcard/                # student-facing + shared
```

**How mobile routing works.** A role dashboard's module grid calls
`openConnectedModule(title)` → `ConnectedModuleScreen` looks the title up in
`modules/registry.js`. If a **bespoke screen** is registered it renders that; otherwise it falls
back to the generic renderer (`ActionForm` for create/approve flows + `DataCard` list). All bespoke
screens are built from `formKit.js`, so they are consistent and theme-aware by default.

---

## 8. Data & Storage Model

Two storage strategies coexist:

1. **Real Mongoose collections** — for high-volume / relational data: users, attendance logs,
   assignments, leave requests, applications, meetings, events, notifications, timetable, vault,
   exam state, board-result files, receipts.

2. **`ModuleState` namespaced blobs** — for admin master-data managed as a single JSON array per
   namespace. Both web and mobile read/write these via `GET/PUT /api/module-state/:namespace`.
   Records use **identical shapes** across web and mobile so edits interoperate.

Key namespaces:

| Namespace | Contents |
|-----------|----------|
| `admin-student-management-students` | Student roster (each record: normalized fields + `rawProfile` + `feeLedger[]`). |
| `admin-teacher-management-list` | Teachers (with class assignments + payroll fields). |
| `admin-clerk-management-list` | Clerks. |
| `admin-class-management-classes` | Classes (+ class-teacher link). |
| `admin-class-preferences` | Class display order. |
| `admin-subjects-global` / `admin-subjects-class-mapping` | Subjects + per-class subject mapping. |
| `admin-document-requirements` | Required-document checklist per role (object, not array). |
| `admin-finance-alumni-pending` | Passed-out students with pending dues (alumni bucket). |
| `admin-notices-list` | Published notices. |

> **Note:** Writing an identity namespace (students/teachers/clerks) triggers `utils/identity.js`
> to provision/deactivate the matching `User` login accounts (including sibling **family** accounts).

---

## 9. Roles & Permissions

| Capability | Admin | Clerk | Teacher | Student |
|------------|:-----:|:-----:|:-------:|:-------:|
| Manage students/teachers/clerks/classes/subjects | ✅ | ✅ | — | — |
| Fees: assign / collect / receipt | ✅ | ✅ | view (own classes) | view own |
| Payroll | ✅ | — | own | — |
| Attendance: mark students | ✅ | ✅ | own class | — |
| Attendance: self clock-in/out (geofenced) | ✅ | ✅ | ✅ | — |
| Examinations: create / enter marks | ✅ | ✅ | own classes | view results |
| Paper approval | approve | submit | submit | — |
| Timetable edit | ✅ | ✅ | view | view |
| Notices / Events broadcast | ✅ | ✅ | class-scoped | view/participate |
| Leave: approve | ✅ | ✅ | forward/approve (own class) | apply |
| Factory reset | ✅ | — | — | — |

Enforced server-side by `requireRole(...)` + auth-derived identity on every mutation.

---

## 10. Feature Deep-Dives

- **Fees (class-wise, manual):** each student carries a `feeLedger[]` (one row per class). Collection
  uses a **waterfall** — the lowest unpaid class is cleared first. Receipts record the *allocated*
  amount. Family/sibling group collection supported. No online payment (admin collects manually).
- **Session promotion:** promotes the whole class to the next grade, carries the fee ledger, pushes
  last-class students with dues into the **alumni bucket**, retains repeaters, and resets assignments.
- **Payroll:** monthly salary effective from next month, waterfall settlement of arrears, salary slips.
- **Attendance + geofence:** staff self clock-in/out is allowed only within the school **geofence**
  (default 50 m); admins set the campus location via "Use my current location". Mock-location is
  blocked. Teachers mark student rosters with bulk Present/Absent shortcuts.
- **Examinations:** create exams/papers/schedules, enter marks, **paper approval workflow**
  (draft → pending → approved/rejected with comments), and **board-result PDF** publishing.
- **Events:** manual open/close toggle + optional date window; participation locks to "Participated".
- **Notifications:** in-app + **Expo push**, fanned out on every relevant event; targeting is
  student/class/role-precise (parents/family accounts included).
- **Vault:** per-user AES-256-GCM + PBKDF2 encryption done **client-side** — the same passphrase
  decrypts an item on both web and mobile (interoperable crypto).
- **Sibling / family accounts:** siblings share one login; a switcher changes the active child and
  re-scopes the entire portal.
- **ID cards:** generated on both platforms; mobile exports a print-ready PDF (`expo-print`).
- **Theme:** app-wide light/dark toggle (mobile), persisted per device.

---

## 11. REST API Reference

All under `/api`. `A`=admin, `C`=clerk, `T`=teacher, `S`=student, `*`=any authenticated.

<details>
<summary><b>Auth</b></summary>

`POST /auth/login` · `GET /auth/session` · `POST /auth/logout` · `GET /auth/users` (A,C) ·
`POST /auth/users/admins` (A) · `PATCH|DELETE /auth/users/:username` (A) ·
`POST /auth/users/:username/request-password-otp` (A,C) · `POST /auth/users/:username/reveal-password` (A,C) ·
`POST /auth/users/:username/send-credentials` (A,C) · `POST /auth/change-password` (*) ·
`PATCH /auth/profile-photo` (*)
</details>

<details>
<summary><b>Core modules</b></summary>

`GET|PUT /module-state/:namespace` (PUT: A,C) · `GET|PUT /attendance/*` · `GET /fees/me` (S) ·
`GET /fees/student/:adm` (A,C,T) · `GET /payroll/me` (T,C) · `GET /payroll/all` (A) ·
`GET|POST /assignments` · `GET|PUT /examinations/state` · `PATCH /examinations/papers/:id/submit-for-approval` ·
`PATCH /examinations/papers/:id/admin-decision` (A) · `POST /examinations/board-results` (A,C) ·
`GET /examinations/board-results/:id/pdf` · `DELETE /examinations/board-results/:id` (A) ·
`GET|POST /leave-requests` + `/:id/admin-action` (A,C) + `/:id/teacher-action` (T,A,C) ·
`GET|POST /applications` + `/:id/vote` + `/:id/admin-action` (A,C) ·
`GET|POST /meetings` + `/:id/attendance` + `/:id/end` ·
`GET|POST /events` (POST A,C) + `/:id/participate` · `GET|POST /notifications` (POST A,C,T) + `/read` +
`/register-token` + `/unregister-token` ·
`GET|POST /timetable` (POST A,C) · `GET|POST|DELETE /academic-calendar` (write A,C) ·
`GET /class-info` · `GET /dashboard/summary` · `GET /search` · `GET|POST|DELETE /vault` ·
`POST /gmail/send` (A,C) · `POST /admin/factory-reset` (A) · `GET /health`
</details>

---

## 12. Realtime & Push

- **Socket.IO** — the client authenticates the handshake with the cookie session (web) or a Bearer
  token (mobile). The server emits `realtime:event` on state changes; clients throttle and refresh.
- **Expo push** — devices register a token on login and unregister on logout. `utils/notify.js`
  targets the exact recipients and sends via `utils/push.js`.

---

## 13. Getting Started (Local Dev)

**Prerequisites:** Node 22.x, npm, a MongoDB connection string, (mobile) an Expo account + the Expo
Go app or a dev build.

```bash
# from the repo root (mgps-erp/)
npm install                 # installs frontend + backend workspaces
# create backend/.env  (see §15)

# run backend + web (two terminals)
npm run dev:backend         # Express API on :5055 (or your PORT)
npm run dev:frontend        # Vite dev server (web)

# run the mobile app
cd frontend-mobile
npm install
npx expo start              # open in Expo Go / dev client
```

---

## 14. Build & Deploy

| Target | Command / Host |
|--------|----------------|
| **Web** | `npm run build:frontend` → deploy `frontend/dist` (Vercel). |
| **Backend** | `npm start` (Render); auto-deploys on push to `main`. |
| **Mobile (installable APK)** | `cd frontend-mobile && npx eas-cli build --platform android --profile production` (the `production` profile outputs an APK). Use `--profile preview` for internal test APKs. |
| **Mobile (Play Store AAB)** | switch the `production` profile to the default bundle output, then `eas submit`. |

Push to `main` triggers Render (backend) + Vercel (web) auto-deploys.

---

## 15. Environment Variables

Create `backend/.env`:

```
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>/<db>
JWT_SECRET=<long-random-secret>          # required in production
SESSION_SECRET=<long-random-secret>
CORS_ORIGIN=https://<your-web-domain>    # comma-separated allowed origins
PORT=5055
# Mail (optional, for credentials/receipts):
SMTP_HOST=... SMTP_PORT=... SMTP_USER=... SMTP_PASS=... MAIL_FROM=...
```

Mobile reads the API base URL from `EXPO_PUBLIC_API_BASE_URL` (defaults to the deployed Render URL).

---

## 16. Security Posture

- Every `/api/*` route behind `requireAuth`; mutations behind `requireRole(...)`.
- **Actor identity always derived from the session** — client-supplied `role`/`username`/sender
  fields are ignored, preventing spoofing, IDOR and ballot-stuffing.
- Students are blocked from PII `ModuleState` namespaces and can only read their **own** notification
  inbox / fees / applications.
- **Rate limiting** on `/auth/login` (8/min) and password-OTP (4/min).
- Attendance self-clock enforces the **geofence** and rejects mock locations.
- File uploads are MIME- and size-capped; the vault enforces caps against the real payload.
- Passwords are hashed; JWTs are signed, expiring and timing-safe.

---

## 17. Known Limitations & Go-Live Checklist

**Before a full school rollout (operational, not code):**

1. **Real-device runtime test** of the key flows (login → sibling switch → fee collect → notification
   → attendance clock-in).
2. **Rotate the MongoDB Atlas password** and update the Render env var.
3. Move Render off the free tier (**$7 plan** removes the 30–60 s cold start) and enable **Atlas
   backups**.

**Deferred (safe for a single-admin operation):**

- Fees are stored in a `ModuleState` blob (read-modify-write). Concurrent fee collection by two users
  at the exact same moment could clobber. The hardening path is a dedicated fee collection with a
  server-side atomic write — do this against a **test database**, never blind on the live money flow.
- A few older mobile bespoke screens use the legacy glass token system and stay light-toned in dark
  mode (light mode is perfect).

---

**Repository:** `github.com/parvchaturvedi-dev/Marigold-Secondary-School-ERP-System`
**School:** Marigold Secondary School, Behror · *Learn · Grow · Succeed*
