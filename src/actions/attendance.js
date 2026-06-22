"use server";

import { prisma } from '../lib/prisma';
import { revalidatePath } from 'next/cache';
import { logAction } from './audit';
import { sendHighAbsenceAlert } from './notifications';
import bcrypt from 'bcryptjs';
import { requireAdmin } from '../lib/auth-guard';

const ABSENCE_ALERT_THRESHOLD = 3;

function slug(name) {
  return name.toLowerCase().replace(/\s+/g, '');
}

async function generateUsername(name) {
  let base = slug(name);
  let username = base;
  let counter = 1;
  while (await prisma.user.findUnique({ where: { username } })) {
    username = base + (++counter);
  }
  return username;
}

export async function getMonths() {
  const records = await prisma.monthRecord.findMany({
    select: { monthYear: true },
    distinct: ['monthYear'],
  });
  return records.map(r => r.monthYear).sort((a, b) => {
    const [ma, ya] = a.split('_').map(Number);
    const [mb, yb] = b.split('_').map(Number);
    if (ya !== yb) return yb - ya;
    return mb - ma;
  });
}

export async function uploadMonthData(monthYear, parsedResults, numDays, performedBy = null) {
  const auth = await requireAdmin(performedBy);
  if (auth) return auth;
  const createdUsernames = [];

  const processedUserIds = new Set();

  for (const r of parsedResults) {
    const user = await prisma.user.upsert({
      where: { code: r.code },
      update: { name: r.name },
      create: { code: r.code, name: r.name, username: r.code, password: '' },
    });
    processedUserIds.add(user.id);

    if (!user.username || user.username === user.code) {
      const username = await generateUsername(r.name);
      await prisma.user.update({ where: { id: user.id }, data: { username } });
      const hashed = await bcrypt.hash('Welcome@123', 10);
      await prisma.user.update({ where: { id: user.id }, data: { password: hashed, role: 'employee' } });
      createdUsernames.push({ code: r.code, name: r.name, username });
    }

    // Upsert each daily log — skip days where web punch data or approved WFH exists
    for (const d of r.days) {
      const dayStart = new Date(parseInt(monthYear.split('_')[1]), parseInt(monthYear.split('_')[0]) - 1, d.d, 0, 0, 0, 0);
      const dayEnd = new Date(parseInt(monthYear.split('_')[1]), parseInt(monthYear.split('_')[0]) - 1, d.d, 23, 59, 59, 999);
      const hasWebPunch = await prisma.punchLog.findFirst({
        where: { userId: user.id, date: { gte: dayStart, lte: dayEnd } }
      });
      if (hasWebPunch) continue;

      const workModeDate = new Date(parseInt(monthYear.split('_')[1]), parseInt(monthYear.split('_')[0]) - 1, d.d);
      const hasApprovedWorkMode = await prisma.wfhRequest.findFirst({
        where: { userId: user.id, date: workModeDate, status: 'approved' }
      });
      if (hasApprovedWorkMode) continue;

      await prisma.dailyLog.upsert({
        where: { userId_monthYear_day: { userId: user.id, monthYear, day: d.d } },
        update: {
          type: d.type, raw: d.raw || '',
          inT: d.inT ?? null, outT: d.outT ?? null,
          isLate: d.isLate || false, isSS: d.isSS || false,
          isSL: d.isSL || false, hdReason: d.hdReason || null,
        },
        create: {
          userId: user.id, monthYear, day: d.d,
          type: d.type, raw: d.raw || '',
          inT: d.inT ?? null, outT: d.outT ?? null,
          isLate: d.isLate || false, isSS: d.isSS || false,
          isSL: d.isSL || false, hdReason: d.hdReason || null,
        },
      });
    }

    await recalculateMonthRecord(user.id, monthYear, numDays);
  }

  // Also generate month records for users not in the XLSX who have DailyLogs for this month
  const allLogUsers = await prisma.dailyLog.findMany({
    where: { monthYear },
    select: { userId: true },
    distinct: ['userId']
  });
  for (const { userId } of allLogUsers) {
    if (!processedUserIds.has(userId)) {
      await recalculateMonthRecord(userId, monthYear, numDays);
    }
  }

  revalidatePath('/');

  try {
    const records = await prisma.monthRecord.findMany({
      where: { monthYear },
      include: { user: true }
    });
    for (const r of records) {
      if (r.absent >= ABSENCE_ALERT_THRESHOLD) {
        sendHighAbsenceAlert(r.user.name, r.user.code, r.absent, monthYear).catch(() => {});
      }
    }
  } catch { /* notification failure is non-critical */ }

  return { success: true, createdUsernames };
}

