# HCM Lite — One-pass submission audit

Basis: `Saylani_Hackathon_HCM_Lite_Brief.pdf` supplied with this project. Statuses below are code-review findings, not a judge score or a live deployment certification.

## Scoring rubric status

| Judging area | Points | Current assessment | Remaining proof/work |
|---|---:|---|---|
| Core HR flows | 25 | Partial / implemented paths need integration verification | Run the full Admin → HR → Employee → leave → payroll → payslip workflow on a clean install; verify CSV import/export and attendance correction. |
| Data & analytics | 20 | Partial | Employee analytics now returns personal data only; add and test date-range/department filters and compare every dashboard metric with records. |
| AI features | 15 | Partial | Gemini function calling and fallbacks are in code, but live key, tool accuracy, Roman Urdu, AI log coverage and provider timeout need live tests. |
| Code quality | 15 | Partial | Business rules are extracted and unit tests exist; install dependencies and run full integration suite, production build, lint/type checks if configured. |
| UI / UX | 10 | Partial / static review only | Browser testing still needed for loading, empty/error states, responsive widths, keyboard accessibility and camera-disabled messaging. |
| Security & RBAC | 10 | Improved, not production-certified | Added role/scope checks, validation, server-side AI credentials, protected setup routes and duplicate-decision guards. Re-test every route and use a real cloud database configuration. |
| Demo & docs | 5 | Partial | README/demo scripts exist; hosted deployment, first-run setup and 5-minute demo are not verified. |

## Functionality checklist (25 items from the brief)

| # | Requirement | Status |
|---:|---|---|
| 01 | First-run company/Admin setup | Implemented; API workflow test added, but suite could not run without dependencies. |
| 02 | Login/logout/password change, role menus/dashboards | Login/password-change and role menu paths exist; logout/session revocation and full role flows need verification. |
| 03 | Company settings, office hours, grace period, weekend, geofence | Settings exist; first-run values are validated. Weekend and company-specific policy propagation need broader tests. |
| 04 | Departments, designations, leave types/quotas, holidays | Departments, leave types, holidays exist; designation and quota administration needs UI/API completeness review. |
| 05 | Create/deactivate/reset HR logins | Admin endpoints exist; test deactivate/reset and password reset notification flows. |
| 06 | Register employee + login, edit details | Implemented endpoints and UI; test validation and all fields. |
| 07 | Directory/search/filter, Employee 360 | Implemented; Employee directory is scoped and omits salary field; test pagination and all roles. |
| 08 | CSV import dry-run/report and export | Endpoints/UI exist; validate malformed rows, duplicates and dry-run behavior. |
| 09 | Web check-in/check-out | Implemented; API end-to-end test added but not executed. |
| 10 | Attendance calendar/daily board | Daily board exists; calendar/filter edge cases need verification. |
| 11 | Attendance correction request/approval | Implemented; invalid and repeated decisions are now rejected; needs API test execution. |
| 12 | Apply/cancel leave, balance/history | Apply/balance/history implemented; leave balance now uses configured quotas and calendar-year approved days. Explicit cancellation flow needs verification. |
| 13 | Leave approval/rejection with comment | Implemented; duplicate review rejected with conflict. |
| 14 | Salary structure per employee | Basic salary fields and calculation exist; full salary-component administration needs review. |
| 15 | Monthly payroll draft/review | Implemented; payroll proration/month validation added; calculation edge cases need integration checks. |
| 16 | Admin finalize/lock payroll | Admin-only; repeated finalize returns conflict. Cross-request/cloud atomicity is not certified. |
| 17 | Payslips with PDF download | Payslip records exist and frontend PDF generation is present; verify in browser. |
| 18 | Dashboards, KPIs, trends, filters | Dashboards/KPIs exist; full date-range and department filters remain incomplete/unverified. |
| 19 | AI chat answering from real data | Tool functions and role checks exist; live Gemini and deterministic fallback coverage require verification. |
| 20 | AI dashboard summary | Implemented with fallback; validate output against filtered KPI data. |
| 21 | Smart leave prefill | Implemented for employee role; date parsing and Roman Urdu need live tests. |
| 22 | Policy Q&A | Policy prompt exists; must test hallucination refusal and Roman Urdu queries. |
| 23 | Announcements | Implemented; target-role filtering added; test Admin/HR/Employee visibility. |
| 24 | In-app notifications | Notification records exist for some flows; ensure every leave decision and payslip path is covered. |
| 25 | Audit log for create/update/approve/finalize | Audit records exist and no longer trim older entries; review all mutation routes for complete before/after capture. |

## Bonus (+10) status

- Camera attendance with face detection + location: **not implemented as a valid face-check flow**. Camera check-in intentionally fails closed until face detection is real; GPS alone must not be represented as face verification.
- Attrition risk score: not implemented.
- Absence anomaly flags: not implemented.
- Late penalty rule (3 lates = half-day salary): calculation implemented; integration against payroll records needs verification.
- Roman Urdu AI: prompt/fallback support exists; live evaluation required.
- Dark mode / PWA: not certified; inspect current UI before claiming.

## Firebase setup

- Public Firebase Web SDK config is included in `src/lib/firebase.js` and can be overridden with `VITE_FIREBASE_*` variables.
- Optional server-side Firestore adapter is included. To enable it, configure `FIREBASE_SERVICE_ACCOUNT_JSON` (secret JSON) or `GOOGLE_APPLICATION_CREDENTIALS` on the server. Do not use the public web config as server credentials.
- Adapter loads Firestore collections on startup or migrates the local JSON store when Firestore has not been initialized. Local JSON is retained as a backup. It serializes cloud writes before successful JSON responses.
- **Not verified against the live Firebase project.** The adapter uses collection diffs and does not provide cross-collection transaction semantics for multi-document business operations. Validate concurrent writes, migration, backups, permissions and larger imports before production use.

## Test / build evidence in this environment

- `node --check` passed for changed JavaScript files.
- Business-rule suite: **9 tests passed** after adding configured-quota/calendar-year coverage.
- API suite was changed to use a real ephemeral HTTP listener and includes RBAC/scope checks, but it could not be executed here because dependency installation timed out and `express` is unavailable in this runtime.
- Production build, live Gemini calls, Firestore credentials, browser tests and hosted deployment remain unverified.

Do not claim a verified 100/100 score until the remaining items above are executed and demonstrated against the supplied judging rubric.
