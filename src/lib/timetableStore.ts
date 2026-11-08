import {mkdir,readFile,stat,open,rename,unlink} from 'node:fs/promises';
import {dirname} from 'node:path';import {randomUUID} from 'node:crypto';
import type {TimetableSnapshot,TimetableStore} from './timetableCache';
export function fileTimetableStore(file=process.env.CBGPU_TIMETABLE_CACHE||'/home/cbgpu/.local/share/cbgpu-timetable/latest.json'):TimetableStore{
 return {async read(){if((await stat(file)).size>8_000_000)throw Error('Invalid timetable cache size');return JSON.parse(await readFile(file,'utf8'))},async write(snapshot:TimetableSnapshot){
  await mkdir(dirname(file),{recursive:true,mode:0o700});const temp=file+'.tmp-'+randomUUID();
  try{const handle=await open(temp,'wx',0o600);try{await handle.writeFile(JSON.stringify(snapshot));await handle.sync()}finally{await handle.close()}await rename(temp,file)}finally{await unlink(temp).catch(()=>{})}
 }};
}
