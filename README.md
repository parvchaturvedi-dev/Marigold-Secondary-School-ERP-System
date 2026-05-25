# 🌸 Marigold Secondary School ERP Portal (MGPS ERP)
### A State-of-the-Art, Role-Based School Management System

> Repository layout update: the app is now split into `frontend/` for the Vite React SPA and `backend/` for the Express API. Root scripts delegate into those workspaces for local development.

Welcome to the **Marigold Secondary School ERP Portal (MGPS ERP)**, a premium school administration system meticulously engineered to connect Administrators, Clerks, Teachers, and Students/Families in one unified, modern workspace.

MGPS ERP features high-end aesthetics, a custom HSL-tailored responsive layout, smooth glassmorphism containers, micro-interactions, robust backend synchronization, and real-time persistence.

---

## 🚀 Key Architectural Highlights

- **Decoupled Architecture:** A secure, high-performance Node.js/Express API backend paired with a rapid, lightweight React Single-Page Application (SPA) driven by Vite.
- **Dynamic Identity Synchronization:** Automatically derives login credentials, password structures, and profiles in real-time from system rosters.
- **Consolidated Sibling Family Accounts:** Groups students belonging to the same family under a unified Sibling Family login (`FAM-...`), allowing parents to toggle profiles seamlessly in a single desk without multiple sign-ins.
- **Mongoose-Buffered File Streaming:** Dynamic PDF Academic Calendars, assignment attachments, and event banners are stored directly in MongoDB as binary buffers (`Buffer`), offering a self-contained infrastructure without external storage dependencies.
- **Classroom Collaborative Consensus Pipeline:** Actionable student requests of class-level scope undergo collaborative voting inside target classrooms, transitioning to the Administrator's desk automatically once an 80% consensus threshold is reached.
- **Brevo API dispatch:** Sends transactional email through Brevo's REST API instead of SMTP relay configuration.

---

## 🛠️ The Technology Stack

### Backend
- **Runtime:** Node.js (ECMAScript Modules)
- **Framework:** Express (with CORS security, JSON limit controls, and JWT auth router)
- **Database Persistence:** MongoDB via Mongoose ODM
- **File Parsing & Mail:** Multer (memory buffering) & Brevo API
- **Authentication:** Custom scrypt password hashing & JSON Web Token (JWT) bearer credentials

### Frontend
- **Framework:** React SPA (Vite builder)
- **Styling:** Tailwind CSS v4 alongside modular global vanilla CSS variables
- **Routing:** React Router v7 with slugified dynamic path mappings andProtected Portal boundaries
- **Visual Analytics:** Recharts charting engine
- **Utilities & Icons:** Lucide-React & JsPDF

---

## 👥 Role-Based Access Controls (RBAC)

MGPS ERP implements a strict four-tiered role permission matrix:

1. **Administrator (`ADM-` prefix):** Full master administrative override. Manages financial ledgers, fees, user accounts, system preferences, clerk rosters, academic calendar publishing, and final leave reviews.
2. **Clerk (`CLK-` prefix):** Administrative executor. Shares management panels for student roster profiles, sibling connections, teacher assignments, class structures, meeting schedules, and general notices.
3. **Teacher (`TCH-` prefix):** Academic coordinator. Manages class attendance registers, designs assignments with attachment files, drafts exam syllabus, compiles marks, and reviews student absence requests.
4. **Student / Sibling Family (`STD-` / `FAM-` prefix):** Personal desk. Accesses class notice boards, downloads homework files, joins co-curricular events, reviews marks cards, initiates consent requests, and toggles sibling desks.

---

## 📁 System Project Structure

``` 
mgps-erp/
├── package.json          # Workspace scripts
├── frontend/             # Vite React SPA deployed to Vercel
│   ├── package.json
│   ├── .env.example
│   ├── vite.config.js
│   ├── vercel.json
│   ├── index.html
│   ├── public/
│   └── src/
└── backend/              # Express API deployed to Render
    ├── package.json
    ├── .env.example
    ├── scripts/
    └── server/
```

---

## ⚡ Quick Start & Installation

### 1. Prerequisite Installations
Ensure you have **Node.js** (v18 or higher) and **MongoDB** (Local Community Edition or MongoDB Atlas cloud cluster) running.

