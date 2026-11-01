# Atelier Vela — Celebration & Event Planning Studio

**Atelier Vela** is a full-stack, GenAI-powered celebration and event planning studio designed for organizing weddings, milestone birthdays, and community gatherings. It unifies itemized budget ledgers, chronological run-of-show timelines, vendor contract checklists, guest RSVP rosters, client PDF presentations, and real-time multi-user team collaboration in one workspace.

---

## Key Features

### 1. GenAI Event Architecture & Co-Pilot (Server-Side Gemini API)
- **Full Celebration Blueprint Generator (`/api/ai/generate-blueprint`)**: Generates a tailored event plan—including refined aesthetic direction, realistic budget allocations summing within your target limit, chronological run-of-show cues, vendor checklist entries, and creative concept cards—based on event category (`wedding`, `birthday`, `community`), guest headcount, date, venue, and budget.
- **Personalized Concept, Timeline & Vendor Ideation (`/api/ai/ideate`)**: Accepts natural-language prompts (e.g., *"Candlelit zero-waste botanical tablescape"* or *"Rain-contingency courtyard lighting & flow"*) and returns structured concept cards, timeline cues, and vendor profiles that can be committed directly to the live workspace in one click.
- **Financial Controller Audit (`/api/ai/optimize-budget`)**: Analyzes committed vs. estimated budget lines against the target budget cap to identify savings opportunities and category rebalancing recommendations.

### 2. Core Production Modules
- **Executive Overview & Guest RSVP Roster**: Displays 4-column tabular KPIs, curated concept cards with team endorsement voting, and a live guest party RSVP & seating assignment table (*Invited → Confirmed → Declined*).
- **Itemized Budget Ledger**: Filter by category (*Venue, Catering, Decor, Music, Attire, Logistics*), track estimated vs. paid commitments with tabular alignment, and cycle payment statuses (*Planned → Deposit Paid → Paid in Full*).
- **Chronological Run-of-Show Timeline**: Filter by production phase (*Pre-Event, Setup, Ceremony/Main, Reception, Wrap-Up*), assign lead coordinators, and toggle execution states (*Upcoming → In Progress → Completed*).
- **Vendor Checklist & Contract Tracker**: Searchable directory of studio partners tracking service discipline, lead contact, quoted fees, deliverables, and contract stages (*Researching → Shortlisted → Contracted → Confirmed*).

### 3. Real-Time Multi-User Collaboration
- **Live Cloud Firestore Sync**: Every event and subcollection (`budgetItems`, `timelineItems`, `vendors`, `guests`, `ideas`, `collabNotes`, `members`) updates in real time across all connected planners and guests via `onSnapshot`.
- **Shareable Workspace ID & Invite Code**: Co-planners and VIP guests can join an existing celebration workspace using its Workspace ID and Invite Code.
- **WebSocket Room Presence & Activity Stream (`/ws/collab`)**: Displays which teammates are currently online, which module tab they are inspecting, and live activity pulses as items are created or updated.

### 4. Client Presentation PDF Exporter
- **One-Click & Studio PDF Reports (`jspdf` + `jspdf-autotable`)**:
  - Export **Budget Ledger Only**, **Run of Show Only**, or a **Combined Client Presentation Dossier**.
  - Customize the **Prepared For** stakeholder line, **Executive Cover Memo**, optional **Contracted Vendor Roster Appendix**, and **Gemini Financial Audit Note** with a live layout preview before downloading the vector `.pdf`.

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons
- **Backend & Real-Time**: Node.js, Express, `ws` (WebSocket Server), Vite Middleware (in development)
- **AI Integration**: `@google/genai` SDK (Server-side `gemini-3.8-flash` with structured JSON `responseSchema`)
- **Database & Auth**: Firebase Authentication (Google Sign-In) & Cloud Firestore
- **PDF Generation**: `jspdf` & `jspdf-autotable`
- **Security Rules Linting**: ESLint + `@firebase/eslint-plugin-security-rules`

---

## Project Structure

```text
├── server.ts                         # Express HTTP server, Gemini API routes, & WebSocket server (Port 3000)
├── firebase-applet-config.json       # Firebase project & database configuration
├── firebase-blueprint.json           # Intermediate representation (IR) of entities & Firestore paths
├── firestore.rules                   # Production Attribute-Based Access Control (ABAC) Firestore rules
├── firestore.rules.test.ts           # "Dirty Dozen" adversarial payload test specification
├── security_spec.md                  # Data invariants and security architecture specification
├── src/
│   ├── App.tsx                       # Main workspace UI, real-time subscriptions, and module tabs
│   ├── firebase.ts                   # Firebase SDK initialization, Auth helpers, and error handler
│   ├── types.ts                      # TypeScript interfaces and schema sanitization helpers
│   ├── sampleTemplates.ts            # Curated presets for Wedding, Birthday, and Community events
│   ├── index.css                     # Tailwind CSS v4 imports and typography tokens
│   ├── components/
│   │   ├── ClientPdfModal.tsx        # Interactive Client Presentation PDF preview & export studio
│   │   └── EditorialIllustration.tsx # Resilient SVG architectural plates for each event archetype
│   └── utils/
│       └── pdfExport.ts              # Vector PDF table generator for Budget Ledger & Run of Show
└── package.json
```

---

## Setup & Installation Instructions

### 1. Prerequisites
- **Node.js**: v20+ recommended
- **npm**: v10+
- **Gemini API Key**: A valid Google Gemini API key
- **Firebase Project**: Configured with Authentication (Google Sign-In provider enabled) and Cloud Firestore

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env` in the project root and set your environment variables:

```bash
cp .env.example .env
```

Edit `.env`:
```env
# Required for server-side Gemini AI endpoints (/api/ai/*)
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"

# Optional application URL
APP_URL="http://localhost:3000"
```

### 4. Configure Firebase
Ensure `firebase-applet-config.json` in the project root contains your Firebase Web App credentials and `firestoreDatabaseId`:

```json
{
  "projectId": "your-firebase-project-id",
  "appId": "your-app-id",
  "apiKey": "your-firebase-web-api-key",
  "authDomain": "your-firebase-project-id.firebaseapp.com",
  "firestoreDatabaseId": "your-firestore-database-id",
  "storageBucket": "your-firebase-project-id.firebasestorage.app",
  "messagingSenderId": "your-sender-id"
}
```

### 5. Start the Development Server
Run the full-stack Express + Vite + WebSocket server on port `3000`:

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## Verification, Linting & Production Build

### TypeScript Type Checking
```bash
npm run lint
```

### Firestore Security Rules Linting
Validate `firestore.rules` using `@firebase/eslint-plugin-security-rules`:
```bash
npx eslint firestore.rules
```

### Production Build & Start
Compile the frontend bundle to `dist/` and run the production server:
```bash
npm run build
npm start
```

---

## Security & Data Architecture Notes

- **Server-Side AI Execution**: All `@google/genai` calls execute exclusively on the Express server (`server.ts`); `GEMINI_API_KEY` is never exposed to the browser bundle.
- **Zero-Trust Firestore Rules**: `firestore.rules` enforces verified user authentication (`email_verified == true`), strict field allowlists (`hasAll` / `hasOnly`), string length bounds synchronized with `firebase-blueprint.json`, immutable identity/timestamp fields (`request.time`), parent-document Master Gate checks, and PII isolation.
