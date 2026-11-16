'use client';
import {useEffect,useRef,useState}from'react';
import {Button}from'@/components/ui/button';
import {contestImageError,contestImageUrl}from'@/lib/contestPresentation';
import {useAlert}from'@/lib/alert';
export default function ContestBannerPicker({file,currentPath,onChange,onRemove,disabled=false}:{file:File|null;currentPath:string|null|undefined;onChange:(file:File)=>void;onRemove:()=>void;disabled?:boolean}){
 const input=useRef<HTMLInputElement>(null);const [preview,setPreview]=useState<string|null>(null);const {showError}=useAlert();
 useEffect(()=>{if(!file){setPreview(null);return;}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url);},[file]);
 const url=preview||contestImageUrl(currentPath);
 return <div className="space-y-3"><div><h3 className="text-sm font-bold">대회 배너</h3><p className="mt-1 text-xs text-muted-foreground">권장 비율 16:5 · PNG, JPG, WebP · 최대 10MB</p></div>{url?<img src={url} alt="대회 배너 미리보기" className="aspect-[16/5] w-full rounded-xl border object-cover"/>:<div className="flex aspect-[16/5] items-center justify-center rounded-xl border border-dashed bg-muted/30 text-sm text-muted-foreground">대회를 소개하는 배너 이미지를 올려 주세요.</div>}<div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={disabled} onClick={()=>input.current?.click()}>{url?'배너 변경':'배너 이미지 선택'}</Button>{url&&<Button type="button" variant="ghost" disabled={disabled} onClick={onRemove}>배너 제거</Button>}</div><input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="대회 배너 이미지" disabled={disabled} onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(!file)return;const error=contestImageError(file);if(error)return showError(error);onChange(file);}}/></div>;
}
