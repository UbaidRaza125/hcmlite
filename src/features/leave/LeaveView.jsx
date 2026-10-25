import React, { useState, useEffect } from 'react';
import {
  CalendarDays,
  Plus,
  Sparkles,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Calendar,
} from 'lucide-react';
import {
  Button,
  Input,
  Select,
  FormField,
  Modal,
  StatusBadge,
  SkeletonLoader,
} from '../../components/common/UIComponents.jsx';
import { api } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { getWorkingDaysCount } from '../../lib/businessRules.js';

const DEFAULT_LEAVE_TYPES = [
  { id: 'lt_annual', name: 'Annual Leave', quota: 14, quotaDays: 14 },
  { id: 'lt_casual', name: 'Casual Leave', quota: 10, quotaDays: 10 },
  { id: 'lt_sick', name: 'Sick Leave', quota: 8, quotaDays: 8 },
  { id: 'lt_unpaid', name: 'Unpaid Leave', quota: 30, quotaDays: 30 },
];

export function LeaveView({ onOpenAiWithPrompt }) {
  const { user } = useAuth();
  const [balances, setBalances] = useState(null);
  const [requests, setRequests] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState(DEFAULT_LEAVE_TYPES);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);

  // Apply Modal
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyForm, setApplyForm] = useState({
    leaveTypeId: 'lt_annual',
    startDate: '',
    endDate: '',
    reason: '',
  });
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState(null);

  // HR Decision Modal
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [decisionComment, setDecisionComment] = useState('');
  const [deciding, setDeciding] = useState(false);

  const isStaff = user?.role === 'employee';
  const isAdminOrHr = user?.role === 'admin' || user?.role === 'hr';

  const loadData = async () => {
    setLoading(true);
    try {
      const [balRes, reqRes, typesRes, holsRes] = await Promise.all([
        api.getLeaveBalances(),
        api.getLeaveRequests(),
        api.getLeaveTypes(),
        api.getHolidays(),
      ]);
      setBalances(balRes);
      setRequests(reqRes);
      const effectiveTypes = (Array.isArray(typesRes) && typesRes.length > 0) ? typesRes : DEFAULT_LEAVE_TYPES;
      setLeaveTypes(effectiveTypes);
      setHolidays(Array.isArray(holsRes) ? holsRes : []);
      if (!applyForm.leaveTypeId || !effectiveTypes.some(t => t.id === applyForm.leaveTypeId)) {
        setApplyForm((prev) => ({ ...prev, leaveTypeId: effectiveTypes[0]?.id || 'lt_annual' }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Compute preview working days for date selection
  const previewDays =
    applyForm.startDate && applyForm.endDate
      ? getWorkingDaysCount(
          applyForm.startDate,
          applyForm.endDate,
          holidays.map((h) => h.date)
        )
      : 0;

  const handleApply = async (e) => {
    e.preventDefault();
    setApplyError(null);
    setApplying(true);
    try {
      await api.applyLeave(applyForm);
      setShowApplyModal(false);
      setApplyForm({
        leaveTypeId: leaveTypes[0]?.id || '',
        startDate: '',
        endDate: '',
        reason: '',
      });
      await loadData();
    } catch (err) {
      setApplyError(err.message || 'Leave application failed.');
    } finally {
      setApplying(false);
    }
  };

  const handleDecision = async (decision) => {
    if (!selectedRequest) return;
    setDeciding(true);
    try {
      await api.reviewLeave(selectedRequest.id, {
        decision,
        comment: decisionComment,
      });
      setSelectedRequest(null);
      setDecisionComment('');
      await loadData();
    } catch (err) {
      alert(`Decision error: ${err.message}`);
    } finally {
      setDeciding(false);
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            {isStaff ? 'My Leave Applications & Balances' : 'Leave Requests & Approvals Inbox'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Quotas: Annual 14d · Sick 8d · Casual 10d · Unpaid unlimited. Excludes weekends & public holidays.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {isStaff && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onOpenAiWithPrompt
                  ? onOpenAiWithPrompt("Need next Monday and Tuesday off for my sister's wedding")
                  : null
              }
              icon={Sparkles}
            >
              Smart Leave in Plain Words
            </Button>
          )}

          {isStaff && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setApplyError(null);
                setShowApplyModal(true);
              }}
              icon={Plus}
            >
              Apply for Leave
            </Button>
          )}
        </div>
      </div>

      {/* Quota Meters Grid (Employee View) */}
      {balances && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex justify-between items-center text-xs text-slate-500 font-medium">
              <span>Annual Leave</span>
              <span className="font-mono text-indigo-600 font-bold">14 Quota</span>
            </div>
            <div className="mt-2 text-2xl font-bold font-mono text-slate-900">
              {balances.annual.remaining} <span className="text-xs font-normal text-slate-400">days left</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500 font-mono">Used: {balances.annual.used} days</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex justify-between items-center text-xs text-slate-500 font-medium">
              <span>Sick Leave</span>
              <span className="font-mono text-emerald-600 font-bold">8 Quota</span>
            </div>
            <div className="mt-2 text-2xl font-bold font-mono text-slate-900">
              {balances.sick.remaining} <span className="text-xs font-normal text-slate-400">days left</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500 font-mono">Used: {balances.sick.used} days</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex justify-between items-center text-xs text-slate-500 font-medium">
              <span>Casual Leave</span>
              <span className="font-mono text-amber-600 font-bold">10 Quota</span>
            </div>
            <div className="mt-2 text-2xl font-bold font-mono text-slate-900">
              {balances.casual.remaining} <span className="text-xs font-normal text-slate-400">days left</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500 font-mono">Used: {balances.casual.used} days</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex justify-between items-center text-xs text-slate-500 font-medium">
              <span>Unpaid Leave</span>
              <span className="font-mono text-slate-600 font-bold">Unlimited</span>
            </div>
            <div className="mt-2 text-2xl font-bold font-mono text-slate-900">
              {balances.unpaid.used} <span className="text-xs font-normal text-slate-400">days taken</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500">Deducted from payroll</div>
          </div>
        </div>
      )}

      {/* Leave Requests Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-indigo-600" />
            <span>Leave Requests History ({requests.length})</span>
          </h3>
        </div>

        {loading ? (
          <div className="p-6">
            <SkeletonLoader rows={5} />
          </div>
        ) : requests.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No leave requests logged yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Leave Type</th>
                  <th className="py-3 px-4">Period</th>
                  <th className="py-3 px-4">Working Days</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4">Status</th>
                  {isAdminOrHr && <th className="py-3 px-4 text-right">Review</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {req.employeeName}
                      <span className="text-slate-400 block text-[11px] font-mono">
                        {req.employeeCode}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">{req.leaveTypeName}</td>
                    <td className="py-3 px-4 font-mono text-slate-700">
                      {req.startDate} → {req.endDate}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-indigo-700 tabular-nums">
                      {req.workingDays} Day{req.workingDays !== 1 ? 's' : ''}
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={req.reason}>
                      {req.reason}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={req.status} />
                      {req.comment && (
                        <span className="block text-[10px] text-slate-500 mt-0.5 truncate max-w-[150px]">
                          Note: "{req.comment}"
                        </span>
                      )}
                    </td>
                    {isAdminOrHr && (
                      <td className="py-3 px-4 text-right">
                        {req.status === 'pending' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedRequest(req);
                              setDecisionComment('Approved as requested.');
                            }}
                          >
                            Review
                          </Button>
                        ) : (
                          <span className="text-[11px] text-slate-400">
                            by {req.reviewedBy || 'HR'}
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Apply Leave Modal */}
      <Modal
        isOpen={showApplyModal}
        onClose={() => setShowApplyModal(false)}
        title="Apply for Official Leave"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setShowApplyModal(false)}>Cancel</Button>
            <Button variant="primary" size="sm" isLoading={applying} onClick={handleApply}>
              Submit Application
            </Button>
          </>
        }
      >
        <form onSubmit={handleApply} className="space-y-4 text-xs">
          {applyError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{applyError}</span>
            </div>
          )}

          <FormField label="Leave Category" required>
            <Select
              value={applyForm.leaveTypeId || (leaveTypes[0]?.id || 'lt_annual')}
              onChange={(e) => setApplyForm({ ...applyForm, leaveTypeId: e.target.value })}
              options={(leaveTypes.length > 0 ? leaveTypes : DEFAULT_LEAVE_TYPES).map((l) => ({
                value: l.id,
                label: `${l.name} (${(l.quotaDays || l.quota) >= 100 ? 'Unlimited' : `${l.quotaDays || l.quota}d`})`
              }))}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Start Date" required>
              <Input
                type="date"
                value={applyForm.startDate}
                onChange={(e) => setApplyForm({ ...applyForm, startDate: e.target.value })}
                required
              />
            </FormField>
            <FormField label="End Date" required>
              <Input
                type="date"
                value={applyForm.endDate}
                onChange={(e) => setApplyForm({ ...applyForm, endDate: e.target.value })}
                required
              />
            </FormField>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between font-medium">
            <span className="text-slate-600">Calculated Working Days:</span>
            <span className="text-sm font-bold font-mono text-indigo-700">
              {previewDays} Working Day{previewDays !== 1 ? 's' : ''}
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            Saturdays, Sundays, and official company holidays are automatically skipped.
          </p>

          <FormField label="Reason for Absence" required hint="Provide clear justification for review">
            <Input
              value={applyForm.reason}
              onChange={(e) => setApplyForm({ ...applyForm, reason: e.target.value })}
              placeholder="e.g. Sister's wedding in Lahore"
              required
            />
          </FormField>
        </form>
      </Modal>

      {/* HR Review Decision Modal */}
      <Modal
        isOpen={!!selectedRequest}
        onClose={() => setSelectedRequest(null)}
        title="Review Leave Application"
        footer={
          <>
            <Button
              variant="danger"
              size="sm"
              isLoading={deciding}
              onClick={() => handleDecision('rejected')}
              icon={XCircle}
            >
              Reject Request
            </Button>
            <Button
              variant="success"
              size="sm"
              isLoading={deciding}
              onClick={() => handleDecision('approved')}
              icon={CheckCircle}
            >
              Approve Leave
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-xs text-slate-700">
          <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 border border-slate-200">
            <div className="font-bold text-slate-900 text-sm">
              {selectedRequest?.employeeName} ({selectedRequest?.employeeCode})
            </div>
            <p>
              Leave Category: <strong className="text-indigo-900">{selectedRequest?.leaveTypeName}</strong>
            </p>
            <p>
              Dates: <strong className="font-mono">{selectedRequest?.startDate} → {selectedRequest?.endDate}</strong> ({selectedRequest?.workingDays} working days)
            </p>
            <p className="italic text-slate-600">Reason: "{selectedRequest?.reason}"</p>
          </div>

          <FormField label="Reviewer Comment (Visible to Employee)">
            <Input
              value={decisionComment}
              onChange={(e) => setDecisionComment(e.target.value)}
              placeholder="e.g. Approved. Have a great time!"
            />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
