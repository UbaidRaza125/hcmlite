# HCM Lite — Beginner-Friendly Interview Preparation Guide
### How to explain the architecture, security, and algorithms with confidence

This guide is written in clear, plain JavaScript terms so you can confidently answer questions from technical judges.

---

## 1. High-Level Architecture
**Q: How is the application structured?**
> *"HCM Lite is built as a full-stack JavaScript application. The frontend uses React with Tailwind CSS and Lucide icons. The backend is an Express.js server running in Node.js. 
> In development, Express mounts Vite's middleware directly so both our API routes at `/api/*` and our React frontend run together on port 3000.
> For the database, we support Cloud Firestore with a resilient persistent atomic store adapter. This ensures that even if remote credentials aren't configured yet, the app works 100% reliably out of the box."*

---

## 2. Authentication & Role-Based Access Control (RBAC)
**Q: How do you prevent unauthorized data access?**
> *"We never rely on frontend button hiding alone. Every request passes through our server-side `authMiddleware`:
> 1. When a user logs in, we verify their password using `bcrypt.compare` and sign a JSON Web Token (JWT) with their `id`, `role`, and `companyId` or `employeeId`.
> 2. The client sends this token in the `Authorization: Bearer <token>` header for all API calls.
> 3. Our server verifies the token and enforces permissions. If an Employee role attempts to call an Admin or HR endpoint, the server immediately returns `403 Forbidden`.
> 4. Record-level scoping: When an Employee requests their profile, attendance, or payslips, the server checks `req.user.employeeId === targetEmployeeId`. An employee cannot access any other employee's data by tampering with IDs or request bodies."*

---

## 3. Core Business Rules & Formulas
**Q: What are the exact formulas you implemented?**
- **Attendance**:
  - Office starts at 09:00 AM with a 15-minute grace period. If an employee clocks in at 09:16 AM or later, `evaluateAttendanceStatus` marks them as `late`.
  - If total working duration (`checkOut - checkIn`) is under 5 hours, it is marked as `half_day`.
  - Duplicate check-ins on the same day return `HTTP 409 Conflict`.
- **Leave Calculations**:
  - Quotas: Annual (14 days), Sick (8 days), Casual (10 days), Unpaid (unlimited).
  - Our `getWorkingDaysCount` function loops through the date range and excludes Saturdays, Sundays, and official public holidays.
  - If a user applies for leave that overlaps an existing pending/approved request or exceeds their remaining quota, the server returns `HTTP 422 Unprocessable Entity`.
- **Payroll Lite**:
  - `Gross Salary = 1.5 * Basic Salary` (Basic is 100%, House Rent Allowance is 40%, Medical is 10%).
  - `Daily Rate = Gross Salary / Working Days in Month`.
  - `Deductions = (Absent Days * Daily Rate) + (Unpaid Leave * Daily Rate) + (Half Days * 0.5 * Daily Rate) + Late Penalty`.
  - Bonus rule: Every 3 late arrivals incur a 0.5-day salary deduction (`Math.floor(lates / 3) * 0.5 * dailyRate`).
  - Tax Slabs on Annual Gross (`Gross * 12`):
    - 0 to 600k: 0%
    - 600k to 1.2M: 5% of amount over 600k
    - 1.2M to 2.4M: 30,000 + 15% of amount over 1.2M
    - 2.4M to 3.6M: 210,000 + 25% of amount over 2.4M
    - > 3.6M: 510,000 + 35% of amount over 3.6M
  - `Monthly Tax = Annual Tax / 12`.
  - `Net Pay = Gross - Deductions - Monthly Tax`.
  - HR prepares drafts; only Admin can finalize and lock payroll.

---

## 4. How the AI Assistant Works
**Q: How did you implement tool calling and security in the AI assistant?**
> *"We use the Google Gemini API (`@google/genai`) on the server. The browser NEVER speaks directly to the AI provider.
> 1. In `src/server/aiService.js`, we define a system prompt that includes the official HCM Lite policies from the brief.
> 2. We implement tool functions such as `get_headcount`, `get_attendance_summary`, `get_late_comers`, `get_leave_summary`, `get_my_leave_balance`, and `search_employees`.
> 3. Each tool enforces the caller's role permissions. For example, if an Employee asks for a colleague's salary or company-wide payroll totals, the AI executes a strict confidentiality guard and politely refuses: 'I cannot share another employee's salary or confidential company payroll information as per HCM Lite confidentiality policy.'
> 4. For smart leave requests, we parse the sentence (in English or Roman Urdu), extract the leave type and dates, and present a confirmation card to the user so data is never committed without explicit user confirmation."*

---

## 5. Key Files Map
- `src/lib/businessRules.js`: Pure JavaScript functions for attendance evaluation, working days count, tax slabs, payroll formulas, and Haversine distance.
- `src/tests/businessRules.test.js`: Fast Node.js unit tests verifying all calculations.
- `src/tests/api.test.js`: End-to-end integration tests verifying setup, role permissions, duplicate check-in blocking, leave approvals, and payroll locking.
- `src/server/routes.js`: All Express REST endpoints for the 25 functionalities.
- `src/server/aiService.js`: Gemini API integration with tool calling and security guards.
- `src/server/storage.js`: Atomic persistence storage adapter.
- `src/context/AuthContext.jsx`: React state management for user session, active company, and quick-login helpers.
