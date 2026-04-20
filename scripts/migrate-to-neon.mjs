/**
 * Migrates data from local SQLite (prisma/attendance.db) to Neon PostgreSQL.
 * Run with: node scripts/migrate-to-neon.mjs
 */

import Database from 'better-sqlite3';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../prisma/attendance.db');

const sqlite = new Database(dbPath, { readonly: true });
const prisma = new PrismaClient();

async function main() {
  console.log('📦 Reading from SQLite:', dbPath);

  const employees = sqlite.prepare('SELECT * FROM Employee').all();
  const monthRecords = sqlite.prepare('SELECT * FROM MonthRecord').all();
  const dailyLogs = sqlite.prepare('SELECT * FROM DailyLog').all();
  const overrides = sqlite.prepare('SELECT * FROM Override').all();

  console.log(`  Employees:    ${employees.length}`);
  console.log(`  MonthRecords: ${monthRecords.length}`);
  console.log(`  DailyLogs:    ${dailyLogs.length}`);
  console.log(`  Overrides:    ${overrides.length}`);

  // --- Employees ---
  console.log('\n🔄 Migrating employees...');
  for (const e of employees) {
    await prisma.employee.upsert({
      where: { code: e.code },
      update: { name: e.name },
      create: {
        id: e.id,
        code: e.code,
        name: e.name,
        createdAt: new Date(e.createdAt),
        updatedAt: new Date(e.updatedAt),
      },
    });
  }
  console.log(`  ✓ ${employees.length} employees`);

  // --- MonthRecords ---
  console.log('🔄 Migrating month records...');
  for (const r of monthRecords) {
    await prisma.monthRecord.upsert({
      where: { employeeId_monthYear: { employeeId: r.employeeId, monthYear: r.monthYear } },
      update: {},
      create: {
        id: r.id,
        employeeId: r.employeeId,
        monthYear: r.monthYear,
        present: r.present,
        absent: r.absent,
        halfDay: r.halfDay,
        late: r.late,
        lateHD: r.lateHD,
        shortShift: r.shortShift,
        ssHD: r.ssHD,
        shortLeave: r.shortLeave,
        rl: r.rl,
        holi: r.holi,
        numDays: r.numDays,
        createdAt: new Date(r.createdAt),
        updatedAt: new Date(r.updatedAt),
      },
    });
  }
  console.log(`  ✓ ${monthRecords.length} month records`);

  // --- DailyLogs (batch for speed) ---
  console.log('🔄 Migrating daily logs...');
  const BATCH = 500;
  for (let i = 0; i < dailyLogs.length; i += BATCH) {
    const batch = dailyLogs.slice(i, i + BATCH);
    await prisma.$transaction(
      batch.map(d =>
        prisma.dailyLog.upsert({
          where: { employeeId_monthYear_day: { employeeId: d.employeeId, monthYear: d.monthYear, day: d.day } },
          update: {},
          create: {
            id: d.id,
            employeeId: d.employeeId,
            monthYear: d.monthYear,
            day: d.day,
            type: d.type,
            raw: d.raw ?? '',
            inT: d.inT ?? null,
            outT: d.outT ?? null,
            isLate: d.isLate === 1,
            isSS: d.isSS === 1,
            isSL: d.isSL === 1,
          },
        })
      )
    );
    process.stdout.write(`  ${Math.min(i + BATCH, dailyLogs.length)}/${dailyLogs.length}\r`);
  }
  console.log(`  ✓ ${dailyLogs.length} daily logs       `);

  // --- Overrides ---
  console.log('🔄 Migrating overrides...');
  for (const o of overrides) {
    await prisma.override.upsert({
      where: { employeeId_monthYear_day: { employeeId: o.employeeId, monthYear: o.monthYear, day: o.day } },
      update: {},
      create: {
        id: o.id,
        employeeId: o.employeeId,
        monthYear: o.monthYear,
        day: o.day,
        type: o.type,
      },
    });
  }
  console.log(`  ✓ ${overrides.length} overrides`);

  console.log('\n✅ Migration complete!');
}

main()
  .catch(e => { console.error('❌ Error:', e); process.exit(1); })
  .finally(() => { prisma.$disconnect(); sqlite.close(); });
