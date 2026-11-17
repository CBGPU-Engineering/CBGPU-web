import type {CSSProperties} from 'react';

/** Exact supplied brand artwork; the theme only selects its provided black/white variant. */
export default function CBGPULogo({width=32,height=32,alt='CBGPU',className='',variant='symbol',priority=false}:{width?:number;height?:number;alt?:string;className?:string;variant?:'symbol'|'horizontal'|'wordmark';priority?:boolean}){
 const style:CSSProperties={width,height,display:'inline-flex',flexShrink:0,verticalAlign:'middle'};
 return <span className={`cb-brand-art ${className}`} style={style} role={alt?'img':undefined} aria-label={alt||undefined} aria-hidden={alt?undefined:true}>
  {/* Native image loading preserves the supplied SVG without optimizer rasterization. */}
  {/* eslint-disable-next-line @next/next/no-img-element */}
  <img src={`/brand/v1/${variant}_black.svg`} alt="" width={width} height={height} className="cb-brand-art-light" fetchPriority={priority?'high':undefined}/>
  {/* eslint-disable-next-line @next/next/no-img-element */}
  <img src={`/brand/v1/${variant}_white.svg`} alt="" width={width} height={height} className="cb-brand-art-dark" fetchPriority={priority?'high':undefined}/>
 </span>;
}
