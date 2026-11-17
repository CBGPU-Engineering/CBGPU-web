'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import type {AdPlacement} from '@/lib/adPlacement';
import type {NativeBridge} from '@/lib/nativeBridge';
import {adDocumentHasRun} from '@/lib/adDocumentBoundary';
type Props={eligible:boolean;placement:AdPlacement;schoolAdsEnabled?:boolean;audience:'loading'|'anonymous'|'authenticated';route:string;fallback?:ReactNode};
/** A document chooses native OR existing web, never promotes a running web SDK to native. */
export default function NativePublicAdContext(props:Props){
 const lease=useRef('');if(!lease.current)lease.current=crypto.randomUUID().replaceAll('-','');
 const selected=useRef<'pending'|'native'|'legacy'>('pending'),[mode,setMode]=useState<'pending'|'native'|'legacy'>('pending'),[revision,setRevision]=useState(0);
 useEffect(()=>{const update=()=>setRevision(value=>value+1);window.addEventListener('cbgpu-native-ready',update);window.addEventListener('cbgpu-native-ad-context-changed',update);return()=>{window.removeEventListener('cbgpu-native-ready',update);window.removeEventListener('cbgpu-native-ad-context-changed',update)}},[]);
 useEffect(()=>{
  if(selected.current==='legacy')return;
  const bridge:NativeBridge|undefined=window.CBGPUNative;
  // Loading Auth is not proof of a missing app capability; let restoration settle first.
  if(!bridge?.setPublicAdContext){if(props.audience!=='loading'){selected.current='legacy';setMode('legacy')}return}
  if(adDocumentHasRun()){selected.current='legacy';setMode('legacy');return}
  let active=true;const payload={lease:lease.current,placement:props.placement,contentReady:props.eligible,schoolAdsEnabled:props.schoolAdsEnabled===true,audience:props.audience};
  void Promise.resolve().then(()=>active?bridge.setPublicAdContext?.(payload):undefined).then(result=>{
   if(!active||!result)return;
   // Only an explicit unavailable result authorizes fallback; errors/unknown stay exclusive.
   if(result.configured===false){selected.current='legacy';setMode('legacy')}
   else if(result.configured===true){selected.current='native';setMode('native')}
  }).catch(()=>{});
  return()=>{active=false;void bridge.setPublicAdContext?.({...payload,contentReady:false}).catch(()=>{})};
 },[props.eligible,props.placement,props.schoolAdsEnabled,props.audience,props.route,revision]);
 return mode==='legacy'?props.fallback??null:null;
}
