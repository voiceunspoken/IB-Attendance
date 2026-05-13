"use server";

import { prisma } from '../lib/prisma';
import { requireAuth, requireAdmin } from '../lib/session';

export async function getEmployeeDetails(code) {
  try {
    const session = await requireAuth();
    if (session.role === 'employee' && session.employeeCode !== code) return null;
    return prisma.employee.findUnique({
      where: { code },
      select: { id: true, code: true, name: true, birthday: true, workAnniversary: true }
    });
  } catch {
    return null;
  }
}

export async function updateEmployeeDetails(code, fields) {
  try {
    await requireAdmin();
    const data = {};
    if (fields.birthday !== undefined) data.birthday = fields.birthday ? new Date(fields.birthday) : null;
    if (fields.workAnniversary !== undefined) data.workAnniversary = fields.workAnniversary ? new Date(fields.workAnniversary) : null;

    await prisma.employee.update({ where: { code }, data });
    return { success: true };
  } catch (e) {
    if (e.message === 'Authentication required' || e.message === 'Admin access required') return { error: e.message };
    console.error('[updateEmployeeDetails error]', e.message);
    return { error: 'Failed to update employee details.' };
  }
}
