# HCM Lite — AI-Assisted Human Capital Management

AI-assisted Human Capital Management system built for **Admin**, **HR**, and **Employees**, featuring end-to-end attendance, leave management, automated payroll with tax calculation and PDF payslips, real-time analytics, and an intelligent AI assistant.

---

## 🚀 How to Run the App / Application Chalane Ka Tareeqa

### 1. Requirements
- **Node.js**: v20+ or v22 LTS
- **npm**

### 2. Installation & Start
```bash
# Dependencies install karein:
npm install

# Development server start karein:
npm run dev
```

App automatically opens at `http://localhost:3000` (or your assigned development port).

### 3. Tests & Build
```bash
# Test suite chalane ke liye:
npm test

# Production build test karne ke liye:
npm run build
```

---

## 📖 Isse Use Kaise Karna Ha (Complete Step-by-Step Usage Guide)

HCM Lite bilkul fresh/empty state se start hota hai. Iska workflow step-by-step niche diye gaye tareeqay se follow karein:

---

### Step 1: First-Run Setup & Admin Account Banana
1. Jab app first time open hoti hai, **Create Account** tab par jayein.
2. **Setup Type** mein `Organization (Admin)` select karein:
   - **Company Name**: Apna company name enter karein (e.g. `Apex Technologies`).
   - **Full Name**: Admin ka naam (e.g. `Chief Administrator`).
   - **Admin Work Email**: Valid email (e.g. `admin@company.com`).
   - **Password**: Kam az kam 6 characters ka password (e.g. `AdminPass!2026`).
3. **Initialize Organization & Enter** par click karein.
4. System automatically company profile, default departments (`Engineering`, `HR`, `Finance`, `Operations`, `Marketing`), leave types (`Annual`, `Casual`, `Sick`, `Unpaid`), aur Admin root login create kar deta hai.

---

### Step 2: HR Account Banana (Admin View)
1. Admin ke dashboard par login hone ke baad **Employees** tab par click karein.
2. Top right par **Create HR Account** button click karein.
3. Form fill karein:
   - **Name**: HR Manager ka naam (e.g. `Sarah Connor`).
   - **Email**: Corporate email (e.g. `hr@company.com`).
   - **Password**: Password enter karein (e.g. `HrPassword!2026`).
4. **Create HR Account** par click karein. Ab HR account ready hai.

---

### Step 3: Employees Register Karna (HR View)
1. Admin se **Logout** karke HR ke email aur password se **Sign In** karein.
2. Sidebar se **Employees** tab par jayein.
3. **Register Employee** button click karein:
   - First Name, Last Name, Corporate Email enter karein.
   - Department, Designation, Joining Date, aur Basic Salary (PKR) set karein.
4. **Save Employee** click karein.
5. System automatically employee ka account generate karega aur ek **Temporary Password** screen par show karega (e.g. `TempPass!1234`).
6. *Optional*: Bulk employees add karne ke liye **CSV Import** use kar sakte hain jisme dry-run validation error report bhi milta hai.

---

### Step 4: Employee First Sign-In & Temporary Password Change
1. HR account se Logout karein.
2. Registered employee ke email aur **Temporary Password** se **Sign In** karein.
3. System automatically security check trigger karega aur prompt karega:
   > *"Temporary Password Detected. You must set a new permanent password on your first sign-in."*
4. Apna naya permanent password enter karein aur **Set Permanent Password & Enter** dabayein.
5. Ab Employee successfully apne personal portal mein enter ho jayega.

---

### Step 5: Daily Attendance (Check-In & Check-Out)
1. **Check-In**:
   - Employee dashboard ya **Attendance** tab par jayein.
   - **Web Check-In** button click karein.
   - Server current time stamp karega (09:00 AM standard, 15 min grace period; agar 09:15 ke baad check-in ho to status automatically **Late** mark hoga).
   - *Duplicate check-in prevention*: Din mein dobara check-in karne par system error dega.
2. **Check-Out**:
   - Shift end hone par **Web Check-Out** button click karein.
   - Agar total working time 5 ghante se kam ho to automatically **Half Day** count hoga.
3. **Correction Request**:
   - Agar check-in/out mein koi ghalti ho jaye, to Employee **Request Correction** par click karke reason likh kar submit kar sakta hai.
   - HR apne attendance inbox se isse **Approve** ya **Reject** kar sakta hai.

---

