import 'server-only';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const secretKey = process.env.SESSION_SECRET || 'default-dev-secret-change-in-production';
const encodedKey = new TextEncoder().encode(secretKey);

export async function encrypt(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(encodedKey);
}

export async function decrypt(session) {
  try {
    const { payload } = await jwtVerify(session, encodedKey, {
      algorithms: ['HS256'],
    });
    return payload;
  } catch {
    return null;
  }
}

export async function createSession(userData) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const session = await encrypt({
    userId: userData.id,
    username: userData.username,
    role: userData.role,
    employeeCode: userData.employeeCode ?? null,
    expiresAt: expiresAt.toISOString(),
  });
  const cookieStore = await cookies();
  cookieStore.set('session', session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
    sameSite: 'lax',
    path: '/',
  });
  return {
    id: userData.id,
    username: userData.username,
    role: userData.role,
    employeeCode: userData.employeeCode ?? null,
  };
}

export async function getSession() {
  const cookieStore = await cookies();
  const session = cookieStore.get('session')?.value;
  if (!session) return null;
  const payload = await decrypt(session);
  if (!payload) return null;
  return {
    userId: payload.userId,
    username: payload.username,
    role: payload.role,
    employeeCode: payload.employeeCode ?? null,
  };
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete('session');
}

export async function requireAuth() {
  const session = await getSession();
  if (!session) throw new Error('Authentication required');
  return session;
}

export async function requireAdmin() {
  const session = await requireAuth();
  if (session.role !== 'admin' && session.role !== 'super_admin') {
    throw new Error('Admin access required');
  }
  return session;
}

export async function requireSuperAdmin() {
  const session = await requireAuth();
  if (session.role !== 'super_admin') {
    throw new Error('Super admin access required');
  }
  return session;
}
