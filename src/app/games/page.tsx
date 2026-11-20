'use client';

import {Suspense,useCallback,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {useAuth} from '@/lib/useAuth';
import Snake from '@/components/games/Snake';
import Tetris from '@/components/games/Tetris';
import Game2048 from '@/components/games/Game2048';
import FlappyBird from '@/components/games/FlappyBird';
import MemoryMatch from '@/components/games/MemoryMatch';
import Minesweeper from '@/components/games/Minesweeper';
import GameLeaderboard,{type ArcadeGame} from '@/components/games/GameLeaderboard';
import {SegmentedTabs} from '@/components/ui/segmented-tabs';
import {Gamepad2,Trophy} from 'lucide-react';
import './games.css';

const GAMES=[
 {id:'flappy',label:'플래피',emoji:'🐦',touch:true},
 {id:'memory',label:'카드 맞추기',emoji:'🧠',touch:true},
 {id:'mines',label:'지뢰찾기',emoji:'💣',touch:true},
 {id:'snake',label:'스네이크',emoji:'🐍',touch:false},
 {id:'tetris',label:'테트리스',emoji:'🟦',touch:false},
 {id:'2048',label:'2048',emoji:'🔢',touch:true},
] as const;
const SUPPORTED:ArcadeGame[]=['2048','memory','mines','snake','flappy','tetris'];
export default function GamesPage(){const{user}=useAuth();return <Suspense fallback={<section className="cb-page-content"><h1 className="cb-page-title">아케이드</h1><p role="status">게임을 불러오는 중…</p></section>}><GamesSession key={user?.id||'anonymous'}/></Suspense>}
function GamesSession(){
 const search=useSearchParams(),requested=search.get('game');
 const[active,setActive]=useState<ArcadeGame>(GAMES.some(g=>g.id===requested)?requested as ArcadeGame:'flappy'),[ranked,setRanked]=useState(false),[revision,setRevision]=useState(0),[saved,setSaved]=useState(false);
 const selected=GAMES.find(g=>g.id===active)!;
 const change=(value:string)=>{setRanked(false);setSaved(false);setActive(value as ArcadeGame)};
 const onRecord=useCallback(()=>{setRevision(v=>v+1);setSaved(true)},[]);
 const props={ranked,onRecord};
 return <section className="cb-page-content arcade-page">
  <header className="arcade-header"><div><p className="flex items-center gap-2 text-sm text-muted-foreground"><Gamepad2 size={18} aria-hidden/>잠깐 쉬어가는 한 판</p><h1 className="cb-page-title mt-2">아케이드</h1><p className="cb-page-sub mt-2">내 기록을 깨고, 친구들과 순위도 겨뤄봐요.</p></div><a href="#arcade-ranking" className="flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold"><Trophy size={18} aria-hidden/>랭킹 보기</a></header>
  <SegmentedTabs label="게임 선택" items={GAMES.map(g=>({value:g.id,label:<span className="flex items-center gap-2"><span aria-hidden>{g.emoji}</span>{g.label}</span>}))} value={active} onChange={change} appearance="neutral"/>
  <div className="arcade-columns"><div className="arcade-playfield"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">{selected.emoji} {selected.label}</h2><span className="text-sm text-muted-foreground">{ranked?'기록 모드':selected.touch?'터치로 플레이':'방향키로 플레이'}</span></div>
   <div key={active+':'+ranked} className="arcade-game">{active==='flappy'&&<FlappyBird {...props}/>}{active==='memory'&&<MemoryMatch {...props}/>} {active==='mines'&&<Minesweeper {...props}/>} {active==='snake'&&<Snake {...props}/>}{active==='tetris'&&<Tetris {...props}/>}{active==='2048'&&<Game2048 {...props}/>}</div>
   {saved&&<p role="status" className="arcade-saved">✨ 플레이 기록을 확인하고 저장했어요. 내 기록에서 확인해 보세요.</p>}
  </div><GameLeaderboard game={active} ranked={ranked} setRanked={setRanked} revision={revision} supported={SUPPORTED.includes(active)}/></div>
 </section>;
}
