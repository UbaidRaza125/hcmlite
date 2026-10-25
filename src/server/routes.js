import express from 'express';
import { loadStore, saveStore, resetStore, flushStore } from './storage.js';
import {
  hashPassword,
  comparePassword,
  signToken,
  authMiddleware,
  requireRole,
  logAudit,
} from './auth.js';
import {
  isWeekend,
  getWorkingDaysCount,
  evaluateAttendanceStatus,
  calculatePayroll,
  verifyGeofence,
  calculateLeaveBalances,
} from '../lib/businessRules.js';
import {
  chatWithAssistant,
  summarizeDashboard,
  parseSmartLeave,
} from './aiService.js';

const router = express.Router();

// Ensure configured Firestore writes finish before a successful JSON response is sent.
// Local JSON persistence is written synchronously first as a recoverable backup.
router.use((req, res, next) => {
  const sendJson = res.json.bind(res);
  res.json = (payload) => flushStore()
    .then(() => sendJson(payload))
    .catch((error) => {
      console.error('Persistence commit failed before response:', error);
      if (res.headersSent) return undefined;
      res.status(503);
      return sendJson({ error: 'The change could not be confirmed in the configured database. Please retry after checking database connectivity.' });
    });
  next();
});

// In-memory per-user AI budget (20 requests/hour as required by the brief).
// For multi-instance deployments, move this counter to a shared store such as Redis.
const aiRequestWindows = new Map();
function aiRateLimit(req, res, next) {
  const key = req.user?.id;
  if (!key) return res.status(401).json({ error: 'Authentication required.' });
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const current = aiRequestWindows.get(key);
  const window = !current || now - current.startedAt >= windowMs
    ? { startedAt: now, count: 0 }
    : current;
  if (window.count >= 20) {
    const retryAfter = Math.max(1, Math.ceil((window.startedAt + windowMs - now) / 1000));
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({ error: 'AI request limit reached (20 per hour). Please try again later.' });
  }
  window.count += 1;
  aiRequestWindows.set(key, window);
  next();
}


// ==========================================
// MODULE 1: SETUP & AUTHENTICATION
// ==========================================

// Check first-run configuration state
router.get('/setup/status', (req, res) => {
  const store = loadStore();
  res.json({
    isConfigured: !!store.company,
    companyName: store.company ? store.company.name : null,
  });
});

// Helper for judge demo quick access
router.get('/setup/demo-accounts', (req, res) => {
  const store = loadStore();
  const accounts = store.users.map(u => ({
    role: u.role,
    email: u.email,
    name: u.name,
    hasTempPassword: !!u.temporaryPassword,
  }));
  res.json(accounts);
});

// First-run setup: creates initial company and Admin account
router.post('/setup/init', async (req, res) => {
  const store = loadStore();
  if (store.company) {
    return res.status(400).json({ error: 'System is already configured and locked.' });
  }

  const {
    companyName,
    adminName,
    adminEmail,
    adminPassword,
    officeStart = '09:00',
    graceMinutes = 15,
    halfDayHours = 5,
    officeLat = 24.8607,
    officeLng = 67.0011,
    officeRadius = 150,
  } = req.body;

  if (typeof companyName !== 'string' || !companyName.trim() || companyName.trim().length > 160 ||
      typeof adminEmail !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail.trim()) ||
      typeof adminPassword !== 'string' || adminPassword.length < 6 || adminPassword.length > 128) {
    return res.status(400).json({ error: 'Company name (1–160 chars), valid admin email, and password (at least 6 chars) are required.' });
  }
  const parsedOfficeLat = officeLat !== undefined && Number.isFinite(Number(officeLat)) ? Number(officeLat) : 24.8607;
  const parsedOfficeLng = officeLng !== undefined && Number.isFinite(Number(officeLng)) ? Number(officeLng) : 67.0011;
  const parsedRadius = officeRadius !== undefined && Number.isFinite(Number(officeRadius)) && Number(officeRadius) >= 10 ? Number(officeRadius) : 150;
  const parsedGrace = graceMinutes !== undefined && Number.isFinite(Number(graceMinutes)) ? Number(graceMinutes) : 15;
  const parsedHalfDay = halfDayHours !== undefined && Number.isFinite(Number(halfDayHours)) ? Number(halfDayHours) : 5;
  const validOfficeStart = typeof officeStart === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(officeStart) ? officeStart : '09:00';

  // 1. Create company
  const company = {
    id: `comp_${Date.now()}`,
    name: companyName.trim(),
    officeHoursStart: validOfficeStart,
    graceMinutes: parsedGrace,
    halfDayHours: parsedHalfDay,
    weekendDays: [0, 6], // Sunday, Saturday
    officeLat: parsedOfficeLat,
    officeLng: parsedOfficeLng,
    officeRadius: parsedRadius,
    setupCompletedAt: new Date().toISOString(),
  };

  // 2. Default departments
  const defaultDepts = [
    { id: 'dept_eng', companyId: company.id, name: 'Engineering', code: 'ENG' },
    { id: 'dept_hr', companyId: company.id, name: 'Human Resources', code: 'HR' },
    { id: 'dept_fin', companyId: company.id, name: 'Finance', code: 'FIN' },
    { id: 'dept_ops', companyId: company.id, name: 'Operations', code: 'OPS' },
    { id: 'dept_mkt', companyId: company.id, name: 'Marketing', code: 'MKT' },
  ];

  // 3. Default designations
  const defaultDesignations = [
    { id: 'des_swe', companyId: company.id, departmentId: 'dept_eng', title: 'Software Engineer' },
    { id: 'des_lead', companyId: company.id, departmentId: 'dept_eng', title: 'Tech Lead' },
    { id: 'des_hrm', companyId: company.id, departmentId: 'dept_hr', title: 'HR Manager' },
    { id: 'des_finm', companyId: company.id, departmentId: 'dept_fin', title: 'Finance Executive' },
  ];

  // 4. Default Leave Types with official quotas
  const defaultLeaveTypes = [
    { id: 'leave_annual', companyId: company.id, name: 'Annual Leave', quotaDays: 14, isPaid: true },
    { id: 'leave_sick', companyId: company.id, name: 'Sick Leave', quotaDays: 8, isPaid: true },
    { id: 'leave_casual', companyId: company.id, name: 'Casual Leave', quotaDays: 10, isPaid: true },
    { id: 'leave_unpaid', companyId: company.id, name: 'Unpaid Leave', quotaDays: 999, isPaid: false },
  ];

  // 5. Default Public Holidays
  const currentYear = new Date().getFullYear();
  const defaultHolidays = [
    { id: 'hol_1', companyId: company.id, name: 'New Year', date: `${currentYear}-01-01` },
    { id: 'hol_2', companyId: company.id, name: 'Labour Day', date: `${currentYear}-05-01` },
    { id: 'hol_3', companyId: company.id, name: 'Independence Day', date: `${currentYear}-08-14` },
    { id: 'hol_4', companyId: company.id, name: 'Quaid-e-Azam Day', date: `${currentYear}-12-25` },
  ];

  // 6. Create Admin user
  const hashedPassword = await hashPassword(adminPassword);
  // Re-check after async hashing to prevent two concurrent first-run requests creating admins.
  if (loadStore().company) return res.status(409).json({ error: 'System was configured by another request. Please sign in.' });
  const adminUser = {
    id: `user_admin_${Date.now()}`,
    companyId: company.id,
    name: adminName || 'System Administrator',
    email: adminEmail.trim().toLowerCase(),
    passwordHash: hashedPassword,
    role: 'admin',
    temporaryPassword: false,
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  store.company = company;
  store.departments = defaultDepts;
  store.designations = defaultDesignations;
  store.leaveTypes = defaultLeaveTypes;
  store.holidays = defaultHolidays;
  store.users = [adminUser];
  saveStore(store);

  const token = signToken(adminUser);
  logAudit({
    actor: adminUser,
    action: 'INITIAL_SETUP',
    entity: 'Company',
    entityId: company.id,
    details: `Company ${company.name} and Admin ${adminUser.email} established.`,
  });

  res.status(201).json({
    success: true,
    message: 'First-run setup successfully completed.',
    token,
    user: {
      id: adminUser.id,
      name: adminUser.name,
      email: adminUser.email,
      role: adminUser.role,
      companyId: adminUser.companyId,
    },
  });
});

// Login route
router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const store = loadStore();
  const user = store.users.find(u => u.email === email.trim().toLowerCase());
  if (!user || !user.isActive) {
    return res.status(401).json({ error: 'Invalid email credentials or account is deactivated.' });
  }

  const isMatch = await comparePassword(password, user.passwordHash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid password.' });
  }

  const token = signToken(user);
  logAudit({
    actor: user,
    action: 'USER_LOGIN',
    entity: 'User',
    entityId: user.id,
    details: `${user.role.toUpperCase()} logged in`,
  });

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      employeeId: user.employeeId || null,
      temporaryPassword: !!user.temporaryPassword,
    },
  });
});

