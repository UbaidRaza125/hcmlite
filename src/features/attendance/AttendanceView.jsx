import React, { useState, useEffect } from 'react';
import {
  Camera,
  AlertCircle,
  Calendar,
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

export function AttendanceView() {
  const { user } = useAuth();
  const [board, setBoard] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('board'); // 'board', 'camera', 'corrections'


  // Correction Request Modal
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [selectedRecordForCorr, setSelectedRecordForCorr] = useState(null);
  const [corrForm, setCorrForm] = useState({ requestedCheckIn: '09:00', requestedCheckOut: '17:30', reason: '' });

  // HR Review Correction Modal
  const [reviewingCorr, setReviewingCorr] = useState(null);
  const [reviewComment, setReviewComment] = useState('');

  const isStaff = user?.role === 'employee';
  const isAdminOrHr = user?.role === 'admin' || user?.role === 'hr';

  const loadAttendance = async () => {
    setLoading(true);
    try {
      const [boardRes, myRes] = await Promise.all([
        api.getTodayAttendance(),
        isStaff ? api.getMyAttendance() : Promise.resolve([]),
      ]);
      setBoard(boardRes.records || []);
      setHistory(myRes || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttendance();
  }, [user]);

  const handleApplyCorrection = async (e) => {
    e.preventDefault();
    if (!selectedRecordForCorr || !corrForm.reason) return;
    try {
      await api.requestCorrection({
        attendanceId: selectedRecordForCorr.id,
        requestedCheckIn: corrForm.requestedCheckIn,
        requestedCheckOut: corrForm.requestedCheckOut,
        reason: corrForm.reason,
      });
      alert('Correction request submitted to HR.');
      setShowCorrectionModal(false);
      setCorrForm({ requestedCheckIn: '09:00', requestedCheckOut: '17:30', reason: '' });
      await loadAttendance();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleReviewCorrection = async (decision) => {
    if (!reviewingCorr) return;
    try {
      await api.reviewCorrection(reviewingCorr.id, {
        decision,
        comment: reviewComment,
      });
      alert(`Attendance correction ${decision}.`);
      setReviewingCorr(null);
      setReviewComment('');
      await loadAttendance();
    } catch (err) {
      alert(err.message);
    }
  };

  // Filter records needing HR review
  const pendingCorrections = board.filter((r) => r.correction?.status === 'pending');

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Attendance Center & Punctuality Board
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Office hours: 09:00 AM · 15 min grace period · Half day under 5 hours · Server-verified timestamps.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg text-xs font-semibold">
          <button
            onClick={() => {
              setActiveTab('board');
            }}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              activeTab === 'board' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Today's Board
          </button>
          <button
            onClick={() => {
              setActiveTab('camera');
            }}
            className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'camera' ? 'bg-white text-indigo-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Camera Attendance (Bonus)</span>
          </button>
          {isAdminOrHr && (
            <button
              onClick={() => {
                setActiveTab('corrections');
              }}
              className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'corrections' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Corrections</span>
              {pendingCorrections.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-bold">
                  {pendingCorrections.length}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Tab 1: Today's Board */}
      {activeTab === 'board' && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <span>Daily Attendance Status ({new Date().toISOString().split('T')[0]})</span>
            </h3>
            <span className="text-xs text-slate-500 font-mono font-medium">
              {board.length} Record{board.length !== 1 ? 's' : ''}
            </span>
          </div>

          {loading ? (
            <div className="p-6">
              <SkeletonLoader rows={6} />
            </div>
          ) : board.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No attendance records logged yet today.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Check In</th>
                    <th className="py-3 px-4">Check Out</th>
                    <th className="py-3 px-4">Hours</th>
                    <th className="py-3 px-4">Source</th>
                    <th className="py-3 px-4">Status</th>
                    {isStaff && <th className="py-3 px-4 text-right">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {board.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                        {item.employeeCode}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {item.employeeName}
                        <span className="text-slate-400 block text-[11px] font-normal">
                          {item.departmentName}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-800">
                        {item.checkInTime || '—'}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {item.checkOutTime || '—'}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums">
                        {item.hoursWorked > 0 ? `${item.hoursWorked} hrs` : '—'}
                      </td>
                      <td className="py-3 px-4">
                        {item.isCameraCheckIn ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                            <Camera className="w-3 h-3" /> Camera
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Web portal</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={item.status} />
                      </td>
                      {isStaff && (
                        <td className="py-3 px-4 text-right">
                          {item.status !== 'on_leave' && !item.correction && (
                            <button
                              onClick={() => {
                                setSelectedRecordForCorr(item);
                                setShowCorrectionModal(true);
                              }}
                              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                            >
                              Request Correction
                            </button>
                          )}
                          {item.correction && (
                            <span className="text-[11px] text-amber-600 font-medium">
                              Correction: {item.correction.status}
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
      )}

      {/* Tab 2: Camera & Geofence Bonus Feature */}
      {activeTab === 'camera' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs max-w-xl mx-auto space-y-6">
          <div className="text-center space-y-1">
            <h3 className="text-base font-bold text-slate-900 flex items-center justify-center gap-2">
              <Camera className="w-5 h-5 text-indigo-600" />
              <span>Camera Attendance & Geofence Verification</span>
            </h3>
            <p className="text-xs text-slate-500">
              Camera check-in is unavailable until real face detection is integrated. GPS alone is not accepted as proof of face verification.
            </p>
          </div>

          <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Face detection is not installed. This bonus feature is disabled so attendance cannot be falsely marked as face-verified. Standard web check-in remains available.
          </div>

          <div className="pt-2 flex justify-center gap-3">
            <Button
              variant="primary"
              size="lg"
              disabled={true}
              icon={Camera}
              className="w-full font-bold shadow-md"
            >
              Face Verification Unavailable
            </Button>
          </div>
        </div>
      )}

      {/* Tab 3: HR Attendance Corrections Inbox */}
      {activeTab === 'corrections' && isAdminOrHr && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              Pending Attendance Corrections ({pendingCorrections.length})
            </h3>
          </div>

          {pendingCorrections.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No pending attendance correction requests.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {pendingCorrections.map((rec) => (
                <div key={rec.id} className="p-4 flex items-center justify-between text-xs">
                  <div className="space-y-1">
                    <div className="font-bold text-slate-900">
                      {rec.employeeName} ({rec.employeeCode}) — {rec.date}
                    </div>
                    <p className="text-slate-600">
                      Original: <span className="font-mono">{rec.checkInTime || 'None'} - {rec.checkOutTime || 'None'}</span> →
                      Requested: <span className="font-mono font-bold text-indigo-700">{rec.correction?.requestedCheckIn} - {rec.correction?.requestedCheckOut}</span>
                    </p>
                    <p className="text-slate-500 italic">Reason: "{rec.correction?.reason}"</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setReviewingCorr(rec);
                        setReviewComment('Times verified with team lead.');
                      }}
                    >
                      Review
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Employee Correction Request Modal */}
      <Modal
        isOpen={showCorrectionModal}
        onClose={() => setShowCorrectionModal(false)}
        title="Request Attendance Correction"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setShowCorrectionModal(false)}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={handleApplyCorrection}>Submit Request</Button>
          </>
        }
      >
        <form onSubmit={handleApplyCorrection} className="space-y-4 text-xs">
          <p className="text-slate-600">
            Submit a correction request for <strong>{selectedRecordForCorr?.date}</strong>. Your supervisor will review the reason.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Correct Check In" required>
              <Input
                type="time"
                value={corrForm.requestedCheckIn}
                onChange={(e) => setCorrForm({ ...corrForm, requestedCheckIn: e.target.value })}
                required
              />
            </FormField>
            <FormField label="Correct Check Out" required>
              <Input
                type="time"
                value={corrForm.requestedCheckOut}
                onChange={(e) => setCorrForm({ ...corrForm, requestedCheckOut: e.target.value })}
                required
              />
            </FormField>
          </div>
          <FormField label="Reason for Correction" required hint="e.g. Card scanner network error">
            <Input
              value={corrForm.reason}
              onChange={(e) => setCorrForm({ ...corrForm, reason: e.target.value })}
              placeholder="Explain why correction is required..."
              required
            />
          </FormField>
        </form>
      </Modal>

      {/* HR Review Correction Modal */}
      <Modal
        isOpen={!!reviewingCorr}
        onClose={() => setReviewingCorr(null)}
        title="Approve / Reject Attendance Correction"
        footer={
          <>
            <Button variant="danger" size="sm" onClick={() => handleReviewCorrection('rejected')}>
              Reject Correction
            </Button>
            <Button variant="success" size="sm" onClick={() => handleReviewCorrection('approved')}>
              Approve Correction
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-xs text-slate-700">
          <p>
            Employee: <strong>{reviewingCorr?.employeeName}</strong> for <strong>{reviewingCorr?.date}</strong>
          </p>
          <p>
            Requested change to: <strong className="font-mono">{reviewingCorr?.correction?.requestedCheckIn} → {reviewingCorr?.correction?.requestedCheckOut}</strong>
          </p>
          <p className="italic text-slate-600">Employee Note: "{reviewingCorr?.correction?.reason}"</p>
          <FormField label="Supervisor / HR Comment">
            <Input
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              placeholder="Optional comment..."
            />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
