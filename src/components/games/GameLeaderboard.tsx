'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Trophy,School,Globe,RefreshCw,Share2,LockKeyhole} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Dropdown} from '@/components/ui/dropdown';
import {SegmentedTabs} from '@/components/ui/segmented-tabs';
import {AuthFlowLink} from '@/components/auth/AuthFlowLink';
import {useAuth} from '@/lib/useAuth';
import {useSchoolScope} from '@/components/schools/SchoolScope';
import {supabase} from '@/lib/supabase';

type Player={display_name:string;participating:boolean};
type Board={ownBest:number|null;ownRank:number|null;entries:{rank:number;displayName:string;score:number}[];schoolName:string|null};
export type ArcadeGame='2048'|'memory'|'mines'|'snake'|'tetris'|'flappy';
async function request<T>(path:string,method='GET',body?:unknown):Promise<T>{
 const{data}=await supabase.auth.getSession();
 const response=await fetch('/api/arcade/'+path,{method,headers:{...(data.session?{Authorization:'Bearer '+data.session.access_token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});
 const result=await response.json().catch(()=>({error:'응답을 확인하지 못했어요.'}));
 if(!response.ok)throw new Error(result.error||'랭킹을 불러오지 못했어요.');
 return result as T;
}
const formatScore=(game:ArcadeGame,score:number)=>game==='memory'?`${1_000_000-score}번 시도`:game==='mines'?`${1_000_000-score}번 조작`:score.toLocaleString()+'점';

function LeaderboardSession({game,ranked,setRanked,revision,supported}:{game:ArcadeGame;ranked:boolean;setRanked:(value:boolean)=>void;revision:number;supported:boolean}){
 const{user}=useAuth(),school=useSchoolScope();
 const[scope,setScope]=useState('national'),[period,setPeriod]=useState('week'),[pairs,setPairs]=useState('6'),[level,setLevel]=useState('easy');
 const[dataBoard,setBoard]=useState<Board|null>(null),[boardKey,setBoardKey]=useState(''),[player,setPlayer]=useState<Player|null>(null),[name,setName]=useState(''),[participating,setParticipating]=useState(false),[loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const generation=useRef(0),mounted=useRef(false),best=useRef(new Map<string,{score:number|null;revision:number}>());const userId=user?.id,schoolId=school.school?.id;const currentKey=[userId,game,period,scope,pairs,level,schoolId,revision].join(':');const board=boardKey===currentKey?dataBoard:null;useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[]);
 useEffect(()=>{if(!userId)return;let active=true;void request<Player>('player').then(value=>{if(active){setPlayer(value);setName(value.display_name);setParticipating(value.participating)}}).catch(()=>{});return()=>{active=false}},[userId]);
 useEffect(()=>{const update=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail?.game!==game)return;if(detail.params?.pairs)setPairs(String(detail.params.pairs));if(detail.params?.level)setLevel(detail.params.level)};window.addEventListener('cbgpu-arcade-variant',update);return()=>window.removeEventListener('cbgpu-arcade-variant',update)},[game]);
 const refresh=useCallback(async()=>{
  const sequence=++generation.current;setError('');setBoard(null);
  if(!supported){setLoading(false);return}
  if(scope==='school'&&(!userId||school.status!=='ready')){setLoading(false);return}
  setLoading(true);
  const query=new URLSearchParams({game,period,scope,...(game==='memory'?{pairs}:{}),...(game==='mines'?{level}:{}),...(scope==='school'&&schoolId?{school_id:schoolId}:{})});
  try{const value=await request<Board>('leaderboard?'+query);if(sequence===generation.current){const key=[userId,game,period,scope,pairs,level,schoolId].join(':');const previous=best.current.get(key);if(previous&&revision>previous.revision&&value.ownBest!=null&&(previous.score==null||value.ownBest>previous.score))setNotice('🎉 이 기간의 내 최고 기록을 경신했어요!');best.current.set(key,{score:value.ownBest,revision});setBoardKey(currentKey);setBoard(value)}}catch(e){if(sequence===generation.current)setError(e instanceof Error?e.message:'랭킹을 불러오지 못했어요.')}finally{if(sequence===generation.current)setLoading(false)}
 },[game,period,scope,pairs,level,userId,school.status,schoolId,supported,revision,currentKey]);
 useEffect(()=>{let active=true;const fence=generation;const task=setTimeout(()=>{if(active)void refresh()},0);return()=>{active=false;clearTimeout(task);fence.current++}},[refresh]);
 async function save(){if(saving)return;setSaving(true);setError('');setNotice('');try{const p=await request<Player>('player','PUT',{display_name:name.trim(),participating});if(!mounted.current)return;setPlayer(p);setNotice(p.participating?'이제 닉네임으로 랭킹에 참여해요.':'기록은 나만 볼 수 있어요.');await refresh()}catch(e){setError(e instanceof Error?e.message:'설정을 저장하지 못했어요.')}finally{setSaving(false)}}
 async function share(){if(board?.ownBest==null)return;const text=`CBGPU ${game} ${period==='week'?'이번 주':period==='month'?'이번 달':'전체'} 내 최고 기록: ${formatScore(game,board.ownBest)}. 한 판 도전해 볼래?`;const url=window.location.origin+'/games?game='+encodeURIComponent(game);try{if(navigator.share)await navigator.share({text,url});else{await navigator.clipboard.writeText(text+' '+url);setNotice('기록과 게임 링크를 복사했어요.')}}catch{setNotice('공유를 마치지 않았어요. 기록은 그대로예요.')}}
 return <aside id="arcade-ranking" className="arcade-ranking" aria-labelledby="arcade-ranking-title">
  <header className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Trophy size={22} aria-hidden/><h2 id="arcade-ranking-title" className="text-xl font-semibold">기록과 랭킹</h2></div><Button variant="ghost" size="icon" aria-label="랭킹 새로고침" onClick={()=>void refresh()} disabled={loading}><RefreshCw size={18} className={loading?'animate-spin':''}/></Button></header>
  {!supported?<p role="status" className="text-sm text-muted-foreground">이 게임은 일반 모드로 즐길 수 있어요. 기록 검증을 준비하고 있어요.</p>:<>
   <SegmentedTabs label="랭킹 범위" appearance="neutral" value={scope} onChange={setScope} items={[{value:'national',label:<span className="flex items-center gap-2"><Globe size={16}/>전국</span>},{value:'school',label:<span className="flex items-center gap-2"><School size={16}/>우리 학교</span>}]}/>
   <div className="flex flex-wrap items-center gap-3"><SegmentedTabs label="랭킹 기간" appearance="neutral" value={period} onChange={setPeriod} items={[{value:'week',label:'이번 주'},{value:'month',label:'이번 달'},{value:'all',label:'전체'}]}/>{game==='memory'&&<Dropdown aria-label="랭킹 카드 쌍 수" value={pairs} onChange={e=>setPairs(e.target.value)}><option value="6">6쌍</option><option value="8">8쌍</option><option value="12">12쌍</option></Dropdown>}{game==='mines'&&<Dropdown aria-label="랭킹 난이도" value={level} onChange={e=>setLevel(e.target.value)}><option value="easy">쉬움</option><option value="medium">보통</option><option value="hard">어려움</option></Dropdown>}</div>
   {scope==='school'&&school.status!=='ready'?<p role="status" className="text-sm text-muted-foreground">인증된 학교 소속을 확인하면 우리 학교 랭킹을 볼 수 있어요. 학교를 선택한 뒤 다시 확인해 주세요.</p>:<>
    {board?.schoolName&&<p className="text-sm text-muted-foreground">{board.schoolName}</p>}
    {loading?<p role="status" className="text-sm text-muted-foreground">기록을 불러오는 중…</p>:board&&<>
     <div className="arcade-own-record"><div><span>{period==='week'?'이번 주 내 최고':period==='month'?'이번 달 내 최고':'내 최고 기록'}</span><strong>{board.ownBest==null?'첫 기록을 남겨봐요':formatScore(game,board.ownBest)}</strong><small>{board.ownRank==null?player?.participating?'이 기간의 순위가 아직 없어요':'비공개 기록은 나만 볼 수 있어요':`${board.ownRank}위`}</small></div>{board.ownBest!=null&&<Button variant="outline" size="icon" aria-label="내 기록 공유" onClick={()=>void share()}><Share2 size={18}/></Button>}</div>
     {board.entries.length===0?<div className="arcade-empty"><Trophy size={30} aria-hidden/><p>아직 기록이 없어요.</p><span>이번 순위표의 첫 주인공이 되어 봐요.</span></div>:<ol className="arcade-rank-list" aria-label="순위표">{board.entries.map((entry,index)=><li key={entry.rank+':'+index}><span className="arcade-rank-number">{entry.rank<=3?'🏅':entry.rank}<span className="sr-only">{entry.rank<=3?entry.rank+'위':''}</span></span><span className="min-w-0 flex-1 truncate">{entry.displayName}</span><strong>{formatScore(game,entry.score)}</strong></li>)}</ol>}
    </>}
   </>}
   <div className="arcade-record-settings">
    {user?<><Button variant={ranked?'secondary':'default'} className="w-full" onClick={()=>setRanked(!ranked)}>{ranked?'일반 모드로 돌아가기':'기록 모드 켜기'}</Button><p className="text-sm text-muted-foreground">모드를 바꾸면 새 게임으로 시작해요. 서버가 플레이 기록을 확인한 뒤 저장해요.</p><details><summary className="min-h-11 cursor-pointer font-medium">닉네임과 공개 설정</summary><div className="mt-3 space-y-3"><label className="block text-sm" htmlFor="arcade-name">랭킹 닉네임</label><Input id="arcade-name" value={name} onChange={e=>setName(e.target.value)} minLength={2} maxLength={24} aria-describedby="arcade-name-help" placeholder="공개할 닉네임"/><p id="arcade-name-help" className="text-sm text-muted-foreground">2~24자의 한글·영문·숫자·공백·밑줄·하이픈을 사용할 수 있어요.</p><label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={participating} onChange={e=>setParticipating(e.target.checked)}/>닉네임으로 순위표에 참여하기</label><p className="text-sm text-muted-foreground">이메일·학번은 공개하지 않아요. 실명 대신 별명을 추천해요. 참여를 끄면 순위표에서 빠지고 내 기록은 유지돼요.</p><Button variant="outline" onClick={()=>void save()} disabled={saving||Array.from(name.trim()).length<2||Array.from(name.trim()).length>24||!/^[-_\p{L}\p{N} ]+$/u.test(name.trim())}>{saving?'저장 중…':'설정 저장'}</Button></div></details></>:<><p className="flex items-center gap-2 text-sm"><LockKeyhole size={16}/>로그인하면 내 기록을 저장할 수 있어요.</p><Button asChild><AuthFlowLink href="/auth/login?next=%2Fgames">로그인하고 기록 남기기</AuthFlowLink></Button></>}
   </div>
  </>}
  {error&&<div role="alert" className="text-sm text-destructive"><p>{error}</p><Button variant="ghost" onClick={()=>void refresh()}>다시 불러오기</Button></div>}{notice&&<p role="status" className="text-sm text-muted-foreground">{notice}</p>}
 </aside>;
}

export default function GameLeaderboard(props:{game:ArcadeGame;ranked:boolean;setRanked:(value:boolean)=>void;revision:number;supported:boolean}){const{user}=useAuth();return <LeaderboardSession key={user?.id||'anonymous'} {...props}/>;}