### 2. Clone and Install Dependencies
Navigate to the root directory and install dependencies:
```bash
npm install
```

### 3. Setup Environment Settings
Copy the workspace templates into each app directory:
```bash
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
```

Fill in the values in each file:
- `frontend/.env`: `VITE_API_BASE_URL`
- `backend/.env`: `MONGODB_URI`, `JWT_SECRET`, `FRONTEND_URL`, `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`, `PORT`

### 4. Create Initial Administrator Account
Run the automated bootstrapper to seed the `ADM-001` account in MongoDB:
```bash
# Ensure you specify TEST_ADMIN_PASSWORD in your environment or shell:
$env:TEST_ADMIN_PASSWORD="YourStrongPasswordWithMinimum12Chars"
node scripts/create_test_admin.js
```

### 5. Launch the Portal

#### Start the Secure Express API Server:
```bash
npm run start:backend
```

#### Launch the Vite React Frontend Dev Server:
```bash
npm run dev:frontend
```

Open your browser and navigate to `http://127.0.0.1:5173/` or `http://localhost:5173/` to log in using the newly provisioned administrator account.

---

## 📊 Core Configuration Variables Reference

| Environment Variable | Description | Default | Required in Production |
| :--- | :--- | :--- | :--- |
| `PORT` | Local Express API port | `5000` | Optional |
| `FRONTEND_URL` | Primary frontend origin | `https://your-vercel-app.vercel.app` | Yes |
| `CORS_ORIGINS` | Additional allowed CORS origins | `http://127.0.0.1:5173,http://localhost:5173` | Optional |
| `MONGODB_URI` | MongoDB connection connection string | *None* | Yes |
| `MONGODB_DB_NAME` | Targeted Database namespace | `mgps_erp` | Optional |
| `JWT_SECRET` | Secret key for signing authorization JWTs | *None* | Yes |
| `AUTH_AUTO_PROVISION` | Automatically creates ADM-001 admin | `false` | No |
| `BREVO_API_KEY` | Brevo REST API key for transactional emails | *None* | Yes |
| `BREVO_SENDER_EMAIL` | Verified sender email used by the Brevo API | *None* | Yes |
| `BREVO_SENDER_NAME` | Sender display name for email dispatch | `MGPS ERP Portal` | No |
| `BREVO_MAX_CONNECTIONS` | Parallel email dispatch workers for `/api/gmail/send` | `3` | No |
| `GEMINI_API_KEY` | Server-side Gemini key for the Admin Feature Page AI assistant | *None* | No |
| `GROQ_API_KEY` | Server-side Groq key for the Admin Feature Page AI assistant | *None* | No |
| `DEFAULT_AI_PROVIDER` | Default AI provider used by `/api/ai/chat` (`gemini` or `groq`) | `groq` | No |
| `GEMINI_MODEL` | Gemini model override for provider calls | `gemini-2.5-flash` | No |
| `GROQ_MODEL` | Groq model override for provider calls | `llama-3.1-8b-instant` | No |

### Admin Feature Page AI Assistant

The Admin Portal Feature Page includes a school-specific AI assistant for **Marigold Secondary School, Behror**. It supports chat, browser microphone speech-to-text, browser text-to-speech, student lookup, finance summaries, attendance/fee charts, admin-confirmed fee payment, receipt generation, receipt PDF download, and receipt send workflows.

Backend AI routes are mounted under `/api/ai`:

- `/api/ai/chat`
- `/api/ai/voice/transcribe`
- `/api/ai/voice/speak`
- `/api/ai/actions/execute`
- `/api/ai/student-details`
- `/api/ai/finance/payment`
- `/api/ai/receipt/send`
- `/api/ai/analytics`

API keys stay on the backend only. If `GEMINI_API_KEY` or `GROQ_API_KEY` is missing, the assistant uses safe development fallback responses from ERP data instead of exposing secrets or failing the page.

---

## 📖 In-Depth System Reference

For detailed specs, database schema charts, custom workflows, state replication trace charts, API directories, and deployment procedures, please refer to our comprehensive developer documentation:
👉 **[Developer Guide & Technical Reference](file:///C:/Users/parvc/.gemini/antigravity-ide/brain/c225e894-8bd3-46bd-be23-f93448fa681f/system_documentation.md)**
