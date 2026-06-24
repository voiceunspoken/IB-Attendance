"use server";

import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import { logAction } from './audit';
import { requireAdminOrSuperAdmin, requireSuperAdmin } from '../lib/auth-guard';

export async function loginUser(email, password) {
  try {
    if (!email) return { error: 'Invalid email or password.' };
    const user = await prisma.user.findFirst({ where: { email: email.toLowerCase().trim() } });
    if (!user) return { error: 'Invalid email or password.' };

    if (user.disabled) return { error: 'Your account has been disabled. Contact your admin.' };

    const valid = user.password.startsWith('$2')
      ? await bcrypt.compare(password, user.password)
      : user.password === password;

    if (!valid) return { error: 'Invalid email or password.' };
    return { user: { id: user.id, username: user.username, role: user.role, code: user.code ?? null, email: user.email ?? null } };
  } catch (e) {
    console.error('[loginUser error]', e.message);
    return { error: 'Server error: ' + e.message };
  }
}

export async function createUser(username, password, role, code, createdBy = 'system') {
  const auth = await requireAdminOrSuperAdmin(createdBy);
  if (auth) return auth;
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) return { error: 'Username already exists.' };

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { username, password: hashed, role, code: code || null }
  });
  await logAction(createdBy, 'user_created', 'user', user.id, `Created user "${username}" with role "${role}"`);
  return { user: { id: user.id, username: user.username, role: user.role, code: user.code } };
}

export async function getUsers() {
  return prisma.user.findMany({
    select: { id: true, username: true, role: true, disabled: true, code: true, name: true, email: true, createdAt: true },
    orderBy: { createdAt: 'asc' }
  });
}

export async function deleteUser(userId, deletedBy = 'admin') {
  const auth = await requireAdminOrSuperAdmin(deletedBy);
  if (auth) return auth;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { error: 'User not found.' };
  await prisma.punchLog.deleteMany({ where: { userId } });
  await prisma.wfhRequest.deleteMany({ where: { userId } });
  await prisma.regularizationRequest.deleteMany({ where: { userId } });
  await prisma.leaveRequest.deleteMany({ where: { userId } });
  await prisma.leaveBalance.deleteMany({ where: { userId } });
  await prisma.dailyLog.deleteMany({ where: { userId } });
  await prisma.monthRecord.deleteMany({ where: { userId } });
  await prisma.userManager.deleteMany({ where: { userId } });
  await prisma.userManager.deleteMany({ where: { managerUserId: userId } });
  await prisma.user.delete({ where: { id: userId } });
  await logAction(deletedBy, 'user_deleted', 'user', userId, `Deleted user "${user?.username}"`);
  return { success: true };
}

export async function toggleDisableUser(userId, performedBy = 'admin') {
  const auth = await requireAdminOrSuperAdmin(performedBy);
  if (auth) return auth;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { error: 'User not found.' };
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { disabled: !user.disabled }
  });
  const action = updated.disabled ? 'user_disabled' : 'user_enabled';
  await logAction(performedBy, action, 'user', userId, `${action === 'user_disabled' ? 'Disabled' : 'Enabled'} user "${user.username}"`);
  return { success: true, disabled: updated.disabled };
}

export async function updateUser(userId, fields, updatedBy = 'admin') {
  const auth = await requireAdminOrSuperAdmin(updatedBy);
  if (auth) return auth;
  const data = {};
  if (fields.password) data.password = await bcrypt.hash(fields.password, 10);
  if (fields.code !== undefined) data.code = fields.code || null;
  if (fields.name !== undefined) data.name = fields.name;
  if (fields.role) data.role = fields.role;
  const user = await prisma.user.update({ where: { id: userId }, data });
  await logAction(updatedBy, 'user_updated', 'user', userId, `Updated user "${user.username}"`);
  return { user: { id: user.id, username: user.username, role: user.role, code: user.code } };
}

export async function changePassword(userId, currentPassword, newPassword) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { error: 'User not found.' };

  const valid = user.password.startsWith('$2')
    ? await bcrypt.compare(currentPassword, user.password)
    : user.password === currentPassword;

  if (!valid) return { error: 'Current password is incorrect.' };

  const hashed = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { password: hashed } });
  await logAction(user.username, 'password_changed', 'user', userId, 'Password changed');
  return { success: true };
}

export async function promoteToAdmin(userId, role, performedBy = 'admin') {
  const auth = await requireAdminOrSuperAdmin(performedBy);
  if (auth) return auth;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { error: 'User not found.' };
  if (!user.code) return { error: 'Selected user has no employee code. Cannot promote.' };
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role }
  });
  await logAction(performedBy, 'user_promoted', 'user', userId,
    `Promoted "${user.username}" (${user.code}) to ${role}`);
  return { success: true, user: { id: updated.id, username: updated.username, role: updated.role, code: updated.code, name: updated.name } };
}

export async function ensureAdminExists() {
  try {
    const count = await prisma.user.count({ where: { role: 'super_admin' } });
    if (count === 0) {
      const hashed = await bcrypt.hash('admin123', 10);
      await prisma.user.create({
        data: { username: 'superadmin', password: hashed, role: 'super_admin', email: 'superadmin@interactivebees.com', name: 'Super Admin' }
      });
    } else {
      const superAdmins = await prisma.user.findMany({ where: { role: 'super_admin', email: null } });
      for (const sa of superAdmins) {
        await prisma.user.update({ where: { id: sa.id }, data: { email: 'superadmin@interactivebees.com', name: sa.name || 'Super Admin' } });
      }
    }
  } catch (e) {
    console.error('[ensureAdminExists error]', e.message);
  }
}

export async function createPendingChange(requestedBy, action, payload) {
  const change = await prisma.pendingChange.create({
    data: { requestedBy, action, payload: JSON.stringify(payload), status: 'pending' }
  });
  return { change };
}

export async function getPendingChanges() {
  return prisma.pendingChange.findMany({ where: { status: 'pending' }, orderBy: { createdAt: 'desc' } });
}

export async function reviewPendingChange(changeId, reviewedBy, approve) {
  const auth = await requireSuperAdmin(reviewedBy);
  if (auth) return auth;
  const change = await prisma.pendingChange.update({
    where: { id: changeId },
    data: { status: approve ? 'approved' : 'rejected', reviewedBy, reviewedAt: new Date() }
  });
  await logAction(reviewedBy, approve ? 'change_approved' : 'change_rejected', 'pending_change', changeId,
    `${approve ? 'Approved' : 'Rejected'} change: ${change.action}`);
  return { change, payload: JSON.parse(change.payload) };
}

export async function getPendingChangesHistory() {
  return prisma.pendingChange.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
}
