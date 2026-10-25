import React, { useState, useEffect } from 'react';
import {
  Users,
  TrendingDown,
  CreditCard,
  DollarSign,
  Sparkles,
  ShieldCheck,
  Building,
  Calendar,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { StatCard, Button, SkeletonLoader, StatusBadge } from '../../components/common/UIComponents.jsx';
import { api } from '../../lib/api.js';

export function AdminDashboard({ onOpenAi, setTab }) {
  const [data, setData] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aiSummary, setAiSummary] = useState(null);
  const [summarizing, setSummarizing] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [analyticsRes, auditRes, annRes] = await Promise.all([
          api.getAnalytics(),
          api.getAuditLogs(),
          api.getAnnouncements(),
        ]);
        setData(analyticsRes);
        setAuditLogs(auditRes.slice(0, 8));
        setAnnouncements(annRes.slice(0, 4));
      } catch (err) {
        console.error('Failed to load admin dashboard:', err);
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
      alert(`AI summary failed: ${err.message}`);
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
      {/* Top Banner with AI Summarize Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Executive Company Overview
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time organizational headcount, attendance trends, payroll commitments, and governance logs.
          </p>
        </div>
        <div className="flex items-center gap-3">
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
            onClick={() => setTab('payroll')}
          >
            Review Payroll
          </Button>
        </div>
      </div>

      {/* AI Summary Callout */}
      {aiSummary && (
        <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl relative">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-900">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>AI Executive Summary</span>
            </div>
            <span className="text-[10px] text-indigo-600 font-medium">AI-generated</span>
          </div>
          <div className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">
            {aiSummary}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Headcount"
          value={data?.headcount || 0}
          subtext="Active & probation personnel"
          icon={Users}
          color="indigo"
        />
        <StatCard
          title="Attendance Today"
          value={`${data?.attendanceRate || 0}%`}
          subtext={`${data?.presentToday || 0} present · ${data?.lateToday || 0} late`}
          icon={Calendar}
          color="emerald"
        />
        <StatCard
          title="Monthly Payroll Cost"
          value={`PKR ${Number(data?.payrollCost || 0).toLocaleString()}`}
          subtext="Latest gross commitment"
          icon={CreditCard}
          color="amber"
        />
        <StatCard
          title="Average Salary"
          value={`PKR ${Number(data?.avgSalary || 0).toLocaleString()}`}
          subtext="Gross mean across workforce"
          icon={DollarSign}
          color="slate"
        />
      </div>

      {/* Two-Column Layout: Department Distribution & Audit Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left 2 Cols: Department Breakdown & Announcements */}
        <div className="lg:col-span-2 space-y-6">
          {/* Department Breakdown */}
          <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Building className="w-4 h-4 text-indigo-600" />
                <span>Headcount by Department</span>
              </h3>
              <span className="text-xs text-slate-500">
                {Object.keys(data?.headcountByDept || {}).length} Departments
              </span>
            </div>

            {Object.keys(data?.headcountByDept || {}).length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                No employees registered yet. Go to Employees tab to onboard personnel.
              </p>
            ) : (
              <div className="space-y-3">
                {Object.entries(data?.headcountByDept || {}).map(([dept, count]) => {
                  const pct = data?.headcount > 0 ? Math.round((count / data.headcount) * 100) : 0;
                  return (
                    <div key={dept} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium text-slate-700">
                        <span>{dept}</span>
                        <span className="font-mono tabular-nums">{count} ({pct}%)</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Announcements Feed */}
          <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900">Company Announcements</h3>
              <button
                onClick={() => setTab('comms')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
              >
                Manage & Post
              </button>
            </div>
            {announcements.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No company announcements posted.</p>
            ) : (
              <div className="space-y-3 divide-y divide-slate-100">
                {announcements.map((ann) => (
                  <div key={ann.id} className="pt-3 first:pt-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">{ann.title}</span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(ann.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2">{ann.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Audit Feed */}
        <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Security Audit Feed</span>
            </h3>
            <button
              onClick={() => setTab('audit')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
            >
              Full Log
            </button>
          </div>

          {auditLogs.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">No audit records yet.</p>
          ) : (
            <div className="space-y-3">
              {auditLogs.map((log) => (
                <div key={log.id} className="p-3 bg-slate-50 rounded-lg text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">{log.action}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 truncate">{log.details}</p>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    <span>By: {log.actorName}</span>
                    <span>·</span>
                    <span className="capitalize">{log.actorRole}</span>
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
