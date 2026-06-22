"use server";

import { prisma } from '../lib/prisma';
import { revalidatePath } from 'next/cache';
import { logAction } from './audit';
import { requireAdmin, requireSuperAdmin } from '../lib/auth-guard';
import { createNotification, getAdminUserIds, sendLeaveStatusNotification } from './notifications';

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

export async function getLeaveBalance(employeeCode, year) {
  const user = await prisma.user.findUnique({ where: { code: employeeCode } });
  if (!user) return null;

  let balance = await prisma.leaveBalance.findUnique({
    where: { userId_year: { userId: user.id, year } }
  });

  if (!balance) {
    const policy = await prisma.leavePolicy.findUnique({ where: { year } });
    balance = await prisma.leaveBalance.create({
      data: {
        userId: user.id,
        year,
        clTotal: policy?.cl ?? 12,
        slTotal: policy?.sl ?? 6,
        elTotal: policy?.el ?? 4,
        rlTotal: policy?.rl ?? 2,
        shTotal: policy?.sh ?? 6,
      }
    });
  }

  const approved = await prisma.leaveRequest.findMany({
    where: {
      userId: user.id,
      status: 'approved',
      fromDate: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) }
    }
  });

  const used = { cl: 0, sl: 0, el: 0, rl: 0, sh: 0 };
  approved.forEach(r => { used[r.leaveType] = (used[r.leaveType] || 0) + r.days; });

  const leaveTypes = ['cl', 'sl', 'el', 'rl', 'sh'];
  const dailyLeaveLogs = await prisma.dailyLog.findMany({
    where: {
      userId: user.id,
      type: { in: leaveTypes },
      monthYear: { contains: `_${year}` }
    }
  });
  dailyLeaveLogs.forEach(log => {
    if (used[log.type] !== undefined) used[log.type] += 1;
  });

  const records = await prisma.monthRecord.findMany({
    where: { userId: user.id, monthYear: { contains: `_${year}` } }
  });
  const attendanceRL = records.reduce((s, r) => s + r.rl, 0);

  const now = new Date();
  const isPastYear = year < now.getFullYear();
  const refMonth = isPastYear ? 12 : now.getMonth() + 1;
  const refQuarter = isPastYear ? 4 : Math.ceil(refMonth / 3);
  const clAccrued = Math.min(refMonth, balance.clTotal);
  const elAccrued = Math.min(refQuarter, balance.elTotal || 4);

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
    shTotal: balance.shTotal,
    shUsed: used.sh,
    shAvail: balance.shTotal - used.sh,
  };
}

export async function getAllLeaveBalances(year) {
  const users = await prisma.user.findMany({
    where: { code: { not: null } },
    select: { id: true, code: true, name: true }
  });

  const balances = await Promise.all(
    users.map(u => getLeaveBalance(u.code, year))
  );

  return users.map((u, i) => ({ ...u, balance: balances[i] }));
}

export async function getLeaveBalancesForExport(year, fromMonth = 1, toMonth = 12) {
  const users = await prisma.user.findMany({
    where: { code: { not: null } },
    select: { id: true, code: true, name: true },
    orderBy: { name: 'asc' }
  });

  const fromDate = new Date(`${year}-${String(fromMonth).padStart(2, '0')}-01`);
  const toDate = new Date(year, toMonth, 0);

  const results = await Promise.all(
    users.map(async (u) => {
      const balance = await getLeaveBalance(u.code, year);

      const approved = await prisma.leaveRequest.findMany({
        where: {
          userId: u.id,
          status: 'approved',
          fromDate: { gte: fromDate, lte: toDate }
        },
        orderBy: { fromDate: 'asc' }
      });

      const rangeUsed = { cl: 0, sl: 0, el: 0, rl: 0, sh: 0 };
      approved.forEach(r => {
        rangeUsed[r.leaveType] = (rangeUsed[r.leaveType] || 0) + Number(r.days);
      });

      const leaveDetail = approved.map(r =>
        `${r.leaveType.toUpperCase()} ${r.days}d (${new Date(r.fromDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}${r.fromDate.toDateString() !== r.toDate.toDateString() ? '–' + new Date(r.toDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''})`
      ).join('; ') || '—';

      return {
        code: u.code,
        name: u.name,
        balance,
        rangeUsed,
        leaveDetail,
      };
    })
  );

  return results;
}

