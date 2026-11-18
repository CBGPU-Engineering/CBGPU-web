'use client';
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { Plus, Trophy, ArrowUpRight, ArrowRight, CalendarDays, Search, Users, MapPin, X, SlidersHorizontal } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';
import { Contest, contestRegistrationPhase,contestEventPhase, contestError, formatContestDate } from '@/lib/contests';
import { contestDescriptionSummary } from '@/lib/contestPresentation';
import {EmptyState} from '@/components/ui/product-motion';
import { Button } from '@/components/ui/button';
import { useContestClock } from '@/components/contests/ContestClock';
import { ContestLogo } from '@/components/contests/ContestLogo';
import { ContestArtwork } from '@/components/contests/ContestArtwork';
import {useContestTransition} from '@/components/contests/ContestTransitionProvider';
import {motion,useReducedMotion} from 'motion/react';
import {productSpring} from '@/lib/motion';

type Filter='all'|'open'|'team'|'mine';
export default function ContestsPage(){
 const transition=useContestTransition();const reduced=useReducedMotion();
 const {user}=useAuth();const [contests,setContests]=useState<Contest[]>([]);const [filter,setFilter]=useState<Filter>('all');const [query,setQuery]=useState('');const [loading,setLoading]=useState(true);const [error,setError]=useState('');const {now}=useContestClock();
 const load=useCallback(async()=>{setLoading(true);setError('');try{const {data,error}=await supabase.from('contests').select('*').order('created_at',{ascending:false});if(error)throw error;setContests(data||[]);}catch(error){setError(contestError(error));}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();},[load]);
 const discoverable=useMemo(()=>contests.filter(c=>(c.lifecycle_status!=='archived'&&c.visibility!=='unlisted')||c.host_id===user?.id),[contests,user?.id]);
 const opened=discoverable.filter(c=>contestRegistrationPhase(c,now)==='open').length;
 const visible=discoverable.filter(c=>(filter!=='mine'||c.host_id===user?.id)&&(filter!=='open'||contestRegistrationPhase(c,now)==='open')&&(filter!=='team'||c.participation_mode==='team')&&`${c.title} ${contestDescriptionSummary(c.description)} ${c.location_name}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
 return <div className="contest-page contest-discovery mx-auto max-w-6xl">
  <header className="contest-hero contest-hero-premium">
   <div className="contest-hero-copy"><h1>대회</h1><p className="contest-hero-description">참가할 대회를 찾고, 팀을 모아 결과물을 제출하세요.</p><div className="contest-hero-actions"><Button asChild size="lg"><a href="#discover-challenges">대회 둘러보기<ArrowRight className="ml-2 size-4"/></a></Button><Button asChild variant="outline"><Link href="/contests/new"><Plus className="size-4"/>대회 열기</Link></Button></div></div>
  </header>
  <section id="discover-challenges" className="contest-discover-section" aria-labelledby="discover-title">
   <div className="contest-section-heading"><div><h2 id="discover-title">대회 목록</h2><p>{loading?'대회 목록을 불러오고 있어요.':`전체 ${discoverable.length}개 · 접수 중 ${opened}개`}</p></div><label className="contest-search"><Search className="size-4"/><span className="sr-only">대회 검색</span><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="대회 이름이나 내용 검색"/>{query&&<button type="button" aria-label="검색어 지우기" onClick={()=>setQuery('')}><X className="size-4"/></button>}</label></div>
   <div className="contest-filter-row"><div className="contest-filter-pills" aria-label="대회 필터">{([['all','전체'],['open','접수 중'],['team','팀 대회'],['mine','내가 연 대회']] as const).map(([value,label])=><button key={value} type="button" aria-pressed={filter===value} onClick={()=>setFilter(value)}>{filter===value&&<motion.span className="contest-filter-active" layoutId="contest-filter-selection" transition={reduced?{duration:0}:productSpring}/>}<span className="contest-filter-label">{label}</span>{value==='all'&&!loading&&<span>{discoverable.length}</span>}</button>)}</div><span className="contest-filter-hint"><SlidersHorizontal className="size-3.5"/>최신 등록순</span></div>
   {loading?<div className="contest-discovery-grid" role="status" aria-label="대회 불러오는 중">{[0,1,2].map(i=><div key={i} className="contest-card-skeleton"><div/><span/><span/><span/></div>)}</div>:error?<div role="alert" className="contest-empty-state"><Trophy/><h3>잠시 연결이 끊겼어요.</h3><p>{error}</p><Button onClick={()=>void load()} variant="outline">다시 불러오기</Button></div>:!visible.length?<EmptyState kind="competition" title={query?'검색 결과가 없어요.':filter==='mine'?'첫 번째 대회를 열어 보세요.':'등록된 대회가 없어요.'} description={query?'다른 검색어를 입력하거나 필터를 바꿔 보세요.':'다른 필터를 선택하거나 새 대회를 등록해보세요.'} action={<Button variant="outline" onClick={()=>{setFilter('all');setQuery('');}}>전체 대회 보기</Button>}/>:<div className="contest-discovery-grid">{visible.map((contest,index)=>{
    const phase=contestRegistrationPhase(contest,now),eventPhase=contestEventPhase(contest,now);return <motion.div key={contest.id} className="contest-card-motion" layout={!reduced} initial={{opacity:0,y:reduced?0:18}} animate={{opacity:1,y:0}} transition={reduced?{duration:0}:{type:'spring',stiffness:250,damping:26,delay:Math.min(index,5)*.055}} whileHover={reduced?undefined:{y:-5}}><Link href={`/contests/${contest.id}${contest.host_id===user?.id?'/manage':''}`} onClick={event=>{if(contest.host_id!==user?.id)transition?.(contest,event)}} className="contest-discovery-card" style={{'--contest-order':Math.min(index,5)} as CSSProperties}>
     <div className="contest-card-visual"><ContestArtwork id={contest.id} banner={contest.banner_path}/><span className="contest-card-type">{contest.participation_mode==='team'?<Users className="size-3.5"/>:<Trophy className="size-3.5"/>}{contest.participation_mode==='team'?'팀 대회':'개인 대회'}</span><span className="contest-card-open-icon"><ArrowUpRight className="size-5"/></span></div>
     <div className="contest-card-content"><div className="contest-card-topline"><span className="contest-status" data-closed={phase==='closed'}><span className="contest-status-dot"/>{eventPhase==='ended'?'대회 종료':phase==='checking'?'일정 확인 중':phase==='open'?'지금 접수 중':phase==='pending'?'곧 시작해요':'접수 마감'}</span>{contest.host_id===user?.id&&<span className="contest-owned-label">내가 연 대회</span>}</div><h3>{contest.title}</h3><p className="contest-card-description">{contestDescriptionSummary(contest.description)||'대회 상세에서 참가 안내와 제출 내용을 확인하세요.'}</p><div className="contest-card-meta"><span><CalendarDays className="size-3.5"/>{contest.event_start_at?formatContestDate(contest.event_start_at):formatContestDate(contest.registration_closes_at||contest.ends_at)}</span><span><MapPin className="size-3.5"/>{contest.location_type==='online'?'온라인':contest.location_name||'장소 추후 안내'}</span></div><footer><div className="contest-card-host"><ContestLogo path={contest.logo_path} title={contest.title}/><span>CBGPU 대회</span></div><span className="contest-card-cta">{contest.host_id===user?.id?'대회 관리':'자세히 보기'}<ArrowRight className="size-4"/></span></footer></div>
    </Link></motion.div>;
   })}</div>}
  </section>
  <aside className="contest-host-callout"><span className="contest-callout-icon"><Trophy/></span><div><h2>대회를 주최하시나요?</h2><p>참가 신청부터 팀 구성, 제출과 심사까지 관리할 수 있어요.</p></div><Button variant="outline" asChild><Link href="/contests/new">대회 만들기<ArrowUpRight className="size-4"/></Link></Button></aside>
 </div>;
}
