"use server";

import { prisma } from '../lib/prisma';
import { revalidatePath } from 'next/cache';
import { logAction } from './audit';

export async function requestAttendanceCorrection(employeeCode, monthYear, day, currentType, newType, reason, requestedBy) {
  const user = await prisma.user.findUnique({ where: { code: employeeCode } });
  if (!user) return { error: 'Employee not found' };

  const payload = JSON.stringify({ employeeCode, monthYear, day, currentType, newType, reason });

  const change = await prisma.pendingChange.create({
    data: {
      requestedBy,
      action: 'attendance_correction',
      payload,
      status: 'pending'
    }
  });

  await logAction(requestedBy, 'attendance_correction_requested', 'pending_change', change.id,
    `Requested correction for ${employeeCode} day ${day} ${monthYear}: ${currentType} → ${newType}`);

  revalidatePath('/');
  return { success: true };
}

export async function getPendingAttendanceCorrections() {
  return prisma.pendingChange.findMany({
    where: { action: 'attendance_correction', status: 'pending' },
    orderBy: { createdAt: 'asc' }
  });
}

export async function reviewAttendanceCorrection(changeId, reviewedBy, approve) {
  const change = await prisma.pendingChange.findUnique({ where: { id: changeId } });
  if (!change) return { error: 'Change not found' };

  const payload = JSON.parse(change.payload);

  if (approve) {
    const user = await prisma.user.findUnique({ where: { code: payload.employeeCode } });
    if (user) {
      const existing = await prisma.dailyLog.findUnique({
        where: { userId_monthYear_day: { userId: user.id, monthYear: payload.monthYear, day: payload.day } }
      });

      if (existing) {
        await prisma.dailyLog.update({
          where: { userId_monthYear_day: { userId: user.id, monthYear: payload.monthYear, day: payload.day } },
          data: {
            type: payload.newType,
            isLate: false,
            isSS: false,
            isSL: false,
            hdReason: null
          }
        });

        const changes = {};
        if (payload.currentType === 'half' && (payload.newType === 'present' || payload.newType === 'absent')) {
          changes.halfDay = { decrement: 1 };
          if (payload.newType === 'present') changes.present = { increment: 1 };
          if (payload.newType === 'absent') changes.absent = { increment: 1 };
        } else if ((payload.currentType === 'present' || payload.currentType === 'absent') && payload.newType === 'half') {
          if (payload.currentType === 'present') changes.present = { decrement: 1 };
          if (payload.currentType === 'absent') changes.absent = { decrement: 1 };
          changes.halfDay = { increment: 1 };
        } else if (payload.currentType === 'absent' && payload.newType === 'present') {
          changes.absent = { decrement: 1 };
          changes.present = { increment: 1 };
        }

        if (Object.keys(changes).length > 0) {
          await prisma.monthRecord.updateMany({
            where: { userId: user.id, monthYear: payload.monthYear },
            data: changes
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

  await logAction(reviewedBy, approve ? 'attendance_correction_approved' : 'attendance_correction_rejected', 'pending_change', changeId,
    `${approve ? 'Approved' : 'Rejected'} correction for ${payload.employeeCode} day ${payload.day} ${payload.monthYear}`);

  revalidatePath('/');
  return { success: true };
}
