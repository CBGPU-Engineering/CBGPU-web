'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { boundedClientRequest } from '@/lib/boundedClientRequest';
import { RefreshCw, ExternalLink, MessageSquare, ChevronUp, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { LoadingSpinner } from '@/components/ui/spinner';
import HeadlineTrend from './HeadlineTrend';

// ─── category config ──────────────────────────────────────────────────────────
const CATEGORIES = [
  {
    id: 'ai', label: 'AI · 언어 모델',
    hn: 'LLM GPT Claude artificial intelligence machine learning agent 2025',
    google: 'AI LLM ChatGPT Claude machine learning 2025',
  },
  {
    id: 'security', label: '보안',
    hn: 'hacking CVE exploit vulnerability malware ransomware zero-day',
    google: 'CVE vulnerability exploit hacking cybersecurity 2025',
  },
  {
    id: 'embedded', label: '임베디드',
    hn: 'embedded firmware microcontroller IoT RTOS ESP32 RISC-V bare-metal',
    google: 'embedded systems firmware microcontroller IoT RTOS 2025',
  },
  {
    id: 'research', label: '연구',
    hn: 'arxiv paper preprint neural network deep learning research',
    google: 'machine learning research paper arxiv preprint 2025',
  },
  {
    id: 'oss', label: '오픈 소스',
    hn: 'open source release github rust golang typescript new version',
    google: 'open source release new version programming 2025',
  },
  {
    id: 'kr', label: '한국 IT',
    hn: 'korea samsung naver kakao hyundai kia',
    google: '인공지능 한국 스타트업 삼성 네이버 카카오 IT',
    googleLang: 'ko',
  },
] as const;

type CatId = typeof CATEGORIES[number]['id'];
type Source = 'google' | 'hn';

interface HNStory {
  objectID: string;
  title: string;
  url?: string;
  author: string;
  points: number;
  num_comments: number;
  created_at: string;
}

interface GNewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
}

// ─── helpers ──────────────────────────────────────────────────────────────────
function ago(d: string): string {
  const ms = Date.now() - new Date(d).getTime();
  const h = Math.floor(ms / 3_600_000);
  if (h >= 24) return `${Math.floor(h / 24)}d`;
  if (h >= 1) return `${h}h`;
  return `${Math.floor(ms / 60_000)}m`;
}

function domain(url?: string): string {
  if (!url) return '';
  try { return new URL(url).hostname.replace('www.', ''); } catch { return ''; }
}

// ─── HN fetch ─────────────────────────────────────────────────────────────────
async function fetchHN(query: string, signal: AbortSignal): Promise<HNStory[]> {
  const res = await fetch(
    `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=50`,
    { signal },
  );
  if (!res.ok) throw new Error('HN fetch failed');
  const data = await res.json();
  if (!Array.isArray(data.hits)) throw new Error('HN response unavailable');
  return data.hits as HNStory[];
}

// ─── Google News fetch (via API route) ────────────────────────────────────────
async function fetchGoogle(query: string, lang: string | undefined, signal: AbortSignal): Promise<GNewsItem[]> {
  const res = await fetch(`/api/news?q=${encodeURIComponent(query)}&hl=${lang ?? 'en-US'}`, { signal });
  if (!res.ok) throw new Error('Google News fetch failed');
  const data = await res.json();
  if (!Array.isArray(data.items)) throw new Error('Google response unavailable');
  return data.items as GNewsItem[];
}

