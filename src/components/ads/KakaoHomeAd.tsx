'use client';

import {useEffect,useRef,useState} from 'react';
import './kakao-home-ad.css';

const units={desktop:{id:'DAN-kVpBmlPRbOvGb6oi',width:728,height:90},mobile:{id:'DAN-vpZNfcj3tj0jMkhV',width:320,height:50}} as const;

/** One provider-supplied unit per home visit; no refresh timer or account data. */
export default function KakaoHomeAd(){
 const host=useRef<HTMLElement>(null),slot=useRef<HTMLDivElement>(null);
 const[mode,setMode]=useState<keyof typeof units|null>(null);
 useEffect(()=>{
  if(!['cbgpu.com','www.cbgpu.com','student.cbgpu.com','researcher.cbgpu.com','developer.cbgpu.com','app.cbgpu.com'].includes(location.hostname))return;
  const element=host.current;if(!element)return;
  const update=()=>setMode(innerWidth<320?null:element.getBoundingClientRect().width>=728?'desktop':'mobile');
  const observer=new ResizeObserver(update);observer.observe(element);window.addEventListener('resize',update);update();
  return()=>{observer.disconnect();window.removeEventListener('resize',update)};
 },[]);
 useEffect(()=>{
  if(!mode||!slot.current)return;
  const script=document.createElement('script');script.type='text/javascript';script.src='https://t1.kakaocdn.net/kas/static/ba.min.js';script.async=true;
  slot.current.appendChild(script);
  return()=>script.remove();
 },[mode]);
 const unit=mode?units[mode]:null;
 return <aside ref={host} className="cb-kakao-home-ad" aria-label="광고"><span className="cb-kakao-ad-label">광고</span><div ref={slot} key={mode} className="cb-kakao-ad-slot" data-ad-format={mode??'pending'}>{unit&&<ins className="kakao_ad_area" style={{display:'none'}} data-ad-unit={unit.id} data-ad-width={unit.width} data-ad-height={unit.height}/>}</div></aside>;
}