### Step 6: Leave Application & Approval
1. **Employee Leave Apply Karein**:
   - **Leave** tab par jayein.
   - Quotas view karein (Annual: 14 days, Casual: 10 days, Sick: 8 days, Unpaid: Unlimited).
   - **Apply for Leave** click karein, leave type, start date, end date, aur reason daalein.
   - System working days calculate karega (weekends aur public holidays automatically exclude honge).
   - Overlap ya quota exceed hone par system block karega.
2. **HR Approval**:
   - HR login karke **Leave** tab par jayein.
   - Pending request par **Approve** ya **Reject** click karke comment add karein.
   - Employee ko foran in-app notification mil jayega.

---

### Step 7: Monthly Payroll Run, Finalize & Payslip Download
1. **HR Prepares Payroll Draft**:
   - HR **Payroll** tab par click karega aur **Prepare Draft** button dabaye ga.
   - Month select karein (e.g. `2026-10`).
   - System automatically gross salary (`1.5 * Basic`), per-day rate, absent deductions, unpaid leave deductions, half-day deductions, late penalties (3 lates = 0.5 day salary), aur income tax slabs calculate karega.
2. **Admin Finalizes & Locks Payroll**:
   - HR draft review kar sakta hai magar finalize **sirf Admin** kar sakta hai.
   - Admin login karega, **Payroll** tab par draft open karega aur **Finalize & Lock Payroll** click karega.
   - Lock hone ke baad yeh month freeze ho jata hai aur changes permit nahi hote.
3. **Employee Payslip Download**:
   - Employee apne **Payroll** tab par ja kar apna finalized payslip view kar sakta hai aur **Download PDF** click karke official salary slip download kar sakta hai.
   - *Security Guard*: Koi employee kisi doosre employee ki salary ya payslip nahi dekh sakta.

---

### Step 8: AI Assistant (M8)
1. Screen par floating **AI Assistant** button par click karein.
2. **Real Data Tools**:
   - Assistant live database se connected hai.
   - HR pooch sakta hai: *"Who is on leave today?"*, *"How many employees in Engineering?"*, *"Who came late most often this month?"*.
   - Employee pooch sakta hai: *"How many sick leaves do I have left?"*.
3. **Confidentiality Rule**:
   - Agar employee kisi colleague ki salary pooche (e.g. *"What is Ali's salary?"*), AI polite tareeqay se refuse karega.
4. **Smart Leave Request**:
   - Employee chat mein likhe: *"Need next Monday and Tuesday off for sister's wedding"* ya Roman Urdu mein: *"Mujhe kal chutti chahiye bukhar ki wajah se"*.
   - AI automatically form pre-fill kar dega.
5. **Dashboard AI Summary**:
   - Admin aur HR dashboard par **Summarize with AI** button click karke current workforce KPIs ka 3-5 high-signal bullet summary le sakte hain.

---

### Step 9: Announcements & Audit Logs
- **Announcements**: Admin aur HR **Communications** tab se announcement post kar sakte hain jo all users ke dashboard par show hoti hai.
- **Audit Log**: Admin **Audit Logs** tab mein ja kar har critical action (login, leave approval, employee creation, payroll finalization) ka detailed actor, action, timestamp, aur before/after state diff check kar sakta hai.

---

## 🔐 Roles & Permissions Matrix

| Feature | Admin | HR | Employee |
|---|:---:|:---:|:---:|
| Company Setup & Operational Rules | Manage | View Only | No Access |
| Create HR Logins | Manage | No Access | No Access |
| Register Employees & Set Salary | View | Manage | Own Profile Only |
| Attendance Check-In / Out | Own | Own | Own |
| Approve Attendance Corrections | View | Approve | Request Only |
| Apply for Leave | Own | Own | Own |
| Approve / Reject Leave | View | Approve | No Access |
| Prepare Payroll Draft | View | Manage | No Access |
| Finalize & Lock Payroll | Manage | No Access | No Access |
| View / Download Payslips | All | All | Own Only |
| Company Analytics Dashboard | Full View | HR View | Personal KPIs Only |
| Audit Trail / Governance Logs | Full View | No Access | No Access |
| AI Assistant Scope | All Data | HR Data | Own Data Only |

---

## ⚙️ Environment Variables (Optional)

Agar AI ya persistent Firestore enable karna ho to `.env` file mein set karein:
- `JWT_SECRET`: 32+ characters random secret key.
- `GEMINI_API_KEY`: Google Gemini API key live LLM responses ke liye.
- `FIREBASE_SERVICE_ACCOUNT_JSON`: Server-side persistent Firestore access ke liye.

*(Baghair in keys ke bhi app apne built-in high-availability local engine aur deterministic AI fallbacks ke sath 100% smoothly chalti hai).*
