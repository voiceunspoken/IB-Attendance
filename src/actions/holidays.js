"use server";

import { prisma } from '../lib/prisma';
import { requireAuth, requireAdmin } from '../lib/session';

export async function getHolidays(year) {
  try {
    await requireAuth();
    return prisma.holiday.findMany({
      where: { year },
      orderBy: [{ month: 'asc' }, { day: 'asc' }]
    });
  } catch {
    return [];
  }
}

export async function addHoliday(year, month, day, name, type = 'national') {
  try {
    await requireAdmin();
    return prisma.holiday.create({
      data: { year, month, day, name, type }
    });
  } catch (e) {
    if (e.message === 'Authentication required' || e.message === 'Admin access required') return { error: e.message };
    console.error('[addHoliday error]', e.message);
    return { error: 'Failed to add holiday.' };
  }
}

export async function deleteHoliday(id) {
  try {
    await requireAdmin();
    return prisma.holiday.delete({ where: { id } });
  } catch (e) {
    if (e.message === 'Authentication required' || e.message === 'Admin access required') return { error: e.message };
    console.error('[deleteHoliday error]', e.message);
    return { error: 'Failed to delete holiday.' };
  }
}

export async function seedIBHolidays(year) {
  try {
    await requireAdmin();
    const holidays = [
      { month: 1, day: 26, name: 'Republic Day', type: 'national' },
      { month: 3, day: 14, name: 'Holi', type: 'national' },
      { month: 3, day: 31, name: 'Id-ul-Fitr', type: 'national' },
      { month: 4, day: 10, name: 'Mahavir Jayanti', type: 'national' },
      { month: 4, day: 14, name: 'Ambedkar Jayanti', type: 'national' },
      { month: 4, day: 18, name: 'Good Friday', type: 'national' },
      { month: 6, day: 7, name: 'Id-ul-Zuha (Bakrid)', type: 'national' },
      { month: 7, day: 6, name: 'Muharram', type: 'national' },
      { month: 8, day: 15, name: 'Independence Day', type: 'national' },
      { month: 8, day: 16, name: 'Janmashtami', type: 'national' },
      { month: 9, day: 5, name: 'Milad-un-Nabi', type: 'national' },
      { month: 10, day: 2, name: 'Gandhi Jayanti', type: 'national' },
      { month: 10, day: 2, name: 'Dussehra', type: 'national' },
      { month: 10, day: 20, name: 'Diwali', type: 'national' },
      { month: 10, day: 21, name: 'Diwali (Day 2)', type: 'national' },
      { month: 11, day: 5, name: 'Guru Nanak Jayanti', type: 'national' },
      { month: 12, day: 25, name: 'Christmas', type: 'national' },
    ];

    for (const h of holidays) {
      await prisma.holiday.upsert({
        where: { year_month_day_name: { year, month: h.month, day: h.day, name: h.name } },
        update: { type: h.type },
        create: { year, ...h }
      });
    }

    return { success: true };
  } catch (e) {
    if (e.message === 'Authentication required' || e.message === 'Admin access required') return { error: e.message };
    console.error('[seedIBHolidays error]', e.message);
    return { error: 'Failed to seed holidays.' };
  }
}

export async function getUpcomingHolidays() {
  try {
    await requireAuth();
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();

    const holidays = await prisma.holiday.findMany({
      where: { year },
      orderBy: [{ month: 'asc' }, { day: 'asc' }]
    });

    return holidays.filter(h => h.month > month || (h.month === month && h.day >= day)).slice(0, 5);
  } catch {
    return [];
  }
}
