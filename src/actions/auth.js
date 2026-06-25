"use server";

import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import { logAction } from './audit';
import { requireAdminOrSuperAdmin, requireSuperAdmin } from '../lib/auth-guard';
import { requireSuperApproval } from '../lib/super-approval';

export async function loginUser(email, password) {
  try {
    if (!email) return { error: 'Invalid email or password.' };
    const trimmed = email.toLowerCase().trim();
    const user = await prisma.user.findFirst({ where: { email: trimmed } });
    if (!user) return { error: 'Invalid email or password.' };

    if (user.disabled) return { error: 'Your account has been disabled. Contact your admin.' };

    const valid = user.password.startsWith('$2')
      ? await bcrypt.compare(password, user.password)
      : user.password === password;

    if (!valid) return { error: 'Invalid email or password.' };
    return { user: { id: user.id, username: user.username, role: user.role, code: user.code ?? null, email: user.email ?? null } };
  } catch (e) {
    console.error('[loginUser error]', e.message);
    return { error: 'Server error: ' + e.message };
  }
}

export async function createUser(username, password, role, code, createdBy = 'system') {
  const pending = await requireSuperApproval(createdBy, 'create_user', { username, role, code });
  if (pending) return pending;
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) return { error: 'Username already exists.' };

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { username, password: hashed, role, code: code || null }
  });
  await logAction(createdBy, 'user_created', 'user', user.id, `Created user "${username}" with role "${role}"`);
  return { user: { id: user.id, username: user.username, role: user.role, code: user.code } };
}

export async function getUsers() {
  return prisma.user.findMany({
    select: { id: true, username: true, role: true, disabled: true, code: true, name: true, email: true, createdAt: true },
    orderBy: { createdAt: 'asc' }
  });
}

export async function deleteUser(userId, deletedBy = 'admin') {
  const pending = await requireSuperApproval(deletedBy, 'delete_user', { userId });
  if (pending) return pending;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { error: 'User not found.' };
  await prisma.punchLog.deleteMany({ where: { userId } });
  await prisma.wfhRequest.deleteMany({ where: { userId } });
  await prisma.regularizationRequest.deleteMany({ where: { userId } });
  await prisma.leaveRequest.deleteMany({ where: { userId } });
  await prisma.leaveBalance.deleteMany({ where: { userId } });
  await prisma.dailyLog.deleteMany({ where: { userId } });
  await prisma.monthRecord.deleteMany({ where: { userId } });
  await prisma.userManager.deleteMany({ where: { userId } });
  await prisma.userManager.deleteMany({ where: { managerUserId: userId } });
  await prisma.user.delete({ where: { id: userId } });
  await logAction(deletedBy, 'user_deleted', 'user', userId, `Deleted user "${user?.username}"`);
  return { success: true };
}

export async function toggleDisableUser(userId, performedBy = 'admin') {
  const pending = await requireSuperApproval(performedBy, 'toggle_user', { userId });
  if (pending) return pending;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { error: 'User not found.' };
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { disabled: !user.disabled }
  });
  const action = updated.disabled ? 'user_disabled' : 'user_enabled';
  await logAction(performedBy, action, 'user', userId, `${action === 'user_disabled' ? 'Disabled' : 'Enabled'} user "${user.username}"`);
  return { success: true, disabled: updated.disabled };
}

export async function updateUser(userId, fields, updatedBy = 'admin') {
  const pending = await requireSuperApproval(updatedBy, 'update_user', { userId, fields });
  if (pending) return pending;
  const data = {};
  if (fields.password) data.password = await bcrypt.hash(fields.password, 10);
  if (fields.code !== undefined) data.code = fields.code || null;
  if (fields.name !== undefined) data.name = fields.name;
  if (fields.role) data.role = fields.role;
  const user = await prisma.user.update({ where: { id: userId }, data });
  await logAction(updatedBy, 'user_updated', 'user', userId, `Updated user "${user.username}"`);
  return { user: { id: user.id, username: user.username, role: user.role, code: user.code } };
}

export async function changePassword(userId, currentPassword, newPassword) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { error: 'User not found.' };

  const valid = user.password.startsWith('$2')
    ? await bcrypt.compare(currentPassword, user.password)
    : user.password === currentPassword;

  if (!valid) return { error: 'Current password is incorrect.' };

  const hashed = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { password: hashed } });
  await logAction(user.username, 'password_changed', 'user', userId, 'Password changed');
  return { success: true };
}