// ─── component ────────────────────────────────────────────────────────────────
export default function TechNews() {
  const [cat, setCat] = useState<CatId>('ai');
  const [src, setSrc] = useState<Source>('google');
  const [hnSnapshot, setHnSnapshot] = useState<{ category: CatId; items: HNStory[]; at: Date } | null>(null);
  const [googleSnapshot, setGoogleSnapshot] = useState<{ category: CatId; items: GNewsItem[]; at: Date } | null>(null);
  const [loading, setLoading] = useState(false);
  const [justFinished, setJustFinished] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const request = useRef<AbortController | null>(null);
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeScope = useRef(`${src}:${cat}`); activeScope.current = `${src}:${cat}`;

  const load = useCallback(async (catId: CatId, source: Source) => {
    const scope = `${source}:${catId}`;
    if (scope !== activeScope.current) return;
    const cfg = CATEGORIES.find(c => c.id === catId)!;
    const ticket = ++generation.current;
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    if (finishTimer.current) clearTimeout(finishTimer.current);
    const current = () => generation.current === ticket && activeScope.current === scope && !controller.signal.aborted;
    setLoading(true); setJustFinished(false); setError('');
    let succeeded = false;
    try {
      if (source === 'hn') {
        const data = await boundedClientRequest(signal => fetchHN(cfg.hn, signal), controller.signal);
        if (!current()) return;
        setHnSnapshot({ category: catId, items: data, at: new Date() });
      } else {
        const data = await boundedClientRequest(signal => fetchGoogle(cfg.google, 'googleLang' in cfg ? cfg.googleLang : undefined, signal), controller.signal);
        if (!current()) return;
        setGoogleSnapshot({ category: catId, items: data, at: new Date() });
      }
      succeeded = true;
    } catch {
      if (!current()) return;
      setError(source === 'hn'
        ? 'Hacker News를 불러오지 못했어요. 다시 불러와 주세요.'
        : 'Google News를 불러오지 못했어요. 다시 불러와 주세요.');
    } finally {
      if (current()) {
        setLoading(false); setJustFinished(succeeded);
        if (succeeded) finishTimer.current = setTimeout(() => { if (current()) setJustFinished(false); }, 600);
      }
    }
  }, []);

  useEffect(() => {
    void load(cat, src);
    return () => { ++generation.current; request.current?.abort(); if (finishTimer.current) clearTimeout(finishTimer.current); };
  }, [cat, src, load]);
  useEffect(() => {
    const t = setInterval(() => { void load(cat, src); }, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [cat, src, load]);

  // Keep confirmed content after a same-scope refresh failure. Never relabel a
  // different category's cached headlines or summary as the current category.
  const stories = src === 'hn' && hnSnapshot?.category === cat ? hnSnapshot.items : [];
  const gnNews = src === 'google' && googleSnapshot?.category === cat ? googleSnapshot.items : [];
  const snapshot = src === 'hn' ? hnSnapshot : googleSnapshot;
  const refreshed = snapshot?.category === cat ? snapshot.at : null;

  const total = src === 'hn' ? stories.length : gnNews.length;

  return (
    <div className="w-full space-y-4">
      {/* category tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {CATEGORIES.map(c => (
          <button
            key={c.id}
            type="button" aria-pressed={cat === c.id}
            onClick={() => setCat(c.id)}
            className={`min-h-11 px-3 py-2 rounded-lg font-semibold text-sm transition-all ${
 cat === c.id ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted text-muted-foreground hover:bg-muted/70'
 }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* source + refresh */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <SegmentedTabs
            items={[{ value: 'google', label: '🔍 Google' }, { value: 'hn', label: '🔶 HN' }]}
            value={src}
            onChange={(v) => setSrc(v as Source)}
          />
          {total > 0 && (
            <span className="text-sm text-muted-foreground self-center ml-1 font-medium">{total}건</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {refreshed && (
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Zap className="size-2.5 text-green-500" />
              {refreshed.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <Button variant="ghost" size="icon" aria-label="기술 소식 새로고침" className="size-11" onClick={() => load(cat, src)} disabled={loading}>
            <RefreshCw className={`size-3 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {error && (
        <div role="alert" className="space-y-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm"><p className="text-destructive">{error}</p><Button variant="outline" onClick={() => load(cat, src)} disabled={loading}>뉴스 다시 불러오기</Button></div>
      )}

      {(loading || justFinished) && (
        <div className="py-10 flex items-center justify-center">
          <LoadingSpinner done={justFinished} size={48} label="뉴스 불러오는 중" />
        </div>
      )}

      {!loading && !justFinished && !error && snapshot?.category === cat && <HeadlineTrend key={`${src}:${cat}`} titles={(src === 'hn' ? stories : gnNews).map(item => item.title)} scope={`tech:${src}:${cat}`} />}

      {/* HN stories */}
      {src === 'hn' && (
        <div className={`space-y-1.5 ${loading || justFinished ? 'hidden' : ''}`}>
          {stories.map((s, i) => (
            <a key={s.objectID}
              href={s.url || `https://news.ycombinator.com/item?id=${s.objectID}`}
              target="_blank" rel="noopener noreferrer"
              className="flex gap-3 items-start p-3 rounded-lg border border-border/40 hover:bg-muted/40 hover:border-border transition-all group"
            >
              <span className="text-sm font-semibold text-muted-foreground/40 w-4 text-right mt-0.5 shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold leading-snug group-hover:text-primary transition-colors">{s.title}</p>
                <div className="flex items-center gap-2.5 mt-1 text-sm text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-0.5"><ChevronUp className="size-2.5" />{s.points ?? 0}</span>
                  <span className="flex items-center gap-0.5"><MessageSquare className="size-2.5" />{s.num_comments ?? 0}</span>
                  {domain(s.url) && <span className="opacity-60 truncate max-w-[150px]">{domain(s.url)}</span>}
                  <span className="opacity-40">{ago(s.created_at)}</span>
                </div>
              </div>
              <ExternalLink className="size-3 text-muted-foreground/20 shrink-0 mt-1 group-hover:opacity-100 transition-opacity" />
            </a>
          ))}
        </div>
      )}

      {/* Google News items */}
      {src === 'google' && (
        <div className={`space-y-1.5 ${loading || justFinished ? 'hidden' : ''}`}>
          {gnNews.map((item, i) => (
            <a key={item.link + i}
              href={item.link}
              target="_blank" rel="noopener noreferrer"
              className="flex gap-3 items-start p-3 rounded-lg border border-border/40 hover:bg-muted/40 hover:border-border transition-all group"
            >
              <span className="text-sm font-semibold text-muted-foreground/40 w-4 text-right mt-0.5 shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold leading-snug group-hover:text-primary transition-colors">{item.title}</p>
                <div className="flex items-center gap-2.5 mt-1 text-sm text-muted-foreground flex-wrap">
                  {item.source && <span className="font-medium opacity-70 truncate max-w-[180px]">{item.source}</span>}
                  {item.pubDate && <span className="opacity-40">{ago(item.pubDate)}</span>}
                </div>
              </div>
              <ExternalLink className="size-3 text-muted-foreground/20 shrink-0 mt-1 group-hover:opacity-100 transition-opacity" />
            </a>
          ))}
        </div>
      )}

      {!loading && total === 0 && !error && (
        <p className="text-center text-sm text-muted-foreground py-8">아직 표시할 뉴스가 없어요. 다른 주제나 출처를 선택해 보세요.</p>
      )}

      {total > 0 && (
        <p className="text-center text-sm text-muted-foreground pt-2">
          {src === 'hn'
            ? <>출처 <a href="https://news.ycombinator.com" target="_blank" rel="noopener noreferrer" className="hover:underline font-bold">Hacker News</a></>
            : 'Google News · 5분마다 새 소식 확인'}
        </p>
      )}
    </div>
  );
}