export async function adminUpdateLeaveBalance(employeeCode, year, fields) {
  const user = await prisma.user.findUnique({ where: { code: employeeCode } });
  if (!user) return { error: 'Employee not found' };

  await prisma.leaveBalance.upsert({
    where: { userId_year: { userId: user.id, year } },
    update: fields,
    create: { userId: user.id, year, ...fields }
  });
  return { success: true };
}

function detectSandwich(from, to) {
  let sandwich = false;
  let sandwichDays = 0;
  const startDow = from.getDay();
  const endDow = to.getDay();
  if (startDow === 5 && (endDow === 1 || endDow === 0 || endDow === 6)) {
    sandwich = true;
    const diffDays = Math.round((to - from) / (1000 * 60 * 60 * 24)) + 1;
    sandwichDays = diffDays >= 4 ? diffDays : 4;
  }
  return { sandwich, sandwichDays };
}

function daysBetween(from, to) {
  return Math.round((to - from) / (1000 * 60 * 60 * 24)) + 1;
}

export async function submitLeaveRequest(employeeCode, { leaveType, fromDate, toDate, days, reason, prescriptionFile, shiftSlot }) {
  const user = await prisma.user.findUnique({
    where: { code: employeeCode },
    include: { managers: { include: { manager: true }, orderBy: { priority: 'asc' } } }
  });
  if (!user) return { error: 'Employee not found' };

  const from = new Date(fromDate);
  const to = new Date(toDate);

  from.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (from < today) return { error: 'Leave cannot be applied for a past date.' };

  if (leaveType === 'rl') {
    const monthStart = new Date(from.getFullYear(), from.getMonth(), 1);
    const monthEnd = new Date(from.getFullYear(), from.getMonth() + 1, 0);
    const existingRL = await prisma.leaveRequest.findFirst({
      where: {
        userId: user.id,
        leaveType: 'rl',
        status: { not: 'rejected' },
        fromDate: { gte: monthStart, lte: monthEnd }
      }
    });
    if (existingRL) return { error: 'You can only take 1 Restricted Leave per month.' };
  }

  if (leaveType === 'sl' && !prescriptionFile) {
    return { error: 'Prescription is mandatory for Sick Leave. Please upload a prescription.' };
  }

  if (leaveType === 'sh') {
    if (!shiftSlot) return { error: 'Please select a shift slot (10-12 or 5-7).' };
    if (!['10-12', '5-7'].includes(shiftSlot)) return { error: 'Invalid shift slot.' };
    if (fromDate !== toDate) return { error: 'Short Leave can only be taken for a single day.' };
    days = 0.5;

    const bal = await getLeaveBalance(employeeCode, from.getFullYear());
    if (bal.shAvail <= 0) return { error: 'No Short Leave balance remaining for this year.' };

    const window = Math.ceil(from.getMonth() / 2);
    const windowStart = (window - 1) * 2 + 1;
    const windowEnd = window * 2;
    const windowStartDate = new Date(from.getFullYear(), windowStart - 1, 1);
    const windowEndDate = new Date(from.getFullYear(), windowEnd, 0);
    const existingSH = await prisma.leaveRequest.findFirst({
      where: {
        userId: user.id,
        leaveType: 'sh',
        status: { not: 'rejected' },
        fromDate: { gte: windowStartDate, lte: windowEndDate }
      }
    });
    if (existingSH) return { error: 'You can only take 1 Short Leave per 2-month window. Your next window opens after ' + (windowEnd % 12 + 1) + '/' + from.getFullYear() + '.' };
  }

  let computedDays = days;
  let sandwichCount = 0;
  let sandwichMessage = '';
  const { sandwich, sandwichDays } = detectSandwich(from, to);
  if (sandwich) {
    const balance = await prisma.leaveBalance.findUnique({
      where: { userId_year: { userId: user.id, year: from.getFullYear() } }
    });
    const usedSoFar = balance?.sandwichUsed ?? 0;
    const totalDays = Math.max(sandwichDays, daysBetween(from, to));
    if (usedSoFar === 0) {
      computedDays = 2;
      sandwichCount = 1;
      sandwichMessage = 'This is your 1st sandwich leave — only 2 days (Fri + Mon) will be deducted.';
    } else {
      computedDays = totalDays >= 4 ? totalDays : 4;
      sandwichCount = usedSoFar + 1;
      sandwichMessage = `This is your ${sandwichCount} sandwich leave — all ${Math.round(computedDays)} days will be deducted.`;
    }
  }

  const config = await prisma.superAdminConfig.findFirst();
  const requireSuper = config?.requireSuperApproval ?? true;

  const managers = user.managers;
  let approvalStage = 'pending_mgr';
  let currentApproverId = null;

  if (managers.length > 0) {
    currentApproverId = managers[0].managerUserId;
  } else if (requireSuper) {
    approvalStage = 'pending_super';
  } else {
    approvalStage = 'approved';
  }

  const req = await prisma.leaveRequest.create({
    data: {
      userId: user.id,
      leaveType,
      fromDate: from,
      toDate: to,
      days: computedDays,
      reason,
      prescriptionFile: prescriptionFile || null,
      shiftSlot: shiftSlot || null,
      approvalStage,
      currentApproverId,
      sandwichCount,
      status: approvalStage === 'approved' ? 'approved' : 'pending'
    }
  });

  await logAction(employeeCode, 'leave_submitted', 'leave_request', req.id,
    `Submitted ${leaveType.toUpperCase()} leave (${computedDays}d)`);

  if (currentApproverId) {
    const approver = managers.find(m => m.managerUserId === currentApproverId);
    await logAction(approver?.manager?.code || 'unknown', 'leave_mgr_pending', 'leave_request', req.id,
      `Leave request from ${user.name} awaiting your approval`);
  }

  revalidatePath(`/employee/${employeeCode}`);
  
  const adminIds = await getAdminUserIds();
  await Promise.all(adminIds.map(id => createNotification(id, 'leave_submitted',
    `New Leave Request`,
    `${user.name} submitted ${leaveType.toUpperCase()} leave for ${computedDays} day(s).`,
    { employeeCode, leaveType, fromDate, toDate, days: computedDays, reason }
  )));
  
  return { request: req, sandwichMessage };
}

