"use server";

import { prisma } from '../lib/prisma';

export async function getActiveShiftPolicy() {
  const policy = await prisma.shiftPolicy.findFirst({
    where: { isActive: true },
    orderBy: { effectiveFrom: 'desc' }
  });
  // Return defaults if none configured
  return policy ?? {
    shiftStartH: 10, shiftStartM: 0,
    graceMinutes: 15, minHours: 9,
    latesPerHD: 3, ssPerHD: 3
  };
}

export async function saveShiftPolicy({ shiftStartH, shiftStartM, graceMinutes, minHours, latesPerHD, ssPerHD }) {
  // Deactivate existing
  await prisma.shiftPolicy.updateMany({ where: { isActive: true }, data: { isActive: false } });
  // Create new active policy
  const policy = await prisma.shiftPolicy.create({
    data: { shiftStartH, shiftStartM, graceMinutes, minHours, latesPerHD, ssPerHD, isActive: true }
  });
  return { policy };
}

export async function getShiftPolicyHistory() {
  return prisma.shiftPolicy.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
}
