import {NextRequest,NextResponse} from 'next/server';
import {publicationUser,personalProjectUser,preprintsClient} from '@/lib/preprintsServer';
import {activeDeploymentSession} from '@/lib/deployAuth';
import {createClient} from '@supabase/supabase-js';
import {scopedAccountMode} from '@/lib/deployAccess';
export const runtime='nodejs';
export async function GET(request:NextRequest){
 try{
  const host=request.headers.get('x-cbgpu-public-host')||request.headers.get('host')?.split(':')[0];if(!['manufacturing.cbgpu.com','print.cbgpu.com','laser.cbgpu.com'].includes(host||''))return NextResponse.json({error:'Not found'},{status:404,headers:{'Cache-Control':'private, no-store'}});
  const scoped=scopedAccountMode();
  const user=await(scoped?personalProjectUser(request):publicationUser(request));if(!user||(!scoped&&!await activeDeploymentSession(request,user.id)))return NextResponse.json({error:'Please sign in.'},{status:401,headers:{'Cache-Control':'private, no-store'}});
  if(scoped){
   const token=request.headers.get('authorization')?.match(/^Bearer\s+([^\s,]{1,8192})$/i)?.[1],key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
   if(!token||!key)throw Error('Fresh equipment authority unavailable');
   const caller=createClient(process.env.SUPABASE_INTERNAL_URL||'http://127.0.0.1:54321',key,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
   const {data,error}=await caller.rpc('cbgpu_self_resource_access',{target_school:'cbsh'});
   if(error)throw Error('Fresh equipment authority unavailable');
   if(data?.school_id!=='cbsh'||data.context_type!=='MEMBERSHIP'||data.legacy_cbsh_access!==true||data.resources?.fabrication!==true)return NextResponse.json({error:'An active verified school membership and equipment access are required.'},{status:403,headers:{'Cache-Control':'private, no-store'}});
  }
  const client=preprintsClient();const [profile,printers]=await Promise.all([client.from('profiles').select('is_approved,is_laser_cut_manager').eq('id',user.id).single(),client.from('printer_managers').select('printer_id').eq('user_id',user.id)]);
  if(profile.error||printers.error)throw Error('Role lookup failed');
  if(!scoped&&profile.data.is_approved===false)return NextResponse.json({error:'Your account requires approval.'},{status:403,headers:{'Cache-Control':'private, no-store'}});
  const print=!!printers.data.length,laser=profile.data.is_laser_cut_manager===true;
  if(!print&&!laser||host==='print.cbgpu.com'&&!print||host==='laser.cbgpu.com'&&!laser)return NextResponse.json({error:'This workspace is restricted to assigned equipment managers.'},{status:403,headers:{'Cache-Control':'private, no-store'}});
  return NextResponse.json({print:host==='laser.cbgpu.com'?false:print,laser:host==='print.cbgpu.com'?false:laser,printer_ids:printers.data.map(p=>p.printer_id)},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){console.error('[manufacturing/access] permission lookup failed:',error instanceof Error?error.message:error);return NextResponse.json({error:'Could not verify equipment permissions. Please try again.'},{status:503,headers:{'Cache-Control':'private, no-store'}})}
}
