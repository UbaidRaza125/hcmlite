import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import apiRouter from '../server/routes.js';
import { resetStore } from '../server/storage.js';

// Use a real ephemeral HTTP listener so Express routing, JSON parsing, headers,
// status codes and middleware are exercised instead of a hand-written mock request.
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);
  return app;
}

async function startTestServer(app) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

async function request(baseUrl, method, url, body = null, token = null) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}${url}`, {
    method,
    headers,
    ...(body === null ? {} : { body: JSON.stringify(body) }),
  });
  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  return { status: response.status, data, headers: response.headers };
}

test('End-to-End Core Workflow: Setup, RBAC, Attendance, Leave, Payroll & Security', async () => {
  resetStore();
  process.env.NODE_ENV = 'test';
  const app = createTestApp();
  const { server, baseUrl } = await startTestServer(app);
  try {
  // 1. Initial state is unconfigured
  const statusRes = await request(baseUrl, 'GET', '/api/setup/status');
  assert.equal(statusRes.status, 200);
  assert.equal(statusRes.data.isConfigured, false);

  // 2. First-run setup: Admin sets up company
  const setupRes = await request(baseUrl, 'POST', '/api/setup/init', {
    companyName: 'Acme Technologies',
    adminName: 'Chief Administrator',
    adminEmail: 'admin@acme.com',
    adminPassword: 'AdminSecurePass!2026',
    officeStart: '09:00',
    graceMinutes: 15,
  });
  assert.equal(setupRes.status, 201);
  assert.equal(setupRes.data.success, true);
  const adminToken = setupRes.data.token;
  assert.ok(adminToken);

  // 3. Second setup call rejected
  const secondSetupRes = await request(baseUrl, 'POST', '/api/setup/init', {
    companyName: 'Duplicate Inc',
    adminEmail: 'hack@acme.com',
    adminPassword: 'Password!123',
  });
  assert.equal(secondSetupRes.status, 400);

  // 4. Admin creates HR account
  const createHrRes = await request(baseUrl, 'POST', '/api/auth/create-hr', {
    name: 'Sarah Connor',
    email: 'hr@acme.com',
    password: 'HrPassword!2026',
  }, adminToken);
  assert.equal(createHrRes.status, 201);

  // 5. HR logs in
  const hrLoginRes = await request(baseUrl, 'POST', '/api/auth/login', {
    email: 'hr@acme.com',
    password: 'HrPassword!2026',
  });
  assert.equal(hrLoginRes.status, 200);
  const hrToken = hrLoginRes.data.token;
  assert.ok(hrToken);

  // 6. HR registers employee
  const registerEmpRes = await request(baseUrl, 'POST', '/api/employees', {
    employeeCode: 'EMP-001',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@acme.com',
    phone: '+1 555-0199',
    departmentId: 'dept_eng',
    designation: 'Senior Engineer',
    joiningDate: '2026-01-15',
    basicSalary: 100000,
  }, hrToken);
  assert.equal(registerEmpRes.status, 201);
  const tempPass = registerEmpRes.data.temporaryCredentials.temporaryPassword;
  const empId = registerEmpRes.data.employee.id;
  assert.ok(tempPass);

  // 7. Employee logs in with temporary password
  const empLoginRes = await request(baseUrl, 'POST', '/api/auth/login', {
    email: 'john.doe@acme.com',
    password: tempPass,
  });
  assert.equal(empLoginRes.status, 200);
  assert.equal(empLoginRes.data.user.temporaryPassword, true);
  let empToken = empLoginRes.data.token;
  const blockedBeforePasswordChange = await request(baseUrl, 'GET', '/api/employees', null, empToken);
  assert.equal(blockedBeforePasswordChange.status, 403);

  // 8. Employee changes password on first sign-in
  const changePassRes = await request(baseUrl, 'POST', '/api/auth/change-password', {
    newPassword: 'MyNewPermanentPassword!2026',
  }, empToken);
  assert.equal(changePassRes.status, 200);
  empToken = changePassRes.data.token;

  // 9. Employee checks in
  const checkInRes = await request(baseUrl, 'POST', '/api/attendance/check-in', {}, empToken);
  assert.equal(checkInRes.status, 201);
  assert.ok(checkInRes.data.record.checkInTime);

  // 10. Second check-in today must return 409 Conflict
  const secondCheckIn = await request(baseUrl, 'POST', '/api/attendance/check-in', {}, empToken);
  assert.equal(secondCheckIn.status, 409);

  // 11. Employee applies for leave
  const leaveRes = await request(baseUrl, 'POST', '/api/leave/apply', {
    leaveTypeId: 'leave_casual',
    startDate: '2026-11-02', // Monday
    endDate: '2026-11-03', // Tuesday = 2 working days
    reason: "Sister's wedding celebration",
  }, empToken);
  assert.equal(leaveRes.status, 201);
  assert.equal(leaveRes.data.leaveRequest.workingDays, 2);
  const leaveId = leaveRes.data.leaveRequest.id;

  // 12. HR approves leave
  const decisionRes = await request(baseUrl, 'PUT', `/api/leave/requests/${leaveId}/decision`, {
    decision: 'approved',
    comment: 'Approved. Enjoy the celebration!',
  }, hrToken);
  assert.equal(decisionRes.status, 200);
  assert.equal(decisionRes.data.leave.status, 'approved');

  // 13. HR drafts payroll for 2026-10
  const draftPayrollRes = await request(baseUrl, 'POST', '/api/payroll/draft', {
    month: '2026-10',
  }, hrToken);
  assert.equal(draftPayrollRes.status, 201);
  assert.equal(draftPayrollRes.data.payrollRun.status, 'draft');
  const runId = draftPayrollRes.data.payrollRun.id;

  // 14. HR tries to finalize payroll -> MUST BE 403 Forbidden!
  const hrFinalize = await request(baseUrl, 'POST', `/api/payroll/runs/${runId}/finalize`, {}, hrToken);
  assert.equal(hrFinalize.status, 403);

  // 15. Admin finalizes payroll -> Success!
  const adminFinalize = await request(baseUrl, 'POST', `/api/payroll/runs/${runId}/finalize`, {}, adminToken);
  assert.equal(adminFinalize.status, 200);
  assert.equal(adminFinalize.data.payrollRun.status, 'finalized');

  // 16. Employee attempts to access another employee's profile
  const unauthorizedProfile = await request(baseUrl, 'GET', '/api/employees/emp_fake_999', null, empToken);
  assert.equal(unauthorizedProfile.status, 403);

  // 17. Admin reviews audit log
  const auditRes = await request(baseUrl, 'GET', '/api/audit', null, adminToken);
  assert.equal(auditRes.status, 200);
  assert.ok(auditRes.data.length >= 6);

  // 18. Employee cannot view audit log
  const empAudit = await request(baseUrl, 'GET', '/api/audit', null, empToken);
  assert.equal(empAudit.status, 403);

  // Employee analytics must never expose organization-wide payroll/headcount fields.
  const empAnalytics = await request(baseUrl, 'GET', '/api/analytics', null, empToken);
  assert.equal(empAnalytics.status, 200);
  assert.equal(Object.hasOwn(empAnalytics.data, 'payrollCost'), false);
  assert.equal(Object.hasOwn(empAnalytics.data, 'headcount'), false);

  // Employee directory is scoped and omits salary fields.
  const empDirectory = await request(baseUrl, 'GET', '/api/employees', null, empToken);
  assert.equal(empDirectory.status, 200);
  assert.equal(empDirectory.data.total, 1);
  assert.equal(Object.hasOwn(empDirectory.data.employees[0], 'basicSalary'), false);

  // Finalized payroll cannot be finalized a second time.
  const secondFinalize = await request(baseUrl, 'POST', `/api/payroll/runs/${runId}/finalize`, {}, adminToken);
  assert.equal(secondFinalize.status, 409);
  } finally {
    await new Promise(resolve => server.close(resolve));
    resetStore();
  }
});
