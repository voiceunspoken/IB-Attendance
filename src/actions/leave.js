"use server";

import { prisma } from '../lib/prisma';
import { revalidatePath } from 'next/cache';

// ─── LEAVE POLICY ───────────────────────────────────────────

export async function getLeavePolicy(year) {
  return prisma.leavePolicy.findUnique({ where: { year } });
}

export async function upsertLeavePolicy(year, { cl, sl, el, rl }) {
  return prisma.leavePolicy.upsert({
    where: { year },
    update: { cl, sl, el, rl },
    create: { year, cl, sl, el, rl }
  });
}

// ─── LEAVE BALANCE ───────────────────────────────────────────

export async function getLeaveBalance(employeeCode, year) {
  const emp = await prisma.employee.findUnique({ where: { code: employeeCode } });
  if (!emp) return null;

  let balance = await prisma.leaveBalance.findUnique({
    where: { employeeId_year: { employeeId: emp.id, year } }
  });

  if (!balance) {
    // Auto-create from policy or defaults — per IB HR Policy:
    // CL: 12/yr, SL: 6/yr, EL: 4/yr (quarterly after 1yr), RL: 2/yr
    const policy = await prisma.leavePolicy.findUnique({ where: { year } });
    balance = await prisma.leaveBalance.create({
      data: {
        employeeId: emp.id,
        year,
        clTotal: policy?.cl ?? 12,
        slTotal: policy?.sl ?? 6,
        elTotal: policy?.el ?? 4,
        rlTotal: policy?.rl ?? 2,
      }
    });
  }

  // Sync used counts from approved leave requests
  const approved = await prisma.leaveRequest.findMany({
    where: {
      employeeId: emp.id,
      status: 'approved',
      fromDate: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) }
    }
  });

  const used = { cl: 0, sl: 0, el: 0, rl: 0 };
  approved.forEach(r => { used[r.leaveType] = (used[r.leaveType] || 0) + r.days; });

  // Also count RL from attendance records
  const records = await prisma.monthRecord.findMany({
    where: { employeeId: emp.id, monthYear: { contains: `_${year}` } }
  });
  const attendanceRL = records.reduce((s, r) => s + r.rl, 0);

  return {
    ...balance,
    clUsed: used.cl,
    slUsed: used.sl,
    elUsed: used.el,
    rlUsed: Math.max(used.rl, attendanceRL),
    clAvail: balance.clTotal + balance.clCarry - used.cl,
    slAvail: balance.slTotal - used.sl,
    elAvail: balance.elTotal - used.el,
    rlAvail: balance.rlTotal - Math.max(used.rl, attendanceRL),
  };
}

export async function getAllLeaveBalances(year) {
  const employees = await prisma.employee.findMany({
    select: { id: true, code: true, name: true }
  });

  const balances = await Promise.all(
    employees.map(emp => getLeaveBalance(emp.code, year))
  );

  return employees.map((emp, i) => ({ ...emp, balance: balances[i] }));
}

export async function getLeaveBalancesForExport(year, fromMonth = 1, toMonth = 12) {
  const employees = await prisma.employee.findMany({
    select: { id: true, code: true, name: true },
    orderBy: { name: 'asc' }
  });

  const fromDate = new Date(`${year}-${String(fromMonth).padStart(2, '0')}-01`);
  // Last day of toMonth
  const toDate = new Date(year, toMonth, 0); // day 0 of next month = last day of toMonth

  const results = await Promise.all(
    employees.map(async (emp) => {
      const balance = await getLeaveBalance(emp.code, year);

      // Get approved leave requests within the selected range
      const approved = await prisma.leaveRequest.findMany({
        where: {
          employeeId: emp.id,
          status: 'approved',
          fromDate: { gte: fromDate, lte: toDate }
        },
        orderBy: { fromDate: 'asc' }
      });

      // Count used per type within range
      const rangeUsed = { cl: 0, sl: 0, el: 0, rl: 0 };
      approved.forEach(r => {
        rangeUsed[r.leaveType] = (rangeUsed[r.leaveType] || 0) + Number(r.days);
      });

      // Summarise leave taken
      const leaveDetail = approved.map(r =>
        `${r.leaveType.toUpperCase()} ${r.days}d (${new Date(r.fromDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}${r.fromDate.toDateString() !== r.toDate.toDateString() ? '–' + new Date(r.toDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''})`
      ).join('; ') || '—';

      return {
        code: emp.code,
        name: emp.name,
        balance,
        rangeUsed,
        leaveDetail,
      };
    })
  );

  return results;
}

export async function adminUpdateLeaveBalance(employeeCode, year, fields) {
  const emp = await prisma.employee.findUnique({ where: { code: employeeCode } });
  if (!emp) return { error: 'Employee not found' };

  await prisma.leaveBalance.upsert({
    where: { employeeId_year: { employeeId: emp.id, year } },
    update: fields,
    create: { employeeId: emp.id, year, ...fields }
  });
  return { success: true };
}

// ─── LEAVE REQUESTS ──────────────────────────────────────────

export async function submitLeaveRequest(employeeCode, { leaveType, fromDate, toDate, days, reason }) {
  const emp = await prisma.employee.findUnique({ where: { code: employeeCode } });
  if (!emp) return { error: 'Employee not found' };

  const req = await prisma.leaveRequest.create({
    data: {
      employeeId: emp.id,
      leaveType,
      fromDate: new Date(fromDate),
      toDate: new Date(toDate),
      days,
      reason,
      status: 'pending'
    }
  });
  revalidatePath(`/employee/${employeeCode}`);
  return { request: req };
}

