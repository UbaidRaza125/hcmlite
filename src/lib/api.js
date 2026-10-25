/**
 * HCM Lite — API Client
 * Clean HTTP client handling JSON serialization, JWT auth headers, and errors.
 */

const TOKEN_KEY = 'hcm_lite_jwt_token';

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export async function apiRequest(endpoint, options = {}) {
  const token = getStoredToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`/api${endpoint}`, {
    ...options,
    headers,
  });

  // Handle file downloads
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/csv')) {
    const text = await response.text();
    return text;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.error || `Request failed with status ${response.status}`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  // Setup & Auth
  getSetupStatus: () => apiRequest('/setup/status'),
  getDemoAccounts: () => apiRequest('/setup/demo-accounts'),
  initSetup: (payload) => apiRequest('/setup/init', { method: 'POST', body: JSON.stringify(payload) }),
  resetDatabase: () => apiRequest('/setup/reset', { method: 'POST' }),
  login: (credentials) => apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  changePassword: (newPassword) => apiRequest('/auth/change-password', { method: 'POST', body: JSON.stringify({ newPassword }) }),
  getMe: () => apiRequest('/auth/me'),
  createHr: (payload) => apiRequest('/auth/create-hr', { method: 'POST', body: JSON.stringify(payload) }),
  updateUserStatus: (id, payload) => apiRequest(`/auth/users/${id}/status`, { method: 'PUT', body: JSON.stringify(payload) }),

  // Organization
  getSettings: () => apiRequest('/org/settings'),
  updateSettings: (payload) => apiRequest('/org/settings', { method: 'PUT', body: JSON.stringify(payload) }),
  getDepartments: () => apiRequest('/org/departments'),
  createDepartment: (payload) => apiRequest('/org/departments', { method: 'POST', body: JSON.stringify(payload) }),
  getLeaveTypes: () => apiRequest('/org/leave-types'),
  getHolidays: () => apiRequest('/org/holidays'),
  createHoliday: (payload) => apiRequest('/org/holidays', { method: 'POST', body: JSON.stringify(payload) }),

  // Employees
  getEmployees: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/employees${query ? `?${query}` : ''}`);
  },
  getEmployee: (id) => apiRequest(`/employees/${id}`),
  createEmployee: (payload) => apiRequest('/employees', { method: 'POST', body: JSON.stringify(payload) }),
  updateEmployee: (id, payload) => apiRequest(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  importCsv: (rows, dryRun = true) => apiRequest('/employees/import-csv', { method: 'POST', body: JSON.stringify({ rows, dryRun }) }),
  exportCsvUrl: '/api/employees/export-csv',

  // Attendance
  getTodayAttendance: () => apiRequest('/attendance/today'),
  checkIn: (payload = {}) => apiRequest('/attendance/check-in', { method: 'POST', body: JSON.stringify(payload) }),
  checkOut: () => apiRequest('/attendance/check-out', { method: 'POST' }),
  getMyAttendance: () => apiRequest('/attendance/my'),
  requestCorrection: (payload) => apiRequest('/attendance/correction', { method: 'POST', body: JSON.stringify(payload) }),
  reviewCorrection: (id, payload) => apiRequest(`/attendance/correction/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  // Leave
  getLeaveBalances: (empId) => apiRequest(`/leave/balances${empId ? `?employeeId=${empId}` : ''}`),
  applyLeave: (payload) => apiRequest('/leave/apply', { method: 'POST', body: JSON.stringify(payload) }),
  getLeaveRequests: () => apiRequest('/leave/requests'),
  reviewLeave: (id, payload) => apiRequest(`/leave/requests/${id}/decision`, { method: 'PUT', body: JSON.stringify(payload) }),

  // Payroll
  getPayrollRuns: () => apiRequest('/payroll/runs'),
  getPayrollRun: (id) => apiRequest(`/payroll/runs/${id}`),
  preparePayrollDraft: (month) => apiRequest('/payroll/draft', { method: 'POST', body: JSON.stringify({ month }) }),
  finalizePayroll: (id) => apiRequest(`/payroll/runs/${id}/finalize`, { method: 'POST' }),
  getMyPayslips: () => apiRequest('/payroll/my-payslips'),
  getPayslip: (id) => apiRequest(`/payroll/payslips/${id}`),

  // Analytics
  getAnalytics: (department = '') => apiRequest(`/analytics${department ? `?department=${encodeURIComponent(department)}` : ''}`),

  // AI Assistant
  chatAi: (message, history = []) => apiRequest('/ai/chat', { method: 'POST', body: JSON.stringify({ message, history }) }),
  summarizeDashboard: (kpiData) => apiRequest('/ai/summarize', { method: 'POST', body: JSON.stringify({ kpiData }) }),
  parseSmartLeave: (sentence) => apiRequest('/ai/smart-leave', { method: 'POST', body: JSON.stringify({ sentence }) }),

  // Comms & Audit
  getAnnouncements: () => apiRequest('/comms/announcements'),
  createAnnouncement: (payload) => apiRequest('/comms/announcements', { method: 'POST', body: JSON.stringify(payload) }),
  getNotifications: () => apiRequest('/comms/notifications'),
  markNotificationRead: (id) => apiRequest(`/comms/notifications/${id}/read`, { method: 'PUT' }),
  getAuditLogs: () => apiRequest('/audit'),
};
