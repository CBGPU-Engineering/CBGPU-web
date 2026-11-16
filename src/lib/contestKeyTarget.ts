const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const hosts=new Set(['cbgpu.com','www.cbgpu.com','app.cbgpu.com','student.cbgpu.com','researcher.cbgpu.com','developer.cbgpu.com']);
export function contestKeyTarget(input:string):string|null{
 const value=input.trim();if(uuid.test(value))return value.toLowerCase();
 try{const url=new URL(value,'https://cbgpu.com');if(url.protocol!=='https:'||!hosts.has(url.hostname)||url.port||url.username||url.password)return null;const id=url.pathname.match(/^\/contests\/([^/]+)\/?$/)?.[1];return id&&uuid.test(id)?id.toLowerCase():null}catch{return null}
}
