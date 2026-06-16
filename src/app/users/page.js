"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';
import { getUsers, createUser, deleteUser, updateUser, getPendingChanges, reviewPendingChange } from '../../actions/auth';
import { fetchDashboardData, getMonths } from '../../actions/attendance';
import { updateEmployeeDetails } from '../../actions/employees';

const ROLE_STYLES = {
  super_admin: { bg: 'rgba(255,59,48,0.1)', color: '#c0392b', icon: '👑', label: 'Super Admin' },
  admin: { bg: 'rgba(0,113,227,0.1)', color: '#0071e3', icon: '🔑', label: 'Admin' },
  employee: { bg: 'rgba(52,199,89,0.1)', color: '#1a7f37', icon: '👤', label: 'Employee' },
};

const ROLE_PERMISSIONS = [
  { role: 'Super Admin', icon: '👑', color: '#c0392b', bg: 'rgba(255,59,48,0.06)',
    perms: ['All admin capabilities', 'Approve / reject admin changes', 'Manage all user accounts', 'Full audit log access'] },
  { role: 'Admin', icon: '🔑', color: '#0071e3', bg: 'rgba(0,113,227,0.06)',
    perms: ['Upload attendance data', 'Apply WFM / WFH / WOS overrides', 'Export CSV & manage employees', 'Changes need super admin approval'] },
  { role: 'Employee', icon: '👤', color: '#1a7f37', bg: 'rgba(52,199,89,0.06)',
    perms: ['View own attendance only', 'Apply for leave & regularization', 'Read-only calendar', 'No edit access'] },
];

