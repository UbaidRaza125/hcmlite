# HCM Lite — Roman Urdu Interview & Demo Guide
### Saylani Hackathon ke liye mukammal tayari (Aapki zaban mein)

Yeh guide khas taur par aapke liye tayar ki gayi hai taake aap judges ke samnay 100% confidence ke sath app demo kar sakein aur har technical sawal ka asani se jawab de sakein.

---

## 1. Project ka Khulasa (Overview)

**HCM Lite** ek production-level Human Capital Management web application hai jisme 3 mukhtalif roles hain:
1. **Admin** (Company ka sarbarah — settings, organization rules, HR account creation, payroll finalize karna, aur audit logs).
2. **HR** (People operations — employees register karna, attendance corrections, leave approvals, payroll draft tayar karna).
3. **Employee** (Self-service — web/camera attendance, leave balance dekhna aur apply karna, payslips download karna, aur AI assistant use karna).

**Khas Baat**: 
- Poora code **100% Pure JavaScript aur JSX (`.js`, `.jsx`)** mein likha gaya hai, koi TypeScript nahi hai taake aap asaani se samajh sakein.
- App bilkul **empty (khali)** start hoti hai — koi fake ya dummy data nahi hai. Har graph aur number asli user input se calculate hota hai.

---

## 2. Nine (9) Modules aur 25 Functionalities ka Khulasa

### M1: Auth & Access Control
- **First-run Setup**: Pehli dafa chalane par app detect karti hai ke company nahi bani hui, aur Admin account banane ka form deti hai. Ek dafa ban jaye to setup lock ho jata hai.
- **JWT & Bcrypt**: Passwords ko `bcryptjs` se hash kiya gaya hai aur har session ke liye JWT token banta hai.
- **Temporary Password Rule**: Jab HR kisi employee ko register karta hai to system auto ek temporary password (maslan `TempPass!4829`) banata hai. Employee jab pehli baar sign-in karega to usay apna permanent password lazmi tabdeel karna parega.
- **Server-Side Data Scope**: Frontend pe buttons chupana kafi nahi hota. Server har request pe check karta hai ke employee sirf apna data (`req.user.employeeId`) dekh sakta hai. Kisi doosray ki salary ya record dekhne par **403 Forbidden** error milta hai.

### M2: Organization Setup
- Office start time (**09:00 AM**), grace period (**15 minutes**), half-day duration (**< 5 hours**).
- Camera geofence ke liye Office ke GPS coordinates (latitude, longitude) aur radius (maslan 150 meters).
- Departments, designations, official leave quotas, aur public holidays.

### M3: Employee Management
- Server-side search, department filter, status filter, aur pagination.
- Naya employee register karna aur temporary password issue karna.
- **CSV Bulk Import**: Isme pehle "Dry Run" test hota hai jo har row, field, aur ghalati ki wajah batata hai. Phir live import hota hai.
- **CSV Export**: Ek click par tamaam staff ka data CSV file mein download.
- **Employee 360 View**: Employee ka mukammal profile, recent attendance, aur leave history.

### M4: Attendance Module
- **Web Check-in / Check-out**: Server apne time se stamp karta hai (browser ka time trust nahi hota).
- Ek din mein sirf ek dafa check-in ho sakta hai (dobara karne par **409 Conflict** error).
- 09:15 AM ke baad check-in par auto **Late** status lagta hai.
- 5 ghantay se kam kaam karne par auto **Half Day** status lagta hai.
- **Bonus Camera Attendance**: Mobile ya laptop camera khulta hai, face detection ka frame ata hai, aur browser GPS se Haversine formula laga kar office boundary verify hoti hai.
- **Corrections**: Employee ghalat attendance theek karne ki request bhej sakta hai aur HR usay reason dekh kar approve/reject karta hai.

### M5: Leave Management
- **Quotas**: Annual (14 din), Sick (8 din), Casual (10 din), Unpaid (unlimited).
- **Working Days Only**: Saturday, Sunday aur official holidays ko automatically chorr kar sirf working days count hotay hain.
- Overlapping leaves ya balance se zyada chutti apply karne par server **422 Unprocessable Entity** error deta hai.
- HR inbox mein comment ke sath approval/rejection hoti hai. Approved leave walay din attendance khud-bakhud `on_leave` mark ho jati hai.

