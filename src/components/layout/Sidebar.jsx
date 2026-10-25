import React from 'react';
import {
  LayoutDashboard,
  Building2,
  Users,
  Clock,
  CalendarDays,
  CreditCard,
  Bell,
  ShieldCheck,
  LogOut,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

export function Sidebar({ currentTab, setTab, onOpenAi }) {
  const { user, logout, company } = useAuth();

  // Role-specific navigation groups
  const navItems = [];

  if (user?.role === 'admin') {
    navItems.push(
      { id: 'dashboard', label: 'Company Overview', icon: LayoutDashboard },
      { id: 'organization', label: 'Organization & Rules', icon: Building2 },
      { id: 'employees', label: 'Employees & HR Logins', icon: Users },
      { id: 'attendance', label: 'Attendance Board', icon: Clock },
      { id: 'leave', label: 'Leave Requests', icon: CalendarDays },
      { id: 'payroll', label: 'Payroll & Finalize', icon: CreditCard },
      { id: 'comms', label: 'Announcements', icon: Bell },
      { id: 'audit', label: 'Security & Audit Log', icon: ShieldCheck }
    );
  } else if (user?.role === 'hr') {
    navItems.push(
      { id: 'dashboard', label: 'People Ops Dashboard', icon: LayoutDashboard },
      { id: 'employees', label: 'Employee Management', icon: Users },
      { id: 'attendance', label: 'Daily Attendance Board', icon: Clock },
      { id: 'leave', label: 'Leave Approvals', icon: CalendarDays },
      { id: 'payroll', label: 'Monthly Payroll Draft', icon: CreditCard },
      { id: 'comms', label: 'Announcements', icon: Bell }
    );
  } else {
    // Employee
    navItems.push(
      { id: 'dashboard', label: 'My Dashboard', icon: LayoutDashboard },
      { id: 'attendance', label: 'Check-In & History', icon: Clock },
      { id: 'leave', label: 'Leave & Balances', icon: CalendarDays },
      { id: 'payroll', label: 'My Payslips', icon: CreditCard },
      { id: 'employees', label: 'Company Directory', icon: Users },
      { id: 'comms', label: 'Announcements', icon: Bell }
    );
  }

  // Choose avatar based on role
  let avatarSrc = '/src/assets/images/admin_avatar_1792867159342.jpg';
  if (user?.role === 'hr') {
    avatarSrc = '/src/assets/images/hr_avatar_1792867160029.jpg';
  } else if (user?.role === 'employee') {
    avatarSrc = '/src/assets/images/employee_avatar_1792867159723.jpg';
  }

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0 border-r border-slate-800 select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800 justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center font-bold text-white shadow-xs">
            H
          </div>
          <div>
            <h1 className="font-semibold text-sm tracking-tight text-white flex items-center gap-1.5">
              HCM Lite
            </h1>
            <p className="text-[11px] text-slate-400 truncate max-w-[130px]">
              {company?.name || 'Enterprise'}
            </p>
          </div>
        </div>
      </div>

      {/* Role Pill Banner */}
      <div className="px-5 py-2.5 bg-slate-800/60 border-b border-slate-800 flex items-center justify-between">
        <span className="text-[11px] font-medium text-slate-400">Current Role</span>
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
          {user?.role}
        </span>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
          Navigation
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}

        {/* AI Assistant Quick Nav */}
        <div className="pt-4 px-3 pb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
          Intelligence
        </div>
        <button
          onClick={onOpenAi}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium text-indigo-200 bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-700/40 transition-colors cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
          <span className="truncate">Ask AI Assistant</span>
        </button>
      </nav>

      {/* User Card & Logout */}
      <div className="p-3 border-t border-slate-800 bg-slate-900/90">
        <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-800/60">
          <img
            src={avatarSrc}
            alt={user?.name || 'User'}
            className="w-9 h-9 rounded-full object-cover ring-1 ring-slate-700"
            referrerPolicy="no-referrer"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">{user?.name || 'User'}</p>
            <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-700/60 rounded-md transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
