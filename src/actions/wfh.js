"use server";

import { prisma } from '../lib/prisma';
import { revalidatePath } from 'next/cache';
import { logAction } from './audit';
import { createNotification, getAdminUserIds, getSuperAdminUserIds, sendWfhPendingNotification } from './notifications';

export async function submitWfhRequest(employeeCode, { date, reason, workType = 'wfh' }) {
  const user = await prisma.user.findUnique({
    where: { code: employeeCode },
    include: { managers: { include: { manager: true }, orderBy: { priority: 'asc' } } }
  });
  if (!user) return { error: 'Employee not found' };

  const reqDate = new Date(date);
  reqDate.setHours(0, 0, 0, 0);

  if (reqDate < new Date(new Date().toDateString())) {
    return { error: 'Cannot apply on a past date.' };
  }

  const existing = await prisma.wfhRequest.findFirst({
    where: {
      userId: user.id,
      date: reqDate,
      status: { not: 'rejected' }
    }
  });
  if (existing) return { error: 'You already have a request for this date.' };

  // Validate workType based on employee type
  const allowedTypes = user.employeeType === 'hybrid' ? ['wfh', 'wos', 'wfm', 'wfo'] : ['wfh', 'wos'];
  if (!allowedTypes.includes(workType)) {
    return { error: 'Work mode not allowed for your employee type.' };
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

  const req = await prisma.wfhRequest.create({
    data: {
      userId: user.id,
      date: reqDate,
      reason,
      workType,
      approvalStage,
      currentApproverId,
      status: approvalStage === 'approved' ? 'approved' : 'pending'
    }
  });

  const workTypeLabel = { wfh: 'WFH', wos: 'WOS', wfm: 'WFM', wfo: 'WFO' }[workType] || workType.toUpperCase();

  await logAction(employeeCode, 'wfh_submitted', 'wfh_request', req.id,
    `Submitted ${workTypeLabel} request for ${reqDate.toLocaleDateString('en-IN')}`);

  if (currentApproverId) {
    const approver = managers.find(m => m.managerUserId === currentApproverId);
    await logAction(approver?.manager?.code || 'unknown', 'wfh_pending', 'wfh_request', req.id,
      `${workTypeLabel} request from ${user.name} awaiting your approval`);
    await createNotification(currentApproverId, 'wfh_pending',
      `${workTypeLabel} Request — ${user.name}`,
      `${user.name} requested ${workTypeLabel} on ${reqDate.toLocaleDateString('en-IN')}. Reason: ${reason || 'N/A'}`,
      { requestId: req.id, employeeCode, date, reason, workType }
    );
    if (approver?.manager?.code) {
      await sendWfhPendingNotification(approver.manager.code, approver.manager.name, user.name, date, reason, workType);
    }
  }

  revalidatePath(`/employee/${employeeCode}`);

  const stageLabel = approvalStage === 'pending_mgr' ? 'Pending Manager Approval'
    : approvalStage === 'pending_super' ? 'Pending Super Admin Approval'
    : approvalStage === 'approved' ? 'Approved' : approvalStage;

  const adminIds = await getAdminUserIds();
  await Promise.all(adminIds.map(id => createNotification(id, 'wfh_submitted',
    `New ${workTypeLabel} Request`,
    `${user.name} requested ${workTypeLabel} on ${reqDate.toLocaleDateString('en-IN')}. Status: ${stageLabel}.`,
    { requestId: req.id, employeeCode, date, reason, workType, status: approvalStage }
  )));

  if (approvalStage === 'approved') {
    await applyWorkModeToDailyLog(user.id, reqDate, workType);
  }

  return { request: { id: req.id, status: req.status, approvalStage: req.approvalStage, workType } };
}

async function attachApproverName(requests) {
  const ids = [...new Set(requests.map(r => r.currentApproverId).filter(Boolean))];
  const reviewerUsernames = [...new Set(requests.map(r => r.reviewedBy).filter(Boolean))];
  const [users, reviewerUsers] = await Promise.all([
    ids.length ? prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [],
    reviewerUsernames.length ? prisma.user.findMany({ where: { username: { in: reviewerUsernames } }, select: { username: true, name: true } }) : [],
  ]);
  const map = Object.fromEntries(users.map(u => [u.id, u]));
  const revMap = Object.fromEntries(reviewerUsers.map(u => [u.username, u.name]));
  return requests.map(r => ({
    ...r,
    currentApprover: r.currentApproverId ? map[r.currentApproverId] || null : null,
    reviewerName: r.reviewedBy ? revMap[r.reviewedBy] || null : null,
  }));
}

export async function getWfhRequestById(id) {
  const req = await prisma.wfhRequest.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          code: true, name: true, employeeType: true,
          department: { select: { name: true } },
          designation: { select: { name: true } },
          managers: {
            include: { manager: { select: { code: true, name: true } } },
            orderBy: { priority: 'asc' }
          }
        }
      }
    }
  });
  if (!req) return null;
  const arr = await attachApproverName([req]);
  return arr[0] || null;
}

