import React, { useState, useEffect } from 'react';
import {
  Lock,
  Mail,
  User,
  Building2,
  ArrowRight,
  Shield,
  UserCheck,
  AlertCircle,
  Sparkles,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';
import { Button, Input, FormField } from '../../components/common/UIComponents.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../lib/api.js';

export function LoginPage({ initialMode = 'signin' }) {
  const { login, registerUser, completeSetup, refreshUser, isConfigured } = useAuth();
  
  // 'signin' or 'signup'
  const [mode, setMode] = useState(initialMode);
  // In signup: 'employee' or 'organization'
  const [signupType, setSignupType] = useState(isConfigured ? 'employee' : 'organization');

  // Form Fields
  const [companyName, setCompanyName] = useState('Apex Enterprises');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // First-sign-in temporary password change state
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [changingPass, setChangingPass] = useState(false);
  const [availableAccounts, setAvailableAccounts] = useState([]);

  // Load available demo accounts
  useEffect(() => {
    api.getDemoAccounts()
      .then((accs) => {
        if (Array.isArray(accs)) setAvailableAccounts(accs);
      })
      .catch(() => {});
  }, [mode]);

  // Sync mode if initialMode changes
  useEffect(() => {
    if (initialMode) setMode(initialMode);
  }, [initialMode]);

  // Form submit handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      if (mode === 'signup') {
        if (!name.trim()) {
          throw new Error('Please enter your full name.');
        }
        if (!email.trim() || !email.includes('@')) {
          throw new Error('Please enter a valid corporate or personal email.');
        }
        if (!password || password.length < 6) {
          throw new Error('Password must be at least 6 characters.');
        }

        if (signupType === 'organization') {
          if (!companyName.trim()) {
            throw new Error('Please enter your company or organization name.');
          }
          await registerUser({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            password,
            companyName: companyName.trim(),
            role: 'admin',
          });
        } else if (signupType === 'hr') {
          await registerUser({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            password,
            role: 'hr',
          });
        } else {
          // Employee registration
          await registerUser({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            password,
            role: 'employee',
          });
        }
      } else {
        // Sign In
        if (!email.trim()) throw new Error('Please enter your email.');
        if (!password) throw new Error('Please enter your password.');

        const res = await login(email.trim().toLowerCase(), password);
        if (res.user.temporaryPassword) {
          setNeedsPasswordChange(true);
        }
      }
    } catch (err) {
      setError(err.message || 'Operation failed. Please check your credentials.');
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

  // 1-click quick demo login for hackathon evaluation
  const handleQuickLogin = async (targetEmail, defaultPass) => {
    setEmail(targetEmail);
    setPassword(defaultPass);
    setError(null);
    setIsLoading(true);
    try {
      const res = await login(targetEmail, defaultPass);
      if (res.user.temporaryPassword) {
        setNeedsPasswordChange(true);
      }
    } catch (err) {
      setError(`Quick login note: ${err.message}. If not set up yet, please create an account.`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-10 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-600 text-white font-bold text-xl shadow-md shadow-indigo-200 mb-3">
            H
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {mode === 'signup' ? 'Create an Account' : 'Sign in to HCM Lite'}
          </h1>
          <p className="mt-1 text-xs text-slate-500 max-w-xs mx-auto">
            {mode === 'signup'
              ? 'Join HCM Lite with your organization or as a team employee'
              : 'Human Capital Management for Admin, HR, and Employees'}
          </p>
        </div>

        {/* Main Card */}
        <div className="mt-6 bg-white py-8 px-6 shadow-sm border border-slate-200/80 rounded-2xl sm:px-10">
          
          {/* Top Mode Selector Tabs */}
          <div className="flex rounded-xl bg-slate-100 p-1 mb-6 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError(null);
              }}
              className={`flex-1 py-2 rounded-lg transition-all text-center cursor-pointer ${
                mode === 'signin'
                  ? 'bg-white text-indigo-700 shadow-2xs font-bold'
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
              className={`flex-1 py-2 rounded-lg transition-all text-center cursor-pointer ${
                mode === 'signup'
                  ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Feedback messages */}
          {error && (
            <div className="mb-5 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-5 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-start gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Temporary Password Change Flow */}
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
              
              {/* Account Type Selector for Sign Up */}
              {mode === 'signup' && (
                <div className="space-y-3 pb-2 border-b border-slate-100">
                  <label className="block text-xs font-semibold text-slate-700">
                    Account Category
                  </label>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setSignupType('organization')}
                      className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                        signupType === 'organization'
                          ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 font-semibold shadow-2xs'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <Building2 className={`w-3.5 h-3.5 mb-1 ${signupType === 'organization' ? 'text-indigo-600' : 'text-slate-400'}`} />
                      <div className="leading-tight text-[11px]">Company / Admin</div>
                      <div className="text-[9px] text-slate-400 font-normal mt-0.5">Admin & Org</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSignupType('hr')}
                      className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                        signupType === 'hr'
                          ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 font-semibold shadow-2xs'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <Shield className={`w-3.5 h-3.5 mb-1 ${signupType === 'hr' ? 'text-indigo-600' : 'text-slate-400'}`} />
                      <div className="leading-tight text-[11px]">HR Specialist</div>
                      <div className="text-[9px] text-slate-400 font-normal mt-0.5">HR & Payroll</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSignupType('employee')}
                      className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                        signupType === 'employee'
                          ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 font-semibold shadow-2xs'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <User className={`w-3.5 h-3.5 mb-1 ${signupType === 'employee' ? 'text-indigo-600' : 'text-slate-400'}`} />
                      <div className="leading-tight text-[11px]">Employee</div>
                      <div className="text-[9px] text-slate-400 font-normal mt-0.5">Staff Portal</div>
                    </button>
                  </div>

                  {signupType === 'organization' && (
                    <FormField label="Company / Organization Name" required>
                      <Input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="e.g. Apex Enterprises"
                        required
                      />
                    </FormField>
                  )}
                </div>
              )}

              {/* Full Name field in Signup */}
              {mode === 'signup' && (
                <FormField label="Full Name" required hint="e.g. Muhammad Ali">
                  <Input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Muhammad Ali"
                    required
                  />
                </FormField>
              )}

              {/* Email Address */}
              <FormField
                label={mode === 'signup' && signupType === 'organization' ? 'Admin Work Email' : 'Email Address'}
                required
              >
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  required
                />
              </FormField>

              {/* Password */}
              <FormField label="Password" required hint="At least 6 characters">
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </FormField>

              {/* Submit button */}
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isLoading}
                className="w-full font-semibold shadow-xs mt-2"
              >
                {mode === 'signup'
                  ? signupType === 'organization'
                    ? 'Initialize Organization & Enter'
                    : 'Create Employee Account & Enter'
                  : 'Sign In to Portal'}
              </Button>
            </form>
          )}

          {/* BOTTOM LINK TOGGLE (Required by user: In Sign In -> Create Account link; In Create Account -> Sign In link) */}
          <div className="mt-6 pt-5 border-t border-slate-100 text-center text-xs text-slate-600">
            {mode === 'signup' ? (
              <p>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setError(null);
                  }}
                  className="font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                >
                  Sign In here
                </button>
              </p>
            ) : (
              <p>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setError(null);
                  }}
                  className="font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                >
                  Create an Account
                </button>
              </p>
            )}
          </div>

          {/* Quick Demo Access Bar */}
          {mode === 'signin' && (
            <div className="mt-6 pt-5 border-t border-slate-100">
              <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-center mb-2.5">
                Quick Demo Access
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {availableAccounts.length === 0 ? (
                  <div className="col-span-2 text-center text-slate-400 text-[11px] py-1 bg-slate-50 rounded-lg p-2 border border-slate-100">
                    No accounts yet. Click{' '}
                    <button
                      type="button"
                      onClick={() => setMode('signup')}
                      className="text-indigo-600 font-semibold underline cursor-pointer"
                    >
                      Create Account
                    </button>{' '}
                    to set up your organization or team.
                  </div>
                ) : (
                  availableAccounts.slice(0, 4).map((acc) => (
                    <button
                      key={acc.email}
                      type="button"
                      onClick={() => {
                        const pass =
                          acc.role === 'admin'
                            ? 'AdminSecurePass!2026'
                            : acc.role === 'hr'
                            ? 'HrPassword!2026'
                            : 'Password!2026';
                        handleQuickLogin(acc.email, pass);
                      }}
                      className="p-2 text-left rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <span className="font-semibold block text-slate-800 capitalize">
                        {acc.role} ({acc.name})
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono block truncate">
                        {acc.email}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

        </div>

        {/* Database & Firebase System Notice */}
        <div className="mt-4 text-center">
          <p className="text-[11px] text-slate-400">
            Database Project: <span className="font-mono text-slate-500 font-semibold">hcm-project-368fc</span> · Firestore & Local Engine Ready
          </p>
        </div>

      </div>
    </div>
  );
}
