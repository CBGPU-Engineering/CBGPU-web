'use client';
import type {ReactNode} from 'react';
import {AnimatePresence,LayoutGroup,MotionConfig,motion,useReducedMotion} from 'motion/react';
import {OverlayProvider} from 'overlay-kit';
import {AlertCircle,CheckCircle2,Info,Search,Users,FolderOpen,Trophy,ShieldCheck} from 'lucide-react';
import {productSpring,settleEase} from '@/lib/motion';

export function ProductExperienceProvider({children}:{children:ReactNode}){
 return <MotionConfig reducedMotion="user" transition={productSpring}><LayoutGroup id="cbgpu-product"><OverlayProvider>{children}</OverlayProvider></LayoutGroup></MotionConfig>;
}
export function InlineFeedback({message,id,kind='error'}:{message:string;id?:string;kind?:'error'|'info'|'success'}){
 const reduce=useReducedMotion(),Icon=kind==='error'?AlertCircle:kind==='success'?CheckCircle2:Info;
 return <AnimatePresence initial={false}>{message&&<motion.div key={message} id={id} role={kind==='error'?'alert':'status'} initial={{opacity:0,y:reduce?0:5}} animate={{opacity:1,y:0}} exit={{opacity:0,y:reduce?0:-3}} transition={{duration:reduce?0:0.18}} className={'cb-inline-feedback cb-inline-feedback-'+kind}><Icon size={19} strokeWidth={1.8} aria-hidden="true"/><span>{message}</span></motion.div>}</AnimatePresence>;
}
/** Render only after a real server-confirmed accomplishment. No timers gate actions. */
export function SuccessFeedback({title,description,children,compact=false}:{title:string;description?:ReactNode;children?:ReactNode;compact?:boolean}){
 const reduce=useReducedMotion();
 return <motion.section role="status" aria-live="polite" className={'cb-success-feedback'+(compact?' is-compact':'')} initial={{opacity:0,y:reduce?0:12}} animate={{opacity:1,y:0}} transition={{duration:reduce?0:0.26,ease:settleEase}}>
  <div className="cb-success-stamp" aria-hidden="true"><motion.svg viewBox="0 0 80 80" initial={reduce?false:{scale:0.75,rotate:-12}} animate={{scale:1,rotate:0}} transition={productSpring}><circle cx="40" cy="40" r="34" fill="currentColor" opacity=".1"/><motion.circle cx="40" cy="40" r="25" fill="none" stroke="currentColor" strokeWidth="2" initial={reduce?false:{pathLength:0}} animate={{pathLength:1}} transition={{duration:reduce?0:0.45}}/><motion.path d="m28 40 8 8 16-17" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" initial={reduce?false:{pathLength:0}} animate={{pathLength:1}} transition={{duration:reduce?0:0.38,delay:reduce?0:0.12}}/></motion.svg><i/><i/><i/></div>
  <h2>{title}</h2>{description&&<div className="cb-success-description">{description}</div>}{children&&<div className="cb-success-actions">{children}</div>}
 </motion.section>;
}
/** Original lightweight SVG scene, paired with the existing Lucide icon family. */
export function EmptyStateIllustration({kind='search'}:{kind?:'search'|'team'|'project'|'competition'|'permission'}){
 const Icon=({search:Search,team:Users,project:FolderOpen,competition:Trophy,permission:ShieldCheck})[kind];
 return <div className={'cb-empty-art cb-empty-art-'+kind} aria-hidden="true"><svg viewBox="0 0 160 104" fill="none"><ellipse cx="80" cy="92" rx="52" ry="5" fill="currentColor" opacity=".07"/><rect x="32" y="22" width="96" height="62" rx="13" fill="var(--card)" stroke="currentColor" strokeOpacity=".2"/><path d="M46 38h23m-23 9h14m-14 9h19" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" strokeLinecap="round"/><circle cx="129" cy="23" r="7" fill="currentColor" opacity=".1"/><path d="M22 57h8m-4-4v8m110 9h7m-3.5-3.5v7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".45"/></svg><Icon size={32} strokeWidth={1.6}/></div>;
}
export function EmptyState({title,description,action,kind='search'}:{title:string;description:string;action?:ReactNode;kind?:'search'|'team'|'project'|'competition'|'permission'}){
 return <div className="cb-empty-state"><EmptyStateIllustration kind={kind}/><h3>{title}</h3><p>{description}</p>{action&&<div className="cb-empty-state-action">{action}</div>}</div>;
}