// Fast Employee Self-Registration (Name, Email, Password)
router.post('/auth/register-employee', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Full name is required.' });
  }
  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ error: 'Valid corporate or personal email is required.' });
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  const store = loadStore();
  if (!store.company) {
    const defaultCompany = {
      id: `comp_${Date.now()}`,
      name: 'Apex Enterprises',
      officeHoursStart: '09:00',
      graceMinutes: 15,
      halfDayHours: 5,
      weekendDays: [0, 6],
      officeLat: 24.8607,
      officeLng: 67.0011,
      officeRadius: 150,
      setupCompletedAt: new Date().toISOString(),
    };
    const currentYear = new Date().getFullYear();
    store.company = defaultCompany;
    store.departments = [
      { id: 'dept_eng', companyId: defaultCompany.id, name: 'Engineering', code: 'ENG' },
      { id: 'dept_hr', companyId: defaultCompany.id, name: 'Human Resources', code: 'HR' },
      { id: 'dept_fin', companyId: defaultCompany.id, name: 'Finance', code: 'FIN' },
      { id: 'dept_ops', companyId: defaultCompany.id, name: 'Operations', code: 'OPS' },
      { id: 'dept_mkt', companyId: defaultCompany.id, name: 'Marketing', code: 'MKT' },
    ];
    store.designations = [
      { id: 'desig_se', title: 'Software Engineer', level: 'L2' },
      { id: 'desig_sse', title: 'Senior Software Engineer', level: 'L3' },
      { id: 'desig_pm', title: 'Product Manager', level: 'L3' },
      { id: 'desig_hrg', title: 'HR Generalist', level: 'L2' },
      { id: 'desig_fa', title: 'Financial Analyst', level: 'L2' },
    ];
    store.leaveTypes = [
      { id: 'lt_annual', companyId: defaultCompany.id, name: 'Annual Leave', quota: 14, isPaid: true },
      { id: 'lt_casual', companyId: defaultCompany.id, name: 'Casual Leave', quota: 10, isPaid: true },
      { id: 'lt_sick', companyId: defaultCompany.id, name: 'Sick Leave', quota: 8, isPaid: true },
      { id: 'lt_unpaid', companyId: defaultCompany.id, name: 'Unpaid Leave', quota: 30, isPaid: false },
    ];
    store.holidays = [
      { id: 'hol_1', companyId: defaultCompany.id, name: 'New Year', date: `${currentYear}-01-01` },
      { id: 'hol_2', companyId: defaultCompany.id, name: 'Labour Day', date: `${currentYear}-05-01` },
      { id: 'hol_3', companyId: defaultCompany.id, name: 'Independence Day', date: `${currentYear}-08-14` },
      { id: 'hol_4', companyId: defaultCompany.id, name: 'Quaid-e-Azam Day', date: `${currentYear}-12-25` },
    ];
  }

  const cleanEmail = email.trim().toLowerCase();
  if (store.users.some(u => u.email === cleanEmail) || store.employees.some(e => e.email === cleanEmail)) {
    return res.status(409).json({ error: `An account with email '${cleanEmail}' already exists.` });
  }

  const nameParts = name.trim().split(/\s+/);
  const firstName = nameParts[0] || 'Employee';
  const lastName = nameParts.slice(1).join(' ') || 'Staff';

  const dept = store.departments[0] || { id: 'dept_gen', name: 'General' };
  const count = store.employees.length + 1;
  const cleanCode = `EMP-${String(count).padStart(3, '0')}`;

  const employeeId = `emp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const newEmployee = {
    id: employeeId,
    companyId: store.company.id,
    employeeCode: cleanCode,
    firstName,
    lastName,
    email: cleanEmail,
    phone: '',
    address: '',
    departmentId: dept.id,
    departmentName: dept.name,
    designation: 'Associate',
    joiningDate: new Date().toISOString().split('T')[0],
    basicSalary: 75000,
    status: 'active',
    gender: 'unspecified',
    createdAt: new Date().toISOString(),
  };

  const passwordHash = await hashPassword(password);
  const newUser = {
    id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    companyId: store.company.id,
    employeeId: newEmployee.id,
    name: `${firstName} ${lastName}`,
    email: cleanEmail,
    passwordHash,
    role: 'employee',
    temporaryPassword: false,
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  store.employees.push(newEmployee);
  store.users.push(newUser);
  saveStore(store);

  logAudit({
    actor: newUser,
    action: 'EMPLOYEE_SELF_REGISTER',
    entity: 'Employee',
    entityId: newEmployee.id,
    details: `Employee ${newEmployee.firstName} ${newEmployee.lastName} (${newEmployee.email}) created account.`,
  });

  const token = signToken(newUser);
  res.status(201).json({
    success: true,
    message: 'Employee account created successfully.',
    token,
    user: {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      companyId: newUser.companyId,
      employeeId: newUser.employeeId,
      temporaryPassword: false,
    },
    employee: newEmployee,
  });
});

// First-sign-in change password
router.post('/auth/change-password', authMiddleware, async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  }

  const store = loadStore();
  const user = store.users.find(u => u.id === req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  user.passwordHash = await hashPassword(newPassword);
  user.temporaryPassword = false;
  saveStore(store);

  logAudit({
    actor: user,
    action: 'PASSWORD_CHANGED',
    entity: 'User',
    entityId: user.id,
    details: 'User updated initial temporary password.',
  });

  const updatedToken = signToken(user);
  res.json({ success: true, token: updatedToken, message: 'Password updated successfully.' });
});

// Current user profile
router.get('/auth/me', authMiddleware, (req, res) => {
  const store = loadStore();
  const user = store.users.find(u => u.id === req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  let employeeProfile = null;
  if (user.employeeId) {
    employeeProfile = store.employees.find(e => e.id === user.employeeId) || null;
  }

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      employeeId: user.employeeId || null,
      temporaryPassword: !!user.temporaryPassword,
    },
    employee: employeeProfile,
    company: store.company,
  });
});

// Admin creates HR login
router.post('/auth/create-hr', authMiddleware, requireRole(['admin']), async (req, res) => {
  const { name, email, password } = req.body;
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 120 ||
      typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      typeof password !== 'string' || password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: 'Name, valid email, and password (8–128 characters) are required.' });
  }

  const store = loadStore();
  const cleanEmail = email.trim().toLowerCase();
  if (store.users.some(u => u.email === cleanEmail)) {
    return res.status(409).json({ error: 'A user account with this email already exists.' });
  }

  const hashedPassword = await hashPassword(password);
  if (store.users.some(u => u.email === cleanEmail)) return res.status(409).json({ error: 'A user account with this email already exists.' });
  const hrUser = {
    id: `user_hr_${Date.now()}`,
    companyId: store.company.id,
    name,
    email: cleanEmail,
    passwordHash: hashedPassword,
    role: 'hr',
    temporaryPassword: !!req.body.isTemporary,
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  store.users.push(hrUser);
  saveStore(store);

  logAudit({
    actor: req.user,
    action: 'CREATE_HR_USER',
    entity: 'User',
    entityId: hrUser.id,
    details: `Admin created HR account for ${hrUser.email}`,
  });

  res.status(201).json({
    success: true,
    message: 'HR account created successfully.',
    user: { id: hrUser.id, name: hrUser.name, email: hrUser.email, role: hrUser.role },
  });
});

// Admin reset or deactivate user login
router.put('/auth/users/:id/status', authMiddleware, requireRole(['admin']), async (req, res) => {
  const { isActive, resetPassword } = req.body;
  const store = loadStore();
  const targetUser = store.users.find(u => u.id === req.params.id);
  if (!targetUser) {
    return res.status(404).json({ error: 'User not found.' });
  }

  if (targetUser.id === req.user.id && isActive === false) {
    return res.status(400).json({ error: 'Cannot deactivate your own Admin account.' });
  }

  if (typeof isActive === 'boolean') {
    targetUser.isActive = isActive;
  }
  if (resetPassword) {
    targetUser.passwordHash = await hashPassword(resetPassword);
    targetUser.temporaryPassword = true;
  }

  saveStore(store);
  logAudit({
    actor: req.user,
    action: 'USER_STATUS_UPDATED',
    entity: 'User',
    entityId: targetUser.id,
    details: `Updated user ${targetUser.email} (active: ${targetUser.isActive}, reset: ${!!resetPassword})`,
  });

  res.json({ success: true, message: 'User updated successfully.' });
});

// ==========================================
// MODULE 2: ORGANIZATION SETUP
// ==========================================

// Get company settings
router.get('/org/settings', authMiddleware, (req, res) => {
  const store = loadStore();
  res.json(store.company);
});

// Update company settings (Admin only!)
router.put('/org/settings', authMiddleware, requireRole(['admin']), (req, res) => {
  const store = loadStore();
  const before = { ...store.company };
  const {
    name,
    officeHoursStart,
    graceMinutes,
    halfDayHours,
    officeLat,
    officeLng,
    officeRadius,
  } = req.body;

  if (name) store.company.name = name;
  if (officeHoursStart) store.company.officeHoursStart = officeHoursStart;
  if (graceMinutes !== undefined) store.company.graceMinutes = parseInt(graceMinutes, 10);
  if (halfDayHours !== undefined) store.company.halfDayHours = parseInt(halfDayHours, 10);
  if (officeLat !== undefined) store.company.officeLat = parseFloat(officeLat);
  if (officeLng !== undefined) store.company.officeLng = parseFloat(officeLng);
  if (officeRadius !== undefined) store.company.officeRadius = parseFloat(officeRadius);

  saveStore(store);
  logAudit({
    actor: req.user,
    action: 'UPDATE_COMPANY_SETTINGS',
    entity: 'Company',
    entityId: store.company.id,
    details: 'Company operational parameters updated',
    beforeJson: before,
    afterJson: store.company,
  });

  res.json({ success: true, settings: store.company });
});

// Departments & Designations
router.get('/org/departments', authMiddleware, (req, res) => {
  const store = loadStore();
  const deptsWithCount = store.departments.map(d => {
    const count = store.employees.filter(e => e.departmentId === d.id && e.status === 'active').length;
    return { ...d, headCount: count };
  });
  res.json(deptsWithCount);
});

router.post('/org/departments', authMiddleware, requireRole(['admin']), (req, res) => {
  const { name, code } = req.body;
  if (!name || !code) return res.status(400).json({ error: 'Name and Code are required.' });

  const store = loadStore();
  const newDept = {
    id: `dept_${Date.now()}`,
    companyId: store.company.id,
    name,
    code: code.toUpperCase(),
  };
  store.departments.push(newDept);
  saveStore(store);

  logAudit({
    actor: req.user,
    action: 'CREATE_DEPARTMENT',
    entity: 'Department',
    entityId: newDept.id,
    details: `Created department ${newDept.name} (${newDept.code})`,
  });

  res.status(201).json(newDept);
});

router.get('/org/leave-types', authMiddleware, (req, res) => {
  const store = loadStore();
  res.json(store.leaveTypes);
});

router.get('/org/holidays', authMiddleware, (req, res) => {
  const store = loadStore();
  res.json(store.holidays);
});

router.post('/org/holidays', authMiddleware, requireRole(['admin']), (req, res) => {
  const { name, date } = req.body;
  if (!name || !date) return res.status(400).json({ error: 'Holiday name and date are required.' });
  const store = loadStore();
  const newHoliday = {
    id: `hol_${Date.now()}`,
    companyId: store.company.id,
    name,
    date,
  };
  store.holidays.push(newHoliday);
  saveStore(store);
  res.status(201).json(newHoliday);
});

// ==========================================
// MODULE 3: EMPLOYEE MANAGEMENT
// ==========================================

// Get employee directory with server-side search, filtering, and paging
router.get('/employees', authMiddleware, (req, res) => {
  const store = loadStore();
  const { search = '', department = '', status = '', page = 1, limit = 20 } = req.query;

  let filtered = store.employees;
  if (req.user.role === 'employee') {
    filtered = filtered.filter(e => e.id === req.user.employeeId);
  }

  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      e =>
        e.firstName.toLowerCase().includes(q) ||
        e.lastName.toLowerCase().includes(q) ||
        e.employeeCode.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q)
    );
  }

  if (department) {
    filtered = filtered.filter(e => e.departmentId === department || e.departmentName === department);
  }

  if (status) {
    filtered = filtered.filter(e => e.status === status);
  }

  // Data scoping: If current user is an employee, strip confidential basicSalary
  const isEmployee = req.user.role === 'employee';
  const sanitized = filtered.map(e => {
    if (isEmployee) {
      return {
        id: e.id,
        employeeCode: e.employeeCode,
        firstName: e.firstName,
        lastName: e.lastName,
        departmentName: e.departmentName,
        designation: e.designation,
        email: e.email,
        status: e.status,
      };
    }
    return e;
  });

  const p = parseInt(page, 10) || 1;
  const l = parseInt(limit, 10) || 20;
  const paginated = sanitized.slice((p - 1) * l, p * l);

  res.json({
    total: sanitized.length,
    page: p,
    limit: l,
    totalPages: Math.ceil(sanitized.length / l),
    employees: paginated,
  });
});

// Register new employee (HR & Admin only)
// Automatically provisions login account with temporary password
router.post('/employees', authMiddleware, requireRole(['admin', 'hr']), async (req, res) => {
  let {
    employeeCode,
    firstName,
    lastName,
    name,
    email,
    password,
    phone,
    address,
    departmentId,
    designation,
    joiningDate,
    basicSalary,
    gender = 'unspecified',
  } = req.body;

  const store = loadStore();

  if (name && (!firstName || !lastName)) {
    const parts = name.trim().split(/\s+/);
    firstName = firstName || parts[0] || 'Employee';
    lastName = lastName || parts.slice(1).join(' ') || 'Staff';
  }

  if (!employeeCode || typeof employeeCode !== 'string' || !employeeCode.trim()) {
    employeeCode = `EMP-${String(store.employees.length + 1).padStart(3, '0')}`;
  }
  if (!departmentId || typeof departmentId !== 'string') {
    departmentId = store.departments[0]?.id || 'dept_gen';
  }
  if (!designation || typeof designation !== 'string') {
    designation = 'Staff';
  }
  if (!joiningDate || typeof joiningDate !== 'string') {
    joiningDate = new Date().toISOString().split('T')[0];
  }
  if (!basicSalary || !Number.isFinite(Number(basicSalary)) || Number(basicSalary) <= 0) {
    basicSalary = 75000;
  }

  if (typeof firstName !== 'string' || !firstName.trim() || firstName.length > 100 ||
      typeof lastName !== 'string' || !lastName.trim() || lastName.length > 100 ||
      typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ error: 'Valid employee name and corporate email are required.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = employeeCode.trim().toUpperCase();

  // Unique checks
  if (store.employees.some(e => e.employeeCode === cleanCode)) {
    return res.status(409).json({ error: `Employee code '${cleanCode}' is already registered.` });
  }
  if (store.employees.some(e => e.email === cleanEmail) || store.users.some(u => u.email === cleanEmail)) {
    return res.status(409).json({ error: `Email '${cleanEmail}' is already assigned to an account.` });
  }

  const dept = store.departments.find(d => d.id === departmentId);
  const deptName = dept ? dept.name : 'General';

  const employeeId = `emp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const newEmployee = {
    id: employeeId,
    companyId: store.company.id,
    employeeCode: cleanCode,
    firstName,
    lastName,
    email: cleanEmail,
    phone: phone || '',
    address: address || '',
    departmentId,
    departmentName: deptName,
    designation: designation || 'Staff',
    joiningDate,
    basicSalary: parseFloat(basicSalary),
    status: 'active',
    gender,
    createdAt: new Date().toISOString(),
  };

  // If explicit permanent password is provided, use it directly (temporaryPassword: false)
  // Otherwise generate a temporary password (temporaryPassword: true)
  const isDirectPassword = typeof password === 'string' && password.length >= 6;
  const tempPassword = isDirectPassword ? null : `TempPass!${Math.floor(1000 + Math.random() * 9000)}`;
  const passwordHash = await hashPassword(isDirectPassword ? password : tempPassword);

  // Re-check unique identifiers after the async password hash to narrow concurrent duplicate races.
  if (store.employees.some(e => e.employeeCode === cleanCode) || store.employees.some(e => e.email === cleanEmail) || store.users.some(u => u.email === cleanEmail)) {
    return res.status(409).json({ error: 'Employee code or email was registered by another request.' });
  }

  const newUser = {
    id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    companyId: store.company.id,
    employeeId: newEmployee.id,
    name: `${firstName} ${lastName}`,
    email: cleanEmail,
    passwordHash,
    role: 'employee',
    temporaryPassword: !isDirectPassword,
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  store.employees.push(newEmployee);
  store.users.push(newUser);
  saveStore(store);

  logAudit({
    actor: req.user,
    action: 'REGISTER_EMPLOYEE',
    entity: 'Employee',
    entityId: newEmployee.id,
    details: `Registered ${newEmployee.firstName} ${newEmployee.lastName} (${newEmployee.employeeCode}). Login provisioned with temporary password.`,
  });

  res.status(201).json({
    success: true,
    employee: newEmployee,
    temporaryCredentials: {
      email: cleanEmail,
      temporaryPassword: tempPassword,
    },
  });
});

