'use client';

import Link from 'next/link';
import { CalendarDays, ChevronRight, Search, Settings2, Trophy, Users } from 'lucide-react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/useAuth';
import { supabase } from '@/lib/supabase';
import { type Contest, contestError, contestEventPhase, contestRegistrationPhase } from '@/lib/contests';
import { contestDescriptionSummary } from '@/lib/contestPresentation';
import { productSpring } from '@/lib/motion';
import { useContestClock } from '@/components/contests/ContestClock';
import { CollaborationAction } from './CollaborationWorkspace';
import { Notice } from './DirectoryFeedback';

const filters = [['all', '참가 가능한 대회'], ['open', '신청 중'], ['host', '운영하는 대회']] as const;
type ListContest = Pick<Contest, 'id' | 'host_id' | 'title' | 'description' | 'location_name' |
  'participation_mode' | 'visibility' | 'lifecycle_status' | 'registration_open' | 'registration_opens_at' |
  'registration_closes_at' | 'event_start_at' | 'event_end_at' | 'ends_at'>;

const registrationLabels = { checking: '신청 상태 확인 중', pending: '신청 예정', open: '신청 중', closed: '신청 마감' };
const dateFormat = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' });

function label(contest: ListContest, now: number | null) {
  const event = contestEventPhase(contest, now);
  if (event === 'ended') return '대회 종료';
  if (event === 'cancelled') return '취소됨';
  if (event === 'archived') return '보관됨';
  return registrationLabels[contestRegistrationPhase(contest, now)];
}

export default function CollaborationContestList() {
  const { user } = useAuth();
  const userId = user?.id;
  const { now } = useContestClock();
  const reduceMotion = useReducedMotion();
  const [filter, setFilter] = useState<typeof filters[number][0]>('all');
  const [query, setQuery] = useState('');
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ contests: ListContest[]; hosted: Set<string>; error: string } | null>(null);

  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    async function load() {
      try {
        const [contests, operators] = await Promise.all([
          supabase.from('contests')
            .select('id,host_id,title,description,location_name,participation_mode,visibility,lifecycle_status,registration_open,registration_opens_at,registration_closes_at,event_start_at,event_end_at,ends_at')
            .order('created_at', { ascending: false }).abortSignal(controller.signal),
          supabase.from('event_hosts').select('contest_id').eq('user_id', userId).abortSignal(controller.signal),
        ]);
        if (contests.error) throw contests.error;
        if (operators.error) throw operators.error;
        if (!controller.signal.aborted) setResult({
          contests: contests.data ?? [],
          hosted: new Set((operators.data ?? []).map(row => row.contest_id)),
          error: '',
        });
      } catch (error) {
        if (!controller.signal.aborted) setResult({ contests: [], hosted: new Set(), error: contestError(error) });
      }
    }
    void load();
    return () => controller.abort();
  }, [userId, revision]);

  const time = now === null ? null : Math.floor(now / 1000) * 1000;
  const rows = useMemo(() => (result?.contests ?? []).flatMap(contest => {
    const manages = contest.host_id === userId || result?.hosted.has(contest.id) === true;
    const searchable = (contest.title + ' ' + contestDescriptionSummary(contest.description) + ' ' + (contest.location_name ?? '')).toLocaleLowerCase();
    if (!searchable.includes(query.trim().toLocaleLowerCase())) return [];
    if (!manages && (contest.visibility === 'unlisted' || contest.lifecycle_status === 'archived')) return [];
    if (filter === 'host' && !manages || filter === 'open' && contestRegistrationPhase(contest, time) !== 'open') return [];
    return [{ contest, manages }];
  }), [result, userId, filter, query, time]);

  return <>
    <header className="pv-collaboration-heading">
      <div><Link href="/contests" className="pv-back">공개 대회 둘러보기</Link><h1>참가·운영 대회</h1>
        <p>대회를 찾아 신청하고, 내가 운영하는 대회의 참가자와 제출물을 확인해 보세요.</p></div>
      <CollaborationAction href="/contests/new">대회 열기</CollaborationAction>
    </header>
    <div className="pv-collaboration-toolbar">
      <LayoutGroup id="preview-contest-filters"><nav aria-label="대회 조건" className="pv-collaboration-filters">
        {filters.map(([value, name]) => <motion.button type="button" key={value} aria-pressed={filter === value} whileTap={reduceMotion ? undefined : { scale: 0.96 }} onClick={() => setFilter(value)}>
          {!reduceMotion && filter === value && <motion.span aria-hidden="true" layoutId="indicator" className="pv-collaboration-filter-indicator" transition={productSpring} />}
          <span>{name}</span>
        </motion.button>)}
      </nav></LayoutGroup>
      <label className="pv-search">
        <Search size={18} aria-hidden="true" />
        <span className="pv-visually-hidden">대회 이름 또는 장소</span>
        <input value={query} type="search" maxLength={80} placeholder="대회 이름 또는 장소" onChange={event => setQuery(event.target.value)} />
      </label>
    </div>
    {!result ? <p role="status">대회를 불러오고 있어요.</p> : result.error
      ? <Notice title="대회를 불러오지 못했어요">
        <p role="alert">{result.error}</p>
        <button className="pv-primary" type="button" onClick={() => { setResult(null); setRevision(value => value + 1); }}>다시 불러오기</button>
      </Notice> : rows.length ? <ul className="pv-collaboration-list"><AnimatePresence initial={false}>
        {rows.map(({ contest, manages }) => {
          const path = '/contests/' + encodeURIComponent(contest.id);
          const date = contest.event_start_at ? new Date(contest.event_start_at) : null;
          return <motion.li layout={reduceMotion ? undefined : "position"} key={contest.id} initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0 }} transition={productSpring}>
            <span className="pv-row-icon"><Trophy size={21} aria-hidden="true" /></span>
            <div>
              <p className="pv-meta">{label(contest, time)}</p>
              <h2><Link href={path + '/participate'} prefetch={false}>{contest.title}</Link></h2>
              <p className="pv-collaboration-meta"><Users size={15} aria-hidden="true" /> {contest.participation_mode === 'team' ? '팀 참가' : '개인 참가'}
                {date && Number.isFinite(date.getTime()) && <><CalendarDays size={15} aria-hidden="true" /> <time dateTime={contest.event_start_at!}>{dateFormat.format(date)}</time></>}
              </p>
            </div>
            <div className="pv-collaboration-row-actions">
              {manages && <Link href={path + '/manage'} prefetch={false} aria-label={contest.title + ' 관리'}><Settings2 size={16} aria-hidden="true" /> 관리</Link>}
              <Link href={path + '/participate'} prefetch={false} aria-label={contest.title + ' 참가 안내'}>참가 안내 <ChevronRight size={16} aria-hidden="true" /></Link>
            </div>
          </motion.li>;
        })}
      </AnimatePresence></ul> : <Notice title={query ? '검색 조건에 맞는 대회가 없어요' : filter === 'host' ? '아직 운영하는 대회가 없어요' : filter === 'open' ? '지금 신청을 받는 대회가 없어요' : '표시할 대회가 없어요'} />
    }
  </>;
}
