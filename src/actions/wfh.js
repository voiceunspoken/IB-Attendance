"use server";

import { prisma } from '../lib/prisma';
import { revalidatePath } from 'next/cache';
import { logAction } from './audit';
import { requireAdmin, requireSuperAdmin } from '../lib/auth-guard';
import { createNotification, getAdminUserIds } from './notifications';

export async function submitWfhRequest(employeeCode, { date, reason }) {
  const user = await prisma.user.findUnique({
    where: { code: employeeCode },
    include: { managers: { include: { manager: true }, orderBy: { priority: 'asc' } } }
  });
  if (!user) return { error: 'Employee not found' };

  const wfhDate = new Date(date);
  wfhDate.setHours(0, 0, 0, 0);

  if (wfhDate < new Date(new Date().toDateString())) {
    return { error: 'Cannot apply for WFH on a past date.' };
  }

  const existing = await prisma.wfhRequest.findFirst({
    where: {
      userId: user.id,
      date: wfhDate,
      status: { not: 'rejected' }
    }
  });
  if (existing) return { error: 'You already have a WFH request for this date.' };

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

  const req = await prisma.wfhRequest.create({
    data: {
      userId: user.id,
      date: wfhDate,
      reason,
      approvalStage,
      currentApproverId,
      status: approvalStage === 'approved' ? 'approved' : 'pending'
    }
  });

  await logAction(employeeCode, 'wfh_submitted', 'wfh_request', req.id,
    `Submitted WFH request for ${wfhDate.toLocaleDateString('en-IN')}`);

  if (currentApproverId) {
    const approver = managers.find(m => m.managerUserId === currentApproverId);
    await logAction(approver?.manager?.code || 'unknown', 'wfh_pending', 'wfh_request', req.id,
      `WFH request from ${user.name} awaiting your approval`);
  }

  revalidatePath(`/employee/${employeeCode}`);

  const adminIds = await getAdminUserIds();
  await Promise.all(adminIds.map(id => createNotification(id, 'wfh_submitted',
    `New WFH Request`,
    `${user.name} requested WFH on ${wfhDate.toLocaleDateString('en-IN')}.`,
    { employeeCode, date, reason }
  )));

  if (approvalStage === 'approved') {
    await applyWfhToDailyLog(user.id, wfhDate);
  }

  return { request: { id: req.id, status: req.status, approvalStage: req.approvalStage } };
}

export async function getWfhRequests(employeeCode) {
  const user = await prisma.user.findUnique({ where: { code: employeeCode } });
  if (!user) return [];
  return prisma.wfhRequest.findMany({
    where: { userId: user.id },
    include: { user: { select: { code: true, name: true } } },
    orderBy: { createdAt: 'desc' }
  });
}

export async function getManagerWfhRequests(managerCode) {
  const mgr = await prisma.user.findUnique({ where: { code: managerCode } });
  if (!mgr) return [];
  return prisma.wfhRequest.findMany({
    where: {
      currentApproverId: mgr.id,
      status: 'pending',
      approvalStage: { in: ['pending_l2', 'pending_l1', 'pending_mgr'] }
    },
    include: { user: { select: { code: true, name: true, managers: { include: { manager: { select: { code: true, name: true } } }, orderBy: { priority: 'asc' } } } } },
    orderBy: { createdAt: 'asc' }
  });
}

export async function getWfhRequestsByStage(stage) {
  const where = stage === 'pending_super'
    ? { approvalStage: 'pending_super', status: 'pending' }
    : { approvalStage: stage, status: 'pending' };
  return prisma.wfhRequest.findMany({
    where,
    include: { user: { select: { code: true, name: true } } },
    orderBy: { createdAt: 'asc' }
  });
}

export async function getAllWfhRequests() {
  return prisma.wfhRequest.findMany({
    include: { user: { select: { code: true, name: true, managers: { include: { manager: { select: { code: true, name: true } } }, orderBy: { priority: 'asc' } } } } },
    orderBy: { createdAt: 'desc' },
    take: 200
  });
}

export async function reviewWfhRequest(requestId, reviewedBy, approve, note = '') {
  const req = await prisma.wfhRequest.findUnique({
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
      await logAction(nextMgr.manager.code, 'wfh_pending', 'wfh_request', req.id,
        `WFH request from ${req.user.name} awaiting your approval (approved by manager)`);
    } else if (requireSuper) {
      newStage = 'pending_super';
      newApproverId = null;
    } else {
      newStage = 'approved';
      newStatus = 'approved';
      newApproverId = null;
    }
  }

  const updated = await prisma.wfhRequest.update({
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

  if (newStatus === 'approved') {
    await applyWfhToDailyLog(req.userId, req.date);
  }

  await logAction(reviewedBy, newStatus === 'approved' ? 'wfh_approved' : 'wfh_rejected', 'wfh_request', req.id,
    `${newStatus === 'approved' ? 'Approved' : 'Rejected'} WFH request (stage: ${newStage})`);

  if (newStatus === 'approved' && newStage === 'approved') {
    await createNotification(req.userId, 'wfh_approved',
      `WFH Approved`,
      `Your WFH request for ${req.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} has been approved.`,
      { requestId: req.id, date: req.date.toISOString() });
  } else if (newStatus === 'rejected') {
    await createNotification(req.userId, 'wfh_rejected',
      `WFH Rejected`,
      `Your WFH request for ${req.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} has been rejected.${note ? ' Note: ' + note : ''}`,
      { requestId: req.id, date: req.date.toISOString(), note });
  }

  if (newStage === 'pending_super') {
    const adminIds = await getAdminUserIds();
    await Promise.all(adminIds.map(id => createNotification(id, 'wfh_pending_super',
      `WFH Pending Your Approval`,
      `${req.user.name}'s WFH request needs your approval.`,
      { requestId: req.id, employeeCode: req.user.code, date: req.date.toISOString() })));
  } else if (newApproverId) {
    await createNotification(newApproverId, 'wfh_pending',
      `WFH Pending Your Approval`,
      `${req.user.name}'s WFH request needs your approval.`,
      { requestId: req.id, employeeCode: req.user.code, date: req.date.toISOString() });
  }

  revalidatePath('/');
  return { request: updated };
}

async function applyWfhToDailyLog(userId, date) {
  const monthYear = `${date.getMonth() + 1}_${date.getFullYear()}`;
  const day = date.getDate();

  const existing = await prisma.dailyLog.findUnique({
    where: { userId_monthYear_day: { userId, monthYear, day } }
  });

  if (existing && existing.type !== 'absent') return;

  await prisma.dailyLog.upsert({
    where: { userId_monthYear_day: { userId, monthYear, day } },
    update: { type: 'wfh', raw: 'WFH' },
    create: { userId, monthYear, day, type: 'wfh', raw: 'WFH' },
  });

  await updateMonthRecordCounts(userId, monthYear);
}

async function updateMonthRecordCounts(userId, monthYear) {
  const logs = await prisma.dailyLog.findMany({ where: { userId, monthYear } });
  let present = 0, absent = 0, halfDay = 0, wfh = 0, maxDay = 0;
  for (const log of logs) {
    maxDay = Math.max(maxDay, log.day);
    if (log.type === 'absent') absent++;
    else if (log.type === 'half') halfDay++;
    else if (log.type === 'wfh') wfh++;
    else if (log.type === 'present') present++;
  }
  await prisma.monthRecord.upsert({
    where: { userId_monthYear: { userId, monthYear } },
    update: { present: present + wfh, absent, halfDay, numDays: maxDay },
    create: { userId, monthYear, present: present + wfh, absent, halfDay, numDays: maxDay },
  });
}
