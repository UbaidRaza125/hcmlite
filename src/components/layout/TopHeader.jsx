import React, { useState, useEffect } from 'react';
import {
  Bell,
  Sparkles,
  ChevronDown,
  UserCheck,
  Check,
  Building,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../lib/api.js';

export function TopHeader({ currentTab, onOpenAi }) {
  const { user, login, logout, company } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showRoleSwitcher, setShowRoleSwitcher] = useState(false);

  useEffect(() => {
    async function loadNotifications() {
      try {
        const notifs = await api.getNotifications();
        setNotifications(notifs);
      } catch (err) {
        // quiet ignore
      }
    }
    loadNotifications();
    const timer = setInterval(loadNotifications, 15000);
    return () => clearInterval(timer);
  }, []);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markRead = async (id) => {
    try {
      await api.markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (err) {
      console.error(err);
    }
  };

  const titles = {
    dashboard: user?.role === 'admin' ? 'Company Analytics & Headcount' : user?.role === 'hr' ? 'Workforce & Daily Insights' : 'My Workstation & Hours',
    organization: 'Company Setup & Operational Rules',
    employees: user?.role === 'employee' ? 'Company Directory' : 'Employee Directory & Access Provisioning',
    attendance: 'Attendance Board & Web Check-In',
    leave: user?.role === 'hr' ? 'Leave Requests Approval' : 'Leave Quotas & Applications',
    payroll: user?.role === 'admin' ? 'Payroll Finalization & Slabs' : user?.role === 'hr' ? 'Monthly Payroll Draft' : 'My Payslips & Deductions',
    comms: 'Announcements & Notice Board',
    audit: 'System Security & Immutable Audit Trail',
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 z-20">
      {/* Left: Breadcrumb & Title */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-slate-600">HCM Lite</span>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-semibold text-slate-800">{titles[currentTab] || 'Dashboard'}</span>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-3">
        {/* Ask AI Button */}
        <button
          onClick={onOpenAi}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors shadow-2xs cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          <span>Ask Assistant</span>
        </button>

        {/* Notifications Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg relative transition-colors cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500" />
            )}
          </button>

          {showNotifs && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-50">
              <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">Notifications</span>
                <span className="text-[11px] text-slate-600">{unreadCount} unread</span>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <p className="p-4 text-xs text-slate-600 text-center">No notifications yet.</p>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => markRead(n.id)}
                      className={`p-3 text-xs hover:bg-slate-50 transition-colors cursor-pointer ${
                        !n.isRead ? 'bg-indigo-50/40' : ''
                      }`}
                    >
                      <div className="font-semibold text-slate-800 flex items-center justify-between">
                        <span>{n.title}</span>
                        {!n.isRead && <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />}
                      </div>
                      <p className="text-slate-600 mt-1">{n.message}</p>
                      <span className="text-[10px] text-slate-600 mt-1 block">
                        {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Role Pill */}
        <div className="hidden sm:flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
          <span className="capitalize">{user?.role} Mode</span>
        </div>
      </div>
    </header>
  );
}
