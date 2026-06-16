"use client";

import { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { loginUser, ensureAdminExists } from '../actions/auth';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('ib_user');
        return stored ? JSON.parse(stored) : null;
      } catch {
        if (typeof window !== 'undefined') localStorage.removeItem('ib_user');
        return null;
      }
    }
    return null;
  });
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    ensureAdminExists();
    const id = setTimeout(() => setLoading(false), 0);
    return () => clearTimeout(id);
  }, []);

  const login = async (username, password) => {
    const result = await loginUser(username, password);
    if (result.error) return { error: result.error };

    localStorage.setItem('ib_user', JSON.stringify(result.user));
    setUser(result.user);

    // Employees go straight to their own profile
    if (result.user.role === 'employee' && result.user.employeeCode) {
      router.push(`/employee/${result.user.employeeCode}`);
    } else {
      router.push('/');
    }
    return { success: true };
  };

  const logout = () => {
    localStorage.removeItem('ib_user');
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
