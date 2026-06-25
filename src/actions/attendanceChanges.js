"use server";

import { prisma } from '../lib/prisma';
import { revalidatePath } from 'next/cache';
import { logAction } from './audit';
import { createNotification, getAdminUserIds } from './notifications';
import { requireSuperAdmin } from '../lib/auth-guard';

const LEAVE_TYPES = ['cl', 'sl', 'el', 'rl', 'ul', 'sh'];

export async function requestAdjustment(employeeCode, monthYear, day, currentType, newType, reason, requestedBy) {
  const user = await prisma.user.findUnique({ where: { code: employeeCode } });
  if (!user) return { error: 'Employee not found' };

  let warning = null;

  if (LEAVE_TYPES.includes(newType)) {
    const year = parseInt(monthYear.split('_')[1]);
    const balance = await prisma.leaveBalance.findUnique({
      where: { userId_year: { userId: user.id, year } }
    });
    if (balance) {
      const usedKey = newType + 'Used';
      const totalKey = newType + 'Total';
      const used = balance[usedKey] || 0;
      const total = balance[totalKey] || 0;
      if (used >= total) {
        warning = `${newType.toUpperCase()} balance exhausted (${used}/${total} used).`;
      } else if (used + 1 > total) {
        warning = `${newType.toUpperCase()} balance insufficient (${used}/${total} used, need 1 more).`;
      }
    }
  }

  const payload = JSON.stringify({ employeeCode, employeeName: user.name, monthYear, day, currentType, newType, reason, warning });

  const change = await prisma.pendingChange.create({
    data: {
      requestedBy,
      action: 'attendance_adjustment',
      payload,
      status: 'pending'
    }
  });

  await logAction(requestedBy, 'attendance_adjustment_requested', 'pending_change', change.id,
    `Requested adjustment for ${employeeCode} day ${day} ${monthYear}: ${currentType} → ${newType}${warning ? ' (warning: ' + warning + ')' : ''}`);

  const adminIds = await getAdminUserIds();
  await Promise.all(adminIds.map(id => createNotification(id, 'adjustment_submitted',
    `New Adjustment Request`,
    `${user.name} requested an attendance adjustment for day ${day} (${currentType} → ${newType}).`,
    { employeeCode, day, monthYear, currentType, newType, reason, warning, requestId: change.id })));

  revalidatePath('/');
  return { success: true, warning };
}

export async function requestRegularizationChange(employeeCode, monthYear, day, currentType, newType, reason, requestedBy) {
  const user = await prisma.user.findUnique({ where: { code: employeeCode } });
  if (!user) return { error: 'Employee not found' };

  let warning = null;

  if (LEAVE_TYPES.includes(newType)) {
    const year = parseInt(monthYear.split('_')[1]);
    const balance = await prisma.leaveBalance.findUnique({
      where: { userId_year: { userId: user.id, year } }
    });
    if (balance) {
      const usedKey = newType + 'Used';
      const totalKey = newType + 'Total';
      const used = balance[usedKey] || 0;
      const total = balance[totalKey] || 0;
      if (used >= total) {
        warning = `${newType.toUpperCase()} balance exhausted (${used}/${total} used).`;
      } else if (used + 1 > total) {
        warning = `${newType.toUpperCase()} balance insufficient (${used}/${total} used, need 1 more).`;
      }
    }
  }

  const [mo, yr] = monthYear.split('_');
  const date = new Date(parseInt(yr), parseInt(mo) - 1, parseInt(day));

  const payload = JSON.stringify({ employeeCode, employeeName: user.name, monthYear, day: parseInt(day), currentType, newType, warning, reason });

  const req = await prisma.regularizationRequest.create({
    data: {
      userId: user.id,
      date,
      type: 'attendance_change',
      reason: payload,
      status: 'pending',
      superStatus: 'pending'
    }
  });

  await logAction(requestedBy, 'attendance_change_requested', 'regularization_request', req.id,
    `Requested attendance change for ${employeeCode} day ${day} ${monthYear}: ${currentType} \u2192 ${newType}${warning ? ' (warning: ' + warning + ')' : ''}`);

  const adminIds = await getAdminUserIds();
  await Promise.all(adminIds.map(id => createNotification(id, 'regularization_submitted',
    `New Attendance Change Request`,
    `${user.name} requested an attendance change for day ${day} (${currentType} \u2192 ${newType}).`,
    { employeeCode, day, monthYear, currentType, newType, reason, warning, requestId: req.id })));

  revalidatePath('/');
  return { success: true, warning };
}

function recalcTotals(logs) {
  let present = 0, absent = 0, halfDay = 0, late = 0, ss = 0, sl = 0, rl = 0, holi = 0;
  let lateHD = 0, ssHD = 0, maxDay = 0;
  for (const log of logs) {
    maxDay = Math.max(maxDay, log.day);
    if (LEAVE_TYPES.includes(log.type)) {
      if (log.type === 'rl') rl++;
      else present++;
    } else if (log.type === 'absent') absent++;
    else if (log.type === 'holiday') holi++;
    else if (log.type === 'half') { halfDay++; if (log.hdReason === 'late') lateHD++; if (log.hdReason === 'ss') ssHD++; }
    else if (['wfh', 'wos', 'wfm', 'wfo'].includes(log.type)) { present++; }
    else if (log.type === 'present') {
      if (log.isHD) { halfDay++; if (log.hdReason === 'late') lateHD++; if (log.hdReason === 'ss') ssHD++; }
      else { present++; }
      if (log.isLate) late++;
      if (log.isSS) ss++;
      if (log.isSL) sl++;
    }
  }
  return { present, absent, halfDay, late, lateHD, shortShift: ss, ssHD, shortLeave: sl, rl, holi, maxDay };
}

