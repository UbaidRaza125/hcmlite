import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  FileCheck,
  Lock,
  Download,
  AlertCircle,
  Eye,
  Plus,
  Calendar,
  CheckCircle,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import {
  Button,
  Input,
  FormField,
  Modal,
  StatusBadge,
  SkeletonLoader,
} from '../../components/common/UIComponents.jsx';
import { api } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { jsPDF } from 'jspdf';

export function PayrollView() {
  const { user, company } = useAuth();
  const [runs, setRuns] = useState([]);
  const [myPayslips, setMyPayslips] = useState([]);
  const [selectedRun, setSelectedRun] = useState(null);
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [loading, setLoading] = useState(true);

  // Prepare Draft Modal
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [draftMonth, setDraftMonth] = useState('2026-10');
  const [preparingDraft, setPreparingDraft] = useState(false);

  // Finalize
  const [finalizing, setFinalizing] = useState(false);

  const isAdmin = user?.role === 'admin';
  const isHr = user?.role === 'hr';
  const isStaff = user?.role === 'employee';

  const loadData = async () => {
    setLoading(true);
    try {
      if (isAdmin || isHr) {
        const rList = await api.getPayrollRuns();
        setRuns(rList);
        if (rList.length > 0 && !selectedRun) {
          setSelectedRun(rList[0]);
        }
      } else {
        const slips = await api.getMyPayslips();
        setMyPayslips(slips);
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

  const handlePrepareDraft = async (e) => {
    e.preventDefault();
    setPreparingDraft(true);
    try {
      const res = await api.preparePayrollDraft(draftMonth);
      alert(`Payroll draft for ${draftMonth} generated successfully!`);
      setShowDraftModal(false);
      await loadData();
      setSelectedRun(res.payrollRun);
    } catch (err) {
      alert(`Draft preparation error: ${err.message}`);
    } finally {
      setPreparingDraft(false);
    }
  };

  const handleFinalize = async (runId) => {
    if (!isAdmin) {
      alert('Forbidden: Only Admin has authority to finalize and lock payroll.');
      return;
    }
    const confirmed = window.confirm(
      'Are you sure you want to finalize and lock this payroll run? Once locked, calculations cannot be altered and individual employee payslips will be published.'
    );
    if (!confirmed) return;

    setFinalizing(true);
    try {
      const res = await api.finalizePayroll(runId);
      alert(`Payroll run finalized and locked.`);
      await loadData();
      setSelectedRun(res.payrollRun);
    } catch (err) {
      alert(`Finalization error: ${err.message}`);
    } finally {
      setFinalizing(false);
    }
  };

  // Download PDF payslip
  const generatePdf = (slip) => {
    const doc = new jsPDF();

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(company?.name || 'HCM Lite Organization', 105, 20, { align: 'center' });

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('CONFIDENTIAL EMPLOYEE SALARY PAYSLIP', 105, 28, { align: 'center' });
    doc.text(`Period: ${slip.month}`, 105, 34, { align: 'center' });

    doc.setLineWidth(0.5);
    doc.line(20, 38, 190, 38);

    // Employee Meta
    doc.setFontSize(10);
    doc.text(`Employee: ${slip.employeeName}`, 20, 46);
    doc.text(`Employee Code: ${slip.employeeCode}`, 20, 52);
    doc.text(`Department: ${slip.departmentName}`, 120, 46);
    doc.text(`Designation: ${slip.designation}`, 120, 52);

    doc.line(20, 56, 190, 56);

    // Earnings Header
    doc.setFont('helvetica', 'bold');
    doc.text('EARNINGS & ALLOWANCES', 20, 64);
    doc.text('Amount (PKR)', 90, 64, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.text('Basic Salary (100%):', 20, 72);
    doc.text(Number(slip.basicSalary).toLocaleString(), 90, 72, { align: 'right' });

    doc.text('House Rent Allowance (HRA 40%):', 20, 78);
    doc.text(Number(slip.hra).toLocaleString(), 90, 78, { align: 'right' });

    doc.text('Medical Allowance (10%):', 20, 84);
    doc.text(Number(slip.medicalAllowance).toLocaleString(), 90, 84, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.text('GROSS SALARY (1.5x Basic):', 20, 92);
    doc.text(`PKR ${Number(slip.grossSalary).toLocaleString()}`, 90, 92, { align: 'right' });

    // Deductions Section
    doc.text('STATUTORY & ATTENDANCE DEDUCTIONS', 115, 64);
    doc.text('Amount (PKR)', 190, 64, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.text(`Absent Deductions (${slip.absentDays} days):`, 115, 72);
    doc.text(Number(slip.deductions?.absentDeduction || 0).toLocaleString(), 190, 72, { align: 'right' });

    doc.text(`Unpaid Leave (${slip.unpaidLeaveDays} days):`, 115, 78);
    doc.text(Number(slip.deductions?.unpaidLeaveDeduction || 0).toLocaleString(), 190, 78, { align: 'right' });

    doc.text(`Half Days (${slip.halfDays} occurrences):`, 115, 84);
    doc.text(Number(slip.deductions?.halfDayDeduction || 0).toLocaleString(), 190, 84, { align: 'right' });

    doc.text(`Late Penalty (${slip.lateCount} lates):`, 115, 90);
    doc.text(Number(slip.deductions?.latePenaltyDeduction || 0).toLocaleString(), 190, 90, { align: 'right' });

    doc.text('Income Tax (Annual Slab / 12):', 115, 96);
    doc.text(Number(slip.monthlyTax).toLocaleString(), 190, 96, { align: 'right' });

    doc.line(20, 104, 190, 104);

    // Net Pay Callout
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('NET SALARY PAYABLE:', 20, 114);
    doc.text(`PKR ${Number(slip.netPay).toLocaleString()}`, 190, 114, { align: 'right' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text('This is a computer-generated payslip verified by HCM Lite. No signature required.', 105, 130, { align: 'center' });

    doc.save(`Payslip_${slip.month}_${slip.employeeCode}.pdf`);
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            {isStaff ? 'My Monthly Payslips' : 'Payroll Lite — Salary Runs & Slabs'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Gross = 1.5× Basic (HRA 40%, Medical 10%) · Attendance deductions · Progressive tax slabs · Locked upon Admin finalization.
          </p>
        </div>

        {!isStaff && (
          <div className="flex items-center gap-2.5">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowDraftModal(true)}
              icon={Plus}
            >
              Prepare Payroll Draft
            </Button>
          </div>
        )}
      </div>

      {/* Staff View: My Payslips */}
      {isStaff && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">My Finalized Payslips</h3>
          </div>

          {loading ? (
            <div className="p-6">
              <SkeletonLoader rows={4} />
            </div>
          ) : myPayslips.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No finalized payslips available yet. Payslips appear here once Admin finalizes a monthly payroll run.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Period</th>
                    <th className="py-3 px-4">Basic Salary</th>
                    <th className="py-3 px-4">Gross Salary</th>
                    <th className="py-3 px-4">Deductions</th>
                    <th className="py-3 px-4">Monthly Tax</th>
                    <th className="py-3 px-4">Net Pay</th>
                    <th className="py-3 px-4 text-right">Download</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {myPayslips.map((slip) => (
                    <tr key={slip.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{slip.month}</td>
                      <td className="py-3 px-4 font-mono tabular-nums">PKR {Number(slip.basicSalary).toLocaleString()}</td>
                      <td className="py-3 px-4 font-mono tabular-nums">PKR {Number(slip.grossSalary).toLocaleString()}</td>
                      <td className="py-3 px-4 font-mono tabular-nums text-rose-600">PKR {Number(slip.deductions?.total || 0).toLocaleString()}</td>
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-600">PKR {Number(slip.monthlyTax).toLocaleString()}</td>
                      <td className="py-3 px-4 font-mono tabular-nums font-bold text-emerald-700">
                        PKR {Number(slip.netPay).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => generatePdf(slip)}
                          icon={Download}
                        >
                          PDF
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Admin / HR View: Payroll Runs & Line Items */}
      {!isStaff && (
        <div className="space-y-6">
          {/* Payroll Runs List Header Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {runs.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedRun(r)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
                  selectedRun?.id === r.id
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono">{r.month}</span>
                  <StatusBadge status={r.status} />
                </div>
              </button>
            ))}
          </div>

          {selectedRun ? (
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden space-y-6 p-6">
              {/* Run Summary Bar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 font-mono">
                      Payroll Period: {selectedRun.month}
                    </h3>
                    <StatusBadge status={selectedRun.status} />
                  </div>
                  <p className="text-xs text-slate-500">
                    {selectedRun.employeeCount} active personnel · {selectedRun.workingDaysInMonth} working days in month · Prepared by {selectedRun.preparedBy}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {selectedRun.status === 'draft' ? (
                    isAdmin ? (
                      <Button
                        variant="primary"
                        size="md"
                        isLoading={finalizing}
                        onClick={() => handleFinalize(selectedRun.id)}
                        icon={Lock}
                      >
                        Finalize & Lock Payroll (Admin Only)
                      </Button>
                    ) : (
                      <div className="text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 flex items-center gap-1.5 font-medium">
                        <Lock className="w-3.5 h-3.5 text-amber-600" />
                        <span>Awaiting Admin Finalization</span>
                      </div>
                    )
                  ) : (
                    <div className="text-xs text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 flex items-center gap-1.5 font-semibold">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Locked by {selectedRun.finalizedBy}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Total Summary Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[11px] text-slate-500 font-medium block">Total Gross</span>
                  <span className="text-sm font-bold font-mono text-slate-900">
                    PKR {Number(selectedRun.totalGross).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 font-medium block">Total Deductions</span>
                  <span className="text-sm font-bold font-mono text-rose-600">
                    PKR {Number(selectedRun.totalDeductions).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 font-medium block">Total Tax Slabs</span>
                  <span className="text-sm font-bold font-mono text-slate-700">
                    PKR {Number(selectedRun.totalTax).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 font-medium block">Net Disbursed</span>
                  <span className="text-sm font-bold font-mono text-emerald-700">
                    PKR {Number(selectedRun.totalNet).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                      <th className="py-2.5 px-3">Employee</th>
                      <th className="py-2.5 px-3">Basic</th>
                      <th className="py-2.5 px-3">HRA (40%)</th>
                      <th className="py-2.5 px-3">Med (10%)</th>
                      <th className="py-2.5 px-3">Gross</th>
                      <th className="py-2.5 px-3">Daily Rate</th>
                      <th className="py-2.5 px-3">Deductions</th>
                      <th className="py-2.5 px-3">Monthly Tax</th>
                      <th className="py-2.5 px-3">Net Pay</th>
                      <th className="py-2.5 px-3 text-right">Slip</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedRun.lineItems?.map((item) => (
                      <tr key={item.employeeId} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {item.employeeName}
                          <span className="text-[10px] text-slate-400 font-mono block">
                            {item.employeeCode} · {item.departmentName}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums text-slate-700">
                          {Number(item.basicSalary).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums text-slate-500">
                          {Number(item.hra).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums text-slate-500">
                          {Number(item.medicalAllowance).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums font-semibold text-slate-900">
                          {Number(item.grossSalary).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums text-slate-500">
                          {Number(item.dailyRate).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums text-rose-600">
                          {Number(item.deductions?.total || 0).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums text-slate-600">
                          {Number(item.monthlyTax).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums font-bold text-emerald-700">
                          {Number(item.netPay).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => generatePdf({ ...item, month: selectedRun.month })}
                            title="Download PDF Payslip"
                            className="p-1 text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white p-12 text-center border border-slate-200 rounded-xl text-xs text-slate-500">
              No payroll runs created yet. Click "Prepare Payroll Draft" to generate a monthly payroll calculation.
            </div>
          )}
        </div>
      )}

      {/* Prepare Draft Modal */}
      <Modal
        isOpen={showDraftModal}
        onClose={() => setShowDraftModal(false)}
        title="Prepare Monthly Payroll Draft"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setShowDraftModal(false)}>Cancel</Button>
            <Button variant="primary" size="sm" isLoading={preparingDraft} onClick={handlePrepareDraft}>
              Calculate & Generate Draft
            </Button>
          </>
        }
      >
        <form onSubmit={handlePrepareDraft} className="space-y-4 text-xs">
          <p className="text-slate-600">
            Select the target month. HCM Lite will evaluate attendance, unpaid leaves, and apply tax slabs for all active employees.
          </p>
          <FormField label="Payroll Month (YYYY-MM)" required hint="e.g. 2026-10">
            <Input
              type="month"
              value={draftMonth}
              onChange={(e) => setDraftMonth(e.target.value)}
              required
            />
          </FormField>
          <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-900 leading-relaxed text-[11px]">
            <strong>Official Calculations Applied:</strong>
            <ul className="list-disc list-inside mt-1 space-y-0.5">
              <li>Gross = 1.5 × Basic (HRA 40%, Medical 10%)</li>
              <li>Per day rate = Gross ÷ Working days in month</li>
              <li>Deductions for absent days, unpaid leave, half days & 3-lates rule</li>
              <li>Tax calculated according to official annual gross slabs</li>
            </ul>
          </div>
        </form>
      </Modal>
    </div>
  );
}
