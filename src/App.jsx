import React, { useState } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import { FirstRunSetup } from './features/setup/FirstRunSetup.jsx';
import { LoginPage } from './features/auth/LoginPage.jsx';
import { Sidebar } from './components/layout/Sidebar.jsx';
import { TopHeader } from './components/layout/TopHeader.jsx';
import { AdminDashboard } from './features/dashboard/AdminDashboard.jsx';
import { HrDashboard } from './features/dashboard/HrDashboard.jsx';
import { EmployeeDashboard } from './features/dashboard/EmployeeDashboard.jsx';
import { OrgSettingsView } from './features/organization/OrgSettingsView.jsx';
import { EmployeesView } from './features/employees/EmployeesView.jsx';
import { AttendanceView } from './features/attendance/AttendanceView.jsx';
import { LeaveView } from './features/leave/LeaveView.jsx';
import { PayrollView } from './features/payroll/PayrollView.jsx';
import { CommsView } from './features/comms/CommsView.jsx';
import { AuditLogView } from './features/audit/AuditLogView.jsx';
import { AiAssistantDrawer } from './components/ai/AiAssistantDrawer.jsx';

export default function App() {
  const { user, isConfigured, isLoading } = useAuth();
  const [currentTab, setTab] = useState('dashboard');
  const [aiOpen, setAiOpen] = useState(false);
  const [aiInitialPrompt, setAiInitialPrompt] = useState('');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-500">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-medium">Initializing HCM Lite...</p>
      </div>
    );
  }

  // First-run setup detection
  if (!isConfigured) {
    return <FirstRunSetup />;
  }

  // Not authenticated
  if (!user) {
    return <LoginPage />;
  }

  const openAiWithPrompt = (prompt) => {
    setAiInitialPrompt(prompt);
    setAiOpen(true);
  };

  // Render view component
  const renderContent = () => {
    switch (currentTab) {
      case 'dashboard':
        if (user.role === 'admin') {
          return <AdminDashboard onOpenAi={() => setAiOpen(true)} setTab={setTab} />;
        }
        if (user.role === 'hr') {
          return <HrDashboard onOpenAi={() => setAiOpen(true)} setTab={setTab} />;
        }
        return (
          <EmployeeDashboard
            onOpenAi={() => setAiOpen(true)}
            setTab={setTab}
            onSmartLeave={openAiWithPrompt}
          />
        );

      case 'organization':
        return <OrgSettingsView />;

      case 'employees':
        return <EmployeesView />;

      case 'attendance':
        return <AttendanceView />;

      case 'leave':
        return <LeaveView onOpenAiWithPrompt={openAiWithPrompt} />;

      case 'payroll':
        return <PayrollView />;

      case 'comms':
        return <CommsView />;

      case 'audit':
        return <AuditLogView />;

      default:
        return <AdminDashboard onOpenAi={() => setAiOpen(true)} setTab={setTab} />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        setTab={setTab}
        onOpenAi={() => {
          setAiInitialPrompt('');
          setAiOpen(true);
        }}
      />

      {/* Main Viewport */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopHeader
          currentTab={currentTab}
          onOpenAi={() => {
            setAiInitialPrompt('');
            setAiOpen(true);
          }}
        />

        <main className="flex-1 overflow-y-auto bg-slate-50/60">
          {renderContent()}
        </main>
      </div>

      {/* Floating AI Assistant Drawer */}
      <AiAssistantDrawer
        isOpen={aiOpen}
        onClose={() => setAiOpen(false)}
        initialPrompt={aiInitialPrompt}
      />
    </div>
  );
}
