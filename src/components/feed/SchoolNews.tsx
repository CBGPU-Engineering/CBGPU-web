'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { LoadingSpinner } from '@/components/ui/spinner';
import HeadlineTrend from './HeadlineTrend';
import {useSchoolScope} from '@/components/schools/SchoolScope';
import {supabase} from '@/lib/supabase';
import {multiSchoolEnabled} from '@/lib/schoolsClient';
import {readSchoolNewsResponse,schoolNewsHttps,SchoolNewsWireError} from '@/lib/schoolNewsWire';

const TABS = [
  { id: 'notice',   label: '공지사항' },
  { id: 'letter',   label: '가정통신문' },
  { id: 'schedule', label: '학사일정' },
] as const;
type TabId = typeof TABS[number]['id'];

interface Item { title: string; link: string; pubDate: string; author: string }

function fmtDate(d: string) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d.slice(0, 10);
  return `${dt.getFullYear()}.${String(dt.getMonth()+1).padStart(2,'0')}.${String(dt.getDate()).padStart(2,'0')}`;
}

export default function SchoolNews(){
 const scope=useSchoolScope();
 if(multiSchoolEnabled&&scope.status!=='ready')return <p role="status">학교 소속을 확인한 뒤 학교 소식을 볼 수 있어요.</p>;
 return <SchoolNewsContents key={multiSchoolEnabled?scope.school?.id:'legacy'} schoolId={multiSchoolEnabled?scope.school?.id:undefined} schoolName={multiSchoolEnabled?scope.school?.display_name:'충북과학고등학교'} homepage={multiSchoolEnabled?scope.school?.homepage_url:'https://school.cbe.go.kr/cbs-h'}/>;
}
function SchoolNewsContents({schoolId,schoolName,homepage}:{schoolId?:string;schoolName?:string;homepage?:string|null}) {
  const [tab, setTab] = useState<TabId>('notice');
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const sequence=useRef(0);
  const [month,setMonth]=useState(()=>new Date(Date.now()+9*3600000).toISOString().slice(0,7));
  const [sourceUrl,setSourceUrl]=useState(schoolNewsHttps(homepage)??'');
  const [error, setError] = useState('');
  const [updated, setUpdated] = useState<Date | null>(null);

  const load = useCallback(async (t: TabId) => {
    const request=++sequence.current;setLoading(true); setError('');setItems([]);setUpdated(null);setSourceUrl(schoolId?(schoolNewsHttps(homepage)??''):t==='schedule'?`https://school.cbe.go.kr/cbs-h/M010407/list?y=${month.slice(0,4)}&m=${Number(month.slice(5))}`:t==='letter'?'https://school.cbe.go.kr/cbs-h/M010403':'https://school.cbe.go.kr/cbs-h/M010401');
    try {
      const session=schoolId?(await supabase.auth.getSession()).data.session:null;
      if(schoolId&&!session)throw Error('로그인하고 학교 소속을 확인해 주세요.');
      const res = await fetch(`/api/school-news?type=${t}&month=${month}`+(schoolId?'&school_id='+encodeURIComponent(schoolId):''),{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000),headers:{Accept:'application/json',...(session?{Authorization:'Bearer '+session.access_token}:{})}});
      const data = await readSchoolNewsResponse(res,schoolId??'cbsh',month);
      if(request!==sequence.current)return;
      setItems(Array.isArray(data.items)?data.items:[]);
      if(typeof data.sourceUrl==='string'&&data.sourceUrl.startsWith('https://'))setSourceUrl(data.sourceUrl);
      setUpdated(new Date());
    } catch (e) {
      if(request===sequence.current)setError(e instanceof SchoolNewsWireError?e.message:'학교 소식을 불러오지 못했어요. 로그인 상태와 네트워크를 확인한 뒤 다시 시도하거나 학교 홈페이지에서 원문을 확인해 주세요.');
    } finally {
      if(request===sequence.current)setLoading(false);
    }
  }, [month,schoolId,homepage]);

  useEffect(() => { void load(tab);return()=>{sequence.current++}; }, [tab, load]);

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <SegmentedTabs
          items={TABS.map(t => ({ value: t.id, label: t.label }))}
          value={tab}
          onChange={(v) => setTab(v as TabId)}
        />
        <div className="flex items-center gap-2">
          {tab==='schedule'&&<label className="text-sm text-muted-foreground">조회 월 <Input type="month" aria-label="학사일정 조회 월" value={month} min="2019-01" max="2099-12" onChange={e=>{if(/^20\d{2}-(0[1-9]|1[0-2])$/.test(e.target.value))setMonth(e.target.value)}} className="w-auto"/></label>}
          {updated && <span className="text-sm text-muted-foreground">{updated.toLocaleTimeString('ko-KR', { hour:'2-digit', minute:'2-digit' })}</span>}
          <Button variant="ghost" size="icon" aria-label="학교 소식 새로고침" className="size-11" onClick={() => load(tab)} disabled={loading}>
            <RefreshCw className={`size-3 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          {sourceUrl&&<a href={sourceUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="icon" aria-label="학교 홈페이지에서 원문 보기" className="size-11"><ExternalLink className="size-3" /></Button>
          </a>}
        </div>
      </div>

      {error && <div role="alert" className="space-y-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm"><p className="text-destructive">{error}</p><Button variant="outline" disabled={loading} onClick={() => void load(tab)}>학교 소식 다시 불러오기</Button></div>}

      {loading && (
        <div className="py-10 flex items-center justify-center">
          <LoadingSpinner size={48} label={tab==='schedule'?'학사일정 불러오는 중':'학교 소식 불러오는 중'} />
        </div>
      )}

      {!loading && !error && <HeadlineTrend titles={items.map(item => item.title)} scope={`school:${schoolId??'cbsh'}:${tab}`} />}

      <div className={`space-y-1.5 ${loading||error ? 'hidden' : ''}`}>
        {items.map((item, i) => (
          <a key={i} href={item.link} target="_blank" rel="noopener noreferrer"
            className="flex gap-3 items-start p-3 rounded-lg border border-border/40 hover:bg-muted/40 hover:border-border transition-all group">
            <span className="text-sm font-semibold text-muted-foreground/40 w-4 text-right mt-0.5 shrink-0">{i+1}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold leading-snug group-hover:text-primary transition-colors">{item.title}</p>
              <div className="flex items-center gap-2.5 mt-1 text-sm text-muted-foreground flex-wrap">
                {item.author && <span className="font-medium opacity-70">{item.author}</span>}
                {item.pubDate && <span className="opacity-40">{fmtDate(item.pubDate)}</span>}
              </div>
            </div>
            <ExternalLink className="size-3 text-muted-foreground/20 shrink-0 mt-1 group-hover:opacity-100 transition-opacity" />
          </a>
        ))}
      </div>

      {!loading&&!error&&items.length===0&&<p className="rounded-lg border border-border p-5 text-sm text-muted-foreground">{tab==='schedule'?'이 달에 등록된 학사일정이 없어요.':'등록된 소식이 없어요.'}</p>}
      {items.length > 0 && (
        <p className="text-center text-sm text-muted-foreground pt-1">
          출처:{' '}
          <a href={schoolNewsHttps(homepage)??sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:underline font-bold">
            {schoolName??'학교'} 홈페이지
          </a>
        </p>
      )}
    </div>
  );
}
