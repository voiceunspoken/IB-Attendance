"use server";

import { prisma } from '../lib/prisma';
import { revalidatePath } from 'next/cache';
import { logAction } from './audit';

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
  // We use a transaction to ensure all or nothing
  await prisma.$transaction(async (tx) => {
    for (const r of parsedResults) {
      // Upsert Employee
      const emp = await tx.employee.upsert({
        where: { code: r.code },
        update: { name: r.name },
        create: { code: r.code, name: r.name },
      });

      // Upsert MonthRecord
      await tx.monthRecord.upsert({
        where: { employeeId_monthYear: { employeeId: emp.id, monthYear } },
        update: {
          present: r.present, absent: r.absent, halfDay: r.halfDay,
          late: r.late, lateHD: r.lateHD, shortShift: r.shortShift,
          ssHD: r.ssHD, shortLeave: r.shortLeave, rl: r.rl, holi: r.holi, numDays
        },
        create: {
          employeeId: emp.id, monthYear,
          present: r.present, absent: r.absent, halfDay: r.halfDay,
          late: r.late, lateHD: r.lateHD, shortShift: r.shortShift,
          ssHD: r.ssHD, shortLeave: r.shortLeave, rl: r.rl, holi: r.holi, numDays
        }
      });

      // Delete existing daily logs to prevent duplication
      await tx.dailyLog.deleteMany({
        where: { employeeId: emp.id, monthYear }
      });

      // Insert new daily logs
      const dailyLogData = r.days.map(d => ({
        employeeId: emp.id,
        monthYear,
        day: d.d,
        type: d.type,
        raw: d.raw || "",
        inT: d.inT ?? null,
        outT: d.outT ?? null,
        isLate: d.isLate || false,
        isSS: d.isSS || false,
        isSL: d.isSL || false
      }));

      if (dailyLogData.length > 0) {
        await tx.dailyLog.createMany({ data: dailyLogData });
      }
    }
  }, {
    maxWait: 10000, 
    timeout: 30000 
  });
  
  revalidatePath('/');
  return { success: true };
}

export async function fetchDashboardData(monthYear) {
  const records = await prisma.monthRecord.findMany({
    where: { monthYear },
    include: {
      employee: {
        include: {
          overrides: {
            where: { monthYear }
          },
          dailyLogs: {
            where: { monthYear }
          }
        }
      }
    }
  });

  // Map into our flattened standard result format
  return records.map(record => ({
    code: record.employee.code,
    name: record.employee.name,
    birthday: record.employee.birthday ?? null,
    workAnniversary: record.employee.workAnniversary ?? null,
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
    days: record.employee.dailyLogs.map(dl => ({
      d: dl.day,
      type: dl.type,
      raw: dl.raw,
      inT: dl.inT,
      outT: dl.outT,
      isLate: dl.isLate,
      isSS: dl.isSS,
      isSL: dl.isSL
    })),
    overrides: record.employee.overrides.reduce((acc, ov) => {
      acc[`${record.employee.code}_${ov.day}`] = ov.type;
      return acc;
    }, {})
  }));
}

export async function toggleOverride(employeeCode, monthYear, day, type, performedBy = 'admin') {
  const emp = await prisma.employee.findUnique({ where: { code: employeeCode } });
  if (!emp) return { error: "Employee not found" };

  if (type === 'clear') {
    await prisma.override.deleteMany({ where: { employeeId: emp.id, monthYear, day } });
    await logAction(performedBy, 'override_cleared', 'employee', emp.id, `Cleared override for ${employeeCode} day ${day} ${monthYear}`);
  } else {
    await prisma.override.upsert({
      where: { employeeId_monthYear_day: { employeeId: emp.id, monthYear, day } },
      update: { type },
      create: { employeeId: emp.id, monthYear, day, type }
    });
    await logAction(performedBy, 'override_applied', 'employee', emp.id, `Applied ${type} override for ${employeeCode} day ${day} ${monthYear}`);
  }
  revalidatePath('/');
  return { success: true };
}

export async function clearAllOverrides(employeeCode, monthYear, performedBy = 'admin') {
  const emp = await prisma.employee.findUnique({ where: { code: employeeCode } });
  if (!emp) return { error: "Employee not found" };
  await prisma.override.deleteMany({ where: { employeeId: emp.id, monthYear } });
  await logAction(performedBy, 'overrides_cleared_all', 'employee', emp.id, `Cleared all overrides for ${employeeCode} ${monthYear}`);
  revalidatePath('/');
  return { success: true };
}

export async function getEmployeeHistory(code) {
  const emp = await prisma.employee.findUnique({
    where: { code },
    include: {
      records: { orderBy: { monthYear: 'desc' } },
      overrides: true,
      dailyLogs: true
    }
  });
  return emp;
}

// Phase 13 — Admin: manually add employee
export async function addEmployee(code, name, performedBy = 'admin') {
  const existing = await prisma.employee.findUnique({ where: { code } });
  if (existing) return { error: `Employee code "${code}" already exists.` };
  const emp = await prisma.employee.create({ data: { code, name } });
  await logAction(performedBy, 'employee_added', 'employee', emp.id, `Manually added employee ${name} (${code})`);
  revalidatePath('/');
  return { employee: emp };
}

// Phase 13 — Admin: delete employee and all their data
export async function deleteEmployee(code, performedBy = 'admin') {
  const emp = await prisma.employee.findUnique({ where: { code } });
  if (!emp) return { error: 'Employee not found.' };
  await prisma.employee.delete({ where: { code } });
  await logAction(performedBy, 'employee_deleted', 'employee', emp.id, `Deleted employee ${emp.name} (${code})`);
  revalidatePath('/');
  return { success: true };
}

// Phase 13 — Admin: delete a specific month record
export async function deleteMonthRecord(employeeCode, monthYear, performedBy = 'admin') {
  const emp = await prisma.employee.findUnique({ where: { code: employeeCode } });
  if (!emp) return { error: 'Employee not found.' };
  await prisma.monthRecord.deleteMany({ where: { employeeId: emp.id, monthYear } });
  await prisma.dailyLog.deleteMany({ where: { employeeId: emp.id, monthYear } });
  await prisma.override.deleteMany({ where: { employeeId: emp.id, monthYear } });
  await logAction(performedBy, 'month_deleted', 'employee', emp.id, `Deleted ${monthYear} record for ${employeeCode}`);
  revalidatePath('/');
  return { success: true };
}

// Phase 13 — Get all employees (for admin management)
export async function getAllEmployees() {
  return prisma.employee.findMany({
    select: { id: true, code: true, name: true, birthday: true, workAnniversary: true, createdAt: true },
    orderBy: { name: 'asc' }
  });
}
