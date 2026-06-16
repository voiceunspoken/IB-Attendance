"use server";

import { prisma } from '../lib/prisma';
import { revalidatePath } from 'next/cache';
import { logAction } from './audit';

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

  // RL from attendance records
  const records = await prisma.monthRecord.findMany({
    where: { employeeId: emp.id, monthYear: { contains: `_${year}` } }
  });
  const attendanceRL = records.reduce((s, r) => s + r.rl, 0);

  // Accrual: CL = 1/month, EL = 1/quarter
  const now = new Date();
  const isPastYear = year < now.getFullYear();
  const refMonth = isPastYear ? 12 : now.getMonth() + 1;
  const refQuarter = isPastYear ? 4 : Math.ceil(refMonth / 3);
  const clAccrued = Math.min(refMonth, balance.clTotal);
  const elAccrued = Math.min(refQuarter, balance.elTotal || 4);

  // Persist accrual counts for display
  await prisma.leaveBalance.update({
    where: { id: balance.id },
    data: { clAccrued, elAccrued }
  });

  return {
    ...balance,
    clAccrued, elAccrued,
    clUsed: used.cl,
    slUsed: used.sl,
    elUsed: used.el,
    rlUsed: Math.max(used.rl, attendanceRL),
    clAvail: clAccrued - used.cl,
    slAvail: balance.slTotal - used.sl,
    elAvail: elAccrued - used.el,
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

// Detect if leave spans Friday–Monday (sandwich)
function detectSandwich(from, to) {
  let sandwich = false;
  let sandwichDays = 0;
  const startDow = from.getDay();
  const endDow = to.getDay();
  // Friday(5) → Monday(1) or Friday(5) → Saturday(6) → Sunday(0) → Monday(1)
  if (startDow === 5 && (endDow === 1 || endDow === 0 || endDow === 6)) {
    sandwich = true;
    // Count Fri, Sat, Sun, Mon
    const diffDays = Math.round((to - from) / (1000 * 60 * 60 * 24)) + 1;
    sandwichDays = diffDays >= 4 ? diffDays : 4;
  }
  return { sandwich, sandwichDays };
}

function daysBetween(from, to) {
  return Math.round((to - from) / (1000 * 60 * 60 * 24)) + 1;
}

export async function submitLeaveRequest(employeeCode, { leaveType, fromDate, toDate, days, reason, prescriptionFile }) {
  const emp = await prisma.employee.findUnique({
    where: { code: employeeCode },
    include: { managers: { include: { manager: true }, orderBy: { priority: 'asc' } } }
  });
  if (!emp) return { error: 'Employee not found' };

  const from = new Date(fromDate);
  const to = new Date(toDate);

  // ── RL: enforce max 1/month ──
  if (leaveType === 'rl') {
    const monthStart = new Date(from.getFullYear(), from.getMonth(), 1);
    const monthEnd = new Date(from.getFullYear(), from.getMonth() + 1, 0);
    const existingRL = await prisma.leaveRequest.findFirst({
      where: {
        employeeId: emp.id,
        leaveType: 'rl',
        status: { not: 'rejected' },
        fromDate: { gte: monthStart, lte: monthEnd }
      }
    });
    if (existingRL) return { error: 'You can only take 1 Restricted Leave per month.' };
  }

  // ── SL: prescription required ──
  if (leaveType === 'sl' && !prescriptionFile) {
    return { error: 'Prescription is mandatory for Sick Leave. Please upload a prescription.' };
  }

  // ── Sandwich detection ──
  let computedDays = days;
  let sandwichCount = 0;
  let sandwichMessage = '';
  const { sandwich, sandwichDays } = detectSandwich(from, to);
  if (sandwich) {
    const balance = await prisma.leaveBalance.findUnique({
      where: { employeeId_year: { employeeId: emp.id, year: from.getFullYear() } }
    });
    const usedSoFar = balance?.sandwichUsed ?? 0;
    const totalDays = Math.max(sandwichDays, daysBetween(from, to));
    if (usedSoFar === 0) {
      // 1st sandwich: only Fri+Mon counted (2 days), weekend free
      computedDays = 2;
      sandwichCount = 1;
      sandwichMessage = 'This is your 1st sandwich leave — only 2 days (Fri + Mon) will be deducted.';
    } else {
      // Subsequent: all 4 days counted
      computedDays = totalDays >= 4 ? totalDays : 4;
      sandwichCount = usedSoFar + 1;
      sandwichMessage = `This is your ${sandwichCount} sandwich leave — all ${Math.round(computedDays)} days will be deducted.`;
    }
  }

  // ── Determine approval stage ──
  const config = await prisma.superAdminConfig.findFirst();
  const requireSuper = config?.requireSuperApproval ?? true;

  const managers = emp.managers;
  let approvalStage = 'pending_l2';
  let currentApproverId = null;

  if (managers.length > 0) {
    currentApproverId = managers[0].managerEmployeeId; // L2 (junior)
  } else if (requireSuper) {
    // No managers — skip to super admin if required
    approvalStage = 'pending_super';
  } else {
    approvalStage = 'approved';
  }

  const req = await prisma.leaveRequest.create({
    data: {
      employeeId: emp.id,
      leaveType,
      fromDate: from,
      toDate: to,
      days: computedDays,
      reason,
      prescriptionFile: prescriptionFile || null,
      approvalStage,
      currentApproverId,
      sandwichCount,
      status: approvalStage === 'approved' ? 'approved' : 'pending'
    }
  });

  // Log notifications
  await logAction(employeeCode, 'leave_submitted', 'leave_request', req.id,
    `Submitted ${leaveType.toUpperCase()} leave (${computedDays}d)`);

  if (currentApproverId) {
    const approver = managers.find(m => m.managerEmployeeId === currentApproverId);
    await logAction(approver?.manager?.code || 'unknown', 'leave_l2_pending', 'leave_request', req.id,
      `Leave request from ${emp.name} awaiting your approval`);
  }

  revalidatePath(`/employee/${employeeCode}`);
  return { request: req, sandwichMessage };
}

export async function getLeaveRequests(employeeCode) {
  const emp = await prisma.employee.findUnique({ where: { code: employeeCode } });
  if (!emp) return [];
  return prisma.leaveRequest.findMany({
    where: { employeeId: emp.id },
    include: { employee: { select: { code: true, name: true } } },
    orderBy: { createdAt: 'desc' }
  });
}

// Get requests where a manager is the current approver
export async function getManagerLeaveRequests(managerCode) {
  const mgr = await prisma.employee.findUnique({ where: { code: managerCode } });
  if (!mgr) return [];
  return prisma.leaveRequest.findMany({
    where: {
      currentApproverId: mgr.id,
      status: 'pending',
      approvalStage: { in: ['pending_l2', 'pending_l1'] }
    },
    include: { employee: { select: { code: true, name: true } } },
    orderBy: { createdAt: 'asc' }
  });
}

// Get requests at a specific stage (for admin overview, super admin)
export async function getLeaveRequestsByStage(stage) {
  const where = stage === 'pending_super'
    ? { approvalStage: 'pending_super', status: 'pending' }
    : { approvalStage: stage, status: 'pending' };
  return prisma.leaveRequest.findMany({
    where,
    include: { employee: { select: { code: true, name: true } } },
    orderBy: { createdAt: 'asc' }
  });
}

export async function getAllLeaveRequests() {
  return prisma.leaveRequest.findMany({
    include: { employee: { select: { code: true, name: true, managers: { include: { manager: { select: { code: true, name: true } } }, orderBy: { priority: 'asc' } } } } },
    orderBy: { createdAt: 'desc' },
    take: 200
  });
}

// Multi-level approval review
export async function reviewLeaveRequest(requestId, reviewedBy, approve, note = '') {
  const req = await prisma.leaveRequest.findUnique({
    where: { id: requestId },
    include: { employee: { include: { managers: { include: { manager: true }, orderBy: { priority: 'asc' } } } } }
  });
  if (!req) return { error: 'Request not found' };

  const config = await prisma.superAdminConfig.findFirst();
  const requireSuper = config?.requireSuperApproval ?? true;

  let newStatus = req.status;
  let newStage = req.approvalStage;
  let newApproverId = req.currentApproverId;

  if (!approve) {
    newStatus = 'rejected';
    newStage = 'rejected';
    newApproverId = null;
  } else {
    // Advance to next stage
    if (req.approvalStage === 'pending_l2') {
      // L2 approved → move to L1
      const managers = req.employee.managers;
      const l1Manager = managers.length > 1 ? managers[1]?.manager : managers[0]?.manager;
      if (l1Manager) {
        newStage = 'pending_l1';
        newApproverId = l1Manager.id;
        await logAction(l1Manager.code, 'leave_l1_pending', 'leave_request', req.id,
          `Leave request from ${req.employee.name} awaiting your approval (approved by L2)`);
      } else if (requireSuper) {
        newStage = 'pending_super';
        newApproverId = null;
      } else {
        newStage = 'approved';
        newStatus = 'approved';
        newApproverId = null;
      }
    } else if (req.approvalStage === 'pending_l1') {
      // L1 approved → move to super admin or approve
      if (requireSuper) {
        newStage = 'pending_super';
        newApproverId = null;
      } else {
        newStage = 'approved';
        newStatus = 'approved';
        newApproverId = null;
      }
    } else if (req.approvalStage === 'pending_super') {
      // Super admin approved → final
      newStage = 'approved';
      newStatus = 'approved';
      newApproverId = null;
    }
  }

  // Update the request
  const updated = await prisma.leaveRequest.update({
    where: { id: requestId },
    data: {
      status: newStatus,
      approvalStage: newStage,
      currentApproverId: newApproverId,
      reviewedBy,
      reviewedAt: new Date(),
      reviewNote: note || null
    },
    include: { employee: true }
  });

  // Update sandwichUsed on full approval
  if (newStatus === 'approved' && req.sandwichCount > 0) {
    await prisma.leaveBalance.updateMany({
      where: { employeeId: req.employeeId, year: req.fromDate.getFullYear() },
      data: { sandwichUsed: { increment: 1 } }
    });
  }

  // Update DailyLog on full approval
  if (newStatus === 'approved') {
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

  await logAction(reviewedBy, newStatus === 'approved' ? 'leave_approved' : 'leave_rejected', 'leave_request', req.id,
    `${newStatus === 'approved' ? 'Approved' : 'Rejected'} ${req.leaveType.toUpperCase()} leave (stage: ${newStage})`);

  revalidatePath('/');
  return { request: updated };
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
