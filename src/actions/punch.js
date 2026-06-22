"use server";

import { prisma } from '../lib/prisma';
import { revalidatePath } from 'next/cache';

export async function clockIn(employeeCode) {
  const user = await prisma.user.findUnique({ where: { code: employeeCode } });
  if (!user) return { error: 'Employee not found.' };
  if (user.disabled) return { error: 'Account is disabled.' };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const existing = await prisma.punchLog.findFirst({
    where: { userId: user.id, date: { gte: todayStart, lte: todayEnd }, punchOut: null }
  });
  if (existing) return { error: 'Already clocked in. Please clock out first.' };

  const punchLog = await prisma.punchLog.create({
    data: {
      userId: user.id,
      date: new Date(),
      punchIn: new Date(),
      source: 'web',
      ip: null,
      userAgent: null,
    }
  });

  revalidatePath('/');
  return { success: true, punchLog: { id: punchLog.id, punchIn: punchLog.punchIn.toISOString() } };
}

export async function clockOut(employeeCode) {
  const user = await prisma.user.findUnique({ where: { code: employeeCode } });
  if (!user) return { error: 'Employee not found.' };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const punchLog = await prisma.punchLog.findFirst({
    where: { userId: user.id, date: { gte: todayStart, lte: todayEnd }, punchOut: null }
  });
  if (!punchLog) return { error: 'No active clock-in found for today.' };

  const now = new Date();
  const updated = await prisma.punchLog.update({
    where: { id: punchLog.id },
    data: { punchOut: now }
  });

  const inMinutes = punchLog.punchIn.getHours() * 60 + punchLog.punchIn.getMinutes();
  const outMinutes = now.getHours() * 60 + now.getMinutes();

  const monthYear = `${now.getMonth() + 1}_${now.getFullYear()}`;
  const day = now.getDate();

  const hasApprovedWfh = await prisma.wfhRequest.findFirst({
    where: { userId: user.id, date: { gte: todayStart, lte: todayEnd }, status: 'approved' }
  });

  const dayType = hasApprovedWfh ? 'wfh' : 'present';

  await prisma.dailyLog.upsert({
    where: { userId_monthYear_day: { userId: user.id, monthYear, day } },
    update: { type: dayType, inT: inMinutes, outT: outMinutes, raw: 'WEB' },
    create: { userId: user.id, monthYear, day, type: dayType, inT: inMinutes, outT: outMinutes, raw: 'WEB' },
  });

  await updateMonthRecordCounts(user.id, monthYear);

  revalidatePath('/');
  return { success: true, punchLog: { id: updated.id, punchIn: updated.punchIn.toISOString(), punchOut: updated.punchOut.toISOString() } };
}

export async function getTodayPunch(employeeCode) {
  const user = await prisma.user.findUnique({ where: { code: employeeCode } });
  if (!user) return null;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const punchLog = await prisma.punchLog.findFirst({
    where: { userId: user.id, date: { gte: todayStart, lte: todayEnd } },
    orderBy: { createdAt: 'desc' }
  });

  if (!punchLog) return null;

  return {
    id: punchLog.id,
    punchIn: punchLog.punchIn?.toISOString() || null,
    punchOut: punchLog.punchOut?.toISOString() || null,
    source: punchLog.source,
    date: punchLog.date.toISOString(),
  };
}

async function updateMonthRecordCounts(userId, monthYear) {
  const logs = await prisma.dailyLog.findMany({ where: { userId, monthYear } });
  let present = 0, absent = 0, halfDay = 0, maxDay = 0;
  for (const log of logs) {
    maxDay = Math.max(maxDay, log.day);
    if (log.type === 'absent') absent++;
    else if (log.type === 'half') halfDay++;
    else if (log.type === 'present') present++;
  }
  await prisma.monthRecord.upsert({
    where: { userId_monthYear: { userId, monthYear } },
    update: { present, absent, halfDay, numDays: maxDay },
    create: { userId, monthYear, present, absent, halfDay, numDays: maxDay },
  });
}
