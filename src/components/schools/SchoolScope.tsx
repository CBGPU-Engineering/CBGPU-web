'use client';
import{createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode}from'react';
import{useAuth}from'@/lib/useAuth';
import{multiSchoolEnabled,schoolsRequest,type SchoolMembership,type SchoolSummary}from'@/lib/schoolsClient';
import{schoolServiceVisible}from'@/lib/schoolVisibility';
export{schoolServiceVisible}from'@/lib/schoolVisibility';
type Scope={status:'legacy'|'loading'|'ready'|'none'|'unavailable';school:SchoolSummary|null;memberships:SchoolMembership[];error:string;refresh:()=>Promise<void>;switchSchool:(id:string)=>Promise<void>};
const initial:Scope={status:multiSchoolEnabled?'loading':'legacy',school:null,memberships:[],error:'',refresh:async()=>{},switchSchool:async()=>{}};
const Context=createContext<Scope>(initial);
export function SchoolScopeProvider({children}:{children:ReactNode}){
 const{user,isLoading}=useAuth(),[state,setState]=useState<Omit<Scope,'refresh'|'switchSchool'>>(initial),generation=useRef(0),identity=useRef<string|null>(null);identity.current=user?.id||null;
 const refresh=useCallback(async()=>{if(!multiSchoolEnabled)return;const owner=user?.id;if(!owner){setState({status:isLoading?'loading':'none',school:null,memberships:[],error:''});return;}const sequence=++generation.current;try{const result=await schoolsRequest<{items:SchoolMembership[];current_school_id:string|null}>('memberships');if(sequence!==generation.current||identity.current!==owner)return;const membership=result.items.find(m=>m.school_id===result.current_school_id&&m.status==='ACTIVE'&&m.verified&&m.school.status==='APPROVED');setState({status:membership?'ready':'none',school:membership?.school||null,memberships:result.items,error:''})}catch{if(sequence===generation.current&&identity.current===owner)setState({status:'unavailable',school:null,memberships:[],error:'학교 소속을 확인하지 못했어요. 개인 프로젝트는 계속 사용할 수 있어요.'})}},[user?.id,isLoading]);
 useEffect(()=>{if(!multiSchoolEnabled)return;generation.current++;setState({status:isLoading?'loading':'none',school:null,memberships:[],error:''});void refresh();const sync=()=>{if(document.visibilityState==='visible')void refresh()};window.addEventListener('focus',sync);window.addEventListener('cbgpu-school-changed',sync);const timer=setInterval(sync,60_000);return()=>{generation.current++;clearInterval(timer);window.removeEventListener('focus',sync);window.removeEventListener('cbgpu-school-changed',sync)}},[refresh]);
 const switchSchool=useCallback(async(id:string)=>{const result=await schoolsRequest<{ok:boolean;current_school_id:string}>('current-school','POST',{school_id:id});if(!result.ok||result.current_school_id!==id)throw Error('학교를 전환하지 못했어요.');setState(old=>({...old,status:'loading',school:null}));await refresh();window.dispatchEvent(new CustomEvent('cbgpu-school-changed',{detail:{school_id:result.current_school_id}}))},[refresh]);
 return <Context.Provider value={{...state,refresh,switchSchool}}>{children}</Context.Provider>;
}
export const useSchoolScope=()=>useContext(Context);
export const useSchoolServiceVisibility=()=>{const scope=useSchoolScope();return(href:string)=>schoolServiceVisible(scope,href)};