// Employee 360 profile
router.get('/employees/:id', authMiddleware, (req, res) => {
  const store = loadStore();
  const targetId = req.params.id;

  // Data scope check
  if (req.user.role === 'employee' && req.user.employeeId !== targetId) {
    return res.status(403).json({ error: 'Access denied: You can only view your own employee profile.' });
  }

  const employee = store.employees.find(e => e.id === targetId);
  if (!employee) return res.status(404).json({ error: 'Employee not found.' });

  // Associated records for Employee 360
  const attendance = store.attendance.filter(a => a.employeeId === targetId).slice(0, 30);
  const leaveHistory = store.leaveRequests.filter(l => l.employeeId === targetId);
  const payslips = req.user.role === 'employee'
    ? store.payslips.filter(p => p.employeeId === targetId)
    : store.payslips.filter(p => p.employeeId === targetId);

  res.json({
    employee,
    attendanceSummary: {
      totalLogged: attendance.length,
      lates: attendance.filter(a => a.status === 'late').length,
      recent: attendance.slice(0, 7),
    },
    leaveHistory,
    payslips,
  });
});

// Update employee details
router.put('/employees/:id', authMiddleware, (req, res) => {
  const store = loadStore();
  const targetId = req.params.id;
  const employee = store.employees.find(e => e.id === targetId);
  if (!employee) return res.status(404).json({ error: 'Employee not found.' });

  // Scope enforcement
  if (req.user.role === 'employee') {
    if (req.user.employeeId !== targetId) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    // Employee can ONLY update phone and address
    if (req.body.phone !== undefined) employee.phone = req.body.phone;
    if (req.body.address !== undefined) employee.address = req.body.address;
  } else {
    // HR & Admin can update full details
    const before = { ...employee };
    const {
      firstName,
      lastName,
      phone,
      address,
      departmentId,
      designation,
      basicSalary,
      status,
    } = req.body;

    if (firstName) employee.firstName = firstName;
    if (lastName) employee.lastName = lastName;
    if (phone !== undefined) employee.phone = phone;
    if (address !== undefined) employee.address = address;
    if (departmentId) {
      employee.departmentId = departmentId;
      const dept = store.departments.find(d => d.id === departmentId);
      if (dept) employee.departmentName = dept.name;
    }
    if (designation) employee.designation = designation;
    if (basicSalary !== undefined) employee.basicSalary = parseFloat(basicSalary);
    if (status) employee.status = status;

    logAudit({
      actor: req.user,
      action: 'UPDATE_EMPLOYEE',
      entity: 'Employee',
      entityId: employee.id,
      details: `Updated details for ${employee.employeeCode}`,
      beforeJson: before,
      afterJson: employee,
    });
  }

  saveStore(store);
  res.json({ success: true, employee });
});

