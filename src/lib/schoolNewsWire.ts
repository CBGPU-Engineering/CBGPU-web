import {boundedSchoolBody} from './schoolsProxySecurity.ts';
export interface SchoolNewsItem{title:string;link:string;pubDate:string;author:string}
export interface SchoolNewsResult{items:SchoolNewsItem[];sourceUrl:string;school:{id:string;name:string};month:string}
export class SchoolNewsWireError extends Error{readonly code:string;readonly status:number;constructor(code:string,status:number=0){super(status===401?'로그인 상태를 확인한 뒤 다시 시도해주세요.':status===403?'현재 학교 소식에 접근할 수 없어요. 학교 소속을 확인해주세요.':'학교 소식 응답을 확인하지 못했어요. 새로고침하거나 학교 홈페이지에서 원문을 확인해주세요.');this.code=code;this.status=status;}}
export function schoolNewsHttps(value:unknown):string|null{if(typeof value!=='string')return null;try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null}catch{return null}}
export async function readSchoolNewsResponse(response:Response,schoolId:string,month:string):Promise<SchoolNewsResult>{
 if(response.redirected)throw new SchoolNewsWireError('REDIRECTED_RESPONSE',response.status);
 const type=response.headers.get('content-type')??'';
 if(!/^application\/(?:json|[\w.+-]+\+json)(?:\s*;|$)/i.test(type))throw new SchoolNewsWireError('NON_JSON_RESPONSE',response.status);
 let value:unknown;try{value=JSON.parse(await boundedSchoolBody(response.body,262144))}catch{throw new SchoolNewsWireError('INVALID_JSON_RESPONSE',response.status)}
 if(!response.ok)throw new SchoolNewsWireError('HTTP_ERROR',response.status);
 const dto=value as Partial<SchoolNewsResult>|null;
 if(!dto||typeof dto!=='object'||dto.school?.id!==schoolId||typeof dto.school.name!=='string'||dto.month!==month||!Array.isArray(dto.items)||dto.items.length>200||!schoolNewsHttps(dto.sourceUrl)||!dto.items.every(item=>item&&typeof item.title==='string'&&item.title.length<=4000&&schoolNewsHttps(item.link)&&typeof item.pubDate==='string'&&typeof item.author==='string'))throw new SchoolNewsWireError('INVALID_SCHOOL_RESPONSE',response.status);
 return dto as SchoolNewsResult;
}
