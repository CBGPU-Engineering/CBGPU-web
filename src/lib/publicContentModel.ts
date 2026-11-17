export const publicKinds=['projects','contests','community','schools']as const;
export type PublicKind=typeof publicKinds[number];
export type PublicItem={id:string;[key:string]:string|number|boolean|null};
const fields:Record<PublicKind,readonly string[]>={projects:['id','ads_enabled','slug','title','summary','body_markdown','description','school_id','school_name','updated_at','created_at'],contests:['id','ads_enabled','banner_url','title','description','organizer','organizer_school_names','school_id','school_name','event_start_at','event_end_at','registration_opens_at','registration_closes_at','starts_at','ends_at','created_at','location_type','location_name','participation_mode','team_min_size','team_max_size','allow_individual_entries','registration_open','lifecycle_status','eligibility'],community:['id','ads_enabled','title','body','created_at','updated_at','school_name','board_id','board_name','display_name'],schools:['id','official_name','display_name','type','region','status','brand_color','public_description','ads_enabled']};
/** Deliberately excludes asset keys (may contain owner UUIDs), private file paths and user/profile IDs. */
export function publicText(value:string){return value.replace(/!\[([^\]]*)\]\([^)]*\)/g,'$1').replace(/<img\b[^>]*>/gi,'').replace(/https?:\/\/[^\s<>"')]*\/storage\/v1\/object\/(?:public|sign)\/[^/\s]+\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[^\s<>"')]*/gi,'[공개 이미지 준비 중]')}
export function publicItem(kind:PublicKind,value:unknown):PublicItem|null {
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const input=value as Record<string,unknown>;
 if(typeof input.id!=='string'||input.id.length>100)return null;
 const output:PublicItem={id:input.id};
 for(const key of fields[kind]){
  const field=input[key];
  if(key==='organizer_school_names'&&field!==null&&(typeof field!=='string'||field.length>20000||/[\u0000-\u001f\u007f]/.test(field)))continue;
  if(key==='ads_enabled'&&typeof field!=='boolean')continue;
  if(field===null){output[key]=null;continue;}
  if(key==='banner_url'&&(kind!=='contests'||field!==publicContestBannerPath(input.id)))continue;
  if(typeof field==='string')output[key]=['body_markdown','description','body','summary'].includes(key)?publicText(field):field;
  else if(typeof field==='boolean'||typeof field==='number'&&Number.isFinite(field))output[key]=field;
 }
 return output;
}
export function publicPath(parts:string[]){if(parts.length<1||parts.length>2||!publicKinds.includes(parts[0]as PublicKind))return null;const kind=parts[0]as PublicKind;if(parts.length===2){if(kind==='community')return null;if(kind==='schools'?!/^[A-Za-z0-9_-]{1,100}$/.test(parts[1]):!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(parts[1]))return null;}return{kind,id:parts[1]}}
export function publicQuery(parameters:URLSearchParams){const out=new URLSearchParams(),seen=new Set<string>();for(const[key,value]of parameters){if(seen.has(key))return null;seen.add(key);if(key==='query'){if(/[\u0000-\u001f\u007f]/.test(value)||new TextEncoder().encode(value).length>200)return null;out.set(key,value)}else if(key==='limit'||key==='offset'){if(!/^\d+$/.test(value))return null;const number=Number(value);if(!Number.isSafeInteger(number)||key==='limit'&&(number<1||number>100)||key==='offset'&&number>10000)return null;out.set(key,String(number))}else return null;}return out}
export function publicCollection(kind:PublicKind,value:unknown):{items:PublicItem[];total:number;ads_enabled?:boolean}|null{if(!value||typeof value!=='object')return null;const data=value as{items?:unknown;total?:unknown;ads_enabled?:unknown};if(!Array.isArray(data.items)||data.items.length>100||typeof data.total!=='number'||!Number.isSafeInteger(data.total)||data.total<0)return null;const items=data.items.map(item=>publicItem(kind,item));if(items.some(item=>item===null))return null;return{items:items as PublicItem[],total:data.total,...(typeof data.ads_enabled==='boolean'?{ads_enabled:data.ads_enabled&&publicAdsAllowed(items as PublicItem[])}:{})}}
export function publicLabel(item:PublicItem){return String(item.title||item.display_name||item.official_name||'공개 소식')}
export function publicExcerpt(value:unknown,length=180){return typeof value==='string'?value.replace(/[#*_>`~\[\]]/g,'').replace(/\s+/g,' ').trim().slice(0,length):''}

export const publicDestinations={projects:'/projects',contests:'/explore/contests',community:'/community',schools:'/explore/schools'};
export const publicTitles={projects:'공개 프로젝트',contests:'공개 대회',community:'공개 커뮤니티',schools:'학교 둘러보기'};

export function publicContestBannerPath(id:string){return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)?`/api/public-assets/contests/${id}/banner`:null}

export function publicAdsAllowed(items:PublicItem[]){return items.length>0&&items.every(item=>item.ads_enabled===true)}
