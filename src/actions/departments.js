"use server";

import { prisma } from '../lib/prisma';
import { revalidatePath } from 'next/cache';

// ─── DEPARTMENT ──────────────────────────────────────────────

export async function getDepartments() {
  return prisma.department.findMany({
    include: {
      subDepartments: { orderBy: { name: 'asc' }, include: { manager: { select: { id: true, name: true, code: true } } } },
      manager: { select: { id: true, name: true, code: true } }
    },
    orderBy: { name: 'asc' }
  });
}

export async function addDepartment(name) {
  const existing = await prisma.department.findUnique({ where: { name } });
  if (existing) return { error: 'Department already exists.' };
  const dept = await prisma.department.create({ data: { name } });
  revalidatePath('/');
  return { department: dept };
}

export async function deleteDepartment(id) {
  await prisma.user.updateMany({ where: { departmentId: id }, data: { departmentId: null } });
  await prisma.subDepartment.deleteMany({ where: { departmentId: id } });
  await prisma.department.delete({ where: { id } });
  revalidatePath('/');
  return { success: true };
}

// ─── SUB DEPARTMENT ──────────────────────────────────────────

export async function addSubDepartment(name, departmentId) {
  const dept = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!dept) return { error: 'Department not found.' };
  const sub = await prisma.subDepartment.create({ data: { name, departmentId } });
  revalidatePath('/');
  return { subDepartment: sub };
}

export async function deleteSubDepartment(id) {
  await prisma.user.updateMany({ where: { subDepartmentId: id }, data: { subDepartmentId: null } });
  await prisma.subDepartment.delete({ where: { id } });
  revalidatePath('/');
  return { success: true };
}

// ─── DESIGNATION ─────────────────────────────────────────────

export async function getDesignations() {
  return prisma.designation.findMany({ orderBy: { name: 'asc' } });
}

export async function addDesignation(name) {
  const existing = await prisma.designation.findUnique({ where: { name } });
  if (existing) return { error: 'Designation already exists.' };
  const desig = await prisma.designation.create({ data: { name } });
  revalidatePath('/');
  return { designation: desig };
}

export async function deleteDesignation(id) {
  await prisma.user.updateMany({ where: { designationId: id }, data: { designationId: null } });
  await prisma.designation.delete({ where: { id } });
  revalidatePath('/');
  return { success: true };
}

// ─── MANAGER ASSIGNMENT ──────────────────────────────────────

export async function setEmployeeManagers(employeeCode, managerCodes) {
  const user = await prisma.user.findUnique({ where: { code: employeeCode } });
  if (!user) return { error: 'Employee not found' };

  await prisma.userManager.deleteMany({ where: { userId: user.id } });

  if (managerCodes && managerCodes.length > 0) {
    for (let i = 0; i < managerCodes.length; i++) {
      const mgr = await prisma.user.findUnique({ where: { code: managerCodes[i] } });
      if (mgr) {
        await prisma.userManager.create({
          data: { userId: user.id, managerUserId: mgr.id, priority: i + 1 }
        });
      }
    }
  }

  revalidatePath('/');
  return { success: true };
}

export async function getEmployeeManagers(employeeCode) {
  const user = await prisma.user.findUnique({
    where: { code: employeeCode },
    include: {
      managers: {
        include: { manager: { select: { code: true, name: true } } },
        orderBy: { priority: 'asc' }
      }
    }
  });
  if (!user) return [];
  return user.managers.map(m => ({ code: m.manager.code, name: m.manager.name, priority: m.priority }));
}

export async function getManagedEmployees(managerCode) {
  const mgr = await prisma.user.findUnique({ where: { code: managerCode } });
  if (!mgr) return [];

  const relations = await prisma.userManager.findMany({
    where: { managerUserId: mgr.id },
    include: {
      user: {
        select: { code: true, name: true, employeeType: true, department: { select: { name: true } }, designation: { select: { name: true } } }
      }
    },
    orderBy: [{ priority: 'asc' }]
  });
  return relations.map(r => ({
    code: r.user.code,
    name: r.user.name,
    employeeType: r.user.employeeType,
    department: r.user.department?.name ?? null,
    designation: r.user.designation?.name ?? null,
    priority: r.priority
  }));
}

// ─── DEPARTMENT MANAGER ──────────────────────────────────────

export async function setDepartmentManager(departmentId, managerId) {
  const dept = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!dept) return { error: 'Department not found.' };
  await prisma.department.update({
    where: { id: departmentId },
    data: { managerId: managerId || null }
  });
  revalidatePath('/');
  return { success: true };
}

export async function setSubDepartmentManager(subDepartmentId, managerId) {
  const sub = await prisma.subDepartment.findUnique({ where: { id: subDepartmentId } });
  if (!sub) return { error: 'Sub-department not found.' };
  await prisma.subDepartment.update({
    where: { id: subDepartmentId },
    data: { managerId: managerId || null }
  });
  revalidatePath('/');
  return { success: true };
}
