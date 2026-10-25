import React, { useState, useEffect } from 'react';
import {
  Building2,
  Clock,
  MapPin,
  CalendarDays,
  Plus,
  ShieldAlert,
  Save,
  RotateCcw,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { Button, Input, FormField, Modal, StatusBadge } from '../../components/common/UIComponents.jsx';
import { api } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';

export function OrgSettingsView() {
  const { user, company, refreshUser, logout } = useAuth();
  const [settings, setSettings] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  // New Department modal
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [deptForm, setDeptForm] = useState({ name: '', code: '' });

  // New Holiday modal
  const [showHolModal, setShowHolModal] = useState(false);
  const [holForm, setHolForm] = useState({ name: '', date: '' });

  // Reset DB modal
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);

  const isAdmin = user?.role === 'admin';

  const loadData = async () => {
    try {
      const [sett, depts, leaves, hols] = await Promise.all([
        api.getSettings(),
        api.getDepartments(),
        api.getLeaveTypes(),
        api.getHolidays(),
      ]);
      setSettings(sett);
      setDepartments(depts);
      setLeaveTypes(leaves);
      setHolidays(hols);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    setSaving(true);
    setMsg(null);
    try {
      await api.updateSettings(settings);
      setMsg({ type: 'success', text: 'Operational settings updated successfully.' });
      await refreshUser();
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Update failed' });
    } finally {
      setSaving(false);
    }
  };

  const handleAddDept = async (e) => {
    e.preventDefault();
    try {
      await api.createDepartment(deptForm);
      setShowDeptModal(false);
      setDeptForm({ name: '', code: '' });
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAddHoliday = async (e) => {
    e.preventDefault();
    try {
      await api.createHoliday(holForm);
      setShowHolModal(false);
      setHolForm({ name: '', date: '' });
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleResetDatabase = async () => {
    setResetting(true);
    try {
      await api.resetDatabase();
      alert('Database reset. You will now be redirected to the first-run setup.');
      logout();
      window.location.reload();
    } catch (err) {
      alert(err.message);
      setResetting(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-500">Loading organization parameters...</div>;
  }

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Organization Rules & Configuration
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational hours, attendance rules, geofence radius, official leave quotas, and holidays.
          </p>
        </div>
        {isAdmin && (
          <Button
            variant="danger"
            size="sm"
            onClick={() => setShowResetModal(true)}
            icon={RotateCcw}
          >
            Reset Database for Fresh Demo
          </Button>
        )}
      </div>

      {msg && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center justify-between ${
            msg.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} className="font-bold px-2">✕</button>
        </div>
      )}

      {/* Settings Form */}
      <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-2xs">
        <form onSubmit={handleSaveSettings} className="space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              <span>Office Hours & Geofence Parameters</span>
            </h3>
            {!isAdmin && (
              <span className="text-[11px] text-slate-500 italic">View only (Admin permission required to modify)</span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField label="Company Name">
              <Input
                value={settings?.name || ''}
                onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                disabled={!isAdmin}
              />
            </FormField>
            <FormField label="Official Start Time" hint="09:00 AM">
              <Input
                type="time"
                value={settings?.officeHoursStart || '09:00'}
                onChange={(e) => setSettings({ ...settings, officeHoursStart: e.target.value })}
                disabled={!isAdmin}
              />
            </FormField>
            <FormField label="Grace Period (minutes)" hint="Arrival after this = Late">
              <Input
                type="number"
                value={settings?.graceMinutes ?? 15}
                onChange={(e) => setSettings({ ...settings, graceMinutes: e.target.value })}
                disabled={!isAdmin}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField label="Office Latitude (GPS)" hint="e.g. 24.8607">
              <Input
                type="number"
                step="0.0001"
                value={settings?.officeLat ?? 24.8607}
                onChange={(e) => setSettings({ ...settings, officeLat: e.target.value })}
                disabled={!isAdmin}
              />
            </FormField>
            <FormField label="Office Longitude (GPS)" hint="e.g. 67.0011">
              <Input
                type="number"
                step="0.0001"
                value={settings?.officeLng ?? 67.0011}
                onChange={(e) => setSettings({ ...settings, officeLng: e.target.value })}
                disabled={!isAdmin}
              />
            </FormField>
            <FormField label="Geofence Radius (meters)" hint="Camera check-in boundary">
              <Input
                type="number"
                value={settings?.officeRadius ?? 150}
                onChange={(e) => setSettings({ ...settings, officeRadius: e.target.value })}
                disabled={!isAdmin}
              />
            </FormField>
          </div>

          {isAdmin && (
            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                variant="primary"
                isLoading={saving}
                icon={Save}
              >
                Save Operational Changes
              </Button>
            </div>
          )}
        </form>
      </div>

      {/* Two Column Grid: Departments & Leave Quotas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Departments */}
        <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-600" />
              <span>Departments ({departments.length})</span>
            </h3>
            {isAdmin && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowDeptModal(true)}
                icon={Plus}
              >
                Add Department
              </Button>
            )}
          </div>

          <div className="divide-y divide-slate-100">
            {departments.map((d) => (
              <div key={d.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-slate-800">{d.name}</span>
                  <span className="text-slate-400 font-mono ml-2">({d.code})</span>
                </div>
                <span className="text-slate-600 font-mono font-medium">
                  {d.headCount || 0} employee(s)
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Leave Quotas & Holidays */}
        <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-indigo-600" />
              <span>Official Leave Quotas (Per Year)</span>
            </h3>
          </div>

          <div className="divide-y divide-slate-100">
            {leaveTypes.map((l) => (
              <div key={l.id} className="py-2.5 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800">{l.name}</span>
                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-mono font-bold rounded">
                  {l.quotaDays > 100 ? 'Unlimited' : `${l.quotaDays} Days`}
                </span>
              </div>
            ))}
          </div>

          {/* Public Holidays */}
          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-slate-700">Official Public Holidays ({holidays.length})</h4>
              {isAdmin && (
                <button
                  onClick={() => setShowHolModal(true)}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  + Add Holiday
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {holidays.map((h) => (
                <div key={h.id} className="p-2 bg-slate-50 rounded-lg text-xs">
                  <span className="font-semibold text-slate-800 block truncate">{h.name}</span>
                  <span className="text-slate-500 font-mono text-[11px]">{h.date}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Add Department Modal */}
      <Modal
        isOpen={showDeptModal}
        onClose={() => setShowDeptModal(false)}
        title="Create New Department"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setShowDeptModal(false)}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={handleAddDept}>Create Department</Button>
          </>
        }
      >
        <form onSubmit={handleAddDept} className="space-y-4">
          <FormField label="Department Name" required>
            <Input
              value={deptForm.name}
              onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
              placeholder="e.g. Quality Assurance"
              required
            />
          </FormField>
          <FormField label="Department Code" required hint="3-4 uppercase letters">
            <Input
              value={deptForm.code}
              onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value.toUpperCase() })}
              placeholder="e.g. QA"
              required
            />
          </FormField>
        </form>
      </Modal>

      {/* Add Holiday Modal */}
      <Modal
        isOpen={showHolModal}
        onClose={() => setShowHolModal(false)}
        title="Add Public Holiday"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setShowHolModal(false)}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={handleAddHoliday}>Add Holiday</Button>
          </>
        }
      >
        <form onSubmit={handleAddHoliday} className="space-y-4">
          <FormField label="Holiday Name" required>
            <Input
              value={holForm.name}
              onChange={(e) => setHolForm({ ...holForm, name: e.target.value })}
              placeholder="e.g. Eid Holiday"
              required
            />
          </FormField>
          <FormField label="Date (YYYY-MM-DD)" required>
            <Input
              type="date"
              value={holForm.date}
              onChange={(e) => setHolForm({ ...holForm, date: e.target.value })}
              required
            />
          </FormField>
        </form>
      </Modal>

      {/* Reset Database Modal */}
      <Modal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        title="Reset Entire Database"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setShowResetModal(false)}>Cancel</Button>
            <Button variant="danger" size="sm" isLoading={resetting} onClick={handleResetDatabase}>
              Confirm Reset & Start Fresh
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-xs text-slate-600">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              This will clear all companies, employees, attendance logs, and payroll runs, returning HCM Lite to a fresh installation state.
            </span>
          </div>
          <p>
            Use this between judging rounds to demonstrate the clean first-run setup flow from scratch as required by the hackathon brief.
          </p>
        </div>
      </Modal>
    </div>
  );
}
