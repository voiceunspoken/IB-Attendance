"use server";

import { prisma } from '../lib/prisma';
import { revalidatePath } from 'next/cache';

export async function punchIn(employeeCode) {
  const emp = await prisma.employee.findUnique({ where: { code: employeeCode } });
  if (!emp) return { error: 'Employee not found' };
  if (emp.employeeType === 'regular') return { error: 'Regular employees must use biometric punch.' };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existing = await prisma.punchLog.findUnique({
    where: { employeeId_date: { employeeId: emp.id, date: today } }
  });
  if (existing?.punchIn) return { error: 'Already punched in today.' };

  const now = new Date();
  await prisma.punchLog.upsert({
    where: { employeeId_date: { employeeId: emp.id, date: today } },
    update: { punchIn: now, source: 'web' },
    create: { employeeId: emp.id, date: today, punchIn: now, source: 'web' }
  });

  revalidatePath('/');
  return { success: true, punchIn: now.toISOString() };
}

export async function punchOut(employeeCode) {
  const emp = await prisma.employee.findUnique({ where: { code: employeeCode } });
  if (!emp) return { error: 'Employee not found' };
  if (emp.employeeType === 'regular') return { error: 'Regular employees must use biometric punch.' };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existing = await prisma.punchLog.findUnique({
    where: { employeeId_date: { employeeId: emp.id, date: today } }
  });
  if (!existing?.punchIn) return { error: 'Please punch in first.' };
  if (existing?.punchOut) return { error: 'Already punched out today.' };

  const now = new Date();
  await prisma.punchLog.update({
    where: { employeeId_date: { employeeId: emp.id, date: today } },
    data: { punchOut: now, source: 'web' }
  });

  revalidatePath('/');
  return { success: true, punchIn: existing.punchIn.toISOString(), punchOut: now.toISOString() };
}

export async function getTodayPunch(employeeCode) {
  const emp = await prisma.employee.findUnique({ where: { code: employeeCode } });
  if (!emp) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return prisma.punchLog.findUnique({
    where: { employeeId_date: { employeeId: emp.id, date: today } }
  });
}

export async function getPunchHistory(employeeCode, limit = 30) {
  const emp = await prisma.employee.findUnique({ where: { code: employeeCode } });
  if (!emp) return [];

  return prisma.punchLog.findMany({
    where: { employeeId: emp.id },
    orderBy: { date: 'desc' },
    take: limit
  });
}
