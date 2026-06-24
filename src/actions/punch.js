"use server";

import { prisma } from '../lib/prisma';
import { revalidatePath } from 'next/cache';
import { analyzeDayTimes, DEFAULT_POLICY } from '../utils/attendanceParser';

export async function clockIn(employeeCode, workLocation) {
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
      workLocation: workLocation || null,
      ip: null,
      userAgent: null,
    }
  });

  revalidatePath('/');
  return { success: true, punchLog: { id: punchLog.id, punchIn: punchLog.punchIn.toISOString(), workLocation: punchLog.workLocation } };
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

  // Analyze the day based on punch times
  const { isLate: rawLate, isSS: rawSS, isSL, isHD: rawHD } = analyzeDayTimes(inMinutes, outMinutes, DEFAULT_POLICY);
  let isLate = rawLate, isSS = rawSS, isHD = rawHD;
  let hdReason = null;

  // Count existing late/SS records this month for threshold conversion
  const [lateCount, ssCount] = await Promise.all([
    prisma.dailyLog.count({ where: { userId: user.id, monthYear, isLate: true } }),
    prisma.dailyLog.count({ where: { userId: user.id, monthYear, isSS: true } }),
  ]);

  if (isLate && DEFAULT_POLICY.latesPerHD > 0 && (lateCount + 1) % DEFAULT_POLICY.latesPerHD === 0) {
    isLate = false; isHD = true; hdReason = 'late';
  }
  if (isSS && DEFAULT_POLICY.ssPerHD > 0 && (ssCount + 1) % DEFAULT_POLICY.ssPerHD === 0) {
    isSS = false; isHD = true; hdReason = 'ss';
  }

  const dayType = isHD ? 'half' : (punchLog.workLocation || 'present');

  await prisma.dailyLog.upsert({
    where: { userId_monthYear_day: { userId: user.id, monthYear, day } },
    update: { type: dayType, inT: inMinutes, outT: outMinutes, raw: 'WEB', workLocation: punchLog.workLocation || null, isLate, isSS, isSL, isHD, hdReason },
    create: { userId: user.id, monthYear, day, type: dayType, inT: inMinutes, outT: outMinutes, raw: 'WEB', workLocation: punchLog.workLocation || null, isLate, isSS, isSL, isHD, hdReason },
  });

  await updateMonthRecordCounts(user.id, monthYear);

  revalidatePath('/');
  return { success: true, punchLog: { id: updated.id, punchIn: updated.punchIn.toISOString(), punchOut: updated.punchOut.toISOString(), workLocation: updated.workLocation } };
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
    workLocation: punchLog.workLocation || null,
    date: punchLog.date.toISOString(),
  };
}

async function updateMonthRecordCounts(userId, monthYear) {
  const logs = await prisma.dailyLog.findMany({ where: { userId, monthYear } });
  let present = 0, absent = 0, halfDay = 0, late = 0, ss = 0, sl = 0, rl = 0, holi = 0;
  let lateHD = 0, ssHD = 0, maxDay = 0;
  for (const log of logs) {
    maxDay = Math.max(maxDay, log.day);
    if (log.type === 'absent') absent++;
    else if (log.type === 'rl') rl++;
    else if (log.type === 'holiday') holi++;
    else if (log.type === 'half') { halfDay++; if (log.hdReason === 'late') lateHD++; if (log.hdReason === 'ss') ssHD++; }
    else if (['wfh', 'wos', 'wfm', 'wfo'].includes(log.type)) { present++; }
    else if (log.type === 'present') {
      if (log.isHD) { halfDay++; if (log.hdReason === 'late') lateHD++; if (log.hdReason === 'ss') ssHD++; }
      else { present++; }
      if (log.isLate) late++;
      if (log.isSS) ss++;
      if (log.isSL) sl++;
    }
  }
  await prisma.monthRecord.upsert({
    where: { userId_monthYear: { userId, monthYear } },
    update: { present, absent, halfDay, late, lateHD, shortShift: ss, ssHD, shortLeave: sl, rl, holi, numDays: maxDay },
    create: { userId, monthYear, present, absent, halfDay, late, lateHD, shortShift: ss, ssHD, shortLeave: sl, rl, holi, numDays: maxDay },
  });
}
