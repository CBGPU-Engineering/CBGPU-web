'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {AuthFrame} from '@/components/auth/AuthFrame';
import {supabase} from '@/lib/supabase';
import {safeWorkspacePath} from '@/lib/workspaces';
export default function Transfer(){const started=useRef(false),[error,setError]=useState('');useEffect(()=>{if(started.current)return;started.current=true;const params=new URLSearchParams(location.search),code=params.get('code'),next=safeWorkspacePath(params.get('next')||'/');history.replaceState(null,'','/auth/transfer');void(async()=>{try{const r=await fetch('/api/workspaces/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'consume',code})});if(!r.ok)throw Error('로그인 연결을 확인하지 못했어요. 이 작업 공간에서 다시 로그인해 주세요.');const session=await r.json();const {error}=await supabase.auth.setSession(session);if(error)throw error;location.replace(next)}catch{setError('로그인 연결을 확인하지 못했어요. 이 작업 공간에서 다시 로그인해 주세요.')}})()},[]);return <AuthFrame title={error?'다시 로그인해 주세요':'작업 공간에 연결하고 있어요'}><p role="status" className="mt-4 text-muted-foreground">{error||'로그인한 계정으로 작업 공간을 열고 있어요.'}</p>{error&&<Link href="/auth/login" className="cb-auth-link mt-6">로그인하기</Link>}</AuthFrame>}
