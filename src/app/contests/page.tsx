'use client';
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { Plus, Trophy, ArrowUpRight, ArrowRight, CalendarDays, Search, Users, MapPin, Sparkles, X, SlidersHorizontal } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';
import { Contest, contestRegistrationPhase, contestError, formatContestDate } from '@/lib/contests';
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
   <div className="contest-hero-copy"><p className="contest-eyebrow"><span className="contest-live-indicator"/>CBGPU CHALLENGES</p><h1>작은 아이디어가<br/><span>다음 가능성으로.</span></h1><p className="contest-hero-description">함께 만들고, 직접 도전하고, 가능성을 발견하세요.<br className="hidden sm:block"/>새로운 도전의 시작부터 마지막 제출까지, 여기에서.</p><div className="contest-hero-actions"><Button asChild size="lg" className="contest-hero-button"><Link href="/contests/new"><Plus className="size-4"/>대회 열기<ArrowUpRight className="ml-4 size-4"/></Link></Button><a href="#discover-challenges" className="contest-hero-text-link">내 도전 찾기<ArrowRight className="size-4"/></a></div><div className="contest-hero-caption"><Sparkles className="size-3.5"/>기획부터 참가, 팀 구성과 작품 제출까지 한곳에서</div></div>
   <div className="contest-hero-visual"><ContestArtwork id="cbgpu-discovery"/><div className="contest-floating-note contest-floating-note-top"><span className="contest-note-icon"><Trophy className="size-4"/></span><div><small>YOUR NEXT CHALLENGE</small><strong>가능성을 직접 만들어 가는 곳</strong></div></div><div className="contest-floating-note contest-floating-note-bottom"><span className="contest-note-icon"><Users className="size-4"/></span><div><small>BETTER TOGETHER</small><strong>혼자 시작해도, 함께 완성해요.</strong></div></div></div>
  </header>
  <section id="discover-challenges" className="contest-discover-section" aria-labelledby="discover-title">
   <div className="contest-section-heading"><div><p className="contest-eyebrow">FIND YOUR NEXT</p><h2 id="discover-title">지금, 도전해 볼까요?</h2><p>{loading?'새로운 도전을 불러오고 있어요.':`${discoverable.length}개의 이야기, ${opened}개의 열려 있는 기회.`}</p></div><label className="contest-search"><Search className="size-4"/><span className="sr-only">대회 검색</span><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="어떤 도전을 찾고 있나요?"/>{query&&<button type="button" aria-label="검색어 지우기" onClick={()=>setQuery('')}><X className="size-4"/></button>}</label></div>
   <div className="contest-filter-row"><div className="contest-filter-pills" aria-label="대회 필터">{([['all','전체 도전'],['open','접수 중'],['team','팀으로 도전'],['mine','내가 연 대회']] as const).map(([value,label])=><button key={value} type="button" aria-pressed={filter===value} onClick={()=>setFilter(value)}>{filter===value&&<motion.span className="contest-filter-active" layoutId="contest-filter-selection" transition={reduced?{duration:0}:productSpring}/>}<span className="contest-filter-label">{label}</span>{value==='all'&&!loading&&<span>{discoverable.length}</span>}</button>)}</div><span className="contest-filter-hint"><SlidersHorizontal className="size-3.5"/>최신 등록순</span></div>
   {loading?<div className="contest-discovery-grid" role="status" aria-label="대회 불러오는 중">{[0,1,2].map(i=><div key={i} className="contest-card-skeleton"><div/><span/><span/><span/></div>)}</div>:error?<div role="alert" className="contest-empty-state"><Trophy/><h3>잠시 연결이 끊겼어요.</h3><p>{error}</p><Button onClick={()=>void load()} variant="outline">다시 불러오기</Button></div>:!visible.length?<EmptyState kind="competition" title={query?'아직 맞는 도전이 없네요.':filter==='mine'?'첫 번째 대회를 열어 보세요.':'새로운 도전을 준비하고 있어요.'} description={query?'다른 검색어를 입력하거나 필터를 바꿔 보세요.':'다른 필터에서 새로운 가능성을 찾아보세요.'} action={<Button variant="outline" onClick={()=>{setFilter('all');setQuery('');}}>전체 대회 보기</Button>}/>:<div className="contest-discovery-grid">{visible.map((contest,index)=>{
    const phase=contestRegistrationPhase(contest,now);return <motion.div key={contest.id} className="contest-card-motion" layout={!reduced} initial={{opacity:0,y:reduced?0:18}} animate={{opacity:1,y:0}} transition={reduced?{duration:0}:{type:'spring',stiffness:250,damping:26,delay:Math.min(index,5)*.055}} whileHover={reduced?undefined:{y:-5}}><Link href={`/contests/${contest.id}`} onClick={event=>transition?.(contest,event)} className="contest-discovery-card" style={{'--contest-order':Math.min(index,5)} as CSSProperties}>
     <div className="contest-card-visual"><ContestArtwork id={contest.id} banner={contest.banner_path}/><span className="contest-card-type">{contest.participation_mode==='team'?<Users className="size-3.5"/>:<Trophy className="size-3.5"/>}{contest.participation_mode==='team'?'팀 챌린지':'개인 챌린지'}</span><span className="contest-card-open-icon"><ArrowUpRight className="size-5"/></span></div>
     <div className="contest-card-content"><div className="contest-card-topline"><span className="contest-status" data-closed={phase==='closed'}><span className="contest-status-dot"/>{phase==='checking'?'일정 확인 중':phase==='open'?'지금 접수 중':phase==='pending'?'곧 시작해요':'접수 마감'}</span>{contest.host_id===user?.id&&<span className="contest-owned-label">내가 연 대회</span>}</div><h3>{contest.title}</h3><p className="contest-card-description">{contestDescriptionSummary(contest.description)||'아이디어를 작품으로. 이번 도전의 주인공이 되어 보세요.'}</p><div className="contest-card-meta"><span><CalendarDays className="size-3.5"/>{contest.event_start_at?formatContestDate(contest.event_start_at):formatContestDate(contest.registration_closes_at||contest.ends_at)}</span><span><MapPin className="size-3.5"/>{contest.location_type==='online'?'온라인':contest.location_name||'장소 추후 안내'}</span></div><footer><div className="contest-card-host"><ContestLogo path={contest.logo_path} title={contest.title}/><span>CBGPU CHALLENGE</span></div><span className="contest-card-cta">{contest.host_id===user?.id?'대회 관리':'자세히 보기'}<ArrowRight className="size-4"/></span></footer></div>
    </Link></motion.div>;
   })}</div>}
  </section>
  <aside className="contest-host-callout"><span className="contest-callout-icon"><Sparkles/></span><div><h2>함께 해보고 싶은 아이디어가 있나요?</h2><p>나만의 대회를 열고, 새로운 팀과 참가자들을 만나보세요.</p></div><Button variant="outline" asChild><Link href="/contests/new">대회 만들기<ArrowUpRight className="size-4"/></Link></Button></aside>
 </div>;
}
