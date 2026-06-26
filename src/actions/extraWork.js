"use server";

import { prisma } from '../lib/prisma';
import { revalidatePath } from 'next/cache';
import { logAction } from './audit';
import { createNotification, getAdminUserIds } from './notifications';

export async function submitExtraWork(employeeCode, { date, hours, reason }) {
  const user = await prisma.user.findUnique({
    where: { code: employeeCode },
    include: { managers: { include: { manager: true }, orderBy: { priority: 'asc' } } }
  });
  if (!user) return { error: 'Employee not found' };

  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (d < today) return { error: 'Cannot submit for a past date.' };
  if (d.getDay() === 0) return { error: 'Cannot submit for a Sunday.' };
  if (!hours || hours <= 0) return { error: 'Hours must be greater than 0.' };

  const existing = await prisma.extraWorkRequest.findFirst({
    where: { userId: user.id, date: d, status: { not: 'rejected' } }
  });
  if (existing) return { error: 'You already have a pending or approved extra work request for this date.' };

  const managers = user.managers;
  let approvalStage = 'pending_mgr';
  let currentApproverId = null;

  if (managers.length > 0) {
    currentApproverId = managers[0].managerUserId;
  } else {
    const adminIds = await getAdminUserIds();
    if (adminIds.length > 0) {
      approvalStage = 'pending_admin';
      currentApproverId = adminIds[0];
    }
  }

  const req = await prisma.extraWorkRequest.create({
    data: {
      userId: user.id,
      date: d,
      hours,
      reason,
      approvalStage,
      currentApproverId,
      status: 'pending',
    }
  });

  await logAction(employeeCode, 'extra_work_submitted', 'extra_work_request', req.id,
    `Submitted extra work request for ${hours}h on ${date}. Reason: ${reason}`);

  if (currentApproverId && managers.length > 0) {
    await createNotification(currentApproverId, 'extra_work_pending',
      `Extra Work Request — ${user.name}`,
      `${user.name} submitted an extra work request for ${hours}h on ${date}. Reason: ${reason}`,
      { requestId: req.id, employeeCode, hours, date, reason }
    );
  }

  const adminIds = await getAdminUserIds();
  await Promise.all(adminIds.map(id => createNotification(id, 'extra_work_submitted',
    `New Extra Work Request`,
    `${user.name} submitted an extra work request for ${hours}h on ${date}.`,
    { requestId: req.id, employeeCode, hours, date, reason }
  )));

  revalidatePath(`/employee/${employeeCode}/extra-work`);
  return { request: req };
}

