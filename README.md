# HCM Lite — AI-assisted Human Capital Management

A web-based HR management demo for the Saylani Hackathon brief. It supports three roles (Admin, HR and Employee) with role-aware server APIs for organization setup, employee records, attendance, leave, payroll, analytics, AI assistance, announcements and audit history.

> **Honest status:** this repository has received a static security/business-rule pass and the pure business-rule tests pass. The full API suite, production build, browser flows, live Gemini calls, Firestore persistence and hosted deployment have not been verified in this environment. Do not present these as passed until you run them.

## Requirements

- Node.js **20.19+** (Node 22 LTS recommended)
- npm
- Optional: Gemini API key for live AI responses
- Optional: Firebase service-account credentials for server-side Firestore persistence

## Run locally

1. Extract the ZIP or clone the repository.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a local `.env` based on `.env.example`. Generate a unique JWT secret (at least 32 characters); do not commit `.env`.
4. Start the app:

   ```bash
   npm run dev
   ```

5. Open the local URL printed by the server. On a fresh store, complete the first-run company/Admin setup screen. The app should start empty; add departments, HR users and employees through the UI.

## Commands

```bash
npm run dev                         # Development server
npm start                           # Start server with Node
npm run build                       # Production frontend build
npm test                            # Unit and API test suites
node --test src/tests/businessRules.test.js  # Pure business-rule tests only
```

## Environment variables

- `JWT_SECRET`: required outside tests; use a strong random secret of 32+ characters.
- `GEMINI_API_KEY` (or `AI_API_KEY`): optional server-only AI provider credential. Never use a `VITE_` prefix for it.
- `GEMINI_MODEL`: optional model override.
- `PORT`: server port, default `3000`.
- `VITE_FIREBASE_*`: public Firebase Web SDK identifiers. These are not server credentials and do not enable Firestore persistence by themselves.
- `FIREBASE_SERVICE_ACCOUNT_JSON` or `GOOGLE_APPLICATION_CREDENTIALS`: optional server-only Firebase Admin credentials for Firestore persistence. Configure these as hosting secrets, never commit the service-account JSON.

## Deployment notes

- Configure all required server environment variables in the host (for example, Vercel project environment settings) and ensure the host supports the Node runtime required by `package.json`.
- Deploy only after `npm install`, `npm test`, and `npm run build` pass in a clean environment.
- A local JSON store may not be durable on serverless/ephemeral filesystems. Use a properly configured cloud database for hosted use, then test persistence across cold starts and concurrent requests.
- The optional Firestore adapter has not been validated against a live project and does not guarantee atomic transactions spanning multiple collections. Back up data and test migrations before production use.
- `firestore.rules` denies direct browser database access; server-side Firebase Admin uses IAM/service-account permissions and bypasses Firestore client rules.
- Camera attendance is intentionally fail-closed/disabled until a real face-detection flow is installed and verified. Do not claim that GPS alone verifies a face.

## Security reminders

- Rotate any API key that has been pasted into chat, logs or source control. Store the replacement as a server environment secret.
- Use a unique production `JWT_SECRET`; changing it invalidates existing signed sessions.
- Restrict access to logs and backups because HR data and audit history can be sensitive.
- This is a hackathon project, not a certified payroll or production HR platform. Validate tax, privacy, retention and employment-law requirements before real use.

## Submission and audit documents

- `SUBMISSION_AUDIT.md` — rubric-by-rubric checklist and remaining verification work.
- `SECURITY_AND_REMAINING_WORK.md` — security notes and known limitations.
- `DEMO_SCRIPT.md` — suggested five-minute walkthrough.
- `INTERVIEW_GUIDE.md` and `INTERVIEW_GUIDE_ROMAN_URDU.md` — technical Q&A preparation.
