import {constants} from 'node:fs';
import {open} from 'node:fs/promises';
import {createHash,timingSafeEqual} from 'node:crypto';
import {comciganRegion,validateComciganTarget,type ComciganSchoolTarget} from './comciganSchool.ts';
/** Dedicated operator credential, never an account/session or provider credential. */
export async function timetableWarmAuthorized(supplied:string|null,path:string|undefined){
 if(!path||!path.startsWith('/'))throw Error('WARM_NOT_CONFIGURED');
 const file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
 try{const stat=await file.stat();if(!stat.isFile()||stat.size<32||stat.size>256||(stat.mode&0o077)!==0||process.getuid&&stat.uid!==process.getuid())throw Error('WARM_NOT_CONFIGURED');const secret=(await file.readFile('utf8')).trim();if(!/^[a-f0-9]{64}$/.test(secret))throw Error('WARM_NOT_CONFIGURED');const hash=(s:string)=>createHash('sha256').update(s).digest();return timingSafeEqual(hash(supplied||''),hash(secret))}finally{await file.close()}
}
export function timetableWarmInput(value:unknown):{school_id:string;grade:number;class:number}{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('INVALID_REQUEST');const v=value as Record<string,unknown>;if(Object.keys(v).sort().join(',')!=='class,grade,school_id'||typeof v.school_id!=='string'||!/^[-a-zA-Z0-9_]{1,100}$/.test(v.school_id)||!Number.isInteger(v.grade)||(v.grade as number)<1||(v.grade as number)>12||!Number.isInteger(v.class)||(v.class as number)<1||(v.class as number)>100)throw Error('INVALID_REQUEST');return v as ReturnType<typeof timetableWarmInput>;
}
export function timetableWarmTarget(id:string,value:unknown):ComciganSchoolTarget{
 // Operator-reviewed canonical target only. SchoolSummary does not expose private provider overrides.
 if(id!=='cbsh')throw Error('UNREVIEWED_WARM_TARGET');
 const s=(value as {school?:Record<string,unknown>})?.school;
 if(!s||s.id!==id||s.status!=='APPROVED'||!Array.isArray(s.features)||!s.features.includes('school_life')||!(s.life_capabilities as {timetable?:unknown})?.timetable||((s.life_capabilities as {timetable?:unknown}).timetable!==true))throw Error('SCHOOL_SOURCE_NOT_CONFIGURED');
 if(s.official_name!=='충북과학고등학교'||typeof s.region!=='string'||comciganRegion(s.region)!=='충북'||s.official_id!==undefined&&s.official_id!=='8000075')throw Error('UNREVIEWED_WARM_TARGET');
 return validateComciganTarget({id,name:s.official_name,region:s.region});
}
