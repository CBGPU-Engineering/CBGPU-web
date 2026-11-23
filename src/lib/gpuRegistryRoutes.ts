/** Explicit control-plane routes. Request parameters never choose an upstream host. */
const school=/^[-A-Za-z0-9_]{1,100}$/,uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function gpuRegistryPath(parts:string[],method:string,device=false):string|null {
 if(!device&&parts.length===4&&parts[0]==='legacy'&&parts[1]==='reservations'&&uuid.test(parts[2])&&((method==='GET'&&parts[3]==='extension')||(method==='POST'&&parts[3]==='extend')))return '/v1/gpu/'+parts.join('/');
 if(device)return method==='POST'&&((parts.length===1&&['enroll','report'].includes(parts[0]))||(parts.length===2&&parts[0]==='notebooks'&&['capabilities','claim','renew','result'].includes(parts[1])))?'/v1/gpu/'+parts.join('/'):null;
 if(parts.length===3&&parts[0]==='notebooks'&&uuid.test(parts[1])&&parts[2]==='session'&&method==='POST')return '/v1/gpu/'+parts.join('/');
 if(parts[0]!=='schools'||!school.test(parts[1]||'')||parts[2]!=='gpu')return null;
 if(parts[3]==='admin'&&parts[4]==='reservations'&&((parts.length===5&&method==='GET')||(parts.length===7&&uuid.test(parts[5])&&parts[6]==='action'&&method==='POST')))return '/v1/'+parts.join('/');
 if(parts.length===4&&((method==='GET'&&['nodes','resources','reservations'].includes(parts[3]))||(method==='POST'&&parts[3]==='enrollments')))return '/v1/'+parts.join('/');
 if(parts.length===6&&method==='POST'&&parts[3]==='nodes'&&uuid.test(parts[4])&&parts[5]==='revoke')return '/v1/'+parts.join('/');
 if(parts.length===6&&parts[3]==='resources'&&uuid.test(parts[4])&&parts[5]==='reservations'&&method==='POST')return '/v1/'+parts.join('/');
 if(parts[3]==='reservations'&&uuid.test(parts[4]||'')&&((parts.length===5&&method==='DELETE')||(parts.length===6&&((method==='POST'&&['launch','stop','session','extend'].includes(parts[5]))||(method==='GET'&&['notebook','extension'].includes(parts[5]))))))return '/v1/'+parts.join('/');
 return null;
}
export function gpuControlPlaneOrigin(value='https://cbgpu.com') {
 const u=new URL(value);if(u.protocol!=='https:'||!u.hostname||u.username||u.password||u.port&&u.port!=='443'||u.pathname!=='/'||u.search||u.hash)throw Error('Invalid GPU control plane origin');return u.origin;
}
