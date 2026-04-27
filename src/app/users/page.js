"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';
import { getUsers, createUser, deleteUser, updateUser, getPendingChanges, reviewPendingChange } from '../../actions/auth';
import { fetchDashboardData, getMonths } from '../../actions/attendance';
import { getEmployeeDetails, updateEmployeeDetails } from '../../actions/employees';

export default function UsersPage() {
  const { isAdmin, isSuperAdmin, isAuthenticated, user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState('users'); // 'users' | 'pending' | 'employees'
  const [users, setUsers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [pendingChanges, setPendingChanges] = useState([]);
  const [loading, setLoading] = useState(true);

  // Create form
  const [form, setForm] = useState({ username: '', password: '', role: 'employee', employeeCode: '' });
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Edit modal
  const [editUser, setEditUser] = useState(null);
  const [editFields, setEditFields] = useState({ password: '', employeeCode: '', role: '' });
  const [editError, setEditError] = useState('');

  // Employee details modal
  const [editEmp, setEditEmp] = useState(null);
  const [empFields, setEmpFields] = useState({ birthday: '', workAnniversary: '' });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
    if (!authLoading && isAuthenticated && !isAdmin) router.push('/');
  }, [isAuthenticated, isAdmin, authLoading, router]);

  useEffect(() => {
    if (isAdmin) loadData();
  }, [isAdmin]);

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
      setEmployees(empData.map(e => ({ code: e.code, name: e.name })));
    }
    setLoading(false);
  };

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

  const handleDelete = async (u) => {
    if (!confirm(`Delete user "${u.username}"?`)) return;
    await deleteUser(u.id);
    loadData();
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
    const result = await reviewPendingChange(changeId, user.username, approve);
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

  return (
    <div style={{ padding: '24px 28px', maxWidth: '960px', margin: '0 auto' }} className="animate-fade-in">
      <button className="btn btn-secondary" style={{ marginBottom: '20px' }} onClick={() => router.push('/')}>
        ← Dashboard
      </button>

      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.04em' }}>User Management</h1>
        <p style={{ color: 'var(--text2)', fontSize: '14px', marginTop: '4px' }}>
          Manage accounts, roles, and employee details.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', background: 'var(--surface3)', borderRadius: '10px', padding: '3px', marginBottom: '24px', width: 'fit-content' }}>
        {[
          { key: 'users', label: 'Accounts' },
          { key: 'employees', label: 'Employee Details' },
          ...(isSuperAdmin ? [{ key: 'pending', label: `Pending Approvals${pendingChanges.length > 0 ? ` (${pendingChanges.length})` : ''}` }] : [])
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '6px 16px', borderRadius: '7px', fontSize: '13px', fontWeight: 500,
            border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            background: tab === t.key ? 'var(--surface)' : 'transparent',
            color: tab === t.key ? 'var(--text)' : 'var(--text2)',
            boxShadow: tab === t.key ? 'var(--shadow-sm)' : 'none',
            transition: 'all 0.15s'
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── ACCOUNTS TAB ── */}
      {tab === 'users' && (
        <>
          {/* Permissions summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
            {[
              { role: 'Super Admin', icon: '👑', color: '#c0392b', bg: 'rgba(255,59,48,0.06)',
                perms: ['All admin capabilities', 'Approve / reject admin changes', 'Manage all user accounts', 'Full audit access'] },
              { role: 'Admin', icon: '🔑', color: '#0071e3', bg: 'rgba(0,113,227,0.06)',
                perms: ['Upload attendance data', 'Apply WFM / WFH / WOS overrides', 'Export CSV', 'Manage employee accounts', 'Changes require super admin approval'] },
              { role: 'Employee', icon: '👤', color: '#1a7f37', bg: 'rgba(52,199,89,0.06)',
                perms: ['View own attendance only', 'Read-only calendar', 'No edit access'] },
            ].map(item => (
              <div key={item.role} className="card" style={{ padding: '16px 18px', borderTop: `3px solid ${item.color}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <span>{item.icon}</span>
                  <span style={{ fontWeight: 700, fontSize: '14px', color: item.color }}>{item.role}</span>
                </div>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {item.perms.map(p => (
                    <li key={p} style={{ fontSize: '11px', color: 'var(--text2)', display: 'flex', gap: '6px' }}>
                      <span style={{ color: item.color }}>●</span> {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Create form */}
          <div className="card" style={{ padding: '22px 24px', marginBottom: '20px' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '16px' }}>Create Account</div>
            <form onSubmit={handleCreate}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 160px 1fr', gap: '12px', alignItems: 'end' }}>
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
              {formError && <div style={{ marginTop: '10px', color: 'var(--red)', fontSize: '13px' }}>{formError}</div>}
              {formSuccess && <div style={{ marginTop: '10px', color: 'var(--green)', fontSize: '13px' }}>{formSuccess}</div>}
              <button type="submit" className="btn btn-primary" disabled={submitting}
                style={{ marginTop: '14px', opacity: submitting ? 0.7 : 1 }}>
                {submitting ? 'Creating…' : 'Create Account'}
              </button>
            </form>
          </div>

          {/* Users table */}
          <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontSize: '14px', fontWeight: 700 }}>
              Accounts ({users.length})
            </div>
            {loading ? <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text2)', fontSize: '14px' }}>Loading…</div> : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr>
                    {['Username', 'Role', 'Linked Employee', 'Created', 'Actions'].map(h => (
                      <th key={h} style={{ background: 'var(--surface2)', padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text2)', borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => {
                    const rc = roleColor(u.role);
                    const emp = employees.find(e => e.code === u.employeeCode);
                    return (
                      <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 500 }}>{u.username}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ display: 'inline-flex', padding: '3px 10px', borderRadius: '980px', fontSize: '11px', fontWeight: 600, background: rc.bg, color: rc.color }}>
                            {roleLabel(u.role)}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: emp ? 'var(--text)' : 'var(--text3)' }}>
                          {emp ? `${emp.name} (${emp.code})` : '—'}
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--text2)', fontSize: '12px' }}>
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button className="btn btn-secondary" style={{ padding: '5px 12px', fontSize: '12px' }} onClick={() => openEdit(u)}>Edit</button>
                            <button onClick={() => handleDelete(u)} style={{ padding: '5px 12px', fontSize: '12px', borderRadius: '980px', border: '1px solid rgba(255,59,48,0.25)', background: 'rgba(255,59,48,0.06)', color: 'var(--red)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ── EMPLOYEE DETAILS TAB ── */}
      {tab === 'employees' && (
        <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontSize: '14px', fontWeight: 700 }}>
            Employee Details ({employees.length})
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr>
                {['Code', 'Name', 'Birthday', 'Work Anniversary', 'Actions'].map(h => (
                  <th key={h} style={{ background: 'var(--surface2)', padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text2)', borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => (
                <tr key={emp.code} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 16px', color: 'var(--text2)', fontSize: '12px' }}>{emp.code}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 500 }}>{emp.name}</td>
                  <td style={{ padding: '12px 16px', color: emp.birthday ? 'var(--text)' : 'var(--text3)' }}>
                    {emp.birthday ? new Date(emp.birthday).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                  <td style={{ padding: '12px 16px', color: emp.workAnniversary ? 'var(--text)' : 'var(--text3)' }}>
                    {emp.workAnniversary ? new Date(emp.workAnniversary).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <button className="btn btn-secondary" style={{ padding: '5px 12px', fontSize: '12px' }} onClick={() => openEditEmp(emp)}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── PENDING APPROVALS TAB (super_admin only) ── */}
      {tab === 'pending' && isSuperAdmin && (
        <div>
          {pendingChanges.length === 0 ? (
            <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text2)', fontSize: '14px' }}>
              No pending changes. All clear ✓
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {pendingChanges.map(c => {
                const payload = JSON.parse(c.payload);
                return (
                  <div key={c.id} className="card" style={{ padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                        <span style={{ background: 'rgba(0,113,227,0.1)', color: 'var(--blue)', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', marginRight: '8px' }}>{c.action}</span>
                        by <strong>{c.requestedBy}</strong>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text2)', fontFamily: 'monospace', background: 'var(--surface2)', padding: '6px 10px', borderRadius: '6px', marginTop: '6px' }}>
                        {JSON.stringify(payload, null, 0).slice(0, 120)}…
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '6px' }}>
                        {new Date(c.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                      <button className="btn btn-primary" style={{ padding: '7px 16px', fontSize: '13px', background: 'var(--green)' }}
                        onClick={() => handleReview(c.id, true)}>Approve</button>
                      <button style={{ padding: '7px 16px', fontSize: '13px', borderRadius: '980px', border: '1px solid rgba(255,59,48,0.25)', background: 'rgba(255,59,48,0.06)', color: 'var(--red)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 200, display: 'grid', placeItems: 'center', backdropFilter: 'blur(8px)' }} onClick={() => setEditUser(null)}>
          <div className="card" style={{ width: '440px', maxWidth: '96vw', padding: '28px', animation: 'fadeIn 0.2s ease' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '17px', fontWeight: 700, letterSpacing: '-0.03em' }}>Edit — {editUser.username}</div>
              <button onClick={() => setEditUser(null)} style={{ width: '28px', height: '28px', borderRadius: '50%', border: 'none', background: 'var(--surface3)', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit' }}>✕</button>
            </div>
            <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="input-label">New Password <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(leave blank to keep)</span></label>
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
              {editError && <div style={{ color: 'var(--red)', fontSize: '13px' }}>{editError}</div>}
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 200, display: 'grid', placeItems: 'center', backdropFilter: 'blur(8px)' }} onClick={() => setEditEmp(null)}>
          <div className="card" style={{ width: '420px', maxWidth: '96vw', padding: '28px', animation: 'fadeIn 0.2s ease' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '17px', fontWeight: 700, letterSpacing: '-0.03em' }}>{editEmp.name}</div>
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
    </div>
  );
}
