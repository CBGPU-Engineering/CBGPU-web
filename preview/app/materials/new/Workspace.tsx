'use client';

import { useEffect, useRef, useState } from 'react';
import { boundedClientRequest } from '@/lib/boundedClientRequest';
import { confirmedAccountSession } from '@/lib/confirmedAccountSession';
import { userFacingError } from '@/lib/userFacingError';
import { useSchoolResourcePermission, useSchoolResourceScope } from '@/components/schools/SchoolResourceScope';
import { useRouter } from 'next/navigation';
import { ArrowLeft, FileText, UploadCloud, X } from 'lucide-react';
import SchoolOpsAccount from '../../../components/SchoolOpsAccount';
import styles from '../../../components/SchoolOps.module.css';
import { useAuth } from '@/lib/useAuth';
import { supabase } from '@/lib/supabase';
import { MATERIALS_API_BASE as API_BASE, fetchMaterialsJson, formatBytes as fileSize, type MaterialsQuota } from '@/lib/materialsApi';

const MAX_BYTES = 1024 * 1024 * 1024;

const CHUNK_BYTES = 8 * 1024 * 1024;
type UploadState = { offset: number; size_bytes: number; complete: boolean };
type LegacyUploadAttempt = { id: string; owner: string; file: File; title: string; tags: string[]; created: boolean };

function transferError(status: number, responseText: string) {
  let detail: unknown;
  try { detail = JSON.parse(responseText)?.detail; } catch { /* proxy may return a non-JSON error */ }
  const message = status === 507 ? '자료 공유 저장 공간이 가득 찼어요. 관리자에게 문의해 주세요.'
    : userFacingError(detail, status === 0 ? '파일 서버에 연결하지 못했어요. 다시 시도해 주세요.' : '파일을 올리지 못했어요. 다시 시도해 주세요.');
  return Object.assign(new Error(message), { status });
}

function putChunk(url: string, token: string, chunk: Blob, onProgress: (loaded: number) => void) {
  return new Promise<{ offset: number; complete: boolean }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.timeout = 180000;
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.upload.onprogress = event => { if (event.lengthComputable) onProgress(event.loaded); };
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) { reject(transferError(xhr.status, xhr.responseText)); return; }
      try { resolve(JSON.parse(xhr.responseText)); } catch { reject(transferError(502, '')); }
    };
    xhr.onerror = xhr.ontimeout = () => reject(transferError(0, ''));
    xhr.onabort = () => reject(new Error('파일 올리기를 취소했어요.'));
    xhr.send(chunk);
  });
}

async function putFile(url: string, file: File, readToken: () => Promise<string>, onProgress: (ratio: number) => void) {
  async function status(): Promise<UploadState> {
    return boundedClientRequest(async signal => {
      const token = await readToken();
      if (signal.aborted) throw signal.reason;
      const response = await fetch(`${url}/upload`, { cache: 'no-store', signal, headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw transferError(response.status, await response.text());
      const state: UploadState = await response.json();
      if (!Number.isSafeInteger(state.offset) || state.offset < 0 || state.offset > file.size || state.size_bytes !== file.size || (state.complete && state.offset !== file.size)) {
        throw new Error('파일 전송 상태를 확인하지 못했어요. 다시 시도해 주세요.');
      }
      return state;
    });
  }
  let current = await status();
  onProgress(current.offset / file.size);
  if (current.complete) return;
  while (current.offset < file.size) {
    const offset = current.offset;
    const end = Math.min(offset + CHUNK_BYTES, file.size);
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await putChunk(`${url}/chunks?offset=${offset}`, await readToken(), file.slice(offset, end), loaded => onProgress(Math.min(offset + loaded, file.size) / file.size));
        if (result.offset !== end || result.complete !== (end === file.size)) throw new Error('파일 전송 결과를 확인하지 못했어요. 다시 시도해 주세요.');
        current = { offset: result.offset, size_bytes: file.size, complete: result.complete };
        onProgress(current.offset / file.size);
        break;
      } catch (error) {
        // The response may be lost after the server commits a chunk. Reconcile
        // its authenticated offset before retrying, rather than append twice.
        try {
          const saved = await status();
          if (saved.complete || saved.offset !== offset) { current = saved; onProgress(current.offset / file.size); break; }
        } catch { /* a transient outage can also prevent the status probe */ }
        const code = error instanceof Error && 'status' in error ? Number(error.status) : 0;
        if (attempt === 2 || code === 507 || (code >= 400 && code < 500 && ![401, 408, 409, 429].includes(code))) throw error;
        await new Promise(resolve => setTimeout(resolve, 750 * (attempt + 1)));
      }
    }
  }
  if (!current.complete) {
    current = await status();
    if (!current.complete) throw new Error('파일 올리기를 마치지 못했어요. 다시 시도해 주세요.');
  }
  onProgress(1);
}

