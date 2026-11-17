'use client';
import { createContext, useContext, useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react';
import {productSpring} from '@/lib/motion';
import type { Contest } from '@/lib/contests';
import { ContestArtwork } from './ContestArtwork';
const TransitionContext=createContext<((contest:Contest,event:MouseEvent<HTMLAnchorElement>)=>void)|null>(null);
type Flight={id:string;banner?:string|null;from:{left:number;top:number;width:number;height:number};to?:{left:number;top:number;width:number;height:number}};
export function ContestTransitionProvider({children}:{children:ReactNode}){
 const router=useRouter(),pathname=usePathname(),reduced=useReducedMotion();const [flight,setFlight]=useState<Flight|null>(null);const dismiss=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>()=>{if(dismiss.current)clearTimeout(dismiss.current);},[]);
 useEffect(()=>{
  if(!flight||flight.to)return;let frame=0,cancelled=false;const started=performance.now();
  const measure=()=>{if(cancelled)return;const target=document.querySelector<HTMLElement>(`[data-contest-detail-art="${CSS.escape(flight.id)}"]`);
   if(pathname===`/contests/${flight.id}`&&target){const box=target.getBoundingClientRect();if(box.width&&box.height){setFlight(current=>current?.id===flight.id?{...current,to:{left:box.left,top:box.top,width:box.width,height:box.height}}:current);dismiss.current=setTimeout(()=>setFlight(null),reduced?0:520);return;}}
   if(performance.now()-started>4500){setFlight(null);return;}frame=requestAnimationFrame(measure);
  };frame=requestAnimationFrame(measure);return()=>{cancelled=true;cancelAnimationFrame(frame);};
 },[pathname,flight,reduced]);
 const navigate=(contest:Contest,event:MouseEvent<HTMLAnchorElement>)=>{
  if(reduced||window.matchMedia('(prefers-reduced-motion: reduce)').matches||event.button!==0||event.metaKey||event.ctrlKey||event.altKey||event.shiftKey)return;
  const source=event.currentTarget.querySelector('.contest-card-visual');if(!source)return;
  const rect=source.getBoundingClientRect();event.preventDefault();if(dismiss.current)clearTimeout(dismiss.current);
  setFlight({id:contest.id,banner:contest.banner_path,from:{left:rect.left,top:rect.top,width:rect.width,height:rect.height}});router.push(`/contests/${contest.id}`);
 };
 return <LayoutGroup id="contest-product"><TransitionContext.Provider value={navigate}>{children}<AnimatePresence>{flight&&<motion.div key={flight.id} className="contest-shared-flight" initial={{...flight.from,opacity:1,borderRadius:18}} animate={{...(flight.to||flight.from),opacity:flight.to?1:.96,borderRadius:flight.to?22:18}} exit={{opacity:0,transition:{duration:.16}}} transition={{...productSpring,stiffness:270,damping:31,mass:.9}} aria-hidden="true"><ContestArtwork id={flight.id} banner={flight.banner}/></motion.div>}</AnimatePresence></TransitionContext.Provider></LayoutGroup>;
}
export function useContestTransition(){return useContext(TransitionContext);}
