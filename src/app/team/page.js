"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';
import { getUsers, deleteUser, updateUser, toggleDisableUser, promoteToAdmin, getPendingChanges, reviewPendingChange } from '../../actions/auth';
import { getAllEmployees, addEmployee, deleteEmployee, deleteMonthRecord, getMonths } from '../../actions/attendance';
import { updateEmployeeDetails, requestNameChange, reviewNameChange } from '../../actions/employees';
import { reviewAdjustment } from '../../actions/attendanceChanges';
import { getDepartments, addDepartment, deleteDepartment, addSubDepartment, deleteSubDepartment, getDesignations, addDesignation, deleteDesignation, setEmployeeManagers, getEmployeeManagers, setDepartmentManager, setSubDepartmentManager } from '../../actions/departments';
import Modal from '../../components/Modal';
import ConfirmModal from '../../components/ConfirmModal';
import { useToast } from '../../components/Toast';
import { FiPlus, FiTrash2, FiSearch, FiUser, FiX, FiCheck } from 'react-icons/fi';

const ROLE_STYLES = {
  super_admin: { bg: 'rgba(255,59,48,0.1)', color: '#c0392b', label: 'Super Admin' },
  admin: { bg: 'rgba(0,113,227,0.1)', color: '#0071e3', label: 'Admin' },
  employee: { bg: 'rgba(52,199,89,0.1)', color: '#1a7f37', label: 'Employee' },
};

const ROLE_PERMISSIONS = [
  { role: 'Super Admin', color: '#c0392b', bg: 'rgba(255,59,48,0.06)',
    perms: ['All admin capabilities', 'Approve / reject admin changes', 'Manage all user accounts', 'Full audit log access'] },
  { role: 'Admin', color: '#0071e3', bg: 'rgba(0,113,227,0.06)',
    perms: ['Upload attendance data', 'Apply WFM / WFH / WOS overrides', 'Export CSV & manage employees', 'Changes need super admin approval'] },
  { role: 'Employee', color: '#1a7f37', bg: 'rgba(52,199,89,0.06)',
    perms: ['View own attendance only', 'Apply for leave & regularization', 'Read-only calendar', 'No edit access'] },
];

function RoleBadge({ role }) {
  const s = ROLE_STYLES[role] || ROLE_STYLES.employee;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 10px 2px 6px', borderRadius: '980px', fontSize: 'var(--fs-xs)', fontWeight: 600, background: s.bg, color: s.color }}>
      <span style={{ fontSize: '12px', fontWeight: 700 }}>●</span> {s.label}
    </span>
  );
}

function DisabledBadge() {
  return (
    <span style={{ display: 'inline-flex', padding: '1px 7px', borderRadius: '980px', fontSize: '10px', fontWeight: 600, background: 'rgba(255,59,48,0.1)', color: 'var(--red)' }}>Disabled</span>
  );
}

function SearchBar({ value, onChange, placeholder, count }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '200px', maxWidth: '360px' }}>
      <div style={{ position: 'relative', flex: 1 }}>
        <span style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', fontSize: '13px', pointerEvents: 'none' }}><FiSearch size={13} /></span>
        <input className="input-field" placeholder={placeholder} value={value}
          onChange={e => onChange(e.target.value)}
          style={{ width: '100%', padding: '8px 12px 8px 34px', fontSize: 'var(--fs-sm)' }} />
      </div>
      {count !== undefined && (
        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text3)', fontWeight: 500, whiteSpace: 'nowrap' }}>{count} result{count !== 1 ? 's' : ''}</span>
      )}
    </div>
  );
}

