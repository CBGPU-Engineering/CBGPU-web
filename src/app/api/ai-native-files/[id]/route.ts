import {NextRequest,NextResponse} from 'next/server';
import {aiIdentity,aiInternal,aiUserClient,AiFailure} from '@/lib/aiServer';
export const runtime='nodejs';
/** Existing app builds already download authenticated /api/files/materials/:uuid/content URLs.
 * Serve real materials unchanged, or an owner-bound, short-lived AI download ticket.
 * No shared-material record is created for a private AI result.
 */
export async function GET(request:NextRequest,context:{params:Promise<{id:string}>}){
 try{
  const {id}=await context.params;if(!/^[a-f0-9-]{36}$/i.test(id))return NextResponse.json({message:'Not found'},{status:404});
  const {owner,token}=await aiIdentity(request,false);const {data,error}=await aiUserClient(token).from('shared_materials').select('id').eq('id',id).eq('status','ready').maybeSingle();
  if(error)throw new AiFailure('파일 권한을 확인하지 못했어요.',503);
  const response=data?await fetch('http://127.0.0.1:8421/materials/'+id+'/content',{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(600_000)}):await aiInternal('downloads/'+id,owner);
  return new NextResponse(response.body,{status:response.status,headers:{'Content-Type':response.ok?'application/octet-stream':'application/json','Content-Disposition':response.headers.get('content-disposition')||'attachment','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }catch(error){return NextResponse.json({message:error instanceof AiFailure?error.message:'파일을 받지 못했어요.'},{status:error instanceof AiFailure?error.status:503})}
}
