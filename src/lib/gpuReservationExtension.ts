import {boundedClientRequest} from './boundedClientRequest.ts';
import {boundedSchoolBody} from './schoolsProxySecurity.ts';
export type GpuExtensionPreview={reservation_id:string;current_end:string;max_end:string|null;server_now:string;can_extend:boolean;reason:string|null;updated?:boolean};
const errors:Record<string,string>={
 GPU_RESOURCE_UNAVAILABLE:'GPU가 현재 예약을 연장할 수 있는 상태가 아니에요. 서버 상태를 확인한 뒤 다시 시도해 주세요.',AUTHENTICATION_REQUIRED:'로그인 후 다시 확인해 주세요.',INVALID_SESSION:'로그인이 만료됐어요. 다시 로그인해 주세요.',GPU_PERMISSION_REQUIRED:'현재 이 GPU를 이용할 권한이 없어요.',RESERVATION_NOT_FOUND:'본인 예약을 찾지 못했어요. 예약 목록을 새로고침해 주세요.',RESERVATION_EXPIRED:'이미 종료된 예약은 연장할 수 없어요.',RESERVATION_NOT_ACTIVE:'현재 사용 시간인 예약만 연장할 수 있어요.',RESERVATION_CHANGED:'예약 시간이 변경됐어요. 연장 가능 시간을 다시 확인해 주세요.',RESERVATION_CONFLICT:'선택한 시간에 다른 예약이 있어요. 연장 가능 시간을 다시 확인해 주세요.',EXTENSION_LIMIT:'연장 가능한 종료 시각을 넘었어요. 시간을 다시 선택해 주세요.',EXECUTOR_EXTENSION_UNSUPPORTED:'이 실행 환경은 사용 중 연장을 아직 지원하지 않아요. 현재 예약은 그대로 유지돼요.',INVALID_BODY:'연장할 시간을 다시 확인해 주세요.',INVALID_WINDOW:'현재 종료 시각보다 늦은 시간을 선택해 주세요.',RESERVATION_BUSY:'다른 예약 요청을 처리 중이에요. 연장 가능 시간을 다시 확인해 주세요.',EXTENSION_UNAVAILABLE:'연장 기능에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.'};
export const gpuExtensionReason=(code:unknown)=>typeof code==='string'&&errors[code]||'연장 결과를 확인하지 못했어요. 예약 목록에서 종료 시각을 확인한 뒤 다시 시도해 주세요.';
export function gpuExtensionPreview(value:unknown,id:string):GpuExtensionPreview{
 if(!value||typeof value!=='object')throw Error(gpuExtensionReason(null));const v=value as GpuExtensionPreview;
 if(v.reservation_id!==id||typeof v.current_end!=='string'||typeof v.server_now!=='string'||v.max_end!==null&&typeof v.max_end!=='string'||!Number.isFinite(Date.parse(v.current_end))||!Number.isFinite(Date.parse(v.server_now))||v.max_end!==null&&!Number.isFinite(Date.parse(v.max_end))||typeof v.can_extend!=='boolean'||v.reason!==null&&typeof v.reason!=='string')throw Error(gpuExtensionReason(null));
 return v;
}
export async function requestGpuExtension(input:{base:string;id:string;owner:string;current:()=>boolean;session:()=>Promise<{data:{session:{user:{id:string};access_token:string}|null}}> ;endsAt?:string;expectedEnd?:string;signal?:AbortSignal},send:typeof fetch=fetch){
 if(!/^\/api\/compute\/(?:legacy\/reservations\/[a-f0-9-]{36}|schools\/[-A-Za-z0-9_]{1,100}\/gpu\/reservations\/[a-f0-9-]{36})$/i.test(input.base)||!input.base.endsWith('/'+input.id))throw Error(gpuExtensionReason(null));
 try{return await boundedClientRequest(async signal=>{
  const check=()=>{if(!input.current()||signal.aborted)throw Error('계정이 바뀌었어요. 현재 계정에서 다시 확인해 주세요.')};check();const {data:{session}}=await input.session();check();if(session?.user.id!==input.owner)throw Error('로그인한 계정을 다시 확인해 주세요.');
  const mutation=input.endsAt!==undefined;
  if(mutation&&(!input.expectedEnd||!Number.isFinite(Date.parse(input.expectedEnd))||!Number.isFinite(Date.parse(input.endsAt!))||Date.parse(input.endsAt!)<=Date.parse(input.expectedEnd)))throw Error(gpuExtensionReason('INVALID_WINDOW'));
  const response=await send(input.base+(mutation?'/extend':'/extension'),{method:mutation?'POST':'GET',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:mutation?JSON.stringify({ends_at:input.endsAt,expected_ends_at:input.expectedEnd}):undefined,cache:'no-store',redirect:'error',signal});
  if(response.redirected||!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type')||''))throw Error(gpuExtensionReason(null));
  const data:unknown=JSON.parse(await boundedSchoolBody(response.body,16384));check();const active=(await input.session()).data.session;check();if(active?.user.id!==input.owner)throw Error('계정이 바뀌었어요. 현재 계정에서 다시 확인해 주세요.');
  if(!response.ok)throw Error(gpuExtensionReason((data as {error?:unknown})?.error));const value=gpuExtensionPreview(data,input.id);
  if(mutation&&(value.updated!==true||Date.parse(value.current_end)!==Date.parse(input.endsAt!)))throw Error(gpuExtensionReason(null));
  return value;
 },input.signal,20000)}catch(error){if(error instanceof Error&&(Object.values(errors).includes(error.message)||error.message.startsWith('계정이 바뀌었어요.')||error.message==='로그인한 계정을 다시 확인해 주세요.'))throw error;throw Error(gpuExtensionReason(null))}
}
export function extensionEndError(value:string,preview:GpuExtensionPreview):string|null{
 const end=Date.parse(value);if(!Number.isFinite(end)||end<=Date.parse(preview.current_end))return gpuExtensionReason('INVALID_WINDOW');
 if(preview.max_end&&end>Date.parse(preview.max_end))return gpuExtensionReason('EXTENSION_LIMIT');return null;
}