export async function getWfhRequests(employeeCode) {
  const user = await prisma.user.findUnique({ where: { code: employeeCode } });
  if (!user) return [];
  const requests = await prisma.wfhRequest.findMany({
    where: { userId: user.id },
    include: { user: { select: { code: true, name: true } } },
    orderBy: { createdAt: 'desc' }
  });
  return attachApproverName(requests);
}

export async function getManagerWfhRequests(managerCode) {
  const mgr = await prisma.user.findUnique({ where: { code: managerCode } });
  if (!mgr) return [];
  const requests = await prisma.wfhRequest.findMany({
    where: {
      currentApproverId: mgr.id,
      status: 'pending',
      approvalStage: { in: ['pending_l2', 'pending_l1', 'pending_mgr'] }
    },
    include: { user: { select: { code: true, name: true, managers: { include: { manager: { select: { code: true, name: true } } }, orderBy: { priority: 'asc' } } } } },
    orderBy: { createdAt: 'asc' }
  });
  return attachApproverName(requests);
}

export async function getWfhRequestsByStage(stage) {
  const where = stage === 'pending_super'
    ? { approvalStage: 'pending_super', status: 'pending' }
    : { approvalStage: stage, status: 'pending' };
  const requests = await prisma.wfhRequest.findMany({
    where,
    include: { user: { select: { code: true, name: true } } },
    orderBy: { createdAt: 'asc' }
  });
  return attachApproverName(requests);
}

export async function getAllWfhRequests() {
  const requests = await prisma.wfhRequest.findMany({
    include: { user: { select: { code: true, name: true, managers: { include: { manager: { select: { code: true, name: true } } }, orderBy: { priority: 'asc' } } } } },
    orderBy: { createdAt: 'desc' },
    take: 200
  });
  return attachApproverName(requests);
}

