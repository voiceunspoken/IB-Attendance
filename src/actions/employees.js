"use server";

import { prisma } from '../lib/prisma';
import { requireAdminOrSuperAdmin, requireSuperAdmin } from '../lib/auth-guard';
import { requireSuperApproval } from '../lib/super-approval';
import { revalidatePath } from 'next/cache';
import { logAction } from './audit';
import { createNotification } from './notifications';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const AVATAR_DIR = path.join(process.cwd(), 'public', 'uploads', 'avatars');

export async function getEmployeeDetails(code) {
  return prisma.user.findUnique({
    where: { code },
    select: {
      id: true, code: true, name: true, email: true, birthday: true, joiningDate: true, workAnniversary: true,
      employeeType: true,
      departmentId: true, department: { select: { id: true, name: true } },
      subDepartmentId: true, subDepartment: { select: { id: true, name: true } },
      designationId: true, designation: { select: { id: true, name: true } }
    }
  });
}

export async function updateEmployeeDetails(code, fields, performedBy) {
  const sensitiveFields = ['employeeType', 'departmentId', 'subDepartmentId', 'designationId', 'email'];
  const hasSensitiveChanges = sensitiveFields.some(f => fields[f] !== undefined);
  if (hasSensitiveChanges) {
    const pending = await requireSuperApproval(performedBy, 'update_user', { code, fields });
    if (pending) return pending;
  }

  const data = {};
  if (fields.name !== undefined) data.name = fields.name;
  if (fields.birthday !== undefined) data.birthday = fields.birthday ? new Date(fields.birthday) : null;
  if (fields.joiningDate !== undefined) data.joiningDate = fields.joiningDate ? new Date(fields.joiningDate) : null;
  if (fields.workAnniversary !== undefined) data.workAnniversary = fields.workAnniversary ? new Date(fields.workAnniversary) : null;
  if (fields.employeeType !== undefined) data.employeeType = fields.employeeType;
  if (fields.departmentId !== undefined) data.departmentId = fields.departmentId || null;
  if (fields.subDepartmentId !== undefined) data.subDepartmentId = fields.subDepartmentId || null;
  if (fields.designationId !== undefined) data.designationId = fields.designationId || null;
  if (fields.email !== undefined) data.email = fields.email || null;

  await prisma.user.update({ where: { code }, data });
  revalidatePath('/');
  return { success: true };
}

export async function requestNameChange(code, newName, currentName, requestedBy) {
  const auth = await requireAdminOrSuperAdmin(requestedBy);
  if (auth) return auth;

  const requester = await prisma.user.findUnique({ where: { username: requestedBy } });
  if (!requester) return { error: 'Requester not found.' };

  // Super admin applies directly
  if (requester.role === 'super_admin') {
    await prisma.user.update({ where: { code }, data: { name: newName } });
    await logAction(requestedBy, 'name_updated', 'employee', requester.id,
      `Updated ${code} name directly: "${currentName}" → "${newName}"`);
    revalidatePath('/');
    return { success: true, direct: true };
  }

  // Admin creates a pending change for super admin approval
  await prisma.pendingChange.create({
    data: {
      requestedBy,
      action: 'update_employee_name',
      payload: JSON.stringify({ code, currentName, newName }),
      status: 'pending',
    },
  });
  await logAction(requestedBy, 'name_change_requested', 'employee', requester.id,
    `Requested name change for ${code}: "${currentName}" → "${newName}"`);
  revalidatePath('/');
  return { success: true, direct: false };
}

export async function reviewNameChange(changeId, reviewedBy, approve) {
  const auth = await requireSuperAdmin(reviewedBy);
  if (auth) return auth;

  const change = await prisma.pendingChange.findUnique({ where: { id: changeId } });
  if (!change || change.action !== 'update_employee_name') return { error: 'Invalid change request.' };
  if (change.status !== 'pending') return { error: 'Change already reviewed.' };

  if (approve) {
    const { code, newName } = JSON.parse(change.payload);
    await prisma.user.update({ where: { code }, data: { name: newName } });
  }

  await prisma.pendingChange.update({
    where: { id: changeId },
    data: { status: approve ? 'approved' : 'rejected', reviewedBy, reviewedAt: new Date() },
  });
  await logAction(reviewedBy, approve ? 'name_change_approved' : 'name_change_rejected', 'pending_change', changeId,
    `${approve ? 'Approved' : 'Rejected'} name change: ${change.payload}`);

  const requesterUser = await prisma.user.findUnique({ where: { username: change.requestedBy } });
  if (requesterUser) {
    const payload = JSON.parse(change.payload);
    await createNotification(requesterUser.id, approve ? 'name_change_approved' : 'name_change_rejected',
      `Name Change ${approve ? 'Approved' : 'Rejected'}`,
      `Your name change request${payload.currentName ? ' from "' + payload.currentName + '"' : ''}${payload.newName ? ' to "' + payload.newName + '"' : ''} has been ${approve ? 'approved' : 'rejected'}.`,
      { ...payload });
  }

  revalidatePath('/');
  return { success: true };
}

