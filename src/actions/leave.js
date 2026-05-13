"use server";

import { prisma } from '../lib/prisma';
import { revalidatePath } from 'next/cache';
import { requireAuth, requireAdmin } from '../lib/session';

// ─── LEAVE POLICY ───────────────────────────────────────────

export async function getLeavePolicy(year) {
  try {
    await requireAuth();
    return prisma.leavePolicy.findUnique({ where: { year } });
  } catch {
    return null;
  }
}

export async function upsertLeavePolicy(year, { cl, sl, el, rl }) {
  try {
    await requireAdmin();
    return prisma.leavePolicy.upsert({
      where: { year },
      update: { cl, sl, el, rl },
      create: { year, cl, sl, el, rl }
    });
  } catch (e) {
    if (e.message === 'Authentication required' || e.message === 'Admin access required') return { error: e.message };
    console.error('[upsertLeavePolicy error]', e.message);
    return { error: 'Failed to save policy.' };
  }
}

// ─── LEAVE BALANCE ───────────────────────────────────────────

export async function getLeaveBalance(employeeCode, year) {
  try {
    const session = await requireAuth();
    if (session.role === 'employee' && session.employeeCode !== employeeCode) return null;

    const emp = await prisma.employee.findUnique({ where: { code: employeeCode } });
    if (!emp) return null;

    let balance = await prisma.leaveBalance.findUnique({
      where: { employeeId_year: { employeeId: emp.id, year } }
    });

    if (!balance) {
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

    const approved = await prisma.leaveRequest.findMany({
      where: {
        employeeId: emp.id,
        status: 'approved',
        fromDate: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) }
      }
    });

    const used = { cl: 0, sl: 0, el: 0, rl: 0 };
    approved.forEach(r => { used[r.leaveType] = (used[r.leaveType] || 0) + r.days; });

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
  } catch {
    return null;
  }
}

export async function getAllLeaveBalances(year) {
  try {
    await requireAdmin();
    const employees = await prisma.employee.findMany({
      select: { id: true, code: true, name: true }
    });

    const balances = await Promise.all(
      employees.map(emp => getLeaveBalance(emp.code, year))
    );

    return employees.map((emp, i) => ({ ...emp, balance: balances[i] }));
  } catch {
    return [];
  }
}

