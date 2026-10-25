# Security and remaining work (audit patch)

This patch addresses several identified issues but does **not** certify the project as 100/100 or production-ready.

## Changes in this package
- Updated the esbuild dev dependency to a version compatible with the Vite 8 / tsx dependency range.
- Removed the hardcoded Gemini API credential fallback. Configure `GEMINI_API_KEY` in the hosting environment. Rotate any credential previously committed to the repository.
- Removed the hardcoded JWT signing-secret fallback. Set `JWT_SECRET` to a cryptographically random value of at least 32 characters.
- Enforced temporary-password restriction in server authentication middleware, allowing the password-change route.
- Protected the demo-account listing behind Admin authentication.
- Scoped Employee directory responses to the signed-in employee's own record.
- Made camera attendance fail closed until real face detection is implemented, and require valid GPS accuracy/location evidence before considering geofence checks.
- Disabled destructive reset in production and retained audit history in non-production reset behavior.
- Added AI request size/type checks, a 15-second provider timeout wrapper, an in-memory limit of 20 AI requests per user per hour (single-instance only), and Gemini model-selected function calls routed through server-side role/scope checks. The provider flow still needs live-key/runtime verification.
- Added Firebase Web SDK initialization using the supplied public project config / `VITE_FIREBASE_*` variables and a server-only Firebase Admin Firestore adapter. If service-account credentials are configured, startup loads the Firestore collections or migrates the local JSON store when the Firestore state is new; JSON API responses wait for queued cloud writes. Browser Firestore rules deny direct access.
- Corrected payroll eligibility and salary-component proration for mid-month joiners, clipped approved leave calculations to the payroll month, and validated payroll month values. Repeated finalization now returns conflict and employee analytics are scoped to personal metrics only.
- Persistence write errors are no longer silently ignored. Audit entries are no longer trimmed by a 500-entry cap; leave balances use configured quotas and approved requests in the current calendar year; pending leave requests reserve quota; duplicate leave/correction decisions are rejected; announcements respect target role; first-run setup validates credentials and office/geofence settings.

## Still required before submission
1. Verify Gemini function calling against a rotated, valid API key; keyword routing remains as a deterministic fallback and only one model-selected tool round is handled per request.
2. Validate Firestore adapter against the live Firebase project, especially credential setup, migration of existing data, large imports, concurrent updates, and backup/restore. Current adapter queues serialized collection diffs but does not provide cross-collection transaction semantics for multi-document operations; do not claim production-grade transactional consistency.
3. Complete date-range analytics and strengthen absence/leave intersection handling with broader integration tests; validate calendar dates and configured leave types are now enforced on leave submission.
4. Add persistent atomic payroll finalization and append-only audit storage.
5. Implement face detection if camera attendance is to be advertised.
6. Run dependency installation, production build, all API tests and the 10 critical role/security scenarios.
7. Verify deployment, fresh setup, PDF payslip downloads, accessibility and responsive UI.
8. Verify hosting environment variables and Firestore permissions with a real service account. Browser Firebase config is public app metadata and is not a server credential.

Never commit a real `.env` file or live API credentials.
