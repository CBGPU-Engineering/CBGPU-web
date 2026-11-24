'use client';
import {createAccountReadFence} from '@/lib/accountReadFence';
import {changeProfilePassword} from '@/lib/profilePasswordChange';
import {confirmedAccountSession} from '@/lib/confirmedAccountSession';
import { userFacingError } from '@/lib/userFacingError';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { signOutEverywhere } from '@/lib/signOutEverywhere';
import { useAuth } from '@/lib/useAuth';
import Link from 'next/link';
import { ArrowUpRight, BellRing, Camera, KeyRound, LogOut, School, UserCircle2 } from 'lucide-react';
import { useSchoolScope } from '@/components/schools/SchoolScope';
import { OptionPicker } from '../../components/OptionPicker';
import SchoolOpsAccount from '../../components/SchoolOpsAccount';
import SchoolOpsConfirm from '../../components/SchoolOpsConfirm';
import { Notice } from '../../components/DirectoryFeedback';
import styles from '../../components/SchoolOps.module.css';
import { isValidStudentId, STUDENT_ID_HINT } from '@/lib/studentId';
import {multiSchoolEnabled} from '@/lib/schoolsClient';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

/** Save a display-sized JPEG before uploading the avatar. */
async function resizeImageToJpeg(file: File, maxSize = 256, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('사진을 읽지 못했어요. 다른 사진을 선택해 주세요.');
  ctx.drawImage(bitmap, 0, 0, w, h);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('사진을 변환하지 못했어요. 다른 사진을 선택해 주세요.'))), 'image/jpeg', quality);
  });
}

const NOTIF_PREFS = [
  { key: 'notify_job_new', label: '새 제작 신청', hint: '3D프린팅/레이저 담당자에게: 신청이 들어오면', role: 'manager' as const },
  { key: 'notify_job_done', label: '제작 완료', hint: '내가 신청한 3D프린팅/레이저 커팅이 완료되면', role: 'anyone' as const },
  { key: 'notify_admin_signup', label: '새 회원가입', hint: '관리자에게: 새 계정이 가입하면', role: 'admin' as const },
  { key: 'notify_admin_gpu_request', label: 'GPU 예약 신청', hint: '관리자에게: GPU 예약 신청이 들어오면', role: 'admin' as const },
] as const;
type NotifPrefKey = typeof NOTIF_PREFS[number]['key'];
type Setting = 'photo' | 'identity' | 'password' | 'ssh' | 'notifications' | 'account';

