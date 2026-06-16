"use server";

import { prisma } from '../lib/prisma';
import { revalidatePath } from 'next/cache';
import { logAction } from './audit';

export async function addHolidayPending(year, month, day, name, isRestricted, createdBy) {
  const existing = await prisma.holiday.findUnique({
    where: { year_month_day: { year, month, day } }
  });
  if (existing) return { error: 'Holiday already exists for this date.' };

  const holiday = await prisma.holiday.create({
    data: {
      year, month, day, name,
      type: isRestricted ? 'optional' : 'national',
      isRestricted,
      status: 'pending',
      createdBy
    }
  });

  await logAction(createdBy, 'holiday_added_pending', 'holiday', holiday.id,
    `Added ${isRestricted ? 'restricted ' : ''}holiday "${name}" (${day}/${month}/${year}) — pending approval`);

  revalidatePath('/');
  return { holiday };
}

export async function deletePendingHoliday(id, performedBy) {
  const h = await prisma.holiday.findUnique({ where: { id } });
  if (!h) return { error: 'Holiday not found' };
  if (h.status !== 'pending') return { error: 'Only pending holidays can be deleted' };
  await prisma.holiday.delete({ where: { id } });
  await logAction(performedBy, 'holiday_deleted', 'holiday', id, `Deleted pending holiday "${h.name}"`);
  revalidatePath('/');
  return { success: true };
}

export async function getPendingHolidays(year) {
  return prisma.holiday.findMany({
    where: { status: 'pending', year },
    orderBy: [{ month: 'asc' }, { day: 'asc' }]
  });
}

export async function approveHoliday(id, reviewedBy) {
  const h = await prisma.holiday.update({
    where: { id },
    data: { status: 'active', reviewedBy, reviewedAt: new Date() }
  });
  await logAction(reviewedBy, 'holiday_approved', 'holiday', id, `Approved holiday "${h.name}"`);
  revalidatePath('/');
  return { holiday: h };
}

export async function rejectHoliday(id, reviewedBy) {
  const h = await prisma.holiday.update({
    where: { id },
    data: { status: 'rejected', reviewedBy, reviewedAt: new Date() }
  });
  await logAction(reviewedBy, 'holiday_rejected', 'holiday', id, `Rejected holiday "${h.name}"`);
  revalidatePath('/');
  return { holiday: h };
}

export async function uploadHolidayXlsx(rows, year, createdBy) {
  const results = { added: 0, skipped: 0, errors: [] };

  for (const row of rows) {
    if (!row[0] || !row[1]) continue;
    const dateStr = String(row[0]).trim();
    const name = String(row[1]).trim();
    const typeRaw = String(row[2] || '').trim().toLowerCase();
    const isRestricted = typeRaw === 'restricted' || typeRaw === 'rl';

    // Parse date — support DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD
    let day, month, yr;
    if (dateStr.includes('/')) {
      [day, month, yr] = dateStr.split('/').map(Number);
    } else if (dateStr.includes('-')) {
      const parts = dateStr.split('-').map(Number);
      if (parts[0] > 31) { [yr, month, day] = parts; }
      else { [day, month, yr] = parts; }
    } else {
      results.errors.push(`Invalid date format: ${dateStr}`);
      continue;
    }
    if (!yr) yr = year;

    try {
      const existing = await prisma.holiday.findUnique({
        where: { year_month_day: { year: yr, month, day } }
      });
      if (existing) {
        results.skipped++;
        continue;
      }
      await prisma.holiday.create({
        data: {
          year: yr, month, day, name,
          type: isRestricted ? 'optional' : 'national',
          isRestricted,
          status: 'pending',
          createdBy
        }
      });
      results.added++;
    } catch (e) {
      results.errors.push(`${name}: ${e.message}`);
    }
  }

  await logAction(createdBy, 'holidays_bulk_upload', 'holiday', null,
    `Uploaded ${results.added} holidays (${results.skipped} skipped, ${results.errors.length} errors) — all pending`);

  revalidatePath('/');
  return results;
}
