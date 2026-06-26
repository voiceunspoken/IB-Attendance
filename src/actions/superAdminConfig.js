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

const ACTION_LABELS = {
  create_user: 'Create Employee',
  delete_user: 'Delete Employee',
  update_user: 'Edit Employee (dept/designation/type/email)',
  toggle_user: 'Disable/Enable Employee',
  promote_user: 'Promote to Admin',
  upload_month: 'Upload Attendance CSV',
  delete_month: 'Delete Month Record',
  edit_month: 'Edit Month Record',
  edit_leave_balance: 'Edit Leave Balance',
  update_leave_policy: 'Save Leave Policy',
  manage_org: 'Manage Departments / Designations',
};

export { ACTION_LABELS };

export async function getAdminActionConfig(actionType) {
  try {
    return await prisma.adminActionConfig.findUnique({ where: { actionType } });
  } catch {
    return null;
  }
}

export async function getAllAdminActionConfigs() {
  try {
    return await prisma.adminActionConfig.findMany();
  } catch {
    return [];
  }
}

export async function setAdminActionConfig(actionType, requiresApproval) {
  await prisma.adminActionConfig.upsert({
    where: { actionType },
    update: { requiresApproval },
    create: { actionType, requiresApproval }
  });
  revalidatePath('/');
  return { success: true };
}
