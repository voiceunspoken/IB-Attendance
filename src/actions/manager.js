"use server";

import { prisma } from '../lib/prisma';

export async function checkIsManager(code) {
  if (!code) return false;
  const mgr = await prisma.user.findUnique({ where: { code } });
  if (!mgr) return false;
  const count = await prisma.userManager.count({ where: { managerUserId: mgr.id } });
  return count > 0;
}
