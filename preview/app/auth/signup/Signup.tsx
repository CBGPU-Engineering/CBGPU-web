'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { SchoolSelector } from '@/components/schools/SchoolSelector';
import { authErrorMessage } from '@/lib/authCopy';
import { schoolSignupMetadata, schoolSignupValidation, type SchoolSignupChoice, type SchoolSignupKind } from '@/lib/schoolSignup';
import { multiSchoolEnabled, schoolsRequest, type SchoolSummary } from '@/lib/schoolsClient';
import { supabase } from '@/lib/supabase';
import { OptionPicker } from '../../../components/OptionPicker';
import { AuthSent, canonicalAuthRedirect, currentPreviewReturn, PasswordField, PreviewAuth, previewAuthHref, usePreviewReturn } from '../PreviewAuth';
import styles from '../auth-preview.module.css';
import '../../feature-utilities.css';

const schoolTypes: { value: SchoolSignupKind; label: string }[] = [
  { value: 'STUDENT', label: '학생' },
  { value: 'TEACHER', label: '교사' },
  { value: 'EXTERNAL', label: '외부 협업자' },
];
const initialChoice: SchoolSignupChoice = {
  path: 'existing', school_id: 'cbsh', kind: 'STUDENT', student_number: '', department: '',
};
const signupModes = [
  { value: 'school', label: '학교에 가입하기' },
  { value: 'new', label: '우리 학교에 도입하기' },
  { value: 'personal', label: '학교 소속 없이 시작하기' },
] as const;
type SignupMode = typeof signupModes[number]['value'];

