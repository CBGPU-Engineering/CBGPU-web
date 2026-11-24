'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Download, FileArchive, FileImage, FileText, FolderOpen, Plus, Search, Trash2 } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useAuth } from '@/lib/useAuth';
import { supabase } from '@/lib/supabase';
import { readMaterialsList } from '@/lib/materialsListRead';
import { formatBytes } from '@/lib/materialsApi';
import SchoolOpsAccount from '../../components/SchoolOpsAccount';
import SchoolOpsConfirm from '../../components/SchoolOpsConfirm';
import { Notice } from '../../components/DirectoryFeedback';
import styles from '../../components/SchoolOps.module.css';
import { downloadMaterial, materialFields, removeMaterial, type Material } from './SchoolOpsFiles';

const pageSize = 40;

function Materials() {
  const { user } = useAuth();
  const owner = user?.id;
  const [rows, setRows] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [mine, setMine] = useState(false);
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('');
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string }>();
  const [busy, setBusy] = useState<string>();
  const [target, setTarget] = useState<Material>();
  const request = useRef<AbortController | null>(null);
  const live = useRef(false);
  const reduced = useReducedMotion();

  const load = useCallback(async (offset = 0) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError('');
    try {
      const { data, error: failure } = await readMaterialsList(signal => supabase.from('shared_materials')
        .select(materialFields).eq('status', 'ready').order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1).abortSignal(signal), controller.signal);
      if (controller.signal.aborted) return;
      if (failure) throw failure;
      const loaded = (data ?? []) as Material[];
      setRows(previous => offset ? [...new Map([...previous, ...loaded].map(item => [item.id, item])).values()] : loaded);
      setMore(loaded.length === pageSize);
    } catch {
      if (!controller.signal.aborted) setError('자료를 불러오지 못했어요. 다시 불러와 주세요.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    live.current = true;
    void load();
    return () => { live.current = false; request.current?.abort(); };
  }, [load]);

  const keyword = query.trim().toLocaleLowerCase();
  const visible = rows.filter(row => (!mine || row.uploader_id === owner) &&
    (!tag || row.tags.includes(tag)) && (!keyword ||
      [row.title, row.file_name, ...row.tags].some(value => value.toLocaleLowerCase().includes(keyword))));
  const tags = [...new Set(rows.flatMap(row => row.tags))].sort((a, b) => a.localeCompare(b, 'ko'));
  const filtering = Boolean(keyword || tag || mine);

  async function act(row: Material, remove = false) {
    if (busy || !owner) return;
    setBusy(row.id);
    setFeedback(undefined);
    try {
      if (remove) {
        await removeMaterial(row, owner, () => live.current);
        if (!live.current) return;
        setTarget(undefined);
        setRows(previous => previous.filter(item => item.id !== row.id));
        setFeedback({ ok: true, text: '자료를 삭제했어요.' });
      } else {
        await downloadMaterial(row, owner, () => live.current);
      }
    } catch (failure) {
      if (live.current) {
        setTarget(undefined);
        setFeedback({ ok: false, text: failure instanceof Error ? failure.message : '잠시 후 다시 시도해 주세요.' });
      }
    } finally {
      if (live.current) setBusy(undefined);
    }
  }

  return <div className={styles.stack}>
    <div className={styles.line}>
      <p className={styles.muted}>학교 구성원이 공유한 학습·연구 자료를 찾아보세요.</p>
      <Link href="/materials/new" className="pv-primary"><Plus size={17} aria-hidden />자료 올리기</Link>
    </div>
    <div className={styles.filters}>
      <div className={'pv-search ' + styles.materialSearch}>
        <Search size={18} aria-hidden />
        <input type="search" aria-label="자료 검색" placeholder="제목이나 파일 이름으로 찾기" value={query}
          onChange={event => setQuery(event.target.value)} />
      </div>
      <div className={styles.inline} role="group" aria-label="공유 자료 범위">
        <button type="button" className={styles.secondary} aria-pressed={!mine} onClick={() => setMine(false)}>모든 자료</button>
        <button type="button" className={styles.secondary} aria-pressed={mine} onClick={() => setMine(true)}>내가 올린 자료</button>
      </div>
      {tags.length > 0 && <div className={styles.tags} role="group" aria-label="태그로 찾기">
        {tags.map(value => <button key={value} className={styles.secondary} aria-pressed={tag === value}
          type="button" onClick={() => setTag(tag === value ? '' : value)}>#{value}</button>)}
      </div>}
    </div>
    {feedback && <p className={styles.feedback} role={feedback.ok ? 'status' : 'alert'}>{feedback.text}</p>}
    {error && <Notice title={error}><button type="button" onClick={() => void load()} className={styles.secondary}>다시 불러오기</button></Notice>}
    <section aria-label="자료 목록" aria-busy={loading}>
      <p className="pv-result-count" role="status">{loading ? '자료를 불러오고 있어요.' : `자료 ${visible.length}개`}</p>
      {visible.length ? <ul className="pv-list">
        <AnimatePresence initial={false}>
          {visible.map(row => {
            const Icon = row.content_type.startsWith('image/') ? FileImage : /zip|compressed/.test(row.content_type) ? FileArchive : FileText;
            return <motion.li layout={reduced ? false : 'position'} key={row.id}
              exit={reduced ? undefined : { opacity: 0 }} className={styles.materialRow}>
              <span className={styles.fileMark}><Icon size={21} aria-hidden /></span>
              <div className={styles.fileHeading}>
                <Link className={styles.link} href={'/materials/' + encodeURIComponent(row.id)}>{row.title}<ArrowUpRight size={15} aria-hidden /></Link>
                <p>{row.file_name} · {formatBytes(row.size_bytes)} · {new Date(row.created_at).toLocaleDateString('ko-KR')}</p>
                {row.tags.length > 0 && <p>{row.tags.map(value => '#' + value).join('  ')}</p>}
              </div>
              <div className={styles.materialActions}>
                <button type="button" className={styles.secondary} disabled={Boolean(busy)} onClick={() => void act(row)}>
                  <Download size={16} aria-hidden />{busy === row.id && !target ? '받는 중…' : '다운로드'}
                </button>
                {row.uploader_id === owner && <button type="button" className={styles.secondary} disabled={Boolean(busy)} onClick={() => setTarget(row)}>
                  <Trash2 size={16} aria-hidden />삭제
                </button>}
              </div>
            </motion.li>;
          })}
        </AnimatePresence>
      </ul> : !loading && !error && <Notice title={filtering ? '조건에 맞는 자료가 없어요' : '아직 공유된 자료가 없어요'}>
        <FolderOpen size={25} aria-hidden />
        {filtering
          ? <button type="button" className={styles.secondary} onClick={() => { setQuery(''); setTag(''); setMine(false); }}>검색 조건 지우기</button>
          : <Link className={styles.link} href="/materials/new">첫 자료 올리기</Link>}
      </Notice>}
    </section>
    {more && <div><button type="button" className={styles.secondary} disabled={loading} onClick={() => void load(rows.length)}>자료 더 보기</button></div>}
    <SchoolOpsConfirm open={Boolean(target)} title="자료를 삭제할까요?" label={busy ? '삭제 중…' : '자료 삭제'} busy={Boolean(busy)}
      onCancel={() => setTarget(undefined)} onConfirm={() => { if (target) void act(target, true); }}>
      ‘{target?.title}’을 삭제하면 학교 구성원이 이 파일을 받을 수 없어요.
    </SchoolOpsConfirm>
  </div>;
}

export default function Workspace() {
  return <SchoolOpsAccount path="/materials"><Materials /></SchoolOpsAccount>;
}
