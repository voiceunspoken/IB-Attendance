"use server";

import { prisma } from '../lib/prisma';

export async function loginUser(username, password) {
  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || user.password !== password) {
      return { error: 'Invalid username or password.' };
    }
    return {
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        employeeCode: user.employeeCode ?? null,
      }
    };
  } catch (e) {
    console.error('[loginUser error]', e.message);
    return { error: 'Server error: ' + e.message };
  }
}

export async function createUser(username, password, role, employeeCode) {
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) return { error: 'Username already exists.' };

  if (role === 'employee' && employeeCode) {
    const emp = await prisma.employee.findUnique({ where: { code: employeeCode } });
    if (!emp) return { error: `Employee code "${employeeCode}" not found.` };
  }

  const user = await prisma.user.create({
    data: {
      username,
      password,
      role,
      employeeCode: role === 'employee' ? (employeeCode || null) : null,
    }
  });

  return { user: { id: user.id, username: user.username, role: user.role, employeeCode: user.employeeCode } };
}

export async function getUsers() {
  return prisma.user.findMany({
    select: { id: true, username: true, role: true, employeeCode: true, createdAt: true },
    orderBy: { createdAt: 'asc' }
  });
}

export async function deleteUser(userId) {
  await prisma.user.delete({ where: { id: userId } });
  return { success: true };
}

export async function updateUser(userId, fields) {
  const data = {};
  if (fields.password) data.password = fields.password;
  if (fields.employeeCode !== undefined) data.employeeCode = fields.employeeCode || null;
  if (fields.role) data.role = fields.role;
  const user = await prisma.user.update({ where: { id: userId }, data });
  return { user: { id: user.id, username: user.username, role: user.role, employeeCode: user.employeeCode } };
}

// Seed default super_admin if none exists
export async function ensureAdminExists() {
  try {
    const count = await prisma.user.count({ where: { role: 'super_admin' } });
    if (count === 0) {
      await prisma.user.create({
        data: { username: 'superadmin', password: 'admin123', role: 'super_admin' }
      });
    }
  } catch (e) {
    console.error('[ensureAdminExists error]', e.message);
  }
}

// Pending changes (admin actions awaiting super_admin approval)
export async function createPendingChange(requestedBy, action, payload) {
  const change = await prisma.pendingChange.create({
    data: { requestedBy, action, payload: JSON.stringify(payload), status: 'pending' }
  });
  return { change };
}

export async function getPendingChanges() {
  return prisma.pendingChange.findMany({
    where: { status: 'pending' },
    orderBy: { createdAt: 'desc' }
  });
}

export async function reviewPendingChange(changeId, reviewedBy, approve) {
  const change = await prisma.pendingChange.update({
    where: { id: changeId },
    data: {
      status: approve ? 'approved' : 'rejected',
      reviewedBy,
      reviewedAt: new Date(),
    }
  });
  return { change, payload: JSON.parse(change.payload) };
}

export async function getPendingChangesHistory() {
  return prisma.pendingChange.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100
  });
}
