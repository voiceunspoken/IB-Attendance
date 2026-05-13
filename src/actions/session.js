"use server";

import { getSession } from '../lib/session';

export async function getCurrentSession() {
  const session = await getSession();
  if (!session) return null;
  return {
    id: session.userId,
    username: session.username,
    role: session.role,
    employeeCode: session.employeeCode,
  };
}
