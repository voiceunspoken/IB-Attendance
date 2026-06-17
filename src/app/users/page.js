"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';
import { getUsers, createUser, deleteUser, updateUser, toggleDisableUser, promoteToAdmin, getPendingChanges, reviewPendingChange } from '../../actions/auth';
import ConfirmModal from '../../components/ConfirmModal';
import { FiSearch } from 'react-icons/fi';

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

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200,
      display: 'grid', placeItems: 'center', backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)', padding: '24px',
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

export default function UsersPage() {
  const { isAdmin, isSuperAdmin, isAuthenticated, user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState('accounts');
  const [users, setUsers] = useState([]);
  const [pendingChanges, setPendingChanges] = useState([]);
  const [loading, setLoading] = useState(true);

  // Users with code who are not yet admin — eligible for promotion
  const [promotableEmployees, setPromotableEmployees] = useState([]);
  const [promoteTarget, setPromoteTarget] = useState('');

  const [form, setForm] = useState({ username: '', password: '', role: 'employee', code: '', name: '' });
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [editUser, setEditUser] = useState(null);
  const [editFields, setEditFields] = useState({ password: '', role: '', code: '', name: '' });
  const [editError, setEditError] = useState('');

  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [userPage, setUserPage] = useState(1);
  const pageSize = 20;
  const [confirmState, setConfirmState] = useState({ show: false, message: '', onConfirm: null, confirmLabel: null, confirmLoadingLabel: null, variant: null });
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [promoteUserId, setPromoteUserId] = useState('');
  const [promoteRole, setPromoteRole] = useState('admin');
  const [promoteResult, setPromoteResult] = useState('');
  const [promoting, setPromoting] = useState(false);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
    if (!authLoading && isAuthenticated && !isAdmin) router.push('/');
  }, [isAuthenticated, isAdmin, authLoading, router]);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const [u, pending] = await Promise.all([
        getUsers(),
        isSuperAdmin ? getPendingChanges() : Promise.resolve([])
      ]);
      setUsers(u);
      setPendingChanges(pending);
      // Users with code who are not admin/super_admin — eligible for promotion
      setPromotableEmployees(u.filter(x => x.code && x.role === 'employee'));
      setLoading(false);
    })();
  }, [isAdmin, isSuperAdmin, fetchTrigger]);

  useEffect(() => { setUserPage(1); }, [userSearch, roleFilter]);
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const q = userSearch.toLowerCase();
      if (q && !u.username.toLowerCase().includes(q) && !(u.name || '').toLowerCase().includes(q) && !(u.code || '').toLowerCase().includes(q)) return false;
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      return true;
    });
  }, [users, userSearch, roleFilter]);
  const paginatedUsers = filteredUsers.slice((userPage - 1) * pageSize, userPage * pageSize);
  const totalUserPages = Math.ceil(filteredUsers.length / pageSize);

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError(''); setFormSuccess('');

    // Admin/super_admin: promote existing employee instead of creating new user
    if (form.role === 'admin' || form.role === 'super_admin') {
      if (!promoteTarget) return setFormError('Select an employee to promote.');
      setSubmitting(true);
      const target = promotableEmployees.find(x => x.id === promoteTarget);
      const result = await promoteToAdmin(promoteTarget, form.role, user.username);
      setSubmitting(false);
      if (result.error) return setFormError(result.error);
      setFormSuccess(`"${target?.name || target?.username}" promoted to ${form.role}. They can login with their existing credentials.`);
      setForm({ username: '', password: '', role: 'employee', code: '', name: '' });
      setPromoteTarget('');
      setFetchTrigger(t => t + 1);
      return;
    }

    if (!form.username || !form.password) return setFormError('Username and password are required.');
    setSubmitting(true);
    const result = await createUser(form.username.trim(), form.password, form.role, form.code || null, user.username);
    setSubmitting(false);
    if (result.error) return setFormError(result.error);
    setFormSuccess(`User "${form.username}" created.`);
    setForm({ username: '', password: '', role: 'employee', code: '', name: '' });
    setFetchTrigger(t => t + 1);
  };

  const handleDelete = (u) => {
    setConfirmState({
      show: true,
      message: `Delete user "${u.username}" and ALL their attendance data? This cannot be undone.`,
      confirmLabel: 'Delete',
      confirmLoadingLabel: 'Deleting…',
      variant: 'danger',
      onConfirm: async () => {
        await deleteUser(u.id, user.username);
        setFetchTrigger(t => t + 1);
      },
    });
  };

  const handleToggleDisable = async (u) => {
    setConfirmState({
      show: true,
      message: u.disabled
        ? `Enable user "${u.username}" again? They will be able to log in.`
        : `Disable user "${u.username}"? They will be unable to log in. Data is preserved.`,
      confirmLabel: u.disabled ? 'Enable' : 'Disable',
      confirmLoadingLabel: 'Updating…',
      variant: u.disabled ? 'default' : 'danger',
      onConfirm: async () => {
        await toggleDisableUser(u.id, user.username);
        setFetchTrigger(t => t + 1);
      },
    });
  };

  const openEdit = (u) => {
    setEditUser(u);
    setEditFields({ password: '', role: u.role, code: u.code || '', name: u.name || '' });
    setEditError('');
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setEditError('');
    const fields = {};
    if (editFields.password) fields.password = editFields.password;
    if (editFields.code !== editUser.code) fields.code = editFields.code;
    if (editFields.name !== editUser.name) fields.name = editFields.name;
    if (editFields.role !== editUser.role) fields.role = editFields.role;
    if (!Object.keys(fields).length) return setEditError('No changes made.');
    const result = await updateUser(editUser.id, fields, user.username);
    if (result.error) return setEditError(result.error);
    setEditUser(null);
    setFetchTrigger(t => t + 1);
  };

  const handleReview = async (changeId, approve) => {
    await reviewPendingChange(changeId, user.username, approve);
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

  const availableRoles = isSuperAdmin
    ? [{ value: 'employee', label: 'Employee' }, { value: 'admin', label: 'Admin' }, { value: 'super_admin', label: 'Super Admin' }]
    : [{ value: 'employee', label: 'Employee' }, { value: 'admin', label: 'Admin' }];

  if (authLoading || !isAuthenticated || !isAdmin) return null;

  const tabs = [
    { key: 'accounts', label: 'Accounts' },
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
            Manage accounts, roles, and employee details in one place.
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
      {tab === 'accounts' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 'var(--gap)', alignItems: 'start' }}>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>

            {/* Create form */}
            <div className="card" style={{ padding: 'clamp(16px, 2vw, 22px)' }}>
              <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '16px' }}>
                Create Account
              </div>
              <form onSubmit={handleCreate}>
                {form.role === 'admin' || form.role === 'super_admin' ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                      <div>
                        <label className="input-label">Role</label>
                        <select className="input-field" value={form.role}
                          onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                          {availableRoles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="input-label">Select Employee</label>
                        <select className="input-field" value={promoteTarget}
                          onChange={e => setPromoteTarget(e.target.value)}>
                          <option value="">— Select employee to promote —</option>
                          {promotableEmployees.map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.name || emp.username} ({emp.code})</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {promoteTarget && (() => {
                      const emp = promotableEmployees.find(x => x.id === promoteTarget);
                      const s = ROLE_STYLES[form.role];
                      return (
                        <div style={{ background: 'var(--surface2)', borderRadius: '10px', padding: '10px 14px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '16px' }}>●</span>
                          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text2)' }}>
                            "<strong>{emp?.name || emp?.username}</strong>" will be promoted to <strong style={{ color: s.color }}>{s.label}</strong>.
                            They can login with their existing credentials.
                          </span>
                        </div>
                      );
                    })()}
                  </>
                ) : (
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
                        onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                        {availableRoles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="input-label">Employee Code</label>
                      <input className="input-field" placeholder="e.g. 1042" value={form.code}
                        onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
                    </div>
                    <div>
                      <label className="input-label">Full Name</label>
                      <input className="input-field" placeholder="e.g. John Doe" value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                    </div>
                  </div>
                )}
                {/* Role preview */}
                {form.role === 'employee' && form.role && (() => {
                  const s = ROLE_STYLES[form.role];
                  return (
                    <div style={{ background: 'var(--surface2)', borderRadius: '10px', padding: '10px 14px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '16px' }}>●</span>
                      <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text2)' }}>
                        Will be created as <strong style={{ color: s.color }}>{s.label}</strong>.
                      </span>
                    </div>
                  );
                })()}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <button type="submit" className="btn btn-primary" disabled={submitting}
                    style={{ opacity: submitting ? 0.7 : 1 }}>
                    {submitting ? 'Processing…' : (form.role === 'admin' || form.role === 'super_admin' ? 'Promote to ' + (form.role === 'super_admin' ? 'Super Admin' : 'Admin') : 'Create Account')}
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
                  <button onClick={() => { setPromoteUserId(''); setPromoteRole('admin'); setPromoteResult(''); setShowPromoteModal(true); }}
                    style={{ padding: '6px 12px', borderRadius: '980px', border: '1px solid rgba(0,113,227,0.2)', background: 'rgba(0,113,227,0.06)', color: 'var(--blue)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, fontSize: 'var(--fs-xs)', whiteSpace: 'nowrap', transition: 'all 0.15s' }}>
                    + Promote
                  </button>
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
                  <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.3 }}>●</div>
                  <div style={{ color: 'var(--text2)', fontSize: 'var(--fs-sm)', marginBottom: '4px' }}>No accounts yet</div>
                  <div style={{ color: 'var(--text3)', fontSize: 'var(--fs-xs)' }}>Create an account above to get started.</div>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text2)', fontSize: 'var(--fs-sm)' }}>No accounts match your search.</div>
              ) : (
                <><div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['Username', 'Name', 'Code', 'Role', 'Status', 'Created', 'Actions'].map(h => (
                          <th key={h} style={thStyle}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedUsers.map(u => (
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
                          <td style={{ ...tdStyle, color: u.name ? 'var(--text)' : 'var(--text3)' }}>{u.name || '—'}</td>
                          <td style={{ ...tdStyle, color: u.code ? 'var(--text)' : 'var(--text3)', fontSize: 'var(--fs-xs)', fontFamily: 'monospace' }}>{u.code || '—'}</td>
                          <td style={tdStyle}><RoleBadge role={u.role} /></td>
                          <td style={tdStyle}>{u.disabled ? <DisabledBadge /> : <span style={{ color: 'var(--green)', fontSize: 'var(--fs-xs)', fontWeight: 500 }}>Active</span>}</td>
                          <td style={{ ...tdStyle, color: 'var(--text2)', fontSize: 'var(--fs-xs)', whiteSpace: 'nowrap' }}>
                            {new Date(u.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                          <td style={tdStyle}>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button className="btn btn-secondary" style={{ padding: '4px 12px', fontSize: 'var(--fs-xs)' }} onClick={() => openEdit(u)}>Edit</button>
                              <button onClick={() => handleToggleDisable(u)} style={{
                                padding: '4px 11px', fontSize: 'var(--fs-xs)', borderRadius: '980px',
                                border: '1px solid rgba(255,159,10,0.2)', background: 'rgba(255,159,10,0.06)',
                                color: '#b36200', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
                                transition: 'all 0.15s',
                              }}>{u.disabled ? 'Enable' : 'Disable'}</button>
                              <button onClick={() => handleDelete(u)} style={{
                                padding: '4px 11px', fontSize: 'var(--fs-xs)', borderRadius: '980px',
                                border: '1px solid rgba(255,59,48,0.2)', background: 'rgba(255,59,48,0.06)',
                                color: 'var(--red)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
                                transition: 'all 0.15s',
                              }}>Delete</button>
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
            <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text2)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Role Permissions
            </div>
            {ROLE_PERMISSIONS.map(item => (
              <div key={item.role} className="card" style={{ padding: '16px', borderLeft: `3px solid ${item.color}`, borderTopLeftRadius: '6px', borderBottomLeftRadius: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <div style={{
                    width: '24px', height: '24px', borderRadius: '50%',
                    background: item.bg, display: 'grid', placeItems: 'center',
                    fontSize: '12px', fontWeight: 700, color: item.color,
                  }}>●</div>
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
          <div>
            <label className="input-label">Employee Code</label>
            <input className="input-field" placeholder="e.g. 1042" value={editFields.code}
              disabled style={{ opacity: 0.6, cursor: 'not-allowed' }} />
          </div>
          <div>
            <label className="input-label">Full Name</label>
            <input className="input-field" placeholder="e.g. John Doe" value={editFields.name}
              disabled style={{ opacity: 0.6, cursor: 'not-allowed' }} />
          </div>
          {editError && <div style={{ color: 'var(--red)', fontSize: 'var(--fs-sm)' }}>{editError}</div>}
          <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
            <button type="submit" className="btn btn-primary">Save Changes</button>
            <button type="button" className="btn btn-secondary" onClick={() => setEditUser(null)}>Cancel</button>
          </div>
        </form>
      </Modal>

      {/* Quick promote modal */}
      <Modal open={showPromoteModal} onClose={() => setShowPromoteModal(false)} title="Promote Employee">
        <form onSubmit={handleQuickPromote} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label className="input-label">Select Employee</label>
            <select className="input-field" value={promoteUserId}
              onChange={e => setPromoteUserId(e.target.value)} required>
              <option value="">— Choose an employee —</option>
              {users.filter(x => x.code && x.role === 'employee').map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name || emp.username} ({emp.code})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="input-label">Promote to</label>
            <select className="input-field" value={promoteRole}
              onChange={e => setPromoteRole(e.target.value)}>
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
            <button type="submit" className="btn btn-primary" disabled={promoting || !promoteUserId}
              style={{ opacity: (promoting || !promoteUserId) ? 0.7 : 1 }}>
              {promoting ? 'Promoting…' : 'Promote'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowPromoteModal(false)}>Cancel</button>
          </div>
        </form>
      </Modal>

      {/* Confirm modal */}
      {confirmState.show && (
        <ConfirmModal
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          confirmLoadingLabel={confirmState.confirmLoadingLabel}
          variant={confirmState.variant}
          onConfirm={async () => {
            await confirmState.onConfirm();
            setConfirmState(s => ({ ...s, show: false }));
          }}
          onCancel={() => setConfirmState(s => ({ ...s, show: false }))}
        />
      )}
    </div>
  );
}