export async function promoteToAdmin(userId, role, performedBy = 'admin') {
  const pending = await requireSuperApproval(performedBy, 'promote_user', { userId, role });
  if (pending) return pending;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { error: 'User not found.' };
  if (!user.code) return { error: 'Selected user has no employee code. Cannot promote.' };
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role }
  });
  await logAction(performedBy, 'user_promoted', 'user', userId,
    `Promoted "${user.username}" (${user.code}) to ${role}`);
  return { success: true, user: { id: updated.id, username: updated.username, role: updated.role, code: updated.code, name: updated.name } };
}

export async function ensureAdminExists() {
  try {
    const count = await prisma.user.count({ where: { role: 'super_admin' } });
    if (count === 0) {
      const hashed = await bcrypt.hash('admin123', 10);
      await prisma.user.create({
        data: { username: 'superadmin', password: hashed, role: 'super_admin', email: 'superadmin@interactivebees.com', name: 'Super Admin' }
      });
    } else {
      const superAdmins = await prisma.user.findMany({ where: { role: 'super_admin', email: null } });
      for (const sa of superAdmins) {
        await prisma.user.update({ where: { id: sa.id }, data: { email: 'superadmin@interactivebees.com', name: sa.name || 'Super Admin' } });
      }
    }
  } catch (e) {
    console.error('[ensureAdminExists error]', e.message);
  }
}

export async function createPendingChange(requestedBy, action, payload) {
  const change = await prisma.pendingChange.create({
    data: { requestedBy, action, payload: JSON.stringify(payload), status: 'pending' }
  });
  return { change };
}

export async function getPendingChanges() {
  return prisma.pendingChange.findMany({ where: { status: 'pending' }, orderBy: { createdAt: 'desc' } });
}

export async function reviewPendingChange(changeId, reviewedBy, approve) {
  const auth = await requireSuperAdmin(reviewedBy);
  if (auth) return auth;
  const change = await prisma.pendingChange.update({
    where: { id: changeId },
    data: { status: approve ? 'approved' : 'rejected', reviewedBy, reviewedAt: new Date() }
  });
  await logAction(reviewedBy, approve ? 'change_approved' : 'change_rejected', 'pending_change', changeId,
    `${approve ? 'Approved' : 'Rejected'} change: ${change.action}`);
  return { change, payload: JSON.parse(change.payload) };
}

export async function getPendingChangesHistory() {
  return prisma.pendingChange.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
}