export default function Workspace() {
  return <SchoolOpsAccount path="/materials/new"><Upload /></SchoolOpsAccount>;
}

function Upload() {
  const router = useRouter();
  const { user } = useAuth();
  const scope = useSchoolResourceScope();
  const storagePermission = useSchoolResourcePermission('school_storage');
  const uploadAttempt = useRef<{id:string;fingerprint:string;file:File}|null>(null);
  const legacyAttempt = useRef<LegacyUploadAttempt | null>(null);
  const uploadLock = useRef(false);
  const picker = useRef<HTMLInputElement>(null);
  const actor = useRef(user?.id); actor.current = user?.id;
  const [retainedUpload, setRetainedUpload] = useState(false);
  const [verificationNeeded, setVerificationNeeded] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [feedback, setFeedback] = useState<{ error: boolean; text: string }>();
  const showError = (text: string) => setFeedback({ error: true, text });
  const showSuccess = (text: string) => setFeedback({ error: false, text });
  useEffect(() => {
    actor.current = user?.id;
    return () => { actor.current = undefined; };
  }, [user?.id]);
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const previousOwner = useRef(user?.id);
  useEffect(() => {
    if (previousOwner.current === user?.id) return;
    previousOwner.current = user?.id;
    legacyAttempt.current = null; uploadAttempt.current = null;
    setRetainedUpload(false); setVerificationNeeded(false); setUploadMessage('');
    setFile(null); setTitle(''); setTags([]); setTagInput('');
  }, [user?.id]);

  function addTag() {
    const value = tagInput.trim().replace(/^#/, '');
    if (!value) return;
    if (value.length > 20) { showError('태그는 20자 이내로 입력해 주세요.'); return; }
    if (tags.length >= 8 && !tags.includes(value)) { showError('태그는 최대 8개까지 추가할 수 있어요.'); return; }
    if (!tags.includes(value)) setTags(previous => [...previous, value]);
    setTagInput('');
  }

  async function legacyStatus(attempt: LegacyUploadAttempt) {
    return boundedClientRequest(async signal => {
      const { data: { session } } = await supabase.auth.getSession();
      if (signal.aborted || actor.current !== attempt.owner || session?.user.id !== attempt.owner) throw new Error('로그인 계정이 바뀌었어요. 자료 목록에서 전송 결과를 확인해 주세요.');
      const { data, error } = await supabase.from('shared_materials').select('id,status').eq('id', attempt.id).eq('uploader_id', attempt.owner).abortSignal(signal).maybeSingle();
      if (error) throw error;
      if (data && (data.id !== attempt.id || !['pending', 'ready'].includes(data.status))) throw new Error('전송 상태를 확인하지 못했어요.');
      return data?.status as 'pending' | 'ready' | undefined;
    });
  }

  async function upload() {
    if (uploadLock.current) return;
    if (!user || !file) { showError('파일을 선택해 주세요.'); return; }
    if (!title.trim()) { showError('제목을 입력해 주세요.'); return; }
    if (title.trim().length > 120) { showError('제목은 120자 이내로 입력해 주세요.'); return; }
    if (!file.size || file.size > MAX_BYTES) { showError('파일은 1GB 이하로 선택해 주세요.'); return; }
    if (!API_BASE) { showError('자료 공유 서버가 연결되지 않았어요. 관리자에게 알려 주세요.'); return; }
    const owner = user.id;
    const current = () => actor.current === owner;
    const readToken = async () => (await confirmedAccountSession(owner, current, () => supabase.auth.getSession())).access_token;
    uploadLock.current = true;
    setUploading(true); setUploadMessage('');
    setProgress(0);
    let materialId: string | null = null;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('로그인해 주세요.');
      if (session.user.id !== owner || actor.current !== owner) throw new Error('로그인 계정이 바뀌었어요. 다시 시도해 주세요.');
      const selectedSchool = scope.current?.school_id;
      if (storagePermission.enabled && (!selectedSchool || !(await storagePermission.verify()))) throw new Error('선택한 학교의 자료 공유 권한이 없거나 만료됐어요. 학교 소속과 이용 권한을 확인해 주세요.');
      // Resolve an uncertain legacy request by ID before any further write.
      if (!storagePermission.enabled && legacyAttempt.current) {
        const attempt = legacyAttempt.current;
        if (attempt.owner !== owner || attempt.file !== file) throw new Error('기존 전송의 계정과 파일을 확인해 주세요. 자료 목록에서 전송 결과를 확인할 수 있어요.');
        materialId = attempt.id;
        const status = await legacyStatus(attempt);
        if (status === 'ready') { showSuccess('자료를 공유했어요.'); router.push('/materials'); return; }
        attempt.created = status === 'pending';
        if (verificationNeeded) {
          setVerificationNeeded(false);
          setUploadMessage(status === 'pending' ? '전송이 아직 끝나지 않았어요. 이어서 올리기를 눌러 주세요.' : '공유 기록이 아직 없어요. 자료 공유하기를 눌러 다시 시도해 주세요.');
          return;
        }
      }
      // Check capacity before creating a new reservation; resumed uploads already have one.
      if (storagePermission.enabled || !legacyAttempt.current?.created) {
        const quota = await fetchMaterialsJson<MaterialsQuota>('/materials/quota').catch(() => null);
        if (quota && file.size > quota.remaining_bytes) throw new Error(`자료 공유 저장 공간이 부족해요. (남은 공간 ${fileSize(quota.remaining_bytes)}) 관리자에게 문의해 주세요.`);
      }
      if (!current()) return;
      if (storagePermission.enabled) {
        const fingerprint = JSON.stringify([owner, selectedSchool, title.trim(), tags, file.name, file.size, file.lastModified]);
        if (uploadAttempt.current?.fingerprint !== fingerprint || uploadAttempt.current.file !== file) uploadAttempt.current = {id:crypto.randomUUID(), fingerprint, file};
        const response = await fetch(`${API_BASE}/materials`, {method:'POST', headers:{Authorization:`Bearer ${session.access_token}`, 'Content-Type':'application/json', 'X-CBGPU-School-Id':selectedSchool!}, body:JSON.stringify({upload_id:uploadAttempt.current.id, title:title.trim(), tags, file_name:file.name.slice(0,255), content_type:file.type || 'application/octet-stream', size_bytes:file.size})});
        const saved = await response.json().catch(()=>null);
        if (!response.ok) throw new Error(userFacingError(saved?.detail, '자료를 올릴 권한을 확인하지 못했어요. 다시 시도해 주세요.'));
        if (!saved?.id || saved.school_id !== selectedSchool || saved.access_scope !== 'SCHOOL') throw new Error('자료를 올릴 학교를 확인하지 못했어요. 학교를 다시 선택해 주세요.');
        materialId = saved.id;
      } else {
        // A browser-owned UUID makes a lost INSERT response reconcilable without
        // creating another draft. Keep the exact File and metadata for resuming.
        const attempt = legacyAttempt.current ?? { id: crypto.randomUUID(), owner, file, title: title.trim(), tags: [...tags], created: false };
        legacyAttempt.current = attempt; setRetainedUpload(true);
        materialId = attempt.id;
        if (!attempt.created) {
          const { data, error } = await boundedClientRequest(signal => supabase.from('shared_materials').insert({
            id: attempt.id, uploader_id: attempt.owner, title: attempt.title, tags: attempt.tags, file_name: attempt.file.name.slice(0, 255),
            content_type: attempt.file.type || 'application/octet-stream', size_bytes: attempt.file.size, status: 'pending',
          }).select('id').abortSignal(signal).single(), undefined, 30_000);
          if (error) throw error;
          if (data?.id !== attempt.id) throw new Error('자료 전송 기록을 확인하지 못했어요.');
          attempt.created = true;
        }
      }
      await putFile(`${API_BASE}/materials/${materialId}`, storagePermission.enabled ? file : legacyAttempt.current?.file ?? file, readToken, ratio => { if (current()) setProgress(ratio); });
      if (actor.current !== owner) return;
      showSuccess('자료를 공유했어요.');
      router.push('/materials');
    } catch (error) {
      if (actor.current !== owner) return;
      if (materialId && !storagePermission.enabled && legacyAttempt.current?.id === materialId) {
        // Never delete on an ambiguous response. Even a pending read can race a
        // final chunk committing. Only the user can explicitly resume this ID.
        try {
          const status = await legacyStatus(legacyAttempt.current);
          if (status === 'ready') { showSuccess('자료를 공유했어요.'); router.push('/materials'); return; }
          legacyAttempt.current.created = status === 'pending';
          setVerificationNeeded(false);
          const capacityFull = error instanceof Error && 'status' in error && Number(error.status) === 507;
          setUploadMessage(capacityFull ? '자료 공유 저장 공간이 가득 찼어요. 관리자에게 문의한 뒤 이어서 올려 주세요.' : status === 'pending' ? '전송이 아직 끝나지 않았어요. 같은 파일로 이어서 올릴 수 있어요.' : '공유 기록이 아직 없어요. 계정과 자료 공유 권한을 확인한 뒤 다시 시도해 주세요.');
        } catch {
          setVerificationNeeded(true);
          setUploadMessage('전송 결과를 확인하지 못했어요. 파일과 입력 내용은 그대로 있어요. 전송 결과 확인을 눌러 다시 확인해 주세요.');
        }
        return;
      }
      showError(error instanceof Error ? error.message : '자료를 올리지 못했어요. 다시 시도해 주세요.');
    } finally {
      uploadLock.current = false;
      setUploading(false);
    }
  }

  return <div className={styles.stack + ' ' + styles.narrow}>
    <div><button type="button" className={styles.secondary} disabled={uploading} onClick={() => router.push('/materials')}>
      <ArrowLeft size={17} aria-hidden />자료 공유로 돌아가기
    </button></div>
    {storagePermission.enabled && <div className={styles.panel} role="status">
      <strong>{scope.current?.school.display_name || '학교를 선택해 주세요'}</strong>
      <p className={styles.muted}>{storagePermission.allowed ? '선택한 학교에 자료를 공유해요.' : storagePermission.reason}</p>
    </div>}
    <form className={styles.stack} onSubmit={event => { event.preventDefault(); void upload(); }}>
      <fieldset className={styles.panel} disabled={uploading || retainedUpload}>
        <legend className="pv-visually-hidden">파일과 자료 정보</legend>
        <label className={styles.field}>제목
          <input value={title} onChange={event => setTitle(event.target.value)} maxLength={120} required />
        </label>
        <div className={styles.form}>
          <label className={styles.field} htmlFor="preview-upload-tag">태그 <small className={styles.muted}>선택 · 최대 8개</small></label>
            <div className={styles.tagField}>
              <input id="preview-upload-tag" value={tagInput} onChange={event => setTagInput(event.target.value)}
                onKeyDown={event => { if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); addTag(); } }} />
              <button className={styles.secondary} type="button" onClick={addTag}>태그 추가</button>
            </div>
          {tags.length > 0 && <div className={styles.tags}>
            {tags.map(tag => <button key={tag} className={styles.secondary} type="button" onClick={() => setTags(current => current.filter(value => value !== tag))} aria-label={'태그 ' + tag + ' 지우기'}>
              #{tag}<X size={16} aria-hidden />
            </button>)}
          </div>}
        </div>
        <div className={styles.uploadDrop} data-dragging={dragging}
          onDragOver={event => { event.preventDefault(); if (!uploading && !retainedUpload) setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={event => { event.preventDefault(); setDragging(false); if (!uploading && !retainedUpload) setFile(event.dataTransfer.files[0] ?? null); }}>
          <input ref={picker} type="file" hidden onChange={event => { setFile(event.target.files?.[0] ?? null); event.target.value = ''; }} />
          {file ? <div className={styles.line}>
            <div className={styles.inline}><FileText size={19} aria-hidden />{file.name} · {fileSize(file.size)}</div>
            <button type="button" className={styles.secondary} onClick={() => setFile(null)} aria-label="선택한 파일 지우기"><X size={17} aria-hidden /></button>
          </div> : <div className={styles.inline}>
            <button type="button" className={styles.secondary} onClick={() => picker.current?.click()}><UploadCloud size={17} aria-hidden />파일 선택</button>
            <p className={styles.muted}>파일 1개 · 최대 1GB<br />끌어서 놓을 수도 있어요.</p>
          </div>}
        </div>
      </fieldset>
      {feedback && <p role={feedback.error ? 'alert' : 'status'} className={styles.feedback}>{feedback.text}</p>}
      {uploadMessage && <p role="status">{uploadMessage}</p>}
      {uploading && !verificationNeeded && <label className={styles.field}>
        {progress >= 1 ? '업로드를 마무리하고 있어요.' : '파일을 올리고 있어요.'}
        <progress className={styles.meter} value={Math.round(progress * 100)} max={100} />
      </label>}
      <div><button type="submit" className="pv-primary"
        disabled={uploading || !title.trim() || !file || (storagePermission.enabled && !storagePermission.allowed)}>
        <UploadCloud size={17} aria-hidden />
        {uploading ? '처리 중…' : verificationNeeded ? '전송 결과 확인' : retainedUpload ? '이어서 올리기' : '자료 공유하기'}
      </button></div>
    </form>
  </div>;
}
