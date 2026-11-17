'use client';
import Image from 'next/image';
import { useState } from 'react';
import { contestImageUrl } from '@/lib/contestPresentation';
import CBGPULogo from '@/components/CBGPULogo';
/** Organizer imagery takes precedence; missing artwork uses the actual product mark. */
export function ContestArtwork({id,banner,className=''}:{id:string;banner?:string|null;className?:string}){
 const [failed,setFailed]=useState<string|null>(null);const image=contestImageUrl(banner||null);
 if(image&&failed!==image)return <Image unoptimized width={640} height={320} src={image} alt="" loading="lazy" onError={()=>setFailed(image)} className={`contest-artwork ${className}`}/>;
 return <div className={`contest-artwork contest-artwork-original ${className}`} data-contest-art-for={id} aria-hidden="true"><CBGPULogo variant="horizontal" width={196} height={46} alt=""/></div>;
}