export async function getExtraWorkRequests(employeeCode) {
  const user = await prisma.user.findUnique({ where: { code: employeeCode } });
  if (!user) return [];
  return prisma.extraWorkRequest.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getAllExtraWorkRequests() {
  return prisma.extraWorkRequest.findMany({
    include: { user: { select: { id: true, name: true, code: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getExtraWorkByStage(stage) {
  return prisma.extraWorkRequest.findMany({
    where: { approvalStage: stage, status: 'pending' },
    include: { user: { select: { id: true, name: true, code: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getExtraWorkRequest(id) {
  return prisma.extraWorkRequest.findUnique({
    where: { id },
    include: {
      user: { include: { managers: { include: { manager: true }, orderBy: { priority: 'asc' } } } },
      currentApprover: { select: { id: true, name: true } },
    },
  });
}

export async function reviewExtraWorkMgr(id, username, approve, note = '') {
  const req = await prisma.extraWorkRequest.findUnique({
    where: { id },
    include: { user: { include: { managers: { include: { manager: true }, orderBy: { priority: 'asc' } } } } }
  });
  if (!req) return { error: 'Request not found' };
  if (req.approvalStage !== 'pending_mgr') return { error: 'Not pending manager review' };

  if (!approve) {
    if (!note) return { error: 'Rejection reason is required.' };
    await prisma.extraWorkRequest.update({
      where: { id },
      data: {
        status: 'rejected',
        approvalStage: 'rejected',
        mgrReviewedBy: username,
        mgrReviewedAt: new Date(),
        mgrReviewNote: note,
      }
    });
    await createNotification(req.userId, 'extra_work_rejected',
      'Extra Work Request Rejected',
      `Your extra work request for ${req.hours}h on ${new Date(req.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} was rejected by your manager. Note: ${note}`,
      { requestId: id }
    );
    revalidatePath('/extra-work');
    revalidatePath(`/employee/${req.user.code}/extra-work`);
    return { success: true };
  }

  const managers = req.user.managers;
  const currentIdx = managers.findIndex(m => m.managerUserId === req.currentApproverId);
  const nextIdx = currentIdx + 1;

  let approvalStage = 'pending_admin';
  let currentApproverId = null;
  let status = 'pending';

  if (nextIdx < managers.length) {
    currentApproverId = managers[nextIdx].managerUserId;
    approvalStage = 'pending_mgr';
  } else {
    const adminIds = await getAdminUserIds();
    if (adminIds.length > 0) {
      currentApproverId = adminIds[0];
    } else {
      status = 'approved';
      approvalStage = 'approved';
    }
  }

  await prisma.extraWorkRequest.update({
    where: { id },
    data: {
      status,
      approvalStage,
      currentApproverId,
      mgrReviewedBy: username,
      mgrReviewedAt: new Date(),
      mgrReviewNote: note || null,
    }
  });

  if (currentApproverId && approvalStage !== 'approved') {
    await createNotification(currentApproverId, 'extra_work_pending',
      `Extra Work Request — ${req.user.name}`,
      `${req.user.name}'s extra work request for ${req.hours}h on ${new Date(req.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} needs your review.`,
      { requestId: id }
    );
  } else if (status === 'approved') {
    await createNotification(req.userId, 'extra_work_approved',
      'Extra Work Request Approved',
      `Your extra work request for ${req.hours}h on ${new Date(req.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} has been fully approved.`,
      { requestId: id }
    );
  }

  revalidatePath('/extra-work');
  revalidatePath(`/employee/${req.user.code}/extra-work`);
  return { success: true };
}

export async function reviewExtraWorkAdmin(id, username, decision, approve, note = '') {
  const req = await prisma.extraWorkRequest.findUnique({
    where: { id },
    include: { user: true }
  });
  if (!req) return { error: 'Request not found' };
  if (req.approvalStage !== 'pending_admin') return { error: 'Not pending admin review' };

  if (!approve) {
    if (!note) return { error: 'Rejection reason is required.' };
    await prisma.extraWorkRequest.update({
      where: { id },
      data: {
        status: 'rejected',
        approvalStage: 'rejected',
        reviewedBy: username,
        reviewedAt: new Date(),
        reviewNote: note,
      }
    });
    await createNotification(req.userId, 'extra_work_rejected',
      'Extra Work Request Rejected',
      `Your extra work request for ${req.hours}h on ${new Date(req.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} was rejected. Note: ${note}`,
      { requestId: id }
    );
    revalidatePath('/extra-work');
    revalidatePath(`/employee/${req.user.code}/extra-work`);
    return { success: true };
  }

  if (!decision || !['half', 'full'].includes(decision)) {
    return { error: 'Please select Half (0.5) or Full (1.0) day decision.' };
  }

  const ewlValue = decision === 'half' ? 0.5 : 1.0;
  const year = req.date.getFullYear();

  await prisma.$transaction([
    prisma.extraWorkRequest.update({
      where: { id },
      data: {
        status: 'approved',
        approvalStage: 'approved',
        adminDecision: decision,
        reviewedBy: username,
        reviewedAt: new Date(),
        reviewNote: note || null,
      }
    }),
    prisma.leaveBalance.upsert({
      where: { userId_year: { userId: req.userId, year } },
      update: { ewlTotal: { increment: ewlValue } },
      create: { userId: req.userId, year, ewlTotal: ewlValue, ewlUsed: 0 },
    }),
  ]);

  await createNotification(req.userId, 'extra_work_approved',
    'Extra Work Request Approved',
    `Your extra work request for ${req.hours}h on ${new Date(req.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} was approved as a ${decision}-day (${ewlValue} EWL credited).`,
    { requestId: id, ewlValue }
  );

  revalidatePath('/extra-work');
  revalidatePath(`/employee/${req.user.code}/extra-work`);
  return { success: true };
}

export async function getAllEwlBalances(year) {
  const users = await prisma.user.findMany({
    where: { code: { not: null } },
    select: { id: true, code: true, name: true, employeeType: true }
  });

  const balances = await Promise.all(
    users.map(async (u) => {
      let bal = await prisma.leaveBalance.findUnique({
        where: { userId_year: { userId: u.id, year } }
      });
      if (!bal) {
        bal = await prisma.leaveBalance.create({
          data: { userId: u.id, year }
        });
      }
      return { ...u, ewlTotal: bal.ewlTotal, ewlUsed: bal.ewlUsed, ewlRemaining: bal.ewlTotal - bal.ewlUsed };
    })
  );

  return balances;
}

export async function resetAllEwl(year, username) {
  const users = await prisma.user.findMany({
    where: { code: { not: null }, role: 'employee' },
    select: { id: true }
  });

  await prisma.$transaction(
    users.map(u =>
      prisma.leaveBalance.upsert({
        where: { userId_year: { userId: u.id, year } },
        update: { ewlTotal: 0, ewlUsed: 0 },
        create: { userId: u.id, year, ewlTotal: 0, ewlUsed: 0 },
      })
    )
  );

  await logAction(username, 'ewl_reset', 'extra_work', '',
    `Reset all EWL balances for ${year}`);

  revalidatePath('/settings');
  return { success: true };
}