// CSV Dry-run and Live Import
router.post('/employees/import-csv', authMiddleware, requireRole(['admin', 'hr']), async (req, res) => {
  const { rows, dryRun = true } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'Rows array is required.' });
  }

  const store = loadStore();
  const errors = [];
  const validRows = [];
  const existingCodes = new Set(store.employees.map(e => e.employeeCode));
  const existingEmails = new Set(store.users.map(u => u.email));
  const deptMap = new Map(store.departments.map(d => [d.name.toLowerCase(), d]));

  rows.forEach((row, idx) => {
    const rowNum = idx + 1;
    const { code, firstName, lastName, email, department, designation, joiningDate, salary } = row;

    if (!code) errors.push({ row: rowNum, field: 'code', reason: 'Employee code is required' });
    else if (existingCodes.has(code.trim().toUpperCase())) {
      errors.push({ row: rowNum, field: 'code', reason: `Employee code ${code} is already in use` });
    }

    if (!firstName) errors.push({ row: rowNum, field: 'firstName', reason: 'First name is required' });
    if (!lastName) errors.push({ row: rowNum, field: 'lastName', reason: 'Last name is required' });

    if (!email) errors.push({ row: rowNum, field: 'email', reason: 'Email is required' });
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({ row: rowNum, field: 'email', reason: 'Invalid email format' });
    } else if (existingEmails.has(email.trim().toLowerCase())) {
      errors.push({ row: rowNum, field: 'email', reason: `Email ${email} is already in use` });
    }

    if (!department) errors.push({ row: rowNum, field: 'department', reason: 'Department is required' });
    else if (!deptMap.has(department.trim().toLowerCase())) {
      errors.push({ row: rowNum, field: 'department', reason: `Unknown department '${department}'` });
    }

    if (!joiningDate) errors.push({ row: rowNum, field: 'joiningDate', reason: 'Joining date is required' });
    else if (isNaN(Date.parse(joiningDate))) {
      errors.push({ row: rowNum, field: 'joiningDate', reason: 'Invalid ISO date format (YYYY-MM-DD required)' });
    }

    const numSalary = parseFloat(salary);
    if (isNaN(numSalary) || numSalary <= 0) {
      errors.push({ row: rowNum, field: 'salary', reason: 'Salary must be a positive number' });
    }

    if (errors.filter(e => e.row === rowNum).length === 0) {
      validRows.push({
        ...row,
        cleanCode: code.trim().toUpperCase(),
        cleanEmail: email.trim().toLowerCase(),
        dept: deptMap.get(department.trim().toLowerCase()),
        numSalary,
      });
      existingCodes.add(code.trim().toUpperCase());
      existingEmails.add(email.trim().toLowerCase());
    }
  });

  if (dryRun) {
    return res.json({
      dryRun: true,
      totalRows: rows.length,
      validCount: validRows.length,
      errorCount: errors.length,
      errors,
    });
  }

  // Live import
  if (errors.length > 0) {
    return res.status(422).json({
      error: 'Cannot perform live import with validation errors. Review dry run.',
      errors,
    });
  }

  const createdEmployees = [];
  for (const item of validRows) {
    const empId = `emp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const emp = {
      id: empId,
      companyId: store.company.id,
      employeeCode: item.cleanCode,
      firstName: item.firstName,
      lastName: item.lastName,
      email: item.cleanEmail,
      phone: item.phone || '',
      address: item.address || '',
      departmentId: item.dept.id,
      departmentName: item.dept.name,
      designation: item.designation || 'Staff',
      joiningDate: item.joiningDate,
      basicSalary: item.numSalary,
      status: 'active',
      gender: item.gender || 'unspecified',
      createdAt: new Date().toISOString(),
    };

    const tempPassword = `Pass!${Math.floor(1000 + Math.random() * 9000)}`;
    const passwordHash = await hashPassword(tempPassword);

    const user = {
      id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      companyId: store.company.id,
      employeeId: emp.id,
      name: `${emp.firstName} ${emp.lastName}`,
      email: emp.email,
      passwordHash,
      role: 'employee',
      temporaryPassword: true,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    store.employees.push(emp);
    store.users.push(user);
    createdEmployees.push({ emp, tempPassword });
  }

  saveStore(store);
  logAudit({
    actor: req.user,
    action: 'CSV_IMPORT_EMPLOYEES',
    entity: 'Employee',
    details: `Imported ${createdEmployees.length} employees via CSV`,
  });

  res.status(201).json({
    success: true,
    importedCount: createdEmployees.length,
    employees: createdEmployees.map(c => ({
      code: c.emp.employeeCode,
      name: `${c.emp.firstName} ${c.emp.lastName}`,
      email: c.emp.email,
      temporaryPassword: c.tempPassword,
    })),
  });
});

// CSV Export
router.get('/employees/export-csv', authMiddleware, requireRole(['admin', 'hr']), (req, res) => {
  const store = loadStore();
  const headers = ['Employee Code', 'First Name', 'Last Name', 'Email', 'Department', 'Designation', 'Joining Date', 'Basic Salary', 'Status'];
  const rows = store.employees.map(e => [
    e.employeeCode,
    e.firstName,
    e.lastName,
    e.email,
    e.departmentName,
    e.designation,
    e.joiningDate,
    e.basicSalary,
    e.status,
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="hcm_employees.csv"');
  res.send(csvContent);
});

// ==========================================
// MODULE 4: ATTENDANCE
// ==========================================

// Today's daily attendance board
router.get('/attendance/today', authMiddleware, (req, res) => {
  const store = loadStore();
  const today = new Date().toISOString().split('T')[0];

  if (req.user.role === 'employee') {
    const myRecord = store.attendance.find(a => a.employeeId === req.user.employeeId && a.date === today) || null;
    return res.json({ today, records: myRecord ? [myRecord] : [] });
  }

  // Admin & HR see all employees with their attendance or absent status for today
  const activeEmps = store.employees.filter(e => e.status === 'active' || e.status === 'probation');
  const board = activeEmps.map(emp => {
    const record = store.attendance.find(a => a.employeeId === emp.id && a.date === today);
    const onLeave = store.leaveRequests.find(
      l => l.employeeId === emp.id && l.status === 'approved' && l.startDate <= today && l.endDate >= today
    );

    if (record) {
      return record;
    }
    if (onLeave) {
      return {
        id: `leave_${emp.id}_${today}`,
        employeeId: emp.id,
        employeeCode: emp.employeeCode,
        employeeName: `${emp.firstName} ${emp.lastName}`,
        departmentName: emp.departmentName,
        date: today,
        status: 'on_leave',
        leaveType: onLeave.leaveTypeName,
        hoursWorked: 0,
      };
    }
    return {
      id: `absent_${emp.id}_${today}`,
      employeeId: emp.id,
      employeeCode: emp.employeeCode,
      employeeName: `${emp.firstName} ${emp.lastName}`,
      departmentName: emp.departmentName,
      date: today,
      status: 'absent',
      hoursWorked: 0,
    };
  });

  res.json({ today, records: board });
});

// Web & Camera check-in
router.post('/attendance/check-in', authMiddleware, (req, res) => {
  const store = loadStore();
  const employeeId = req.user.employeeId;
  if (!employeeId) {
    return res.status(400).json({ error: 'Only employee accounts can check in.' });
  }

  const employee = store.employees.find(e => e.id === employeeId);
  if (!employee) return res.status(404).json({ error: 'Employee record not found.' });

  // Server stamps timestamp!
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  // Rule: One attendance record per employee per day (second check-in = 409 Conflict)
  const existing = store.attendance.find(a => a.employeeId === employeeId && a.date === today);
  if (existing) {
    return res.status(409).json({ error: 'Check-in already completed for today.' });
  }

  const { isCamera = false, userLat, userLng, accuracy } = req.body;
  let locationVerified = false;

  // Camera attendance always requires server-verifiable GPS evidence.
  if (isCamera && (userLat === undefined || userLng === undefined || accuracy === undefined)) {
    return res.status(422).json({ error: 'Camera attendance requires GPS coordinates and accuracy.' });
  }
  if (userLat !== undefined || userLng !== undefined || isCamera) {
    const lat = Number(userLat), lng = Number(userLng), gpsAccuracy = Number(accuracy);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(gpsAccuracy) || gpsAccuracy < 0 || gpsAccuracy > 100) {
      return res.status(422).json({ error: 'Valid coordinates and GPS accuracy of 100 metres or better are required.' });
    }
    const geo = verifyGeofence({
      userLat: lat,
      userLng: lng,
      accuracy: gpsAccuracy,
      officeLat: Number(store.company.officeLat),
      officeLng: Number(store.company.officeLng),
      radius: Number(store.company.officeRadius),
    });
    if (!geo.allowed) return res.status(403).json({ error: `Location check failed: ${geo.reason}` });
    locationVerified = true;
  }
  // Do not claim face verification: this build has no server-verifiable face detector.
  if (isCamera) {
    return res.status(501).json({ error: 'Camera check-in is unavailable until real face detection is integrated. Use standard web check-in or request an HR correction.' });
  }

  const hours = String(now.getHours()).padStart(2, '0');
  const mins = String(now.getMinutes()).padStart(2, '0');
  const checkInTime = `${hours}:${mins}`;

  const statusEval = evaluateAttendanceStatus(
    checkInTime,
    null,
    store.company.officeHoursStart || '09:00',
    store.company.graceMinutes || 15
  );

  const newRecord = {
    id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    companyId: store.company.id,
    employeeId: employee.id,
    employeeCode: employee.employeeCode,
    employeeName: `${employee.firstName} ${employee.lastName}`,
    departmentId: employee.departmentId,
    departmentName: employee.departmentName,
    date: today,
    checkInTime,
    checkOutTime: null,
    status: statusEval.status,
    isLate: statusEval.isLate,
    isHalfDay: false,
    hoursWorked: 0,
    isCameraCheckIn: !!isCamera,
    locationVerified,
    createdAt: now.toISOString(),
  };

  store.attendance.push(newRecord);
  saveStore(store);

  logAudit({
    actor: req.user,
    action: 'CHECK_IN',
    entity: 'Attendance',
    entityId: newRecord.id,
    details: `${employee.firstName} ${employee.lastName} checked in at ${checkInTime} (Status: ${newRecord.status})`,
  });

  res.status(201).json({ success: true, record: newRecord });
});

// Check-out
router.post('/attendance/check-out', authMiddleware, (req, res) => {
  const store = loadStore();
  const employeeId = req.user.employeeId;
  if (!employeeId) return res.status(400).json({ error: 'Only employees can check out.' });

  const now = new Date();
  const today = now.toISOString().split('T')[0];

  const record = store.attendance.find(a => a.employeeId === employeeId && a.date === today);
  if (!record) {
    return res.status(400).json({ error: 'No check-in record found for today.' });
  }
  if (record.checkOutTime) {
    return res.status(400).json({ error: 'Already checked out for today.' });
  }

  const hours = String(now.getHours()).padStart(2, '0');
  const mins = String(now.getMinutes()).padStart(2, '0');
  const checkOutTime = `${hours}:${mins}`;

  const statusEval = evaluateAttendanceStatus(
    record.checkInTime,
    checkOutTime,
    store.company.officeHoursStart || '09:00',
    store.company.graceMinutes || 15
  );

  record.checkOutTime = checkOutTime;
  record.status = statusEval.status;
  record.isHalfDay = statusEval.isHalfDay;
  record.hoursWorked = statusEval.hoursWorked;

  saveStore(store);
  logAudit({
    actor: req.user,
    action: 'CHECK_OUT',
    entity: 'Attendance',
    entityId: record.id,
    details: `${req.user.name} checked out at ${checkOutTime} (${statusEval.hoursWorked}h worked, status: ${record.status})`,
  });

  res.json({ success: true, record });
});

// Employee's own attendance history
router.get('/attendance/my', authMiddleware, (req, res) => {
  const store = loadStore();
  const employeeId = req.user.employeeId;
  if (!employeeId) return res.status(400).json({ error: 'No employee account linked.' });

  const records = store.attendance.filter(a => a.employeeId === employeeId).sort((a, b) => b.date.localeCompare(a.date));
  res.json(records);
});

// Attendance correction request (Employee)
router.post('/attendance/correction', authMiddleware, (req, res) => {
  const { attendanceId, requestedCheckIn, requestedCheckOut, reason } = req.body;
  if (!attendanceId || typeof reason !== 'string' || !reason.trim() || reason.length > 1000) {
    return res.status(400).json({ error: 'Attendance ID and correction reason (1–1000 chars) are required.' });
  }
  if (req.user.role !== 'employee') return res.status(403).json({ error: 'Only employees may request attendance corrections.' });

  const store = loadStore();
  const record = store.attendance.find(a => a.id === attendanceId);
  if (!record) return res.status(404).json({ error: 'Attendance record not found.' });

  if (req.user.role === 'employee' && record.employeeId !== req.user.employeeId) {
    return res.status(403).json({ error: 'Cannot request correction for other employees.' });
  }

  record.correction = {
    id: `corr_${Date.now()}`,
    requestedCheckIn,
    requestedCheckOut,
    reason,
    status: 'pending',
    requestedAt: new Date().toISOString(),
  };

  saveStore(store);
  res.json({ success: true, record });
});

// Approve or reject attendance correction (HR & Admin)
router.put('/attendance/correction/:id', authMiddleware, requireRole(['admin', 'hr']), (req, res) => {
  const { decision, comment } = req.body; // 'approved' or 'rejected'
  if (!['approved', 'rejected'].includes(decision)) return res.status(400).json({ error: "Decision must be 'approved' or 'rejected'." });
  if (comment !== undefined && (typeof comment !== 'string' || comment.length > 1000)) return res.status(400).json({ error: 'Comment must be 1000 characters or fewer.' });
  const store = loadStore();
  const record = store.attendance.find(a => a.id === req.params.id);
  if (!record || !record.correction) {
    return res.status(404).json({ error: 'Correction request not found.' });
  }
  if (record.correction.status !== 'pending') return res.status(409).json({ error: 'This correction request has already been reviewed.' });

  record.correction.status = decision;
  record.correction.reviewedBy = req.user.name;
  record.correction.reviewedAt = new Date().toISOString();
  record.correction.comment = comment || '';

  if (decision === 'approved') {
    if (record.correction.requestedCheckIn) record.checkInTime = record.correction.requestedCheckIn;
    if (record.correction.requestedCheckOut) record.checkOutTime = record.correction.requestedCheckOut;
    const reEval = evaluateAttendanceStatus(record.checkInTime, record.checkOutTime);
    record.status = reEval.status;
    record.isLate = reEval.isLate;
    record.isHalfDay = reEval.isHalfDay;
    record.hoursWorked = reEval.hoursWorked;
  }

  saveStore(store);
  logAudit({
    actor: req.user,
    action: `ATTENDANCE_CORRECTION_${decision.toUpperCase()}`,
    entity: 'Attendance',
    entityId: record.id,
    details: `${decision.toUpperCase()} attendance correction for ${record.employeeName}`,
  });

  res.json({ success: true, record });
});

// ==========================================
// MODULE 5: LEAVE MANAGEMENT
// ==========================================

// Get leave balances
router.get('/leave/balances', authMiddleware, (req, res) => {
  const store = loadStore();
  const targetEmpId = req.query.employeeId || req.user.employeeId;
  if (req.user.role === 'employee' && targetEmpId !== req.user.employeeId) {
    return res.status(403).json({ error: 'Access denied: You can only view your own leave balance.' });
  }
  if (!targetEmpId) return res.status(400).json({ error: 'Employee ID is required.' });
  if (!['admin', 'hr', 'employee'].includes(req.user.role)) return res.status(403).json({ error: 'Access denied.' });
  res.json(calculateLeaveBalances({
    employeeId: targetEmpId,
    leaveRequests: store.leaveRequests,
    leaveTypes: store.leaveTypes,
    holidays: store.holidays.map(holiday => holiday.date),
  }));
});

// Apply for leave
router.post('/leave/apply', authMiddleware, (req, res) => {
  const store = loadStore();
  const employeeId = req.user.employeeId;
  if (!employeeId) return res.status(400).json({ error: 'Only employees can apply for leave.' });

  const { leaveTypeId, startDate, endDate, reason } = req.body;
  if (!leaveTypeId || !startDate || !endDate || !reason) {
    return res.status(400).json({ error: 'Leave type, start date, end date, and reason are required.' });
  }

  const employee = store.employees.find(e => e.id === employeeId);
  if (!employee) return res.status(404).json({ error: 'Your employee profile could not be found.' });
  const leaveType = store.leaveTypes.find(l => l.id === leaveTypeId);
  if (!leaveType) return res.status(400).json({ error: 'Select a valid leave type configured by your company.' });
  const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  if (!validDate(startDate) || !validDate(endDate)) return res.status(400).json({ error: 'Dates must be valid calendar dates in YYYY-MM-DD format.' });
  if (startDate > endDate) return res.status(400).json({ error: 'End date must be on or after start date.' });
  if (typeof reason !== 'string' || !reason.trim() || reason.length > 1000) return res.status(400).json({ error: 'Reason must be 1 to 1000 characters.' });

  // Rule: Calculate working days only (skips weekends and public holidays)
  const holidayDates = store.holidays.map(h => h.date);
  const workingDays = getWorkingDaysCount(startDate, endDate, holidayDates);
  if (workingDays <= 0) {
    return res.status(400).json({ error: 'Selected date range contains 0 working days.' });
  }

  // Rule: Reject overlapping leave requests (HTTP 422)
  const hasOverlap = store.leaveRequests.some(l => {
    if (l.employeeId !== employeeId || l.status === 'rejected' || l.status === 'cancelled') return false;
    return (startDate <= l.endDate && endDate >= l.startDate);
  });
  if (hasOverlap) {
    return res.status(422).json({ error: '422 Unprocessable Entity: Overlapping leave request already exists.' });
  }

  // Rule: Reject requests that exceed available quota (HTTP 422)
  const maxQuota = Math.max(0, Number(leaveType.quotaDays) || 0);
  const unlimitedQuota = !leaveType.isPaid || /unpaid/i.test(leaveType.name) || maxQuota >= 999999;
  const currentUsed = store.leaveRequests
    .filter(l => l.employeeId === employeeId && l.leaveTypeId === leaveType.id && ['approved', 'pending'].includes(l.status))
    .reduce((sum, l) => sum + (Number(l.workingDays) || 0), 0);

  if (!unlimitedQuota && (currentUsed + workingDays) > maxQuota) {
    return res.status(422).json({
      error: `422 Unprocessable Entity: Request exceeds available balance (${Math.max(0, maxQuota - currentUsed)} days remaining, requested ${workingDays}).`,
    });
  }

  const newRequest = {
    id: `leave_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    companyId: store.company.id,
    employeeId: employee.id,
    employeeCode: employee.employeeCode,
    employeeName: `${employee.firstName} ${employee.lastName}`,
    departmentName: employee.departmentName,
    leaveTypeId: leaveType.id,
    leaveTypeName: leaveType.name,
    startDate,
    endDate,
    workingDays,
    reason,
    status: 'pending',
    appliedAt: new Date().toISOString(),
    reviewedBy: null,
    reviewedAt: null,
    comment: null,
  };

  store.leaveRequests.push(newRequest);
  saveStore(store);

  logAudit({
    actor: req.user,
    action: 'APPLY_LEAVE',
    entity: 'LeaveRequest',
    entityId: newRequest.id,
    details: `${employee.firstName} applied for ${workingDays} day(s) ${leaveType.name} (${startDate} to ${endDate})`,
  });

  res.status(201).json({ success: true, leaveRequest: newRequest });
});