export async function uploadAvatar(code, base64Data) {
  if (!base64Data) return { error: 'No image data provided.' };

  const matches = base64Data.match(/^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/);
  if (!matches) return { error: 'Invalid image format. Use PNG, JPEG, WebP, or GIF.' };

  const buffer = Buffer.from(matches[2], 'base64');
  if (buffer.length > 5 * 1024 * 1024) return { error: 'Image too large. Max 5MB.' };

  if (!fs.existsSync(AVATAR_DIR)) fs.mkdirSync(AVATAR_DIR, { recursive: true });

  const outputPath = path.join(AVATAR_DIR, `${code}.webp`);
  await sharp(buffer).resize(400, 400, { fit: 'cover', position: 'center' }).webp({ quality: 80 }).toFile(outputPath);

  revalidatePath('/');
  return { success: true, url: `/uploads/avatars/${code}.webp` };
}

export async function getAvatarUrl(code) {
  const filePath = path.join(AVATAR_DIR, `${code}.webp`);
  if (fs.existsSync(filePath)) return `/uploads/avatars/${code}.webp`;
  return null;
}

export async function getTeamMembers(employeeCode) {
  const user = await prisma.user.findUnique({
    where: { code: employeeCode },
    include: { managers: { select: { managerUserId: true } } }
  });
  if (!user || user.managers.length === 0) return [];

  const managerIds = user.managers.map(m => m.managerUserId);

  const teamUsers = await prisma.user.findMany({
    where: {
      code: { not: null },
      id: { not: user.id },
      managedUsers: { some: { managerUserId: { in: managerIds } } }
    },
    select: {
      id: true, code: true, name: true, employeeType: true,
      department: { select: { name: true } },
      designation: { select: { name: true } }
    },
    orderBy: { name: 'asc' }
  });

  if (teamUsers.length === 0) return [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const teamIds = teamUsers.map(u => u.id);

  const [leaveRequests, wfhRequests, dailyLogs] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: {
        userId: { in: teamIds },
        status: 'approved',
        fromDate: { lte: tomorrow },
        toDate: { gte: today }
      },
      select: { userId: true, leaveType: true }
    }),
    prisma.wfhRequest.findMany({
      where: {
        userId: { in: teamIds },
        status: 'approved',
        date: { gte: today, lt: tomorrow }
      },
      select: { userId: true, workType: true }
    }),
    prisma.dailyLog.findMany({
      where: {
        userId: { in: teamIds },
        monthYear: `${today.getMonth() + 1}_${today.getFullYear()}`,
        day: today.getDate()
      },
      select: { userId: true, type: true, workLocation: true }
    })
  ]);

  const leaveMap = {};
  leaveRequests.forEach(r => { if (!leaveMap[r.userId]) leaveMap[r.userId] = []; leaveMap[r.userId].push(r.leaveType.toUpperCase()); });
  const wfhMap = {};
  wfhRequests.forEach(r => { wfhMap[r.userId] = r.workType; });
  const dailyMap = {};
  dailyLogs.forEach(r => { dailyMap[r.userId] = r; });

  return teamUsers.map(u => {
    const leaves = leaveMap[u.id];
    const wfh = wfhMap[u.id];
    const daily = dailyMap[u.id];

    let status, statusColor, statusLabel;
    if (leaves && leaves.length > 0) {
      status = 'leave';
      statusColor = '#ff9f0a';
      statusLabel = `On Leave (${leaves.join('/')})`;
    } else if (wfh) {
      status = 'wfh';
      statusColor = '#af52de';
      statusLabel = { wfh: 'WFH', wos: 'WOS', wfm: 'WFM', wfo: 'WFO' }[wfh] || wfh.toUpperCase();
    } else if (daily && daily.type === 'absent') {
      status = 'absent';
      statusColor = '#ff3b30';
      statusLabel = 'Absent';
    } else if (daily && ['present', 'half', 'holiday', 'rl'].includes(daily.type)) {
      status = 'present';
      statusColor = '#34c759';
      statusLabel = 'Present';
    } else {
      status = 'unknown';
      statusColor = '#8e8e93';
      statusLabel = 'No data';
    }

    return {
      code: u.code,
      name: u.name,
      employeeType: u.employeeType,
      department: u.department?.name || null,
      designation: u.designation?.name || null,
      status,
      statusColor,
      statusLabel
    };
  });
}
