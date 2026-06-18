"use client";

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '../../../../components/AuthProvider';
import { updateEmployeeDetails, uploadAvatar } from '../../../../actions/employees';
import { useToast } from '../../../../components/Toast';
import { useEmployeeData } from '../context';
import { FiCamera, FiUpload } from 'react-icons/fi';

export default function ProfilePage({ params }) {
  const unwrappedParams = use(params);
  const code = unwrappedParams.code;

  const { role, isAuthenticated, user, loading: authLoading } = useAuth();
  const isAdmin = role === 'admin' || role === 'super_admin';
  const { emp, avatarUrl, triggerRefetch } = useEmployeeData();
  const router = useRouter();
  const toast = useToast();

  const [profileBirthday, setProfileBirthday] = useState(
    emp?.birthday ? new Date(emp.birthday).toISOString().split('T')[0] : ''
  );
  const [savingBirthday, setSavingBirthday] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
    if (!authLoading && isAuthenticated && !isAdmin && user?.code && user.code !== code) {
      router.push(`/employee/${user.code}`);
    }
  }, [isAuthenticated, isAdmin, user, authLoading, router, code]);

  const handleSaveBirthday = async () => {
    setSavingBirthday(true);
    const result = await updateEmployeeDetails(code, { birthday: profileBirthday || null }, user?.username);
    setSavingBirthday(false);
    if (result.error) return toast.error(result.error);
    toast.success('Birthday saved.');
    triggerRefetch();
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

  if (!emp) return null;

  return (
    <div className="card" style={{ padding: '22px 24px', maxWidth: '500px' }}>
      <div style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '16px' }}>My Profile</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px', background: 'var(--surface2)', borderRadius: '10px', padding: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
          <span style={{ color: 'var(--text2)' }}>Name</span>
          <span style={{ fontWeight: 600 }}>{emp.name}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
          <span style={{ color: 'var(--text2)' }}>Code</span>
          <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>#{emp.code}</span>
        </div>
        {emp.department && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
          <span style={{ color: 'var(--text2)' }}>Department</span>
          <span style={{ fontWeight: 600 }}>{emp.department.name}</span>
        </div>}
        {emp.designation && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
          <span style={{ color: 'var(--text2)' }}>Designation</span>
          <span style={{ fontWeight: 600 }}>{emp.designation.name}</span>
        </div>}
      </div>

      <div style={{ marginBottom: '20px' }}>
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
              {avatarPreview && <span style={{ fontSize: '11px', color: 'var(--green)', fontWeight: 500 }}>New photo selected — click Upload</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