export default function Workspace() {
  return <SchoolOpsAccount path="/profile"><ProfileSession /></SchoolOpsAccount>;
}
function ProfileSession() {
  const scopedIdentity=multiSchoolEnabled||['1','true'].includes(process.env.NEXT_PUBLIC_CBGPU_ACCOUNT_V2||'');
  const { user, profile, refreshProfile, isLoading: authLoading, isAdmin, is3DPrintManager, isLaserCutManager } = useAuth();
  const [feedback, setFeedback] = useState<{ setting: Setting; error: boolean; text: string }>();
  const result = (setting: Setting, text: string, error = false) => setFeedback({ setting, error, text });
  const showError = (setting: Setting, text: string) => result(setting, text, true);
  const status = (setting: Setting) => feedback?.setting === setting && (
    <p className={styles.feedback} role={feedback.error ? 'alert' : 'status'}>{feedback.text}</p>
  );
  const scope = useSchoolScope();
  const [selectedSchool, setSelectedSchool] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [fullName, setFullName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [notifPrefs, setNotifPrefs] = useState<Record<NotifPrefKey, boolean>>({
    notify_job_new: true,
    notify_job_done: true,
    notify_admin_signup: true,
    notify_admin_gpu_request: true,
  });
  const [savingNotifKey, setSavingNotifKey] = useState<NotifPrefKey | null>(null);
  const [sshPublicKey, setSshPublicKey] = useState('');
  const [savedSshKey, setSavedSshKey] = useState('');
  const [savingSshKey, setSavingSshKey] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const operations=useRef(createAccountReadFence()),deleting=useRef(false),changingPassword=useRef(false);
  useEffect(()=>{
    const fence=operations.current;fence.setOwner(user?.id||null);
    return()=>fence.invalidate();
  },[user?.id]);

  useEffect(() => {
    if (profile) {
      setStudentId(profile.student_id || '');
      setFullName(profile.full_name || '');
      // Older accounts may not have preferences; keep the database defaults.
      setNotifPrefs((prev) => {
        const next = { ...prev };
        for (const { key } of NOTIF_PREFS) {
          if (profile[key] !== undefined) next[key] = profile[key] !== false;
        }
        return next;
      });
    }
  }, [profile]);

  useEffect(() => {
    const owner=user?.id;if(!owner)return;
    const current=operations.current.lease(owner),controller=new AbortController();
    void supabase.from('gpu_ssh_keys').select('public_key').eq('user_id', owner).abortSignal(controller.signal).maybeSingle()
      .then(({ data }) => {
        if(!current()||controller.signal.aborted)return;
        setSshPublicKey(data?.public_key ?? '');
        setSavedSshKey(data?.public_key ?? '');
      });
    return()=>controller.abort();
  }, [user?.id]);

  useEffect(() => {
    if (authLoading || !user || window.location.hash !== '#gpu-ssh-key') return;
    const frame = requestAnimationFrame(() => {
      document.getElementById('gpu-ssh-key')?.scrollIntoView({ block: 'start' });
    });
    return () => cancelAnimationFrame(frame);
  }, [authLoading, user]);

  async function saveSshKey() {
    if (!user) return;
    const key = sshPublicKey.trim();
    if (key && !/^ssh-ed25519 [A-Za-z0-9+/]+={0,2}( [^\r\n]*)?$/.test(key)) {
      showError('ssh', 'ssh-ed25519 형식의 공개키를 입력해 주세요.');
      return;
    }
    const owner=user.id,current=operations.current.lease(owner);
    setSavingSshKey(true);
    try {
      await confirmedAccountSession(owner,current,()=>supabase.auth.getSession());
      const { error } = key
        ? await supabase.from('gpu_ssh_keys').upsert({ user_id: user.id, public_key: key })
        : await supabase.from('gpu_ssh_keys').delete().eq('user_id', user.id);
      if(!current())return;
      if (error) throw error;
      setSavedSshKey(key);
      result('ssh', key ? 'SSH 공개키를 저장했어요.' : 'SSH 공개키를 삭제했어요.');
    } catch (error: any) {
      if(!current())return;
      showError('ssh', userFacingError(error.message, 'SSH 공개키를 저장하지 못했어요. 다시 시도해 주세요.'));
    } finally {
      if(current())setSavingSshKey(false);
    }
  }

  async function toggleNotifPref(key: NotifPrefKey) {
    if (!user) return;
    const owner=user.id,current=operations.current.lease(owner);
    const next = !notifPrefs[key];
    setNotifPrefs((prev) => ({ ...prev, [key]: next }));
    setSavingNotifKey(key);
    try {
      await confirmedAccountSession(owner,current,()=>supabase.auth.getSession());
      const { error } = await supabase.from('profiles').update({ [key]: next }).eq('id', user.id);
      if(!current())return;
      if (error) throw error;
    } catch (error: any) {
      if(!current())return;
      setNotifPrefs((prev) => ({ ...prev, [key]: !next })); // revert on failure
      showError('notifications', userFacingError(error.message, '알림 설정을 저장하지 못했어요. 다시 시도해 주세요.'));
    } finally {
      if(current())setSavingNotifKey(null);
    }
  }

  async function handleSignOut() {
    try {
      const { error } = await signOutEverywhere();
      if (error) throw error;
      result('account', '로그아웃했어요.');
      window.location.assign('/new/auth/login');
    } catch {
      showError('account', '로그아웃하지 못했어요. 다시 시도해 주세요.');
    }
  }

  async function updateProfile() {
    if (!user) return;
    if (!scopedIdentity && !isValidStudentId(studentId)) {
      showError('identity', `학번을 다시 확인해 주세요. ${STUDENT_ID_HINT}`);
      return;
    }
    const owner=user.id,current=operations.current.lease(owner);
    setIsUpdating(true);
    try {
      await confirmedAccountSession(owner,current,()=>supabase.auth.getSession());
      const { error } = await supabase.from('profiles').update(scopedIdentity?{full_name:fullName}:{student_id:studentId,full_name:fullName}).eq('id', user.id);

      if(!current())return;
      if (error) throw error;
      if(!current())return;
      await refreshProfile();
      if(!current())return;
      result('identity', '프로필을 저장했어요.');
    } catch (error: any) {
      if(!current())return;
      showError('identity', error.code === '23505' || error.message?.includes('STUDENT_ID_ALREADY_REGISTERED')
        ? '이 학번은 이번 학년도에 이미 등록돼 있어요. 기존 계정을 확인해 주세요.'
        : userFacingError(error.message, '프로필을 저장하지 못했어요. 다시 시도해 주세요.'));
    } finally {
      if(current())setIsUpdating(false);
    }
  }

  async function changePassword() {
    if (!user?.email||changingPassword.current) return;

    if (newPassword.length < 6) {
      showError('password', '새 비밀번호를 6자 이상 입력해 주세요.'); return;
    }
    if (newPassword !== confirmPassword) {
      showError('password', '새 비밀번호가 서로 달라요. 다시 확인해 주세요.'); return;
    }

    const owner=user.id,current=operations.current.lease(owner);
    changingPassword.current=true;setIsChangingPassword(true);
    try {
      await changeProfilePassword({owner,email:user.email,currentPassword,newPassword},current);
      if(!current())return;
      result('password', '비밀번호를 바꿨어요.');
      setCurrentPassword('');setNewPassword('');setConfirmPassword('');
    } catch (error: any) {
      if(current())showError('password', userFacingError(error.message, '비밀번호를 바꾸지 못했어요. 다시 시도해 주세요.'));
    } finally {
      changingPassword.current=false;if(current())setIsChangingPassword(false);
    }
  }

  async function handleDeleteAccount() {
    if (!user||deleting.current) return;
    deleting.current=true;
    const owner=user.id,current=operations.current.lease(owner);
    setIsDeletingAccount(true);
    try {
      const session=await confirmedAccountSession(owner,current,()=>supabase.auth.getSession());
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type':'application/json' },
        body:JSON.stringify({expected_user_id:owner}),
      });
      if(!current())return;
      const body = await res.json().catch(() => ({}));
      if(!current())return;
      if (!res.ok) { showError('account', body?.message || '계정을 삭제하지 못했어요. 다시 시도해 주세요.'); return; }

      await confirmedAccountSession(owner,current,()=>supabase.auth.getSession());
      await signOutEverywhere();
      if(!current())return;
      result('account', '계정을 삭제했어요.');
      window.location.assign('/new/');
    } catch (error: any) {
      if(current())showError('account', userFacingError(error.message, '계정을 삭제하지 못했어요. 다시 시도해 주세요.'));
    } finally {
      deleting.current=false;
      if(current()){setIsDeletingAccount(false);setDeleteOpen(false);}
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!user || !file) return;

    if (!file.type.startsWith('image/')) {
      showError('photo', '이미지 파일을 선택해 주세요.'); return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      showError('photo', '5MB 이하인 이미지를 선택해 주세요.'); return;
    }

    const owner=user.id,current=operations.current.lease(owner);
    setIsUploadingAvatar(true);
    try {
      await confirmedAccountSession(owner,current,()=>supabase.auth.getSession());
      const resized = await resizeImageToJpeg(file);
      await confirmedAccountSession(owner,current,()=>supabase.auth.getSession());
      const path = `${owner}/avatar.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, resized, { upsert: true, cacheControl: '3600', contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;

      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      const avatarUrl = `${pub.publicUrl}?v=${Date.now()}`;

      await confirmedAccountSession(owner,current,()=>supabase.auth.getSession());
      const { error: dbError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', user.id);
      if (dbError) throw dbError;

      if(!current())return;
      await refreshProfile();
      if(!current())return;
      result('photo', '프로필 사진을 바꿨어요.');
    } catch (error: any) {
      if(!current())return;
      showError('photo', userFacingError(error.message, '사진을 올리지 못했어요. 다시 시도해 주세요.'));
    } finally {
      if(current())setIsUploadingAvatar(false);
    }
  }

  if (!user) return null;
  const membership = scope.memberships.find(member => member.school_id === (selectedSchool || scope.school?.id)) || scope.memberships[0];
  const schoolName = membership?.school.display_name || membership?.school.official_name;
  const membershipPath = membership && (membership.status === 'REVERIFICATION_REQUIRED' && membership.school_id === 'cbsh'
    ? '/schools/cbsh/verification'
    : '/schools/' + encodeURIComponent(membership.school_id) + '/affiliation' + (membership.membership_type === 'TEACHER' ? '' : '?type=STUDENT'));
  const rolePreferences = NOTIF_PREFS.filter(({ role }) => role === 'anyone' ||
    (role === 'manager' && (is3DPrintManager || isLaserCutManager)) || (role === 'admin' && isAdmin));

  return <div className={styles.stack}>
    <section className={styles.panel}>
      <div className={styles.inline}>
        <span className={styles.portrait} aria-hidden>
          {profile?.avatar_url
            ? <img src={profile.avatar_url} alt="" width={72} height={72} referrerPolicy="no-referrer" />
            : <UserCircle2 size={38} />}
        </span>
        <div className={styles.fileHeading}><h2>{profile?.full_name || '내 프로필'}</h2><p>{user.email}</p></div>
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleAvatarChange} />
      <div><button type="button" className={styles.secondary} onClick={() => fileInputRef.current?.click()} disabled={isUploadingAvatar}>
        <Camera size={16} aria-hidden />{isUploadingAvatar ? '사진 올리는 중…' : '사진 바꾸기'}
      </button></div>
      {status('photo')}
    </section>

    <div className={styles.split}>
      <div className={styles.stack}>
        <section className={styles.panel}>
          <h2>프로필 정보</h2>
          <form className={styles.form} onSubmit={event => { event.preventDefault(); void updateProfile(); }}>
            <label className={styles.field}>이름
              <input name="name" autoComplete="name" value={fullName} onChange={event => setFullName(event.target.value)} required />
            </label>
            {!multiSchoolEnabled && <label className={styles.field}>학번
              <input name="student-id" autoComplete="off" inputMode="numeric" maxLength={4} disabled={scopedIdentity}
                value={studentId} onChange={event => setStudentId(event.target.value.replace(/\D/g, '').slice(0, 4))} />
              <small className={styles.muted}>{scopedIdentity ? '학교별 소속 정보에서 학번을 확인할 수 있어요.' : STUDENT_ID_HINT}</small>
            </label>}
            <div><button type="submit" className="pv-primary" disabled={isUpdating}>{isUpdating ? '저장 중…' : '프로필 저장'}</button></div>
            {status('identity')}
          </form>
        </section>
        <section className={styles.panel}>
          <h2 className={styles.inline}><KeyRound size={19} aria-hidden />비밀번호 변경</h2>
          <form className={styles.form} onSubmit={event => { event.preventDefault(); void changePassword(); }}>
            <label className={styles.field}>현재 비밀번호
              <input type="password" name="current-password" autoComplete="current-password"
                value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} />
            </label>
            <label className={styles.field}>새 비밀번호
              <input type="password" name="new-password" autoComplete="new-password"
                value={newPassword} onChange={event => setNewPassword(event.target.value)} />
            </label>
            <label className={styles.field}>새 비밀번호 확인
              <input type="password" name="new-password-confirm" autoComplete="new-password"
                value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} />
            </label>
            <div><button type="submit" className="pv-primary" disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}>
              {isChangingPassword ? '변경 중…' : '비밀번호 변경'}
            </button></div>
            {status('password')}
          </form>
        </section>
      </div>

      <div className={styles.stack}>
        {multiSchoolEnabled && <section className={styles.panel}>
          <h2 className={styles.inline}><School size={19} aria-hidden />학교·학번</h2>
          {scope.status === 'loading' ? <p role="status">학교와 학번을 확인하고 있어요.</p> :
            scope.status === 'unavailable' ? <Notice title="학교 소속을 확인하지 못했어요">
              <button type="button" className={styles.secondary} onClick={() => void scope.refresh()}>다시 불러오기</button>
            </Notice> : <>
              {scope.memberships.length > 1 && <OptionPicker label="학교" value={membership?.school_id || ''}
                options={scope.memberships.map(item => ({ value: item.school_id, label: item.school.display_name || item.school.official_name }))}
                onChange={setSelectedSchool} />}
              {membership && <div><p><strong>{schoolName}</strong></p>
                <p className={styles.muted}>{membership.student_number
                  ? '학번 ' + membership.student_number
                  : membership.membership_type === 'TEACHER' ? '교사 소속' : '등록된 학번이 없어요.'}</p>
              </div>}
              {membership?.status === 'SUSPENDED' ? <p className={styles.muted}>이용이 제한됐어요. 학교 관리자에게 문의해 주세요.</p>
                : membership?.school.status !== 'APPROVED' && membership ? <p className={styles.muted}>학교 도입 승인이 끝나면 학번을 등록할 수 있어요.</p>
                : membershipPath ? <Link href={membershipPath} className={styles.link}>
                  {membership?.status === 'REVERIFICATION_REQUIRED' ? '새 학번으로 인증' :
                    membership?.membership_type === 'TEACHER' ? '교사 소속 확인' : '학번 등록·변경'}<ArrowUpRight size={15} aria-hidden />
                </Link> : <Link href="/schools" className={styles.link}>내 학교 찾기<ArrowUpRight size={15} aria-hidden /></Link>}
            </>}
        </section>}

        <section className={styles.panel}>
          <h2 className={styles.inline}><BellRing size={19} aria-hidden />알림 설정</h2>
          {rolePreferences.map(({ key, label, hint }) => <div key={key} className={styles.line}>
            <div><strong>{label}</strong><p className={styles.muted}>{hint}</p></div>
            <button type="button" role="switch" aria-checked={notifPrefs[key]} aria-label={label}
              className={styles.secondary} disabled={Boolean(savingNotifKey)} onClick={() => void toggleNotifPref(key)}>
              {savingNotifKey === key ? '저장 중' : notifPrefs[key] ? '켜짐' : '꺼짐'}
            </button>
          </div>)}
          {status('notifications')}
          <Link href="/study" className={styles.link}>자습 신청 알림 설정</Link>
        </section>

        <section className={styles.panel}>
          <h2>내 제작 신청</h2>
          <div className={styles.inline}>
            <Link className={styles.link} href="/manufacturing/print">3D 프린팅<ArrowUpRight size={15} aria-hidden /></Link>
            <Link className={styles.link} href="/manufacturing/laser">레이저 커팅<ArrowUpRight size={15} aria-hidden /></Link>
          </div>
        </section>
      </div>
    </div>

    <section id="gpu-ssh-key" className={styles.panel}>
      <h2 className={styles.inline}><KeyRound size={19} aria-hidden />GPU SSH 공개키</h2>
      <p className={styles.muted}>예약한 GPU에 SSH로 접속할 때 쓸 공개키예요. <code>~/.ssh/id_ed25519.pub</code> 파일 내용을 붙여 넣어 주세요.</p>
      <label className={styles.field}>SSH 공개키
        <textarea value={sshPublicKey} onChange={event => setSshPublicKey(event.target.value)} rows={3} placeholder="ssh-ed25519 AAAA…" />
      </label>
      <div className={styles.inline}>
        <button type="button" className={styles.secondary} onClick={() => void saveSshKey()} disabled={savingSshKey || sshPublicKey.trim() === savedSshKey}>
          {savingSshKey ? '저장 중…' : sshPublicKey.trim() ? '공개키 저장' : '등록된 키 삭제'}
        </button>
        <Link className={styles.link} href="/dashboard/ssh-guide">SSH 사용법<ArrowUpRight size={15} aria-hidden /></Link>
      </div>
      {status('ssh')}
    </section>
    <section className={styles.panel}>
      <h2>계정 관리</h2>
      <p className={styles.muted}>계정을 삭제하면 다시 로그인할 수 없고 이름, 학번, 프로필 사진이 삭제돼요.</p>
      <div className={styles.inline}>
        <button type="button" className={styles.secondary} onClick={() => void handleSignOut()}><LogOut size={17} aria-hidden />로그아웃</button>
        <button type="button" className={styles.secondary + ' ' + styles.danger} onClick={() => setDeleteOpen(true)}>계정 삭제</button>
      </div>
      {status('account')}
    </section>
    <SchoolOpsConfirm open={deleteOpen} title="계정을 삭제할까요?" label={isDeletingAccount ? '삭제 중…' : '계정 삭제'} busy={isDeletingAccount}
      onCancel={() => setDeleteOpen(false)} onConfirm={() => void handleDeleteAccount()}>
      삭제한 계정은 되돌릴 수 없어요. 이름, 학번, 프로필 사진이 삭제돼요.
    </SchoolOpsConfirm>
  </div>;
}