export async function getLeaveBalancesForExport(year, fromMonth = 1, toMonth = 12) {
  try {
    await requireAdmin();
    const employees = await prisma.employee.findMany({
      select: { id: true, code: true, name: true },
      orderBy: { name: 'asc' }
    });

    const fromDate = new Date(`${year}-${String(fromMonth).padStart(2, '0')}-01`);
    const toDate = new Date(year, toMonth, 0);

    // Batch fetch all approved leave requests for the range
    const allApproved = await prisma.leaveRequest.findMany({
      where: {
        status: 'approved',
        fromDate: { gte: fromDate, lte: toDate }
      },
      orderBy: { fromDate: 'asc' }
    });

    const approvedByEmpId = {};
    allApproved.forEach(r => {
      if (!approvedByEmpId[r.employeeId]) approvedByEmpId[r.employeeId] = [];
      approvedByEmpId[r.employeeId].push(r);
    });

    const results = await Promise.all(
      employees.map(async (emp) => {
        const balance = await getLeaveBalance(emp.code, year);
        const approved = approvedByEmpId[emp.id] || [];

        const rangeUsed = { cl: 0, sl: 0, el: 0, rl: 0 };
        approved.forEach(r => {
          rangeUsed[r.leaveType] = (rangeUsed[r.leaveType] || 0) + Number(r.days);
        });

        const leaveDetail = approved.map(r => {
          const fromStr = new Date(r.fromDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
          const toStr = new Date(r.toDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
          const isSameDay = new Date(r.fromDate).toDateString() === new Date(r.toDate).toDateString();
          return `${r.leaveType.toUpperCase()} ${r.days}d (${fromStr}${isSameDay ? '' : '–' + toStr})`;
        }).join('; ') || '—';

        return { code: emp.code, name: emp.name, balance, rangeUsed, leaveDetail };
      })
    );

    return results;
  } catch {
    return [];
  }
}

export async function adminUpdateLeaveBalance(employeeCode, year, fields) {
  try {
    await requireAdmin();
    const emp = await prisma.employee.findUnique({ where: { code: employeeCode } });
    if (!emp) return { error: 'Employee not found' };

    // Validate no negative values
    const numericFields = ['clTotal', 'slTotal', 'elTotal', 'rlTotal', 'clCarry'];
    for (const key of numericFields) {
      if (fields[key] !== undefined && fields[key] < 0) {
        return { error: `${key} cannot be negative.` };
      }
    }

    await prisma.leaveBalance.upsert({
      where: { employeeId_year: { employeeId: emp.id, year } },
      update: fields,
      create: { employeeId: emp.id, year, ...fields }
    });
    return { success: true };
  } catch (e) {
    if (e.message === 'Authentication required' || e.message === 'Admin access required') return { error: e.message };
    console.error('[adminUpdateLeaveBalance error]', e.message);
    return { error: 'Failed to update leave balance.' };
  }
}

// ─── LEAVE REQUESTS ──────────────────────────────────────────

export async function submitLeaveRequest(employeeCode, { leaveType, fromDate, toDate, days, reason }) {
  try {
    const session = await requireAuth();
    if (session.role === 'employee' && session.employeeCode !== employeeCode) {
      return { error: 'Cannot submit leave for another employee.' };
    }

    const emp = await prisma.employee.findUnique({ where: { code: employeeCode } });
    if (!emp) return { error: 'Employee not found' };

    // Validate leave balance
    const year = new Date(fromDate).getFullYear();
    const balance = await getLeaveBalance(employeeCode, year);
    if (balance) {
      const availKey = `${leaveType}Avail`;
      if (balance[availKey] !== undefined && balance[availKey] < days) {
        return { error: `Insufficient ${leaveType.toUpperCase()} balance. Available: ${balance[availKey]}, Requested: ${days}` };
      }
    }

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
  } catch (e) {
    if (e.message === 'Authentication required') return { error: e.message };
    console.error('[submitLeaveRequest error]', e.message);
    return { error: 'Failed to submit leave request.' };
  }
}

export async function getLeaveRequests(employeeCode) {
  try {
    const session = await requireAuth();
    if (session.role === 'employee' && session.employeeCode !== employeeCode) return [];
    const emp = await prisma.employee.findUnique({ where: { code: employeeCode } });
    if (!emp) return [];
    return prisma.leaveRequest.findMany({
      where: { employeeId: emp.id },
      orderBy: { createdAt: 'desc' }
    });
  } catch {
    return [];
  }
}

export async function getAllPendingLeaveRequests() {
  try {
    await requireAdmin();
    return prisma.leaveRequest.findMany({
      where: { status: 'pending' },
      include: { employee: { select: { code: true, name: true } } },
      orderBy: { createdAt: 'asc' }
    });
  } catch {
    return [];
  }
}

export async function getAllLeaveRequests() {
  try {
    await requireAdmin();
    return prisma.leaveRequest.findMany({
      include: { employee: { select: { code: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200
    });
  } catch {
    return [];
  }
}

export async function reviewLeaveRequest(requestId, reviewedBy, approve, note = '') {
  try {
    const session = await requireAdmin();

    // Re-check balance before approving
    if (approve) {
      const pending = await prisma.leaveRequest.findUnique({
        where: { id: requestId },
        include: { employee: true }
      });
      if (pending && pending.status === 'pending') {
        const year = new Date(pending.fromDate).getFullYear();
        const balance = await getLeaveBalance(pending.employee.code, year);
        if (balance) {
          const availKey = `${pending.leaveType}Avail`;
          if (balance[availKey] !== undefined && balance[availKey] < pending.days) {
            return { error: `Insufficient ${pending.leaveType.toUpperCase()} balance to approve. Available: ${balance[availKey]}` };
          }
        }
      }
    }

    const req = await prisma.leaveRequest.update({
      where: { id: requestId },
      data: {
        status: approve ? 'approved' : 'rejected',
        reviewedBy: session.username,
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
        const existing = await prisma.dailyLog.findUnique({
          where: { employeeId_monthYear_day: { employeeId: req.employeeId, monthYear, day } }
        });
        if (existing && existing.type === 'absent') {
          await prisma.dailyLog.update({
            where: { employeeId_monthYear_day: { employeeId: req.employeeId, monthYear, day } },
            data: { type: req.leaveType === 'rl' ? 'rl' : 'present', raw: req.leaveType.toUpperCase() }
          });
          await prisma.monthRecord.updateMany({
            where: { employeeId: req.employeeId, monthYear },
            data: { absent: { decrement: 1 }, present: { increment: 1 } }
          });
        }
      }
    }

    revalidatePath('/');
    return { request: req };
  } catch (e) {
    if (e.message === 'Authentication required' || e.message === 'Admin access required') return { error: e.message };
    console.error('[reviewLeaveRequest error]', e.message);
    return { error: 'Failed to review leave request.' };
  }
}

// ─── REGULARIZATION ──────────────────────────────────────────

export async function submitRegularization(employeeCode, { date, requestedIn, requestedOut, reason }) {
  try {
    const session = await requireAuth();
    if (session.role === 'employee' && session.employeeCode !== employeeCode) {
      return { error: 'Cannot submit regularization for another employee.' };
    }

    const emp = await prisma.employee.findUnique({ where: { code: employeeCode } });
    if (!emp) return { error: 'Employee not found' };

    const req = await prisma.regularizationRequest.create({
      data: {
        employeeId: emp.id,
        date: new Date(date),
        requestedIn: requestedIn || null,
        requestedOut: requestedOut || null,
        reason,
        status: 'pending'
      }
    });
    return { request: req };
  } catch (e) {
    if (e.message === 'Authentication required') return { error: e.message };
    console.error('[submitRegularization error]', e.message);
    return { error: 'Failed to submit regularization.' };
  }
}

export async function getRegularizations(employeeCode) {
  try {
    const session = await requireAuth();
    if (session.role === 'employee' && session.employeeCode !== employeeCode) return [];
    const emp = await prisma.employee.findUnique({ where: { code: employeeCode } });
    if (!emp) return [];
    return prisma.regularizationRequest.findMany({
      where: { employeeId: emp.id },
      orderBy: { createdAt: 'desc' }
    });
  } catch {
    return [];
  }
}

export async function getAllPendingRegularizations() {
  try {
    await requireAdmin();
    return prisma.regularizationRequest.findMany({
      where: { status: 'pending' },
      include: { employee: { select: { code: true, name: true } } },
      orderBy: { createdAt: 'asc' }
    });
  } catch {
    return [];
  }
}

export async function reviewRegularization(requestId, reviewedBy, approve) {
  try {
    const session = await requireAdmin();

    const req = await prisma.regularizationRequest.update({
      where: { id: requestId },
      data: {
        status: approve ? 'approved' : 'rejected',
        reviewedBy: session.username,
        reviewedAt: new Date()
      },
      include: { employee: true }
    });

    // Apply regularization: update the DailyLog with corrected times
    if (approve && req.employee) {
      const d = new Date(req.date);
      const monthYear = `${d.getMonth() + 1}_${d.getFullYear()}`;
      const day = d.getDate();
      const updateData = {};
      if (req.requestedIn) updateData.inT = req.requestedIn;
      if (req.requestedOut) updateData.outT = req.requestedOut;

      if (Object.keys(updateData).length > 0) {
        const existing = await prisma.dailyLog.findUnique({
          where: { employeeId_monthYear_day: { employeeId: req.employeeId, monthYear, day } }
        });
        if (existing) {
          // Recalculate late/short shift based on corrected times
          const inTime = updateData.inT || existing.inT;
          const outTime = updateData.outT || existing.outT;
          if (inTime) updateData.isLate = false;
          if (outTime) updateData.isSS = false;

          // If was absent but now has times, mark as present
          if (existing.type === 'absent' && (updateData.inT || updateData.outT)) {
            updateData.type = 'present';
            updateData.raw = `${inTime || ''}–${outTime || ''} (Reg)`;
            await prisma.monthRecord.updateMany({
              where: { employeeId: req.employeeId, monthYear },
              data: { absent: { decrement: 1 }, present: { increment: 1 } }
            });
          }

          await prisma.dailyLog.update({
            where: { employeeId_monthYear_day: { employeeId: req.employeeId, monthYear, day } },
            data: updateData
          });
        }
      }
    }

    revalidatePath('/');
    return { request: req };
  } catch (e) {
    if (e.message === 'Authentication required' || e.message === 'Admin access required') return { error: e.message };
    console.error('[reviewRegularization error]', e.message);
    return { error: 'Failed to review regularization.' };
  }
}