export default function Signup() {
  const next = usePreviewReturn();
  const [mode, setMode] = useState<SignupMode>('school');
  const [choice, setChoice] = useState<SchoolSignupChoice>(initialChoice);
  const [query, setQuery] = useState('');
  const [schools, setSchools] = useState<SchoolSummary[]>([]);
  const [loading, setLoading] = useState(multiSchoolEnabled);
  const [directoryError, setDirectoryError] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const submitting = useRef(false);

  useEffect(() => {
    if (!multiSchoolEnabled || mode !== 'school') return;
    let live = true;
    setLoading(true);
    setDirectoryError('');
    const timer = window.setTimeout(() => {
      const search = new URLSearchParams({ q: query, limit: '30', offset: '0' });
      void schoolsRequest<{ items: SchoolSummary[] }>('schools?' + search, 'GET', undefined, true).then(response => {
        if (!live) return;
        const approved = response.items.filter(school => school.status === 'APPROVED');
        setSchools(previous => {
          const selected = previous.find(school => school.id === choice.school_id);
          return selected && !approved.some(school => school.id === selected.id) ? [selected, ...approved] : approved;
        });
      }).catch(() => {
        if (live) setDirectoryError('학교를 불러오지 못했어요. 잠시 뒤 다시 검색해 주세요.');
      }).finally(() => { if (live) setLoading(false); });
    }, 200);
    return () => { live = false; window.clearTimeout(timer); };
  }, [query, mode, choice.school_id]);

  const selected = schools.find(school => school.id === choice.school_id);
  const allowed = schoolTypes.filter(item => !selected?.allowed_membership_types || selected.allowed_membership_types.includes(item.value));
  const currentChoice: SchoolSignupChoice = mode === 'new' ? { ...initialChoice, path: 'new' }
    : mode === 'personal' ? { ...initialChoice, school_id: '', kind: 'EXTERNAL' } : choice;
  const destination = mode === 'new' ? '/schools/new'
    : next !== '/new/' ? next
    : mode === 'school' && multiSchoolEnabled ? '/new/schools' : '/new/';

  function changeChoice(value: Partial<SchoolSignupChoice>) {
    if (submitting.current) return;
    setChoice(current => ({ ...current, ...value }));
    setError('');
  }

  function changeMode(value: SignupMode) {
    if (submitting.current) return;
    setMode(value);
    setError('');
  }

  async function signup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const validation = schoolSignupValidation(currentChoice);
    if (validation) { setError(validation); return; }
    if (!name.trim()) { setError('이름을 입력해 주세요.'); return; }
    if (multiSchoolEnabled && mode === 'school' && (!selected || !allowed.some(item => item.value === choice.kind))) {
      setError('운영 중인 학교와 가입할 유형을 확인해 주세요.');
      return;
    }

    submitting.current = true;
    setBusy(true);
    setError('');
    const requested = currentPreviewReturn();
    const nextPage = mode === 'new' ? '/schools/new' : requested !== '/new/' ? requested : destination;
    try {
      const result = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: schoolSignupMetadata(name, currentChoice),
          emailRedirectTo: canonicalAuthRedirect('/auth/callback', nextPage),
        },
      });
      if (result.error) { setError(authErrorMessage(result.error, 'signup')); return; }
      if (result.data.session) window.location.replace(nextPage);
      else setSent(true);
    } catch {
      setError('연결을 확인한 뒤 다시 시도해 주세요. 입력한 내용은 그대로 있어요.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  const login = mode === 'new'
    ? <a href={'/auth/login?next=' + encodeURIComponent(destination)}>로그인하고 도입 신청</a>
    : <Link href={previewAuthHref('/auth/login', destination)}>로그인하기</Link>;

  if (sent) return <PreviewAuth title="이메일에서 가입을 확인해 주세요">
    <AuthSent email={email.trim()}>받은 메일의 인증 링크를 누르면 가입을 이어갈 수 있어요. 메일이 보이지 않으면 스팸함도 확인해 주세요.</AuthSent>
    <div className="pv-auth-links">{login}<button type="button" className={styles.secondary} onClick={() => setSent(false)}>이메일 주소 확인</button></div>
  </PreviewAuth>;

  return <PreviewAuth title="계정 만들기" footer={<Link href={previewAuthHref('/auth/login', next)}>로그인으로 돌아가기</Link>}>
    <form method="post" onSubmit={signup} aria-busy={busy} aria-describedby={error ? 'preview-signup-error' : undefined}>
      {multiSchoolEnabled && <fieldset className={styles.paths} disabled={busy}>
        <legend>시작 방법</legend>
        {signupModes.map(option => <label key={option.value}>
          <input type="radio" name="signup-mode" value={option.value} checked={mode === option.value} onChange={() => changeMode(option.value)} />
          <span>{option.label}</span>
        </label>)}
      </fieldset>}
      {mode === 'school' && <fieldset className={styles.options} disabled={busy}>
        <legend className="pv-visually-hidden">학교 정보</legend>
        {multiSchoolEnabled && <>
          <SchoolSelector schools={schools.map(school => ({ id: school.id, name: school.display_name || school.official_name, region: school.region }))}
            value={choice.school_id} loading={loading} error={directoryError} onSearch={setQuery} disabled={busy}
            onChange={school => changeChoice({
              school_id: school.id,
              kind: schools.find(item => item.id === school.id)?.allowed_membership_types?.[0] || 'STUDENT',
              student_number: '',
              department: '',
            })}
            onCreate={() => changeMode('new')} />
          <OptionPicker label="소속 유형" value={choice.kind} options={allowed} onChange={value => {
            const kind = allowed.find(item => item.value === value);
            if (kind) changeChoice({ kind: kind.value });
          }} />
        </>}
        {choice.kind === 'STUDENT' && <div className={styles.field}>
          <label htmlFor="preview-signup-student">{choice.school_id === 'cbsh' ? '학번' : '학교 학생 번호'}</label>
          <input id="preview-signup-student" autoComplete="off" inputMode={choice.school_id === 'cbsh' ? 'numeric' : 'text'}
            value={choice.student_number} maxLength={choice.school_id === 'cbsh' ? 4 : 80}
            aria-describedby="preview-signup-student-note" onChange={event => changeChoice({
              student_number: choice.school_id === 'cbsh' ? event.target.value.replace(/\D/g, '') : event.target.value,
            })} required />
          <small id="preview-signup-student-note">{choice.school_id === 'cbsh' ? '충북과학고 학번 4자리를 입력해 주세요.' : '학교에서 쓰는 학생 번호를 입력해 주세요.'}</small>
        </div>}
        {choice.kind === 'TEACHER' && <div className={styles.field}>
          <label htmlFor="preview-signup-department">담당 교과 또는 부서 (선택)</label>
          <input id="preview-signup-department" value={choice.department} maxLength={150}
            onChange={event => changeChoice({ department: event.target.value })} />
        </div>}
      </fieldset>}
      {mode === 'new' && <p className={styles.note}>계정을 만든 뒤 학교 도입을 신청해요. 신청자와 학교를 확인한 뒤 관리 권한을 드려요.</p>}
      {mode === 'personal' && <p className={styles.note}>학교 소속 없이 이용해요. 학교 전용 기능을 사용하려면 소속을 확인받아야 해요.</p>}
      <label htmlFor="preview-signup-name">이름</label>
      <input id="preview-signup-name" name="name" autoComplete="name" maxLength={100} value={name}
        onChange={event => setName(event.target.value)} readOnly={busy} required />
      <label htmlFor="preview-signup-email">이메일</label>
      <input id="preview-signup-email" name="email" type="email" autoComplete="email" autoCapitalize="none"
        spellCheck={false} value={email} onChange={event => setEmail(event.target.value)} readOnly={busy} required />
      <PasswordField value={password} onChange={setPassword} busy={busy} />
      {error && <p id="preview-signup-error" className="pv-auth-error" role="alert">{error}</p>}
      <button type="submit" className="pv-primary" disabled={busy}>
        {busy ? '계정 만드는 중…' : mode === 'new' ? '계정 만들고 도입 신청' : '계정 만들기'}
      </button>
    </form>
  </PreviewAuth>;
}