export async function getLeaveRequests(employeeCode) {
  const user = await prisma.user.findUnique({ where: { code: employeeCode } });
  if (!user) return [];
  return prisma.leaveRequest.findMany({
    where: { userId: user.id },
    include: { user: { select: { code: true, name: true } } },
    orderBy: { createdAt: 'desc' }
  });
}

export async function getManagerLeaveRequests(managerCode) {
  const mgr = await prisma.user.findUnique({ where: { code: managerCode } });
  if (!mgr) return [];
  return prisma.leaveRequest.findMany({
    where: {
      currentApproverId: mgr.id,
      status: 'pending',
      approvalStage: { in: ['pending_l2', 'pending_l1', 'pending_mgr'] }
    },
    include: { user: { select: { code: true, name: true, managers: { include: { manager: { select: { code: true, name: true } } }, orderBy: { priority: 'asc' } } } } },
    orderBy: { createdAt: 'asc' }
  });
}

export async function getLeaveRequestsByStage(stage) {
  const where = stage === 'pending_super'
    ? { approvalStage: 'pending_super', status: 'pending' }
    : { approvalStage: stage, status: 'pending' };
  return prisma.leaveRequest.findMany({
    where,
    include: { user: { select: { code: true, name: true } } },
    orderBy: { createdAt: 'asc' }
  });
}

export async function getAllLeaveRequests() {
  return prisma.leaveRequest.findMany({
    include: { user: { select: { code: true, name: true, managers: { include: { manager: { select: { code: true, name: true } } }, orderBy: { priority: 'asc' } } } } },
    orderBy: { createdAt: 'desc' },
    take: 200
  });
}

