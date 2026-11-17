import { NextRequest, NextResponse } from 'next/server';
import {parseCbeSchoolCalendar} from '@/lib/schoolCalendar';

export const dynamic = 'force-dynamic';

const FEEDS = {
  notice: 'https://school.cbe.go.kr/rss/cbs-h/M010401',
  letter: 'https://school.cbe.go.kr/rss/cbs-h/M010403',
  schedule: 'https://school.cbe.go.kr/rss/cbs-h/M010407',
} as const;

function extract(tag: string, xml: string): string {
  return (
    xml.match(new RegExp(`<${tag}><\\!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`))?.[1] ||
    xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`))?.[1] ||
    ''
  ).trim();
}

function parseRSS(xml: string, source: string) {
  const items: { title: string; link: string; pubDate: string; author: string }[] = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const b = m[1];
    const title = extract('title', b);
    const link = extract('link', b) || extract('guid', b);
    const pubDate = extract('pubDate', b);
    const author = extract('author', b);
    let safeLink:string;try{const target=new URL(link,source);if(target.protocol!=='https:'||target.origin!==new URL(source).origin)continue;safeLink=target.href}catch{continue}
    if (title) items.push({ title, link:safeLink, pubDate, author });
  }
  return items;
}

export async function GET(req: NextRequest) {
  const type = (req.nextUrl.searchParams.get('type') || 'notice') as keyof typeof FEEDS;
  if(!Object.hasOwn(FEEDS,type))return NextResponse.json({error:'조회할 소식 종류를 확인해주세요.'},{status:400});
  const school=req.nextUrl.searchParams.get('school_id')??'cbsh';
  // Unconfigured schools must never receive another school's information.
  if(school!=='cbsh')return NextResponse.json({items:[],error:'이 학교의 홈페이지 연결 정보를 먼저 설정해주세요.',code:'SCHOOL_SOURCE_NOT_CONFIGURED'},{status:409,headers:{'Cache-Control':'no-store'}});
  const now=new Date(Date.now()+9*3600000),month=req.nextUrl.searchParams.get('month')??`${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,'0')}`;
  if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month))return NextResponse.json({error:'조회할 달을 확인해주세요.'},{status:400});
  const url = type==='schedule'?`https://school.cbe.go.kr/cbs-h/M010407/list?y=${month.slice(0,4)}&m=${Number(month.slice(5))}`:FEEDS[type];

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CBGPU/1.0)' },
      next: { revalidate: 600 },
      signal:AbortSignal.timeout(12000),
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const reader=res.body?.getReader();if(!reader)throw Error('EMPTY_RESPONSE');let bytes=0;const parts:Uint8Array[]=[];try{for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>2_000_000){await reader.cancel();throw Error('RESPONSE_TOO_LARGE')}parts.push(value)}}finally{reader.releaseLock()}
    const data=new Uint8Array(bytes);let offset=0;for(const part of parts){data.set(part,offset);offset+=part.length}const xml=new TextDecoder('utf-8',{fatal:true}).decode(data);
    return NextResponse.json({ items:type==='schedule'?parseCbeSchoolCalendar(xml,url):parseRSS(xml,url),sourceUrl:url,school:{id:'cbsh',name:'충북과학고등학교'},month },{headers:{'Cache-Control':'no-store'}});
  } catch {
    return NextResponse.json({ items: [], error:type==='schedule'?'학사일정을 불러오지 못했어요. 잠시 후 다시 시도하거나 학교 홈페이지를 확인해주세요.':'학교 소식을 불러오지 못했어요. 잠시 후 다시 시도해주세요.' }, { status: 502,headers:{'Cache-Control':'no-store'} });
  }
}
