"use server";

import { prisma } from '../lib/prisma';
import { revalidatePath } from 'next/cache';

export async function getHolidays(year) {
  return prisma.holiday.findMany({
    where: { year },
    orderBy: [{ month: 'asc' }, { day: 'asc' }]
  });
}

export async function addHoliday(year, month, day, name, type = 'national') {
  const holiday = await prisma.holiday.upsert({
    where: { year_month_day: { year, month, day } },
    update: { name, type },
    create: { year, month, day, name, type }
  });
  revalidatePath('/');
  return { holiday };
}

export async function deleteHoliday(id) {
  await prisma.holiday.delete({ where: { id } });
  revalidatePath('/');
  return { success: true };
}

export async function getUpcomingHolidays() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  return prisma.holiday.findMany({
    where: {
      year,
      OR: [
        { month: { gt: month } },
        { month, day: { gte: day } }
      ]
    },
    orderBy: [{ month: 'asc' }, { day: 'asc' }],
    take: 10
  });
}