export async function reviewAdminAction(changeId, reviewedBy, approve) {
  const auth = await requireSuperAdmin(reviewedBy);
  if (auth) return auth;

  const change = await prisma.pendingChange.findUnique({ where: { id: changeId } });
  if (!change || change.status !== 'pending') return { error: 'Invalid or already reviewed change request.' };
  if (change.action === 'update_employee_name') {
    return reviewPendingChange(changeId, reviewedBy, approve);
  }

  const payload = JSON.parse(change.payload);

  if (approve) {
    switch (change.action) {
      case 'create_user': {
        const { username, role, code } = payload;
        const hashed = await bcrypt.hash('Welcome@123', 10);
        await prisma.user.create({ data: { username, password: hashed, role, code: code || null, name: payload.name || username } });
        await logAction(reviewedBy, 'user_created', 'user', '', `[pending] Created user "${username}" with role "${role}"`);
        break;
      }
      case 'delete_user': {
        const uid = payload.userId;
        await prisma.punchLog.deleteMany({ where: { userId: uid } });
        await prisma.wfhRequest.deleteMany({ where: { userId: uid } });
        await prisma.regularizationRequest.deleteMany({ where: { userId: uid } });
        await prisma.leaveRequest.deleteMany({ where: { userId: uid } });
        await prisma.leaveBalance.deleteMany({ where: { userId: uid } });
        await prisma.dailyLog.deleteMany({ where: { userId: uid } });
        await prisma.monthRecord.deleteMany({ where: { userId: uid } });
        await prisma.userManager.deleteMany({ where: { userId: uid } });
        await prisma.userManager.deleteMany({ where: { managerUserId: uid } });
        await prisma.user.delete({ where: { id: uid } });
        await logAction(reviewedBy, 'user_deleted', 'user', uid, `[pending] Deleted user`);
        break;
      }
      case 'update_user': {
        const data = {};
        if (payload.fields?.employeeType !== undefined) data.employeeType = payload.fields.employeeType;
        if (payload.fields?.departmentId !== undefined) data.departmentId = payload.fields.departmentId || null;
        if (payload.fields?.subDepartmentId !== undefined) data.subDepartmentId = payload.fields.subDepartmentId || null;
        if (payload.fields?.designationId !== undefined) data.designationId = payload.fields.designationId || null;
        if (payload.fields?.email !== undefined) data.email = payload.fields.email || null;
        if (Object.keys(data).length) {
          await prisma.user.update({ where: { code: payload.code }, data });
          await logAction(reviewedBy, 'user_updated', 'user', '', `[pending] Updated ${payload.code}`);
        }
        break;
      }
      case 'toggle_user': {
        const tUser = await prisma.user.findUnique({ where: { id: payload.userId } });
        if (tUser) {
          await prisma.user.update({ where: { id: payload.userId }, data: { disabled: !tUser.disabled } });
          await logAction(reviewedBy, tUser.disabled ? 'user_enabled' : 'user_disabled', 'user', payload.userId, `[pending] Toggled user`);
        }
        break;
      }
      case 'promote_user': {
        await prisma.user.update({ where: { id: payload.userId }, data: { role: payload.role } });
        await logAction(reviewedBy, 'user_promoted', 'user', payload.userId, `[pending] Promoted to ${payload.role}`);
        break;
      }
      case 'delete_month': {
        const dUser = await prisma.user.findUnique({ where: { code: payload.employeeCode } });
        if (dUser) {
          await prisma.monthRecord.deleteMany({ where: { userId: dUser.id, monthYear: payload.monthYear } });
          await prisma.dailyLog.deleteMany({ where: { userId: dUser.id, monthYear: payload.monthYear } });
          await logAction(reviewedBy, 'month_deleted', 'employee', dUser.id, `[pending] Deleted ${payload.monthYear} for ${payload.employeeCode}`);
        }
        break;
      }
      case 'edit_month': {
        const eUser = await prisma.user.findUnique({ where: { code: payload.employeeCode } });
        if (eUser) {
          const allowed = ['present','absent','halfDay','late','lateHD','shortShift','ssHD','shortLeave','rl','holi'];
          const data = {};
          allowed.forEach(k => { if (payload.fields?.[k] !== undefined) data[k] = parseInt(payload.fields[k]) || 0; });
          await prisma.monthRecord.updateMany({ where: { userId: eUser.id, monthYear: payload.monthYear }, data });
          await logAction(reviewedBy, 'month_edited', 'employee', eUser.id, `[pending] Edited ${payload.monthYear} for ${payload.employeeCode}`);
        }
        break;
      }
      case 'edit_leave_balance': {
        const lbUser = await prisma.user.findUnique({ where: { code: payload.employeeCode } });
        if (lbUser) {
          await prisma.leaveBalance.upsert({
            where: { userId_year: { userId: lbUser.id, year: payload.year } },
            update: payload.fields,
            create: { userId: lbUser.id, year: payload.year, ...payload.fields }
          });
        }
        break;
      }
      case 'update_leave_policy': {
        const { year, cl, sl, el, rl } = payload;
        await prisma.leavePolicy.upsert({
          where: { year },
          update: { cl, sl, el, rl },
          create: { year, cl, sl, el, rl }
        });
        await logAction(reviewedBy, 'leave_policy_updated', 'leave_policy', '', `[pending] Updated leave policy for ${year}`);
        break;
      }
      case 'manage_org': {
        switch (payload.action) {
          case 'add_department':
            await prisma.department.create({ data: { name: payload.name } });
            break;
          case 'delete_department':
            await prisma.user.updateMany({ where: { departmentId: payload.id }, data: { departmentId: null } });
            await prisma.subDepartment.deleteMany({ where: { departmentId: payload.id } });
            await prisma.department.delete({ where: { id: payload.id } });
            break;
          case 'add_sub_department':
            await prisma.subDepartment.create({ data: { name: payload.name, departmentId: payload.departmentId } });
            break;
          case 'delete_sub_department':
            await prisma.user.updateMany({ where: { subDepartmentId: payload.id }, data: { subDepartmentId: null } });
            await prisma.subDepartment.delete({ where: { id: payload.id } });
            break;
          case 'add_designation':
            await prisma.designation.create({ data: { name: payload.name } });
            break;
          case 'delete_designation':
            await prisma.user.updateMany({ where: { designationId: payload.id }, data: { designationId: null } });
            await prisma.designation.delete({ where: { id: payload.id } });
            break;
        }
        await logAction(reviewedBy, 'org_updated', 'org', '', `[pending] ${payload.action}`);
        break;
      }
      default:
        return { error: `Unknown action type: ${change.action}` };
    }
  }

  await prisma.pendingChange.update({
    where: { id: changeId },
    data: { status: approve ? 'approved' : 'rejected', reviewedBy, reviewedAt: new Date() }
  });

  await logAction(reviewedBy, approve ? 'change_approved' : 'change_rejected', 'pending_change', changeId,
    `${approve ? 'Approved' : 'Rejected'} change: ${change.action}`);

  return { success: true, approved: approve };
}
