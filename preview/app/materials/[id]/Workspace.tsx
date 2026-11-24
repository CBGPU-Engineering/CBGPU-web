'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Download, FileText, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';
import { userFacingError } from '@/lib/userFacingError';
import { formatBytes } from '@/lib/materialsApi';
import { aiRequest, waitForAiJob, type AiJob } from '@/lib/aiClient';
import SchoolOpsAccount from '../../../components/SchoolOpsAccount';
import { Notice } from '../../../components/DirectoryFeedback';
import styles from '../../../components/SchoolOps.module.css';
import { downloadMaterial, materialFields, type Material } from '../SchoolOpsFiles';

function Detail({ id }: { id: string }) {
  const { user } = useAuth();
  const owner = user?.id;
  const [row, setRow] = useState<Material>();
  const [error, setError] = useState('');
  const [pending, setPending] = useState('');
  const [job, setJob] = useState<AiJob>();
  const live = useRef(false);
  const actionRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    live.current = true;
    const controller = new AbortController();
    void supabase.from('shared_materials').select(materialFields).eq('id', id).eq('status', 'ready')
      .abortSignal(controller.signal).maybeSingle()
      .then(({ data, error: failure }) => {
        if (controller.signal.aborted) return;
        if (failure || !data) setError('자료를 찾을 수 없거나 열람 권한이 없어요.');
        else setRow(data as Material);
      });
    return () => { live.current = false; controller.abort(); actionRequest.current?.abort(); };
  }, [id]);

  async function action(summary: boolean) {
    if (!row || !owner || actionRequest.current) return;
    const controller = new AbortController();
    actionRequest.current = controller;
    setPending(summary ? '자료를 요약하고 있어요.' : '파일을 받는 중이에요.');
    setError('');
    try {
      if (!summary) {
        await downloadMaterial(row, owner, () => live.current && !controller.signal.aborted);
      } else {
        const response = await aiRequest('/materials/' + encodeURIComponent(row.id) + '/summarize', 'POST', {}, controller.signal, owner);
        if (!live.current) return;
        setJob(response.job);
        const result = await waitForAiJob(response.job.id, {
          timeout: 180_000,
          signal: controller.signal,
          onProgress: value => { if (live.current) setJob(value); },
        });
        if (live.current) setJob(result);
      }
    } catch (failure) {
      if (live.current) setError(failure instanceof Error ? failure.message : '잠시 후 다시 시도해 주세요.');
    } finally {
      if (actionRequest.current === controller) actionRequest.current = null;
      if (live.current) setPending('');
    }
  }

  return <div className={styles.stack}>
    <Link className="pv-back" href="/materials"><ArrowLeft size={17} aria-hidden />공유 자료</Link>
    {error && <Notice title={error} />}
    {!row ? !error && <p role="status">자료 정보를 불러오고 있어요.</p> : <article className={styles.panel}>
      <span className={styles.fileMark}><FileText size={22} aria-hidden /></span>
      <h1>{row.title}</h1>
      <p className={styles.muted}>{row.file_name} · {formatBytes(row.size_bytes)} · {new Date(row.created_at).toLocaleDateString('ko-KR')}</p>
      {row.tags.length > 0 && <p className={styles.muted}>{row.tags.map(value => '#' + value).join('  ')}</p>}
      <div className={styles.inline}>
        <button type="button" className="pv-primary" disabled={Boolean(pending)} onClick={() => void action(false)}>
          <Download size={18} aria-hidden />다운로드
        </button>
        <button type="button" className={styles.secondary} disabled={Boolean(pending)} onClick={() => void action(true)}>
          <Sparkles size={18} aria-hidden />AI로 요약
        </button>
      </div>
      {pending && <p role="status">{pending}</p>}
      {job && !pending && <div className={styles.stack}>
        <h2>AI 요약</h2>
        {job.state === 'succeeded'
          ? <p style={{ whiteSpace: 'pre-wrap' }}>{String(job.result?.text ?? '')}</p>
          : <p role="status">{userFacingError(job.error, '요약을 아직 받지 못했어요.')}</p>}
      </div>}
    </article>}
  </div>;
}

export default function Workspace({ id }: { id: string }) {
  return <SchoolOpsAccount path={'/materials/' + encodeURIComponent(id)}><Detail key={id} id={id} /></SchoolOpsAccount>;
}