export async function reviewLeaveRequest(requestId, reviewedBy, approve, note = '') {
  const req = await prisma.leaveRequest.findUnique({
    where: { id: requestId },
    include: { user: { include: { managers: { include: { manager: true }, orderBy: { priority: 'asc' } } } } }
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
  } else if (req.approvalStage === 'pending_super') {
    newStage = 'approved';
    newStatus = 'approved';
    newApproverId = null;
  } else {
    const managers = req.user.managers;
    const currentIdx = managers.findIndex(m => m.managerUserId === req.currentApproverId);
    if (currentIdx >= 0 && currentIdx < managers.length - 1) {
      const nextMgr = managers[currentIdx + 1];
      newStage = 'pending_mgr';
      newApproverId = nextMgr.managerUserId;
      await logAction(nextMgr.manager.code, 'leave_mgr_pending', 'leave_request', req.id,
        `Leave request from ${req.user.name} awaiting your approval (approved by manager)`);
    } else if (requireSuper) {
      newStage = 'pending_super';
      newApproverId = null;
    } else {
      newStage = 'approved';
      newStatus = 'approved';
      newApproverId = null;
    }
  }

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
    include: { user: true }
  });

  if (newStatus === 'approved' && req.sandwichCount > 0) {
    await prisma.leaveBalance.updateMany({
      where: { userId: req.userId, year: req.fromDate.getFullYear() },
      data: { sandwichUsed: { increment: 1 } }
    });
  }

  if (newStatus === 'approved') {
    const from = new Date(req.fromDate);
    const to = new Date(req.toDate);
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      const monthYear = `${d.getMonth() + 1}_${d.getFullYear()}`;
      const day = d.getDate();
      const existing = await prisma.dailyLog.findUnique({
        where: { userId_monthYear_day: { userId: req.userId, monthYear, day } }
      });
      if (existing && existing.type === 'absent') {
        const updateData = { type: req.leaveType === 'rl' ? 'rl' : 'present', raw: req.leaveType.toUpperCase() };
        if (req.leaveType === 'sh' && req.shiftSlot) {
          if (req.shiftSlot === '10-12') {
            updateData.inT = 600;
            updateData.outT = 720;
          } else if (req.shiftSlot === '5-7') {
            updateData.inT = 1020;
            updateData.outT = 1140;
          }
        }
        await prisma.dailyLog.update({
          where: { userId_monthYear_day: { userId: req.userId, monthYear, day } },
          data: updateData
        });
        await prisma.monthRecord.updateMany({
          where: { userId: req.userId, monthYear },
          data: { absent: { decrement: 1 }, present: { increment: 1 } }
        });
      }
    }
  }

  await logAction(reviewedBy, newStatus === 'approved' ? 'leave_approved' : 'leave_rejected', 'leave_request', req.id,
    `${newStatus === 'approved' ? 'Approved' : 'Rejected'} ${req.leaveType.toUpperCase()} leave (stage: ${newStage})`);

  const leaveTypeLabel = req.leaveType.toUpperCase();

  if (newStatus === 'approved' && newStage === 'approved') {
    await createNotification(req.userId, 'leave_approved',
      `Leave Approved`,
      `Your ${leaveTypeLabel} request for ${req.days} day(s) has been fully approved.`,
      { requestId: req.id, leaveType: req.leaveType, days: req.days });
    await sendLeaveStatusNotification(req.user.code, req.user.name, req.leaveType, 'approved', note);
  } else if (newStatus === 'rejected') {
    await createNotification(req.userId, 'leave_rejected',
      `Leave Rejected`,
      `Your ${leaveTypeLabel} request for ${req.days} day(s) has been rejected.${note ? ' Note: ' + note : ''}`,
      { requestId: req.id, leaveType: req.leaveType, days: req.days, note });
    await sendLeaveStatusNotification(req.user.code, req.user.name, req.leaveType, 'rejected', note);
  }

  if (newStage === 'pending_super') {
    const adminIds = await getAdminUserIds();
    await Promise.all(adminIds.map(id => createNotification(id, 'leave_pending_super',
      `Leave Pending Your Approval`,
      `${req.user.name}'s ${leaveTypeLabel} request needs your approval.`,
      { requestId: req.id, employeeCode: req.user.code, leaveType: req.leaveType, days: req.days })));
  } else if (newApproverId) {
    await createNotification(newApproverId, 'leave_mgr_pending',
      `Leave Pending Your Approval`,
      `${req.user.name}'s ${leaveTypeLabel} request needs your approval.`,
      { requestId: req.id, employeeCode: req.user.code, leaveType: req.leaveType, days: req.days });
  }

  revalidatePath('/');
  return { request: updated };
}

