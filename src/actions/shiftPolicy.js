"use server";

import { prisma } from '../lib/prisma';
import { requireAuth, requireAdmin } from '../lib/session';

export async function getActiveShiftPolicy() {
  try {
    await requireAuth();
    const policy = await prisma.shiftPolicy.findFirst({ where: { isActive: true } });
    return policy || { shiftStartH: 10, shiftStartM: 0, graceMinutes: 15, minHours: 9, latesPerHD: 3, ssPerHD: 3 };
  } catch {
    return { shiftStartH: 10, shiftStartM: 0, graceMinutes: 15, minHours: 9, latesPerHD: 3, ssPerHD: 3 };
  }
}

export async function saveShiftPolicy(data) {
  try {
    await requireAdmin();
    await prisma.shiftPolicy.updateMany({ where: { isActive: true }, data: { isActive: false } });
    return prisma.shiftPolicy.create({
      data: { ...data, isActive: true }
    });
  } catch (e) {
    if (e.message === 'Authentication required' || e.message === 'Admin access required') return { error: e.message };
    console.error('[saveShiftPolicy error]', e.message);
    return { error: 'Failed to save shift policy.' };
  }
}

export async function getShiftPolicyHistory() {
  try {
    await requireAdmin();
    return prisma.shiftPolicy.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
  } catch {
    return [];
  }
}
