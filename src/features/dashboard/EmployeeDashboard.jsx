import React, { useState, useEffect } from 'react';
import {
  Clock,
  Calendar,
  CreditCard,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  FileText,
  Bell,
  ArrowRight,
  Camera,
  MapPin,
  Loader2,
} from 'lucide-react';
import { StatCard, Button, SkeletonLoader, StatusBadge } from '../../components/common/UIComponents.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../lib/api.js';

export function EmployeeDashboard({ onOpenAi, setTab, onSmartLeave }) {
  const { user, employee } = useAuth();
  const [todayRecord, setTodayRecord] = useState(null);
  const [balances, setBalances] = useState(null);
  const [kpi, setKpi] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  const loadAll = async () => {
    try {
      const [todayAtt, leaveBal, analytics, annRes] = await Promise.all([
        api.getTodayAttendance(),
        api.getLeaveBalances(),
        api.getAnalytics(),
        api.getAnnouncements(),
      ]);

      const myToday = todayAtt.records?.find(r => r.employeeId === user.employeeId) || null;
      setTodayRecord(myToday);
      setBalances(leaveBal);
      setKpi(analytics.employeeKpi);
      setAnnouncements(annRes.slice(0, 3));
    } catch (err) {
      console.error('Failed to load employee dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [user]);

  const handleWebCheckIn = async () => {
    setCheckingIn(true);
    setStatusMsg(null);
    try {
      const res = await api.checkIn({});
      setStatusMsg({ type: 'success', text: `Checked in successfully at ${res.record.checkInTime} (${res.record.status})` });
      await loadAll();
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || 'Check-in failed' });
    } finally {
      setCheckingIn(false);
    }
  };

  const handleWebCheckOut = async () => {
    setCheckingOut(true);
    setStatusMsg(null);
    try {
      const res = await api.checkOut();
      setStatusMsg({ type: 'success', text: `Checked out successfully at ${res.record.checkOutTime} (${res.record.hoursWorked}h worked)` });
      await loadAll();
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || 'Check-out failed' });
    } finally {
      setCheckingOut(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <SkeletonLoader rows={5} />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Welcome back, {employee?.firstName || user?.name}!
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {employee?.designation} · {employee?.departmentName} · Code: <span className="font-mono">{employee?.employeeCode}</span>
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenAi}
            icon={Sparkles}
          >
            Ask AI Assistant
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setTab('leave')}
          >
            Apply for Leave
          </Button>
        </div>
      </div>

      {statusMsg && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center justify-between ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          <span>{statusMsg.text}</span>
          <button onClick={() => setStatusMsg(null)} className="text-xs font-bold px-2">✕</button>
        </div>
      )}

      {/* Main Check-In Widget Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              Today's Attendance Status
            </span>
            <div className="flex items-center gap-3">
              <div className="text-2xl font-bold text-slate-900 font-mono">
                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
              {todayRecord ? (
                <StatusBadge status={todayRecord.status} />
              ) : (
                <span className="text-xs text-slate-500 font-medium">Not checked in yet</span>
              )}
            </div>
            <p className="text-xs text-slate-600">
              Office hours start at <strong className="font-mono">09:00 AM</strong> (15 min grace period until 09:15 AM).
              {todayRecord?.checkInTime && (
                <span className="block mt-1">
                  Checked in at: <strong className="font-mono">{todayRecord.checkInTime}</strong>
                  {todayRecord.checkOutTime && (
                    <> · Checked out at: <strong className="font-mono">{todayRecord.checkOutTime}</strong> ({todayRecord.hoursWorked} hrs)</>
                  )}
                </span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {!todayRecord ? (
              <Button
                variant="primary"
                size="lg"
                onClick={handleWebCheckIn}
                isLoading={checkingIn}
                icon={Clock}
                className="shadow-sm"
              >
                Mark Attendance (Check In)
              </Button>
            ) : !todayRecord.checkOutTime ? (
              <Button
                variant="danger"
                size="lg"
                onClick={handleWebCheckOut}
                isLoading={checkingOut}
                icon={Clock}
                className="shadow-sm"
              >
                Clock Out (Check Out)
              </Button>
            ) : (
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 px-4 py-2.5 rounded-lg border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Attendance Complete for Today</span>
              </div>
            )}

            <Button
              variant="outline"
              size="lg"
              onClick={() => setTab('attendance')}
              icon={Camera}
            >
              Camera & Geofence
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Hours Worked"
          value={`${kpi?.hoursWorkedThisMonth || 0} hrs`}
          subtext="Logged this month"
          icon={Clock}
          color="indigo"
        />
        <StatCard
          title="Late Arrivals"
          value={kpi?.lateCount || 0}
          subtext="Rule: 3 lates = 0.5d deduction"
          icon={AlertCircle}
          color={kpi?.lateCount > 0 ? 'amber' : 'emerald'}
        />
        <StatCard
          title="Sick Leave Available"
          value={`${balances?.sick?.remaining ?? 8} days`}
          subtext={`Used ${balances?.sick?.used ?? 0} of 8 days`}
          icon={Calendar}
          color="emerald"
        />
        <StatCard
          title="Casual Leave Available"
          value={`${balances?.casual?.remaining ?? 10} days`}
          subtext={`Used ${balances?.casual?.used ?? 0} of 10 days`}
          icon={Calendar}
          color="slate"
        />
      </div>

      {/* Two Column Grid: Smart Leave Card & Last Payslip / Announcements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Smart Leave Prompt Box */}
        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-300 uppercase tracking-wider mb-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>Smart Leave in Plain Words</span>
            </div>
            <h3 className="text-lg font-bold text-white">Need time off? Just tell the AI.</h3>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Say e.g. <em className="text-indigo-200">"Need next Monday and Tuesday off for my sister's wedding"</em> or in Roman Urdu <em className="text-indigo-200">"Mujhe kal bukhaar ki wajah se chutti chahiye"</em>. The assistant automatically calculates working dates, checks available quotas, and fills your request!
            </p>
          </div>
          <div className="mt-6">
            <button
              onClick={() => onSmartLeave("I need next Monday and Tuesday off for my sister's wedding")}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 transition-colors text-xs font-medium text-white cursor-pointer"
            >
              <span>Try: "Need next Monday and Tuesday off for wedding"</span>
              <ArrowRight className="w-4 h-4 text-indigo-300" />
            </button>
          </div>
        </div>

        {/* Latest Payslip & Announcements */}
        <div className="space-y-6">
          {/* Last Payslip Card */}
          <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-indigo-600" />
                <span>Last Finalized Payslip</span>
              </h3>
              <button
                onClick={() => setTab('payroll')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
              >
                View All Payslips
              </button>
            </div>

            {kpi?.lastPayslipNet !== null && kpi?.lastPayslipNet !== undefined ? (
              <div className="mt-3 p-4 bg-slate-50 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 block">Period: {kpi.lastPayslipMonth}</span>
                  <span className="text-xl font-bold font-mono text-slate-900">
                    PKR {Number(kpi.lastPayslipNet).toLocaleString()}
                  </span>
                  <span className="text-[11px] text-emerald-600 font-semibold block mt-0.5">Net Pay Finalized</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTab('payroll')}
                >
                  Download PDF
                </Button>
              </div>
            ) : (
              <p className="text-xs text-slate-500 py-4 text-center">
                No finalized payslips available yet. Once monthly payroll is finalized by Admin, it will appear here.
              </p>
            )}
          </div>

          {/* Announcements Feed */}
          <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Bell className="w-4 h-4 text-indigo-600" />
                <span>Company Notices</span>
              </h3>
            </div>
            {announcements.length === 0 ? (
              <p className="text-xs text-slate-500 py-3 text-center">No company announcements.</p>
            ) : (
              <div className="space-y-2.5 divide-y divide-slate-100">
                {announcements.map((a) => (
                  <div key={a.id} className="pt-2 first:pt-0">
                    <span className="font-semibold text-xs text-slate-800">{a.title}</span>
                    <p className="text-xs text-slate-600 line-clamp-1">{a.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
