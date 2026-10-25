import React, { useState, useEffect } from 'react';
import { ShieldCheck, Search, Eye, Filter, Clock, User, FileCode } from 'lucide-react';
import { Button, Input, Modal, SkeletonLoader } from '../../components/common/UIComponents.jsx';
import { api } from '../../lib/api.js';

export function AuditLogView() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    async function loadLogs() {
      try {
        const data = await api.getAuditLogs();
        setLogs(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadLogs();
  }, []);

  const filtered = logs.filter(
    (l) =>
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.actorName.toLowerCase().includes(search.toLowerCase()) ||
      l.details.toLowerCase().includes(search.toLowerCase()) ||
      l.entity.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            System Governance & Immutable Audit Log
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Admin security stream tracking all user authentications, employee modifications, leave decisions, and payroll lock operations.
          </p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search audit trail by actor, action (e.g. FINALIZE_PAYROLL), or entity..."
            className="pl-9 text-xs"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-6">
            <SkeletonLoader rows={6} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            No audit records matching your criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Details</th>
                  <th className="py-3 px-4 text-right">Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-800 font-semibold">
                      {log.actorName}
                      <span className="text-slate-400 font-mono block text-[10px] font-normal uppercase">
                        {log.actorRole}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-indigo-700">
                      {log.action}
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-700">
                      {log.entity}
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-600 max-w-sm truncate" title={log.details}>
                      {log.details}
                    </td>
                    <td className="py-3 px-4 text-right font-sans">
                      {(log.beforeJson || log.afterJson) && (
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                        >
                          <FileCode className="w-3.5 h-3.5" />
                          <span>JSON</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* JSON Inspector Modal */}
      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title={`Audit State Inspector — ${selectedLog?.action}`}
        maxWidth="max-w-3xl"
        footer={
          <Button variant="ghost" size="sm" onClick={() => setSelectedLog(null)}>Close</Button>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg text-slate-700">
            <strong>Action:</strong> {selectedLog?.action} on <strong>{selectedLog?.entity}</strong> at {selectedLog?.timestamp}
            <p className="mt-1 text-slate-500">{selectedLog?.details}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="font-bold text-slate-700 block mb-1">State Before:</span>
              <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg text-[11px] font-mono overflow-x-auto max-h-64">
                {selectedLog?.beforeJson ? JSON.stringify(selectedLog.beforeJson, null, 2) : 'null (Created)'}
              </pre>
            </div>
            <div>
              <span className="font-bold text-slate-700 block mb-1">State After:</span>
              <pre className="p-3 bg-slate-900 text-emerald-300 rounded-lg text-[11px] font-mono overflow-x-auto max-h-64">
                {selectedLog?.afterJson ? JSON.stringify(selectedLog.afterJson, null, 2) : 'null (Deleted)'}
              </pre>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
