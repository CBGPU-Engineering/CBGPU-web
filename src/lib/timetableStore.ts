import {mkdir,readFile,stat,open,rename,unlink} from 'node:fs/promises';
import {dirname,join} from 'node:path';import {randomUUID} from 'node:crypto';
import type {TimetableSnapshot,TimetableStore} from './timetableCache';
export function fileTimetableStore(file=process.env.CBGPU_TIMETABLE_CACHE||'/home/cbgpu/.local/share/cbgpu-timetable/latest.json',scope?:string):TimetableStore{
 return {async read(){if((await stat(file)).size>8_000_000)throw Error('Invalid timetable cache size');const value=JSON.parse(await readFile(file,'utf8'));if(scope){if(value.scope!==scope)throw Error('Timetable cache school mismatch');return value.snapshot}return value},async write(snapshot:TimetableSnapshot){
  await mkdir(dirname(file),{recursive:true,mode:0o700});const temp=file+'.tmp-'+randomUUID();
  try{const handle=await open(temp,'wx',0o600);try{await handle.writeFile(JSON.stringify(scope?{scope,snapshot}:snapshot));await handle.sync()}finally{await handle.close()}await rename(temp,file)}finally{await unlink(temp).catch(()=>{})}
 }};
}

export function schoolTimetableStore(scope:string,base=process.env.CBGPU_TIMETABLE_CACHE||'/home/cbgpu/.local/share/cbgpu-timetable/latest.json'):TimetableStore{
 if(!/^[a-f0-9]{64}$/.test(scope))throw Error('Invalid timetable school cache key');
 return fileTimetableStore(join(dirname(base),'schools',scope+'.json'),scope);
}
