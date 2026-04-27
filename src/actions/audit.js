"use server";

import { prisma } from '../lib/prisma';

export async function logAction(performedBy, action, entity, entityId, detail) {
  return prisma.auditLog.create({
    data: { performedBy, action, entity, entityId: entityId ?? null, detail }
  });
}

export async function getAuditLog({ limit = 100, entity, performedBy } = {}) {
  return prisma.auditLog.findMany({
    where: {
      ...(entity ? { entity } : {}),
      ...(performedBy ? { performedBy } : {})
    },
    orderBy: { createdAt: 'desc' },
    take: limit
  });
}
