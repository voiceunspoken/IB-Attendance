"use server";

import { prisma } from '../lib/prisma';
import { revalidatePath } from 'next/cache';
import { logAction } from './audit';

export async function getSuperAdminConfig() {
  let config = await prisma.superAdminConfig.findFirst();
  if (!config) {
    config = await prisma.superAdminConfig.create({
      data: { requireSuperApproval: true }
    });
  }
  return config;
}

export async function setRequireSuperApproval(value, updatedBy) {
  let config = await prisma.superAdminConfig.findFirst();
  if (!config) {
    config = await prisma.superAdminConfig.create({
      data: { requireSuperApproval: value }
    });
  } else {
    config = await prisma.superAdminConfig.update({
      where: { id: config.id },
      data: { requireSuperApproval: value }
    });
  }

  await logAction(updatedBy, 'super_admin_config_updated', 'super_admin_config', config.id,
    `Set requireSuperApproval = ${value}`);

  revalidatePath('/');
  return { config };
}
