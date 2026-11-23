'use client';
import {useEffect,useRef,useState}from'react';
import {Button}from'@/components/ui/button';
import {useAuth}from'@/lib/useAuth';
import {useAlert}from'@/lib/alert';
import {supabase}from'@/lib/supabase';
import {Contest,contestError}from'@/lib/contests';
import {uploadContestImage,cleanupContestImages}from'@/lib/contestPresentation';
import ContestBannerPicker from'./ContestBannerPicker';
import ContestDescriptionEditor from'./ContestDescriptionEditor';
export default function ContestPresentationEditor({contest,onUpdated}:{contest:Contest;onUpdated:(contest:Contest)=>void}){
 const {user}=useAuth();const {showError,showSuccess}=useAlert();const [description,setDescription]=useState(contest.description);const [banner,setBanner]=useState<File|null>(null);const [removed,setRemoved]=useState(false);const [edited,setEdited]=useState(false);const [uploading,setUploading]=useState(false);const [busy,setBusy]=useState(false);const saving=useRef(false);
 useEffect(()=>{if(!edited)setDescription(contest.description);},[contest.description,edited]);
 async function save(){if(!user||saving.current||uploading)return;saving.current=true;setBusy(true);let uploaded:string|undefined;try{let path=removed?null:contest.banner_path||null;if(banner){const image=await uploadContestImage(banner,user.id);path=image.path;uploaded=path;}const {data,error}=await supabase.from('contests').update({description:description.trim(),banner_path:path}).eq('id',contest.id).select('*').single();if(error)throw error;onUpdated(data);setBanner(null);setRemoved(false);setEdited(false);if(contest.banner_path&&contest.banner_path!==path)await cleanupContestImages([contest.banner_path]);showSuccess('대회 소개와 배너를 저장했어요.');}catch(error){if(uploaded)await cleanupContestImages([uploaded]);showError(contestError(error));}finally{saving.current=false;setBusy(false);}}
 return <section className="contest-panel space-y-5"><div><p className="contest-eyebrow mb-2 text-primary">참가자에게 보여줄 소개</p><h2 className="text-lg font-bold">대회 소개 · 배너 편집</h2></div><ContestBannerPicker file={banner} currentPath={removed?null:contest.banner_path} disabled={busy} onChange={file=>{setBanner(file);setRemoved(false);setEdited(true);}} onRemove={()=>{setBanner(null);setRemoved(true);setEdited(true);}}/><ContestDescriptionEditor value={description} disabled={busy} onChange={value=>{setDescription(value);setEdited(true);}} onBusyChange={setUploading}/><Button type="button" disabled={busy||uploading||!edited} onClick={()=>void save()}>{busy?'저장 중…':'소개와 배너 저장'}</Button></section>;
}
