"use server";

import { prisma } from '../lib/prisma';
import { revalidatePath } from 'next/cache';

// ─── DEPARTMENT ──────────────────────────────────────────────

export async function getDepartments() {
  return prisma.department.findMany({
    include: { subDepartments: { orderBy: { name: 'asc' } } },
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
  // Unlink employees first
  await prisma.employee.updateMany({ where: { departmentId: id }, data: { departmentId: null } });
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
  await prisma.employee.updateMany({ where: { subDepartmentId: id }, data: { subDepartmentId: null } });
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
  await prisma.employee.updateMany({ where: { designationId: id }, data: { designationId: null } });
  await prisma.designation.delete({ where: { id } });
  revalidatePath('/');
  return { success: true };
}

// ─── MANAGER ASSIGNMENT ──────────────────────────────────────

export async function setEmployeeManagers(employeeCode, managerCodes) {
  const emp = await prisma.employee.findUnique({ where: { code: employeeCode } });
  if (!emp) return { error: 'Employee not found' };

  // Remove existing manager assignments
  await prisma.employeeManager.deleteMany({ where: { employeeId: emp.id } });

  // Add new ones with priority
  if (managerCodes && managerCodes.length > 0) {
    for (let i = 0; i < managerCodes.length; i++) {
      const mgr = await prisma.employee.findUnique({ where: { code: managerCodes[i] } });
      if (mgr) {
        await prisma.employeeManager.create({
          data: { employeeId: emp.id, managerEmployeeId: mgr.id, priority: i + 1 }
        });
      }
    }
  }

  revalidatePath('/');
  return { success: true };
}

export async function getEmployeeManagers(employeeCode) {
  const emp = await prisma.employee.findUnique({
    where: { code: employeeCode },
    include: {
      managers: {
        include: { manager: { select: { code: true, name: true } } },
        orderBy: { priority: 'asc' }
      }
    }
  });
  if (!emp) return [];
  return emp.managers.map(m => ({ code: m.manager.code, name: m.manager.name, priority: m.priority }));
}

export async function getManagedEmployees(managerCode) {
  const mgr = await prisma.employee.findUnique({ where: { code: managerCode } });
  if (!mgr) return [];

  const relations = await prisma.employeeManager.findMany({
    where: { managerEmployeeId: mgr.id },
    include: {
      employee: {
        select: { code: true, name: true, employeeType: true, department: { select: { name: true } }, designation: { select: { name: true } } }
      }
    },
    orderBy: [{ priority: 'asc' }]
  });
  return relations.map(r => ({
    code: r.employee.code,
    name: r.employee.name,
    employeeType: r.employee.employeeType,
    department: r.employee.department?.name ?? null,
    designation: r.employee.designation?.name ?? null,
    priority: r.priority
  }));
}
