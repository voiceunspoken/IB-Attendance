"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';
import { getAllEmployees, addEmployee, deleteEmployee, deleteMonthRecord, updateMonthRecord, getMonths } from '../../actions/attendance';
import { updateEmployeeDetails } from '../../actions/employees';
import { getDepartments, addDepartment, deleteDepartment, getDesignations, addDesignation, deleteDesignation, setEmployeeManagers, getEmployeeManagers } from '../../actions/departments';
import { useToast } from '../../components/Toast';
import Modal from '../../components/Modal';
import ConfirmModal from '../../components/ConfirmModal';
import { FiPlus, FiTrash2 } from 'react-icons/fi';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function EmployeesPage() {
  const { isAdmin, isSuperAdmin, isAuthenticated, user, loading: authLoading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState('employees');

  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [months, setMonths] = useState([]);
  const [loading, setLoading] = useState(true);

  // Add employee form
  const [empForm, setEmpForm] = useState({ code: '', name: '', employeeType: 'regular', departmentId: '', designationId: '' });
  const [empMsg, setEmpMsg] = useState('');

  // Edit employee
  const [editEmp, setEditEmp] = useState(null);
  const [editEmpForm, setEditEmpForm] = useState({ name: '', birthday: '', joiningDate: '', workAnniversary: '', employeeType: 'regular', departmentId: '', subDepartmentId: '', designationId: '' });
  const [editEmpManagers, setEditEmpManagers] = useState([]);
  const [editEmpMsg, setEditEmpMsg] = useState('');

  // Delete/Edit month record
  const [editRecord, setEditRecord] = useState({ empCode: '', monthYear: '', present: '', absent: '', late: '', lateHD: '', shortShift: '', ssHD: '', rl: '', holi: '' });
  const [editRecordMsg, setEditRecordMsg] = useState('');

  // Pagination
  const [empPage, setEmpPage] = useState(1);
  const pageSize = 20;
  const paginatedEmployees = employees.slice((empPage - 1) * pageSize, empPage * pageSize);
  const totalEmpPages = Math.ceil(employees.length / pageSize);
  useEffect(() => { setEmpPage(1); }, [employees.length]);

  // Department form
  const [deptForm, setDeptForm] = useState({ name: '' });
  const [deptMsg, setDeptMsg] = useState('');

  // Designation form
  const [desigForm, setDesigForm] = useState({ name: '' });
  const [desigMsg, setDesigMsg] = useState('');

  const [confirmState, setConfirmState] = useState({ show: false, message: '', confirmLabel: 'Delete', confirmLoadingLabel: 'Deleting…', variant: 'danger', onConfirm: null });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
    if (!authLoading && isAuthenticated && !isAdmin) router.push('/');
  }, [isAuthenticated, isAdmin, authLoading, router]);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const [emps, depts, desigs, ms] = await Promise.all([
        getAllEmployees(),
        getDepartments(),
        getDesignations(),
        getMonths(),
      ]);
      setEmployees(emps);
      setDepartments(depts);
      setDesignations(desigs);
      setMonths(ms);
      setLoading(false);
    })();
  }, [isAdmin]);

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
    const emps = await getAllEmployees();
    setEmployees(emps);
  };

  const handleDeleteEmployee = (code, name) => {
    setConfirmState({
      show: true,
      message: `Delete ${name} and ALL their attendance data? This cannot be undone.`,
      onConfirm: async () => {
        await deleteEmployee(code, user.username);
        const emps = await getAllEmployees();
        setEmployees(emps);
      },
    });
  };

  const handleDeleteMonth = (code, name, monthYear) => {
    setConfirmState({
      show: true,
      message: `Delete ${name}'s data for ${monthYear}? This cannot be undone.`,
      onConfirm: async () => {
        await deleteMonthRecord(code, monthYear, user.username);
        toast.success('Month record deleted.');
      },
    });
  };

  const handleEditRecord = async (e) => {
    e.preventDefault();
    setEditRecordMsg('');
    if (!editRecord.empCode || !editRecord.monthYear) return setEditRecordMsg('Select employee and month.');
    const result = await updateMonthRecord(editRecord.empCode, editRecord.monthYear, editRecord, user.username);
    if (result.error) return setEditRecordMsg(result.error);
    setEditRecordMsg('Record updated successfully.');
  };

  const openEditEmployee = async (emp) => {
    setEditEmp(emp);
    setEditEmpForm({
      name: emp.name,
      birthday: emp.birthday ? new Date(emp.birthday).toISOString().split('T')[0] : '',
      joiningDate: emp.joiningDate ? new Date(emp.joiningDate).toISOString().split('T')[0] : '',
      workAnniversary: emp.workAnniversary ? new Date(emp.workAnniversary).toISOString().split('T')[0] : '',
      employeeType: emp.employeeType || 'regular',
      departmentId: emp.department?.id || '',
      subDepartmentId: emp.subDepartment?.id || '',
      designationId: emp.designation?.id || '',
    });
    setEditEmpMsg('');
    try {
      const mgrs = await getEmployeeManagers(emp.code);
      setEditEmpManagers(mgrs.map(m => m.code));
    } catch { setEditEmpManagers([]); }
  };

  const handleEditEmployee = async (e) => {
    e.preventDefault();
    if (!editEmp) return;
    const result = await updateEmployeeDetails(editEmp.code, editEmpForm);
    if (result.error) return setEditEmpMsg(result.error);
    await setEmployeeManagers(editEmp.code, editEmpManagers);
    setEditEmpMsg('Saved successfully.');
    const emps = await getAllEmployees();
    setEmployees(emps);
    setTimeout(() => setEditEmp(null), 800);
  };

  const handleAddDepartment = async (e) => {
    e.preventDefault();
    if (!deptForm.name.trim()) return;
    const result = await addDepartment(deptForm.name.trim());
    if (result.error) return setDeptMsg(result.error);
    setDeptForm({ name: '' });
    setDeptMsg('');
    setDepartments(await getDepartments());
  };

  const handleDeleteDepartment = (id, name) => {
    setConfirmState({
      show: true,
      message: `Delete "${name}" and all its sub-departments? Employees in this dept will be unlinked.`,
      onConfirm: async () => {
        await deleteDepartment(id);
        setDepartments(await getDepartments());
      },
    });
  };

  const handleAddDesignation = async (e) => {
    e.preventDefault();
    if (!desigForm.name.trim()) return;
    const result = await addDesignation(desigForm.name.trim());
    if (result.error) return setDesigMsg(result.error);
    setDesigForm({ name: '' });
    setDesigMsg('');
    setDesignations(await getDesignations());
  };

  const handleDeleteDesignation = (id, name) => {
    setConfirmState({
      show: true,
      message: `Delete "${name}"? Employees with this designation will be unlinked.`,
      onConfirm: async () => {
        await deleteDesignation(id);
        setDesignations(await getDesignations());
      },
    });
  };

  const formatMonth = (m) => {
    const [mo, yr] = m.split('_');
    return new Date(yr, parseInt(mo) - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  if (authLoading || !isAuthenticated || !isAdmin) return null;

  const tblHead = {
    background: 'var(--surface2)', padding: '10px 14px', textAlign: 'left',
    fontWeight: 600, fontSize: '11px', textTransform: 'uppercase',
    letterSpacing: '0.04em', color: 'var(--text2)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
  };
  const tblCell = { padding: '11px 14px', fontSize: '13px', borderBottom: '1px solid var(--border)' };

  return (
    <div className="page-wrapper animate-fade-in">
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.04em' }}>Employees</h1>
        <p style={{ color: 'var(--text2)', fontSize: '14px', marginTop: '4px' }}>Manage employee profiles, departments, and designations.</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', background: 'var(--surface3)', borderRadius: '10px', padding: '3px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {[
          { key: 'employees', label: 'Employees' },
          { key: 'departments', label: 'Departments' },
          { key: 'designations', label: 'Designations' },
          { key: 'tools', label: 'Month Tools' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '6px 16px', borderRadius: '7px', fontSize: '13px', fontWeight: 500,
            border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            background: tab === t.key ? 'var(--surface)' : 'transparent',
            color: tab === t.key ? 'var(--text)' : 'var(--text2)',
            boxShadow: tab === t.key ? 'var(--shadow-sm)' : 'none', transition: 'all 0.15s'
          }}>{t.label}</button>
        ))}
      </div>

      {loading && <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text2)', fontSize: '14px' }}>Loading…</div>}

      {/* ── EMPLOYEES TAB ── */}
      {!loading && tab === 'employees' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card" style={{ padding: '22px 24px' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px' }}>Add Employee</div>
            <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '14px' }}>
              Employees are also auto-created when you upload attendance via Dashboard. Edit their details here after creation.
            </div>
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
                  <option value="wfh">WFH</option>
                  <option value="wfm">WFM (Work From Mobile)</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '4px' }}>
                <button type="submit" className="btn btn-primary">Add Employee</button>
                {empMsg && <span style={{ fontSize: '13px', color: empMsg.includes('already') ? 'var(--red)' : 'var(--green)' }}>{empMsg}</span>}
              </div>
            </form>
          </div>

          <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontSize: '14px', fontWeight: 700 }}>
              All Employees ({employees.length})
            </div>
            <div style={{ overflowX: 'auto', maxHeight: '520px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr>
                    {['Code', 'Name', 'Type', 'Department', 'Designation', 'Joined', 'Actions'].map(h => (
                      <th key={h} style={tblHead}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedEmployees.map(emp => (
                    <tr key={emp.code} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ ...tblCell, color: 'var(--text2)', fontSize: '12px', fontFamily: 'monospace' }}>{emp.code}</td>
                      <td style={{ ...tblCell, fontWeight: 500 }}>{emp.name}</td>
                      <td style={tblCell}>
                        <span style={{
                          fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '980px',
                          background: emp.employeeType === 'wfh' ? 'rgba(175,82,222,0.1)' : emp.employeeType === 'wfm' ? 'rgba(52,199,89,0.1)' : 'var(--surface2)',
                          color: emp.employeeType === 'wfh' ? 'var(--purple)' : emp.employeeType === 'wfm' ? 'var(--green)' : 'var(--text2)'
                        }}>{(emp.employeeType || 'regular').toUpperCase()}</span>
                      </td>
                      <td style={{ ...tblCell, color: 'var(--text2)', fontSize: '12px' }}>{emp.department?.name || '—'}</td>
                      <td style={{ ...tblCell, color: 'var(--text2)', fontSize: '12px' }}>{emp.designation?.name || '—'}</td>
                      <td style={{ ...tblCell, color: 'var(--text2)', fontSize: '12px', whiteSpace: 'nowrap' }}>{new Date(emp.createdAt).toLocaleDateString()}</td>
                      <td style={{ ...tblCell, whiteSpace: 'nowrap' }}>
                        <button onClick={() => openEditEmployee(emp)} className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '11px', marginRight: '6px' }}>Edit</button>
                        <button onClick={() => handleDeleteEmployee(emp.code, emp.name)} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '980px', border: '1px solid rgba(255,59,48,0.25)', background: 'rgba(255,59,48,0.06)', color: 'var(--red)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalEmpPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', padding: '12px 18px', borderTop: '1px solid var(--border)' }}>
                <button disabled={empPage <= 1} onClick={() => setEmpPage(p => Math.max(1, p - 1))}
                  style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface2)', color: empPage <= 1 ? 'var(--text3)' : 'var(--text)', cursor: empPage <= 1 ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: '12px' }}>Prev</button>
                {Array.from({ length: Math.min(totalEmpPages, 10) }, (_, i) => {
                  const start = Math.max(1, Math.min(empPage - 5, totalEmpPages - 9));
                  return start + i;
                }).map(p => (
                  <button key={p} onClick={() => setEmpPage(p)}
                    style={{ padding: '4px 10px', borderRadius: '6px', border: p === empPage ? '1px solid var(--blue)' : '1px solid var(--border)', background: p === empPage ? 'rgba(0,113,227,0.1)' : 'transparent', color: p === empPage ? 'var(--blue)' : 'var(--text2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12px', fontWeight: p === empPage ? 600 : 400 }}>{p}</button>
                ))}
                <button disabled={empPage >= totalEmpPages} onClick={() => setEmpPage(p => Math.min(totalEmpPages, p + 1))}
                  style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface2)', color: empPage >= totalEmpPages ? 'var(--text3)' : 'var(--text)', cursor: empPage >= totalEmpPages ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: '12px' }}>Next</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── DEPARTMENTS TAB ── */}
      {!loading && tab === 'departments' && (
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
                      </div>
                      <button onClick={() => handleDeleteDepartment(d.id, d.name)} style={{
                        padding: '5px 10px', borderRadius: '8px', border: '1px solid rgba(255,59,48,0.2)',
                        background: 'rgba(255,59,48,0.06)', color: 'var(--red)', cursor: 'pointer',
                        fontFamily: 'inherit', fontSize: '12px', fontWeight: 500,
                      }}><FiTrash2 size={12} /></button>
                    </div>
                  ))}
                </div>
            }
          </div>
        </div>
      )}

      {/* ── DESIGNATIONS TAB ── */}
      {!loading && tab === 'designations' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>
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
                      <button onClick={() => handleDeleteDesignation(d.id, d.name)} style={{
                        padding: '5px 10px', borderRadius: '8px', border: '1px solid rgba(255,59,48,0.2)',
                        background: 'rgba(255,59,48,0.06)', color: 'var(--red)', cursor: 'pointer',
                        fontFamily: 'inherit', fontSize: '12px', fontWeight: 500,
                      }}><FiTrash2 size={12} /></button>
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

          <div className="card" style={{ padding: '22px 24px' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>Edit Month Record</div>
            <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '16px' }}>Manually correct attendance counts for a specific employee and month.</div>
            <form onSubmit={handleEditRecord} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="input-label">Employee</label>
                  <select className="input-field" value={editRecord.empCode} onChange={e => setEditRecord(r => ({ ...r, empCode: e.target.value }))}>
                    <option value="">— Select —</option>
                    {employees.map(e => <option key={e.code} value={e.code}>{e.name} ({e.code})</option>)}
                  </select>
                </div>
                <div>
                  <label className="input-label">Month</label>
                  <select className="input-field" value={editRecord.monthYear} onChange={e => setEditRecord(r => ({ ...r, monthYear: e.target.value }))}>
                    <option value="">— Select —</option>
                    {months.map(m => <option key={m} value={m}>{formatMonth(m)}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                {[
                  { key: 'present', label: 'Present' }, { key: 'absent', label: 'Absent' },
                  { key: 'late', label: 'Late' }, { key: 'lateHD', label: 'HD(Late)' },
                  { key: 'shortShift', label: 'Short Shift' }, { key: 'ssHD', label: 'HD(SS)' },
                  { key: 'rl', label: 'RL' }, { key: 'holi', label: 'Holiday' },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="input-label">{label}</label>
                    <input type="number" min={0} className="input-field" style={{ padding: '7px 10px' }}
                      placeholder="—" value={editRecord[key]}
                      onChange={e => setEditRecord(r => ({ ...r, [key]: e.target.value }))} />
                  </div>
                ))}
              </div>
              {editRecordMsg && <div style={{ fontSize: '13px', color: editRecordMsg.includes('success') ? 'var(--green)' : 'var(--red)' }}>{editRecordMsg}</div>}
              <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>Save Changes</button>
            </form>
          </div>
        </div>
      )}

      {/* ── EDIT EMPLOYEE MODAL ── */}
      <Modal open={!!editEmp} onClose={() => setEditEmp(null)} title={`Edit — ${editEmp?.name || ''}`} width="520px">
        <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '16px' }}>{editEmp?.name} (#{editEmp?.code})</div>
        <form onSubmit={handleEditEmployee} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="input-label">Full Name</label>
                <input className="input-field" value={editEmpForm.name} onChange={e => setEditEmpForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="input-label">Birthday</label>
                  <input className="input-field" type="date" value={editEmpForm.birthday} onChange={e => setEditEmpForm(f => ({ ...f, birthday: e.target.value }))} />
                </div>
                <div>
                  <label className="input-label">Joining Date</label>
                  <input className="input-field" type="date" value={editEmpForm.joiningDate} onChange={e => setEditEmpForm(f => ({ ...f, joiningDate: e.target.value }))} />
                </div>
                <div>
                  <label className="input-label">Work Anniversary</label>
                  <input className="input-field" type="date" value={editEmpForm.workAnniversary} onChange={e => setEditEmpForm(f => ({ ...f, workAnniversary: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="input-label">Employee Type</label>
                <select className="input-field" value={editEmpForm.employeeType} onChange={e => setEditEmpForm(f => ({ ...f, employeeType: e.target.value }))}>
                  <option value="regular">Regular</option>
                  <option value="wfh">WFH (Work From Home)</option>
                  <option value="wfm">WFM (Work From Mobile)</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="input-label">Department</label>
                  <select className="input-field" value={editEmpForm.departmentId} onChange={e => setEditEmpForm(f => ({ ...f, departmentId: e.target.value, subDepartmentId: '' }))}>
                    <option value="">— None —</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="input-label">Sub-Department</label>
                  <select className="input-field" value={editEmpForm.subDepartmentId} onChange={e => setEditEmpForm(f => ({ ...f, subDepartmentId: e.target.value }))}>
                    <option value="">— None —</option>
                    {departments.find(d => d.id === editEmpForm.departmentId)?.subDepartments?.map(sd => (
                      <option key={sd.id} value={sd.id}>{sd.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="input-label">Designation</label>
                <select className="input-field" value={editEmpForm.designationId} onChange={e => setEditEmpForm(f => ({ ...f, designationId: e.target.value }))}>
                  <option value="">— None —</option>
                  {designations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="input-label">Managers (employee codes, comma-separated)</label>
                <input className="input-field" placeholder="e.g. 1001, 1002" value={editEmpManagers.join(', ')} onChange={e => setEditEmpManagers(e.target.value.split(',').map(s => s.trim()).filter(Boolean))} />
                <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>Enter manager employee codes separated by commas. Leave blank for no manager.</div>
              </div>
              {editEmpMsg && <div style={{ fontSize: '13px', color: editEmpMsg.includes('success') ? 'var(--green)' : 'var(--red)' }}>{editEmpMsg}</div>}
              <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                <button type="submit" className="btn btn-primary">Save Changes</button>
                <button type="button" className="btn btn-secondary" onClick={() => setEditEmp(null)}>Cancel</button>
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