export async function submitRegularization(employeeCode, { date, requestedIn, requestedOut, reason, type }) {
  const user = await prisma.user.findUnique({ where: { code: employeeCode } });
  if (!user) return { error: 'Employee not found' };

  const req = await prisma.regularizationRequest.create({
    data: {
      userId: user.id,
      date: new Date(date),
      type: type || 'missing_punch',
      requestedIn: requestedIn || null,
      requestedOut: requestedOut || null,
      reason,
      status: 'pending',
      superStatus: 'pending'
    }
  });

  const adminIds = await getAdminUserIds();
  await Promise.all(adminIds.map(id => createNotification(id, 'regularization_submitted',
    `New Regularization`,
    `${user.name} submitted a regularization for ${date}.`,
    { employeeCode, date, requestedIn, requestedOut, reason })));

  return { request: req };
}

export async function getRegularizations(employeeCode) {
  const user = await prisma.user.findUnique({ where: { code: employeeCode } });
  if (!user) return [];
  return prisma.regularizationRequest.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' }
  });
}

export async function getAllPendingRegularizations() {
  return prisma.regularizationRequest.findMany({
    where: { status: 'pending' },
    include: { user: { select: { code: true, name: true } } },
    orderBy: { createdAt: 'asc' }
  });
}

export async function reviewRegularization(requestId, reviewedBy, approve, note = '') {
  const auth = await requireAdmin(reviewedBy);
  if (auth) return auth;
  const req = await prisma.regularizationRequest.update({
    where: { id: requestId },
    data: {
      status: approve ? 'approved' : 'rejected',
      reviewedBy,
      reviewedAt: new Date(),
      reviewNote: note || null
    }
  });

  const notifType = approve ? 'regularization_approved' : 'regularization_rejected';
  const notifTitle = approve ? 'Regularization Approved' : 'Regularization Rejected';
  await createNotification(req.userId, notifType, notifTitle,
    `Your regularization for ${new Date(req.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} has been ${approve ? 'approved' : 'rejected'}.${note ? ' Note: ' + note : ''}`,
    { requestId: req.id, date: req.date, requestedIn: req.requestedIn, requestedOut: req.requestedOut, note });

  if (approve) {
    const adminIds = await getAdminUserIds();
    await Promise.all(adminIds.map(id => createNotification(id, 'regularization_pending_super',
      `Regularization Pending Final Approval`,
      `A regularization is awaiting super admin final approval.`,
      { requestId: req.id })));
  }

  return { request: req };
}

export async function getPendingSuperRegularizations() {
  return prisma.regularizationRequest.findMany({
    where: { status: 'approved', superStatus: 'pending' },
    include: { user: { select: { code: true, name: true } } },
    orderBy: { createdAt: 'asc' }
  });
}

