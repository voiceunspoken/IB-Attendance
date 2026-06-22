"use client";

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '../../../../components/AuthProvider';
import { updateEmployeeDetails, uploadAvatar } from '../../../../actions/employees';
import { changePassword, getUsers } from '../../../../actions/auth';
import { getDepartments, getDesignations, setEmployeeManagers, getEmployeeManagers } from '../../../../actions/departments';
import { useToast } from '../../../../components/Toast';
import { useEmployeeData } from '../context';
import { FiCamera, FiUpload, FiLock, FiUser, FiX } from 'react-icons/fi';

const TABS = [
  { key: 'personal', label: 'Personal Info' },
  { key: 'employment', label: 'Employment Details' },
  { key: 'security', label: 'Security' },
];

export default function ProfilePage({ params }) {
  const unwrappedParams = use(params);
  const code = unwrappedParams.code;

  const { role, isAuthenticated, user, loading: authLoading } = useAuth();
  const isAdmin = role === 'admin';
  const isSuperAdmin = role === 'super_admin';
  const { emp, avatarUrl, triggerRefetch } = useEmployeeData();
  const router = useRouter();
  const toast = useToast();

  const [tab, setTab] = useState('personal');

  const [profileBirthday, setProfileBirthday] = useState('');
  const [savingBirthday, setSavingBirthday] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedDesig, setSelectedDesig] = useState('');

  const [employeeType, setEmployeeType] = useState('regular');
  const [managers, setManagers] = useState([]);
  const [mgrEditManagers, setMgrEditManagers] = useState([]);
  const [mgrSearch, setMgrSearch] = useState('');
  const [mgrSearchResults, setMgrSearchResults] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [savingEmployment, setSavingEmployment] = useState(false);

  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [changingPw, setChangingPw] = useState(false);

  const isOwnProfile = user?.code === code;
  const canEditEmployment = (isAdmin || isSuperAdmin) && !isOwnProfile;

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
    if (!authLoading && isAuthenticated && !isAdmin && !isSuperAdmin && user?.code && user.code !== code) {
      router.push(`/employee/${user.code}`);
    }
  }, [isAuthenticated, isAdmin, isSuperAdmin, user, authLoading, router, code]);

  const loadManagers = async () => {
    try {
      const mgrs = await getEmployeeManagers(code);
      setManagers(mgrs);
      setMgrEditManagers(mgrs);
      const users = await getUsers();
      setAllUsers(users.filter(u => u.code));
    } catch { /* */ }
  };

  useEffect(() => {
    if (!emp) return;
    setProfileBirthday(emp.birthday ? new Date(emp.birthday).toISOString().split('T')[0] : '');
    setSelectedDept(emp.department?.id || '');
    setSelectedDesig(emp.designation?.id || '');
    setEmployeeType(emp.employeeType || 'regular');
    loadManagers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emp]);

  useEffect(() => {
    (async () => {
      const [depts, desigs] = await Promise.all([getDepartments(), getDesignations()]);
      setDepartments(depts);
      setDesignations(desigs);
    })();
  }, []);

  useEffect(() => {
    if (!mgrSearch.trim()) {
      setMgrSearchResults([]);
      return;
    }
    const q = mgrSearch.toLowerCase();
    setMgrSearchResults(
      allUsers.filter(u =>
        u.code &&
        !mgrEditManagers.find(m => m.code === u.code) &&
        u.code !== code &&
        (u.name?.toLowerCase().includes(q) || u.code.toLowerCase().includes(q))
      ).slice(0, 10)
    );
  }, [mgrSearch, allUsers, mgrEditManagers, code]);

  const handleSaveBirthday = async () => {
    setSavingBirthday(true);
    const result = await updateEmployeeDetails(code, { birthday: profileBirthday || null }, user?.username);
    setSavingBirthday(false);
    if (result.error) return toast.error(result.error);
    toast.success('Birthday saved.');
    triggerRefetch();
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwError(''); setPwMsg('');
    if (pwForm.newPw !== pwForm.confirm) return setPwError('New passwords do not match.');
    if (pwForm.newPw.length < 6) return setPwError('Password must be at least 6 characters.');
    setChangingPw(true);
    const result = await changePassword(user.id, pwForm.current, pwForm.newPw);
    setChangingPw(false);
    if (result.error) return setPwError(result.error);
    setPwMsg('Password changed successfully.');
    setPwForm({ current: '', newPw: '', confirm: '' });
  };

  const handleUploadAvatar = async () => {
    if (!avatarFile) return;
    setUploadingAvatar(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const result = await uploadAvatar(code, e.target.result);
      setUploadingAvatar(false);
      if (result.error) return toast.error(result.error);
      setAvatarPreview(null);
      setAvatarFile(null);
      toast.success('Profile picture updated.');
      triggerRefetch();
    };
    reader.readAsDataURL(avatarFile);
  };

  const handleChangeDept = async (deptId) => {
    if (!canEditEmployment) return;
    if (!user?.username) return toast.error('Session error: not logged in.');
    setSelectedDept(deptId);
    const result = await updateEmployeeDetails(code, { departmentId: deptId || null }, user.username);
    if (result.error) return toast.error(result.error);
    toast.success('Department updated.');
    triggerRefetch();
  };

  const handleChangeDesig = async (desigId) => {
    if (!canEditEmployment) return;
    if (!user?.username) return toast.error('Session error: not logged in.');
    setSelectedDesig(desigId);
    const result = await updateEmployeeDetails(code, { designationId: desigId || null }, user.username);
    if (result.error) return toast.error(result.error);
    toast.success('Designation updated.');
    triggerRefetch();
  };

  const handleSaveEmployment = async () => {
    if (!user?.username) return toast.error('Session error: not logged in.');
    if (!isAdmin && !isSuperAdmin) return toast.error('Access denied.');
    setSavingEmployment(true);
    const typeResult = await updateEmployeeDetails(code, { employeeType }, user.username);
    if (typeResult.error) {
      setSavingEmployment(false);
      return toast.error(typeResult.error);
    }
    const mgrCodes = mgrEditManagers.map(m => m.code);
    const mgrResult = await setEmployeeManagers(code, mgrCodes, user.username);
    if (mgrResult.error) {
      setSavingEmployment(false);
      return toast.error(mgrResult.error);
    }
    setSavingEmployment(false);
    toast.success('Employment settings saved.');
    setManagers(mgrEditManagers);
    triggerRefetch();
  };

  const handleDiscardEmployment = () => {
    setMgrEditManagers(managers);
    setEmployeeType(emp?.employeeType || 'regular');
    setMgrSearch('');
    setMgrSearchResults([]);
  };

  if (!emp) return null;

  return (
    <div className="page-wrapper animate-fade-in" style={{ maxWidth: '640px', margin: '0 auto' }}>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: 'var(--surface2)', borderRadius: '12px', padding: '4px' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ flex: 1, padding: '10px 16px', borderRadius: '10px', border: 'none', background: tab === t.key ? 'var(--surface)' : 'transparent', color: tab === t.key ? 'var(--text)' : 'var(--text2)', fontWeight: tab === t.key ? 600 : 400, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', boxShadow: tab === t.key ? 'var(--shadow-sm)' : 'none' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Personal Info */}
      {tab === 'personal' && (
        <div className="card" style={{ padding: '22px 24px' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '20px' }}>Personal Information</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px', background: 'var(--surface2)', borderRadius: '10px', padding: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: 'var(--text2)' }}>Name</span>
              <span style={{ fontWeight: 600 }}>{emp.name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: 'var(--text2)' }}>Code</span>
              <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>#{emp.code}</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label className="input-label">Department</label>
              {canEditEmployment ? (
                <select className="input-field" value={selectedDept}
                  onChange={e => handleChangeDept(e.target.value)}>
                  <option value="">— None —</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              ) : (
                <div style={{ fontSize: '13px', fontWeight: 500, marginTop: '4px' }}>{emp.department?.name || '—'}</div>
              )}
            </div>
            <div>
              <label className="input-label">Designation</label>
              {canEditEmployment ? (
                <select className="input-field" value={selectedDesig}
                  onChange={e => handleChangeDesig(e.target.value)}>
                  <option value="">— None —</option>
                  {designations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              ) : (
                <div style={{ fontSize: '13px', fontWeight: 500, marginTop: '4px' }}>{emp.designation?.name || '—'}</div>
              )}
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label className="input-label">Birthday</label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '6px' }}>
              <input className="input-field" type="date" style={{ flex: 1, padding: '8px 12px' }}
                value={profileBirthday}
                onChange={e => setProfileBirthday(e.target.value)} />
              <button className="btn btn-primary" style={{ padding: '8px 18px', fontSize: '13px', opacity: savingBirthday ? 0.7 : 1 }}
                disabled={savingBirthday}
                onClick={handleSaveBirthday}>{savingBirthday ? 'Saving…' : 'Save'}</button>
            </div>
          </div>

          <div>
            <label className="input-label">Profile Picture</label>
            <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginTop: '8px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--surface3)', display: 'grid', placeItems: 'center', fontSize: '20px', fontWeight: 700, color: 'var(--text2)', overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
                {avatarPreview ? (
                  <Image src={avatarPreview} alt="" fill style={{ objectFit: 'cover' }} sizes="56px" />
                ) : avatarUrl ? (
                  <Image src={avatarUrl} alt="" fill style={{ objectFit: 'cover' }} sizes="56px" />
                ) : (
                  <FiCamera size={20} />
                )}
              </div>
              <div style={{ flex: 1 }}>
                <input type="file" accept="image/png,image/jpeg,image/webp" style={{ fontSize: '12px', marginBottom: '8px', display: 'block' }}
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setAvatarFile(f);
                      const reader = new FileReader();
                      reader.onload = () => setAvatarPreview(reader.result);
                      reader.readAsDataURL(f);
                    }
                  }} />
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button className="btn btn-outline" style={{ padding: '6px 14px', fontSize: '12px', opacity: uploadingAvatar ? 0.7 : 1 }}
                    disabled={!avatarFile || uploadingAvatar}
                    onClick={handleUploadAvatar}>{uploadingAvatar ? 'Uploading…' : <><FiUpload size={12} style={{ marginRight: '4px' }} /> Upload</>}</button>
                  {avatarPreview && <span style={{ fontSize: '11px', color: 'var(--green)', fontWeight: 500 }}>New photo selected</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Employment Details */}
      {tab === 'employment' && (
        <div className="card" style={{ padding: '22px 24px' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '20px' }}>Employment Details</div>

          <div style={{ marginBottom: '20px' }}>
            <label className="input-label">Employee Type</label>
            <div style={{ marginTop: '6px' }}>
              {canEditEmployment ? (
                <select className="input-field" value={employeeType}
                  onChange={e => setEmployeeType(e.target.value)}>
                  <option value="regular">Regular</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              ) : (
                <span style={{ fontSize: '13px', fontWeight: 600, padding: '4px 12px', borderRadius: '980px', background: employeeType === 'hybrid' ? 'rgba(175,82,222,0.1)' : 'var(--surface2)', color: employeeType === 'hybrid' ? 'var(--purple)' : 'var(--text2)' }}>
                  {(employeeType || 'regular').toUpperCase()}
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="input-label">Managers</label>
            <div style={{ marginTop: '6px' }}>
              {managers.length === 0 ? (
                <div style={{ fontSize: '13px', color: 'var(--text3)' }}>No managers assigned.</div>
              ) : canEditEmployment ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {mgrEditManagers.map(m => (
                    <div key={m.code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--surface2)', borderRadius: '8px' }}>
                      <div>
                        <span style={{ fontSize: '13px', fontWeight: 500 }}>{m.name}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text3)', fontFamily: 'monospace', marginLeft: '6px' }}>#{m.code}</span>
                      </div>
                      <button type="button" onClick={() => setMgrEditManagers(prev => prev.filter(x => x.code !== m.code))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', padding: '2px' }}>
                        <FiX size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {managers.map(m => (
                    <div key={m.code} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'var(--surface2)', borderRadius: '8px' }}>
                      <FiUser size={14} style={{ color: 'var(--text3)' }} />
                      <span style={{ fontSize: '13px', fontWeight: 500 }}>{m.name}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text3)', fontFamily: 'monospace' }}>#{m.code}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {canEditEmployment && (
            <>
              <div style={{ marginTop: '16px' }}>
                <label className="input-label">Add Manager</label>
                <input className="input-field" placeholder="Type name or code…"
                  value={mgrSearch} onChange={e => setMgrSearch(e.target.value)} />
                {mgrSearchResults.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '6px', maxHeight: '160px', overflowY: 'auto' }}>
                    {mgrSearchResults.map(u => (
                      <button key={u.code} type="button" onClick={() => {
                        setMgrEditManagers(prev => [...prev, { code: u.code, name: u.name, priority: prev.length + 1 }]);
                        setMgrSearch('');
                        setMgrSearchResults([]);
                      }}
                        style={{ textAlign: 'left', padding: '8px 12px', borderRadius: '8px', border: 'none', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{u.name}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text3)', fontFamily: 'monospace' }}>#{u.code}</span>
                      </button>
                    ))}
                  </div>
                )}
                {mgrSearch.trim() && mgrSearchResults.length === 0 && (
                  <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '6px' }}>No employees found.</div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={handleDiscardEmployment}>Discard</button>
                <button type="button" className="btn btn-primary" disabled={savingEmployment} onClick={handleSaveEmployment}>
                  {savingEmployment ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Tab 3: Security */}
      {tab === 'security' && (
        <div className="card" style={{ padding: '22px 24px' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '20px' }}>
            <FiLock size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Security
          </div>
          <form onSubmit={handleChangePassword}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label className="input-label">Current Password</label>
                <input className="input-field" type="password" value={pwForm.current}
                  onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="input-label">New Password</label>
                  <input className="input-field" type="password" value={pwForm.newPw}
                    onChange={e => setPwForm(f => ({ ...f, newPw: e.target.value }))} />
                </div>
                <div>
                  <label className="input-label">Confirm New Password</label>
                  <input className="input-field" type="password" value={pwForm.confirm}
                    onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} />
                </div>
              </div>
              {pwError && <div style={{ fontSize: '12px', color: 'var(--red)' }}>{pwError}</div>}
              {pwMsg && <div style={{ fontSize: '12px', color: 'var(--green)' }}>{pwMsg}</div>}
              <div>
                <button type="submit" className="btn btn-primary" style={{ opacity: changingPw ? 0.7 : 1 }} disabled={changingPw}>
                  {changingPw ? 'Changing…' : 'Change Password'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
