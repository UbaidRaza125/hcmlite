import React, { useState } from 'react';
import { Building2, ShieldCheck, Clock, MapPin, CheckCircle, ArrowRight, Loader2 } from 'lucide-react';
import { Button, Input, FormField } from '../../components/common/UIComponents.jsx';
import { api } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';

export function FirstRunSetup() {
  const { completeSetup } = useAuth();
  const [formData, setFormData] = useState({
    companyName: 'Apex Enterprises',
    adminName: 'Chief Administrator',
    adminEmail: 'admin@apex.com',
    adminPassword: 'AdminSecurePass!2026',
    officeStart: '09:00',
    graceMinutes: 15,
    halfDayHours: 5,
    officeLat: 24.8607,
    officeLng: 67.0011,
    officeRadius: 150,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await api.initSetup(formData);
      completeSetup(res);
    } catch (err) {
      setError(err.message || 'Setup initialization failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600 text-white font-bold text-xl shadow-md mb-3">
            H
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Welcome to HCM Lite
          </h2>
          <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
            Fresh installation detected. Configure your organization profile and root Admin account to establish the system.
          </p>
        </div>

        <div className="mt-8 bg-white py-8 px-6 shadow-sm border border-slate-200/80 rounded-2xl sm:px-10">
          {error && (
            <div className="mb-6 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Step 1: Company Profile */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100 text-xs font-bold text-slate-800 uppercase tracking-wider">
                <Building2 className="w-4 h-4 text-indigo-600" />
                <span>1. Organization Details</span>
              </div>
              <FormField label="Company Name" required>
                <Input
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  placeholder="e.g. Apex Enterprises"
                  required
                />
              </FormField>
            </div>

            {/* Step 2: Operational Rules */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100 text-xs font-bold text-slate-800 uppercase tracking-wider">
                <Clock className="w-4 h-4 text-indigo-600" />
                <span>2. Attendance & Geofence Rules</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <FormField label="Office Start" hint="Default 09:00">
                  <Input
                    type="time"
                    value={formData.officeStart}
                    onChange={(e) => setFormData({ ...formData, officeStart: e.target.value })}
                    required
                  />
                </FormField>
                <FormField label="Grace Period" hint="15 min">
                  <Input
                    type="number"
                    value={formData.graceMinutes}
                    onChange={(e) => setFormData({ ...formData, graceMinutes: e.target.value })}
                    required
                  />
                </FormField>
                <FormField label="Half Day Under" hint="5 hours">
                  <Input
                    type="number"
                    value={formData.halfDayHours}
                    onChange={(e) => setFormData({ ...formData, halfDayHours: e.target.value })}
                    required
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <FormField label="Office Latitude" hint="GPS lat">
                  <Input
                    type="number"
                    step="0.0001"
                    value={formData.officeLat}
                    onChange={(e) => setFormData({ ...formData, officeLat: e.target.value })}
                    required
                  />
                </FormField>
                <FormField label="Office Longitude" hint="GPS lng">
                  <Input
                    type="number"
                    step="0.0001"
                    value={formData.officeLng}
                    onChange={(e) => setFormData({ ...formData, officeLng: e.target.value })}
                    required
                  />
                </FormField>
                <FormField label="Geofence Radius" hint="meters">
                  <Input
                    type="number"
                    value={formData.officeRadius}
                    onChange={(e) => setFormData({ ...formData, officeRadius: e.target.value })}
                    required
                  />
                </FormField>
              </div>
            </div>

            {/* Step 3: Admin Account */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100 text-xs font-bold text-slate-800 uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                <span>3. Primary Administrator Account</span>
              </div>
              <FormField label="Admin Full Name" required>
                <Input
                  value={formData.adminName}
                  onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                  placeholder="System Administrator"
                  required
                />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Admin Email" required>
                  <Input
                    type="email"
                    value={formData.adminEmail}
                    onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                    placeholder="admin@company.com"
                    required
                  />
                </FormField>
                <FormField label="Admin Password" required hint="Min 6 characters">
                  <Input
                    type="password"
                    value={formData.adminPassword}
                    onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                    required
                  />
                </FormField>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              className="w-full font-semibold shadow-md"
            >
              Initialize HCM Lite Organization
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-500">
              This initialization is run once. Once established, configuration is locked under Admin control.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