### M6: Payroll Lite
- **Formulas**:
  - `Gross Salary = 1.5 × Basic Salary` (Basic = 100%, HRA = 40%, Medical = 10%).
  - `Daily Rate = Gross ÷ Month ke Working Days`.
  - `Deductions = (Absent din × Daily Rate) + (Unpaid Leave × Daily Rate) + (Half Day × 0.5 × Daily Rate) + Late Penalty`.
  - **Bonus Late Rule**: Har 3 late arrivals par aadhay (0.5) din ki salary deduction hoti hai!
  - **Tax Slabs (Annual Gross = Gross × 12 par)**:
    - 0 se 600,000 tak: 0% Tax
    - 600,001 se 1,200,000 tak: 600k se ooper ki raqam ka 5%
    - 1,200,001 se 2,400,000 tak: 30,000 + 1.2M se ooper ka 15%
    - 2,400,001 se 3,600,000 tak: 210,000 + 2.4M se ooper ka 25%
    - 3,600,000 se ooper: 510,000 + 3.6M se ooper ka 35%
  - `Monthly Tax = Salana Tax ÷ 12`.
  - `Net Pay = Gross - Deductions - Monthly Tax`.
- HR draft banata hai; **sirf Admin** payroll ko finalize aur lock kar sakta hai. Finalize honay ke baad record freeze ho jata hai.
- Employee apna payslip dekh sakta hai aur **PDF download** kar sakta hai.

### M7: Analytics & Dashboards
- Admin, HR, aur Employee ke liye 3 alag alag dashboards.
- Tamam numbers server-side calculate hotay hain live database se.
- Headcount, attendance rate, late %, absenteeism %, aur leave utilization.

### M8: AI Assistant (Gemini API)
- Google Gemini API (`@google/genai`) se powered hai.
- **Tool Calling**: Model direct database ko query nahi karta, balkay server ke tools call karta hai (`get_headcount`, `get_attendance_summary`, `get_late_comers`, `get_leave_summary`, `get_my_leave_balance`, `search_employees`).
- **Confidentiality Guard**: Agar koi employee poochay ke *"John ki salary kitni hai?"*, to AI foran politely inkaar kar deta hai: *"I cannot share another employee's salary or confidential company payroll information as per HCM Lite confidentiality policy."*
- **Smart Leave (Roman Urdu + English)**: Agar employee likhay *"Mujhe aglay somwar aur mangal behen ki shadi ke liye chutti chahiye"*, to AI dates aur casual leave nikaal kar form bhar deta hai aur user confirm karta hai.
- **Dashboard Summarize**: "Summarize with AI" dabane par live KPI data ke 3-5 bullet points summary banti hai.

### M9: Comms & Security Audit Trail
- Company announcements aur notifications.
- **Security Audit Log (Admin Only)**: Har ahem action (user create, leave approve, payroll finalize, settings update) ka record rakhta hai — Actor, Action, Time, aur JSON Before/After inspector ke sath.

---

## 3. 5-Minute Live Demo Flow (Judges ke samnay kya karna hai)

1. **Minute 1 — Fresh Install & Admin Setup**:
   - Browser kholein. Dikhayein ke system fresh install detect kar ke **First-Run Setup** screen dikha raha hai.
   - Company Name: `Apex Enterprises`, Admin: `admin@apex.com` daal kar initialize karein.
   - System Admin dashboard pe chala jayega. Dikhayein ke headcount aur metrics 0 hain kyunke koi dummy data nahi hai.

2. **Minute 2 — Admin Creates HR Login**:
   - `Employees & HR Logins` tab pe jayein aur `Create HR Account` dabayein (`hr@apex.com`, password `HrPassword!2026`).
   - Audit log mein dikhayein ke yeh event log ho chuka hai. Log out karein.

