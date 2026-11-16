import {constants} from 'node:fs';
import {open} from 'node:fs/promises';

const manifest='/home/cbgpu/.local/share/cbgpu-rust/ai-active.json';
const allowedPorts=new Set([3550,13550,13551]);

/** Private operator routing only; callers cannot supply a URL or request header override. */
export function parseAiUpstream(value:unknown):string {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid private AI route');
 const route=value as Record<string,unknown>;
 if(route.version!==1||typeof route.port!=='number'||!allowedPorts.has(route.port))throw new Error('Invalid private AI route');
 return `http://127.0.0.1:${route.port}`;
}

export async function aiUpstreamOrigin(file=manifest):Promise<string>{
 let handle;
 try{handle=await open(file,constants.O_RDONLY|constants.O_NOFOLLOW)}catch(error){
  if((error as NodeJS.ErrnoException).code==='ENOENT')return 'http://127.0.0.1:3550';
  throw new Error('Private AI route unavailable');
 }
 try{
  const stat=await handle.stat();
  if(!stat.isFile()||stat.size>1024||(stat.mode&0o077)!==0||stat.uid!==process.getuid?.())throw new Error('Unsafe private AI route');
  const bytes=Buffer.alloc(1025);
  const {bytesRead}=await handle.read(bytes,0,bytes.length,0);
  if(bytesRead>1024)throw new Error('Invalid private AI route');
  return parseAiUpstream(JSON.parse(bytes.subarray(0,bytesRead).toString('utf8')));
 }finally{await handle.close()}
}