// List leave requests
router.get('/leave/requests', authMiddleware, (req, res) => {
  const store = loadStore();
  if (req.user.role === 'employee') {
    const myLeaves = store.leaveRequests.filter(l => l.employeeId === req.user.employeeId).sort((a, b) => b.appliedAt.localeCompare(a.appliedAt));
    return res.json(myLeaves);
  }
  // HR & Admin see all
  res.json(store.leaveRequests.slice().sort((a, b) => b.appliedAt.localeCompare(a.appliedAt)));
});

// HR approves or rejects leave with a comment
router.put('/leave/requests/:id/decision', authMiddleware, requireRole(['admin', 'hr']), (req, res) => {
  const { decision, comment } = req.body; // 'approved' or 'rejected'
  if (!decision || (decision !== 'approved' && decision !== 'rejected')) {
    return res.status(400).json({ error: "Decision must be 'approved' or 'rejected'." });
  }
  if (comment !== undefined && (typeof comment !== 'string' || comment.length > 1000)) return res.status(400).json({ error: 'Comment must be 1000 characters or fewer.' });

  const store = loadStore();
  const leave = store.leaveRequests.find(l => l.id === req.params.id);
  if (!leave) return res.status(404).json({ error: 'Leave request not found.' });
  if (leave.status !== 'pending') return res.status(409).json({ error: 'This leave request has already been reviewed.' });

  leave.status = decision;
  leave.reviewedBy = req.user.name;
  leave.reviewedAt = new Date().toISOString();
  leave.comment = comment || '';

  // In-app notification for the employee
  const targetUser = store.users.find(u => u.employeeId === leave.employeeId);
  if (targetUser) {
    store.notifications.unshift({
      id: `notif_${Date.now()}`,
      companyId: store.company.id,
      userId: targetUser.id,
      title: `Leave Request ${decision.toUpperCase()}`,
      message: `Your ${leave.leaveTypeName} request from ${leave.startDate} to ${leave.endDate} has been ${decision}. ${comment ? `Note: "${comment}"` : ''}`,
      type: 'leave',
      isRead: false,
      createdAt: new Date().toISOString(),
    });
  }

  saveStore(store);

  logAudit({
    actor: req.user,
    action: `LEAVE_${decision.toUpperCase()}`,
    entity: 'LeaveRequest',
    entityId: leave.id,
    details: `${decision.toUpperCase()} leave request for ${leave.employeeName} (${leave.leaveTypeName})`,
  });

  res.json({ success: true, leave });
});

