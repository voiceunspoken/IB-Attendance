"use client";

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getEmployeeHistory } from '../../../actions/attendance';
import { getLeaveBalance } from '../../../actions/leave';
import { getUpcomingHolidays, getHolidays } from '../../../actions/holidays';
import { getAvatarUrl } from '../../../actions/employees';

const EmployeeContext = createContext(null);

export function EmployeeProvider({ code, children }) {
  const [emp, setEmp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [leaveBalanceDetail, setLeaveBalanceDetail] = useState(null);
  const [upcomingHolidays, setUpcomingHolidays] = useState([]);
  const [rlHolidays, setRlHolidays] = useState([]);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const year = new Date().getFullYear();
        const [data, balance, holidays, allHolidays] = await Promise.all([
          getEmployeeHistory(code),
          getLeaveBalance(code, year),
          getUpcomingHolidays(),
          getHolidays(year),
        ]);
        if (data) {
          setEmp(data);
          const restricted = allHolidays.filter(h => h.isRestricted || h.type === 'optional');
          const empBirthday = data.birthday
            ? { month: new Date(data.birthday).getMonth() + 1, day: new Date(data.birthday).getDate() }
            : null;
          setRlHolidays(
            restricted.map(h => ({ ...h, isBirthday: false })).concat(
              empBirthday
                ? [{ month: empBirthday.month, day: empBirthday.day, name: 'Birthday', type: 'optional', isBirthday: true }]
                : []
            )
          );
        }
        setLeaveBalance(balance);
        setLeaveBalanceDetail(balance);
        setUpcomingHolidays(holidays);
        try { const url = await getAvatarUrl(code); setAvatarUrl(url); } catch { setAvatarUrl(null); }
      } catch {
        setEmp(null);
        setLeaveBalance(null);
        setLeaveBalanceDetail(null);
        setUpcomingHolidays([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [code, fetchTrigger]);

  const triggerRefetch = useCallback(() => setFetchTrigger(t => t + 1), []);

  return (
    <EmployeeContext.Provider value={{ emp, loading, leaveBalance, leaveBalanceDetail, upcomingHolidays, rlHolidays, avatarUrl, setEmp, triggerRefetch }}>
      {children}
    </EmployeeContext.Provider>
  );
}

export function useEmployeeData() {
  const ctx = useContext(EmployeeContext);
  if (!ctx) throw new Error('useEmployeeData must be used within EmployeeProvider');
  return ctx;
}
