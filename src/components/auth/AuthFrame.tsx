'use client';
import CBGPULogo from '@/components/CBGPULogo';
import type {ReactNode} from 'react';
import Link from 'next/link';
import {ArrowLeft,ArrowRight,BookOpen,GraduationCap,LoaderCircle,Sparkles} from 'lucide-react';
import {motion,useReducedMotion} from 'motion/react';
import {Button} from '@/components/ui/button';
import {settleEase} from '@/lib/motion';
import './auth.css';
export function AuthFrame({title,description,children,footer}:{title:string;description?:ReactNode;children:ReactNode;footer?:ReactNode}){
 const reduce=useReducedMotion();
 return <div className="cb-auth-layout"><aside className="cb-auth-story" aria-label="CBGPU 소개"><CBGPULogo  alt="" width={48} height={48}/><p className="cb-auth-wordmark">CBGPU</p><h2>하고 싶은 일에<br/>더 가까이.</h2><p>학교생활의 작은 일부터<br/>함께 만드는 프로젝트까지.</p><div className="cb-auth-story-list"><span><GraduationCap size={20} strokeWidth={1.7}/>자습·시간표·자료를 한곳에서</span><span><Sparkles size={20} strokeWidth={1.7}/>AI와 GPU로 아이디어를 실현하고</span><span><BookOpen size={20} strokeWidth={1.7}/>배우고 만든 것을 함께 나눠요</span></div><div className="cb-auth-orbit" aria-hidden="true"><svg viewBox="0 0 300 150" fill="none"><ellipse cx="150" cy="78" rx="124" ry="39" transform="rotate(-18 150 78)"/><ellipse cx="150" cy="78" rx="94" ry="53" transform="rotate(28 150 78)"/><circle cx="150" cy="78" r="23"/><circle cx="46" cy="98" r="7"/><circle cx="234" cy="46" r="5"/></svg></div></aside><motion.section className="cb-auth-panel" aria-labelledby="auth-heading" initial={false} animate={{opacity:1,y:0}} transition={{duration:reduce?0:.28,ease:settleEase}}><Link href="/" className="cb-auth-back"><ArrowLeft size={16} aria-hidden="true"/>홈으로</Link><header className="cb-auth-heading"><div className="cb-auth-identity"><span className="cb-auth-mobile-brand"><CBGPULogo  width={28} height={28} alt=""/>CBGPU</span></div><h1 id="auth-heading">{title}</h1>{description&&<p>{description}</p>}</header>{children}{footer&&<footer className="cb-auth-footer">{footer}</footer>}</motion.section></div>;
}
export function AuthSubmit({busy,children,busyLabel}:{busy:boolean;children:ReactNode;busyLabel:string}){
 return <Button type="submit" disabled={busy} aria-busy={busy} className="cb-auth-submit"><span className="cb-auth-submit-label">{busy?busyLabel:children}</span>{busy?<LoaderCircle className="animate-spin" size={19} aria-hidden="true"/>:<ArrowRight size={19} aria-hidden="true"/>}</Button>;
}
