import { prisma } from './prisma';

export async function ensureAdmin(username) {
  if (!username) return false;
  const user = await prisma.user.findUnique({ where: { username } });
  return user?.role === 'admin' || user?.role === 'super_admin';
}

export async function ensureSuperAdmin(username) {
  if (!username) return false;
  const user = await prisma.user.findUnique({ where: { username } });
  return user?.role === 'super_admin';
}

export async function requireAdmin(username) {
  if (!username) return { error: 'Unauthorized' };
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return { error: 'Unauthorized: Admin access required' };
  }
  return null;
}

export async function requireSuperAdmin(username) {
  if (!username) return { error: 'Unauthorized' };
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || user.role !== 'super_admin') {
    return { error: 'Unauthorized: Super admin access required' };
  }
  return null;
}
