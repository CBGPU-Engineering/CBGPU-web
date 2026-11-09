'use client';

import {useEffect,useRef,useState} from 'react';
import {Check,Minus,Plus,Search} from 'lucide-react';
import type {Seat,Obstacle} from '@/lib/eduset';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {SegmentedTabs} from '@/components/ui/segmented-tabs';

export type StudySeatItem={seat:Seat;available:boolean;pending?:boolean;detail?:string};

/** Both lookup and application use the same spatial layout and status vocabulary. */
export default function StudySeatBrowser({items,obstacles=[],width=1,height=1,selectedId,onSelect,selectOccupied=false,disabled=false}:{
 items:StudySeatItem[];obstacles?:Obstacle[];width?:number;height?:number;selectedId:string;onSelect:(seat:Seat)=>void;selectOccupied?:boolean;disabled?:boolean;
}){
 const [view,setView]=useState('map'),[onlyFree,setOnlyFree]=useState(false),[query,setQuery]=useState(''),[zoom,setZoom]=useState(1),[containerWidth,setContainerWidth]=useState(320);
 const container=useRef<HTMLDivElement>(null);
 const columns=Math.max(1,width,...items.map(({seat})=>seat.x+1),...obstacles.map(o=>o.x+o.w));
 const rows=Math.max(1,height,...items.map(({seat})=>seat.y+1),...obstacles.map(o=>o.y+o.h));
 useEffect(()=>{const el=container.current;if(!el)return;const resize=()=>setContainerWidth(el.clientWidth);resize();const observer=new ResizeObserver(resize);observer.observe(el);return()=>observer.disconnect()},[view]);
 const cell=Math.round(Math.max(52,Math.min(88,(containerWidth-24)/columns))*zoom);
 const visible=items.filter(item=>(!onlyFree||item.available)&&`${item.seat.name} ${item.detail||''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
 const free=items.filter(item=>item.available).length;
 const status=(item:StudySeatItem)=>item.available?'빈자리':item.pending?'승인 대기':'신청됨';
 const colors=(item:StudySeatItem)=>String(item.seat.id)===selectedId?'border-primary bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background':item.available?'border-emerald-500/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300':item.pending?'border-dashed border-amber-500/60 bg-amber-500/10 text-amber-800 dark:text-amber-300':'border-border bg-muted text-muted-foreground';
 return <div className="min-w-0 space-y-3" data-study-seat-browser>
  <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm"><strong className="text-emerald-700 dark:text-emerald-400">빈자리 {free}석</strong><span className="text-muted-foreground"> / 전체 {items.length}석</span></p><SegmentedTabs label="좌석 표시 방법" appearance="neutral" value={view} onChange={setView} items={[{value:'map',label:'배치도'},{value:'list',label:'목록'}]}/></div>
  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground" aria-label="좌석 상태 안내"><span className="flex items-center gap-1.5"><i className="size-3 rounded border border-emerald-500/50 bg-emerald-500/10"/>빈자리</span><span className="flex items-center gap-1.5"><i className="size-3 rounded border bg-muted"/>신청됨</span><span className="flex items-center gap-1.5"><i className="size-3 rounded bg-primary"/>선택한 자리</span><button type="button" aria-pressed={onlyFree} onClick={()=>setOnlyFree(v=>!v)} className={'ml-auto min-h-11 rounded-lg border px-3 font-medium '+(onlyFree?'border-primary text-primary bg-primary/10':'border-border')}>{onlyFree?'전체 자리 보기':'빈자리만 보기'}</button></div>
  {view==='map'?<>
   <div className="flex items-center justify-between gap-2"><p className="text-xs text-muted-foreground">스크롤로 이동</p><div className="flex shrink-0 items-center gap-1"><Button type="button" variant="outline" size="icon" className="size-11" aria-label="배치도 축소" disabled={zoom<=1} onClick={()=>setZoom(v=>Math.max(1,v-.25))}><Minus className="size-4"/></Button><Button type="button" variant="ghost" className="min-h-11 px-2 tabular-nums" aria-label="배치도 크기 초기화" onClick={()=>setZoom(1)}>{Math.round(zoom*100)}%</Button><Button type="button" variant="outline" size="icon" className="size-11" aria-label="배치도 확대" disabled={zoom>=2} onClick={()=>setZoom(v=>Math.min(2,v+.25))}><Plus className="size-4"/></Button></div></div>
   <div ref={container} role="region" tabIndex={0} aria-label="좌석 배치도, 스크롤 가능" className="max-h-[38dvh] min-h-36 w-full min-w-0 overflow-auto overscroll-contain rounded-2xl border bg-muted/30 p-3 focus-visible:outline-2 focus-visible:outline-ring"><div data-seat-canvas className="relative" style={{width:columns*cell,height:rows*cell}}>
    {obstacles.map(o=><div key={o.id} className="absolute flex items-center justify-center overflow-hidden rounded-md border border-dashed bg-background px-1 text-center text-xs text-muted-foreground" style={{left:o.x*cell,top:o.y*cell,width:o.w*cell-6,height:o.h*cell-6}}>{o.name}</div>)}
    {items.map(item=><button key={item.seat.id} type="button" aria-pressed={String(item.seat.id)===selectedId} aria-label={item.seat.name+'번 자리'+(item.available?'':' · '+status(item))} disabled={disabled||(!selectOccupied&&!item.available)} onClick={()=>onSelect(item.seat)} className={'absolute flex flex-col items-center justify-center overflow-hidden rounded-lg border-2 px-1 text-center focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 disabled:cursor-not-allowed '+colors(item)+((onlyFree&&!item.available)?' opacity-30':'')} style={{left:item.seat.x*cell,top:item.seat.y*cell,width:cell-6,height:cell-6}}><span className="flex items-center gap-1 text-sm font-semibold">{String(item.seat.id)===selectedId&&<Check className="size-3"/>}{item.seat.name}</span><span className="text-[10px] leading-4">{status(item)}</span></button>)}
   </div></div>
  </>:<>
   <div className="relative"><Search className="absolute left-3 top-3.5 size-4 text-muted-foreground"/><Input type="search" value={query} onChange={e=>setQuery(e.target.value)} aria-label="좌석 번호 또는 신청자 검색" placeholder="좌석 번호 또는 신청자 검색" className="min-h-11 pl-9"/></div>
   <div className="max-h-[38dvh] overflow-y-auto rounded-2xl border divide-y">{[...visible].sort((a,b)=>a.seat.name.localeCompare(b.seat.name,'ko',{numeric:true})).map(item=><button key={item.seat.id} type="button" disabled={disabled||(!selectOccupied&&!item.available)} aria-pressed={String(item.seat.id)===selectedId} onClick={()=>onSelect(item.seat)} className={'flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-ring '+(String(item.seat.id)===selectedId?'bg-primary/10':'enabled:hover:bg-muted/50')}><span className="min-w-12 font-semibold">{item.seat.name}번</span><span className="min-w-0 flex-1"><span className="block text-sm">{status(item)}</span>{item.detail&&<span className="block break-words text-xs text-muted-foreground">{item.detail}</span>}</span>{String(item.seat.id)===selectedId&&<Check className="size-4 text-primary"/>}</button>)}{!visible.length&&<p className="p-6 text-center text-sm text-muted-foreground">{onlyFree?'선택한 교시에 빈자리가 없어요.':'일치하는 좌석이 없어요.'}</p>}</div>
  </>}
 </div>;
}
