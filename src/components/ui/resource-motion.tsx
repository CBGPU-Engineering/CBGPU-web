'use client';
import {useId,type ReactNode} from 'react';
import {AnimatePresence,LayoutGroup,motion,useReducedMotion} from 'motion/react';
import {productSpring,settleEase} from '@/lib/motion';
import './resource-motion.css';

/** Changes only when a real selection changes; polling does not replay it. */
export function ResourceSelection({label,value,items,onChange,disabled=false,scrollable=false}:{label:string;value:string;items:{value:string;label:ReactNode}[];onChange:(value:string)=>void;disabled?:boolean;scrollable?:boolean}){
 const id=useId(),reduce=useReducedMotion();
 return <LayoutGroup id={id}><div className={'cb-resource-selection'+(scrollable?' is-scrollable':'')} role="radiogroup" aria-label={label} style={{gridTemplateColumns:`repeat(${items.length},minmax(${scrollable?'max-content':'0'},1fr))`}}>{items.map((item,index)=><motion.button key={item.value} type="button" role="radio" aria-checked={value===item.value} disabled={disabled} tabIndex={value===item.value||(!items.some(item=>item.value===value)&&index===0)?0:-1} onClick={()=>onChange(item.value)} whileTap={reduce?undefined:{scale:.975}} transition={productSpring} onKeyDown={event=>{let next:number|undefined;if(event.key==='ArrowRight'||event.key==='ArrowDown')next=(index+1)%items.length;if(event.key==='ArrowLeft'||event.key==='ArrowUp')next=(index+items.length-1)%items.length;if(event.key==='Home')next=0;if(event.key==='End')next=items.length-1;if(next!==undefined){event.preventDefault();const target=event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button')[next];target?.focus();onChange(items[next].value);}}}>{value===item.value&&<motion.span aria-hidden="true" className="cb-resource-selection-active" layoutId={reduce?undefined:'selected'} transition={reduce?{duration:0}:productSpring}/>}<span>{item.label}</span></motion.button>)}</div></LayoutGroup>;
}
export function ResourcePanel({value,children,className}:{value:string|number;children:ReactNode;className?:string}){
 const reduce=useReducedMotion();return <AnimatePresence initial={false} mode="wait"><motion.div key={value} className={className} initial={reduce?false:{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:reduce?0:-3,pointerEvents:'none'}} transition={{duration:reduce?0:.16,ease:settleEase}}>{children}</motion.div></AnimatePresence>;
}
/** Never animates numeric utilization or invents a running/healthy state. */
export function ResourceStatus({value,children,className,announce=false}:{value:string;children:ReactNode;className?:string;announce?:boolean}){
 const reduce=useReducedMotion();return <span className={className} aria-live={announce?'polite':undefined} aria-atomic={announce?true:undefined}><AnimatePresence initial={false} mode="wait"><motion.span className="cb-resource-status-content" key={value} initial={reduce?false:{opacity:0,y:3}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:reduce?0:.12}}>{children}</motion.span></AnimatePresence></span>;
}
