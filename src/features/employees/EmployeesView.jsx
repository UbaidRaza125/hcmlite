import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Upload,
  Download,
  Shield,
  Eye,
  Edit2,
  Copy,
  Check,
  AlertCircle,
  KeyRound,
  FileSpreadsheet,
} from 'lucide-react';
import {
  Button,
  Input,
  Select,
  FormField,
  Modal,
  StatusBadge,
  SkeletonLoader,
  EmptyState,
} from '../../components/common/UIComponents.jsx';
import { api } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';

export function EmployeesView() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modals
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showHrModal, setShowHrModal] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [show360Modal, setShow360Modal] = useState(false);
  const [selected360, setSelected360] = useState(null);
  const [loading360, setLoading360] = useState(false);

  // Registration Form
  const [quickMode, setQuickMode] = useState(true);
  const [regForm, setRegForm] = useState({
    name: '',
    password: '',
    employeeCode: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    departmentId: '',
    designation: '',
    joiningDate: new Date().toISOString().split('T')[0],
    basicSalary: 80000,
    gender: 'unspecified',
  });
  const [submittingReg, setSubmittingReg] = useState(false);
  const [tempCredentials, setTempCredentials] = useState(null);
  const [copiedPass, setCopiedPass] = useState(false);

  // Create HR Form (Admin only)
  const [hrForm, setHrForm] = useState({ name: '', email: '', password: '' });
  const [creatingHr, setCreatingHr] = useState(false);

  // CSV Import State
  const [csvText, setCsvText] = useState('');
  const [dryRunResult, setDryRunResult] = useState(null);
  const [importingCsv, setImportingCsv] = useState(false);

  // Edit Phone/Address Form (for Employee or HR)
  const [editingEmployee, setEditingEmployee] = useState(false);
  const [editForm, setEditForm] = useState({ phone: '', address: '', basicSalary: 0, status: 'active' });

  const isAdmin = user?.role === 'admin';
  const isHr = user?.role === 'hr';
  const isStaff = user?.role === 'employee';

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const res = await api.getEmployees({
        search,
        department: deptFilter,
        status: statusFilter,
        page,
        limit: 15,
      });
      setEmployees(res.employees);
      setTotalPages(res.totalPages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api.getDepartments().then(setDepartments).catch(() => {});
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [search, deptFilter, statusFilter, page]);

  // Set default department when loaded
  useEffect(() => {
    if (departments.length > 0 && !regForm.departmentId) {
      setRegForm((prev) => ({ ...prev, departmentId: departments[0].id }));
    }
  }, [departments]);

  const handleRegisterEmployee = async (e) => {
    e.preventDefault();
    setSubmittingReg(true);
    try {
      let payload = { ...regForm };
      if (quickMode) {
        if (!regForm.name.trim()) throw new Error('Please enter the employee full name.');
        const parts = regForm.name.trim().split(/\s+/);
        payload.firstName = parts[0];
        payload.lastName = parts.slice(1).join(' ') || 'Employee';
        payload.employeeCode = `EMP-${String(employees.length + 1).padStart(3, '0')}`;
        payload.departmentId = regForm.departmentId || departments[0]?.id || 'dept_gen';
        payload.designation = 'Staff';
        payload.joiningDate = new Date().toISOString().split('T')[0];
        payload.basicSalary = 80000;
      }
      const res = await api.createEmployee(payload);
      setTempCredentials(res.temporaryCredentials);
      await loadEmployees();
    } catch (err) {
      alert(`Registration failed: ${err.message}`);
    } finally {
      setSubmittingReg(false);
    }
  };

  const handleCreateHr = async (e) => {
    e.preventDefault();
    setCreatingHr(true);
    try {
      await api.createHr(hrForm);
      alert(`HR account for ${hrForm.email} created successfully.`);
      setShowHrModal(false);
      setHrForm({ name: '', email: '', password: '' });
    } catch (err) {
      alert(`Failed to create HR account: ${err.message}`);
    } finally {
      setCreatingHr(false);
    }
  };

  const handleOpen360 = async (empId) => {
    setShow360Modal(true);
    setLoading360(true);
    setEditingEmployee(false);
    try {
      const data = await api.getEmployee(empId);
      setSelected360(data);
      setEditForm({
        phone: data.employee.phone || '',
        address: data.employee.address || '',
        basicSalary: data.employee.basicSalary || 0,
        status: data.employee.status || 'active',
      });
    } catch (err) {
      alert(err.message);
      setShow360Modal(false);
    } finally {
      setLoading360(false);
    }
  };

  const handleSave360Edit = async () => {
    if (!selected360) return;
    try {
      await api.updateEmployee(selected360.employee.id, editForm);
      alert('Employee details updated.');
      await handleOpen360(selected360.employee.id);
      await loadEmployees();
    } catch (err) {
      alert(err.message);
    }
  };

  const parseCsvLines = (text) => {
    const lines = text.trim().split('\n');
    if (lines.length <= 1) return [];
    const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
    return lines.slice(1).map((line) => {
      const parts = line.split(',').map((p) => p.trim().replace(/^"|"$/g, ''));
      const obj = {};
      headers.forEach((h, i) => {
        const key = h.toLowerCase().replace(/\s+/g, '');
        if (key.includes('code')) obj.code = parts[i];
        else if (key.includes('first')) obj.firstName = parts[i];
        else if (key.includes('last')) obj.lastName = parts[i];
        else if (key.includes('email')) obj.email = parts[i];
        else if (key.includes('dept') || key.includes('department')) obj.department = parts[i];
        else if (key.includes('desig')) obj.designation = parts[i];
        else if (key.includes('join')) obj.joiningDate = parts[i];
        else if (key.includes('salary')) obj.salary = parts[i];
      });
      return obj;
    });
  };

  const handleDryRunCsv = async () => {
    const rows = parseCsvLines(csvText);
    if (rows.length === 0) {
      alert('Please enter or paste CSV lines (with header row).');
      return;
    }
    setImportingCsv(true);
    try {
      const res = await api.importCsv(rows, true);
      setDryRunResult(res);
    } catch (err) {
      alert(err.message);
    } finally {
      setImportingCsv(false);
    }
  };

  const handleExecuteCsv = async () => {
    const rows = parseCsvLines(csvText);
    setImportingCsv(true);
    try {
      const res = await api.importCsv(rows, false);
      alert(`Successfully imported ${res.importedCount} employees!`);
      setShowCsvModal(false);
      setCsvText('');
      setDryRunResult(null);
      await loadEmployees();
    } catch (err) {
      alert(err.message);
    } finally {
      setImportingCsv(false);
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            {isStaff ? 'Company Directory' : 'Employee Directory & Access Provisioning'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isStaff
              ? 'Find colleagues and department contact details.'
              : 'Register personnel, issue login credentials, audit salary structures, and import bulk staff.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHrModal(true)}
              icon={Shield}
            >
              Create HR Account
            </Button>
          )}

          {!isStaff && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCsvModal(true)}
                icon={Upload}
              >
                CSV Import
              </Button>
              <a
                href={api.exportCsvUrl}
                download
                className="inline-flex items-center justify-center font-medium rounded-lg text-xs px-2.5 py-1.5 gap-1.5 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV Export</span>
              </a>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setTempCredentials(null);
                  setShowRegisterModal(true);
                }}
                icon={UserPlus}
              >
                Register Employee
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, employee code, or email..."
            className="pl-9 text-xs"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            options={[
              { value: '', label: 'All Departments' },
              ...departments.map((d) => ({ value: d.id, label: d.name })),
            ]}
            className="text-xs w-44"
          />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: '', label: 'All Statuses' },
              { value: 'active', label: 'Active' },
              { value: 'probation', label: 'Probation' },
              { value: 'resigned', label: 'Resigned' },
            ]}
            className="text-xs w-36"
          />
        </div>
      </div>

      {/* High-Density Data Grid */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-6">
            <SkeletonLoader rows={6} />
          </div>
        ) : employees.length === 0 ? (
          <div className="p-12 text-center">
            <EmptyState
              title="No employees found"
              description="No personnel records match your search or filter criteria. Click 'Register Employee' to onboard staff."
              icon={Users}
              action={
                !isStaff && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setShowRegisterModal(true)}
                  >
                    Register First Employee
                  </Button>
                )
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Designation</th>
                  {!isStaff && <th className="py-3 px-4 text-right">Basic Salary</th>}
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                      {emp.employeeCode}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">
                        {emp.firstName} {emp.lastName}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono truncate max-w-[180px]">
                        {emp.email}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-medium">{emp.departmentName}</td>
                    <td className="py-3 px-4 text-slate-600">{emp.designation}</td>
                    {!isStaff && (
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-800">
                        PKR {Number(emp.basicSalary).toLocaleString()}
                      </td>
                    )}
                    <td className="py-3 px-4">
                      <StatusBadge status={emp.status} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpen360(emp.id)}
                        icon={Eye}
                      >
                        360 View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Register Employee Modal */}
      <Modal
        isOpen={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
        title="Register New Employee & Provision Login"
        maxWidth="max-w-2xl"
        footer={
          tempCredentials ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setShowRegisterModal(false);
                setTempCredentials(null);
              }}
            >
              Done
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => setShowRegisterModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                isLoading={submittingReg}
                onClick={handleRegisterEmployee}
              >
                Register & Issue Temporary Password
              </Button>
            </>
          )
        }
      >
        {tempCredentials ? (
          <div className="space-y-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
              <Check className="w-5 h-5" />
              <span>Employee Registered & Login Provisioned!</span>
            </div>
            <p className="text-xs text-emerald-700 leading-relaxed">
              An employee account has been created with a temporary password. The employee must change this password on their first sign-in.
            </p>
            <div className="bg-white p-3.5 rounded-lg border border-emerald-200 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Login Email:</span>
                <span className="font-mono font-semibold text-slate-900">{tempCredentials.email}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Temporary Password:</span>
                <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                  {tempCredentials.temporaryPassword}
                </span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                navigator.clipboard.writeText(
                  `Email: ${tempCredentials.email}\nPassword: ${tempCredentials.temporaryPassword}`
                );
                setCopiedPass(true);
                setTimeout(() => setCopiedPass(false), 2000);
              }}
              icon={copiedPass ? Check : Copy}
            >
              {copiedPass ? 'Credentials Copied to Clipboard!' : 'Copy Credentials for Employee'}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleRegisterEmployee} className="space-y-4">
            <div className="flex rounded-lg bg-slate-100 p-1 mb-2 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setQuickMode(true)}
                className={`flex-1 py-1.5 rounded-md transition-all ${
                  quickMode
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                ⚡ Quick Add (Name, Email, Password)
              </button>
              <button
                type="button"
                onClick={() => setQuickMode(false)}
                className={`flex-1 py-1.5 rounded-md transition-all ${
                  !quickMode
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                📋 Full Profile Details
              </button>
            </div>

            {quickMode ? (
              <div className="space-y-3 pt-1">
                <FormField label="Full Name" required hint="e.g. Ali Khan">
                  <Input
                    type="text"
                    value={regForm.name}
                    onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                    placeholder="Ali Khan"
                    required
                  />
                </FormField>

                <FormField label="Corporate Email" required>
                  <Input
                    type="email"
                    value={regForm.email}
                    onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                    placeholder="ali@company.com"
                    required
                  />
                </FormField>

                <FormField label="Password" hint="Optional — leave blank to generate a temporary password">
                  <Input
                    type="password"
                    value={regForm.password}
                    onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                    placeholder="••••••••"
                  />
                </FormField>

                <p className="text-[11px] text-slate-500 italic">
                  Note: Code, Department, and Salary are auto-assigned with standard defaults and can be customized anytime via Employee 360 view.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <FormField label="Employee Code" required hint="e.g. EMP-001">
                    <Input
                      value={regForm.employeeCode}
                      onChange={(e) => setRegForm({ ...regForm, employeeCode: e.target.value.toUpperCase() })}
                      placeholder="EMP-001"
                      required
                    />
                  </FormField>
                  <FormField label="First Name" required>
                    <Input
                      value={regForm.firstName}
                      onChange={(e) => setRegForm({ ...regForm, firstName: e.target.value })}
                      placeholder="John"
                      required
                    />
                  </FormField>
                  <FormField label="Last Name" required>
                    <Input
                      value={regForm.lastName}
                      onChange={(e) => setRegForm({ ...regForm, lastName: e.target.value })}
                      placeholder="Doe"
                      required
                    />
                  </FormField>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Corporate Email" required>
                    <Input
                      type="email"
                      value={regForm.email}
                      onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                      placeholder="john.doe@company.com"
                      required
                    />
                  </FormField>
                  <FormField label="Password" hint="Optional — direct password">
                    <Input
                      type="password"
                      value={regForm.password}
                      onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                      placeholder="••••••••"
                    />
                  </FormField>
                  <FormField label="Phone Number">
                    <Input
                      value={regForm.phone}
                      onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
                      placeholder="+92 300 1234567"
                    />
                  </FormField>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Department" required>
                    <Select
                      value={regForm.departmentId}
                      onChange={(e) => setRegForm({ ...regForm, departmentId: e.target.value })}
                      options={departments.map((d) => ({ value: d.id, label: d.name }))}
                    />
                  </FormField>
                  <FormField label="Designation" required>
                    <Input
                      value={regForm.designation}
                      onChange={(e) => setRegForm({ ...regForm, designation: e.target.value })}
                      placeholder="Senior Software Engineer"
                      required
                    />
                  </FormField>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Joining Date" required>
                    <Input
                      type="date"
                      value={regForm.joiningDate}
                      onChange={(e) => setRegForm({ ...regForm, joiningDate: e.target.value })}
                      required
                    />
                  </FormField>
                  <FormField label="Monthly Basic Salary (PKR)" required hint="Gross = 1.5 × Basic">
                    <Input
                      type="number"
                      value={regForm.basicSalary}
                      onChange={(e) => setRegForm({ ...regForm, basicSalary: e.target.value })}
                      required
                    />
                  </FormField>
                </div>

                <FormField label="Residential Address">
                  <Input
                    value={regForm.address}
                    onChange={(e) => setRegForm({ ...regForm, address: e.target.value })}
                    placeholder="Street address, City"
                  />
                </FormField>
              </>
            )}
          </form>
        )}
      </Modal>

      {/* Admin Create HR Login Modal */}
      <Modal
        isOpen={showHrModal}
        onClose={() => setShowHrModal(false)}
        title="Create Human Resources (HR) Account"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setShowHrModal(false)}>Cancel</Button>
            <Button variant="primary" size="sm" isLoading={creatingHr} onClick={handleCreateHr}>
              Create HR Login
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateHr} className="space-y-4">
          <FormField label="HR Full Name" required>
            <Input
              value={hrForm.name}
              onChange={(e) => setHrForm({ ...hrForm, name: e.target.value })}
              placeholder="HR Lead"
              required
            />
          </FormField>
          <FormField label="HR Email Address" required>
            <Input
              type="email"
              value={hrForm.email}
              onChange={(e) => setHrForm({ ...hrForm, email: e.target.value })}
              placeholder="hr@company.com"
              required
            />
          </FormField>
          <FormField label="Temporary Password" required hint="HR will change on first sign-in">
            <Input
              type="password"
              value={hrForm.password}
              onChange={(e) => setHrForm({ ...hrForm, password: e.target.value })}
              placeholder="••••••••"
              required
            />
          </FormField>
        </form>
      </Modal>

      {/* CSV Import Modal with Dry Run */}
      <Modal
        isOpen={showCsvModal}
        onClose={() => {
          setShowCsvModal(false);
          setDryRunResult(null);
        }}
        title="Bulk Employee CSV Import"
        maxWidth="max-w-2xl"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setShowCsvModal(false)}>Cancel</Button>
            {!dryRunResult || dryRunResult.errorCount > 0 ? (
              <Button variant="primary" size="sm" isLoading={importingCsv} onClick={handleDryRunCsv}>
                Run CSV Dry Run Test
              </Button>
            ) : (
              <Button variant="success" size="sm" isLoading={importingCsv} onClick={handleExecuteCsv}>
                Execute Live Import ({dryRunResult.validCount} rows)
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600">
            Paste CSV records below. Format: <code className="bg-slate-100 p-1 rounded font-mono">code,firstName,lastName,email,department,designation,joiningDate,salary</code>
          </p>

          <textarea
            value={csvText}
            onChange={(e) => {
              setCsvText(e.target.value);
              setDryRunResult(null);
            }}
            rows={5}
            placeholder={`code,firstName,lastName,email,department,designation,joiningDate,salary\nEMP-002,Alice,Smith,alice@acme.com,Engineering,DevOps,2026-02-01,95000\nEMP-003,Bob,Johnson,bob@acme.com,Finance,Accountant,2026-03-01,85000`}
            className="w-full p-3 font-mono text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          {dryRunResult && (
            <div className="space-y-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800">Dry Run Validation Report</span>
                <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                  dryRunResult.errorCount === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {dryRunResult.validCount} Valid · {dryRunResult.errorCount} Errors
                </span>
              </div>

              {dryRunResult.errors.length > 0 ? (
                <div className="divide-y divide-rose-100 bg-rose-50/60 p-2.5 rounded-lg border border-rose-200 max-h-40 overflow-y-auto">
                  {dryRunResult.errors.map((err, i) => (
                    <div key={i} className="py-1 text-[11px] text-rose-700">
                      Row {err.row}: <strong>{err.field}</strong> — {err.reason}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-emerald-700 text-xs">
                  All {dryRunResult.validCount} rows passed validation and are ready to import!
                </p>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Employee 360 Modal */}
      <Modal
        isOpen={show360Modal}
        onClose={() => setShow360Modal(false)}
        title={`Employee 360 — ${selected360?.employee?.firstName} ${selected360?.employee?.lastName}`}
        maxWidth="max-w-2xl"
        footer={
          <Button variant="ghost" size="sm" onClick={() => setShow360Modal(false)}>Close</Button>
        }
      >
        {loading360 ? (
          <SkeletonLoader rows={5} />
        ) : selected360 ? (
          <div className="space-y-5 text-xs text-slate-700">
            {/* Header info */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  {selected360.employee.firstName} {selected360.employee.lastName}
                </h4>
                <p className="text-slate-500 font-mono mt-0.5">
                  {selected360.employee.employeeCode} · {selected360.employee.designation} ({selected360.employee.departmentName})
                </p>
                <p className="text-slate-400 text-[11px] mt-1">{selected360.employee.email}</p>
              </div>
              <StatusBadge status={selected360.employee.status} />
            </div>

            {/* Editable Contact Section */}
            <div className="space-y-3 p-4 bg-white border border-slate-200 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800">Contact & Employment Info</span>
                {!editingEmployee ? (
                  <button
                    onClick={() => setEditingEmployee(true)}
                    className="text-indigo-600 hover:text-indigo-800 font-semibold"
                  >
                    Edit Details
                  </button>
                ) : (
                  <button
                    onClick={handleSave360Edit}
                    className="text-emerald-600 hover:text-emerald-800 font-bold"
                  >
                    Save Changes
                  </button>
                )}
              </div>

              {editingEmployee ? (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <FormField label="Phone">
                    <Input
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    />
                  </FormField>
                  <FormField label="Address">
                    <Input
                      value={editForm.address}
                      onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    />
                  </FormField>
                  {!isStaff && (
                    <>
                      <FormField label="Basic Salary (PKR)">
                        <Input
                          type="number"
                          value={editForm.basicSalary}
                          onChange={(e) => setEditForm({ ...editForm, basicSalary: e.target.value })}
                        />
                      </FormField>
                      <FormField label="Status">
                        <Select
                          value={editForm.status}
                          onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                          options={[
                            { value: 'active', label: 'Active' },
                            { value: 'probation', label: 'Probation' },
                            { value: 'resigned', label: 'Resigned' },
                          ]}
                        />
                      </FormField>
                    </>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                  <div><span className="text-slate-400">Phone:</span> {selected360.employee.phone || 'N/A'}</div>
                  <div><span className="text-slate-400">Address:</span> {selected360.employee.address || 'N/A'}</div>
                  <div><span className="text-slate-400">Joined:</span> {selected360.employee.joiningDate}</div>
                  {!isStaff && (
                    <div>
                      <span className="text-slate-400">Basic Salary:</span> PKR {Number(selected360.employee.basicSalary).toLocaleString()}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Recent Attendance Preview */}
            <div className="space-y-2">
              <span className="font-bold text-slate-800 block">Recent Attendance Activity</span>
              {selected360.attendanceSummary?.recent?.length === 0 ? (
                <p className="text-slate-400 py-2">No attendance logged yet.</p>
              ) : (
                <div className="divide-y divide-slate-100 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  {selected360.attendanceSummary.recent.map((a) => (
                    <div key={a.id} className="py-1.5 flex justify-between text-[11px]">
                      <span className="font-mono">{a.date}</span>
                      <span>In: {a.checkInTime} {a.checkOutTime ? `· Out: ${a.checkOutTime}` : ''}</span>
                      <StatusBadge status={a.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
