import React from 'react';
import { Loader2, X, AlertCircle, CheckCircle, Info } from 'lucide-react';

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  className = '',
  onClick,
  type = 'button',
  icon: Icon = null,
  ...props
}) {
  const base = 'inline-flex items-center justify-center font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer';

  const sizes = {
    sm: 'text-xs px-2.5 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2 gap-2',
    lg: 'text-base px-5 py-2.5 gap-2.5',
  };

  const variants = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500 shadow-sm',
    secondary: 'bg-slate-100 text-slate-800 hover:bg-slate-200 focus:ring-slate-400',
    outline: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus:ring-indigo-500 shadow-xs',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-500 shadow-sm',
    ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500 shadow-sm',
  };

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      onClick={onClick}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      ) : Icon ? (
        <Icon className="w-4 h-4 shrink-0" />
      ) : null}
      <span>{children}</span>
    </button>
  );
}

export function StatCard({ title, value, subtext, icon: Icon, trend = null, color = 'indigo' }) {
  const colorMap = {
    indigo: 'text-indigo-600 bg-indigo-50',
    emerald: 'text-emerald-600 bg-emerald-50',
    amber: 'text-amber-600 bg-amber-50',
    rose: 'text-rose-600 bg-rose-50',
    slate: 'text-slate-600 bg-slate-100',
  };

  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500 tracking-wide uppercase">{title}</span>
        {Icon && (
          <div className={`p-2 rounded-lg ${colorMap[color] || colorMap.indigo}`}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
      <div className="mt-3">
        <div className="text-2xl font-bold tracking-tight text-slate-900 font-mono tabular-nums">{value}</div>
        {subtext && <p className="mt-1 text-xs text-slate-500">{subtext}</p>}
      </div>
      {trend && (
        <div className="mt-2 text-xs font-medium flex items-center gap-1">
          <span className={trend.isPositive ? 'text-emerald-600' : 'text-slate-500'}>
            {trend.text}
          </span>
        </div>
      )}
    </div>
  );
}

export function StatusBadge({ status, text = null }) {
  const s = (status || '').toLowerCase();
  const label = text || s.replace('_', ' ');

  let styles = 'bg-slate-100 text-slate-700 border-slate-200';

  if (s === 'present' || s === 'approved' || s === 'active' || s === 'finalized') {
    styles = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (s === 'late' || s === 'pending' || s === 'draft' || s === 'probation') {
    styles = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (s === 'absent' || s === 'rejected' || s === 'terminated' || s === 'resigned') {
    styles = 'bg-rose-50 text-rose-700 border-rose-200';
  } else if (s === 'half_day' || s === 'missing_checkout' || s === 'on_leave') {
    styles = 'bg-blue-50 text-blue-700 border-blue-200';
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border capitalize whitespace-nowrap tabular-nums ${styles}`}>
      {label}
    </span>
  );
}

export function Modal({ isOpen, onClose, title, children, footer = null, maxWidth = 'max-w-lg' }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} />
      <div className={`relative bg-white rounded-xl shadow-xl border border-slate-200 w-full ${maxWidth} overflow-hidden z-10 flex flex-col max-h-[90vh]`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-4 overflow-y-auto space-y-4 flex-1">
          {children}
        </div>
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-3.5 bg-slate-50 border-t border-slate-100">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function FormField({ label, error, required = false, children, hint = null }) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-xs font-semibold text-slate-700">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
    </div>
  );
}

export function Input({ className = '', ...props }) {
  return (
    <input
      className={`w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-slate-900 placeholder:text-slate-400 ${className}`}
      {...props}
    />
  );
}

export function Select({ options = [], className = '', ...props }) {
  return (
    <select
      className={`w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-slate-900 ${className}`}
      {...props}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export function SkeletonLoader({ rows = 4 }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 bg-slate-100 rounded-lg w-full" />
      ))}
    </div>
  );
}

export function EmptyState({ title, description, action = null, icon: Icon = null }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-white border border-dashed border-slate-200 rounded-xl">
      {Icon && (
        <div className="p-3 bg-slate-100 rounded-full text-slate-500 mb-3">
          <Icon className="w-6 h-6" />
        </div>
      )}
      <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
      <p className="mt-1 text-xs text-slate-500 max-w-sm">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
