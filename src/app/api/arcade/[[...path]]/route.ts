import {NextRequest, NextResponse} from 'next/server';
import {trustedInternalServiceUrl} from '@/lib/internalServiceUrl';
import {boundedSchoolBody, schoolRequestOriginAllowed} from '@/lib/schoolsProxySecurity';
import {WindowRateLimiter} from '@/lib/requestSecurity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const reads = new WindowRateLimiter(90, 60_000);
const writes = new WindowRateLimiter(30, 60_000);
const headers = {'Cache-Control':'no-store', 'Vary':'Authorization', 'X-Content-Type-Options':'nosniff'};
const fail = (message:string, status:number) => NextResponse.json({error:message}, {status,headers});

async function handle(request:NextRequest, context:{params:Promise<{path?:string[]}>}) {
  const {path=[]} = await context.params;
  const get = request.method === 'GET';
  const valid = get ? path.length === 1 && ['player','leaderboard'].includes(path[0])
    : request.method === 'PUT' ? path.length === 1 && path[0] === 'player'
    : request.method === 'POST' && (path.length === 1 && path[0] === 'sessions' || path.length === 3 && path[0] === 'sessions' && /^[a-f0-9-]{36}$/.test(path[1]) && path[2] === 'submit');
  if (!valid) return fail('찾을 수 없는 랭킹 요청이에요.',404);
  const authorization = request.headers.get('authorization');
  const publicRead = false;
  if (!publicRead && !/^Bearer \S+$/i.test(authorization||'')) return fail('로그인하면 기록을 저장할 수 있어요.',401);
  if (!get && !schoolRequestOriginAllowed(request.headers.get('x-cbgpu-public-host')||request.headers.get('host')||'',request.headers.get('origin'),request.headers)) return fail('요청한 페이지를 확인할 수 없어요. 새로고침해 주세요.',403);
  const key = request.headers.get('cf-connecting-ip') || 'local';
  if (!(get ? reads : writes).allow(key)) return fail('요청이 많아요. 잠시 후 다시 시도해 주세요.',429);
  let body:string|undefined;
  if (!get) {
    try {body = await boundedSchoolBody(request.body,262_144); JSON.parse(body);}
    catch(error) {return fail(error instanceof Error && error.message === 'BODY_TOO_LARGE' ? '게임 기록이 너무 길어요. 새 게임으로 도전해 주세요.' : '게임 기록을 확인하지 못했어요.',error instanceof Error && error.message === 'BODY_TOO_LARGE' ? 413 : 400);}
  }
  try {
    const endpoint = trustedInternalServiceUrl(process.env.CBGPU_ARCADE_API_URL||'http://127.0.0.1:3552',process.env.CBGPU_INTERNAL_NETWORK_MODE);
    endpoint.pathname = '/v1/arcade/'+path.map(encodeURIComponent).join('/');
    endpoint.search = request.nextUrl.search;
    const response = await fetch(endpoint,{method:request.method,headers:{'Content-Type':'application/json',...(authorization?{Authorization:authorization}:{})},body,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15_000)});
    if (!response.ok) {
      const messages:Record<number,string> = {400:'게임 기록과 설정을 확인해 주세요.',401:'다시 로그인한 뒤 기록을 저장해 주세요.',403:'계정 또는 인증된 학교 소속을 확인해 주세요.',404:'기록을 찾지 못했어요. 새 게임으로 도전해 주세요.',410:'기록 저장 시간이 지났어요. 새 게임으로 도전해 주세요.',409:'이미 저장됐거나 종료된 게임이에요. 순위를 새로고침해 주세요.',413:'게임 기록이 너무 길어요.',422:'게임 기록을 검증하지 못했어요. 새 게임으로 도전해 주세요.',429:'요청이 많아요. 잠시 후 다시 시도해 주세요.'};
      return fail(messages[response.status]||'랭킹을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.',response.status>=500?503:response.status);
    }
    if (!response.headers.get('content-type')?.includes('application/json')) return fail('랭킹 응답을 확인하지 못했어요.',503);
    return NextResponse.json(await response.json(),{status:response.status,headers});
  } catch {return fail('랭킹 서비스에 연결하지 못했어요. 일반 게임은 계속 즐길 수 있어요.',503);}
}
export {handle as GET,handle as PUT,handle as POST};
