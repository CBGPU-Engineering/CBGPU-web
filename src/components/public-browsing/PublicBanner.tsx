'use client';
import{useState}from'react';
import CBGPULogo from'@/components/CBGPULogo';
import{publicContestBannerPath}from'@/lib/publicContentModel';
export default function PublicBanner({id,src,title,detail=false}:{id:string;src:string;title:string;detail?:boolean}){
 const[failed,setFailed]=useState(false);
 if(failed||src!==publicContestBannerPath(id))return detail?null:<CBGPULogo width={28} height={28} alt=""/>;
 return <div className={'cb-public-banner'+(detail?' cb-public-banner-detail':'')}><img src={src} alt={title+' 배너'} width={1200} height={675} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/></div>;
}