// ==========================================
// MODULE 6: PAYROLL LITE
// ==========================================

// Create & review monthly payroll draft (HR & Admin)
router.post('/payroll/draft', authMiddleware, requireRole(['admin', 'hr']), (req, res) => {
  const { month } = req.body; // YYYY-MM
  if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return res.status(400).json({ error: 'Valid month (YYYY-MM, month 01–12) is required.' });
  }

  const store = loadStore();
  if (!store.company) return res.status(409).json({ error: 'Complete first-run company setup before running payroll.' });
  // Check if finalized payroll already exists for this month
  const existingFinalized = store.payrollRuns.find(r => r.month === month && r.status === 'finalized');
  if (existingFinalized) {
    return res.status(400).json({ error: `Payroll for ${month} is already finalized and locked.` });
  }

  // Calculate working days in this month
  const [yearStr, monthStr] = month.split('-');
  const y = parseInt(yearStr, 10);
  const m = parseInt(monthStr, 10);
  const firstDay = `${month}-01`;
  const lastDate = new Date(y, m, 0).getDate();
  const lastDay = `${month}-${String(lastDate).padStart(2, '0')}`;
  const holidayDates = store.holidays.map(h => h.date);
  const totalWorkingDays = getWorkingDaysCount(firstDay, lastDay, holidayDates);

  const activeEmployees = store.employees.filter(e => (e.status === 'active' || e.status === 'probation') && e.joiningDate <= lastDay);
  const lineItems = [];

  let totalGross = 0;
  let totalDeductions = 0;
  let totalTax = 0;
  let totalNet = 0;

  activeEmployees.forEach(emp => {
    // Attendance records for this employee in this month
    const empAtt = store.attendance.filter(a => a.employeeId === emp.id && a.date.startsWith(month) && a.date >= (emp.joiningDate || firstDay));
    const halfDays = empAtt.filter(a => a.status === 'half_day').length;
    const lates = empAtt.filter(a => a.status === 'late').length;

    // Approved leaves in this month
    const effectiveStart = emp.joiningDate && emp.joiningDate > firstDay ? emp.joiningDate : firstDay;
    const employeeWorkingDays = getWorkingDaysCount(effectiveStart, lastDay, holidayDates);
    const leaves = store.leaveRequests.filter(
      l => l.employeeId === emp.id && l.status === 'approved' && l.startDate <= lastDay && l.endDate >= effectiveStart
    );
    let unpaidDays = 0;
    let approvedLeaveDays = 0;
    leaves.forEach(l => {
      const overlapStart = l.startDate > effectiveStart ? l.startDate : effectiveStart;
      const overlapEnd = l.endDate < lastDay ? l.endDate : lastDay;
      const overlapDays = getWorkingDaysCount(overlapStart, overlapEnd, holidayDates);
      approvedLeaveDays += overlapDays;
      if ((l.leaveTypeName || '').toLowerCase().includes('unpaid')) unpaidDays += overlapDays;
    });

    // Prorate joiners by their eligible working days; leave overlap is clipped to this payroll month.
    const presentRecords = empAtt.length;
    const absentDays = Math.max(0, employeeWorkingDays - presentRecords - approvedLeaveDays);

    const calc = calculatePayroll({
      basicSalary: emp.basicSalary,
      workingDaysInMonth: totalWorkingDays || 1,
      activeDaysInMonth: employeeWorkingDays,
      absentDays,
      unpaidLeaveDays: unpaidDays,
      halfDays,
      lateCount: lates,
    });

    totalGross += calc.grossSalary;
    totalDeductions += calc.deductions.total;
    totalTax += calc.monthlyTax;
    totalNet += calc.netPay;

    lineItems.push({
      employeeId: emp.id,
      employeeCode: emp.employeeCode,
      employeeName: `${emp.firstName} ${emp.lastName}`,
      departmentName: emp.departmentName,
      designation: emp.designation,
      ...calc,
      eligibleWorkingDays: employeeWorkingDays,
      absentDays,
      unpaidLeaveDays: unpaidDays,
    });
  });

  const draftRun = {
    id: `payroll_${month}_${Date.now()}`,
    companyId: store.company.id,
    month,
    status: 'draft',
    workingDaysInMonth: totalWorkingDays,
    employeeCount: activeEmployees.length,
    totalGross: parseFloat(totalGross.toFixed(2)),
    totalDeductions: parseFloat(totalDeductions.toFixed(2)),
    totalTax: parseFloat(totalTax.toFixed(2)),
    totalNet: parseFloat(totalNet.toFixed(2)),
    lineItems,
    preparedBy: req.user.name,
    preparedAt: new Date().toISOString(),
  };

  // Replace existing draft if any, or push
  const draftIdx = store.payrollRuns.findIndex(r => r.month === month && r.status === 'draft');
  if (draftIdx >= 0) {
    store.payrollRuns[draftIdx] = draftRun;
  } else {
    store.payrollRuns.unshift(draftRun);
  }

  saveStore(store);

  logAudit({
    actor: req.user,
    action: 'PREPARE_PAYROLL_DRAFT',
    entity: 'PayrollRun',
    entityId: draftRun.id,
    details: `Prepared payroll draft for ${month} (${activeEmployees.length} employees, Gross PKR ${draftRun.totalGross})`,
  });

  res.status(201).json({ success: true, payrollRun: draftRun });
});

