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
 
## Phase 6 — Leave & Balance Engine ✅
> Give employees visibility into their leave entitlements
 
- ✅ `LeavePolicy` model — annual quotas (casual, short, sick, earned and restricted leave)
- ✅ `LeaveBalance` model — consumed vs available per employee per year
- ✅ Auto-calculate leave consumption from approved requests + attendance RL data
- ✅ Employee dashboard card: live CL · SL · EL · RL balance with progress bars
- ✅ Year-end carry-forward field (clCarry) in schema
- ✅ Admin can configure and override leave balances via Leave Management page
 
---
 
## Phase 7 — Leave Application Flow ✅
> Replace manual absence tracking with a proper request system
 
- ✅ Employee submits leave request (type, dates, days, reason)
- ✅ Admin approval / rejection workflow with optional note
- ✅ Leave status visible to employee: Pending / Approved / Rejected
- ✅ Leave history log per employee
- ✅ `RegularizationRequest` model — employee raises correction for missed punch
- ✅ Admin reviews and approves/rejects regularizations
- ⏳ Approved leaves do not yet auto-update attendance calendar (manual sync)
 
---
 
## Phase 8 — Employee Self-Service Dashboard ✅
> Make the portal genuinely useful for staff
 
- ✅ Live leave balance summary card with progress bars (CL, SL, EL, RL)
- ✅ Month-wise attendance calendar (existing)
- ✅ Leave request form with type, dates, days, reason
- ✅ Leave request history with status badges
- ✅ Regularization request form (date, punch-in, punch-out, reason)
- ✅ Regularization history with status
- ✅ Tabbed interface: Attendance · Leave Requests · Regularization
- [ ] Download own attendance report as PDF
- [ ] Upcoming company holidays list
 
---
 
## Phase 9 — Automated Alerts & Notifications ✅
> Remove manual monitoring burden from admin

- ✅ Email infrastructure via Resend SDK integrated
- ✅ High absence alert email to admin (triggered when employee crosses threshold)
- ✅ Leave request status notification to employee (approved/rejected)
- ✅ Monthly attendance report email to all employees (bulk send from Settings)
- ✅ Deduction notification email to employee
- ✅ Email config guide in Settings → Notifications tab
- ⏳ Requires `RESEND_API_KEY`, `ADMIN_EMAIL`, `EMAIL_FROM` env vars on Vercel to activate

---

## Phase 10 — Holiday Calendar Management ✅
> Centralized holiday control instead of relying on biometric file

- ✅ `Holiday` model — year, month, day, name, type (national/optional)
- ✅ Admin adds/removes holidays from Settings → Holidays tab
- ✅ Upcoming holidays shown on employee self-service dashboard
- ⏳ Holidays not yet auto-applied to new attendance uploads (parser still reads from XLS)

---

## Phase 11 — Shift & Policy Configuration ✅
> Make HR rules configurable instead of hardcoded

- ✅ `ShiftPolicy` model with full history tracking
- ✅ Admin configures: shift start time, grace period, min hours, lates/HD ratio, SS/HD ratio
- ✅ Policy history visible with active indicator
- ✅ Settings → Shift Policy tab
- ⏳ Parser still uses hardcoded values — new policy applies to future uploads only

---

## Phase 12 — Audit Log & Security ✅
> Traceability and hardened auth

- ✅ `AuditLog` model — every action logged with performer, entity, detail, timestamp
- ✅ Audit log on all: user create/update/delete, override apply/clear, employee add/delete, password change
- ✅ Super admin can view full audit log in Settings → Audit Log tab
- ✅ Password hashing with bcrypt (all new passwords hashed, legacy plain-text still accepted)
- ✅ `changePassword` function with current password verification
- ✅ Change Password tab in Settings for all users
- ✅ `PendingChange` approval workflow wired — super admin approves/rejects admin changes

---

## Phase 13 — Infrastructure & Polish ✅
> Long-term stability and UX

- ✅ Admin: manually add employees from Settings → Employees tab
- ✅ Admin: delete employees (cascades all data) from Settings → Employees tab
- ✅ `deleteMonthRecord` action — delete specific month data per employee
- ✅ Settings hub page at `/settings` covering all admin configuration
- ✅ Header navigation updated: Manage Users · Leaves · Settings
- [ ] Migrate existing SQLite data to Neon (script written, needs better-sqlite3)
- [ ] Admin: edit individual month record values
- [ ] Multi-department support
- [ ] Mobile responsive improvements
- [ ] Dark mode toggle
- [ ] PDF attendance report download

---

## Legend
- ✅ Done & deployed
- ⏳ Partially built — schema/UI exists, logic not fully wired
- [ ] Not started
