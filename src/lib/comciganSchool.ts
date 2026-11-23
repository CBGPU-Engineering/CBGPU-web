/** Fixed-provider identity. Only server-verified school configuration may construct a target. */
import {createHash} from 'node:crypto';
export type ComciganSchoolTarget={id:string;name:string;region:string;code?:number};
export const LEGACY_COMCIGAN_SCHOOL:ComciganSchoolTarget={id:'cbsh',name:'충북과학고등학교',region:'충북'};
const REGION_ALIASES:Record<string,string>={'충청북도':'충북','충청남도':'충남','전라북도':'전북','전북특별자치도':'전북','전라남도':'전남','경상북도':'경북','경상남도':'경남','경기도':'경기','강원도':'강원','강원특별자치도':'강원','제주도':'제주','제주특별자치도':'제주','서울특별시':'서울','부산광역시':'부산','대구광역시':'대구','인천광역시':'인천','광주광역시':'광주','대전광역시':'대전','울산광역시':'울산','세종특별자치시':'세종'};
export function comciganRegion(value:string){const name=value.normalize('NFC').trim();return Object.hasOwn(REGION_ALIASES,name)?REGION_ALIASES[name]:name;}
export function validateComciganTarget(target:ComciganSchoolTarget):ComciganSchoolTarget{
 if(!target||typeof target.id!=='string'||!/^[-a-zA-Z0-9_]{1,100}$/.test(target.id)||typeof target.name!=='string'||!target.name.trim()||target.name.length>120||/[\x00-\x1f\x7f]/.test(target.name)||typeof target.region!=='string'||!target.region.trim()||target.region.length>40||/[\x00-\x1f\x7f]/.test(target.region)||target.code!==undefined&&(!Number.isSafeInteger(target.code)||target.code<1||target.code>1_000_000_000))throw Error('학교 시간표 연결 설정을 확인해 주세요.');
 return {id:target.id,name:target.name.normalize('NFC').trim(),region:comciganRegion(target.region),...(target.code===undefined?{}:{code:target.code})};
}
export function comciganTargetKey(input:ComciganSchoolTarget){const t=validateComciganTarget(input);return createHash('sha256').update(JSON.stringify({provider:'comcigan',school:t.id,name:t.name,region:t.region,code:t.code??null})).digest('hex');}
export function selectComciganSchool(rows:readonly {code:number;name:string;region:string}[],input:ComciganSchoolTarget){
 const target=validateComciganTarget(input);if(target.code!==undefined)return target.code;
 const matches=rows.filter(row=>row.name.normalize('NFC').trim()===target.name&&comciganRegion(row.region)===target.region);
 const codes=[...new Set(matches.map(row=>row.code))];if(codes.length!==1)throw Error(codes.length?'같은 이름의 시간표 연결이 여러 개예요. 학교 관리자에게 연결 확인을 요청해 주세요.':'해당 학교·지역의 시간표 연결을 찾지 못했어요.');return codes[0];
}
export function timetableChoices(counts:unknown,grade:number,cls:number){
 if(!Array.isArray(counts)||counts.length<2||counts.length>13||counts.some(n=>!Number.isSafeInteger(n)||n<0||n>100))throw Error('학교 시간표의 학년·반 정보가 올바르지 않아요.');
 const grades=counts.map((n,i)=>i>0&&n>0?i:0).filter(Boolean);const count=counts[grade]??0;
 if(!grades.includes(grade)||!Number.isInteger(cls)||cls<1||cls>count)throw Error('해당 학교에서 제공하는 학년·반을 선택해 주세요.');
 return{grades,classes:Array.from({length:count},(_,i)=>i+1)};
}
export function comciganTargetFromSources(schoolId:string,value:unknown):ComciganSchoolTarget{
 const dto=value as {school_id?:unknown;status?:unknown;comcigan?:{status?:unknown;school_code?:unknown;school_name?:unknown;region?:unknown}};
 if(!dto||dto.school_id!==schoolId||dto.status==='DISABLED'||!dto.comcigan||!['READY','LOOKUP_REQUIRED'].includes(String(dto.comcigan.status)))throw Error('이 학교의 시간표 연결을 준비하고 있어요.');
 const config=dto.comcigan;if(typeof config.school_name!=='string'||typeof config.region!=='string'||config.school_code!==null&&config.school_code!==undefined&&typeof config.school_code!=='number')throw Error('학교 시간표 연결 설정을 확인해 주세요.');
 return validateComciganTarget({id:schoolId,name:config.school_name,region:config.region,...(typeof config.school_code==='number'?{code:config.school_code}:{})});
}

/** A provider-declared ISO Monday, never an invented current date or semester start. */
export function validateComciganWeek(value:unknown,now=Date.now()):string{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('시간표의 주간 날짜를 확인하지 못했어요.');
 const date=new Date(value+'T00:00:00Z');if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value||date.getUTCDay()!==1)throw Error('시간표의 주간 날짜가 올바르지 않아요.');
 const today=new Date(now+9*3600_000),weekday=today.getUTCDay(),monday=new Date(today.toISOString().slice(0,10)+'T00:00:00Z');monday.setUTCDate(monday.getUTCDate()-((weekday+6)%7));
 const diff=(date.getTime()-monday.getTime())/86400_000;if(diff!==0&&!((weekday===0||weekday===6)&&diff===7))throw Error('현재 주간 시간표가 아직 제공되지 않아요.');
 return value;
}
