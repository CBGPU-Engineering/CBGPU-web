'use client';
import {supabase} from '@/lib/supabase';
import {schoolAccountResponse} from './schoolAccountResponse';
import type {SchoolDraftData} from './schoolOnboarding';
export const multiSchoolEnabled=process.env.NEXT_PUBLIC_CBGPU_MULTISCHOOL_V1==='1';
export type SchoolSummary={id:string;official_name:string;display_name:string;type:string;region:string;brand_color:string;logo_path:string|null;status:'LISTED'|'UNCLAIMED'|'APPROVED'|'SUSPENDED';allowed_membership_types?:('STUDENT'|'TEACHER'|'EXTERNAL')[];join_policy?:string;student_id_policy?:string;teacher_policy?:string;features:string[];ads_enabled?:boolean;life_capabilities?:{timetable:boolean;meal:boolean;news:boolean};homepage_url?:string|null;gpu?:{status:string;nodes:number;sharing_enabled:boolean}};
export type SchoolMembership={full_name?:string|null;id:string;user_id:string;school_id:string;membership_type:'STUDENT'|'TEACHER'|'EXTERNAL';status:'ACTIVE'|'PENDING_VERIFICATION'|'REVERIFICATION_REQUIRED'|'SUSPENDED';verified:boolean;school_roles:string[];student_number?:string|null;required_grade?:number|null;reverification_school_year?:number|null;school:SchoolSummary};
export type SchoolApplication={id:string;catalog_school_id?:string|null;school_id?:string|null;status:'DRAFT'|'PENDING'|'APPROVED'|'REJECTED';step:number;revision:number;data:SchoolDraftData;created_at:string;updated_at:string;review_note?:string|null};
export class SchoolsApiError extends Error{constructor(message:string,readonly code?:string,readonly existing_school_id?:string,readonly fields?:Record<string,string>,readonly status?:number){super(message)}}
export async function schoolsRequest<T>(path:string,method='GET',body?:unknown,publicRead=false,expectedOwner?:string):Promise<T>{
 if(!multiSchoolEnabled)throw new SchoolsApiError('학교 기능을 준비하고 있어요.');
 const session=publicRead?null:(await supabase.auth.getSession()).data.session;if(expectedOwner&&session?.user.id!==expectedOwner)throw new SchoolsApiError('계정이 바뀌었어요. 현재 계정에서 다시 시도해 주세요.');if(!publicRead&&!session)throw new SchoolsApiError('로그인 후 이용해 주세요.');
 const {response,data}=await schoolAccountResponse('/api/schools/'+path,{method,headers:{'Content-Type':'application/json',...(session?{Authorization:'Bearer '+session.access_token}:{})},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
 if(expectedOwner&&(await supabase.auth.getSession()).data.session?.user.id!==expectedOwner)throw new SchoolsApiError('계정이 바뀌었어요. 현재 계정에서 다시 시도해 주세요.');if(!response.ok)throw new SchoolsApiError(typeof data.error==='string'?data.error:'요청을 처리하지 못했어요.',data.code,data.existing_school_id,data.fields,response.status);return data as T;
}

/** Account-owned server preference; never write a device/localStorage default school. */
export async function selectAccountSchool(schoolId:string,owner:string|undefined):Promise<string>{
 if(!owner)throw new SchoolsApiError('로그인 후 학교를 선택해 주세요.');
 if(!/^[-A-Za-z0-9_]{1,100}$/.test(schoolId))throw new SchoolsApiError('학교를 확인해 주세요.');
 const result=await schoolsRequest<{ok:boolean;current_school_id:string}>('current-school','POST',{school_id:schoolId},false,owner);
 if(result.ok!==true||result.current_school_id!==schoolId)throw new SchoolsApiError('학교를 전환하지 못했어요.');
 return result.current_school_id;
}
