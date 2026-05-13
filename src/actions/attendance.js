"use server";

import { prisma } from '../lib/prisma';
import { revalidatePath } from 'next/cache';
import { logAction } from './audit';
import { sendHighAbsenceAlert } from './notifications';
import { requireAuth, requireAdmin } from '../lib/session';

const ABSENCE_ALERT_THRESHOLD = 3;

export async function getMonths() {
  try {
    await requireAuth();
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
  } catch {
    return [];
  }
}

export async function uploadMonthData(monthYear, parsedResults, numDays) {
  try {
    const session = await requireAdmin();

    for (const r of parsedResults) {
      await prisma.$transaction(async (tx) => {
        const emp = await tx.employee.upsert({
          where: { code: r.code },
          update: { name: r.name },
          create: { code: r.code, name: r.name },
        });

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

        await tx.dailyLog.deleteMany({
          where: { employeeId: emp.id, monthYear }
        });

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

        const chunkSize = 50;
        for (let i = 0; i < dailyLogData.length; i += chunkSize) {
          const chunk = dailyLogData.slice(i, i + chunkSize);
          if (chunk.length > 0) {
            await tx.dailyLog.createMany({ data: chunk });
          }
        }
      });
    }

    await logAction(session.username, 'attendance_uploaded', 'month', monthYear, `Uploaded attendance for ${monthYear}`);
    revalidatePath('/');

    try {
      const records = await prisma.monthRecord.findMany({
        where: { monthYear },
        include: { employee: true }
      });
      for (const r of records) {
        if (r.absent >= ABSENCE_ALERT_THRESHOLD) {
          sendHighAbsenceAlert(r.employee.name, r.employee.code, r.absent, monthYear).catch(() => {});
        }
      }
    } catch (_) {}

    return { success: true };
  } catch (e) {
    if (e.message === 'Authentication required' || e.message === 'Admin access required') return { error: e.message };
    console.error('[uploadMonthData error]', e.message);
    return { error: 'Failed to upload attendance data.' };
  }
}

export async function fetchDashboardData(monthYear) {
  try {
    await requireAuth();
    const records = await prisma.monthRecord.findMany({
      where: { monthYear },
      include: {
        employee: {
          include: {
            overrides: { where: { monthYear } },
            dailyLogs: { where: { monthYear } }
          }
        }
      }
    });

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
        d: dl.day, type: dl.type, raw: dl.raw, inT: dl.inT, outT: dl.outT,
        isLate: dl.isLate, isSS: dl.isSS, isSL: dl.isSL
      })),
      overrides: record.employee.overrides.reduce((acc, ov) => {
        acc[`${record.employee.code}_${ov.day}`] = ov.type;
        return acc;
      }, {})
    }));
  } catch {
    return [];
  }
}

export async function toggleOverride(employeeCode, monthYear, day, type) {
  try {
    const session = await requireAdmin();
    const emp = await prisma.employee.findUnique({ where: { code: employeeCode } });
    if (!emp) return { error: "Employee not found" };

    if (type === 'clear') {
      await prisma.override.deleteMany({ where: { employeeId: emp.id, monthYear, day } });
      await logAction(session.username, 'override_cleared', 'employee', emp.id, `Cleared override for ${employeeCode} day ${day} ${monthYear}`);
    } else {
      await prisma.override.upsert({
        where: { employeeId_monthYear_day: { employeeId: emp.id, monthYear, day } },
        update: { type },
        create: { employeeId: emp.id, monthYear, day, type }
      });
      await logAction(session.username, 'override_applied', 'employee', emp.id, `Applied ${type} override for ${employeeCode} day ${day} ${monthYear}`);
    }
    revalidatePath('/');
    return { success: true };
  } catch (e) {
    if (e.message === 'Authentication required' || e.message === 'Admin access required') return { error: e.message };
    console.error('[toggleOverride error]', e.message);
    return { error: 'Failed to toggle override.' };
  }
}

export async function clearAllOverrides(employeeCode, monthYear) {
  try {
    const session = await requireAdmin();
    const emp = await prisma.employee.findUnique({ where: { code: employeeCode } });
    if (!emp) return { error: "Employee not found" };
    await prisma.override.deleteMany({ where: { employeeId: emp.id, monthYear } });
    await logAction(session.username, 'overrides_cleared_all', 'employee', emp.id, `Cleared all overrides for ${employeeCode} ${monthYear}`);
    revalidatePath('/');
    return { success: true };
  } catch (e) {
    if (e.message === 'Authentication required' || e.message === 'Admin access required') return { error: e.message };
    console.error('[clearAllOverrides error]', e.message);
    return { error: 'Failed to clear overrides.' };
  }
}