export async function reviewRegularizationSuper(requestId, superReviewedBy, approve) {
  const auth = await requireSuperAdmin(superReviewedBy);
  if (auth) return auth;
  const req = await prisma.regularizationRequest.update({
    where: { id: requestId },
    data: {
      superStatus: approve ? 'approved' : 'rejected',
      superReviewedBy,
      superReviewedAt: new Date()
    }
  });

  if (approve && req.status === 'approved') {
    const date = new Date(req.date);
    const monthYear = `${date.getMonth() + 1}_${date.getFullYear()}`;
    const day = date.getDate();

    const existing = await prisma.dailyLog.findUnique({
      where: { userId_monthYear_day: { userId: req.userId, monthYear, day } }
    });

    if (existing && (existing.type === 'absent' || !existing.inT)) {
      const inT = req.requestedIn ? parseTime(req.requestedIn) : existing.inT;
      const outT = req.requestedOut ? parseTime(req.requestedOut) : existing.outT;
      await prisma.dailyLog.update({
        where: { userId_monthYear_day: { userId: req.userId, monthYear, day } },
        data: { type: 'present', inT, outT }
      });
    }
  }

  const notifType = approve ? 'regularization_approved' : 'regularization_rejected';
  const notifTitle = approve ? 'Regularization Fully Approved' : 'Regularization Rejected';
  await createNotification(req.userId, notifType, notifTitle,
    `Your regularization for ${new Date(req.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} has been ${approve ? 'fully approved' : 'rejected'} by super admin.`,
    { requestId: req.id, date: req.date });

  const reqUser = await prisma.user.findUnique({ where: { id: req.userId } });
  if (reqUser) {
    await sendLeaveStatusNotification(reqUser.code, reqUser.name, 'regularization', approve ? 'approved' : 'rejected', '');
  }

  return { request: req };
}

export async function getAllRegularizations() {
  return prisma.regularizationRequest.findMany({
    include: { user: { select: { code: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200
  });
}

export async function requestLeaveDeduction(employeeCode, leaveType, days, reason, requestedBy) {
  const auth = await requireAdmin(requestedBy);
  if (auth) return auth;

  const user = await prisma.user.findUnique({ where: { code: employeeCode } });
  if (!user) return { error: 'Employee not found' };

  const year = new Date().getFullYear();
  const balance = await prisma.leaveBalance.findUnique({
    where: { userId_year: { userId: user.id, year } }
  });
  if (balance) {
    const totalKey = leaveType + 'Total';
    const usedKey = leaveType + 'Used';
    const total = balance[totalKey] || 0;
    const currentUsed = balance[usedKey] || 0;
    if (currentUsed + days > total) {
      return { error: `${leaveType.toUpperCase()} balance insufficient (${currentUsed}/${total} used, need ${days} more).` };
    }
  }

  const payload = JSON.stringify({ employeeCode, employeeName: user.name, leaveType, days, reason });
  const change = await prisma.pendingChange.create({
    data: { requestedBy, action: 'leave_deduction', payload, status: 'pending' }
  });

  const adminIds = await getAdminUserIds();
  await Promise.all(adminIds.map(id => createNotification(id, 'leave_deduction_submitted',
    `Leave Deduction Request`,
    `${user.name} requested ${days} ${leaveType.toUpperCase()} deduction.`,
    { employeeCode, leaveType, days, reason, changeId: change.id })));

  return { success: true, change };
}

export async function reviewLeaveDeduction(changeId, reviewedBy, approve) {
  const auth = await requireSuperAdmin(reviewedBy);
  if (auth) return auth;

  const change = await prisma.pendingChange.findUnique({ where: { id: changeId } });
  if (!change) return { error: 'Change not found' };

  const payload = JSON.parse(change.payload);

  if (approve) {
    const user = await prisma.user.findUnique({ where: { code: payload.employeeCode } });
    if (user) {
      const year = new Date().getFullYear();
      const usedKey = payload.leaveType + 'Used';
      await prisma.leaveBalance.upsert({
        where: { userId_year: { userId: user.id, year } },
        update: { [usedKey]: { increment: payload.days } },
        create: { userId: user.id, year, [usedKey]: payload.days }
      });
    }
  }

  await prisma.pendingChange.update({
    where: { id: changeId },
    data: { status: approve ? 'approved' : 'rejected', reviewedBy, reviewedAt: new Date() }
  });

  const empUser = await prisma.user.findUnique({ where: { code: payload.employeeCode } });
  if (empUser) {
    await createNotification(empUser.id,
      approve ? 'leave_deduction_approved' : 'leave_deduction_rejected',
      approve ? 'Leave Deduction Approved' : 'Leave Deduction Rejected',
      approve
        ? `${payload.days} ${payload.leaveType.toUpperCase()} day(s) deducted from your balance.`
        : `Your ${payload.leaveType.toUpperCase()} deduction request was rejected.`,
      { ...payload });
  }

  return { success: true };
}

function parseTime(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}
