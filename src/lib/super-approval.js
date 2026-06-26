import { prisma } from './prisma';
import { createNotification, getSuperAdminUserIds } from '../actions/notifications';

const DEFAULT_APPROVAL = true;

export async function getActionRequiresApproval(actionType) {
  try {
    const config = await prisma.adminActionConfig.findUnique({ where: { actionType } });
    return config?.requiresApproval ?? DEFAULT_APPROVAL;
  } catch {
    return DEFAULT_APPROVAL;
  }
}

export async function setActionRequiresApproval(actionType, value) {
  await prisma.adminActionConfig.upsert({
    where: { actionType },
    update: { requiresApproval: value },
    create: { actionType, requiresApproval: value }
  });
}

export async function getAllActionConfigs() {
  try {
    return await prisma.adminActionConfig.findMany();
  } catch {
    return [];
  }
}

export async function requireSuperApproval(performedBy, actionType, payload) {
  if (!performedBy) return { error: 'Authentication required' };
  const user = await prisma.user.findUnique({ where: { username: performedBy } });
  if (!user) return { error: 'User not found' };
  if (user.role === 'super_admin') return null;
  if (user.role !== 'admin') return { error: 'Unauthorized: Admin access required' };

  const requiresApproval = await getActionRequiresApproval(actionType);
  if (!requiresApproval) return null;

  const change = await prisma.pendingChange.create({
    data: { requestedBy: performedBy, action: actionType, payload: JSON.stringify(payload), status: 'pending' }
  });

  const superAdminIds = await getSuperAdminUserIds();
  const label = actionType.replace(/_/g, ' ');
  await Promise.all(superAdminIds.map(id => createNotification(id, 'admin_action_pending',
    `Admin Action Pending — ${label}`,
    `${user.name} (${performedBy}) requested: ${label}.`,
    { changeId: change.id, actionType, payload })));

  return { success: true, pending: true, changeId: change.id, message: 'Submitted for super admin approval.' };
}
