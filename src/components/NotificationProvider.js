"use client";

import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthProvider';
import { getUnreadCount as fetchUnreadCount, getNotifications as fetchNotifications, markAsRead, markAllAsRead } from '../actions/notifications';

const NotificationContext = createContext(null);

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}

export function NotificationProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!user?.id || !isAuthenticated) return;

    const doPoll = async () => {
      try {
        const count = await fetchUnreadCount(user.id);
        setUnreadCount(count);
      } catch { /* ignore */ }
    };

    doPoll();
    intervalRef.current = setInterval(doPoll, 30000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user, isAuthenticated]);

  const loadNotifications = async () => {
    if (!user?.id || !isAuthenticated) return;
    try {
      const { notifications: notifs } = await fetchNotifications(user.id, 100, 0);
      setNotifications(notifs);
      const count = await fetchUnreadCount(user.id);
      setUnreadCount(count);
    } catch { /* ignore */ }
  };

  const handleMarkAsRead = async (ids) => {
    await markAsRead(ids);
    setNotifications(prev => prev.map(n => ids.includes(n.id) ? { ...n, isRead: true } : n));
    setUnreadCount(prev => Math.max(0, prev - ids.length));
  };

  const handleMarkAllAsRead = async () => {
    if (!user?.id) return;
    await markAllAsRead(user.id);
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      loadNotifications,
      markAsRead: handleMarkAsRead,
      markAllAsRead: handleMarkAllAsRead,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}
