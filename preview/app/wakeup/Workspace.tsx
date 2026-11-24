'use client';

import { useEffect, useRef, useState } from 'react';
import { addDays, format, startOfDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ArrowUpRight, Music, Send, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';
import { useSchoolScope } from '@/components/schools/SchoolScope';
import { schoolServiceVisible } from '@/lib/schoolVisibility';
import { confirmedAccountSession } from '@/lib/confirmedAccountSession';
import { SONGS_PER_DAY } from '@/lib/wakeupFiller';
import SchoolOpsAccount from '../../components/SchoolOpsAccount';
import SchoolOpsConfirm from '../../components/SchoolOpsConfirm';
import { Notice } from '../../components/DirectoryFeedback';
import { OptionPicker } from '../../components/OptionPicker';
import styles from '../../components/SchoolOps.module.css';

const dorms = ['청운학사', '사름학사'] as const;
type Dorm = typeof dorms[number];
const dormKey = 'cbgpu.wakeup.dorm';
const songStatus = {
  pending: '확인 중', approved: '재생 예정', playing: '재생 중', rejected: '반려됨', played: '재생 완료',
} as const;

type Track = { id: string; uri: string; title: string; artists: string; thumbnailUrl: string | null; spotifyUrl: string };
type Song = {
  id: string; title: string; status: keyof typeof songStatus; message: string;
  spotify_url: string | null; thumbnail_url: string | null; reject_reason: string | null; play_date: string;
};

function spotifyUrl(value: string | null) {
  if (value?.startsWith('https://open.spotify.com/')) return value;
  return undefined;
}

function spotifyCover(value: string | null) {
  if (value?.startsWith('https://i.scdn.co/image/')) return value;
  return undefined;
}

function initialDorm(): Dorm {
  try {
    const saved = localStorage.getItem(dormKey);
    return dorms.find(dorm => dorm === saved) || dorms[0];
  } catch {
    return dorms[0];
  }
}

export default function Workspace() {
  return <SchoolOpsAccount path="/wakeup"><SchoolWakeup /></SchoolOpsAccount>;
}

function SchoolWakeup() {
  const scope = useSchoolScope();
  if (scope.status === 'loading' || scope.resource.status === 'loading') return <p role="status">학교 소속을 확인하고 있어요.</p>;
  if (!schoolServiceVisible(scope, '/wakeup')) return <Notice title="이 학교의 기상송은 연결되지 않았어요" />;
  return <Wakeup />;
}

function Wakeup() {
  const { user, isApproved } = useAuth();
  const owner = user!.id;
  const [dorm, setDorm] = useState(initialDorm);
  const [date, setDate] = useState(() => format(startOfDay(new Date()), 'yyyy-MM-dd'));
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [track, setTrack] = useState<Track>();
  const [queue, setQueue] = useState<Song[]>([]);
  const [requests, setRequests] = useState<Song[]>([]);
  const [playlist, setPlaylist] = useState<string>();
  const [searchStatus, setSearchStatus] = useState('');
  const [loadStatus, setLoadStatus] = useState('loading');
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState<Song>();
  const [feedback, setFeedback] = useState<{ error: boolean; text: string }>();
  const live = useRef(false);
  const submitting = useRef(false);

  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);

  useEffect(() => {
    let active = true;
    let generation = 0;
    async function load() {
      const attempt = ++generation;
      if (!active) return;
      try {
        const [mine, planned, list] = await Promise.all([
          supabase.from('wakeup_songs').select('id,title,status,message,spotify_url,thumbnail_url,reject_reason,play_date')
            .eq('user_id', owner).eq('dorm', dorm).order('created_at', { ascending: false }).limit(20),
          supabase.from('wakeup_songs').select('id,title,status,message,spotify_url,thumbnail_url,reject_reason,play_date')
            .eq('dorm', dorm).in('status', ['approved', 'playing', 'played']).eq('play_date', date).order('created_at', { ascending: true }),
          supabase.from('wakeup_playlists').select('spotify_playlist_url').eq('dorm', dorm).eq('play_date', date).maybeSingle(),
        ]);
        if (!active || attempt !== generation) return;
        if (mine.error || planned.error || list.error) throw Error('read failed');
        setRequests((mine.data ?? []) as Song[]);
        setQueue((planned.data ?? []) as Song[]);
        setPlaylist(spotifyUrl(list.data?.spotify_playlist_url));
        setLoadStatus('ready');
      } catch {
        if (active && attempt === generation) setLoadStatus('error');
      }
    }

    setLoadStatus('loading');
    setQueue([]);
    setRequests([]);
    setPlaylist(undefined);
    void load();
    const channel = supabase.channel('preview-wakeup-' + dorm)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wakeup_songs', filter: 'dorm=eq.' + dorm }, () => void load())
      .subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [date, dorm, owner, refresh]);

  useEffect(() => {
    const keyword = query.trim();
    if (!keyword) { setTracks([]); setSearchStatus(''); return; }
    const controller = new AbortController();
    setTracks([]);
    setSearchStatus('노래를 찾고 있어요.');
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch('/api/wakeup/spotify/search?q=' + encodeURIComponent(keyword), {
          signal: controller.signal, cache: 'no-store',
        });
        const data = await response.json();
        if (!response.ok || !Array.isArray(data?.items)) throw Error('search failed');
        if (controller.signal.aborted) return;
        setTracks(data.items);
        setSearchStatus(data.items.length ? '' : '찾는 노래가 없어요. 제목이나 가수 이름을 확인해 주세요.');
      } catch {
        if (!controller.signal.aborted) setSearchStatus('Spotify 검색에 연결하지 못했어요. 잠시 뒤 다시 검색해 주세요.');
      }
    }, 400);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query]);

  async function submit(remove: boolean) {
    if (submitting.current || (remove ? !target : !isApproved || !track || loadStatus !== 'ready' || queue.length >= SONGS_PER_DAY)) return;
    submitting.current = true;
    setFeedback(undefined);
    setBusy(true);
    const current = () => live.current;
    try {
      await confirmedAccountSession(owner, current, () => supabase.auth.getSession());
      const result = remove && target
        ? await supabase.from('wakeup_songs').delete().eq('id', target.id).eq('user_id', owner)
        : await supabase.from('wakeup_songs').insert({
          user_id: owner, dorm, play_date: date, title: track!.title, youtube_video_id: '', channel_title: track!.artists,
          thumbnail_url: track!.thumbnailUrl, spotify_track_id: track!.id, spotify_uri: track!.uri,
          spotify_url: track!.spotifyUrl, message: message.trim(),
        });
      if (!current()) return;
      if (result.error) throw result.error;
      if (!remove) { setTrack(undefined); setMessage(''); }
      setFeedback({ error: false, text: remove ? '신청을 취소했어요.' : '신청했어요. 처리 상태는 아래 내 신청에서 확인해 주세요.' });
      setRefresh(value => value + 1);
    } catch {
      if (current()) setFeedback({ error: true, text: remove ? '신청을 취소하지 못했어요. 다시 시도해 주세요.' : '노래를 신청하지 못했어요. 다시 시도해 주세요.' });
    } finally {
      submitting.current = false;
      if (current()) { setBusy(false); setTarget(undefined); }
    }
  }

  const dateOptions = Array.from({ length: 14 }, (_, index) => {
    const day = addDays(startOfDay(new Date()), index);
    return { value: format(day, 'yyyy-MM-dd'), label: format(day, 'M월 d일 (eee)', { locale: ko }) };
  });

  return <div className={styles.stack}>
    <div className={styles.inline}>
      <OptionPicker label="기숙사" value={dorm} options={dorms.map(value => ({ value, label: value }))}
        onChange={value => {
          if (submitting.current) return;
          const found = dorms.find(item => item === value);
          if (!found) return;
          setLoadStatus('loading');
          setDorm(found);
          try { localStorage.setItem(dormKey, found); } catch { /* Storage is optional. */ }
        }} />
      <OptionPicker label="재생 날짜" value={date} options={dateOptions} onChange={value => {
        if (submitting.current) return;
        setLoadStatus('loading'); setDate(value);
      }} />
    </div>
    {loadStatus === 'error' && <Notice title="기상송 목록을 불러오지 못했어요">
      <button className={styles.secondary} type="button" onClick={() => setRefresh(value => value + 1)}>다시 불러오기</button>
    </Notice>}
    <div className={styles.split}>
      <form className={styles.panel} onSubmit={event => { event.preventDefault(); void submit(false); }}>
        <h2 className={styles.inline}><Send size={18} aria-hidden />기상송 신청</h2>
        {track ? <div className={styles.line}>
          <div className={styles.inline}>
            {spotifyCover(track.thumbnailUrl) && <img src={spotifyCover(track.thumbnailUrl)} className={styles.cover} width={48} height={48} alt="" />}
            <p><strong>{track.title}</strong><br />{track.artists}</p>
          </div>
          <button type="button" className={styles.secondary} onClick={() => setTrack(undefined)} disabled={busy}>다시 고르기</button>
        </div> : <>
          <label className={styles.field}>Spotify 노래 검색
            <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="곡 제목이나 가수 이름" />
          </label>
          {searchStatus && <p role="status">{searchStatus}</p>}
          {tracks.length > 0 && <ul aria-label="Spotify 검색 결과">{tracks.map(item => <li key={item.id} className={styles.line}>
            <div className={styles.inline}>
              {spotifyCover(item.thumbnailUrl) && <img src={spotifyCover(item.thumbnailUrl)} className={styles.cover} width={48} height={48} alt="" />}
              <div><strong>{item.title}</strong><p className={styles.muted}>{item.artists}</p></div>
            </div>
            <button type="button" className={styles.secondary} onClick={() => { setTrack(item); setQuery(''); }}
              aria-label={item.title + ' 선택'}>선택</button>
          </li>)}</ul>}
        </>}
        <label className={styles.field}>신청 메시지 <small className={styles.muted}>선택</small>
          <input value={message} maxLength={200} onChange={event => setMessage(event.target.value)} disabled={busy} />
        </label>
        {!isApproved && <p>계정 승인이 끝나면 신청할 수 있어요.</p>}
        {loadStatus === 'ready' && queue.length >= SONGS_PER_DAY && <p>이날 대기열은 가득 찼어요. 다른 날짜를 골라 주세요.</p>}
        <div><button type="submit" className="pv-primary" disabled={busy || !isApproved || !track || loadStatus !== 'ready' || queue.length >= SONGS_PER_DAY}>
          {busy && !target ? '신청 중…' : '노래 신청하기'}
        </button></div>
        {feedback && <p className={styles.feedback} role={feedback.error ? 'alert' : 'status'}>{feedback.text}</p>}
      </form>
      <section className={styles.panel}>
        <h2 className={styles.inline}><Music size={19} aria-hidden />재생 대기열</h2>
        {playlist && <a href={playlist} target="_blank" rel="noopener noreferrer" className={styles.link}>Spotify 재생목록<ArrowUpRight size={15} aria-hidden /></a>}
        {loadStatus === 'loading' ? <p role="status">대기열을 확인하고 있어요.</p> : loadStatus === 'ready' && <>
          {queue.length > 0 ? <ol aria-label="재생 대기열" className={styles.queue}>{queue.slice(0, SONGS_PER_DAY).map((item, index) => (
            <li key={item.id} className={styles.line}><span>{index + 1}. {item.title}</span><small>{songStatus[item.status]}</small></li>
          ))}</ol> : <p>이날 재생이 확정된 신청곡이 없어요.</p>}
          {queue.length < SONGS_PER_DAY && <p className={styles.muted}>남은 {SONGS_PER_DAY - queue.length}자리는 최근 신청곡으로 채워요.</p>}
        </>}
      </section>
    </div>
    <section className={styles.panel}>
      <h2>내 신청</h2>
      {requests.length > 0 ? <ul>{requests.map(song => <li key={song.id} className={styles.line}>
        <div><strong>{song.title}</strong><p className={styles.muted}>{song.play_date} · {songStatus[song.status]}</p>
          {song.reject_reason && song.status === 'rejected' && <p>{song.reject_reason}</p>}
          {song.message && <p>{song.message}</p>}
          {spotifyUrl(song.spotify_url) && <a href={spotifyUrl(song.spotify_url)} target="_blank" rel="noopener noreferrer" className={styles.link}>Spotify에서 듣기</a>}
        </div>
        <button type="button" className={styles.secondary} onClick={() => setTarget(song)} disabled={busy} aria-label={song.title + ' 신청 취소'}><Trash2 size={17} aria-hidden />취소</button>
      </li>)}</ul> : loadStatus === 'ready' && <p>아직 신청한 노래가 없어요.</p>}
    </section>
    <SchoolOpsConfirm open={Boolean(target)} title="곡 신청을 취소할까요?" label={busy ? '취소 중…' : '신청 취소'} busy={busy}
      onCancel={() => setTarget(undefined)} onConfirm={() => void submit(true)}>
      ‘{target?.title}’ 신청 내역에서 삭제돼요.
    </SchoolOpsConfirm>
  </div>;
}
