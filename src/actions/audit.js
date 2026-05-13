"use server";

import { prisma } from '../lib/prisma';
import { requireSuperAdmin } from '../lib/session';

export async function logAction(performedBy, action, entity, entityId, detail) {
  try {
    return prisma.auditLog.create({
      data: { performedBy, action, entity, entityId: entityId ?? null, detail }
    });
  } catch (e) {
    console.error('[logAction error]', e.message);
  }
}

export async function getAuditLog({ limit = 100, entity, performedBy } = {}) {
  try {
    await requireSuperAdmin();
    return prisma.auditLog.findMany({
      where: {
        ...(entity ? { entity } : {}),
        ...(performedBy ? { performedBy } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  } catch {
    return [];
  }
}