export async function getEmployeeHistory(code) {
  try {
    const session = await requireAuth();
    if (session.role === 'employee' && session.employeeCode !== code) {
      return null;
    }
    const emp = await prisma.employee.findUnique({
      where: { code },
      include: {
        records: { orderBy: { monthYear: 'desc' } },
        overrides: true,
        dailyLogs: true
      }
    });
    return emp;
  } catch {
    return null;
  }
}

export async function addEmployee(code, name) {
  try {
    const session = await requireAdmin();
    const existing = await prisma.employee.findUnique({ where: { code } });
    if (existing) return { error: `Employee code "${code}" already exists.` };
    const emp = await prisma.employee.create({ data: { code, name } });
    await logAction(session.username, 'employee_added', 'employee', emp.id, `Manually added employee ${name} (${code})`);
    revalidatePath('/');
    return { employee: emp };
  } catch (e) {
    if (e.message === 'Authentication required' || e.message === 'Admin access required') return { error: e.message };
    console.error('[addEmployee error]', e.message);
    return { error: 'Failed to add employee.' };
  }
}

export async function deleteEmployee(code) {
  try {
    const session = await requireAdmin();
    const emp = await prisma.employee.findUnique({ where: { code } });
    if (!emp) return { error: 'Employee not found.' };
    await prisma.employee.delete({ where: { code } });
    await logAction(session.username, 'employee_deleted', 'employee', emp.id, `Deleted employee ${emp.name} (${code})`);
    revalidatePath('/');
    return { success: true };
  } catch (e) {
    if (e.message === 'Authentication required' || e.message === 'Admin access required') return { error: e.message };
    console.error('[deleteEmployee error]', e.message);
    return { error: 'Failed to delete employee.' };
  }
}

export async function deleteMonthRecord(employeeCode, monthYear) {
  try {
    const session = await requireAdmin();
    const emp = await prisma.employee.findUnique({ where: { code: employeeCode } });
    if (!emp) return { error: 'Employee not found.' };
    await prisma.$transaction([
      prisma.monthRecord.deleteMany({ where: { employeeId: emp.id, monthYear } }),
      prisma.dailyLog.deleteMany({ where: { employeeId: emp.id, monthYear } }),
      prisma.override.deleteMany({ where: { employeeId: emp.id, monthYear } }),
    ]);
    await logAction(session.username, 'month_deleted', 'employee', emp.id, `Deleted ${monthYear} record for ${employeeCode}`);
    revalidatePath('/');
    return { success: true };
  } catch (e) {
    if (e.message === 'Authentication required' || e.message === 'Admin access required') return { error: e.message };
    console.error('[deleteMonthRecord error]', e.message);
    return { error: 'Failed to delete month record.' };
  }
}

export async function getAllEmployees() {
  try {
    await requireAdmin();
    return prisma.employee.findMany({
      select: { id: true, code: true, name: true, birthday: true, workAnniversary: true, createdAt: true },
      orderBy: { name: 'asc' }
    });
  } catch {
    return [];
  }
}

export async function updateMonthRecord(employeeCode, monthYear, fields) {
  try {
    const session = await requireAdmin();
    const emp = await prisma.employee.findUnique({ where: { code: employeeCode } });
    if (!emp) return { error: 'Employee not found.' };
    const allowed = ['present','absent','late','lateHD','shortShift','ssHD','shortLeave','rl','holi'];
    const data = {};
    allowed.forEach(k => { if (fields[k] !== undefined && fields[k] !== '') data[k] = parseInt(fields[k]) || 0; });
    // Recalculate halfDay from lateHD + ssHD
    if (data.lateHD !== undefined || data.ssHD !== undefined) {
      const existing = await prisma.monthRecord.findFirst({ where: { employeeId: emp.id, monthYear } });
      const lateHD = data.lateHD ?? existing?.lateHD ?? 0;
      const ssHD = data.ssHD ?? existing?.ssHD ?? 0;
      data.halfDay = lateHD + ssHD;
    }
    await prisma.monthRecord.updateMany({ where: { employeeId: emp.id, monthYear }, data });
    await logAction(session.username, 'month_edited', 'employee', emp.id, `Edited ${monthYear} record for ${employeeCode}`);
    revalidatePath('/');
    return { success: true };
  } catch (e) {
    if (e.message === 'Authentication required' || e.message === 'Admin access required') return { error: e.message };
    console.error('[updateMonthRecord error]', e.message);
    return { error: 'Failed to update month record.' };
  }
}