async function recalculateMonthRecord(userId, monthYear, numDays = 31) {
  const logs = await prisma.dailyLog.findMany({ where: { userId, monthYear } });
  let present = 0, absent = 0, halfDay = 0, late = 0, ss = 0, sl = 0, rl = 0, holi = 0, wfh = 0;
  let lateHD = 0, ssHD = 0, maxDay = 0;
  for (const log of logs) {
    maxDay = Math.max(maxDay, log.day);
    if (log.type === 'absent') { absent++; }
    else if (log.type === 'rl') { rl++; }
    else if (log.type === 'holiday') { holi++; }
    else if (log.type === 'half') { halfDay++; }
    else if (log.type === 'wfh' || log.type === 'wos' || log.type === 'wfm' || log.type === 'wfo') { wfh++; }
    else if (log.type === 'present') {
      if (log.isHD) { halfDay++; } else { present++; }
      if (log.isLate) late++;
      if (log.isSS) ss++;
      if (log.isSL) sl++;
      if (log.hdReason === 'late') lateHD++;
      if (log.hdReason === 'ss') ssHD++;
    }
  }
  await prisma.monthRecord.upsert({
    where: { userId_monthYear: { userId, monthYear } },
    update: {
      present: present + wfh, absent, halfDay,
      late, lateHD, shortShift: ss, ssHD, shortLeave: sl, rl, holi,
      numDays: maxDay || numDays,
    },
    create: {
      userId, monthYear,
      present: present + wfh, absent, halfDay,
      late, lateHD, shortShift: ss, ssHD, shortLeave: sl, rl, holi,
      numDays: maxDay || numDays,
    },
  });
}

export async function fetchDashboardData(monthYear) {
  const records = await prisma.monthRecord.findMany({
    where: { monthYear },
    include: {
      user: {
        include: {
          dailyLogs: {
            where: { monthYear }
          },
          department: { select: { id: true, name: true } },
          designation: { select: { id: true, name: true } }
        }
      }
    }
  });

  return records.map(record => {
    const days = record.user.dailyLogs.map(dl => ({
      d: dl.day,
      type: dl.type,
      raw: dl.raw,
      inT: dl.inT,
      outT: dl.outT,
      isLate: dl.isLate,
      isSS: dl.isSS,
      isSL: dl.isSL,
      isHD: dl.type === 'half',
      hdReason: dl.hdReason,
      workLocation: dl.workLocation
    }));
    const punchMissingDays = days.filter(d => d.type === 'present' && d.inT === null).map(d => ({
      day: d.d,
      inT: d.inT,
      outT: d.outT
    }));
    const punchMissing = punchMissingDays.length;
    return {
      code: record.user.code,
      name: record.user.name,
      birthday: record.user.birthday ?? null,
      joiningDate: record.user.joiningDate ?? null,
      workAnniversary: record.user.workAnniversary ?? null,
      employeeType: record.user.employeeType,
      department: record.user.department?.name ?? null,
      designation: record.user.designation?.name ?? null,
      punchMissing,
      punchMissingDays,
      present: record.present,
      absent: record.absent,
      halfDay: record.halfDay,
      late: record.late,
      lateHD: record.lateHD,
      shortShift: record.shortShift,
      ssHD: record.ssHD,
      shortLeave: record.shortLeave,
      rl: record.rl,
      holi: record.holi,
      numDays: record.numDays,
      days,
    };
  });
}

export async function getEmployeeHistory(code) {
  const user = await prisma.user.findUnique({
    where: { code },
    include: {
      records: { orderBy: { monthYear: 'desc' } },
      dailyLogs: true,
      department: { select: { id: true, name: true } },
      subDepartment: { select: { id: true, name: true } },
      designation: { select: { id: true, name: true } },
      managers: {
        include: { manager: { select: { code: true, name: true } } },
        orderBy: { priority: 'asc' }
      }
    }
  });
  if (user) {
    return {
      ...user,
      managers: user.managers.map(m => ({ code: m.manager.code, name: m.manager.name, priority: m.priority }))
    };
  }
  return user;
}

