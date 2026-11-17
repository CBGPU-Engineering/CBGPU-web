'use client';
import{createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode}from'react';
import{useAuth}from'@/lib/useAuth';
import{multiSchoolEnabled,schoolsRequest,selectAccountSchool,type SchoolMembership,type SchoolSummary}from'@/lib/schoolsClient';
import{schoolServiceVisible}from'@/lib/schoolVisibility';
import{SchoolResourceScopeProvider,useSchoolResourceScope}from'./SchoolResourceScope';
export{schoolServiceVisible}from'@/lib/schoolVisibility';
type Scope={status:'legacy'|'loading'|'ready'|'none'|'unavailable';school:SchoolSummary|null;memberships:SchoolMembership[];error:string;refresh:()=>Promise<void>;switchSchool:(id:string)=>Promise<void>};
const initial:Scope={status:multiSchoolEnabled?'loading':'legacy',school:null,memberships:[],error:'',refresh:async()=>{},switchSchool:async()=>{}};
const Context=createContext<Scope>(initial);
export function SchoolScopeProvider({children}:{children:ReactNode}){const{user}=useAuth();return <SchoolSession key={multiSchoolEnabled?(user?.id||"anonymous"):"legacy"}>{children}</SchoolSession>}
function SchoolSession({children}:{children:ReactNode}){
 const{user,isLoading}=useAuth(),[state,setState]=useState<Omit<Scope,'refresh'|'switchSchool'>>(initial),generation=useRef(0),identity=useRef<string|null>(null),selected=useRef<string|null>(null),selectionGeneration=useRef(0);identity.current=user?.id||null;
 const refresh=useCallback(async()=>{if(!multiSchoolEnabled)return;const owner=user?.id;if(!owner){setState({status:isLoading?'loading':'none',school:null,memberships:[],error:''});return;}const sequence=++generation.current;try{const result=await schoolsRequest<{items:SchoolMembership[];current_school_id:string|null}>('memberships','GET',undefined,false,owner);if(sequence!==generation.current||identity.current!==owner)return;const membership=result.items.find(m=>m.user_id===owner&&m.school.id===m.school_id&&m.school_id===result.current_school_id&&m.status==='ACTIVE'&&m.verified&&m.school.status==='APPROVED');setState({status:membership?'ready':'none',school:membership?.school||null,memberships:result.items.filter(m=>m.user_id===owner),error:''});if(selected.current!==result.current_school_id){selected.current=result.current_school_id;window.dispatchEvent(new CustomEvent('cbgpu-school-changed',{detail:{school_id:result.current_school_id,source:'school-scope'}}))}}catch{if(sequence===generation.current&&identity.current===owner)setState({status:'unavailable',school:null,memberships:[],error:'학교 소속을 확인하지 못했어요. 개인 프로젝트는 계속 사용할 수 있어요.'})}},[user?.id,isLoading]);
 useEffect(()=>{if(!multiSchoolEnabled)return;generation.current++;setState({status:isLoading?'loading':'none',school:null,memberships:[],error:''});void refresh();const sync=(event?:Event)=>{if((event as CustomEvent|undefined)?.detail?.source!=='school-scope'&&document.visibilityState==='visible')void refresh()};window.addEventListener('focus',sync);window.addEventListener('cbgpu-school-changed',sync);const timer=setInterval(sync,60_000);return()=>{generation.current++;clearInterval(timer);window.removeEventListener('focus',sync);window.removeEventListener('cbgpu-school-changed',sync)}},[refresh]);
 const switchSchool=useCallback(async(id:string)=>{const owner=user?.id,sequence=++selectionGeneration.current;await selectAccountSchool(id,owner);if(identity.current!==owner||sequence!==selectionGeneration.current)return;setState(old=>({...old,status:'loading',school:null}));await refresh()},[refresh,user?.id]);
 return <Context.Provider value={{...state,refresh,switchSchool}}><SchoolResourceScopeProvider>{children}</SchoolResourceScopeProvider></Context.Provider>;
}
export const useSchoolScope=()=>{const scope=useContext(Context);const resource=useSchoolResourceScope();return {...scope,resource};};
export const useSchoolServiceVisibility=()=>{const scope=useSchoolScope();return(href:string)=>schoolServiceVisible(scope,href)};
