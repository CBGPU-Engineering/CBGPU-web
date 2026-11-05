import {readFile} from 'node:fs/promises';
import {androidRelease} from '@/lib/appUpdates';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(){
 try{
  const release=androidRelease(JSON.parse(await readFile('/home/cbgpu/CBGPU-live/FrontEnd/cbgpu/public/downloads/android-release.json','utf8')));
  if(!release)throw Error('Invalid release');
  return Response.json(release,{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({message:'Release information unavailable'},{status:503,headers:{'Cache-Control':'no-store'}})}
}
