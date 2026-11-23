import {contestParticipantPolicies,type ContestParticipantPolicy} from './contestSchoolPolicy.ts';
import {boundedSchoolBody} from './schoolsProxySecurity.ts';
export type ObservedContestPolicy={id:string;host_id:string;school_id:string;access_scope:string;allowed_school_ids:string[];participant_policy:ContestParticipantPolicy};
type PolicySession={user:{id:string};access_token:string}|null;
/** Changes qualification only. Existing tenant/owner RLS and fresh-session triggers remain authoritative. */
export async function changeContestParticipantPolicy(observed:ObservedContestPolicy,next:ContestParticipantPolicy,owner:string,current:()=>boolean,deps:{session:()=>Promise<PolicySession>;fetch:typeof fetch;url:string;anonKey:string}){
 const id=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,school=/^[-A-Za-z0-9_]{1,100}$/;
 if(!id.test(observed.id)||owner!==observed.host_id||!school.test(observed.school_id)||!contestParticipantPolicies.includes(observed.participant_policy)||!contestParticipantPolicies.includes(next)||next===observed.participant_policy||!['PRIVATE','SCHOOL','MULTI_SCHOOL','AUTHENTICATED','PUBLIC'].includes(observed.access_scope)||!Array.isArray(observed.allowed_school_ids)||observed.allowed_school_ids.length>100||observed.allowed_school_ids.some(value=>!school.test(value)))throw Error('현재 대회의 참가 자격을 확인한 뒤 다시 시도해 주세요.');
 const session=await deps.session();if(!current()||session?.user.id!==owner||!session.access_token)throw Error('계정이 바뀌었어요. 현재 계정에서 대회를 다시 열어 주세요.');
 const query=new URLSearchParams({id:'eq.'+observed.id,host_id:'eq.'+owner,school_id:'eq.'+observed.school_id,access_scope:'eq.'+observed.access_scope,participant_policy:'eq.'+observed.participant_policy,allowed_school_ids:'eq.{'+observed.allowed_school_ids.join(',')+'}',select:'*'});
 let response:Response;const fetcher=deps.fetch;
 try{response=await fetcher(deps.url.replace(/\/$/,'')+'/rest/v1/contests?'+query,{method:'PATCH',credentials:'omit',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000),headers:{apikey:deps.anonKey,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify({participant_policy:next})})}catch{throw Error('변경 결과를 확인하지 못했어요. 다시 변경하기 전에 대회를 새로고침해 주세요.')}
 if(response.redirected||!/^application\/json(?:;|$)/i.test(response.headers.get('content-type')||''))throw Error('변경 결과를 확인하지 못했어요. 대회를 새로고침해 주세요.');
 let result:unknown;try{result=JSON.parse(await boundedSchoolBody(response.body,1024*1024))}catch{throw Error('변경 결과를 확인하지 못했어요. 대회를 새로고침해 주세요.')}
 const fresh=await deps.session();if(!current()||fresh?.user.id!==owner)throw Error('계정이 바뀌었어요. 현재 계정에서 대회를 다시 열어 주세요.');
 if(!response.ok)throw Error(response.status===401||response.status===403?'대회 생성자 권한과 운영 학교 소속을 확인해 주세요.':'참가 자격을 변경하지 못했어요. 대회를 새로고침해 주세요.');
 if(!Array.isArray(result)||result.length!==1||result[0].id!==observed.id||result[0].host_id!==owner||result[0].school_id!==observed.school_id||result[0].access_scope!==observed.access_scope||JSON.stringify(result[0].allowed_school_ids)!==JSON.stringify(observed.allowed_school_ids)||result[0].participant_policy!==next)throw Error('대회 설정이 바뀌었어요. 새로고침한 뒤 다시 확인해 주세요.');
 return result[0];
}