// Finalize and lock payroll (ADMIN ONLY!)
router.post('/payroll/runs/:id/finalize', authMiddleware, requireRole(['admin']), (req, res) => {
  const store = loadStore();
  const run = store.payrollRuns.find(r => r.id === req.params.id);
  if (!run) return res.status(404).json({ error: 'Payroll run not found.' });

  if (run.status === 'finalized') {
    return res.status(409).json({ error: 'Payroll run is already finalized and locked.' });
  }
  if (!Array.isArray(run.lineItems) || !run.month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(run.month)) {
    return res.status(409).json({ error: 'Payroll draft is invalid and cannot be finalized.' });
  }

  // Persist the lock and payslips together in one atomic local-store write.
  run.status = 'finalized';
  run.finalizedBy = req.user.name;
  run.finalizedAt = new Date().toISOString();

  // Generate payslip records for all line items
  run.lineItems.forEach(item => {
    const slip = {
      id: `slip_${run.month}_${item.employeeId}`,
      companyId: store.company.id,
      payrollRunId: run.id,
      month: run.month,
      employeeId: item.employeeId,
      employeeCode: item.employeeCode,
      employeeName: item.employeeName,
      departmentName: item.departmentName,
      designation: item.designation,
      basicSalary: item.basicSalary,
      hra: item.hra,
      medicalAllowance: item.medicalAllowance,
      grossSalary: item.grossSalary,
      dailyRate: item.dailyRate,
      workingDays: item.workingDaysInMonth,
      absentDays: item.absentDays,
      unpaidLeaveDays: item.unpaidLeaveDays,
      halfDays: item.halfDays,
      lateCount: item.lateCount,
      deductions: item.deductions,
      annualGross: item.annualGross,
      annualTax: item.annualTax,
      monthlyTax: item.monthlyTax,
      netPay: item.netPay,
      createdAt: run.finalizedAt,
    };

    // Upsert payslip
    const sIdx = store.payslips.findIndex(p => p.id === slip.id);
    if (sIdx >= 0) store.payslips[sIdx] = slip;
    else store.payslips.push(slip);

    // Notify employee
    const targetUser = store.users.find(u => u.employeeId === item.employeeId);
    if (targetUser) {
      store.notifications.unshift({
        id: `notif_pay_${Date.now()}_${item.employeeId}`,
        companyId: store.company.id,
        userId: targetUser.id,
        title: `Payslip Available for ${run.month}`,
        message: `Your payslip for ${run.month} is now finalized. Net pay: PKR ${item.netPay.toLocaleString()}.`,
        type: 'payroll',
        isRead: false,
        createdAt: new Date().toISOString(),
      });
    }
  });

  saveStore(store);

  logAudit({
    actor: req.user,
    action: 'FINALIZE_PAYROLL',
    entity: 'PayrollRun',
    entityId: run.id,
    details: `Admin finalized and locked payroll for ${run.month} (Total Net: PKR ${run.totalNet})`,
  });

  res.json({ success: true, payrollRun: run });
});

// List payroll runs (Admin & HR)
router.get('/payroll/runs', authMiddleware, requireRole(['admin', 'hr']), (req, res) => {
  const store = loadStore();
  res.json(store.payrollRuns);
});

// View specific payroll run
router.get('/payroll/runs/:id', authMiddleware, requireRole(['admin', 'hr']), (req, res) => {
  const store = loadStore();
  const run = store.payrollRuns.find(r => r.id === req.params.id);
  if (!run) return res.status(404).json({ error: 'Payroll run not found.' });
  res.json(run);
});

// Employee views their own payslips
router.get('/payroll/my-payslips', authMiddleware, (req, res) => {
  const store = loadStore();
  const employeeId = req.user.employeeId;
  if (!employeeId) return res.status(400).json({ error: 'No employee account linked.' });

  const slips = store.payslips.filter(p => p.employeeId === employeeId);
  res.json(slips);
});

// View single payslip with scope guard
router.get('/payroll/payslips/:id', authMiddleware, (req, res) => {
  const store = loadStore();
  const slip = store.payslips.find(p => p.id === req.params.id);
  if (!slip) return res.status(404).json({ error: 'Payslip not found.' });

  if (req.user.role === 'employee' && slip.employeeId !== req.user.employeeId) {
    return res.status(403).json({ error: 'Access denied: You cannot view another employee’s payslip.' });
  }

  res.json(slip);
});

// ==========================================
// MODULE 7: ANALYTICS & DASHBOARDS
// ==========================================

