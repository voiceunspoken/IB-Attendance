"use server";

import { prisma } from '../lib/prisma';
import { revalidatePath } from 'next/cache';

export async function getWorkingSaturdays(year, month) {
  const where = { year };
  if (month !== undefined) where.month = month;
  return prisma.workingSaturday.findMany({ where, orderBy: [{ month: 'asc' }, { day: 'asc' }] });
}

export async function getWorkingSaturdaySet(year, month) {
  const entries = await getWorkingSaturdays(year, month);
  return new Set(entries.map(e => e.day));
}

export async function upsertWorkingSaturday(year, month, day, note = '') {
  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);

  const dow = date.getDay();
  if (dow !== 6) return { error: 'Only Saturdays can be marked as working days.' };

  const existing = await prisma.workingSaturday.findUnique({
    where: { year_month: { year, month } }
  });

  if (existing) {
    await prisma.workingSaturday.update({
      where: { id: existing.id },
      data: { day, date, note: note || existing.note }
    });
  } else {
    await prisma.workingSaturday.create({
      data: { year, month, day, date, note }
    });
  }

  revalidatePath('/team');
  revalidatePath('/employee/[code]/leaves');
  return { success: true };
}

export async function removeWorkingSaturday(id) {
  await prisma.workingSaturday.delete({ where: { id } });
  revalidatePath('/team');
  revalidatePath('/employee/[code]/leaves');
  return { success: true };
}

export async function seedWorkingSaturdays(year) {
  const existing = await prisma.workingSaturday.findFirst({ where: { year } });
  if (existing) return { success: true, message: 'Already seeded' };

  let seeded = 0;
  for (let month = 1; month <= 12; month++) {
    const daysInMonth = new Date(year, month, 0).getDate();
    const saturdays = [];
    for (let d = 1; d <= daysInMonth; d++) {
      if (new Date(year, month - 1, d).getDay() === 6) saturdays.push(d);
    }
    const thirdSaturday = saturdays[2];
    if (thirdSaturday) {
      const date = new Date(year, month - 1, thirdSaturday);
      date.setHours(0, 0, 0, 0);
      await prisma.workingSaturday.create({
        data: { year, month, day: thirdSaturday, date, note: '3rd Saturday' }
      });
      seeded++;
    }
  }

  return { success: true, count: seeded };
}
