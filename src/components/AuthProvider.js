"use client";

import { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { loginUser, logoutUser, ensureAdminExists } from '../actions/auth';
import { getCurrentSession } from '../actions/session';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    ensureAdminExists();

    getCurrentSession().then(session => {
      if (session) setUser(session);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const login = async (username, password) => {
    const result = await loginUser(username, password);
    if (result.error) return { error: result.error };

    setUser(result.user);

    if (result.user.role === 'employee' && result.user.employeeCode) {
      router.push(`/employee/${result.user.employeeCode}`);
    } else {
      router.push('/');
    }
    return { success: true };
  };

  const logout = async () => {
    await logoutUser();
    setUser(null);
    router.push('/login');
  };

  const isAuthenticated = !!user;
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isSuperAdmin = user?.role === 'super_admin';

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isAdmin, isSuperAdmin, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