export default function TeamPage() {
  const { role, isAuthenticated, user, loading: authLoading } = useAuth();
  const isAdmin = role === 'admin' || role === 'super_admin';
  const isSuperAdmin = role === 'super_admin';
  const router = useRouter();
  const toast = useToast();

  const [tab, setTab] = useState('employees');

  // ── Shared ──
  const [loading, setLoading] = useState(true);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  // ── Users / Accounts state ──
  const [users, setUsers] = useState([]);
  const [pendingChanges, setPendingChanges] = useState([]);
  const [, setPromotableEmployees] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter] = useState('all');
  const [userPage, setUserPage] = useState(1);
  const pageSize = 20;
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [promoteUserId, setPromoteUserId] = useState('');
  const [promoteRole, setPromoteRole] = useState('admin');
  const [promoteResult, setPromoteResult] = useState('');
  const [promoting, setPromoting] = useState(false);

  // ── Employee profiles state ──
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [months, setMonths] = useState([]);
  const [empForm, setEmpForm] = useState({ code: '', name: '', employeeType: 'regular', departmentId: '', designationId: '' });
  const [empMsg, setEmpMsg] = useState('');

  // ── Combined edit state ──
  const [editRow, setEditRow] = useState(null);
  const [editRowForm, setEditRowForm] = useState({ name: '', password: '', role: '', birthday: '', joiningDate: '', workAnniversary: '', employeeType: 'regular', departmentId: '', subDepartmentId: '', designationId: '' });
  const [editRowManagers, setEditRowManagers] = useState([]);
  const [editRowMsg, setEditRowMsg] = useState('');

  // ── Department/Sub-department state ──
  const [deptForm, setDeptForm] = useState({ name: '' });
  const [deptMsg, setDeptMsg] = useState('');
  const [subDeptForm, setSubDeptForm] = useState({ name: '', departmentId: '' });
  const [subDeptMsg, setSubDeptMsg] = useState('');

  // ── Designation state ──
  const [desigForm, setDesigForm] = useState({ name: '' });
  const [desigMsg, setDesigMsg] = useState('');

  const [confirmState, setConfirmState] = useState({ show: false, message: '', confirmLabel: 'Delete', confirmLoadingLabel: 'Deleting…', variant: 'danger', onConfirm: null });

  // ── Merged display data (employees + user accounts from getUsers) ──
  const displayPeople = useMemo(() => {
    const userMap = {};
    users.forEach(u => { if (u.code) userMap[u.code] = u; });

    const list = employees.map(emp => ({
      ...emp,
      role: userMap[emp.code]?.role || 'employee',
      disabled: userMap[emp.code]?.disabled || false,
    }));

    users.forEach(u => {
      if (!u.code || !list.find(p => p.code === u.code)) {
        list.push({
          id: u.id, code: u.code || '', name: u.name || u.username,
          role: u.role, disabled: u.disabled,
          department: null, designation: null,
          employeeType: 'regular', birthday: null,
          joiningDate: null, workAnniversary: null, createdAt: u.createdAt,
        });
      }
    });

    return list;
  }, [employees, users]);

  // ── Effects ──

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
    if (!authLoading && isAuthenticated && !isAdmin) router.push('/');
  }, [isAuthenticated, isAdmin, authLoading, router]);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        const [u, emps, depts, desigs, ms, pending] = await Promise.all([
          getUsers(),
          getAllEmployees(),
          getDepartments(),
          getDesignations(),
          getMonths(),
          isSuperAdmin ? getPendingChanges() : Promise.resolve([])
        ]);
        setUsers(u);
        setEmployees(emps);
        setDepartments(depts);
        setDesignations(desigs);
        setMonths(ms);
        setPendingChanges(pending);
        setPromotableEmployees(u.filter(x => x.code && x.role === 'employee'));
      } catch {
        setUsers([]);
        setEmployees([]);
        setDepartments([]);
        setDesignations([]);
        setMonths([]);
        setPendingChanges([]);
        setPromotableEmployees([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [isAdmin, isSuperAdmin, fetchTrigger]);

  const filteredUsers = useMemo(() => {
    return displayPeople.filter(p => {
      const q = userSearch.toLowerCase();
      if (q && !(p.name || '').toLowerCase().includes(q) && !(p.code || '').toLowerCase().includes(q)) return false;
      if (roleFilter !== 'all' && p.role !== roleFilter) return false;
      return true;
    });
  }, [displayPeople, userSearch, roleFilter]);
  const totalUserPages = Math.ceil(filteredUsers.length / pageSize);
  const safeUserPage = Math.min(userPage, Math.max(1, totalUserPages));
  const paginatedUsers = filteredUsers.slice((safeUserPage - 1) * pageSize, safeUserPage * pageSize);

  // ── Handlers: Accounts ──

  const handleDelete = (u) => {
    setConfirmState({
      show: true, message: `Delete user "${u.username}" and ALL their attendance data? This cannot be undone.`,
      confirmLabel: 'Delete', confirmLoadingLabel: 'Deleting…', variant: 'danger',
      onConfirm: async () => { await deleteUser(u.id, user.username); setFetchTrigger(t => t + 1); },
    });
  };

  const handleToggleDisable = (u) => {
    setConfirmState({
      show: true,
      message: u.disabled ? `Enable user "${u.username}" again?` : `Disable user "${u.username}"? They will be unable to log in.`,
      confirmLabel: u.disabled ? 'Enable' : 'Disable', confirmLoadingLabel: 'Updating…',
      variant: u.disabled ? 'default' : 'danger',
      onConfirm: async () => { await toggleDisableUser(u.id, user.username); setFetchTrigger(t => t + 1); },
    });
  };

  const handleReview = async (changeId, approve) => {
    // Find the change's action type from pendingChanges state
    const ch = pendingChanges.find(c => c.id === changeId);
    if (ch?.action === 'update_employee_name') {
      await reviewNameChange(changeId, user.username, approve);
    } else if (ch?.action === 'attendance_adjustment') {
      await reviewAdjustment(changeId, user.username, approve);
    } else {
      await reviewPendingChange(changeId, user.username, approve);
    }
    setFetchTrigger(t => t + 1);
  };

  const handleQuickPromote = async (e) => {
    e.preventDefault();
    if (!promoteUserId) return;
    setPromoting(true);
    setPromoteResult('');
    const target = users.find(x => x.id === promoteUserId);
    const result = await promoteToAdmin(promoteUserId, promoteRole, user.username);
    setPromoting(false);
    if (result.error) return setPromoteResult(result.error);
    setPromoteResult(`"${target?.name || target?.username}" promoted to ${promoteRole === 'super_admin' ? 'Super Admin' : 'Admin'}.`);
    setPromoteUserId('');
    setFetchTrigger(t => t + 1);
  };

  // ── Handlers: Combined Employees ──

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    if (!empForm.code.trim() || !empForm.name.trim()) return setEmpMsg('Code and name are required.');
    const result = await addEmployee(empForm.code.trim(), empForm.name.trim(), user.username, {
      employeeType: empForm.employeeType,
      departmentId: empForm.departmentId || undefined,
      designationId: empForm.designationId || undefined,
    });
    if (result.error) return setEmpMsg(result.error);
    setEmpMsg(`Added: ${empForm.name}`);
    setEmpForm({ code: '', name: '', employeeType: 'regular', departmentId: '', designationId: '' });
    setShowCreateModal(false);
    setFetchTrigger(t => t + 1);
  };

  const handleDeleteRow = (p) => {
    if (p.code) {
      setConfirmState({
        show: true, message: `Delete ${p.name} and ALL their attendance data? This cannot be undone.`,
        onConfirm: async () => { await deleteEmployee(p.code, user.username); setFetchTrigger(t => t + 1); },
      });
    } else {
      const target = users.find(u => u.id === p.id);
      if (target) handleDelete(target);
    }
  };

  const handleToggleDisableRow = (p) => {
    const target = users.find(u => u.code === p.code || u.id === p.id);
    if (!target) return toast.error('User account not found.');
    if (target.role === 'super_admin' && role !== 'super_admin') return toast.error('Only super admin can disable a super admin.');
    handleToggleDisable(target);
  };

  const openEditRow = async (p) => {
    setEditRow(p);
    setEditRowForm({
      name: p.name || '',
      password: '',
      role: p.role || 'employee',
      birthday: p.birthday ? new Date(p.birthday).toISOString().split('T')[0] : '',
      joiningDate: p.joiningDate ? new Date(p.joiningDate).toISOString().split('T')[0] : '',
      workAnniversary: p.workAnniversary ? new Date(p.workAnniversary).toISOString().split('T')[0] : '',
      employeeType: p.employeeType || 'regular',
      departmentId: p.department?.id || '',
      subDepartmentId: p.subDepartment?.id || '',
      designationId: p.designation?.id || '',
    });
    setEditRowMsg('');
    if (p.code) {
      try { const mgrs = await getEmployeeManagers(p.code); setEditRowManagers(mgrs.map(m => m.code)); }
      catch { setEditRowManagers([]); }
    } else {
      setEditRowManagers([]);
    }
  };

  const handleSaveEditRow = async (e) => {
    e.preventDefault();
    if (!editRow) return;
    setEditRowMsg('');

    const profileFields = {};
    if (editRowForm.birthday !== (editRow.birthday ? new Date(editRow.birthday).toISOString().split('T')[0] : '')) profileFields.birthday = editRowForm.birthday || null;
    if (editRowForm.joiningDate !== (editRow.joiningDate ? new Date(editRow.joiningDate).toISOString().split('T')[0] : '')) profileFields.joiningDate = editRowForm.joiningDate || null;
    if (editRowForm.workAnniversary !== (editRow.workAnniversary ? new Date(editRow.workAnniversary).toISOString().split('T')[0] : '')) profileFields.workAnniversary = editRowForm.workAnniversary || null;
    if (editRowForm.employeeType !== (editRow.employeeType || 'regular')) profileFields.employeeType = editRowForm.employeeType;
    if (editRowForm.departmentId !== (editRow.department?.id || '')) profileFields.departmentId = editRowForm.departmentId || null;
    if (editRowForm.subDepartmentId !== (editRow.subDepartment?.id || '')) profileFields.subDepartmentId = editRowForm.subDepartmentId || null;
    if (editRowForm.designationId !== (editRow.designation?.id || '')) profileFields.designationId = editRowForm.designationId || null;

    // Handle name change
    if (editRowForm.name !== editRow.name) {
      if (role === 'super_admin') {
        profileFields.name = editRowForm.name;
      } else if (editRow.code) {
        const nr = await requestNameChange(editRow.code, editRowForm.name, editRow.name, user?.username);
        if (nr.error) return setEditRowMsg(nr.error);
        if (nr.direct === false) setEditRowMsg('Name change request sent for super admin approval.');
      }
    }

    // Save profile fields
    if (Object.keys(profileFields).length > 0 && editRow.code) {
      const pr = await updateEmployeeDetails(editRow.code, profileFields, user?.username);
      if (pr.error) return setEditRowMsg(pr.error);
    }

    // Save account fields (password, role)
    const accountFields = {};
    if (editRowForm.password) accountFields.password = editRowForm.password;
    if (editRowForm.role !== editRow.role) accountFields.role = editRowForm.role;
    if (Object.keys(accountFields).length > 0) {
      const targetUser = users.find(u => u.code === editRow.code || u.id === editRow.id);
      if (targetUser) {
        const ar = await updateUser(targetUser.id, accountFields, user.username);
        if (ar.error) return setEditRowMsg(ar.error);
      }
    }

    // Save managers
    if (editRow.code) {
      await setEmployeeManagers(editRow.code, editRowManagers, user.username);
    }

    if (!editRowMsg) setEditRowMsg('Saved successfully.');
    setEditRow(null);
    setFetchTrigger(t => t + 1);
  };

  const handleDeleteMonth = (code, name, monthYear) => {
    setConfirmState({
      show: true, message: `Delete ${name}'s data for ${monthYear}? This cannot be undone.`,
      onConfirm: async () => { await deleteMonthRecord(code, monthYear, user.username); toast.success('Month record deleted.'); },
    });
  };

  // ── Handlers: Departments ──

  const handleAddDepartment = async (e) => {
    e.preventDefault();
    if (!deptForm.name.trim()) return;
    const result = await addDepartment(deptForm.name.trim());
    if (result.error) return setDeptMsg(result.error);
    setDeptForm({ name: '' }); setDeptMsg('');
    setDepartments(await getDepartments());
  };

  const handleDeleteDepartment = (id, name) => {
    setConfirmState({
      show: true, message: `Delete "${name}" and all its sub-departments? Employees will be unlinked.`,
      onConfirm: async () => { await deleteDepartment(id); setDepartments(await getDepartments()); },
    });
  };

  // ── Handlers: Sub-Departments ──

  const handleAddSubDepartment = async (e) => {
    e.preventDefault();
    if (!subDeptForm.name.trim() || !subDeptForm.departmentId) return;
    const result = await addSubDepartment(subDeptForm.name.trim(), subDeptForm.departmentId);
    if (result.error) return setSubDeptMsg(result.error);
    setSubDeptForm({ name: '', departmentId: '' }); setSubDeptMsg('');
    setDepartments(await getDepartments());
  };

  const handleDeleteSubDepartment = (id) => {
    setConfirmState({
      show: true, message: 'Delete this sub-department? Employees linked to it will be unlinked.',
      onConfirm: async () => { await deleteSubDepartment(id); setDepartments(await getDepartments()); },
    });
  };

  // ── Handlers: Department/Sub-department Managers ──

  const [deptMgrTarget, setDeptMgrTarget] = useState({ type: '', id: '', name: '' });
  const [deptMgrUserId, setDeptMgrUserId] = useState('');

  const handleAssignDeptManager = async () => {
    if (!deptMgrTarget.id) return;
    if (deptMgrTarget.type === 'dept') {
      await setDepartmentManager(deptMgrTarget.id, deptMgrUserId || null, user.username);
    } else {
      await setSubDepartmentManager(deptMgrTarget.id, deptMgrUserId || null, user.username);
    }
    setDeptMgrTarget({ type: '', id: '', name: '' });
    setDeptMgrUserId('');
    setDepartments(await getDepartments());
  };

  // ── Handlers: Designations ──

  const handleAddDesignation = async (e) => {
    e.preventDefault();
    if (!desigForm.name.trim()) return;
    const result = await addDesignation(desigForm.name.trim());
    if (result.error) return setDesigMsg(result.error);
    setDesigForm({ name: '' }); setDesigMsg('');
    setDesignations(await getDesignations());
  };

  const handleDeleteDesignation = (id, name) => {
    setConfirmState({
      show: true, message: `Delete "${name}"? Employees with this designation will be unlinked.`,
      onConfirm: async () => { await deleteDesignation(id); setDesignations(await getDesignations()); },
    });
  };

  const formatMonth = (m) => {
    const [mo, yr] = m.split('_');
    return new Date(yr, parseInt(mo) - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  const availableRoles = isSuperAdmin
    ? [{ value: 'employee', label: 'Employee' }, { value: 'admin', label: 'Admin' }, { value: 'super_admin', label: 'Super Admin' }]
    : [{ value: 'employee', label: 'Employee' }, { value: 'admin', label: 'Admin' }];

  if (authLoading || !isAuthenticated || !isAdmin) return null;

  const tabs = [
    { key: 'employees', label: 'Employees' },
    ...(isSuperAdmin ? [{ key: 'pending', label: `Pending${pendingChanges.length > 0 ? ` (${pendingChanges.length})` : ''}` }] : []),
    { key: 'departments', label: 'Departments' },
    { key: 'designations', label: 'Designations' },
    { key: 'tools', label: 'Month Tools' },
  ];

  const thStyle = {
    background: 'var(--surface2)', padding: '10px 16px', textAlign: 'left',
    fontWeight: 600, fontSize: '10px', textTransform: 'uppercase',
    letterSpacing: '0.05em', color: 'var(--text2)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
  };
  const tdStyle = { padding: '11px 16px', fontSize: 'var(--fs-sm)', color: 'var(--text)', borderBottom: '1px solid var(--border)' };
  const tblCell = { padding: '11px 14px', fontSize: '13px', borderBottom: '1px solid var(--border)' };

  return (
    <div className="page-wrapper animate-fade-in">
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.04em' }}>Team</h1>
        <p style={{ color: 'var(--text2)', fontSize: '14px', marginTop: '4px' }}>Manage accounts, employee profiles, departments, and designations.</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', background: 'var(--surface3)', borderRadius: '10px', padding: '3px', marginBottom: '24px', flexWrap: 'wrap', width: 'fit-content' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '6px 16px', borderRadius: '7px', fontSize: '13px', fontWeight: 500,
            border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            background: tab === t.key ? 'var(--surface)' : 'transparent',
            color: tab === t.key ? 'var(--text)' : 'var(--text2)',
            boxShadow: tab === t.key ? 'var(--shadow-sm)' : 'none', transition: 'all 0.15s'
          }}>{t.label}</button>
        ))}
      </div>

      {loading && <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text2)', fontSize: '14px' }}>Loading…</div>}

      {/* ── EMPLOYEES TAB ── */}
      {!loading && tab === 'employees' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 'var(--gap)', alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
            <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700 }}>Employees</span>
                  <span style={{ background: 'var(--surface3)', borderRadius: '980px', padding: '1px 9px', fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text2)' }}>{employees.length}</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setEmpForm({ code: '', name: '', employeeType: 'regular', departmentId: '', designationId: '' }); setEmpMsg(''); setShowCreateModal(true); }}>
                    + Create Employee
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setPromoteUserId(''); setPromoteRole('admin'); setPromoteResult(''); setShowPromoteModal(true); }}>
                    + Promote
                  </button>
                  <SearchBar value={userSearch} onChange={v => { setUserSearch(v); setUserPage(1); }} placeholder="Search employees…" count={filteredUsers.length} />
                </div>
              </div>
              {employees.length === 0 ? (
                <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                  <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.3 }}>●</div>
                  <div style={{ color: 'var(--text2)', fontSize: 'var(--fs-sm)', marginBottom: '4px' }}>No employees yet</div>
                  <div style={{ color: 'var(--text3)', fontSize: 'var(--fs-xs)' }}>Upload attendance data or create an employee to get started.</div>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text2)', fontSize: 'var(--fs-sm)' }}>No employees match your search.</div>
              ) : (
                <><div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['Code', 'Name', 'Role', 'Type', 'Department', 'Designation', 'Status', 'Actions'].map(h => (
                          <th key={h} style={thStyle}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedUsers.map(p => (
                        <tr key={p.id || p.code}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                          onMouseLeave={e => e.currentTarget.style.background = ''}>
                          <td style={{ ...tdStyle, color: p.code ? 'var(--text)' : 'var(--text3)', fontSize: 'var(--fs-xs)', fontFamily: 'monospace' }}>{p.code || '—'}</td>
                          <td style={{ ...tdStyle, fontWeight: 500, color: p.name ? 'var(--text)' : 'var(--text3)' }}>{p.name || '—'}</td>
                          <td style={tdStyle}><RoleBadge role={p.role || 'employee'} /></td>
                          <td style={tblCell}>
                            <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '980px', background: p.employeeType === 'wfh' ? 'rgba(175,82,222,0.1)' : p.employeeType === 'wfm' ? 'rgba(52,199,89,0.1)' : 'var(--surface2)', color: p.employeeType === 'wfh' ? 'var(--purple)' : p.employeeType === 'wfm' ? 'var(--green)' : 'var(--text2)' }}>{(p.employeeType || 'regular').toUpperCase()}</span>
                          </td>
                          <td style={{ ...tdStyle, color: 'var(--text2)', fontSize: '12px' }}>{p.department?.name || '—'}</td>
                          <td style={{ ...tdStyle, color: 'var(--text2)', fontSize: '12px' }}>{p.designation?.name || '—'}</td>
                          <td style={tdStyle}>{p.disabled ? <DisabledBadge /> : <span style={{ color: 'var(--green)', fontSize: 'var(--fs-xs)', fontWeight: 500 }}>Active</span>}</td>
                          <td style={tdStyle}>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '11px' }} onClick={() => openEditRow(p)}>Edit</button>
                              <button className="btn btn-outline btn-xs" onClick={() => handleToggleDisableRow(p)}>{p.disabled ? 'Enable' : 'Disable'}</button>
                              <button className="btn btn-outline btn-xs" style={{ color: 'var(--red)', borderColor: 'rgba(255,59,48,0.25)' }} onClick={() => handleDeleteRow(p)}>Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {totalUserPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', padding: '12px 18px', borderTop: '1px solid var(--border)' }}>
                    <button disabled={userPage <= 1} onClick={() => setUserPage(p => Math.max(1, p - 1))}
                      style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface2)', color: userPage <= 1 ? 'var(--text3)' : 'var(--text)', cursor: userPage <= 1 ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: '12px' }}>Prev</button>
                    {Array.from({ length: totalUserPages }, (_, i) => i + 1).map(p => (
                      <button key={p} onClick={() => setUserPage(p)}
                        style={{ padding: '4px 10px', borderRadius: '6px', border: p === userPage ? '1px solid var(--blue)' : '1px solid var(--border)', background: p === userPage ? 'rgba(0,113,227,0.1)' : 'transparent', color: p === userPage ? 'var(--blue)' : 'var(--text2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12px', fontWeight: p === userPage ? 600 : 400 }}>{p}</button>
                    ))}
                    <button disabled={userPage >= totalUserPages} onClick={() => setUserPage(p => Math.min(totalUserPages, p + 1))}
                      style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface2)', color: userPage >= totalUserPages ? 'var(--text3)' : 'var(--text)', cursor: userPage >= totalUserPages ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: '12px' }}>Next</button>
                  </div>
                )}</>
              )}
            </div>
          </div>

          {/* Role permissions sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
            <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text2)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Role Permissions</div>
            {ROLE_PERMISSIONS.map(item => (
              <div key={item.role} className="card" style={{ padding: '16px', borderLeft: `3px solid ${item.color}`, borderTopLeftRadius: '6px', borderBottomLeftRadius: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: item.bg, display: 'grid', placeItems: 'center', fontSize: '12px', fontWeight: 700, color: item.color }}>●</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 'var(--fs-sm)', color: item.color }}>{item.role}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '1px' }}>{item.role === 'Super Admin' ? 'Full system access' : item.role === 'Admin' ? 'Operational access' : 'Self-service access'}</div>
                  </div>
                </div>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {item.perms.map(p => (
                    <li key={p} style={{ fontSize: 'var(--fs-xs)', color: 'var(--text2)', display: 'flex', gap: '7px', alignItems: 'flex-start', lineHeight: 1.4 }}>
                      <span style={{ color: item.color, marginTop: '2px', flexShrink: 0, fontSize: '10px' }}>●</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── PENDING APPROVALS TAB ── */}
      {!loading && tab === 'pending' && isSuperAdmin && (
        <div>
          {pendingChanges.length === 0 ? (
            <div style={{ padding: '64px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '16px', opacity: 0.3 }}>✓</div>
              <div style={{ color: 'var(--text2)', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>All caught up</div>
              <div style={{ color: 'var(--text3)', fontSize: 'var(--fs-xs)', marginTop: '4px' }}>No pending changes require your approval.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {pendingChanges.map(c => {
                let payload = {};
                try { payload = JSON.parse(c.payload); } catch { /* invalid JSON payload */ }
                const actionColors = {
                  create_user: { bg: 'rgba(52,199,89,0.1)', color: '#1a7f37', label: 'Create User' },
                  update_user: { bg: 'rgba(0,113,227,0.1)', color: '#0071e3', label: 'Update User' },
                  delete_user: { bg: 'rgba(255,59,48,0.1)', color: '#c0392b', label: 'Delete User' },
                  update_employee_name: { bg: 'rgba(255,159,10,0.1)', color: '#b36200', label: 'Name Change' },
                };
                const ac = actionColors[c.action] || { bg: 'var(--surface2)', color: 'var(--text2)', label: c.action };
                return (
                  <div key={c.id} className="card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                        <span style={{ background: ac.bg, color: ac.color, padding: '2px 10px', borderRadius: '6px', fontSize: 'var(--fs-xs)', fontWeight: 600 }}>{ac.label}</span>
                        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text2)' }}>by <strong>{c.requestedBy}</strong></span>
                        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text3)' }}>· {new Date(c.createdAt).toLocaleString()}</span>
                      </div>
                      <div style={{ background: 'var(--surface2)', borderRadius: '8px', padding: '8px 12px', fontSize: 'var(--fs-xs)', fontFamily: 'monospace', color: 'var(--text2)', overflowX: 'auto' }}>
                        {Object.entries(payload).map(([k, v]) => (
                          <div key={k} style={{ display: 'flex', gap: '8px', marginBottom: '2px' }}>
                            <span style={{ color: 'var(--text3)', flexShrink: 0 }}>{k}:</span>
                            <span style={{ color: 'var(--text)', wordBreak: 'break-all' }}>{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                      <button className="btn btn-primary" style={{ padding: '6px 16px', fontSize: 'var(--fs-sm)', background: 'var(--green)' }} onClick={() => handleReview(c.id, true)}>Approve</button>
                      <button style={{ padding: '6px 16px', fontSize: 'var(--fs-sm)', borderRadius: '980px', border: '1px solid rgba(255,59,48,0.2)', background: 'rgba(255,59,48,0.06)', color: 'var(--red)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }} onClick={() => handleReview(c.id, false)}>Reject</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── DEPARTMENTS TAB ── */}
      {!loading && tab === 'departments' && (
        <>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '800px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>
            <div className="card" style={{ padding: '22px 24px' }}>
              <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px' }}>Add Department</div>
              <form onSubmit={handleAddDepartment} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label className="input-label">Department Name</label>
                  <input className="input-field" placeholder="e.g. Engineering" value={deptForm.name}
                    onChange={e => setDeptForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                {deptMsg && <div style={{ fontSize: '13px', color: 'var(--red)' }}>{deptMsg}</div>}
                <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
                  <FiPlus size={13} style={{ marginRight: '6px' }} /> Add Department
                </button>
              </form>
            </div>
            <div className="card" style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px' }}>All Departments ({departments.length})</div>
              {departments.length === 0
                ? <div style={{ color: 'var(--text3)', fontSize: '13px' }}>No departments yet.</div>
                : <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {departments.map(d => (
                      <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--surface2)', borderRadius: '10px' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '13px' }}>{d.name}</div>
                          {d.subDepartments?.length > 0 && (
                            <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>
                              {d.subDepartments.map(sd => sd.name).join(', ')}
                            </div>
                          )}
                          <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>
                            Manager: {d.manager ? `${d.manager.name} (${d.manager.code})` : <span style={{ color: 'var(--text4)' }}>Not assigned</span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <button onClick={() => setDeptMgrTarget({ type: 'dept', id: d.id, name: d.name })} style={{ padding: '5px 10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12px', fontWeight: 500 }}>
                            <FiUser size={12} style={{ marginRight: '4px' }} /> Manager
                          </button>
                          <button onClick={() => handleDeleteDepartment(d.id, d.name)} style={{ padding: '5px 10px', borderRadius: '8px', border: '1px solid rgba(255,59,48,0.2)', background: 'rgba(255,59,48,0.06)', color: 'var(--red)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12px', fontWeight: 500 }}>
                            <FiTrash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
              }
            </div>
          </div>

          {/* Sub-Departments */}
          <div className="card" style={{ padding: '22px 24px' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px' }}>Sub-Departments</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>
              <form onSubmit={handleAddSubDepartment} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label className="input-label">Parent Department</label>
                  <select className="input-field" value={subDeptForm.departmentId}
                    onChange={e => setSubDeptForm(f => ({ ...f, departmentId: e.target.value }))}>
                    <option value="">— Select department —</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="input-label">Sub-Department Name</label>
                  <input className="input-field" placeholder="e.g. Frontend" value={subDeptForm.name}
                    onChange={e => setSubDeptForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                {subDeptMsg && <div style={{ fontSize: '13px', color: subDeptMsg.includes('exists') ? 'var(--red)' : 'var(--green)' }}>{subDeptMsg}</div>}
                <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
                  <FiPlus size={13} style={{ marginRight: '6px' }} /> Add Sub-Department
                </button>
              </form>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px', color: 'var(--text2)' }}>Existing Sub-Departments</div>
                {departments.filter(d => d.subDepartments?.length > 0).length === 0 ? (
                  <div style={{ color: 'var(--text3)', fontSize: '13px' }}>No sub-departments added yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {departments.filter(d => d.subDepartments?.length > 0).map(d => (
                      <div key={d.id}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>{d.name}</div>
                        {d.subDepartments.map(sd => (
                          <div key={sd.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--surface2)', borderRadius: '8px', marginBottom: '4px', marginLeft: '12px' }}>
                            <div>
                              <span style={{ fontSize: '12px' }}>{sd.name}</span>
                              <span style={{ fontSize: '11px', color: 'var(--text3)', marginLeft: '8px' }}>Mgr: {sd.manager ? sd.manager.name : '—'}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button onClick={() => setDeptMgrTarget({ type: 'subdept', id: sd.id, name: `${d.name} / ${sd.name}` })} style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '11px', fontWeight: 500 }}>
                                <FiUser size={10} style={{ marginRight: '3px' }} /> Manager
                              </button>
                              <button onClick={() => handleDeleteSubDepartment(sd.id)} style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(255,59,48,0.2)', background: 'rgba(255,59,48,0.06)', color: 'var(--red)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '11px', fontWeight: 500 }}>
                                <FiTrash2 size={11} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {deptMgrTarget.id && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'var(--card)', borderRadius: '14px', padding: '24px', width: '400px', maxWidth: '90vw' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ fontSize: '15px', fontWeight: 700 }}>Set Manager — {deptMgrTarget.name}</div>
                <button onClick={() => { setDeptMgrTarget({ type: '', id: '', name: '' }); setDeptMgrUserId(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
                  <FiX size={18} />
                </button>
              </div>
              <select className="input-field" value={deptMgrUserId}
                onChange={e => setDeptMgrUserId(e.target.value)}>
                <option value="">— No manager (clear) —</option>
                {users.filter(u => u.code).map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.code})</option>
                ))}
              </select>
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'flex-end' }}>
                <button className="btn" onClick={() => { setDeptMgrTarget({ type: '', id: '', name: '' }); setDeptMgrUserId(''); }} style={{ padding: '8px 16px' }}>Cancel</button>
                <button className="btn btn-primary" onClick={handleAssignDeptManager} style={{ padding: '8px 16px' }}>
                  <FiCheck size={14} style={{ marginRight: '6px' }} /> Assign
                </button>
              </div>
            </div>
          </div>
        )}
        </>
      )}

      {/* ── DESIGNATIONS TAB ── */}
      {!loading && tab === 'designations' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start', maxWidth: '800px' }}>
          <div className="card" style={{ padding: '22px 24px' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px' }}>Add Designation</div>
            <form onSubmit={handleAddDesignation} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="input-label">Designation Name</label>
                <input className="input-field" placeholder="e.g. Senior Developer" value={desigForm.name}
                  onChange={e => setDesigForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              {desigMsg && <div style={{ fontSize: '13px', color: 'var(--red)' }}>{desigMsg}</div>}
              <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
                <FiPlus size={13} style={{ marginRight: '6px' }} /> Add Designation
              </button>
            </form>
          </div>
          <div className="card" style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px' }}>All Designations ({designations.length})</div>
            {designations.length === 0
              ? <div style={{ color: 'var(--text3)', fontSize: '13px' }}>No designations yet.</div>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {designations.map(d => (
                    <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--surface2)', borderRadius: '10px' }}>
                      <span style={{ fontWeight: 600, fontSize: '13px' }}>{d.name}</span>
                      <button onClick={() => handleDeleteDesignation(d.id, d.name)} style={{ padding: '5px 10px', borderRadius: '8px', border: '1px solid rgba(255,59,48,0.2)', background: 'rgba(255,59,48,0.06)', color: 'var(--red)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12px', fontWeight: 500 }}>
                        <FiTrash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
            }
          </div>
        </div>
      )}

      {/* ── MONTH TOOLS TAB ── */}
      {!loading && tab === 'tools' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '720px' }}>
          <div className="card" style={{ padding: '22px 24px' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>Delete Month Record</div>
            <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '16px' }}>Remove a specific month&apos;s attendance data for an employee.</div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div>
                <label className="input-label">Employee</label>
                <select className="input-field" id="del-emp-select" style={{ width: '220px' }}>
                  <option value="">— Select employee —</option>
                  {employees.map(e => <option key={e.code} value={e.code}>{e.name} ({e.code})</option>)}
                </select>
              </div>
              <div>
                <label className="input-label">Month</label>
                <select className="input-field" id="del-month-select" style={{ width: '180px' }}>
                  <option value="">— Select month —</option>
                  {months.map(m => <option key={m} value={m}>{formatMonth(m)}</option>)}
                </select>
              </div>
              <button className="btn" style={{ padding: '9px 16px', borderRadius: '980px', border: '1px solid rgba(255,59,48,0.25)', background: 'rgba(255,59,48,0.06)', color: 'var(--red)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, fontSize: '13px' }}
                onClick={() => {
                  const code = document.getElementById('del-emp-select').value;
                  const monthYear = document.getElementById('del-month-select').value;
                  const emp = employees.find(e => e.code === code);
                  if (!code || !monthYear) return toast.error('Select both employee and month.');
                  handleDeleteMonth(code, emp?.name, monthYear);
                }}>
                Delete Month
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODALS ── */}

      {/* Create Employee Modal */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Employee">
        <form onSubmit={handleAddEmployee} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label className="input-label">Employee Code</label>
              <input className="input-field" placeholder="e.g. 1042" value={empForm.code} onChange={e => setEmpForm(f => ({ ...f, code: e.target.value }))} />
            </div>
            <div>
              <label className="input-label">Full Name</label>
              <input className="input-field" placeholder="e.g. John Doe" value={empForm.name} onChange={e => setEmpForm(f => ({ ...f, name: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label className="input-label">Department</label>
              <select className="input-field" value={empForm.departmentId} onChange={e => setEmpForm(f => ({ ...f, departmentId: e.target.value }))}>
                <option value="">— None —</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="input-label">Designation</label>
              <select className="input-field" value={empForm.designationId} onChange={e => setEmpForm(f => ({ ...f, designationId: e.target.value }))}>
                <option value="">— None —</option>
                {designations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="input-label">Employee Type</label>
            <select className="input-field" value={empForm.employeeType} onChange={e => setEmpForm(f => ({ ...f, employeeType: e.target.value }))}>
              <option value="regular">Regular</option>
              <option value="wfh">WFH (Work From Home)</option>
              <option value="wfm">WFM (Work From Ministry)</option>
            </select>
          </div>
          {empMsg && <div style={{ fontSize: '13px', color: empMsg.includes('already') ? 'var(--red)' : 'var(--green)' }}>{empMsg}</div>}
          <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
            <button type="submit" className="btn btn-primary">Create Employee</button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
          </div>
        </form>
      </Modal>

      {/* Quick Promote Modal */}
      <Modal open={showPromoteModal} onClose={() => setShowPromoteModal(false)} title="Promote Employee">
        <form onSubmit={handleQuickPromote} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label className="input-label">Select Employee</label>
            <select className="input-field" value={promoteUserId} onChange={e => setPromoteUserId(e.target.value)} required>
              <option value="">— Choose an employee —</option>
              {users.filter(x => x.code && x.role === 'employee').map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name || emp.username} ({emp.code})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="input-label">Promote to</label>
            <select className="input-field" value={promoteRole} onChange={e => setPromoteRole(e.target.value)}>
              <option value="admin">Admin</option>
              {isSuperAdmin && <option value="super_admin">Super Admin</option>}
            </select>
          </div>
          {promoteResult && (
            <div style={{ padding: '10px 14px', borderRadius: '8px', fontSize: 'var(--fs-sm)', background: promoteResult.includes('error') ? 'rgba(255,59,48,0.06)' : 'rgba(52,199,89,0.06)', color: promoteResult.includes('error') ? 'var(--red)' : 'var(--green)' }}>
              {promoteResult}
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
            <button type="submit" className="btn btn-primary" disabled={promoting || !promoteUserId} style={{ opacity: (promoting || !promoteUserId) ? 0.7 : 1 }}>
              {promoting ? 'Promoting…' : 'Promote'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowPromoteModal(false)}>Cancel</button>
          </div>
        </form>
      </Modal>

      {/* Combined Edit Modal */}
      <Modal open={!!editRow} onClose={() => setEditRow(null)} title={`Edit — ${editRow?.name || ''}`} width="min(660px, 92vw)">
        {editRow && <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '16px' }}>{editRow.name}{editRow.code ? ` (#${editRow.code})` : ''}</div>}
        <form onSubmit={handleSaveEditRow} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label className="input-label">Full Name</label>
            <input className="input-field" value={editRowForm.name} onChange={e => setEditRowForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          {editRow?.code && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label className="input-label">Birthday</label>
                <input className="input-field" type="date" value={editRowForm.birthday} onChange={e => setEditRowForm(f => ({ ...f, birthday: e.target.value }))} />
              </div>
              <div>
                <label className="input-label">Joining Date</label>
                <input className="input-field" type="date" value={editRowForm.joiningDate} onChange={e => setEditRowForm(f => ({ ...f, joiningDate: e.target.value }))} />
              </div>
              <div>
                <label className="input-label">Work Anniversary</label>
                <input className="input-field" type="date" value={editRowForm.workAnniversary} onChange={e => setEditRowForm(f => ({ ...f, workAnniversary: e.target.value }))} />
              </div>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label className="input-label">New Password <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(blank to keep)</span></label>
              <input className="input-field" type="password" placeholder="••••••••" value={editRowForm.password} onChange={e => setEditRowForm(f => ({ ...f, password: e.target.value }))} />
            </div>
            <div>
              <label className="input-label">Role</label>
              <select className="input-field" value={editRowForm.role} onChange={e => setEditRowForm(f => ({ ...f, role: e.target.value }))}>
                {availableRoles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          </div>
          {editRow?.code && (
            <>
              <div>
                <label className="input-label">Employee Type</label>
                <select className="input-field" value={editRowForm.employeeType} onChange={e => setEditRowForm(f => ({ ...f, employeeType: e.target.value }))}>
                  <option value="regular">Regular</option>
                  <option value="wfh">WFH (Work From Home)</option>
                  <option value="wfm">WFM (Work From Ministry)</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="input-label">Department</label>
                  <select className="input-field" value={editRowForm.departmentId} onChange={e => setEditRowForm(f => ({ ...f, departmentId: e.target.value, subDepartmentId: '' }))}>
                    <option value="">— None —</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="input-label">Sub-Department</label>
                  <select className="input-field" value={editRowForm.subDepartmentId} onChange={e => setEditRowForm(f => ({ ...f, subDepartmentId: e.target.value }))}>
                    <option value="">— None —</option>
                    {departments.find(d => d.id === editRowForm.departmentId)?.subDepartments?.map(sd => (
                      <option key={sd.id} value={sd.id}>{sd.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="input-label">Designation</label>
                <select className="input-field" value={editRowForm.designationId} onChange={e => setEditRowForm(f => ({ ...f, designationId: e.target.value }))}>
                  <option value="">— None —</option>
                  {designations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="input-label">Managers (employee codes, comma-separated)</label>
                <input className="input-field" placeholder="e.g. 1001, 1002" value={editRowManagers.join(', ')} onChange={e => setEditRowManagers(e.target.value.split(',').map(s => s.trim()).filter(Boolean))} />
                <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>Enter manager employee codes separated by commas.</div>
              </div>
            </>
          )}
          {editRowMsg && <div style={{ fontSize: '13px', color: editRowMsg.includes('success') ? 'var(--green)' : 'var(--red)' }}>{editRowMsg}</div>}
          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button type="submit" className="btn btn-primary">Save Changes</button>
            <button type="button" className="btn btn-secondary" onClick={() => setEditRow(null)}>Cancel</button>
          </div>
        </form>
      </Modal>

      {/* Confirm Modal */}
      {confirmState.show && (
        <ConfirmModal
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          confirmLoadingLabel={confirmState.confirmLoadingLabel}
          variant={confirmState.variant}
          onConfirm={async () => { await confirmState.onConfirm(); setConfirmState(s => ({ ...s, show: false })); }}
          onCancel={() => setConfirmState(s => ({ ...s, show: false }))}
        />
      )}
    </div>
  );
}
