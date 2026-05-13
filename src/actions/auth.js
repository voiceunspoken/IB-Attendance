"use server";

import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import { logAction } from './audit';
import { createSession, deleteSession, requireAdmin, requireSuperAdmin, requireAuth } from '../lib/session';

const BCRYPT_ROUNDS = 12;

export async function loginUser(username, password) {
  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return { error: 'Invalid username or password.' };

    // Support both bcrypt-hashed and legacy plain-text passwords
    const valid = user.password.startsWith('$2')
      ? await bcrypt.compare(password, user.password)
      : user.password === password;

    if (!valid) return { error: 'Invalid username or password.' };

    const sessionUser = await createSession(user);
    return { user: sessionUser };
  } catch (e) {
    console.error('[loginUser error]', e.message);
    return { error: 'Server error. Please try again.' };
  }
}

export async function logoutUser() {
  await deleteSession();
  return { success: true };
}

export async function createUser(username, password, role, employeeCode) {
  try {
    const session = await requireAdmin();

    if (role === 'super_admin' && session.role !== 'super_admin') {
      return { error: 'Only super admins can create super admin accounts.' };
    }

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) return { error: 'Username already exists.' };

    if (role === 'employee' && employeeCode) {
      const emp = await prisma.employee.findUnique({ where: { code: employeeCode } });
      if (!emp) return { error: `Employee code "${employeeCode}" not found.` };
    }

    const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await prisma.user.create({
      data: { username, password: hashed, role, employeeCode: role === 'employee' ? (employeeCode || null) : null }
    });
    await logAction(session.username, 'user_created', 'user', user.id, `Created user "${username}" with role "${role}"`);
    return { user: { id: user.id, username: user.username, role: user.role, employeeCode: user.employeeCode } };
  } catch (e) {
    if (e.message === 'Authentication required' || e.message === 'Admin access required') return { error: e.message };
    console.error('[createUser error]', e.message);
    return { error: 'Failed to create user.' };
  }
}

export async function getUsers() {
  try {
    await requireAdmin();
    return prisma.user.findMany({
      select: { id: true, username: true, role: true, employeeCode: true, createdAt: true },
      orderBy: { createdAt: 'asc' }
    });
  } catch {
    return [];
  }
}

export async function deleteUser(userId) {
  try {
    const session = await requireAdmin();
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { error: 'User not found.' };
    if (user.role === 'super_admin' && session.role !== 'super_admin') {
      return { error: 'Only super admins can delete super admin accounts.' };
    }
    await prisma.user.delete({ where: { id: userId } });
    await logAction(session.username, 'user_deleted', 'user', userId, `Deleted user "${user.username}"`);
    return { success: true };
  } catch (e) {
    if (e.message === 'Authentication required' || e.message === 'Admin access required') return { error: e.message };
    console.error('[deleteUser error]', e.message);
    return { error: 'Failed to delete user.' };
  }
}

export async function updateUser(userId, fields) {
  try {
    const session = await requireAdmin();
    const data = {};
    if (fields.password) data.password = await bcrypt.hash(fields.password, BCRYPT_ROUNDS);
    if (fields.employeeCode !== undefined) data.employeeCode = fields.employeeCode || null;
    if (fields.role) {
      if (fields.role === 'super_admin' && session.role !== 'super_admin') {
        return { error: 'Only super admins can assign super admin role.' };
      }
      data.role = fields.role;
    }
    const user = await prisma.user.update({ where: { id: userId }, data });
    await logAction(session.username, 'user_updated', 'user', userId, `Updated user "${user.username}"`);
    return { user: { id: user.id, username: user.username, role: user.role, employeeCode: user.employeeCode } };
  } catch (e) {
    if (e.message === 'Authentication required' || e.message === 'Admin access required') return { error: e.message };
    console.error('[updateUser error]', e.message);
    return { error: 'Failed to update user.' };
  }
}

export async function changePassword(userId, currentPassword, newPassword) {
  try {
    const session = await requireAuth();
    if (session.userId !== userId) return { error: 'Cannot change another user\'s password.' };

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { error: 'User not found.' };

    const valid = user.password.startsWith('$2')
      ? await bcrypt.compare(currentPassword, user.password)
      : user.password === currentPassword;

    if (!valid) return { error: 'Current password is incorrect.' };

    const hashed = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await prisma.user.update({ where: { id: userId }, data: { password: hashed } });
    await logAction(user.username, 'password_changed', 'user', userId, 'Password changed');
    return { success: true };
  } catch (e) {
    if (e.message === 'Authentication required') return { error: e.message };
    console.error('[changePassword error]', e.message);
    return { error: 'Failed to change password.' };
  }
}

export async function ensureAdminExists() {
  try {
    const count = await prisma.user.count({ where: { role: 'super_admin' } });
    if (count === 0) {
      const hashed = await bcrypt.hash('admin123', BCRYPT_ROUNDS);
      await prisma.user.create({ data: { username: 'superadmin', password: hashed, role: 'super_admin' } });
    }
  } catch (e) {
    console.error('[ensureAdminExists error]', e.message);
  }
}

export async function createPendingChange(requestedBy, action, payload) {
  try {
    await requireAdmin();
    const change = await prisma.pendingChange.create({
      data: { requestedBy, action, payload: JSON.stringify(payload), status: 'pending' }
    });
    return { change };
  } catch (e) {
    if (e.message === 'Authentication required' || e.message === 'Admin access required') return { error: e.message };
    console.error('[createPendingChange error]', e.message);
    return { error: 'Failed to create pending change.' };
  }
}

export async function getPendingChanges() {
  try {
    await requireSuperAdmin();
    return prisma.pendingChange.findMany({ where: { status: 'pending' }, orderBy: { createdAt: 'desc' } });
  } catch {
    return [];
  }
}

export async function reviewPendingChange(changeId, reviewedBy, approve) {
  try {
    const session = await requireSuperAdmin();
    const change = await prisma.pendingChange.update({
      where: { id: changeId },
      data: { status: approve ? 'approved' : 'rejected', reviewedBy, reviewedAt: new Date() }
    });
    await logAction(session.username, approve ? 'change_approved' : 'change_rejected', 'pending_change', changeId,
      `${approve ? 'Approved' : 'Rejected'} change: ${change.action}`);
    return { change, payload: JSON.parse(change.payload) };
  } catch (e) {
    if (e.message === 'Authentication required' || e.message === 'Super admin access required') return { error: e.message };
    console.error('[reviewPendingChange error]', e.message);
    return { error: 'Failed to review change.' };
  }
}

export async function getPendingChangesHistory() {
  try {
    await requireSuperAdmin();
    return prisma.pendingChange.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  } catch {
    return [];
  }
}
