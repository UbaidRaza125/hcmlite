import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, getStoredToken, setStoredToken } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [company, setCompany] = useState(null);
  const [token, setToken] = useState(getStoredToken());
  const [isConfigured, setIsConfigured] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Check setup status and existing session on mount
  useEffect(() => {
    async function initAuth() {
      try {
        const setupRes = await api.getSetupStatus();
        setIsConfigured(setupRes.isConfigured);

        if (!setupRes.isConfigured) {
          setIsLoading(false);
          return;
        }

        const stored = getStoredToken();
        if (stored) {
          try {
            const meRes = await api.getMe();
            setUser(meRes.user);
            setEmployee(meRes.employee);
            setCompany(meRes.company);
          } catch (err) {
            console.warn('Session expired or invalid, clearing token');
            setStoredToken(null);
            setToken(null);
          }
        }
      } catch (err) {
        console.error('Failed to initialize auth:', err);
      } finally {
        setIsLoading(false);
      }
    }

    initAuth();
  }, []);

  const login = async (email, password) => {
    const res = await api.login({ email, password });
    setStoredToken(res.token);
    setToken(res.token);
    setUser(res.user);

    // Fetch full profile info
    const meRes = await api.getMe();
    setEmployee(meRes.employee);
    setCompany(meRes.company);
    return res;
  };

  const registerUser = async ({ name, email, password, role = 'employee', companyName }) => {
    const res = await api.register({ name, email, password, role, companyName });
    setStoredToken(res.token);
    setToken(res.token);
    setUser(res.user);
    if (res.employee) setEmployee(res.employee);
    if (res.company) setCompany(res.company);
    setIsConfigured(true);
    return res;
  };

  const registerEmployee = async (name, email, password) => {
    return registerUser({ name, email, password, role: 'employee' });
  };

  const logout = () => {
    setStoredToken(null);
    setToken(null);
    setUser(null);
    setEmployee(null);
  };

  const refreshUser = async () => {
    try {
      const meRes = await api.getMe();
      setUser(meRes.user);
      setEmployee(meRes.employee);
      setCompany(meRes.company);
    } catch (err) {
      console.error('Failed to refresh user:', err);
    }
  };

  const completeSetup = (setupRes) => {
    setIsConfigured(true);
    setStoredToken(setupRes.token);
    setToken(setupRes.token);
    setUser(setupRes.user);
    refreshUser();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        employee,
        company,
        token,
        isConfigured,
        isLoading,
        login,
        registerUser,
        registerEmployee,
        logout,
        refreshUser,
        completeSetup,
        setIsConfigured,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
