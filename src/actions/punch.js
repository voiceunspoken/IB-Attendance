"use server";

import { prisma } from '../lib/prisma';
import { revalidatePath } from 'next/cache';

export async function punchIn(employeeCode) {
  const user = await prisma.user.findUnique({ where: { code: employeeCode } });
  if (!user) return { error: 'Employee not found' };
  if (user.employeeType === 'regular') return { error: 'Regular employees must use biometric punch.' };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existing = await prisma.punchLog.findUnique({
    where: { userId_date: { userId: user.id, date: today } }
  });
  if (existing?.punchIn) return { error: 'Already punched in today.' };

  const now = new Date();
  await prisma.punchLog.upsert({
    where: { userId_date: { userId: user.id, date: today } },
    update: { punchIn: now, source: 'web' },
    create: { userId: user.id, date: today, punchIn: now, source: 'web' }
  });

  revalidatePath('/');
  return { success: true, punchIn: now.toISOString() };
}

export async function punchOut(employeeCode) {
  const user = await prisma.user.findUnique({ where: { code: employeeCode } });
  if (!user) return { error: 'Employee not found' };
  if (user.employeeType === 'regular') return { error: 'Regular employees must use biometric punch.' };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existing = await prisma.punchLog.findUnique({
    where: { userId_date: { userId: user.id, date: today } }
  });
  if (!existing?.punchIn) return { error: 'Please punch in first.' };
  if (existing?.punchOut) return { error: 'Already punched out today.' };

  const now = new Date();
  await prisma.punchLog.update({
    where: { userId_date: { userId: user.id, date: today } },
    data: { punchOut: now, source: 'web' }
  });

  revalidatePath('/');
  return { success: true, punchIn: existing.punchIn.toISOString(), punchOut: now.toISOString() };
}

export async function getTodayPunch(employeeCode) {
  const user = await prisma.user.findUnique({ where: { code: employeeCode } });
  if (!user) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return prisma.punchLog.findUnique({
    where: { userId_date: { userId: user.id, date: today } }
  });
}

export async function getPunchHistory(employeeCode, limit = 30) {
  const user = await prisma.user.findUnique({ where: { code: employeeCode } });
  if (!user) return [];

  return prisma.punchLog.findMany({
    where: { userId: user.id },
    orderBy: { date: 'desc' },
    take: limit
  });
}
