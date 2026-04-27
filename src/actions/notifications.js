"use server";

import { Resend } from 'resend';
import { prisma } from '../lib/prisma';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM || 'IB Attendance <noreply@ibeesattendance.com>';

// Helper — get employee email from User table
async function getEmployeeEmail(employeeCode) {
  const user = await prisma.user.findFirst({ where: { employeeCode } });
  return user?.email ?? null;
}

// Phase 9.1 — Alert admin when employee crosses 3 absences
export async function sendHighAbsenceAlert(employeeName, employeeCode, absentCount, monthYear) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail || !process.env.RESEND_API_KEY) return { skipped: true };

  const [month, year] = monthYear.split('_');
  const monthLabel = new Date(year, parseInt(month) - 1).toLocaleString('default', { month: 'long', year: 'numeric' });

  await resend.emails.send({
    from: FROM,
    to: adminEmail,
    subject: `⚠️ High Absence Alert — ${employeeName}`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <h2 style="font-size: 20px; font-weight: 700; color: #1d1d1f; margin-bottom: 8px;">High Absence Alert</h2>
        <p style="color: #6e6e73; font-size: 14px; margin-bottom: 24px;">${monthLabel}</p>
        <div style="background: #fff3f3; border: 1px solid #ffd0d0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <p style="margin: 0; font-size: 15px; color: #1d1d1f;">
            <strong>${employeeName}</strong> (Code: ${employeeCode}) has <strong style="color: #ff3b30;">${absentCount} absences</strong> this month.
          </p>
        </div>
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://ibeesattendance.vercel.app'}/employee/${employeeCode}" 
           style="display: inline-block; background: #0071e3; color: #fff; padding: 10px 20px; border-radius: 980px; text-decoration: none; font-size: 14px; font-weight: 500;">
          View Employee
        </a>
      </div>
    `
  });
  return { success: true };
}

// Phase 9.2 — Notify employee when late mark or HD deduction applied
export async function sendDeductionNotification(employeeCode, employeeName, type, detail) {
  const email = await getEmployeeEmail(employeeCode);
  if (!email || !process.env.RESEND_API_KEY) return { skipped: true };

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `Attendance Update — ${type}`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <h2 style="font-size: 20px; font-weight: 700; color: #1d1d1f; margin-bottom: 8px;">Attendance Update</h2>
        <p style="color: #6e6e73; font-size: 14px; margin-bottom: 24px;">Hi ${employeeName},</p>
        <div style="background: #fff8f0; border: 1px solid #ffe0b0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <p style="margin: 0; font-size: 15px; color: #1d1d1f;">${detail}</p>
        </div>
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://ibeesattendance.vercel.app'}/employee/${employeeCode}"
           style="display: inline-block; background: #0071e3; color: #fff; padding: 10px 20px; border-radius: 980px; text-decoration: none; font-size: 14px; font-weight: 500;">
          View My Attendance
        </a>
      </div>
    `
  });
  return { success: true };
}

// Phase 9.3 — Leave request status notification to employee
export async function sendLeaveStatusNotification(employeeCode, employeeName, leaveType, status, note) {
  const email = await getEmployeeEmail(employeeCode);
  if (!email || !process.env.RESEND_API_KEY) return { skipped: true };

  const statusColor = status === 'approved' ? '#34c759' : '#ff3b30';
  const statusLabel = status === 'approved' ? '✅ Approved' : '❌ Rejected';

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `Leave Request ${statusLabel} — ${leaveType.toUpperCase()}`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <h2 style="font-size: 20px; font-weight: 700; color: #1d1d1f; margin-bottom: 8px;">Leave Request Update</h2>
        <p style="color: #6e6e73; font-size: 14px; margin-bottom: 24px;">Hi ${employeeName},</p>
        <div style="background: #f5f5f7; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <p style="margin: 0 0 8px; font-size: 15px; color: #1d1d1f;">
            Your <strong>${leaveType.toUpperCase()}</strong> leave request has been 
            <strong style="color: ${statusColor};">${status}</strong>.
          </p>
          ${note ? `<p style="margin: 0; font-size: 13px; color: #6e6e73;">Note: ${note}</p>` : ''}
        </div>
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://ibeesattendance.vercel.app'}/employee/${employeeCode}"
           style="display: inline-block; background: #0071e3; color: #fff; padding: 10px 20px; border-radius: 980px; text-decoration: none; font-size: 14px; font-weight: 500;">
          View My Leaves
        </a>
      </div>
    `
  });
  return { success: true };
}

// Phase 9.4 — Monthly attendance summary email to employee
export async function sendMonthlyReport(employeeCode, employeeName, monthYear, stats) {
  const email = await getEmployeeEmail(employeeCode);
  if (!email || !process.env.RESEND_API_KEY) return { skipped: true };

  const [month, year] = monthYear.split('_');
  const monthLabel = new Date(year, parseInt(month) - 1).toLocaleString('default', { month: 'long', year: 'numeric' });

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `Your Attendance Summary — ${monthLabel}`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <h2 style="font-size: 20px; font-weight: 700; color: #1d1d1f; margin-bottom: 4px;">Monthly Attendance Summary</h2>
        <p style="color: #6e6e73; font-size: 14px; margin-bottom: 24px;">${monthLabel} · Hi ${employeeName}</p>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px;">
          ${[
            { label: 'Present', value: stats.present, color: '#34c759' },
            { label: 'Absent', value: stats.absent, color: '#ff3b30' },
            { label: 'Late Marks', value: stats.late, color: '#ff9f0a' },
            { label: 'HD Deductions', value: stats.lateHD + stats.ssHD, color: '#af52de' },
          ].map(s => `
            <div style="background: #f5f5f7; border-radius: 10px; padding: 14px; text-align: center;">
              <div style="font-size: 24px; font-weight: 700; color: ${s.color};">${s.value}</div>
              <div style="font-size: 11px; color: #6e6e73; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.04em;">${s.label}</div>
            </div>
          `).join('')}
        </div>
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://ibeesattendance.vercel.app'}/employee/${employeeCode}"
           style="display: inline-block; background: #0071e3; color: #fff; padding: 10px 20px; border-radius: 980px; text-decoration: none; font-size: 14px; font-weight: 500;">
          View Full Details
        </a>
      </div>
    `
  });
  return { success: true };
}

// Bulk send monthly reports to all employees
export async function sendAllMonthlyReports(monthYear) {
  const users = await prisma.user.findMany({ where: { role: 'employee', employeeCode: { not: null } } });
  const results = [];
  for (const u of users) {
    const record = await prisma.monthRecord.findFirst({
      where: { employee: { code: u.employeeCode }, monthYear },
      include: { employee: true }
    });
    if (record) {
      const r = await sendMonthlyReport(u.employeeCode, record.employee.name, monthYear, record);
      results.push({ code: u.employeeCode, ...r });
    }
  }
  return results;
}
