"use server";

import { prisma } from '../lib/prisma';
import { revalidatePath } from 'next/cache';
import { logAction } from './audit';
import { sendHighAbsenceAlert } from './notifications';
import bcrypt from 'bcryptjs';

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

export async function uploadMonthData(monthYear, parsedResults, numDays) {
  const createdUsernames = [];

  for (const r of parsedResults) {
    const user = await prisma.user.upsert({
      where: { code: r.code },
      update: { name: r.name },
      create: { code: r.code, name: r.name, username: r.code, password: '' },
    });

    if (!user.username || user.username === user.code) {
      const username = await generateUsername(r.name);
      await prisma.user.update({ where: { id: user.id }, data: { username } });
      const hashed = await bcrypt.hash('Welcome@123', 10);
      await prisma.user.update({ where: { id: user.id }, data: { password: hashed, role: 'employee' } });
      createdUsernames.push({ code: r.code, name: r.name, username });
    }

    await prisma.monthRecord.upsert({
      where: { userId_monthYear: { userId: user.id, monthYear } },
      update: {
        present: r.present, absent: r.absent, halfDay: r.halfDay,
        late: r.late, lateHD: r.lateHD, shortShift: r.shortShift,
        ssHD: r.ssHD, shortLeave: r.shortLeave, rl: r.rl, holi: r.holi, numDays
      },
      create: {
        userId: user.id, monthYear,
        present: r.present, absent: r.absent, halfDay: r.halfDay,
        late: r.late, lateHD: r.lateHD, shortShift: r.shortShift,
        ssHD: r.ssHD, shortLeave: r.shortLeave, rl: r.rl, holi: r.holi, numDays
      }
    });

    await prisma.dailyLog.deleteMany({
      where: { userId: user.id, monthYear }
    });

    const dailyLogData = r.days.map(d => ({
      userId: user.id,
      monthYear,
      day: d.d,
      type: d.type,
      raw: d.raw || "",
      inT: d.inT ?? null,
      outT: d.outT ?? null,
      isLate: d.isLate || false,
      isSS: d.isSS || false,
      isSL: d.isSL || false,
      hdReason: d.hdReason || null
    }));

    const chunkSize = 50;
    for (let i = 0; i < dailyLogData.length; i += chunkSize) {
      const chunk = dailyLogData.slice(i, i + chunkSize);
      if (chunk.length > 0) {
        await prisma.dailyLog.createMany({ data: chunk });
      }
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
  } catch { }

  return { success: true, createdUsernames };
}

export async function fetchDashboardData(monthYear) {
  const records = await prisma.monthRecord.findMany({
    where: { monthYear },
    include: {
      user: {
        include: {
          overrides: {
            where: { monthYear }
          },
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
      hdReason: dl.hdReason
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
      overrides: record.user.overrides.reduce((acc, ov) => {
        acc[`${record.user.code}_${ov.day}`] = ov.type;
        return acc;
      }, {})
    };
  });
}

export async function toggleOverride(employeeCode, monthYear, day, type, performedBy = 'admin') {
  const user = await prisma.user.findUnique({ where: { code: employeeCode } });
  if (!user) return { error: "Employee not found" };

  if (type === 'clear') {
    await prisma.override.deleteMany({ where: { userId: user.id, monthYear, day } });
    await logAction(performedBy, 'override_cleared', 'employee', user.id, `Cleared override for ${employeeCode} day ${day} ${monthYear}`);
  } else {
    await prisma.override.upsert({
      where: { userId_monthYear_day: { userId: user.id, monthYear, day } },
      update: { type },
      create: { userId: user.id, monthYear, day, type }
    });
    await logAction(performedBy, 'override_applied', 'employee', user.id, `Applied ${type} override for ${employeeCode} day ${day} ${monthYear}`);
  }
  revalidatePath('/');
  return { success: true };
}

export async function clearAllOverrides(employeeCode, monthYear, performedBy = 'admin') {
  const user = await prisma.user.findUnique({ where: { code: employeeCode } });
  if (!user) return { error: "Employee not found" };
  await prisma.override.deleteMany({ where: { userId: user.id, monthYear } });
  await logAction(performedBy, 'overrides_cleared_all', 'employee', user.id, `Cleared all overrides for ${employeeCode} ${monthYear}`);
  revalidatePath('/');
  return { success: true };
}

export async function getEmployeeHistory(code) {
  const user = await prisma.user.findUnique({
    where: { code },
    include: {
      records: { orderBy: { monthYear: 'desc' } },
      overrides: true,
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
  const user = await prisma.user.findUnique({ where: { code } });
  if (!user) return { error: 'Employee not found.' };
  await prisma.punchLog.deleteMany({ where: { userId: user.id } });
  await prisma.regularizationRequest.deleteMany({ where: { userId: user.id } });
  await prisma.leaveRequest.deleteMany({ where: { userId: user.id } });
  await prisma.leaveBalance.deleteMany({ where: { userId: user.id } });
  await prisma.override.deleteMany({ where: { userId: user.id } });
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
  const user = await prisma.user.findUnique({ where: { code: employeeCode } });
  if (!user) return { error: 'Employee not found.' };
  await prisma.monthRecord.deleteMany({ where: { userId: user.id, monthYear } });
  await prisma.dailyLog.deleteMany({ where: { userId: user.id, monthYear } });
  await prisma.override.deleteMany({ where: { userId: user.id, monthYear } });
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
