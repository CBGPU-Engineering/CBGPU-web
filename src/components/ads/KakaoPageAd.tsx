'use client';
import {Suspense,useCallback,useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {usePathname,useSearchParams} from 'next/navigation';
import {useAuth} from '@/lib/useAuth';
import {adFitEligible,kakaoAdUnits,type AdPlacement} from '@/lib/adPlacement';
import './kakao-page-ad.css';
export type KakaoPageAdProps={placement:AdPlacement;contentReady:boolean;schoolAdsEnabled?:boolean};
const leases=new WeakMap<Document,symbol>();
const subscribeLocation=(update:()=>void)=>{window.addEventListener('hashchange',update);window.addEventListener('popstate',update);return()=>{window.removeEventListener('hashchange',update);window.removeEventListener('popstate',update)}};
const locationSnapshot=()=>window.location.hostname+'|'+window.location.hash;
/** One supplied unit for a confirmed public page; never refreshes on a timer or data poll. */
export default function KakaoPageAd(props:KakaoPageAdProps){return <Suspense fallback={null}><PublicAd {...props}/></Suspense>}
function PublicAd(props:KakaoPageAdProps){
 const {user,isLoading}=useAuth(),path=usePathname(),search=useSearchParams().toString();
 const browser=useSyncExternalStore(subscribeLocation,locationSnapshot,()=>'');
 const [hostname,hash]=browser.split('|');
 if(!adFitEligible({...props,hostname:hostname||'',path,search,hash,audience:isLoading?'loading':user?'authenticated':'anonymous'}))return null;
 return <AdUnit key={path+'?'+search}/>;
}
function AdUnit(){
 const host=useRef<HTMLElement|null>(null),slot=useRef<HTMLDivElement|null>(null),format=useRef<keyof typeof kakaoAdUnits|null>(null),attempted=useRef(false);
 const [mode,setMode]=useState<keyof typeof kakaoAdUnits|null>(null),[fits,setFits]=useState(false);
 const measure=useCallback((element:HTMLElement|null)=>{host.current=element;if(!element)return;const width=element.getBoundingClientRect().width;if(width<320)return;const initial=width>=728?'desktop':'mobile';format.current=initial;setMode(initial);setFits(true)},[]);
 useEffect(()=>{const element=host.current;if(!element)return;const observer=new ResizeObserver(()=>{const width=element.getBoundingClientRect().width;if(!format.current&&width>=320){format.current=width>=728?'desktop':'mobile';setMode(format.current)}setFits(!!format.current&&width>=kakaoAdUnits[format.current].width)});observer.observe(element);return()=>observer.disconnect()},[]);
 useEffect(()=>{
  const target=slot.current;if(!mode||!fits||!target||attempted.current||leases.has(document))return;
  attempted.current=true;
  const lease=Symbol('public-ad');leases.set(document,lease);
  const unit=kakaoAdUnits[mode],ins=document.createElement('ins'),script=document.createElement('script');
  ins.className='kakao_ad_area';ins.style.display='none';ins.dataset.adUnit=unit.id;ins.dataset.adWidth=String(unit.width);ins.dataset.adHeight=String(unit.height);
  script.type='text/javascript';script.src='https://t1.kakaocdn.net/kas/static/ba.min.js';script.async=true;script.referrerPolicy='no-referrer';
  target.append(ins,script);
  return()=>{target.replaceChildren();if(leases.get(document)===lease)leases.delete(document)};
 },[mode,fits]);
 return <aside ref={measure} className="cb-kakao-page-ad" aria-label="광고" data-ad-placement="public" style={{visibility:mode&&fits?'visible':'hidden'}}><span className="cb-kakao-ad-label">광고</span><div ref={slot} className="cb-kakao-ad-slot" data-ad-format={mode||'pending'}/></aside>;
}
