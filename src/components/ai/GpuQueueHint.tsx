'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Sparkles} from 'lucide-react';
import {aiRequest} from '@/lib/aiClient';
import {useAuth} from '@/lib/useAuth';
export default function GpuQueueHint(){const {user}=useAuth();const [gpu,setGpu]=useState<number|null>(null);useEffect(()=>{let cancelled=false;setGpu(null);if(!user)return;const load=async()=>{try{const data=await aiRequest('/status');if(!cancelled)setGpu(data.scheduler.active_gpu||null)}catch{}};void load();const timer=setInterval(()=>{if(document.visibilityState==='visible')void load()},30000);return()=>{cancelled=true;clearInterval(timer)}},[user?.id]);return <div className="my-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/15 bg-primary/[.03] p-3 text-sm"><p className="flex items-start gap-2 text-muted-foreground"><Sparkles className="mt-0.5 size-4 shrink-0 text-primary"/>{gpu?`GPU ${gpu}에서 공용 AI 작업을 처리하고 있어요. 예약 사용이 항상 우선이에요.`:'GPU를 직접 예약하지 않고도, 빈 GPU에 Python 작업을 맡길 수 있어요.'}</p><Link href="/ai?tool=gpu" className="min-h-10 py-2 text-sm font-medium text-primary">GPU 작업 대기열 →</Link></div>}
