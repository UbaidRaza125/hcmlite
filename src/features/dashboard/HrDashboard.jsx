import React, { useState, useEffect } from 'react';
import {
  Users,
  Clock,
  CalendarCheck,
  CalendarX,
  AlertTriangle,
  Sparkles,
  UserPlus,
  FileCheck,
  CreditCard,
  ChevronRight,
} from 'lucide-react';
import { StatCard, Button, SkeletonLoader, StatusBadge } from '../../components/common/UIComponents.jsx';
import { api } from '../../lib/api.js';

export function HrDashboard({ onOpenAi, setTab }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiSummary, setAiSummary] = useState(null);
  const [summarizing, setSummarizing] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const analytics = await api.getAnalytics();
        setData(analytics);
      } catch (err) {
        console.error('Failed to load HR dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleAiSummarize = async () => {
    if (!data) return;
    setSummarizing(true);
    try {
      const res = await api.summarizeDashboard(data);
      setAiSummary(res.summary);
    } catch (err) {
      alert(`AI summary error: ${err.message}`);
    } finally {
      setSummarizing(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <SkeletonLoader rows={6} />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header with Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Workforce & People Operations
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Daily attendance check-ins, punctuality metrics, leave approvals, and employee records.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleAiSummarize}
            isLoading={summarizing}
            icon={Sparkles}
          >
            Summarize with AI
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setTab('employees')}
            icon={UserPlus}
          >
            Register Employee
          </Button>
        </div>
      </div>

      {/* AI Summary Banner */}
      {aiSummary && (
        <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl relative">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-900">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>AI People Ops Insights</span>
            </div>
            <span className="text-[10px] text-indigo-600 font-medium">AI-generated</span>
          </div>
          <div className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">
            {aiSummary}
          </div>
        </div>
      )}

      {/* Primary KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <StatCard
          title="Active Headcount"
          value={data?.headcount || 0}
          subtext="Total workforce"
          icon={Users}
          color="indigo"
        />
        <StatCard
          title="Present Today"
          value={data?.presentToday || 0}
          subtext="Checked in"
          icon={CalendarCheck}
          color="emerald"
        />
        <StatCard
          title="Late Today"
          value={data?.lateToday || 0}
          subtext="Arrived after 09:15"
          icon={Clock}
          color="amber"
        />
        <StatCard
          title="On Leave Today"
          value={data?.onLeaveToday || 0}
          subtext="Approved time-off"
          icon={CalendarX}
          color="slate"
        />
        <StatCard
          title="Pending Approvals"
          value={data?.pendingApprovals || 0}
          subtext="Requires HR decision"
          icon={AlertTriangle}
          color={data?.pendingApprovals > 0 ? 'rose' : 'slate'}
        />
      </div>

      {/* Two Column Grid: Top Late Comers & Leave Utilization */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 Late Comers */}
        <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>Punctuality Monitoring (Top Late Comers)</span>
              </h3>
              <button
                onClick={() => setTab('attendance')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
              >
                Attendance Board
              </button>
            </div>

            {(!data?.topLateComers || data.topLateComers.length === 0) ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                No late arrivals recorded this month. Excellent punctuality!
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {data.topLateComers.map((item, idx) => (
                  <div key={item.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-slate-400 font-semibold w-4">{idx + 1}.</span>
                      <div>
                        <span className="font-semibold text-slate-800">{item.name}</span>
                        <span className="text-slate-400 block text-[11px]">{item.department}</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 bg-amber-50 text-amber-700 font-mono font-bold rounded border border-amber-200">
                      {item.count} Late{item.count > 1 ? 's' : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Rule: 3 lates in a month = 0.5 day deduction</span>
            <span className="font-semibold text-indigo-600">Enforced in payroll</span>
          </div>
        </div>

        {/* Leave Utilization by Type */}
        <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-indigo-600" />
              <span>Leave Utilization by Type</span>
            </h3>
            <button
              onClick={() => setTab('leave')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
            >
              Approval Inbox
            </button>
          </div>

          {(!data?.leaveByType || Object.keys(data.leaveByType).length === 0) ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              No approved leaves utilized yet.
            </p>
          ) : (
            <div className="space-y-4">
              {Object.entries(data.leaveByType).map(([type, days]) => (
                <div key={type} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium text-slate-700">
                    <span>{type}</span>
                    <span className="font-mono tabular-nums font-bold">{days} day(s) taken</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (days / 20) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