export async function getLeaveRequests(employeeCode) {
  const emp = await prisma.employee.findUnique({ where: { code: employeeCode } });
  if (!emp) return [];
  return prisma.leaveRequest.findMany({
    where: { employeeId: emp.id },
    orderBy: { createdAt: 'desc' }
  });
}

export async function getAllPendingLeaveRequests() {
  return prisma.leaveRequest.findMany({
    where: { status: 'pending' },
    include: { employee: { select: { code: true, name: true } } },
    orderBy: { createdAt: 'asc' }
  });
}

export async function getAllLeaveRequests() {
  return prisma.leaveRequest.findMany({
    include: { employee: { select: { code: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200
  });
}

export async function reviewLeaveRequest(requestId, reviewedBy, approve, note = '') {
  const req = await prisma.leaveRequest.update({
    where: { id: requestId },
    data: {
      status: approve ? 'approved' : 'rejected',
      reviewedBy,
      reviewedAt: new Date(),
      reviewNote: note || null
    },
    include: { employee: true }
  });

  // Auto-update attendance: mark approved leave days in DailyLog
  if (approve) {
    const from = new Date(req.fromDate);
    const to = new Date(req.toDate);
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      const monthYear = `${d.getMonth() + 1}_${d.getFullYear()}`;
      const day = d.getDate();
      // Only update if day is currently absent
      const existing = await prisma.dailyLog.findUnique({
        where: { employeeId_monthYear_day: { employeeId: req.employeeId, monthYear, day } }
      });
      if (existing && existing.type === 'absent') {
        await prisma.dailyLog.update({
          where: { employeeId_monthYear_day: { employeeId: req.employeeId, monthYear, day } },
          data: { type: req.leaveType === 'rl' ? 'rl' : 'present', raw: req.leaveType.toUpperCase() }
        });
        // Update MonthRecord counts
        await prisma.monthRecord.updateMany({
          where: { employeeId: req.employeeId, monthYear },
          data: { absent: { decrement: 1 }, present: { increment: 1 } }
        });
      }
    }
  }

  revalidatePath('/');
  return { request: req };
}

// ─── REGULARIZATION / CONFLICT ───────────────────────────────

export async function submitRegularization(employeeCode, { date, requestedIn, requestedOut, reason, type }) {
  const emp = await prisma.employee.findUnique({ where: { code: employeeCode } });
  if (!emp) return { error: 'Employee not found' };

  const req = await prisma.regularizationRequest.create({
    data: {
      employeeId: emp.id,
      date: new Date(date),
      type: type || 'missing_punch',
      requestedIn: requestedIn || null,
      requestedOut: requestedOut || null,
      reason,
      status: 'pending',
      superStatus: 'pending'
    }
  });
  return { request: req };
}

export async function getRegularizations(employeeCode) {
  const emp = await prisma.employee.findUnique({ where: { code: employeeCode } });
  if (!emp) return [];
  return prisma.regularizationRequest.findMany({
    where: { employeeId: emp.id },
    orderBy: { createdAt: 'desc' }
  });
}

export async function getAllPendingRegularizations() {
  return prisma.regularizationRequest.findMany({
    where: { status: 'pending' },
    include: { employee: { select: { code: true, name: true } } },
    orderBy: { createdAt: 'asc' }
  });
}

// Admin review — sets status, then needs super admin approval
export async function reviewRegularization(requestId, reviewedBy, approve, note = '') {
  const req = await prisma.regularizationRequest.update({
    where: { id: requestId },
    data: {
      status: approve ? 'approved' : 'rejected',
      reviewedBy,
      reviewedAt: new Date(),
      reviewNote: note || null
    }
  });
  return { request: req };
}

// Get regularizations pending super admin approval
export async function getPendingSuperRegularizations() {
  return prisma.regularizationRequest.findMany({
    where: { status: 'approved', superStatus: 'pending' },
    include: { employee: { select: { code: true, name: true } } },
    orderBy: { createdAt: 'asc' }
  });
}

// Super admin final approval
export async function reviewRegularizationSuper(requestId, superReviewedBy, approve) {
  const req = await prisma.regularizationRequest.update({
    where: { id: requestId },
    data: {
      superStatus: approve ? 'approved' : 'rejected',
      superReviewedBy,
      superReviewedAt: new Date()
    }
  });

  // If fully approved, update DailyLog
  if (approve && req.status === 'approved') {
    const date = new Date(req.date);
    const monthYear = `${date.getMonth() + 1}_${date.getFullYear()}`;
    const day = date.getDate();

    const existing = await prisma.dailyLog.findUnique({
      where: { employeeId_monthYear_day: { employeeId: req.employeeId, monthYear, day } }
    });

    if (existing && (existing.type === 'absent' || !existing.inT)) {
      const inT = req.requestedIn ? parseTime(req.requestedIn) : existing.inT;
      const outT = req.requestedOut ? parseTime(req.requestedOut) : existing.outT;
      await prisma.dailyLog.update({
        where: { employeeId_monthYear_day: { employeeId: req.employeeId, monthYear, day } },
        data: { type: 'present', inT, outT }
      });
    }
  }

  return { request: req };
}

function parseTime(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}