export async function addEmployee(code, name, performedBy = 'admin', extra = {}) {
  const auth = await requireAdmin(performedBy);
  if (auth) return auth;
  const existing = await prisma.user.findUnique({ where: { code } });
  if (existing) return { error: `Employee code "${code}" already exists.` };

  const username = await generateUsername(name);
  const hashed = await bcrypt.hash('Welcome@123', 10);

  const user = await prisma.user.create({
    data: {
      code, name, username, password: hashed, role: 'employee',
      employeeType: extra.employeeType || 'regular',
      joiningDate: extra.joiningDate ? new Date(extra.joiningDate) : null,
      departmentId: extra.departmentId || null,
      subDepartmentId: extra.subDepartmentId || null,
      designationId: extra.designationId || null
    }
  });
  await logAction(performedBy, 'employee_added', 'employee', user.id, `Manually added employee ${name} (${code})`);
  revalidatePath('/');
  return { user, username };
}

export async function deleteEmployee(code, performedBy = 'admin') {
  const auth = await requireAdmin(performedBy);
  if (auth) return auth;
  const user = await prisma.user.findUnique({ where: { code } });
  if (!user) return { error: 'Employee not found.' };
  await prisma.punchLog.deleteMany({ where: { userId: user.id } });
  await prisma.wfhRequest.deleteMany({ where: { userId: user.id } });
  await prisma.regularizationRequest.deleteMany({ where: { userId: user.id } });
  await prisma.leaveRequest.deleteMany({ where: { userId: user.id } });
  await prisma.leaveBalance.deleteMany({ where: { userId: user.id } });
  await prisma.dailyLog.deleteMany({ where: { userId: user.id } });
  await prisma.monthRecord.deleteMany({ where: { userId: user.id } });
  await prisma.userManager.deleteMany({ where: { userId: user.id } });
  await prisma.userManager.deleteMany({ where: { managerUserId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
  await logAction(performedBy, 'employee_deleted', 'employee', user.id, `Deleted employee ${user.name} (${code})`);
  revalidatePath('/');
  return { success: true };
}

export async function deleteMonthRecord(employeeCode, monthYear, performedBy = 'admin') {
  const auth = await requireAdmin(performedBy);
  if (auth) return auth;
  const user = await prisma.user.findUnique({ where: { code: employeeCode } });
  if (!user) return { error: 'Employee not found.' };
  await prisma.monthRecord.deleteMany({ where: { userId: user.id, monthYear } });
  await prisma.dailyLog.deleteMany({ where: { userId: user.id, monthYear } });
  await logAction(performedBy, 'month_deleted', 'employee', user.id, `Deleted ${monthYear} record for ${employeeCode}`);
  revalidatePath('/');
  return { success: true };
}

export async function getAllEmployees() {
  return prisma.user.findMany({
    where: { code: { not: null } },
    select: {
      id: true, code: true, name: true, birthday: true, joiningDate: true, workAnniversary: true,
      employeeType: true, disabled: true,
      department: { select: { id: true, name: true } },
      subDepartment: { select: { id: true, name: true } },
      designation: { select: { id: true, name: true } },
      createdAt: true
    },
    orderBy: { name: 'asc' }
  });
}

export async function updateMonthRecord(employeeCode, monthYear, fields, performedBy = 'admin') {
  const auth = await requireAdmin(performedBy);
  if (auth) return auth;
  const user = await prisma.user.findUnique({ where: { code: employeeCode } });
  if (!user) return { error: 'Employee not found.' };
  const allowed = ['present','absent','halfDay','late','lateHD','shortShift','ssHD','shortLeave','rl','holi'];
  const data = {};
  allowed.forEach(k => { if (fields[k] !== undefined) data[k] = parseInt(fields[k]) || 0; });
  await prisma.monthRecord.updateMany({ where: { userId: user.id, monthYear }, data });
  await logAction(performedBy, 'month_edited', 'employee', user.id, `Edited ${monthYear} record for ${employeeCode}`);
  revalidatePath('/');
  return { success: true };
}
