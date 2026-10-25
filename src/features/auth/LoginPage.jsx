import React, { useState } from 'react';
import { Lock, Mail, KeyRound, ArrowRight, Shield, UserCheck, AlertCircle } from 'lucide-react';
import { Button, Input, FormField } from '../../components/common/UIComponents.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../lib/api.js';

export function LoginPage() {
  const { login, registerEmployee, refreshUser } = useAuth();
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // First-sign-in change password state
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [changingPass, setChangingPass] = useState(false);
  const [availableAccounts, setAvailableAccounts] = useState([]);

  React.useEffect(() => {
    api.getDemoAccounts()
      .then(setAvailableAccounts)
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (mode === 'signup') {
        if (!name.trim()) {
          throw new Error('Please enter your full name.');
        }
        await registerEmployee(name, email, password);
      } else {
        const res = await login(email, password);
        if (res.user.temporaryPassword) {
          setNeedsPasswordChange(true);
        }
      }
    } catch (err) {
      setError(err.message || 'Operation failed. Please check your details.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setChangingPass(true);
    try {
      await api.changePassword(newPassword);
      await refreshUser();
      setNeedsPasswordChange(false);
    } catch (err) {
      setError(err.message || 'Password update failed.');
    } finally {
      setChangingPass(false);
    }
  };

  // Quick login helper for judging demo
  const quickLogin = async (targetEmail, targetPassword) => {
    setEmail(targetEmail);
    setPassword(targetPassword);
    setError(null);
    setIsLoading(true);
    try {
      const res = await login(targetEmail, targetPassword);
      if (res.user.temporaryPassword) {
        setNeedsPasswordChange(true);
      }
    } catch (err) {
      setError(`Quick login note: ${err.message}. If this account was not created yet, please log in as Admin/HR first.`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600 text-white font-bold text-xl shadow-md mb-3">
            H
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            {mode === 'signup' ? 'Create Employee Account' : 'Sign in to HCM Lite'}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {mode === 'signup'
              ? 'Enter your name, email, and password to start using Employee Portal'
              : 'Human Capital Management for Admin, HR, and Employees'}
          </p>
        </div>

        <div className="mt-8 bg-white py-8 px-6 shadow-sm border border-slate-200/80 rounded-2xl sm:px-10">
          {/* Mode Switcher Tabs */}
          <div className="flex rounded-lg bg-slate-100 p-1 mb-6 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError(null);
              }}
              className={`flex-1 py-1.5 rounded-md transition-all ${
                mode === 'signin'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError(null);
              }}
              className={`flex-1 py-1.5 rounded-md transition-all ${
                mode === 'signup'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              + Create Employee Account
            </button>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {needsPasswordChange ? (
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs">
                <p className="font-semibold mb-1">Temporary Password Detected</p>
                As required by HCM security rules, you must set a new permanent password on your first sign-in.
              </div>
              <FormField label="New Permanent Password" required hint="At least 6 characters">
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </FormField>
              <Button
                type="submit"
                variant="primary"
                isLoading={changingPass}
                className="w-full"
              >
                Set Permanent Password & Enter
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <FormField label="Full Name" required hint="e.g. Ali Khan">
                  <Input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ali Khan"
                    required
                  />
                </FormField>
              )}

              <FormField label="Corporate Email Address" required>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  required
                />
              </FormField>

              <FormField label="Password" required hint="At least 6 characters">
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </FormField>

              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isLoading}
                className="w-full font-semibold shadow-xs"
              >
                {mode === 'signup' ? 'Create Account & Enter Portal' : 'Sign In'}
              </Button>
            </form>
          )}

          {/* Quick Demo Access Bar for Hackathon Judges */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-center mb-2.5">
              Available System Accounts
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {availableAccounts.length === 0 ? (
                <div className="col-span-2 text-center text-slate-400 text-[11px] py-1">
                  Default passwords: Admin/HR pass set during creation
                </div>
              ) : (
                availableAccounts.slice(0, 4).map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => {
                      setEmail(acc.email);
                      setPassword(
                        acc.role === 'admin'
                          ? 'AdminSecurePass!2026'
                          : acc.role === 'hr'
                          ? 'HrPassword!2026'
                          : 'Password!2026'
                      );
                    }}
                    className="p-2 text-left rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <span className="font-semibold block text-slate-800 capitalize">{acc.role} ({acc.name})</span>
                    <span className="text-[10px] text-slate-500 font-mono block truncate">{acc.email}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
