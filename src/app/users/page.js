"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';
import { getUsers, createUser, deleteUser, updateUser } from '../../actions/auth';
import { fetchDashboardData, getMonths } from '../../actions/attendance';

export default function UsersPage() {
  const { isAdmin, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState([]);
  const [employees, setEmployees] = useState([]);
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

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
    if (!authLoading && isAuthenticated && !isAdmin) router.push('/');
  }, [isAuthenticated, isAdmin, authLoading, router]);

  useEffect(() => {
    if (isAdmin) loadData();
  }, [isAdmin]);

  const loadData = async () => {
    setLoading(true);
    const [u, months] = await Promise.all([getUsers(), getMonths()]);
    setUsers(u);
    if (months.length > 0) {
      const empData = await fetchDashboardData(months[0]);
      setEmployees(empData.map(e => ({ code: e.code, name: e.name })));
    }
    setLoading(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
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

  if (authLoading || !isAuthenticated || !isAdmin) return null;

  const roleColor = (role) => role === 'admin'
    ? { bg: 'rgba(0,113,227,0.1)', color: '#0071e3' }
    : { bg: 'rgba(52,199,89,0.1)', color: '#1a7f37' };

  return (
    <div style={{ padding: '24px 28px', maxWidth: '900px', margin: '0 auto' }} className="animate-fade-in">
      <button className="btn btn-secondary" style={{ marginBottom: '20px' }} onClick={() => router.push('/')}>
        ← Dashboard
      </button>

      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.04em', color: 'var(--text)' }}>User Management</h1>
        <p style={{ color: 'var(--text2)', fontSize: '14px', marginTop: '4px' }}>
          Create accounts for employees so they can view their own attendance.
        </p>
      </div>

      {/* Permissions summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '28px' }}>
        {[
          {
            role: 'Admin', icon: '🔑', color: '#0071e3', bg: 'rgba(0,113,227,0.06)',
            perms: ['Upload attendance data', 'Edit & delete records', 'Apply WFM/WFH overrides', 'Manage user accounts', 'Export CSV', 'View all employees']
          },
          {
            role: 'Employee', icon: '👤', color: '#1a7f37', bg: 'rgba(52,199,89,0.06)',
            perms: ['View own attendance only', 'View monthly calendar', 'View override history', 'No edit access', 'No upload access', 'No access to other employees']
          }
        ].map(item => (
          <div key={item.role} className="card" style={{ padding: '18px 20px', borderTop: `3px solid ${item.color}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '18px' }}>{item.icon}</span>
              <span style={{ fontWeight: 700, fontSize: '15px', letterSpacing: '-0.02em', color: item.color }}>{item.role}</span>
            </div>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {item.perms.map(p => (
                <li key={p} style={{ fontSize: '12px', color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: item.color, fontSize: '10px' }}>●</span> {p}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Create user form */}
      <div className="card" style={{ padding: '22px 24px', marginBottom: '24px' }}>
        <div style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '16px' }}>Create Account</div>
        <form onSubmit={handleCreate}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 140px 1fr', gap: '12px', alignItems: 'end' }}>
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
                <option value="employee">Employee</option>
                <option value="admin">Admin</option>
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
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontSize: '15px', fontWeight: 700, letterSpacing: '-0.02em' }}>
          Accounts ({users.length})
        </div>
        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text2)', fontSize: '14px' }}>Loading…</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr>
                {['Username', 'Role', 'Linked Employee', 'Created', 'Actions'].map(h => (
                  <th key={h} style={{
                    background: 'var(--surface2)', padding: '10px 16px', textAlign: 'left',
                    fontWeight: 600, fontSize: '11px', textTransform: 'uppercase',
                    letterSpacing: '0.04em', color: 'var(--text2)', borderBottom: '1px solid var(--border)'
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const rc = roleColor(u.role);
                const emp = employees.find(e => e.code === u.employeeCode);
                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--text)' }}>{u.username}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        display: 'inline-flex', padding: '3px 10px', borderRadius: '980px',
                        fontSize: '11px', fontWeight: 600, background: rc.bg, color: rc.color
                      }}>{u.role}</span>
                    </td>
                    <td style={{ padding: '12px 16px', color: emp ? 'var(--text)' : 'var(--text3)' }}>
                      {emp ? `${emp.name} (${emp.code})` : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text2)', fontSize: '12px' }}>
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button className="btn btn-secondary" style={{ padding: '5px 12px', fontSize: '12px' }}
                          onClick={() => openEdit(u)}>Edit</button>
                        <button
                          onClick={() => handleDelete(u)}
                          style={{
                            padding: '5px 12px', fontSize: '12px', borderRadius: '980px',
                            border: '1px solid rgba(255,59,48,0.25)', background: 'rgba(255,59,48,0.06)',
                            color: 'var(--red)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500
                          }}>Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit modal */}
      {editUser && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
          zIndex: 200, display: 'grid', placeItems: 'center',
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)'
        }} onClick={() => setEditUser(null)}>
          <div className="card" style={{ width: '440px', maxWidth: '96vw', padding: '28px', animation: 'fadeIn 0.2s ease' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '17px', fontWeight: 700, letterSpacing: '-0.03em' }}>Edit — {editUser.username}</div>
              <button onClick={() => setEditUser(null)} style={{
                width: '28px', height: '28px', borderRadius: '50%', border: 'none',
                background: 'var(--surface3)', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit'
              }}>✕</button>
            </div>
            <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="input-label">New Password <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(leave blank to keep)</span></label>
                <input className="input-field" type="password" placeholder="••••••••"
                  value={editFields.password} onChange={e => setEditFields(f => ({ ...f, password: e.target.value }))} />
              </div>
              <div>
                <label className="input-label">Role</label>
                <select className="input-field" value={editFields.role}
                  onChange={e => setEditFields(f => ({ ...f, role: e.target.value }))}>
                  <option value="employee">Employee</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              {editFields.role === 'employee' && (
                <div>
                  <label className="input-label">Linked Employee</label>
                  <select className="input-field" value={editFields.employeeCode}
                    onChange={e => setEditFields(f => ({ ...f, employeeCode: e.target.value }))}>
                    <option value="">— None —</option>
                    {employees.map(emp => (
                      <option key={emp.code} value={emp.code}>{emp.name} ({emp.code})</option>
                    ))}
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
    </div>
  );
}
