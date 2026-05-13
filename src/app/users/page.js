"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';
import { getUsers, createUser, deleteUser, updateUser, getPendingChanges, reviewPendingChange } from '../../actions/auth';
import { fetchDashboardData, getMonths } from '../../actions/attendance';
import { updateEmployeeDetails } from '../../actions/employees';
import ConfirmDialog from '../../components/ConfirmDialog';

export default function UsersPage() {
  const { isAdmin, isSuperAdmin, isAuthenticated, user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [pendingChanges, setPendingChanges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: null });

  const [form, setForm] = useState({ username: '', password: '', role: 'employee', employeeCode: '' });
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [editUser, setEditUser] = useState(null);
  const [editFields, setEditFields] = useState({ password: '', employeeCode: '', role: '' });
  const [editError, setEditError] = useState('');

  const [editEmp, setEditEmp] = useState(null);
  const [empFields, setEmpFields] = useState({ birthday: '', workAnniversary: '' });

  const loadData = async () => {
    setLoading(true);
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
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
    if (!authLoading && isAuthenticated && !isAdmin) router.push('/');
  }, [isAuthenticated, isAdmin, authLoading, router]);

  useEffect(() => {
    if (isAdmin) loadData(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

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
    loadData();
  };

  const handleDelete = (u) => {
    setConfirmDialog({
      open: true, title: 'Delete User',
      message: `Delete user "${u.username}"? This action cannot be undone.`,
      onConfirm: async () => {
        setConfirmDialog(d => ({ ...d, open: false }));
        await deleteUser(u.id);
        loadData();
      }
    });
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
    loadData();
  };

  const handleReview = async (changeId, approve) => {
    await reviewPendingChange(changeId, user.username, approve);
    loadData();
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
    loadData();
  };

  if (authLoading || !isAuthenticated || !isAdmin) return null;

  const roleColor = (role) => {
    if (role === 'super_admin') return { bg: 'rgba(255,59,48,0.08)', color: '#c0392b' };
    if (role === 'admin') return { bg: 'rgba(0,113,227,0.1)', color: '#0071e3' };
    return { bg: 'rgba(52,199,89,0.1)', color: '#1a7f37' };
  };
  const roleLabel = (role) => role === 'super_admin' ? 'Super Admin' : role === 'admin' ? 'Admin' : 'Employee';

  const availableRoles = isSuperAdmin
    ? [{ value: 'employee', label: 'Employee' }, { value: 'admin', label: 'Admin' }, { value: 'super_admin', label: 'Super Admin' }]
    : [{ value: 'employee', label: 'Employee' }, { value: 'admin', label: 'Admin' }];

  const tabs = [
    { key: 'users', label: 'Accounts' },
    { key: 'employees', label: 'Employee Details' },
    ...(isSuperAdmin ? [{ key: 'pending', label: `Pending${pendingChanges.length > 0 ? ` (${pendingChanges.length})` : ''}` }] : [])
  ];

  const thStyle = {
    background: 'var(--surface2)', padding: '9px 14px', textAlign: 'left',
    fontWeight: 600, fontSize: '10px', textTransform: 'uppercase',
    letterSpacing: '0.05em', color: 'var(--text2)', borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap',
  };
  const tdStyle = { padding: '10px 14px', fontSize: 'var(--fs-sm)', color: 'var(--text)', borderBottom: '1px solid var(--border)' };

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

        {/* Tabs */}
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

          {/* LEFT — create form + table */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>

            {/* Create form */}
            <div className="card" style={{ padding: 'clamp(16px, 2vw, 22px)' }}>
              <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '14px' }}>
                Create Account
              </div>
              <form onSubmit={handleCreate}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 140px', gap: '10px', marginBottom: '10px' }}>
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
                </div>
                {form.role === 'employee' && (
                  <div style={{ marginBottom: '10px' }}>
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
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 'var(--fs-sm)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                Accounts
                <span style={{ background: 'var(--surface3)', borderRadius: '980px', padding: '1px 9px', fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text2)' }}>
                  {users.length}
                </span>
              </div>
              {loading ? (
                <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text2)', fontSize: 'var(--fs-sm)' }}>Loading…</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Username', 'Role', 'Linked Employee', 'Created', 'Actions'].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => {
                      const rc = roleColor(u.role);
                      const emp = employees.find(e => e.code === u.employeeCode);
                      return (
                        <tr key={u.id}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                          onMouseLeave={e => e.currentTarget.style.background = ''}>
                          <td style={{ ...tdStyle, fontWeight: 500 }}>{u.username}</td>
                          <td style={tdStyle}>
                            <span style={{ display: 'inline-flex', padding: '2px 9px', borderRadius: '980px', fontSize: 'var(--fs-xs)', fontWeight: 600, background: rc.bg, color: rc.color }}>
                              {roleLabel(u.role)}
                            </span>
                          </td>
                          <td style={{ ...tdStyle, color: emp ? 'var(--text)' : 'var(--text3)' }}>
                            {emp ? `${emp.name} (${emp.code})` : '—'}
                          </td>
                          <td style={{ ...tdStyle, color: 'var(--text2)', fontSize: 'var(--fs-xs)' }}>
                            {new Date(u.createdAt).toLocaleDateString()}
                          </td>
                          <td style={tdStyle}>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button className="btn btn-secondary" style={{ padding: '4px 12px', fontSize: 'var(--fs-xs)' }} onClick={() => openEdit(u)}>Edit</button>
                              <button onClick={() => handleDelete(u)} style={{ padding: '4px 12px', fontSize: 'var(--fs-xs)', borderRadius: '980px', border: '1px solid rgba(255,59,48,0.2)', background: 'rgba(255,59,48,0.06)', color: 'var(--red)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>Delete</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* RIGHT — role permission cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
            <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text2)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Role Permissions
            </div>
            {[
              { role: 'Super Admin', icon: '👑', color: '#c0392b', bg: 'rgba(255,59,48,0.06)',
                perms: ['All admin capabilities', 'Approve / reject admin changes', 'Manage all user accounts', 'Full audit log access'] },
              { role: 'Admin', icon: '🔑', color: '#0071e3', bg: 'rgba(0,113,227,0.06)',
                perms: ['Upload attendance data', 'Apply WFM / WFH / WOS overrides', 'Export CSV', 'Manage employee accounts', 'Changes need super admin approval'] },
              { role: 'Employee', icon: '👤', color: '#1a7f37', bg: 'rgba(52,199,89,0.06)',
                perms: ['View own attendance only', 'Read-only calendar', 'Apply for leave', 'No edit access'] },
            ].map(item => (
              <div key={item.role} className="card" style={{ padding: '14px 16px', borderLeft: `3px solid ${item.color}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '14px' }}>{item.icon}</span>
                  <span style={{ fontWeight: 700, fontSize: 'var(--fs-sm)', color: item.color }}>{item.role}</span>
                </div>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {item.perms.map(p => (
                    <li key={p} style={{ fontSize: 'var(--fs-xs)', color: 'var(--text2)', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                      <span style={{ color: item.color, marginTop: '1px', flexShrink: 0 }}>●</span> {p}
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
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 'var(--fs-sm)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            Employee Details
            <span style={{ background: 'var(--surface3)', borderRadius: '980px', padding: '1px 9px', fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text2)' }}>
              {employees.length}
            </span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Code', 'Name', 'Birthday', 'Work Anniversary', 'Actions'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => (
                <tr key={emp.code}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <td style={{ ...tdStyle, color: 'var(--text2)', fontSize: 'var(--fs-xs)' }}>{emp.code}</td>
                  <td style={{ ...tdStyle, fontWeight: 500 }}>{emp.name}</td>
                  <td style={{ ...tdStyle, color: emp.birthday ? 'var(--text)' : 'var(--text3)' }}>
                    {emp.birthday ? new Date(emp.birthday).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                  <td style={{ ...tdStyle, color: emp.workAnniversary ? 'var(--text)' : 'var(--text3)' }}>
                    {emp.workAnniversary ? new Date(emp.workAnniversary).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
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

      {/* ── PENDING APPROVALS TAB ── */}
      {tab === 'pending' && isSuperAdmin && (
        <div>
          {pendingChanges.length === 0 ? (
            <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text2)', fontSize: 'var(--fs-sm)' }}>
              No pending changes — all clear ✓
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {pendingChanges.map(c => {
                const payload = JSON.parse(c.payload);
                return (
                  <div key={c.id} className="card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, marginBottom: '4px' }}>
                        <span style={{ background: 'rgba(0,113,227,0.1)', color: 'var(--blue)', padding: '2px 8px', borderRadius: '6px', fontSize: 'var(--fs-xs)', marginRight: '8px' }}>{c.action}</span>
                        by <strong>{c.requestedBy}</strong>
                      </div>
                      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text2)', fontFamily: 'monospace', background: 'var(--surface2)', padding: '5px 10px', borderRadius: '6px', marginTop: '5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {JSON.stringify(payload, null, 0).slice(0, 100)}…
                      </div>
                      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text3)', marginTop: '5px' }}>
                        {new Date(c.createdAt).toLocaleString()}
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
      {editUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'grid', placeItems: 'center', backdropFilter: 'blur(10px)' }} onClick={() => setEditUser(null)}>
          <div className="card" style={{ width: '420px', maxWidth: '96vw', padding: '28px', animation: 'fadeIn 0.2s ease' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, letterSpacing: '-0.03em' }}>Edit — {editUser.username}</div>
              <button onClick={() => setEditUser(null)} style={{ width: '28px', height: '28px', borderRadius: '50%', border: 'none', background: 'var(--surface3)', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit' }}>✕</button>
            </div>
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
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button type="submit" className="btn btn-primary">Save Changes</button>
                <button type="button" className="btn btn-secondary" onClick={() => setEditUser(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit employee details modal */}
      {editEmp && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'grid', placeItems: 'center', backdropFilter: 'blur(10px)' }} onClick={() => setEditEmp(null)}>
          <div className="card" style={{ width: '400px', maxWidth: '96vw', padding: '28px', animation: 'fadeIn 0.2s ease' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, letterSpacing: '-0.03em' }}>{editEmp.name}</div>
              <button onClick={() => setEditEmp(null)} style={{ width: '28px', height: '28px', borderRadius: '50%', border: 'none', background: 'var(--surface3)', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit' }}>✕</button>
            </div>
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
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button type="submit" className="btn btn-primary">Save</button>
                <button type="button" className="btn btn-secondary" onClick={() => setEditEmp(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmDialog {...confirmDialog} onCancel={() => setConfirmDialog(d => ({ ...d, open: false }))} />
    </div>
  );
}
