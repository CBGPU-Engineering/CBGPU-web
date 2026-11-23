'use client';

import { useEffect, useRef, useState } from 'react';
import { boundedClientRequest } from '@/lib/boundedClientRequest';
import { useSchoolResourcePermission, useSchoolResourceScope } from '@/components/schools/SchoolResourceScope';
import { useRouter } from 'next/navigation';
import { ArrowLeft, FileText, Loader2, Tag, UploadCloud, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAlert } from '@/lib/alert';
import { useAuth } from '@/lib/useAuth';
import { supabase } from '@/lib/supabase';
import { MATERIALS_API_BASE as API_BASE, fetchMaterialsJson, materialsToken, formatBytes as fileSize, type MaterialsQuota } from '@/lib/materialsApi';

const MAX_BYTES = 1024 * 1024 * 1024;
const cardClass = 'space-y-5 rounded-2xl border border-border/60 bg-card p-5 sm:p-6';
const labelClass = 'mb-1.5 block text-sm font-semibold   text-muted-foreground';

const CHUNK_BYTES = 8 * 1024 * 1024;
type UploadState = { offset: number; size_bytes: number; complete: boolean };
type LegacyUploadAttempt = { id: string; owner: string; file: File; title: string; tags: string[]; created: boolean };

function transferError(status: number, responseText: string) {
  let detail: unknown;
  try { detail = JSON.parse(responseText)?.detail; } catch { /* proxy may return a non-JSON error */ }
  const message = status === 507 ? '자료 공유 저장 공간이 가득 찼어요. 관리자에게 문의해 주세요.'
    : typeof detail === 'string' ? detail : status === 0 ? '파일 서버에 연결하지 못했어요. 다시 시도해 주세요.' : `파일 서버 오류 (${status})`;
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

async function putFile(url: string, file: File, onProgress: (ratio: number) => void) {
  async function status(): Promise<UploadState> {
    return boundedClientRequest(async signal => {
      const token = await materialsToken();
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
        const result = await putChunk(`${url}/chunks?offset=${offset}`, await materialsToken(), file.slice(offset, end), loaded => onProgress(Math.min(offset + loaded, file.size) / file.size));
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

export default function NewMaterialPage() {
  const router = useRouter();
  const { user } = useAuth();
  const scope = useSchoolResourceScope();
  const storagePermission = useSchoolResourcePermission('school_storage');
  const uploadAttempt = useRef<{id:string;fingerprint:string;file:File}|null>(null);
  const legacyAttempt = useRef<LegacyUploadAttempt | null>(null);
  const uploadLock = useRef(false);
  const actor = useRef(user?.id); actor.current = user?.id;
  const [retainedUpload, setRetainedUpload] = useState(false);
  const [verificationNeeded, setVerificationNeeded] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const { showError, showSuccess } = useAlert();
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
      if (storagePermission.enabled) {
        const fingerprint = JSON.stringify([owner, selectedSchool, title.trim(), tags, file.name, file.size, file.lastModified]);
        if (uploadAttempt.current?.fingerprint !== fingerprint || uploadAttempt.current.file !== file) uploadAttempt.current = {id:crypto.randomUUID(), fingerprint, file};
        const response = await fetch(`${API_BASE}/materials`, {method:'POST', headers:{Authorization:`Bearer ${session.access_token}`, 'Content-Type':'application/json', 'X-CBGPU-School-Id':selectedSchool!}, body:JSON.stringify({upload_id:uploadAttempt.current.id, title:title.trim(), tags, file_name:file.name.slice(0,255), content_type:file.type || 'application/octet-stream', size_bytes:file.size})});
        const saved = await response.json().catch(()=>null);
        if (!response.ok) throw new Error(typeof saved?.detail === 'string' ? saved.detail : '자료를 올릴 권한을 확인하지 못했어요. 다시 시도해 주세요.');
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
      await putFile(`${API_BASE}/materials/${materialId}`, storagePermission.enabled ? file : legacyAttempt.current?.file ?? file, setProgress);
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

  return <section className="cb-page-content mx-auto max-w-2xl space-y-6 py-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
    {storagePermission.enabled && <div role="status" className="rounded-xl border border-border/60 bg-card p-4 text-sm"><p className="font-semibold">{scope.current?.school.display_name || '학교를 선택해 주세요'} · 교내 자료 공유</p><p className="mt-1 text-muted-foreground">{storagePermission.allowed ? '선택한 학교에서만 공유해요. 임시 권한이 끝나도 내가 올린 기록은 유지돼요.' : storagePermission.reason}</p></div>}
    <div className="flex items-center gap-4">
      <button type="button" onClick={() => router.push('/materials')} disabled={uploading} aria-label="자료 공유로 돌아가기" className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-card text-muted-foreground transition-all hover:border-border hover:text-foreground disabled:opacity-50">
        <ArrowLeft className="size-4" />
      </button>
      <div>
        <h1 className="cb-page-title">자료 올리기</h1>
        <p className="cb-page-sub mt-1">파일 · 제목 · 태그</p>
      </div>
    </div>

    <form className="space-y-5" onSubmit={event => { event.preventDefault(); void upload(); }}>
      <section className={cardClass}>
        <div>
          <label htmlFor="material-title" className={`${labelClass} flex justify-between`}><span>제목 *</span><span className="font-bold normal-case tracking-normal">{title.length}/120</span></label>
          <Input id="material-title" disabled={uploading || retainedUpload} value={title} onChange={event => setTitle(event.target.value)} maxLength={120} placeholder="예: 물리학 실험 보고서 양식" className="min-h-11" />
        </div>
        <div>
          <label htmlFor="material-tag-input" className={labelClass}>태그</label>
          <div className="flex gap-2">
            <Input id="material-tag-input" disabled={uploading || retainedUpload} value={tagInput} onChange={event => setTagInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); addTag(); } }} placeholder="태그 입력 후 Enter" className="min-h-11" />
            <Button variant="outline" type="button" disabled={uploading || retainedUpload} className="gap-1.5" onClick={addTag}><Tag className="size-4" />추가</Button>
          </div>
          {tags.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{tags.map(tag => <button key={tag} type="button" disabled={uploading || retainedUpload} onClick={() => setTags(previous => previous.filter(value => value !== tag))} aria-label={`태그 ${tag} 제거`} className="min-h-11 rounded-full"><Badge className="normal-case tracking-normal text-sm px-2.5 py-1">#{tag}<X className="size-3" /></Badge></button>)}</div>}
          <p className="mt-2 text-sm text-muted-foreground">{tags.length}/8개 · 태그를 누르면 지울 수 있어요.</p>
        </div>
      </section>

      <section className={cardClass}>
        <div>
          <h2 className={labelClass}>파일 *</h2>
          {file ? <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/20 p-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><FileText className="size-5" /></div>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{file.name}</p><p className="text-sm text-muted-foreground">{fileSize(file.size)}{file.size > MAX_BYTES ? ' · 1GB를 넘어요' : ''}</p></div>
            <button type="button" disabled={uploading || retainedUpload} onClick={() => setFile(null)} aria-label="선택한 파일 제거" className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"><X className="size-4" /></button>
          </div> : <label className={`group relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-9 text-center transition-colors ${dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/60 hover:bg-muted/30 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2'}`}
            onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); setFile(event.dataTransfer.files[0] ?? null); }}>
            <UploadCloud className={`size-7 ${dragging ? 'text-primary' : 'text-muted-foreground'}`} />
            <span className="text-sm font-bold">파일을 선택하거나 여기에 놓아 주세요</span>
            <span className="text-sm text-muted-foreground">파일 1개 · 최대 1GB</span>
            <input type="file" aria-label="공유할 파일 선택" disabled={uploading} className="absolute inset-0 size-full cursor-pointer opacity-0" onChange={event => { setFile(event.target.files?.[0] ?? null); event.target.value = ''; }} />
          </label>}
        </div>
      </section>

      {uploadMessage && <p role="status" className="text-sm text-muted-foreground">{uploadMessage}</p>}
      {uploading && !verificationNeeded && <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} className="space-y-1.5">
        <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
        <p className="text-right text-sm text-muted-foreground">{progress >= 1 ? '서버에서 마무리하는 중…' : `${Math.round(progress * 100)}% · ${fileSize(file?.size ?? 0)}`}</p>
      </div>}

      <div className="flex gap-3">
        <Button type="button" variant="outline" className="h-11 flex-1 font-bold" disabled={uploading} onClick={() => router.push('/materials')}>취소</Button>
        <Button type="submit" className="h-11 flex-1 gap-2 font-bold" disabled={uploading || !title.trim() || !file || (storagePermission.enabled && !storagePermission.allowed)}>
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}{uploading ? verificationNeeded ? '결과 확인 중…' : `올리는 중 ${Math.round(progress * 100)}%` : verificationNeeded ? '전송 결과 확인' : retainedUpload && legacyAttempt.current?.created ? '이어서 올리기' : '자료 공유하기'}
        </Button>
      </div>
    </form>
  </section>;
}