// Server-computed KPI numbers based on real database records
router.get('/analytics', authMiddleware, (req, res) => {
  const store = loadStore();
  const today = new Date().toISOString().split('T')[0];
  const { department = '' } = req.query;

  // Employees receive personal metrics only. Do not calculate or serialize company-wide
  // headcount, payroll totals, colleagues' attendance, or approval queues for this role.
  if (req.user.role === 'employee') {
    const employeeId = req.user.employeeId;
    const myAttendance = store.attendance.filter(a => a.employeeId === employeeId);
    const myToday = myAttendance.filter(a => a.date === today);
    const myLeave = store.leaveRequests.filter(l => l.employeeId === employeeId);
    const myApprovedLeaveToday = myLeave.some(l => l.status === 'approved' && l.startDate <= today && l.endDate >= today);
    const myPayslips = store.payslips
      .filter(p => p.employeeId === employeeId)
      .sort((a, b) => b.month.localeCompare(a.month));
    const monthPrefix = today.slice(0, 7);
    const myMonthAttendance = myAttendance.filter(a => a.date.startsWith(monthPrefix));
    const employeeKpi = {
      hoursWorkedThisMonth: Number(myMonthAttendance.reduce((sum, a) => sum + (Number(a.hoursWorked) || 0), 0).toFixed(1)),
      lateCount: myMonthAttendance.filter(a => a.status === 'late').length,
      lastPayslipNet: myPayslips[0]?.netPay ?? null,
      lastPayslipMonth: myPayslips[0]?.month ?? null,
    };
    return res.json({
      employeeKpi,
      personal: {
        attendanceToday: myToday[0]?.status || (myApprovedLeaveToday ? 'on_leave' : 'not_checked_in'),
        attendanceRecordsThisMonth: myMonthAttendance.length,
        approvedLeaveDays: myLeave.filter(l => l.status === 'approved' && l.startDate.startsWith(String(new Date().getFullYear()))).reduce((sum, l) => sum + (Number(l.workingDays) || 0), 0),
        pendingLeaveRequests: myLeave.filter(l => l.status === 'pending').length,
      },
    });
  }

  let employees = store.employees;
  if (department) {
    employees = employees.filter(e => e.departmentId === department || e.departmentName === department);
  }

  const activeEmployees = employees.filter(e => e.status === 'active' || e.status === 'probation');
  const totalHeadcount = activeEmployees.length;

  // Headcount by department
  const headcountByDept = {};
  store.employees.filter(e => e.status === 'active').forEach(e => {
    headcountByDept[e.departmentName || 'General'] = (headcountByDept[e.departmentName || 'General'] || 0) + 1;
  });

  // Attendance metrics today
  const todayRecords = store.attendance.filter(a => a.date === today && (!department || a.departmentId === department));
  const presentToday = todayRecords.filter(a => a.status === 'present' || a.status === 'late' || a.status === 'half_day').length;
  const lateToday = todayRecords.filter(a => a.status === 'late').length;

  const onLeaveToday = store.leaveRequests.filter(
    l => l.status === 'approved' && l.startDate <= today && l.endDate >= today && (!department || l.departmentName === department)
  ).length;

  const attendanceRate = totalHeadcount > 0 ? Math.round((presentToday / Math.max(1, totalHeadcount - onLeaveToday)) * 100) : 0;

  // Late rate & Absenteeism rate
  const lateRate = (presentToday + lateToday) > 0 ? Math.round((lateToday / (presentToday + lateToday)) * 100) : 0;

  // Leave by type
  const leaveByType = {};
  store.leaveRequests.forEach(l => {
    if (l.status === 'approved') {
      leaveByType[l.leaveTypeName] = (leaveByType[l.leaveTypeName] || 0) + (l.workingDays || 0);
    }
  });

  // Latest payroll stats
  const latestRun = store.payrollRuns[0] || null;
  const payrollCost = latestRun ? latestRun.totalGross : 0;
  const avgSalary = totalHeadcount > 0 ? Math.round(activeEmployees.reduce((sum, e) => sum + (e.basicSalary * 1.5), 0) / totalHeadcount) : 0;

  // Top late comers
  const lateCounts = {};
  store.attendance.filter(a => a.status === 'late').forEach(a => {
    lateCounts[a.employeeId] = (lateCounts[a.employeeId] || 0) + 1;
  });
  const topLateComers = Object.entries(lateCounts)
    .map(([empId, count]) => {
      const emp = store.employees.find(e => e.id === empId);
      return {
        id: empId,
        name: emp ? `${emp.firstName} ${emp.lastName}` : empId,
        department: emp?.departmentName || 'General',
        count,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const pendingApprovals = store.leaveRequests.filter(l => l.status === 'pending').length;

  // Employee-specific metrics if role is employee
  let employeeKpi = null;
  if (req.user.role === 'employee' && req.user.employeeId) {
    const myAtt = store.attendance.filter(a => a.employeeId === req.user.employeeId);
    const myLates = myAtt.filter(a => a.status === 'late').length;
    const myHours = myAtt.reduce((sum, a) => sum + (a.hoursWorked || 0), 0);
    const myLastPayslip = store.payslips.filter(p => p.employeeId === req.user.employeeId).sort((a, b) => b.month.localeCompare(a.month))[0] || null;

    employeeKpi = {
      hoursWorkedThisMonth: parseFloat(myHours.toFixed(1)),
      lateCount: myLates,
      lastPayslipNet: myLastPayslip ? myLastPayslip.netPay : null,
      lastPayslipMonth: myLastPayslip ? myLastPayslip.month : null,
    };
  }

  res.json({
    headcount: totalHeadcount,
    presentToday,
    lateToday,
    onLeaveToday,
    attendanceRate,
    lateRate,
    payrollCost,
    avgSalary,
    pendingApprovals,
    headcountByDept,
    leaveByType,
    topLateComers,
    employeeKpi,
  });
});

// ==========================================
// MODULE 8: AI ASSISTANT
// ==========================================

// Chat endpoint with role scoping & tool execution
router.post('/ai/chat', authMiddleware, aiRateLimit, async (req, res) => {
  const { message, history = [] } = req.body;
  if (typeof message !== 'string' || !message.trim()) return res.status(400).json({ error: 'Message is required.' });
  if (message.length > 4000) return res.status(413).json({ error: 'Message is too long.' });
  if (!message) return res.status(400).json({ error: 'Message is required.' });

  try {
    const result = await chatWithAssistant(message, history, req.user);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'AI Assistant error: ' + err.message });
  }
});

// Dashboard summary
router.post('/ai/summarize', authMiddleware, requireRole(['admin', 'hr']), aiRateLimit, async (req, res) => {
  const { kpiData } = req.body;
  if (!kpiData || typeof kpiData !== 'object' || Array.isArray(kpiData)) return res.status(400).json({ error: 'KPI data must be a JSON object.' });
  if (JSON.stringify(kpiData).length > 20000) return res.status(413).json({ error: 'KPI data is too large.' });

  try {
    const result = await summarizeDashboard(kpiData, req.user);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Smart leave parsing
router.post('/ai/smart-leave', authMiddleware, aiRateLimit, (req, res, next) => {
  if (!['employee'].includes(req.user.role)) return res.status(403).json({ error: 'Smart leave is available to employee accounts only.' });
  next();
}, async (req, res) => {
  const { sentence } = req.body;
  if (typeof sentence !== 'string' || !sentence.trim()) return res.status(400).json({ error: 'Sentence is required.' });
  if (sentence.length > 1000) return res.status(413).json({ error: 'Sentence must be 1000 characters or fewer.' });

  try {
    const result = await parseSmartLeave(sentence, req.user);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// MODULE 9: COMMS & AUDIT LOGS
// ==========================================

// Announcements
router.get('/comms/announcements', authMiddleware, (req, res) => {
  const store = loadStore();
  res.json(store.announcements.filter(a => !a.targetRole || a.targetRole === 'all' || a.targetRole === req.user.role));
});

router.post('/comms/announcements', authMiddleware, requireRole(['admin', 'hr']), (req, res) => {
  const { title, content, targetRole = 'all' } = req.body;
  if (typeof title !== 'string' || !title.trim() || title.length > 160 || typeof content !== 'string' || !content.trim() || content.length > 10000) {
    return res.status(400).json({ error: 'Title (1–160 chars) and content (1–10000 chars) are required.' });
  }
  if (!['all', 'admin', 'hr', 'employee'].includes(targetRole)) {
    return res.status(400).json({ error: 'Invalid announcement target role.' });
  }

  const store = loadStore();
  const ann = {
    id: `ann_${Date.now()}`,
    companyId: store.company.id,
    title,
    content,
    targetRole,
    authorName: req.user.name,
    authorRole: req.user.role,
    createdAt: new Date().toISOString(),
  };

  store.announcements.unshift(ann);
  saveStore(store);

  logAudit({
    actor: req.user,
    action: 'POST_ANNOUNCEMENT',
    entity: 'Announcement',
    entityId: ann.id,
    details: `Posted announcement: "${ann.title}"`,
  });

  res.status(201).json(ann);
});

// Notifications
router.get('/comms/notifications', authMiddleware, (req, res) => {
  const store = loadStore();
  const myNotifs = store.notifications.filter(n => n.userId === req.user.id);
  res.json(myNotifs);
});

router.put('/comms/notifications/:id/read', authMiddleware, (req, res) => {
  const store = loadStore();
  const notif = store.notifications.find(n => n.id === req.params.id && n.userId === req.user.id);
  if (notif) notif.isRead = true;
  saveStore(store);
  res.json({ success: true });
});

// Audit Log (ADMIN ONLY!)
router.get('/audit', authMiddleware, requireRole(['admin']), (req, res) => {
  const store = loadStore();
  res.json(store.auditLogs);
});

// Destructive reset is disabled in production. Audit history must never be erased by a business endpoint.
router.post('/setup/reset', authMiddleware, requireRole(['admin']), (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Database reset is disabled in production.' });
  }
  const store = loadStore();
  const immutableAuditHistory = Array.isArray(store.auditLogs) ? [...store.auditLogs] : [];
  const fresh = resetStore();
  fresh.auditLogs = immutableAuditHistory;
  saveStore(fresh);
  logAudit({ actor: req.user, action: 'NON_PRODUCTION_RESET', entity: 'System', details: 'Non-production data reset; audit history retained.' });
  res.json({ success: true, message: 'Non-production data reset; audit history retained.' });
});

export default router;
