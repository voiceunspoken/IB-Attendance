"use server";

import { prisma } from '../lib/prisma';
import { requireAdmin } from '../lib/auth-guard';
import { revalidatePath } from 'next/cache';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const AVATAR_DIR = path.join(process.cwd(), 'public', 'uploads', 'avatars');

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

export async function updateEmployeeDetails(code, fields, performedBy) {
  const sensitiveFields = ['employeeType', 'departmentId', 'subDepartmentId', 'designationId'];
  const hasSensitiveChanges = sensitiveFields.some(f => fields[f] !== undefined);
  if (hasSensitiveChanges) {
    const auth = await requireAdmin(performedBy);
    if (auth) return auth;
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

  await prisma.user.update({ where: { code }, data });
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
