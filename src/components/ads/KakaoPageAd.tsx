'use client';
import {Suspense,useCallback,useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {usePathname,useSearchParams} from 'next/navigation';
import {useAuth} from '@/lib/useAuth';
import {isNativeAppHint} from '@/lib/nativeBridge';
import {adFitEligible,kakaoAdUnits,type AdPlacement} from '@/lib/adPlacement';
import {adDocumentHasRun,adDocumentHasPersonalState,markAdDocument,installAdNavigationBoundary} from '@/lib/adDocumentBoundary';
import './kakao-page-ad.css';
export type KakaoPageAdProps={placement:AdPlacement;contentReady:boolean;schoolAdsEnabled?:boolean};
const leases=new WeakMap<Document,symbol>();
const subscribeLocation=(update:()=>void)=>{window.addEventListener('hashchange',update);window.addEventListener('popstate',update);window.addEventListener('cbgpu-native-ready',update);return()=>{window.removeEventListener('hashchange',update);window.removeEventListener('popstate',update);window.removeEventListener('cbgpu-native-ready',update)}};
const locationSnapshot=()=>window.location.hostname+'|'+window.location.hash+'|'+(isNativeAppHint()||/NativeAndroid|CBGPU\/|;\s*wv\)/i.test(navigator.userAgent)?'native':'web');
/** One supplied unit for a confirmed public page; never refreshes on a timer or data poll. */
export default function KakaoPageAd(props:KakaoPageAdProps){return <Suspense fallback={null}><PublicAd {...props}/></Suspense>}
function PublicAd(props:KakaoPageAdProps){
 const {user,isLoading}=useAuth(),path=usePathname(),search=useSearchParams().toString();
 const browser=useSyncExternalStore(subscribeLocation,locationSnapshot,()=>'');
 const [hostname,hash,client]=browser.split('|');
 if(adDocumentHasPersonalState()||!adFitEligible({...props,hostname:hostname||'',path,search,hash,nativeApp:client==='native',audience:isLoading?'loading':user?'authenticated':'anonymous'}))return null;
 return <AdUnit key={path+'?'+search}/>;
}
function AdUnit(){
 const host=useRef<HTMLElement|null>(null),slot=useRef<HTMLDivElement|null>(null),format=useRef<keyof typeof kakaoAdUnits|null>(null),attempted=useRef(false),intersecting=useRef(false),teardown=useRef<(()=>void)|null>(null);
 const [mode,setMode]=useState<keyof typeof kakaoAdUnits|null>(null),[fits,setFits]=useState(false),[unavailable,setUnavailable]=useState(false),[canStart,setCanStart]=useState(false);
 const measure=useCallback((element:HTMLElement|null)=>{host.current=element;if(!element)return;const width=element.getBoundingClientRect().width;if(width<320)return;const initial=width>=728?'desktop':'mobile';format.current=initial;setMode(initial);setFits(true)},[]);
 useEffect(()=>{const element=host.current;if(!element)return;const observer=new ResizeObserver(()=>{const width=element.getBoundingClientRect().width;if(!format.current&&width>=320){format.current=width>=728?'desktop':'mobile';setMode(format.current)}setFits(!!format.current&&width>=kakaoAdUnits[format.current].width)});observer.observe(element);return()=>observer.disconnect()},[]);
 useEffect(()=>{
  const element=host.current;if(!element)return;
  const activate=()=>{if(!attempted.current)setCanStart(intersecting.current&&document.visibilityState==='visible')};
  // Only defer the first request. Never drive provider refreshes from visibility events.
  const observer=new IntersectionObserver(entries=>{intersecting.current=entries.some(entry=>entry.isIntersecting&&entry.intersectionRatio>0);activate()},{threshold:0});
  observer.observe(element);document.addEventListener('visibilitychange',activate);
  return()=>{observer.disconnect();document.removeEventListener('visibilitychange',activate)};
 },[]);
 // Fit changes hide the original unit; they must never tear it down or request another.
 useEffect(()=>()=>{teardown.current?.();teardown.current=null},[]);
 useEffect(()=>{
  const target=slot.current;if(!mode||!fits||!canStart||!target||attempted.current||adDocumentHasRun()||leases.has(document))return;
  const element=host.current;if(!element||!intersecting.current||document.visibilityState!=='visible')return;
  const rect=element.getBoundingClientRect();if(rect.width<kakaoAdUnits[mode].width||rect.height<=0||rect.bottom<=0||rect.right<=0||rect.top>=innerHeight||rect.left>=innerWidth||getComputedStyle(element).visibility!=='visible')return;
  attempted.current=true;
  const lease=Symbol('public-ad');leases.set(document,lease);
  const unit=kakaoAdUnits[mode],ins=document.createElement('ins'),script=document.createElement('script');
  // AdFit's documented no-fill callback is not an impression or revenue event.
  // A failed request never causes a retry, a timer, or a second SDK insertion.
  const callbackName='cbgpuAdFitNoFill'+crypto.randomUUID().replaceAll('-','');
  const callbacks=window as unknown as Record<string,unknown>;
  const noFill=(element:HTMLElement)=>{if(element===ins)setUnavailable(true)};
  callbacks[callbackName]=noFill;
  ins.className='kakao_ad_area';ins.style.display='none';ins.dataset.adUnit=unit.id;ins.dataset.adWidth=String(unit.width);ins.dataset.adHeight=String(unit.height);
  ins.dataset.adOnfail=callbackName;
  script.type='text/javascript';script.src='https://t1.kakaocdn.net/kas/static/ba.min.js';script.async=true;script.referrerPolicy='no-referrer';
  script.onerror=()=>setUnavailable(true);
  markAdDocument(document);installAdNavigationBoundary(document);
  target.append(ins,script);
  teardown.current=()=>{script.onerror=null;if(callbacks[callbackName]===noFill)delete callbacks[callbackName];target.replaceChildren();if(leases.get(document)===lease)leases.delete(document)};
 },[mode,fits,canStart]);
 return <aside ref={measure} className="cb-kakao-page-ad" aria-label="광고" data-ad-placement="public" data-ad-unavailable={unavailable||undefined} style={{visibility:mode&&fits?'visible':'hidden'}}><span className="cb-kakao-ad-label">광고</span><div ref={slot} className="cb-kakao-ad-slot" data-ad-format={mode||'pending'}/></aside>;
}