3. **Minute 3 — HR Registers Employee & Provisions Login**:
   - HR ban kar login karein (`hr@apex.com`).
   - `Register Employee` dabayein: Employee Code `EMP-001`, Name `John Doe`, Basic Salary `100,000 PKR`.
   - Form submit karein: Screen pe John ka auto-generated **Temporary Password** (`TempPass!xxxx`) show hoga. Copy karein aur log out karein.

4. **Minute 4 — Employee Signs in, Changes Password & Checks in**:
   - John ke credentials se login karein.
   - System foran bolega: *"Temporary Password Detected — You must set a permanent password."*
   - Naya password set karein aur andar dakhil hon.
   - Web attendance se **Check In** dabayein. Dikhayein ke server time stamp ho gaya.
   - Camera button daba kar Geofence distance aur camera live preview dikhayein.
   - AI Assistant kholein aur Roman Urdu mein likhein:
     *"Mujhe aglay somwar aur mangal behen ki shadi ke liye chutti chahiye"*
   - AI form auto-fill karega. Confirm kar ke submit karein. Log out karein.

5. **Minute 5 — HR Approves Leave, Prepares Payroll & Admin Finalizes**:
   - HR login karein: Leave Approvals mein ja kar John ki leave approve karein.
   - Dashboard pe "Summarize with AI" click kar ke real numbers ki AI summary dikhayein.
   - Payroll Draft banayein month `2026-10` ka. Dikhayein ke Gross = 1.5× Basic (150,000), tax slabs aur deductions calculate ho gaye hain. Dikhayein ke HR finalize nahi kar sakta.
   - Admin login karein aur **"Finalize & Lock Payroll"** dabayein.
   - Dobara John (Employee) login karein: `My Payslips` mein ja kar apna finalized slip dekhein aur **PDF Download** kar ke dikhayein.
   - AI assistant se poochain: *"What is my colleague's salary?"* aur AI ka polite inkaar dikhayein!
   - Admin audit log mein complete security trail dikha kar demo finish karein!

---

## 4. Judges ke Sawalaat aur Unke Zabardast Jawabaat

**Sawal 1: Aapne backend aur database kaise implement kiya hai?**
> **Jawab**: *"Sir, humne Node.js aur Express ka backend banaya hai aur Cloud Firestore ke sath atomic persistent storage adapter use kiya hai. Tamam business rules (attendance late threshold, working days excluding weekends, payroll formulas, tax slabs) backend pe chalte hain aur JWT session se authenticate hotay hain."*

**Sawal 2: Security aur Data Scoping kaise handle ki hai?**
> **Jawab**: *"Sir, humne sirf frontend par buttons nahi chupaye, balkay har API route par role-based middleware (`requireRole`) aur data-scope guard lagaya hai. Agar employee role kisi doosray employee ki profile, attendance, ya payslip ID call karne ki koshish kare, to server `403 Forbidden` return karta hai. Passwords bcrypt se encrypted hain aur tamaam actions ka immutable audit log maintain hota hai."*

**Sawal 3: AI Assistant ko unauthorized data se kaise mehfooz rakha hai?**
> **Jawab**: *"Sir, model ko direct database access bilkul nahi diya gaya. AI hamare banaye huway server tools call karta hai jo user ke session scope ko check kartay hain. Agar employee kisi doosray employee ki salary poochay to system prompt aur code level dono par strict guard laga hai jo foran polite refusal return karta hai. Chutti waghera ke mamlay mein AI direct save nahi karta, balkay pehle structured confirmation card dikhata hai taake user review kar ke submit kare."*

**Sawal 4: Payroll aur Tax Slabs ka formula kya hai?**
> **Jawab**: *"Sir, hackathon PDF ke mutabiq Gross Salary = 1.5 × Basic Salary hai, jisme HRA 40% aur Medical 10% hai. Daily rate = Gross ÷ Working Days in month. Deductions absent din, unpaid leave, aur half days ke hisaab se hoti hain, aur bonus late penalty rule ke mutabiq har 3 late arrivals par 0.5 din deduct hota hai. Tax annual gross (`Gross × 12`) par progressive slabs ke mutabiq calculate ho kar monthly net pay tayar karta hai."*
