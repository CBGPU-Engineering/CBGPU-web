import { NextRequest, NextResponse } from 'next/server';
import {parseSchoolRSS} from '@/lib/schoolNewsFeed';
import {isGyo6CalendarSource,parseGyo6SchoolCalendar} from '@/lib/schoolCalendarGyo6';
import {parseCbeSchoolCalendar} from '@/lib/schoolCalendar';
import {schoolNewsSource} from '@/lib/schoolNewsSource';
import {publicSchoolText} from '@/lib/publicSchoolFetch';
import {boundedSchoolBody} from '@/lib/schoolsProxySecurity';
import {trustedInternalServiceUrl} from '@/lib/internalServiceUrl';

export const dynamic = 'force-dynamic';

const FEEDS = {
  notice: 'https://school.cbe.go.kr/rss/cbs-h/M010401',
  letter: 'https://school.cbe.go.kr/rss/cbs-h/M010403',
  schedule: 'https://school.cbe.go.kr/rss/cbs-h/M010407',
} as const;

export async function GET(req: NextRequest) {
  const type = (req.nextUrl.searchParams.get('type') || 'notice') as keyof typeof FEEDS;
  if(!Object.hasOwn(FEEDS,type))return NextResponse.json({error:'조회할 소식 종류를 확인해주세요.'},{status:400,headers:{'Cache-Control':'no-store'}});
  const multi=process.env.CBGPU_MULTISCHOOL_V1==='1';
  const school=req.nextUrl.searchParams.get('school_id')??(multi?'':'cbsh');
  const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store','Vary':'Authorization'}});
  if(!/^[-A-Za-z0-9_]{1,100}$/.test(school))return reply({error:'학교를 선택해주세요.'},400);
  const now=new Date(Date.now()+9*3600000),month=req.nextUrl.searchParams.get('month')??`${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,'0')}`;
  if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month))return reply({error:'조회할 달을 확인해주세요.'},400);
  let url=type==='schedule'?`https://school.cbe.go.kr/cbs-h/M010407/list?y=${month.slice(0,4)}&m=${Number(month.slice(5))}`:FEEDS[type];
  let allowedHosts=['school.cbe.go.kr'],schoolName='충북과학고등학교';
  if(!multi&&school!=='cbsh')return reply({items:[],error:'이 학교의 홈페이지 연결 정보를 먼저 설정해주세요.',code:'SCHOOL_SOURCE_NOT_CONFIGURED'},409);
  if(multi){
   const authorization=req.headers.get('authorization');if(!authorization||!/^Bearer [^\s,]{1,8192}$/i.test(authorization))return reply({error:'로그인 후 학교 소속을 확인해주세요.'},401);
   let endpoint:URL;try{endpoint=trustedInternalServiceUrl(process.env.CBGPU_SCHOOLS_API_URL||'http://127.0.0.1:3546',process.env.CBGPU_INTERNAL_NETWORK_MODE);endpoint.pathname='/v1/schools/'+encodeURIComponent(school)+'/life-sources';endpoint.search='';endpoint.hash=''}catch{return reply({error:'학교 연결 설정을 확인하고 있어요.'},503)}
   try{
    const response=await fetch(endpoint,{headers:{Authorization:authorization,Accept:'application/json'},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000)});
    if(!response.ok)return reply({error:'인증된 학교 소속과 홈페이지 연결을 확인해주세요.'},[401,403].includes(response.status)?response.status:503);
    if(response.redirected||!/^application\/(?:json|[\w.+-]+\+json)(?:\s*;|$)/i.test(response.headers.get('content-type')??''))return reply({error:'학교 연결 응답을 확인하지 못했어요. 잠시 후 다시 시도해주세요.',code:'SCHOOL_AUTHORITY_UNAVAILABLE'},503);
    const dto=JSON.parse(await boundedSchoolBody(response.body,65536));
    try{const source=schoolNewsSource(school,dto,type,month);url=source.url;allowedHosts=source.allowedHosts;schoolName=source.name}catch{return reply({items:[],error:'이 학교의 홈페이지 연결을 준비하고 있어요.',code:'SCHOOL_SOURCE_NOT_CONFIGURED'},409)}
   }catch{return reply({error:'학교 연결 응답을 확인하지 못했어요. 잠시 후 다시 시도해주세요.',code:'SCHOOL_AUTHORITY_UNAVAILABLE'},503)}
  }

  try {
    const xml=await publicSchoolText(url,allowedHosts);
    const calendarHtml=type==='schedule'&&xml.includes('tch-sch-lst');
    return reply({items:type==='schedule'&&isGyo6CalendarSource(url)?parseGyo6SchoolCalendar(xml,url):calendarHtml?parseCbeSchoolCalendar(xml,url):parseSchoolRSS(xml,url),sourceUrl:url,school:{id:school,name:schoolName},month});
  } catch {
    return NextResponse.json({ items: [], error:type==='schedule'?'학사일정을 불러오지 못했어요. 잠시 후 다시 시도하거나 학교 홈페이지를 확인해주세요.':'학교 소식을 불러오지 못했어요. 잠시 후 다시 시도해주세요.' }, { status: 502,headers:{'Cache-Control':'no-store'} });
  }
}
