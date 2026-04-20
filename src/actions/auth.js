"use server";

import { prisma } from '../lib/prisma';

// Returns { user: { id, username, role, employeeCode } } or { error: string }
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

// Admin: create a new user account
export async function createUser(username, password, role, employeeCode) {
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) return { error: 'Username already exists.' };

  // If employee role, verify the employee code exists
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

// Admin: list all users
export async function getUsers() {
  return prisma.user.findMany({
    select: { id: true, username: true, role: true, employeeCode: true, createdAt: true },
    orderBy: { createdAt: 'asc' }
  });
}

// Admin: delete a user
export async function deleteUser(userId) {
  await prisma.user.delete({ where: { id: userId } });
  return { success: true };
}

// Admin: update user password or employeeCode
export async function updateUser(userId, fields) {
  const data = {};
  if (fields.password) data.password = fields.password;
  if (fields.employeeCode !== undefined) data.employeeCode = fields.employeeCode || null;
  if (fields.role) data.role = fields.role;

  const user = await prisma.user.update({ where: { id: userId }, data });
  return { user: { id: user.id, username: user.username, role: user.role, employeeCode: user.employeeCode } };
}

// Seed default admin if none exists
export async function ensureAdminExists() {
  try {
    const count = await prisma.user.count({ where: { role: 'admin' } });
    if (count === 0) {
      await prisma.user.create({
        data: { username: 'admin', password: 'admin123', role: 'admin' }
      });
    }
  } catch (e) {
    console.error('[ensureAdminExists error]', e.message);
  }
}
