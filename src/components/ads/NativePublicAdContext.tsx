'use client';
import {useEffect,useRef} from 'react';
import type {AdPlacement} from '@/lib/adPlacement';
import type {NativeBridge} from '@/lib/nativeBridge';
type Props={eligible:boolean;placement:AdPlacement;schoolAdsEnabled?:boolean;audience:'loading'|'anonymous'|'authenticated';route:string};
/** Optional Android-native surface only. This never injects a web SDK or a unit ID. */
export default function NativePublicAdContext(props:Props){
 const lease=useRef('');if(!lease.current)lease.current=crypto.randomUUID().replaceAll('-','');
 useEffect(()=>{
  const bridge:NativeBridge|undefined=window.CBGPUNative;if(!bridge?.setPublicAdContext)return;
  let active=true;const payload={lease:lease.current,placement:props.placement,contentReady:props.eligible,schoolAdsEnabled:props.schoolAdsEnabled===true,audience:props.audience};
  // The native transport adds the current URL and its native document/route nonce.
  // No account, school ID, or web advertising ID is passed. The local URL is
  // checked only by the native gate and is never an SDK/request parameter.
  void Promise.resolve().then(()=>active?bridge.setPublicAdContext?.(payload):undefined).catch(()=>{});
  return()=>{active=false;void bridge.setPublicAdContext?.({...payload,contentReady:false}).catch(()=>{})};
 },[props.eligible,props.placement,props.schoolAdsEnabled,props.audience,props.route]);
 return null;
}
