# 5-Minute Live Demo Script for Judges
### Saylani Hackathon — HCM Lite

Follow this script step-by-step during the presentation to demonstrate 100% compliance with the challenge brief.

---

### Step 1: Fresh Installation & First-Run Setup (0:00 - 0:45)
1. Open the app in browser. Show that the app detects a fresh install and presents the **First-Run Setup** screen.
2. Enter:
   - Company Name: **Apex Enterprises**
   - Office Start Time: **09:00 AM**, Grace Period: **15 min**, Half Day: **5 hrs**
   - Admin Email: **admin@apex.com**, Password: **AdminSecurePass!2026**
3. Click **"Initialize HCM Lite Organization"**.
4. The system logs in as Admin. Point out that the company profile, default departments, leave quotas, and holidays are created.

---

### Step 2: Admin Creates HR Account (0:45 - 1:15)
1. Navigate to **Employees & HR Logins**.
2. Click **"Create HR Account"**.
   - Name: **Sarah Connor (HR Lead)**
   - Email: **hr@apex.com**
   - Password: **HrPassword!2026**
3. Click **"Create HR Login"**. Point out that the creation is logged in the **Security Audit Feed**.
4. Log out as Admin.

---

### Step 3: HR Registers Employees & Issues Logins (1:15 - 2:00)
1. Log in as HR (`hr@apex.com` / `HrPassword!2026`).
2. Show that the dashboard starts clean with zero fake numbers.
3. Click **"Register Employee"**:
   - Code: **EMP-001**
   - Name: **John Doe**
   - Email: **john.doe@apex.com**
   - Department: **Engineering**, Designation: **Senior Software Engineer**
   - Basic Salary: **100,000 PKR** (Gross = 150,000 PKR)
4. Submit: An automatic modal appears with the generated **Temporary Password** (`TempPass!xxxx`) for John. Click **"Copy Credentials"**.
5. Log out as HR.

---

### Step 4: Employee First Sign-In, Password Change & Check-In (2:00 - 2:45)
1. Log in with John's credentials (`john.doe@apex.com` and the temporary password).
2. The system prompts: **"Temporary Password Detected — You must set a new permanent password on first sign-in."**
3. Enter new password: `Password!2026` and enter.
4. On Employee Dashboard, show the live workstation widget.
5. Click **"Mark Attendance (Check In)"**. Show that the server stamps the time (if after 09:15, flagged as Late).
6. Click **"Camera & Geofence"** to demonstrate the bonus camera stream with face alignment guide and GPS geofence check.

---

### Step 5: Employee Requests Leave via AI in Plain Words (2:45 - 3:30)
1. In the Smart Leave card, click the prompt or open the **Ask AI Assistant** drawer.
2. Type or send:
   > *"I need next Monday and Tuesday off for my sister's wedding"* (or in Roman Urdu: *"Mujhe aglay somwar aur mangal behen ki shadi ke liye chutti chahiye"*).
3. The AI assistant extracts:
   - Leave Type: **Casual**
   - Dates: Next Monday & Tuesday
   - Reason: **Sister's wedding celebration**
4. Click **"Submit Leave Request"**.
5. Log out as Employee.

---

### Step 6: HR Approves Leave & Prepares Payroll Draft (3:30 - 4:15)
1. Log in as HR (`hr@apex.com`).
2. On HR Dashboard, show that **Pending Approvals** count is now 1.
3. Open **Leave Approvals**, click **"Review"** on John's request, and click **"Approve Leave"** with comment *"Approved. Enjoy!"*.
4. Click **"Summarize with AI"** on the HR dashboard to show that the AI generates 3-5 bullet points strictly from real metrics.
5. Go to **Monthly Payroll Draft**, click **"Prepare Payroll Draft"** for `2026-10`.
6. Review the line items table:
   - Basic: 100,000
   - HRA: 40,000 (40%)
   - Medical: 10,000 (10%)
   - Gross: 150,000 (1.5× basic)
   - Deductions & progressive tax slab breakdown.
7. Show that HR **CANNOT** finalize payroll (notice: *"Awaiting Admin Finalization"*).
8. Log out as HR.

---

### Step 7: Admin Finalizes Payroll & Employee Checks Payslip (4:15 - 5:00)
1. Log in as Admin (`admin@apex.com`).
2. Go to **Payroll & Finalize**, click **"Finalize & Lock Payroll (Admin Only)"**.
3. Confirm finalization: The month is locked and payslips are published.
4. Go to **Security & Audit Log**: Show the complete immutable log of all actions with actor, timestamp, and JSON before/after state.
5. Log in as Employee (`john.doe@apex.com`):
   - Go to **My Payslips**.
   - Click **"PDF"** to download the official generated payslip.
   - Open AI Assistant and ask: *"What is Sarah's salary?"*
   - Show that the AI **politely refuses**: *"I cannot share another employee's salary or confidential company payroll information as per HCM Lite confidentiality policy."*

**Judge Conclusion**:
All 9 modules, 25 functionalities, and bonus features demonstrated live with 100% real persisted data!
