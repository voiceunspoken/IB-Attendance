"use server";

import { prisma } from '../lib/prisma';

export async function getEmployeeDetails(code) {
  return prisma.employee.findUnique({
    where: { code },
    select: { id: true, code: true, name: true, birthday: true, workAnniversary: true }
  });
}

export async function updateEmployeeDetails(code, fields) {
  const data = {};
  if (fields.birthday !== undefined) data.birthday = fields.birthday ? new Date(fields.birthday) : null;
  if (fields.workAnniversary !== undefined) data.workAnniversary = fields.workAnniversary ? new Date(fields.workAnniversary) : null;

  await prisma.employee.update({ where: { code }, data });
  return { success: true };
}
