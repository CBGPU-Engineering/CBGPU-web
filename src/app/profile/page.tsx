'use client';
import {createAccountReadFence} from '@/lib/accountReadFence';
import {changeProfilePassword} from '@/lib/profilePasswordChange';
import {confirmedAccountSession} from '@/lib/confirmedAccountSession';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { signOutEverywhere } from '@/lib/signOutEverywhere';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useAlert } from '@/lib/alert';
import { useAuth } from '@/lib/useAuth';
import { avatarSrc, uploadedPhoto } from '@/lib/avatar';
import Image from 'next/image';
import { UserCircle2, Mail, Hash, Save, Loader2, Camera, KeyRound, Lock, ShieldAlert, Trash2, BellRing, LogOut } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/spinner';
import ConfirmDialog from '@/components/ConfirmDialog';
import { isValidStudentId, STUDENT_ID_HINT } from '@/lib/studentId';
import {multiSchoolEnabled} from '@/lib/schoolsClient';
import ProfileSchoolIdentity from '@/components/schools/ProfileSchoolIdentity';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

/** 아바타는 항상 112px 이하로 렌더링되니, 업로드 전에 리사이즈/압축해서 저장 용량과
 * 매 페이지 로드 시 다운로드량을 줄인다. */
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

export default function Profile() {
  const {user}=useAuth();
  return <ProfileSession key={user?.id||'anonymous'} />;
}
function ProfileSession() {
  const scopedIdentity=multiSchoolEnabled||['1','true'].includes(process.env.NEXT_PUBLIC_CBGPU_ACCOUNT_V2||'');
  const { user, profile, refreshProfile, isLoading: authLoading, isAdmin, is3DPrintManager, isLaserCutManager } = useAuth();
  const { showError, showSuccess } = useAlert();
  const router = useRouter();
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
      // 컬럼이 없던 시절 가입한 계정도 DB default(true)를 따르므로, 값이 아예
      // 안 왔을 때만(undefined) 기본 true를 유지하고 그 외엔 저장된 값을 따른다.
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
      showError('ssh-ed25519 형식의 공개키를 입력해 주세요.');
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
      showSuccess(key ? 'SSH 공개키를 저장했어요.' : 'SSH 공개키를 삭제했어요.');
    } catch (error: any) {
      if(!current())return;
      showError(error.message || 'SSH 공개키를 저장하지 못했어요. 다시 시도해 주세요.');
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
      showError(error.message || '알림 설정을 저장하지 못했어요. 다시 시도해 주세요.');
    } finally {
      if(current())setSavingNotifKey(null);
    }
  }

  async function handleSignOut() {
    try {
      const { error } = await signOutEverywhere();
      if (error) throw error;
      showSuccess('로그아웃했어요.');
      router.push('/auth/login');
    } catch {
      showError('로그아웃하지 못했어요. 다시 시도해 주세요.');
    }
  }

  async function updateProfile() {
    if (!user) return;
    if (!scopedIdentity && !isValidStudentId(studentId)) {
      showError(`학번을 다시 확인해 주세요. ${STUDENT_ID_HINT}`);
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
      showSuccess('프로필을 저장했어요.');
    } catch (error: any) {
      if(!current())return;
      showError(error.code === '23505' || error.message?.includes('STUDENT_ID_ALREADY_REGISTERED')
        ? '이 학번은 이번 학년도에 이미 등록돼 있어요. 기존 계정을 확인해 주세요.'
        : error.message || '프로필을 저장하지 못했어요. 다시 시도해 주세요.');
    } finally {
      if(current())setIsUpdating(false);
    }
  }

  async function changePassword() {
    if (!user?.email||changingPassword.current) return;

    if (newPassword.length < 6) {
      showError('새 비밀번호를 6자 이상 입력해 주세요.'); return;
    }
    if (newPassword !== confirmPassword) {
      showError('새 비밀번호가 서로 달라요. 다시 확인해 주세요.'); return;
    }

    const owner=user.id,current=operations.current.lease(owner);
    changingPassword.current=true;setIsChangingPassword(true);
    try {
      await changeProfilePassword({owner,email:user.email,currentPassword,newPassword},current);
      if(!current())return;
      showSuccess('비밀번호를 바꿨어요.');
      setCurrentPassword('');setNewPassword('');setConfirmPassword('');
    } catch (error: any) {
      if(current())showError(error.message || '비밀번호를 바꾸지 못했어요. 다시 시도해 주세요.');
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
      if (!res.ok) { showError(body?.message || '계정을 삭제하지 못했어요. 다시 시도해 주세요.'); return; }

      await confirmedAccountSession(owner,current,()=>supabase.auth.getSession());
      await signOutEverywhere();
      if(!current())return;
      showSuccess('계정을 삭제했어요.');
      router.push('/');
    } catch (error: any) {
      if(current())showError(error.message || '계정을 삭제하지 못했어요. 다시 시도해 주세요.');
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
      showError('이미지 파일을 선택해 주세요.'); return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      showError('5MB 이하인 이미지를 선택해 주세요.'); return;
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
      showSuccess('프로필 사진을 바꿨어요.');
    } catch (error: any) {
      if(!current())return;
      showError(error.message || '사진을 올리지 못했어요. 다시 시도해 주세요.');
    } finally {
      if(current())setIsUploadingAvatar(false);
    }
  }

  /** Clearing the photo is enough: the server falls back to the same default avatar for this account. */
  async function handleAvatarDelete() {
    if (!user || !uploadedPhoto(profile)) return;
    const owner=user.id,current=operations.current.lease(owner);
    setIsUploadingAvatar(true);
    try {
      await confirmedAccountSession(owner,current,()=>supabase.auth.getSession());
      const { error: dbError } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', owner);
      if (dbError) throw dbError;
      // The profile no longer points at the file; removing it is best effort.
      await supabase.storage.from('avatars').remove([`${owner}/avatar.jpg`]).catch(()=>undefined);
      if(!current())return;
      await refreshProfile();
      if(!current())return;
      showSuccess('프로필 사진을 지웠어요.');
    } catch (error: any) {
      if(!current())return;
      showError(error.message || '사진을 지우지 못했어요. 다시 시도해 주세요.');
    } finally {
      if(current())setIsUploadingAvatar(false);
    }
  }

  if (authLoading) return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <LoadingSpinner size={56} label="프로필을 불러오고 있어요" />
    </div>
  );

  if (!user) return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4">
      <h2 className="text-2xl font-semibold">로그인이 필요해요</h2>
      <p className="text-muted-foreground">로그인한 뒤 내 정보를 확인하고 수정해 주세요.</p>
    </div>
  );

  return (
    <div className="cb-page-content max-w-2xl mx-auto py-4 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row items-center gap-5 bg-card ring-1 ring-foreground/5 p-5 sm:p-8 rounded-2xl shadow-sm">
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploadingAvatar}
          aria-label="프로필 사진 바꾸기" className="relative shrink-0 group active:scale-95 transition-transform"
        >
          {avatarSrc(profile) ? (
            <Image src={avatarSrc(profile)!} alt="프로필 사진" width={96} height={96} className="w-24 h-24 rounded-full object-cover ring-8 ring-primary/5" />
          ) : (
            <div className="bg-primary/10 p-5 rounded-full ring-8 ring-primary/5">
              <UserCircle2 className="w-14 h-14 text-primary" />
            </div>
          )}
          <span className="absolute bottom-0 right-0 flex items-center justify-center size-9 rounded-full bg-primary text-primary-foreground ring-4 ring-card shadow-md group-hover:scale-110 transition-transform">
            {isUploadingAvatar ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
          </span>
        </button>
        <div className="min-w-0 text-center md:text-left space-y-1">
          <h1 className="cb-page-title">{profile?.full_name || '내 프로필'}</h1>
          <p className="break-all text-muted-foreground flex items-center justify-center md:justify-start gap-2 text-sm">
            <Mail className="size-3" /> {user.email}
          </p>
          {uploadedPhoto(profile) && (
            <Button type="button" variant="ghost" size="sm" onClick={handleAvatarDelete} disabled={isUploadingAvatar} className="mt-1 text-muted-foreground">
              <Trash2 className="size-4" /> 사진 삭제
            </Button>
          )}
        </div>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); updateProfile(); }}
        className="bg-card ring-1 ring-foreground/5 p-5 rounded-2xl shadow-sm space-y-8"
      >
        <div className={multiSchoolEnabled?"grid grid-cols-1 gap-8":"grid grid-cols-1 md:grid-cols-2 gap-8"}>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-primary ml-1 flex items-center gap-1.5">
              <UserCircle2 className="size-3" /> 이름
            </label>
            <Input
              name="name"
              autoComplete="name"
              value={fullName}
              onChange={(e: any) => setFullName(e.target.value)}
              className="bg-background border h-12 px-4 rounded-lg font-medium text-sm focus:ring-primary transition-all"
              placeholder="Your Name"
            />
          </div>
          {!multiSchoolEnabled&&<div className="space-y-2">
            <label className="text-sm font-semibold text-primary ml-1 flex items-center gap-1.5">
              <Hash className="size-3" /> 학번
            </label>
            <Input
              name="student-id"
              autoComplete="off"
              inputMode="numeric"
              maxLength={4}
              disabled={scopedIdentity}
              value={studentId}
              onChange={(e: any) => setStudentId(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="bg-background border h-12 px-4 rounded-lg font-medium text-sm focus:ring-primary transition-all"
              placeholder="2309"
            />
            <p className="text-sm text-muted-foreground font-medium ml-1">{scopedIdentity?'학번은 학교별 소속 정보에서 확인하고 인증해요. 교사와 외부 계정은 학번 없이 프로필을 저장할 수 있어요.':STUDENT_ID_HINT}</p>
            {scopedIdentity&&<Button asChild variant="link" size="sm"><a href="/schools">학교 소속 확인하기</a></Button>}
          </div>}
        </div>

        <Button
          type="submit"
          disabled={isUpdating}
          className="w-full h-12 rounded-lg font-semibold text-sm shadow-sm shadow-primary/20 transition-all active:scale-[0.98] gap-2"
        >
          {isUpdating ? <Loader2 className="size-5 animate-spin" /> : <Save className="size-5" />}
          {isUpdating ? "저장 중…" : multiSchoolEnabled ? "이름 저장" : "프로필 저장"}
        </Button>
      </form>
      {multiSchoolEnabled&&<ProfileSchoolIdentity/>}

      <section className="bg-card ring-1 ring-foreground/5 p-5 rounded-2xl space-y-3">
        <h2 className="text-lg font-semibold">내 제작 신청 내역</h2>
        <p className="text-sm text-muted-foreground">학교 장비 이용 권한이 바뀌어도 내 신청과 첨부파일은 확인할 수 있어요. 새 신청에는 현재 이용 권한이 필요해요.</p>
        <div className="flex flex-wrap gap-3"><Button asChild variant="outline"><a href="/manufacturing/print">3D 프린팅 신청 내역</a></Button><Button asChild variant="outline"><a href="/manufacturing/laser">레이저 커팅 신청 내역</a></Button></div>
      </section>

      <form
        onSubmit={(e) => { e.preventDefault(); changePassword(); }}
        className="bg-card ring-1 ring-foreground/5 p-5 rounded-2xl shadow-sm space-y-8"
      >
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <KeyRound className="size-5 text-primary" /> 비밀번호 변경
        </h2>
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-primary ml-1 flex items-center gap-1.5">
              <Lock className="size-3" /> 현재 비밀번호
            </label>
            <Input
              type="password"
              name="current-password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e: any) => setCurrentPassword(e.target.value)}
              className="bg-background border h-12 px-4 rounded-lg font-medium text-sm focus:ring-primary transition-all"
              placeholder="••••••••"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-primary ml-1 flex items-center gap-1.5">
                <Lock className="size-3" /> 새 비밀번호
              </label>
              <Input
                type="password"
                name="new-password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e: any) => setNewPassword(e.target.value)}
                className="bg-background border h-12 px-4 rounded-lg font-medium text-sm focus:ring-primary transition-all"
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-primary ml-1 flex items-center gap-1.5">
                <Lock className="size-3" /> 새 비밀번호 확인
              </label>
              <Input
                type="password"
                name="new-password-confirm"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e: any) => setConfirmPassword(e.target.value)}
                className="bg-background border h-12 px-4 rounded-lg font-medium text-sm focus:ring-primary transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>
        </div>

        <Button
          type="submit"
          disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
          className="w-full h-12 rounded-lg font-semibold text-sm shadow-sm shadow-primary/20 transition-all active:scale-[0.98] gap-2"
        >
          {isChangingPassword ? <Loader2 className="size-6 animate-spin" /> : <KeyRound className="size-6" />}
          {isChangingPassword ? "변경 중…" : "비밀번호 변경"}
        </Button>
      </form>

      <div id="gpu-ssh-key" className="scroll-mt-24 bg-card ring-1 ring-foreground/5 p-5 rounded-2xl shadow-sm space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <KeyRound className="size-5 text-primary" /> GPU SSH 공개키
          </h2>
          <Button asChild variant="outline" size="sm"><a href="/dashboard/ssh-guide">SSH 사용법</a></Button>
        </div>
        <p className="text-sm text-muted-foreground">예약한 GPU 컨테이너에 SSH로 접속할 때 사용할 공개키를 등록하세요. 개인키와 서버 비밀번호는 입력하지 마세요.</p>
        <p className="text-sm text-muted-foreground"><code>ssh-keygen -t ed25519</code>로 키를 만든 뒤 <code>~/.ssh/id_ed25519.pub</code> 파일 내용을 붙여 넣으세요.</p>
        <Textarea
          aria-label="SSH 공개키"
          value={sshPublicKey}
          onChange={(event) => setSshPublicKey(event.target.value)}
          placeholder="ssh-ed25519 AAAA..."
          rows={3}
          className="font-mono"
        />
        <Button type="button" onClick={saveSshKey} disabled={savingSshKey || sshPublicKey.trim() === savedSshKey}>
          {savingSshKey ? '저장 중…' : sshPublicKey.trim() ? '공개키 저장' : '등록된 키 삭제'}
        </Button>
      </div>

      <div className="bg-card ring-1 ring-foreground/5 p-5 rounded-2xl shadow-sm space-y-6">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <BellRing className="size-5 text-primary" /> 알림 설정
        </h2>
        <p className="text-sm text-muted-foreground font-medium -mt-2">
          자습 신청 알림은 자습 신청 화면의 ‘신청 알림’에서 설정해 주세요.
        </p>
        <div className="divide-y divide-foreground/5">
          {NOTIF_PREFS.filter(({ role }) =>
            role === 'anyone' ||
            (role === 'manager' && (is3DPrintManager || isLaserCutManager)) ||
            (role === 'admin' && isAdmin)
          ).map(({ key, label, hint }) => (
            <div key={key} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-sm font-bold">{label}</p>
                <p className="text-sm text-muted-foreground font-medium">{hint}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={notifPrefs[key]}
                aria-label={label}
                disabled={savingNotifKey === key}
                onClick={() => toggleNotifPref(key)}
                className="relative h-11 w-14 shrink-0 rounded-lg disabled:opacity-50"
              >
                <span aria-hidden="true" className={`absolute inset-x-1 top-2 h-7 rounded-full transition-colors ${notifPrefs[key] ? 'bg-primary' : 'bg-foreground/15'}`} />
                <span
                  className={`absolute top-3 left-2 size-5 rounded-full bg-white shadow transition-transform ${
                    notifPrefs[key] ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card ring-1 ring-foreground/5 p-5 rounded-2xl shadow-sm">
        <Button type="button" variant="outline" onClick={() => void handleSignOut()} className="h-12 w-full rounded-lg font-semibold text-sm gap-2">
          <LogOut className="size-5" /> 로그아웃
        </Button>
      </div>

      <div className="bg-card ring-1 ring-destructive/20 p-5 rounded-2xl shadow-sm space-y-6">
        <h2 className="text-lg font-semibold flex items-center gap-2 text-destructive">
          <ShieldAlert className="size-5" /> 계정 삭제
        </h2>
        <p className="text-sm text-muted-foreground font-medium">
          계정을 삭제하면 다시 로그인할 수 없고 이름, 학번, 프로필 사진도 삭제돼요. 되돌릴 수 없어요.
        </p>
        <Button
          type="button"
          variant="destructive"
          onClick={() => setDeleteOpen(true)}
          className="h-12 rounded-lg font-semibold text-sm gap-2"
        >
          <Trash2 className="size-5" /> 계정 삭제
        </Button>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="계정을 삭제할까요?"
        description="이름, 학번, 프로필 사진이 삭제되고 다시 로그인할 수 없어요. 삭제한 계정은 되돌릴 수 없어요."
        confirmLabel={isDeletingAccount ? '삭제 중…' : '계정 삭제'}
        onConfirm={handleDeleteAccount}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}
