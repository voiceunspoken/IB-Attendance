"use server";

import { prisma } from '../lib/prisma';
import { requireAdminOrSuperAdmin } from '../lib/auth-guard';

export async function getCombinedReportData(monthYear, employeeCodes = null, performedBy = null) {
  const auth = await requireAdminOrSuperAdmin(performedBy);
  if (auth) return { error: 'Unauthorized' };

  const userWhere = employeeCodes && employeeCodes.length > 0
    ? { code: { in: employeeCodes } }
    : { code: { not: null } };

  const [mo, yr] = monthYear.split('_').map(Number);
  const monthStart = new Date(yr, mo - 1, 1);
  const monthEnd = new Date(yr, mo, 0, 23, 59, 59, 999);

  const users = await prisma.user.findMany({
    where: userWhere,
    include: {
      records: {
        where: { monthYear },
        take: 1,
      },
      dailyLogs: {
        where: { monthYear },
        orderBy: { day: 'asc' },
      },
      punchLogs: {
        where: {
          date: { gte: monthStart, lte: monthEnd },
        },
        orderBy: { date: 'asc' },
      },
      department: { select: { name: true } },
      subDepartment: { select: { name: true } },
      designation: { select: { name: true } },
    },
    orderBy: { name: 'asc' },
  });

  return users.map(u => ({
    code: u.code,
    name: u.name,
    email: u.email,
    employeeType: u.employeeType,
    department: u.department?.name || null,
    subDepartment: u.subDepartment?.name || null,
    designation: u.designation?.name || null,
    birthday: u.birthday ? u.birthday.toISOString().split('T')[0] : null,
    joiningDate: u.joiningDate ? u.joiningDate.toISOString().split('T')[0] : null,
    workAnniversary: u.workAnniversary ? u.workAnniversary.toISOString().split('T')[0] : null,
    record: u.records[0] || null,
    dailyLogs: u.dailyLogs.map(dl => ({
      day: dl.day,
      type: dl.type,
      raw: dl.raw,
      inT: dl.inT,
      outT: dl.outT,
      isLate: dl.isLate,
      isSS: dl.isSS,
      isSL: dl.isSL,
      isHD: dl.isHD,
      hdReason: dl.hdReason,
      workLocation: dl.workLocation,
    })),
    punchLogs: u.punchLogs.map(pl => ({
      date: pl.date.toISOString(),
      punchIn: pl.punchIn ? pl.punchIn.toISOString() : null,
      punchOut: pl.punchOut ? pl.punchOut.toISOString() : null,
      source: pl.source,
      ip: pl.ip,
      userAgent: pl.userAgent,
      workLocation: pl.workLocation,
    })),
  }));
}
