"use server";

import { prisma } from '../lib/prisma';
import { revalidatePath } from 'next/cache';
import { logAction } from './audit';

export async function getActiveShiftPolicy() {
  const policy = await prisma.attendancePolicy.findFirst({
    where: { isActive: true },
    orderBy: { effectiveFrom: 'desc' }
  });
  return policy ?? {
    shiftStartH: 10, shiftStartM: 0, shiftEndH: 19, shiftEndM: 0,
    graceMinutes: 15, lateStartMin: 30,
    shortLeaveStartMin: 60, shortLeaveEndMin: 120, halfDayAfterMin: 120,
    morningHalfDayCutoffH: 14, morningHalfDayCutoffM: 30,
    eveningHalfDayStartH: 14, eveningHalfDayStartM: 0,
    eveningEarliestExitH: 17, eveningEarliestExitM: 0,
    eveningShortLeaveWindowMin: 10,
    minHours: 9, latesPerHD: 3, ssPerHD: 3
  };
}

export async function saveShiftPolicy(data, createdBy = 'admin') {
  // Deactivate existing active policy
  await prisma.attendancePolicy.updateMany({ where: { isActive: true }, data: { isActive: false } });

  // Create new policy as pending — needs super admin approval
  const policy = await prisma.attendancePolicy.create({
    data: {
      name: data.name || 'Default',
      shiftStartH: data.shiftStartH, shiftStartM: data.shiftStartM,
      shiftEndH: data.shiftEndH, shiftEndM: data.shiftEndM,
      graceMinutes: data.graceMinutes,
      lateStartMin: data.lateStartMin ?? 30,
      shortLeaveStartMin: data.shortLeaveStartMin ?? 60,
      shortLeaveEndMin: data.shortLeaveEndMin ?? 120,
      halfDayAfterMin: data.halfDayAfterMin ?? 120,
      morningHalfDayCutoffH: data.morningHalfDayCutoffH ?? 14,
      morningHalfDayCutoffM: data.morningHalfDayCutoffM ?? 30,
      eveningHalfDayStartH: data.eveningHalfDayStartH ?? 14,
      eveningHalfDayStartM: data.eveningHalfDayStartM ?? 0,
      eveningEarliestExitH: data.eveningEarliestExitH ?? 17,
      eveningEarliestExitM: data.eveningEarliestExitM ?? 0,
      eveningShortLeaveWindowMin: data.eveningShortLeaveWindowMin ?? 10,
      minHours: data.minHours, latesPerHD: data.latesPerHD, ssPerHD: data.ssPerHD,
      status: 'pending', createdBy, isActive: false
    }
  });
  await logAction(createdBy, 'policy_created', 'attendance_policy', policy.id, `Created policy "${policy.name}" pending approval`);
  revalidatePath('/');
  return { policy };
}

export async function getShiftPolicyHistory() {
  return prisma.attendancePolicy.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
}

export async function getPendingPolicies() {
  return prisma.attendancePolicy.findMany({
    where: { status: 'pending' },
    orderBy: { createdAt: 'desc' }
  });
}

export async function reviewPolicy(policyId, reviewedBy, approve, note = '') {
  if (!approve && !note) return { error: 'A reason is required when rejecting.' };
  const policy = await prisma.attendancePolicy.update({
    where: { id: policyId },
    data: {
      status: approve ? 'active' : 'rejected',
      isActive: approve ? true : false,
      reviewedBy, reviewedAt: new Date(),
      reviewNote: note || null
    }
  });
  await logAction(reviewedBy, approve ? 'policy_approved' : 'policy_rejected', 'attendance_policy', policyId,
    `${approve ? 'Approved' : 'Rejected'} policy "${policy.name}"`);
  revalidatePath('/');
  return { policy };
}
