import {workspaceServicePaths,workspaces,type WorkspaceId} from './workspaces';
export function serviceAudience(href:string):WorkspaceId{return workspaceServicePaths.student.some(path=>href===path||href.startsWith(path+'/'))?'student':'researcher'}
/** A cross-space link carries its destination mode, including inside the native app. */
export function serviceDestination(href:string,audience:WorkspaceId|null,isApp=false){
 if(href.startsWith('https:'))return href;
 const url=new URL(href,'https://cbgpu.com');
 const path=url.pathname;
 const target=audience&&workspaceServicePaths[audience].some(value=>path===value||path.startsWith(value+'/'))?audience:serviceAudience(path);
 if(isApp){
  url.searchParams.set('mode',target);
  url.searchParams.set('native','1');
  return url.pathname+url.search+url.hash;
 }
 if(audience===target)return href;
 return 'https://'+workspaces[target].host+url.pathname+url.search+url.hash;
}
export function matchesService(query:string,text:string){
 const normalize=(value:string)=>value.toLocaleLowerCase().normalize('NFKC');
 const haystack=normalize(text),compact=haystack.replace(/\s+/g,'');
 return normalize(query).trim().split(/\s+/).filter(Boolean).every(word=>haystack.includes(word)||compact.includes(word));
}