function RoleBadge({ role }) {
  const s = ROLE_STYLES[role] || ROLE_STYLES.employee;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 10px 2px 6px', borderRadius: '980px', fontSize: 'var(--fs-xs)', fontWeight: 600, background: s.bg, color: s.color }}>
      <span style={{ fontSize: '12px' }}>{s.icon}</span> {s.label}
    </span>
  );
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200,
      display: 'grid', placeItems: 'center', backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
    }}>
      <div onClick={e => e.stopPropagation()} className="card" style={{
        width: '440px', maxWidth: '92vw', padding: '28px',
        animation: 'fadeIn 0.2s ease', maxHeight: '85vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, letterSpacing: '-0.03em' }}>{title}</div>
          <button onClick={onClose} style={{
            width: '30px', height: '30px', borderRadius: '50%', border: 'none',
            background: 'var(--surface3)', cursor: 'pointer', fontSize: '14px',
            fontFamily: 'inherit', display: 'grid', placeItems: 'center',
            color: 'var(--text2)', transition: 'all 0.15s',
          }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SearchBar({ value, onChange, placeholder, count }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '200px', maxWidth: '360px' }}>
      <div style={{ position: 'relative', flex: 1 }}>
        <span style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', fontSize: '13px', pointerEvents: 'none' }}>🔍</span>
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

export default function UsersPage() {
  const { isAdmin, isSuperAdmin, isAuthenticated, user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [pendingChanges, setPendingChanges] = useState([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({ username: '', password: '', role: 'employee', employeeCode: '' });
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [editUser, setEditUser] = useState(null);
  const [editFields, setEditFields] = useState({ password: '', employeeCode: '', role: '' });
  const [editError, setEditError] = useState('');

  const [editEmp, setEditEmp] = useState(null);
  const [empFields, setEmpFields] = useState({ birthday: '', workAnniversary: '' });

  const [userSearch, setUserSearch] = useState('');
  const [empSearch, setEmpSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [fetchTrigger, setFetchTrigger] = useState(0);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
    if (!authLoading && isAuthenticated && !isAdmin) router.push('/');
  }, [isAuthenticated, isAdmin, authLoading, router]);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const [u, months, pending] = await Promise.all([
        getUsers(),
        getMonths(),
        isSuperAdmin ? getPendingChanges() : Promise.resolve([])
      ]);
      setUsers(u);
      setPendingChanges(pending);
      if (months.length > 0) {
        const empData = await fetchDashboardData(months[0]);
        setEmployees(empData.map(e => ({ code: e.code, name: e.name, birthday: e.birthday, workAnniversary: e.workAnniversary })));
      }
      setLoading(false);
    })();
  }, [isAdmin, isSuperAdmin, fetchTrigger]);

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const q = userSearch.toLowerCase();
      if (q && !u.username.toLowerCase().includes(q)) return false;
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      return true;
    });
  }, [users, userSearch, roleFilter]);

  const filteredEmployees = useMemo(() => {
    const q = empSearch.toLowerCase();
    if (!q) return employees;
    return employees.filter(e => e.name.toLowerCase().includes(q) || e.code.toLowerCase().includes(q));
  }, [employees, empSearch]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError(''); setFormSuccess('');
    if (!form.username || !form.password) return setFormError('Username and password are required.');
    setSubmitting(true);
    const result = await createUser(form.username.trim(), form.password, form.role, form.employeeCode || null);
    setSubmitting(false);
    if (result.error) return setFormError(result.error);
    setFormSuccess(`User "${form.username}" created.`);
    setForm({ username: '', password: '', role: 'employee', employeeCode: '' });
    setFetchTrigger(t => t + 1);
  };

  const handleDelete = async (u) => {
    if (!confirm(`Delete user "${u.username}"? This cannot be undone.`)) return;
    await deleteUser(u.id);
    setFetchTrigger(t => t + 1);
  };

  const openEdit = (u) => {
    setEditUser(u);
    setEditFields({ password: '', employeeCode: u.employeeCode || '', role: u.role });
    setEditError('');
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setEditError('');
    const fields = {};
    if (editFields.password) fields.password = editFields.password;
    if (editFields.employeeCode !== editUser.employeeCode) fields.employeeCode = editFields.employeeCode;
    if (editFields.role !== editUser.role) fields.role = editFields.role;
    if (!Object.keys(fields).length) return setEditError('No changes made.');
    const result = await updateUser(editUser.id, fields);
    if (result.error) return setEditError(result.error);
    setEditUser(null);
    setFetchTrigger(t => t + 1);
  };

  const handleReview = async (changeId, approve) => {
    await reviewPendingChange(changeId, user.username, approve);
    setFetchTrigger(t => t + 1);
  };

  const openEditEmp = (emp) => {
    setEditEmp(emp);
    setEmpFields({
      birthday: emp.birthday ? emp.birthday.split('T')[0] : '',
      workAnniversary: emp.workAnniversary ? emp.workAnniversary.split('T')[0] : ''
    });
  };

  const handleUpdateEmp = async (e) => {
    e.preventDefault();
    await updateEmployeeDetails(editEmp.code, {
      birthday: empFields.birthday || null,
      workAnniversary: empFields.workAnniversary || null
    });
    setEditEmp(null);
    setFetchTrigger(t => t + 1);
  };

  const availableRoles = isSuperAdmin
    ? [{ value: 'employee', label: 'Employee' }, { value: 'admin', label: 'Admin' }, { value: 'super_admin', label: 'Super Admin' }]
    : [{ value: 'employee', label: 'Employee' }, { value: 'admin', label: 'Admin' }];

  if (authLoading || !isAuthenticated || !isAdmin) return null;

  const tabs = [
    { key: 'users', label: 'Accounts' },
    { key: 'employees', label: 'Employee Details' },
    ...(isSuperAdmin ? [{ key: 'pending', label: `Pending Approvals${pendingChanges.length > 0 ? ` (${pendingChanges.length})` : ''}` }] : [])
  ];

  const thStyle = {
    background: 'var(--surface2)', padding: '10px 16px', textAlign: 'left',
    fontWeight: 600, fontSize: '10px', textTransform: 'uppercase',
    letterSpacing: '0.05em', color: 'var(--text2)', borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap',
  };
  const tdStyle = { padding: '11px 16px', fontSize: 'var(--fs-sm)', color: 'var(--text)', borderBottom: '1px solid var(--border)' };

  return (
    <div className="page-wrapper animate-fade-in">

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: 'clamp(20px, 2.5vw, 28px)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.1 }}>
            User Management
          </h1>
          <p style={{ color: 'var(--text2)', fontSize: 'var(--fs-sm)', marginTop: '3px' }}>
            Manage accounts, roles, and employee details.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '3px', background: 'var(--surface3)', borderRadius: '12px', padding: '3px' }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '6px 16px', borderRadius: '9px', fontSize: 'var(--fs-sm)', fontWeight: 500,
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              background: tab === t.key ? 'var(--surface)' : 'transparent',
              color: tab === t.key ? 'var(--text)' : 'var(--text2)',
              boxShadow: tab === t.key ? 'var(--shadow-sm)' : 'none',
              transition: 'all 0.15s', whiteSpace: 'nowrap',
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* ── ACCOUNTS TAB ── */}
      {tab === 'users' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 'var(--gap)', alignItems: 'start' }}>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>

            {/* Create form */}
            <div className="card" style={{ padding: 'clamp(16px, 2vw, 22px)' }}>
              <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '16px' }}>
                Create Account
              </div>
              <form onSubmit={handleCreate}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <label className="input-label">Username</label>
                    <input className="input-field" placeholder="e.g. john.doe" value={form.username}
                      onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
                  </div>
                  <div>
                    <label className="input-label">Password</label>
                    <input className="input-field" type="password" placeholder="Set a password" value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                  </div>
                  <div>
                    <label className="input-label">Role</label>
                    <select className="input-field" value={form.role}
                      onChange={e => setForm(f => ({ ...f, role: e.target.value, employeeCode: '' }))}>
                      {availableRoles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                  {form.role === 'employee' && (
                    <div>
                      <label className="input-label">Link to Employee</label>
                      <select className="input-field" value={form.employeeCode}
                        onChange={e => setForm(f => ({ ...f, employeeCode: e.target.value }))}>
                        <option value="">— Select employee —</option>
                        {employees.map(emp => (
                          <option key={emp.code} value={emp.code}>{emp.name} ({emp.code})</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                {/* Role preview */}
                {form.role && (() => {
                  const s = ROLE_STYLES[form.role];
                  return (
                    <div style={{ background: 'var(--surface2)', borderRadius: '10px', padding: '10px 14px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '16px' }}>{s.icon}</span>
                      <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text2)' }}>
                        Will be created as <strong style={{ color: s.color }}>{s.label}</strong>.
                        {form.role === 'employee' && !form.employeeCode && <span style={{ color: 'var(--orange)' }}> No employee linked.</span>}
                      </span>
                    </div>
                  );
                })()}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <button type="submit" className="btn btn-primary" disabled={submitting}
                    style={{ opacity: submitting ? 0.7 : 1 }}>
                    {submitting ? 'Creating…' : 'Create Account'}
                  </button>
                  {formError && <span style={{ color: 'var(--red)', fontSize: 'var(--fs-sm)' }}>{formError}</span>}
                  {formSuccess && <span style={{ color: 'var(--green)', fontSize: 'var(--fs-sm)' }}>{formSuccess}</span>}
                </div>
              </form>
            </div>

            {/* Users table */}
            <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700 }}>Accounts</span>
                  <span style={{ background: 'var(--surface3)', borderRadius: '980px', padding: '1px 9px', fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text2)' }}>
                    {users.length}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <select className="input-field" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
                    style={{ width: 'auto', minWidth: '110px', padding: '6px 10px', fontSize: 'var(--fs-xs)' }}>
                    <option value="all">All roles</option>
                    <option value="super_admin">Super Admin</option>
                    <option value="admin">Admin</option>
                    <option value="employee">Employee</option>
                  </select>
                  <SearchBar value={userSearch} onChange={setUserSearch} placeholder="Search users…" count={filteredUsers.length} />
                </div>
              </div>
              {loading ? (
                <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text2)', fontSize: 'var(--fs-sm)' }}>Loading…</div>
              ) : users.length === 0 ? (
                <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                  <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.3 }}>👤</div>
                  <div style={{ color: 'var(--text2)', fontSize: 'var(--fs-sm)', marginBottom: '4px' }}>No accounts yet</div>
                  <div style={{ color: 'var(--text3)', fontSize: 'var(--fs-xs)' }}>Create an account above to get started.</div>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text2)', fontSize: 'var(--fs-sm)' }}>No accounts match your search.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['Username', 'Role', 'Linked Employee', 'Created', 'Actions'].map(h => (
                          <th key={h} style={thStyle}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map(u => {
                        const emp = employees.find(e => e.code === u.employeeCode);
                        return (
                          <tr key={u.id}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                            onMouseLeave={e => e.currentTarget.style.background = ''}>
                            <td style={{ ...tdStyle, fontWeight: 500 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{
                                  width: '28px', height: '28px', borderRadius: '50%',
                                  background: ROLE_STYLES[u.role]?.bg || 'var(--surface3)',
                                  display: 'grid', placeItems: 'center',
                                  fontSize: '11px', fontWeight: 700,
                                  color: ROLE_STYLES[u.role]?.color || 'var(--text2)',
                                  flexShrink: 0,
                                }}>
                                  {u.username.charAt(0).toUpperCase()}
                                </div>
                                <span>{u.username}</span>
                              </div>
                            </td>
                            <td style={tdStyle}><RoleBadge role={u.role} /></td>
                            <td style={{ ...tdStyle, color: emp ? 'var(--text)' : 'var(--text3)' }}>
                              {emp ? `${emp.name} (${emp.code})` : '—'}
                            </td>
                            <td style={{ ...tdStyle, color: 'var(--text2)', fontSize: 'var(--fs-xs)', whiteSpace: 'nowrap' }}>
                              {new Date(u.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </td>
                            <td style={tdStyle}>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button className="btn btn-secondary" style={{ padding: '4px 12px', fontSize: 'var(--fs-xs)' }} onClick={() => openEdit(u)}>Edit</button>
                                <button onClick={() => handleDelete(u)} style={{
                                  padding: '4px 11px', fontSize: 'var(--fs-xs)', borderRadius: '980px',
                                  border: '1px solid rgba(255,59,48,0.2)', background: 'rgba(255,59,48,0.06)',
                                  color: 'var(--red)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
                                  transition: 'all 0.15s',
                                }}>Delete</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Role permissions sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
            <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text2)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Role Permissions
            </div>
            {ROLE_PERMISSIONS.map(item => (
              <div key={item.role} className="card" style={{ padding: '16px', borderLeft: `3px solid ${item.color}`, borderTopLeftRadius: '6px', borderBottomLeftRadius: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <span style={{ fontSize: '16px' }}>{item.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 'var(--fs-sm)', color: item.color }}>{item.role}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '1px' }}>
                      {item.role === 'Super Admin' ? 'Full system access' : item.role === 'Admin' ? 'Operational access' : 'Self-service access'}
                    </div>
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

      {/* ── EMPLOYEE DETAILS TAB ── */}
      {tab === 'employees' && (
        <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700 }}>Employee Details</span>
              <span style={{ background: 'var(--surface3)', borderRadius: '980px', padding: '1px 9px', fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text2)' }}>
                {employees.length}
              </span>
            </div>
            <SearchBar value={empSearch} onChange={setEmpSearch} placeholder="Search employees…" count={filteredEmployees.length} />
          </div>
          {employees.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.3 }}>👥</div>
              <div style={{ color: 'var(--text2)', fontSize: 'var(--fs-sm)' }}>No employees loaded yet.</div>
              <div style={{ color: 'var(--text3)', fontSize: 'var(--fs-xs)', marginTop: '2px' }}>Upload attendance data on the Dashboard to populate this list.</div>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text2)', fontSize: 'var(--fs-sm)' }}>No employees match your search.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Code', 'Name', 'Birthday', 'Work Anniversary', 'Actions'].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map(emp => (
                    <tr key={emp.code}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}>
                      <td style={{ ...tdStyle, color: 'var(--text2)', fontSize: 'var(--fs-xs)', fontFamily: 'monospace' }}>{emp.code}</td>
                      <td style={{ ...tdStyle, fontWeight: 500 }}>{emp.name}</td>
                      <td style={{ ...tdStyle, color: emp.birthday ? 'var(--text)' : 'var(--text3)' }}>
                        {emp.birthday
                          ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>🎂 {new Date(emp.birthday).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                          : '—'}
                      </td>
                      <td style={{ ...tdStyle, color: emp.workAnniversary ? 'var(--text)' : 'var(--text3)' }}>
                        {emp.workAnniversary
                          ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>🏢 {new Date(emp.workAnniversary).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                          : '—'}
                      </td>
                      <td style={tdStyle}>
                        <button className="btn btn-secondary" style={{ padding: '4px 12px', fontSize: 'var(--fs-xs)' }} onClick={() => openEditEmp(emp)}>Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── PENDING APPROVALS TAB ── */}
      {tab === 'pending' && isSuperAdmin && (
        <div>
          {loading ? (
            <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text2)', fontSize: 'var(--fs-sm)' }}>Loading…</div>
          ) : pendingChanges.length === 0 ? (
            <div style={{ padding: '64px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '16px', opacity: 0.3 }}>✓</div>
              <div style={{ color: 'var(--text2)', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>All caught up</div>
              <div style={{ color: 'var(--text3)', fontSize: 'var(--fs-xs)', marginTop: '4px' }}>No pending changes require your approval.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {pendingChanges.map(c => {
                let payload = {};
                try { payload = JSON.parse(c.payload); } catch { /* malformed payload */ }
                const actionColors = {
                  create_user: { bg: 'rgba(52,199,89,0.1)', color: '#1a7f37', label: 'Create User' },
                  update_user: { bg: 'rgba(0,113,227,0.1)', color: '#0071e3', label: 'Update User' },
                  delete_user: { bg: 'rgba(255,59,48,0.1)', color: '#c0392b', label: 'Delete User' },
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
                      <button className="btn btn-primary" style={{ padding: '6px 16px', fontSize: 'var(--fs-sm)', background: 'var(--green)' }}
                        onClick={() => handleReview(c.id, true)}>Approve</button>
                      <button style={{ padding: '6px 16px', fontSize: 'var(--fs-sm)', borderRadius: '980px', border: '1px solid rgba(255,59,48,0.2)', background: 'rgba(255,59,48,0.06)', color: 'var(--red)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
                        onClick={() => handleReview(c.id, false)}>Reject</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Edit user modal */}
      <Modal open={!!editUser} onClose={() => setEditUser(null)} title={`Edit — ${editUser?.username || ''}`}>
        <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label className="input-label">New Password <span style={{ color: 'var(--text3)', fontWeight: 400, textTransform: 'none' }}>(leave blank to keep)</span></label>
            <input className="input-field" type="password" placeholder="••••••••" value={editFields.password}
              onChange={e => setEditFields(f => ({ ...f, password: e.target.value }))} />
          </div>
          <div>
            <label className="input-label">Role</label>
            <select className="input-field" value={editFields.role}
              onChange={e => setEditFields(f => ({ ...f, role: e.target.value }))}>
              {availableRoles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          {editFields.role === 'employee' && (
            <div>
              <label className="input-label">Linked Employee</label>
              <select className="input-field" value={editFields.employeeCode}
                onChange={e => setEditFields(f => ({ ...f, employeeCode: e.target.value }))}>
                <option value="">— None —</option>
                {employees.map(emp => <option key={emp.code} value={emp.code}>{emp.name} ({emp.code})</option>)}
              </select>
            </div>
          )}
          {editError && <div style={{ color: 'var(--red)', fontSize: 'var(--fs-sm)' }}>{editError}</div>}
          <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
            <button type="submit" className="btn btn-primary">Save Changes</button>
            <button type="button" className="btn btn-secondary" onClick={() => setEditUser(null)}>Cancel</button>
          </div>
        </form>
      </Modal>

      {/* Edit employee details modal */}
      <Modal open={!!editEmp} onClose={() => setEditEmp(null)} title={editEmp?.name || ''}>
        <form onSubmit={handleUpdateEmp} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label className="input-label">Birthday</label>
            <input className="input-field" type="date" value={empFields.birthday}
              onChange={e => setEmpFields(f => ({ ...f, birthday: e.target.value }))} />
          </div>
          <div>
            <label className="input-label">Work Anniversary</label>
            <input className="input-field" type="date" value={empFields.workAnniversary}
              onChange={e => setEmpFields(f => ({ ...f, workAnniversary: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
            <button type="submit" className="btn btn-primary">Save</button>
            <button type="button" className="btn btn-secondary" onClick={() => setEditEmp(null)}>Cancel</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
