# IB Attendance Portal — Work Scope & Roadmap

## Phase 1 — Foundation ✅
> Core app scaffolding and biometric data processing

- Next.js 16 project setup with Tailwind CSS
- Prisma ORM with SQLite (local development)
- Biometric XLS/XLSX parser (ONtime / Secureye format)
- HR policy engine — late marks, short shifts, half-day deductions
- Employee attendance summary (present, absent, late, HD, SS, RL, holiday)
- Monthly data upload and storage
- Basic admin login (single password)

---

## Phase 2 — Dashboard & Analytics ✅
> Admin visibility into team attendance

- KPI strip — total employees, absences, late marks, short shifts, WFM, HD deductions
- Employee breakdown table with pagination
- Filter by: All, High Absent, Frequent Late, HD Deduction, WFM, WFH
- Search by employee name or code
- Month selector (historical data)
- CSV export
- Employee detail page with monthly calendar view
- WFM / WFH manual override per day (full day / half day)
- Bulk override by date range
- Clear all overrides per month

---

## Phase 3 — UI Redesign ✅
> Apple-inspired clean interface

- SF Pro system font stack with antialiasing
- Light background (#f5f5f7), white cards, Apple color palette
- Frosted glass navbar (backdrop-filter)
- Pill-shaped buttons, segmented filter controls
- Smooth fade-in animations
- Responsive layout

---

## Phase 4 — Roles & Permissions ✅
> Multi-user access control

- User model in database (username, password, role, employeeCode)
- Roles: `admin` and `employee`
- Admin capabilities: upload, edit, delete, overrides, export, manage users
- Employee capabilities: view own attendance only (read-only calendar)
- Employee auto-redirect to own profile on login
- Block employees from accessing other profiles
- User management page (create, edit, delete accounts)
- Link employee accounts to their attendance record
- Permissions summary UI
- Default admin account auto-seeded on first load
- Header shows logged-in user name and role

---

## Phase 5 — Cloud Infrastructure ✅
> Production-ready deployment

- Migrated database from SQLite to Neon PostgreSQL
- Pooled connection URL for app (serverless-safe)
- Direct connection URL for migrations
- Vercel deployment with GitHub auto-deploy
- Environment variables configured on Vercel
- `prisma generate` added to build pipeline
- `.env` excluded from version control

---

## Phase 6 — Pending / Upcoming
> Planned improvements

- [ ] Password hashing (bcrypt) — currently plain text
- [ ] Migrate existing SQLite data to Neon
- [ ] Employee self-service — view payslip summary
- [ ] Admin: edit/delete individual month records
- [ ] Admin: manually add/remove employees
- [ ] Notifications — alert admin on high absences
- [ ] Audit log — track who changed what and when
- [ ] Multi-company / department support
- [ ] Mobile responsive improvements
- [ ] Dark mode toggle
