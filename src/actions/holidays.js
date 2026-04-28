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

// Seed IB official holidays for a given year
export async function seedIBHolidays(year) {
  const gazetted = [
    { month: 1,  day: 1,  name: 'New Year',         type: 'national' },
    { month: 1,  day: 26, name: 'Republic Day',      type: 'national' },
    { month: 2,  day: 15, name: 'Maha Shivaratri',   type: 'national' },
    { month: 3,  day: 4,  name: 'Holi',              type: 'national' },
    { month: 8,  day: 15, name: 'Independence Day',  type: 'national' },
    { month: 8,  day: 28, name: 'Raksha Bandhan',    type: 'national' },
    { month: 9,  day: 4,  name: 'Janmashtami',       type: 'national' },
    { month: 10, day: 2,  name: 'Gandhi Jayanti',    type: 'national' },
    { month: 10, day: 20, name: 'Dussehra',          type: 'national' },
    { month: 11, day: 8,  name: 'Diwali',            type: 'national' },
    { month: 11, day: 9,  name: 'Govardhan Puja',    type: 'national' },
    { month: 12, day: 25, name: 'Christmas Day',     type: 'national' },
  ];

  const restricted = [
    { month: 1,  day: 13, name: 'Lohri',             type: 'optional' },
    { month: 3,  day: 21, name: 'Eid-ul-Fitr',       type: 'optional' },
    { month: 3,  day: 26, name: 'Ram Navami',         type: 'optional' },
    { month: 4,  day: 3,  name: 'Good Friday',        type: 'optional' },
    { month: 5,  day: 27, name: 'Eid ul-Adha',        type: 'optional' },
    { month: 6,  day: 26, name: 'Muharram',           type: 'optional' },
    { month: 9,  day: 14, name: 'Ganesh Chaturthi',   type: 'optional' },
    { month: 10, day: 20, name: 'Maha Navami',        type: 'optional' },
    { month: 10, day: 29, name: 'Karva Chauth',       type: 'optional' },
    { month: 11, day: 11, name: 'Bhai Dooj',          type: 'optional' },
    { month: 11, day: 15, name: 'Chhath Puja',        type: 'optional' },
    { month: 11, day: 24, name: 'Guru Nanak Jayanti', type: 'optional' },
  ];

  for (const h of [...gazetted, ...restricted]) {
    await prisma.holiday.upsert({
      where: { year_month_day: { year, month: h.month, day: h.day } },
      update: { name: h.name, type: h.type },
      create: { year, ...h }
    });
  }
  revalidatePath('/');
  return { seeded: gazetted.length + restricted.length };
}
