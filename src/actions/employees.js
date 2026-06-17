"use server";

import { prisma } from '../lib/prisma';
import { revalidatePath } from 'next/cache';

export async function getEmployeeDetails(code) {
  return prisma.user.findUnique({
    where: { code },
    select: {
      id: true, code: true, name: true, birthday: true, joiningDate: true, workAnniversary: true,
      employeeType: true,
      departmentId: true, department: { select: { id: true, name: true } },
      subDepartmentId: true, subDepartment: { select: { id: true, name: true } },
      designationId: true, designation: { select: { id: true, name: true } }
    }
  });
}

export async function updateEmployeeDetails(code, fields) {
  const data = {};
  if (fields.name !== undefined) data.name = fields.name;
  if (fields.birthday !== undefined) data.birthday = fields.birthday ? new Date(fields.birthday) : null;
  if (fields.joiningDate !== undefined) data.joiningDate = fields.joiningDate ? new Date(fields.joiningDate) : null;
  if (fields.workAnniversary !== undefined) data.workAnniversary = fields.workAnniversary ? new Date(fields.workAnniversary) : null;
  if (fields.employeeType !== undefined) data.employeeType = fields.employeeType;
  if (fields.departmentId !== undefined) data.departmentId = fields.departmentId || null;
  if (fields.subDepartmentId !== undefined) data.subDepartmentId = fields.subDepartmentId || null;
  if (fields.designationId !== undefined) data.designationId = fields.designationId || null;

  await prisma.user.update({ where: { code }, data });
  revalidatePath('/');
  return { success: true };
}
