import{publicDocsPath}from'./publicDocsPaths.ts';
/** Provider policy: https://adfit.kakao.com/web/html/use_kakao.html (reviewed 2026-11-17). */
export type AdPlacement='platform'|'school';
export const kakaoAdUnits={desktop:{id:'DAN-kVpBmlPRbOvGb6oi',width:728,height:90},mobile:{id:'DAN-vpZNfcj3tj0jMkhV',width:320,height:50}} as const;
const hosts=new Set(['cbgpu.com','www.cbgpu.com','student.cbgpu.com','researcher.cbgpu.com','developer.cbgpu.com','app.cbgpu.com']);
export function adFitArxivPath(path:string){return path==='/'||path==='/arxiv'||/^\/(?:arxiv\/)?[a-f0-9-]{36}$/i.test(path)}
export function adFitPublicPath(path:string){return path==='/schools'||path==='/privacy'||path==='/contact'||path==='/docs'||path.startsWith('/docs/')&&publicDocsPath(path)||path==='/arxiv'||/^\/arxiv\/[a-f0-9-]{36}$/i.test(path)|| path==='/'||path==='/workspace'||path==='/services'||path==='/download'||path==='/projects'||/^\/projects\/[a-f0-9-]{36}$/i.test(path)||path==='/community'||path==='/explore/contests'||/^\/explore\/contests\/[a-f0-9-]{36}$/i.test(path)||path==='/explore/schools'||/^\/explore\/schools\/[-A-Za-z0-9_]{1,100}$/.test(path)||/^\/explore\/services\/(school|projects|ai|gpu)$/.test(path)}
export function adFitEligible(input:{hostname:string;path:string;search:string;hash?:string;audience:'anonymous'|'authenticated'|'loading';placement:AdPlacement;contentReady:boolean;schoolAdsEnabled?:boolean;nativeApp?:boolean}){
 if(!(input.hostname==='docs.cbgpu.com'?publicDocsPath(input.path):input.hostname==='arxiv.cbgpu.com'?adFitArxivPath(input.path):hosts.has(input.hostname)&&adFitPublicPath(input.path))||!['anonymous','authenticated'].includes(input.audience)||input.contentReady!==true||input.hash)return false;
 if(input.placement!=='platform'&&input.placement!=='school')return false;
 if(input.placement==='school'&&input.schoolAdsEnabled!==true)return false;
 // Never send identifiers, search terms, credentials or arbitrary callback context to an ad document.
 for(const[key,value]of new URLSearchParams(input.search)){if(key==='native'&&value==='1'&&input.nativeApp===true)continue;if(key==='mode'&&['student','researcher','developer'].includes(value))continue;if(['page','offset','limit'].includes(key)&&/^\d{1,5}$/.test(value))continue;return false}
 return true;
}
