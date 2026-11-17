export type SchoolNewsKind='notice'|'letter'|'schedule';
export function schoolNewsSource(schoolId:string,value:unknown,kind:SchoolNewsKind,month:string){
 const dto=value as Record<string,unknown>;
 if(!dto||dto.school_id!==schoolId||dto.status!=='READY'||!Array.isArray(dto.allowed_hosts)||!dto.allowed_hosts.every(h=>typeof h==='string'))throw Error('SCHOOL_SOURCE_NOT_CONFIGURED');
 const field=kind==='notice'?'news_url':kind==='letter'?'letter_url':'calendar_url';
 if(typeof dto[field]!=='string')throw Error('SCHOOL_SOURCE_NOT_CONFIGURED');
 const url=new URL(dto[field]);
 if(kind==='schedule'&&url.hostname==='school.cbe.go.kr'&&/\/M\d+\/(?:list)?$/.test(url.pathname)){
  url.searchParams.set('y',month.slice(0,4));url.searchParams.set('m',String(Number(month.slice(5))));
 }
 return {url:url.href,allowedHosts:dto.allowed_hosts as string[],name:typeof dto.school_name==='string'?dto.school_name:'학교'};
}