export async function reviewWfhRequest(requestId, reviewedBy, approve, note = '') {
  const req = await prisma.wfhRequest.findUnique({
    where: { id: requestId },
    include: { user: { include: { managers: { include: { manager: true }, orderBy: { priority: 'asc' } } } } }
  });
  if (!req) return { error: 'Request not found' };

  // Super admin approves directly — skip all staging
  const reviewer = await prisma.user.findUnique({ where: { username: reviewedBy } });
  if (reviewer?.role === 'super_admin') {
    const newStatus = approve ? 'approved' : 'rejected';
    const updated = await prisma.wfhRequest.update({
      where: { id: requestId },
      data: { status: newStatus, approvalStage: newStatus, currentApproverId: null, reviewedBy, reviewedAt: new Date(), reviewNote: approve ? null : (note || null) }
    });

    if (newStatus === 'approved') await applyWorkModeToDailyLog(req.userId, req.date, req.workType);

    const workTypeLabel = (req.workType || 'wfh').toUpperCase();
    await logAction(reviewedBy, newStatus === 'approved' ? 'wfh_approved' : 'wfh_rejected', 'wfh_request', req.id, `${newStatus === 'approved' ? 'Approved' : 'Rejected'} ${workTypeLabel} request (super admin direct)`);

    await createNotification(req.userId, newStatus === 'approved' ? 'wfh_approved' : 'wfh_rejected',
      `${workTypeLabel} ${newStatus === 'approved' ? 'Approved' : 'Rejected'}`,
      `Your ${workTypeLabel} request for ${req.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} has been ${newStatus}.${note ? ' Note: ' + note : ''}`,
      { requestId: req.id, date: req.date.toISOString(), workType: req.workType });

    const adminIdsSA = await getAdminUserIds();
    await Promise.all(adminIdsSA.map(id => createNotification(id, newStatus === 'approved' ? 'wfh_approved' : 'wfh_rejected',
      `${workTypeLabel} ${newStatus === 'approved' ? 'Approved' : 'Rejected'}`,
      `${req.user.name}'s ${workTypeLabel} request was ${newStatus} by ${reviewer?.name || reviewedBy}.${note ? ' Note: ' + note : ''}`,
      { requestId: req.id, employeeCode: req.user.code, date: req.date.toISOString(), workType: req.workType, note }
    )));

    revalidatePath('/');
    return { request: updated };
  }

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
        `${req.workType.toUpperCase()} request from ${req.user.name} awaiting your approval (approved by manager)`);
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
    await applyWorkModeToDailyLog(req.userId, req.date, req.workType);
  }

  const workTypeLabel = (req.workType || 'wfh').toUpperCase();
  const reviewerName = reviewer?.name || reviewedBy;

  await logAction(reviewedBy, newStatus === 'approved' ? 'wfh_approved' : 'wfh_rejected', 'wfh_request', req.id,
    `${newStatus === 'approved' ? 'Approved' : 'Rejected'} ${workTypeLabel} request (stage: ${newStage})`);

  if (newStatus === 'approved' && newStage === 'approved') {
    await createNotification(req.userId, 'wfh_approved',
      `${workTypeLabel} Approved`,
      `Your ${workTypeLabel} request for ${req.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} has been approved.`,
      { requestId: req.id, date: req.date.toISOString(), workType: req.workType });

    const adminIds = await getAdminUserIds();
    await Promise.all(adminIds.map(id => createNotification(id, 'wfh_approved',
      `${workTypeLabel} Approved`,
      `${req.user.name}'s ${workTypeLabel} request was approved by ${reviewerName}.`,
      { requestId: req.id, employeeCode: req.user.code, date: req.date.toISOString(), workType: req.workType }
    )));
  } else if (newStatus === 'rejected') {
    await createNotification(req.userId, 'wfh_rejected',
      `${workTypeLabel} Rejected`,
      `Your ${workTypeLabel} request for ${req.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} has been rejected.${note ? ' Note: ' + note : ''}`,
      { requestId: req.id, date: req.date.toISOString(), note, workType: req.workType });

    const adminIds = await getAdminUserIds();
    await Promise.all(adminIds.map(id => createNotification(id, 'wfh_rejected',
      `${workTypeLabel} Rejected`,
      `${req.user.name}'s ${workTypeLabel} request was rejected by ${reviewerName}.${note ? ' Note: ' + note : ''}`,
      { requestId: req.id, employeeCode: req.user.code, date: req.date.toISOString(), note, workType: req.workType }
    )));
  }

  if (newStage === 'pending_super') {
    const superAdminIds = await getSuperAdminUserIds();
    await Promise.all(superAdminIds.map(id => createNotification(id, 'wfh_pending_super',
      `${workTypeLabel} Pending Your Approval`,
      `${req.user.name}'s ${workTypeLabel} request needs your approval.`,
      { requestId: req.id, employeeCode: req.user.code, date: req.date.toISOString(), workType: req.workType })));
  } else if (newApproverId) {
    await createNotification(newApproverId, 'wfh_pending',
      `${workTypeLabel} Pending Your Approval`,
      `${req.user.name}'s ${workTypeLabel} request needs your approval.`,
      { requestId: req.id, employeeCode: req.user.code, date: req.date.toISOString(), workType: req.workType });
  }

  revalidatePath('/');
  return { request: updated };
}

async function applyWorkModeToDailyLog(userId, date, workType) {
  const monthYear = `${date.getMonth() + 1}_${date.getFullYear()}`;
  const day = date.getDate();

  const existing = await prisma.dailyLog.findUnique({
    where: { userId_monthYear_day: { userId, monthYear, day } }
  });

  if (existing && existing.type !== 'absent') return;

  const inT = existing?.inT || 600;
  const outT = existing?.outT || 1140;

  await prisma.dailyLog.upsert({
    where: { userId_monthYear_day: { userId, monthYear, day } },
    update: { type: workType, raw: workType.toUpperCase(), workLocation: workType, inT, outT },
    create: { userId, monthYear, day, type: workType, raw: workType.toUpperCase(), workLocation: workType, inT, outT },
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
    else if (['wfh', 'wos', 'wfm', 'wfo'].includes(log.type)) wfh++;
    else if (log.type === 'present') present++;
  }
  await prisma.monthRecord.upsert({
    where: { userId_monthYear: { userId, monthYear } },
    update: { present: present + wfh, absent, halfDay, numDays: maxDay },
    create: { userId, monthYear, present: present + wfh, absent, halfDay, numDays: maxDay },
  });
}
