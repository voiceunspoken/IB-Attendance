# IB Attendance Portal — Work Scope & Roadmap
 
## Phase 1 — Foundation ✅
> Core app scaffolding and biometric data processing
 
- ✅ Next.js 16 project setup with Tailwind CSS
- ✅ Prisma ORM with SQLite (local development)
- ✅ Biometric XLS/XLSX parser (ONtime / Secureye format)
- ✅ HR policy engine — late marks, short shifts, half-day deductions
- ✅ Employee attendance summary (present, absent, late, HD, SS, RL, holiday, WFM, WFH, WOS)
- ✅ Monthly data upload and storage
- ✅ Basic admin login (single password)
 
---
 
## Phase 2 — Dashboard & Analytics ✅
> Admin visibility into team attendance
 
- ✅ KPI strip — total employees, absences, late marks, short shifts, WFM, WFH, WOS, HD deductions
- ✅ Employee breakdown table with pagination
- ✅ Filter by: All, High Absent, Frequent Late, HD Deduction, WFM, WFH, WOS
- ✅ Search by employee name or code
- ✅ Month selector (historical data)
- ✅ CSV export
- ✅ Employee detail page with monthly calendar view
- ✅ WFM / WFH / WOS manual override per day (full day / half day)
- ✅ Bulk override by date range
- ✅ Clear all overrides per month
 
---
 
## Phase 3 — UI Redesign ✅
> Apple-inspired clean interface
 
- ✅ SF Pro system font stack with antialiasing
- ✅ Light background (#f5f5f7), white cards, Apple color palette
- ✅ Frosted glass navbar (backdrop-filter)
- ✅ Pill-shaped buttons, segmented filter controls
- ✅ Smooth fade-in animations
- ✅ Responsive layout
 
---
 
## Phase 4 — Roles & Permissions ✅ (Partial)
> Multi-user access control
 
- ✅ User model in database (username, password, role, employeeCode)
- ✅ Roles: `super_admin`, `admin`, `employee` — all three defined in schema and auth
- ✅ Super admin auto-seeded on first load (username: superadmin / password: admin123)
- ✅ Super admin capabilities: all admin capabilities + approve/reject pending changes
- ✅ Admin capabilities: upload, edit, delete, overrides, export, manage users
- ✅ Employee capabilities: view own attendance only (read-only calendar)
- ✅ Employee auto-redirect to own profile on login
- ✅ Block employees from accessing other profiles
- ✅ User management page (create, edit, delete accounts) — admin & super admin only
- ✅ Employee details page (name, employee code, birthday, work anniversary)
- ✅ Link employee accounts to their attendance records
- ✅ Permissions summary UI (3-column role breakdown)
- ✅ Header shows logged-in user name and role with colour-coded avatar
- ⏳ Admin changes do NOT yet trigger pending approval — overrides apply immediately (approval UI exists but not wired to actions)
 
---
 
## Phase 5 — Cloud Infrastructure ✅
> Production-ready deployment
 
- ✅ Migrated database from SQLite to Neon PostgreSQL
- ✅ Pooled connection URL for app (serverless-safe)
- ✅ Direct connection URL for migrations
- ✅ Vercel deployment with GitHub auto-deploy (voiceunspoken/IB-Attendance)
- ✅ Environment variables configured on Vercel
- ✅ `prisma generate` added to build pipeline
- ✅ `.env` excluded from version control
 
---
 
## Phase 6 — Leave & Balance Engine
> Give employees visibility into their leave entitlements
 
- [ ] `LeavePolicy` model — annual quotas (casual, short, sick, earned and restricted leave)
- [ ] `LeaveBalance` model — consumed vs available per employee per year
- [ ] Auto-calculate leave consumption from attendance data
- [ ] Employee dashboard card: "12 CL · 6 SL · 4 EL · 2 RL remaining"
- [ ] Year-end carry-forward rules
- [ ] Admin can configure and override leave balances
 
---
 
## Phase 7 — Leave Application Flow
> Replace manual absence tracking with a proper request system
 
- [ ] Employee submits leave request (type, dates, reason)
- [ ] Admin approval / rejection workflow
- [ ] Approved leaves auto-update attendance and deduct from balance
- [ ] Leave status visible to employee: Pending / Approved / Rejected
- [ ] Leave history log per employee
 
---
 
## Phase 8 — Employee Self-Service Dashboard
> Make the portal genuinely useful for staff
 
- [ ] Live leave balance summary card
- [ ] Month-wise attendance summary (present %, late count, deductions)
- [ ] Upcoming company holidays list
- [ ] Download own attendance report as PDF
- [ ] Regularization requests — employee raises correction for missed punch
 
---
 
## Phase 9 — Automated Alerts & Notifications
> Remove manual monitoring burden from admin
 
- [ ] Email alert to admin when employee crosses 3 absences in a month
- [ ] Email alert to employee when late mark or HD deduction is applied
- [ ] Monthly attendance report auto-emailed to each employee
- [ ] Low leave balance warning notification
- [ ] Email provider integration (Resend / SendGrid)
 
---
 
## Phase 10 — Holiday Calendar Management
> Centralized holiday control instead of relying on biometric file
 
- [ ] Admin defines company holiday calendar for the year
- [ ] System auto-marks holidays across all employees
- [ ] Optional: department or region-specific holidays
- [ ] Holidays reflected in leave balance calculations
 
---
 
## Phase 11 — Shift & Policy Configuration
> Make HR rules configurable instead of hardcoded
 
- [ ] Admin configures shift timings, grace period, minimum hours from UI
- [ ] Different policies per department or employee type
- [ ] Policy changes apply from a specific effective date
- [ ] Currently hardcoded: 10:00 AM start, 9 hrs min, 3 lates = 1 HD
 
---
 
## Phase 12 — Audit Log & Security
> Traceability and hardened auth
 
- ⏳ `PendingChange` model exists — stores action, payload, status, reviewer (schema done)
- ⏳ Super admin approval UI built — but admin actions not yet wired to create pending changes
- [ ] Wire all admin write actions (overrides, upload, delete) through pending change flow
- [ ] Super admin can view full change history (approved + rejected)
- [ ] Password hashing with bcrypt (currently plain text)
- [ ] "Change Password" option for all users
 
---
 
## Phase 13 — Infrastructure & Polish
> Long-term stability and UX
 
- [ ] Migrate existing SQLite data to Neon (script written, needs better-sqlite3 install)
- [ ] Admin: edit / delete individual month records
- [ ] Admin: manually add / remove employees
- [ ] Multi-department support
- [ ] Mobile responsive improvements
- [ ] Dark mode toggle

---

## Legend
- ✅ Done & deployed
- ⏳ Partially built — schema/UI exists, logic not fully wired
- [ ] Not started
