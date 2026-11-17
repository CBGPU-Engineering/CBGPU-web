'use client';
import {supabase} from '@/lib/supabase';
import type {SchoolDraftData} from './schoolOnboarding';
export const multiSchoolEnabled=process.env.NEXT_PUBLIC_CBGPU_MULTISCHOOL_V1==='1';
export type SchoolSummary={id:string;official_name:string;display_name:string;type:string;region:string;brand_color:string;logo_path:string|null;status:'LISTED'|'UNCLAIMED'|'APPROVED'|'SUSPENDED';allowed_membership_types?:('STUDENT'|'TEACHER'|'EXTERNAL')[];join_policy?:string;student_id_policy?:string;teacher_policy?:string;features:string[];ads_enabled?:boolean;life_capabilities?:{timetable:boolean;meal:boolean;news:boolean};homepage_url?:string|null;gpu?:{status:string;nodes:number;sharing_enabled:boolean}};
export type SchoolMembership={id:string;user_id:string;school_id:string;membership_type:'STUDENT'|'TEACHER'|'EXTERNAL';status:'ACTIVE'|'PENDING_VERIFICATION'|'REVERIFICATION_REQUIRED'|'SUSPENDED';verified:boolean;school_roles:string[];student_number?:string|null;required_grade?:number|null;reverification_school_year?:number|null;school:SchoolSummary};
export type SchoolApplication={id:string;school_id?:string|null;status:'DRAFT'|'PENDING'|'APPROVED'|'REJECTED';step:number;revision:number;data:SchoolDraftData;created_at:string;updated_at:string;review_note?:string|null};
export class SchoolsApiError extends Error{constructor(message:string,readonly code?:string,readonly existing_school_id?:string,readonly fields?:Record<string,string>){super(message)}}
export async function schoolsRequest<T>(path:string,method='GET',body?:unknown,publicRead=false):Promise<T>{
 if(!multiSchoolEnabled)throw new SchoolsApiError('학교 기능을 준비하고 있어요.');
 const session=publicRead?null:(await supabase.auth.getSession()).data.session;if(!publicRead&&!session)throw new SchoolsApiError('로그인 후 이용해주세요.');
 const response=await fetch('/api/schools/'+path,{method,headers:{'Content-Type':'application/json',...(session?{Authorization:'Bearer '+session.access_token}:{})},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
 const data=await response.json();if(!response.ok)throw new SchoolsApiError(typeof data.error==='string'?data.error:'요청을 처리하지 못했어요.',data.code,data.existing_school_id,data.fields);return data as T;
}
