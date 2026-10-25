import React, { useState, useEffect } from 'react';
import { Bell, Plus, Megaphone, Send, Clock, User } from 'lucide-react';
import { Button, Input, FormField, Modal, Select } from '../../components/common/UIComponents.jsx';
import { api } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';

export function CommsView() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', targetRole: 'all' });
  const [submitting, setSubmitting] = useState(false);

  const canPost = user?.role === 'admin' || user?.role === 'hr';

  const loadAnnouncements = async () => {
    setLoading(true);
    try {
      const data = await api.getAnnouncements();
      setAnnouncements(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const handlePost = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.createAnnouncement(form);
      setShowModal(false);
      setForm({ title: '', content: '', targetRole: 'all' });
      await loadAnnouncements();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Company Communications & Announcements
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Broadcast official notices, holidays, and policy updates to your organization.
          </p>
        </div>

        {canPost && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowModal(true)}
            icon={Plus}
          >
            Post Announcement
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading notices...</div>
        ) : announcements.length === 0 ? (
          <div className="bg-white p-12 text-center border border-slate-200 rounded-xl text-xs text-slate-500">
            No announcements published yet.
          </div>
        ) : (
          announcements.map((ann) => (
            <div key={ann.id} className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-sm font-bold text-slate-900">{ann.title}</h3>
                </div>
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{new Date(ann.createdAt).toLocaleDateString()}</span>
                </span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{ann.content}</p>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  <span>Posted by {ann.authorName} ({ann.authorRole?.toUpperCase()})</span>
                </span>
                <span className="capitalize px-2 py-0.5 bg-slate-100 rounded text-[10px] text-slate-600">
                  Target: {ann.targetRole}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Post Organization Announcement"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button variant="primary" size="sm" isLoading={submitting} onClick={handlePost}>
              Broadcast Notice
            </Button>
          </>
        }
      >
        <form onSubmit={handlePost} className="space-y-4 text-xs">
          <FormField label="Headline Title" required>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Annual Retreat & Office Timings"
              required
            />
          </FormField>
          <FormField label="Target Audience" required>
            <Select
              value={form.targetRole}
              onChange={(e) => setForm({ ...form, targetRole: e.target.value })}
              options={[
                { value: 'all', label: 'All Personnel (Company-wide)' },
                { value: 'employee', label: 'Employees Only' },
                { value: 'hr', label: 'HR Team Only' },
              ]}
            />
          </FormField>
          <FormField label="Announcement Message" required>
            <textarea
              rows={4}
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="Enter announcement details..."
              className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </FormField>
        </form>
      </Modal>
    </div>
  );
}
