"use server";

import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import { logAction } from './audit';

export async function loginUser(username, password) {
  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return { error: 'Invalid username or password.' };

    // Support both bcrypt-hashed and legacy plain-text passwords
    const valid = user.password.startsWith('$2')
      ? await bcrypt.compare(password, user.password)
      : user.password === password;

    if (!valid) return { error: 'Invalid username or password.' };
    return { user: { id: user.id, username: user.username, role: user.role, employeeCode: user.employeeCode ?? null } };
  } catch (e) {
    console.error('[loginUser error]', e.message);
    return { error: 'Server error: ' + e.message };
  }
}

export async function createUser(username, password, role, employeeCode, createdBy = 'system') {
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) return { error: 'Username already exists.' };

  if (role === 'employee' && employeeCode) {
    const emp = await prisma.employee.findUnique({ where: { code: employeeCode } });
    if (!emp) return { error: `Employee code "${employeeCode}" not found.` };
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { username, password: hashed, role, employeeCode: role === 'employee' ? (employeeCode || null) : null }
  });
  await logAction(createdBy, 'user_created', 'user', user.id, `Created user "${username}" with role "${role}"`);
  return { user: { id: user.id, username: user.username, role: user.role, employeeCode: user.employeeCode } };
}

export async function getUsers() {
  return prisma.user.findMany({
    select: { id: true, username: true, role: true, employeeCode: true, createdAt: true },
    orderBy: { createdAt: 'asc' }
  });
}

export async function deleteUser(userId, deletedBy = 'admin') {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  await prisma.user.delete({ where: { id: userId } });
  await logAction(deletedBy, 'user_deleted', 'user', userId, `Deleted user "${user?.username}"`);
  return { success: true };
}

export async function updateUser(userId, fields, updatedBy = 'admin') {
  const data = {};
  if (fields.password) data.password = await bcrypt.hash(fields.password, 10);
  if (fields.employeeCode !== undefined) data.employeeCode = fields.employeeCode || null;
  if (fields.role) data.role = fields.role;
  const user = await prisma.user.update({ where: { id: userId }, data });
  await logAction(updatedBy, 'user_updated', 'user', userId, `Updated user "${user.username}"`);
  return { user: { id: user.id, username: user.username, role: user.role, employeeCode: user.employeeCode } };
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

export async function ensureAdminExists() {
  try {
    const count = await prisma.user.count({ where: { role: 'super_admin' } });
    if (count === 0) {
      const hashed = await bcrypt.hash('admin123', 10);
      await prisma.user.create({ data: { username: 'superadmin', password: hashed, role: 'super_admin' } });
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