export async function reviewAdjustment(changeId, reviewedBy, approve) {
  const auth = await requireSuperAdmin(reviewedBy);
  if (auth) return auth;
  const change = await prisma.pendingChange.findUnique({ where: { id: changeId } });
  if (!change) return { error: 'Change not found' };

  const payload = JSON.parse(change.payload);

  if (approve) {
    const user = await prisma.user.findUnique({ where: { code: payload.employeeCode } });
    if (user) {
      await prisma.dailyLog.upsert({
        where: { userId_monthYear_day: { userId: user.id, monthYear: payload.monthYear, day: parseInt(payload.day) } },
        update: {
          type: payload.newType,
          isLate: false,
          isSS: false,
          isSL: false,
          hdReason: null
        },
        create: {
          userId: user.id, monthYear: payload.monthYear, day: parseInt(payload.day),
          type: payload.newType,
          raw: '',
          isLate: false, isSS: false, isSL: false
        }
      });

      const logs = await prisma.dailyLog.findMany({ where: { userId: user.id, monthYear: payload.monthYear } });
      const t = recalcTotals(logs);
      const numDays = t.maxDay || 31;
      await prisma.monthRecord.upsert({
        where: { userId_monthYear: { userId: user.id, monthYear: payload.monthYear } },
        update: {
          present: t.present, absent: t.absent, halfDay: t.halfDay,
          late: t.late, lateHD: t.lateHD, shortShift: t.shortShift,
          ssHD: t.ssHD, shortLeave: t.shortLeave, rl: t.rl, holi: t.holi,
          numDays,
        },
        create: {
          userId: user.id, monthYear: payload.monthYear,
          present: t.present, absent: t.absent, halfDay: t.halfDay,
          late: t.late, lateHD: t.lateHD, shortShift: t.shortShift,
          ssHD: t.ssHD, shortLeave: t.shortLeave, rl: t.rl, holi: t.holi,
          numDays,
        },
      });

      if (LEAVE_TYPES.includes(payload.newType)) {
        const year = parseInt(payload.monthYear.split('_')[1]);
        const usedKey = payload.newType + 'Used';
        const balance = await prisma.leaveBalance.findUnique({
          where: { userId_year: { userId: user.id, year } }
        });
        if (balance) {
          const currentUsed = balance[usedKey] || 0;
          await prisma.leaveBalance.update({
            where: { userId_year: { userId: user.id, year } },
            data: { [usedKey]: currentUsed + 1 }
          });
        }
      }
    }
  }

  await prisma.pendingChange.update({
    where: { id: changeId },
    data: {
      status: approve ? 'approved' : 'rejected',
      reviewedBy,
      reviewedAt: new Date()
    }
  });

  await logAction(reviewedBy, approve ? 'attendance_adjustment_approved' : 'attendance_adjustment_rejected', 'pending_change', changeId,
    `${approve ? 'Approved' : 'Rejected'} adjustment for ${payload.employeeCode} day ${payload.day} ${payload.monthYear}: ${payload.currentType} → ${payload.newType}`);

  const empUser = await prisma.user.findUnique({ where: { code: payload.employeeCode } });
  if (empUser) {
    const notifType = approve ? 'adjustment_approved' : 'adjustment_rejected';
    const notifTitle = approve ? 'Adjustment Approved' : 'Adjustment Rejected';
    await createNotification(empUser.id, notifType, notifTitle,
      `Your attendance adjustment for day ${payload.day} (${payload.currentType} → ${payload.newType}) has been ${approve ? 'approved' : 'rejected'}.`,
      { ...payload });
  }

  revalidatePath('/');
  return { success: true };
}

function parseTimeString(t) {
  if (!t || typeof t !== 'string') return null;
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return parseInt(m[1]) * 60 + parseInt(m[2]);
}

export async function updatePunchTimes(employeeCode, monthYear, day, inTStr, outTStr, reason, updatedBy) {
  const user = await prisma.user.findUnique({ where: { code: employeeCode } });
  if (!user) return { error: 'Employee not found' };

  const inT = parseTimeString(inTStr);
  const outT = parseTimeString(outTStr);

  const updated = await prisma.dailyLog.upsert({
    where: { userId_monthYear_day: { userId: user.id, monthYear, day: parseInt(day) } },
    update: { inT, outT },
    create: { userId: user.id, monthYear, day: parseInt(day), type: 'present', raw: '', inT, outT }
  });

  await logAction(updatedBy, 'punch_time_updated', 'daily_log', updated.id,
    `Updated punch times for ${employeeCode} day ${day} ${monthYear}: ${inTStr}–${outTStr}${reason ? ' (' + reason + ')' : ''}`);

  revalidatePath('/');
  return { success: true };
}

export async function getCorrectionById(id) {
  const change = await prisma.pendingChange.findUnique({ where: { id } });
  if (!change) return null;
  const payload = JSON.parse(change.payload);
  return { ...change, payload };
}
