/**
 * 컴시간알리미(comci.net) 시간표 클라이언트
 *
 * 기존에 쓰던 `comcigan-parser` 패키지는 컴시간 웹페이지의 JS를 그대로 eval() 하는
 * 방식이라 유지보수가 끊겼고(deprecated `request` 의존), 사이트가 페이지 구조를
 * 조금만 바꿔도 깨지기 쉽다. 여기서는 컴시간 웹뷰어의 디코딩 로직(자료481/자료147 +
 * baSplit/splitData)을 직접 포팅해서 eval 없이 순수 데이터 디코딩만 수행한다.
 */
import iconv from 'iconv-lite';
import { extractComciganMetadata, extractComciganFields, extractComciganTransport, extractComciganSchools, extractComciganRequest, extractComciganCellKey, decodeComciganCell,extractComciganWeekField,extractComciganTimesField } from './comciganSource';
import {decodeComciganPayload} from './comciganPayload';
import {createTimetableLoader} from './timetableCache';
import {fileTimetableStore,schoolTimetableStore} from './timetableStore';
import{LEGACY_COMCIGAN_SCHOOL,comciganTargetKey,selectComciganSchool,timetableChoices,validateComciganTarget,validateComciganWeek,type ComciganSchoolTarget}from'./comciganSchool';

const ENTRY_URL = 'http://컴시간학생.kr';
const SCHOOL_KEYWORD = '충북과학고';
const SCHOOL_DISPLAY_NAME = '충북과학고등학교';
const MAX_PERIOD = 8;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const META_TTL = 5 * 60 * 1000; // 제공처 조회 정보도 데이터 갱신마다 확인

interface SiteMeta {
  baseUrl: string;
  cellKey:number[]|null;
  weekField:string|null;
  timesField:string|null;
  request: ReturnType<typeof extractComciganRequest>;
  transport: ReturnType<typeof extractComciganTransport>;
  extractCode: string; // e.g. "/36179?17384l"
  scPrefix: string;    // e.g. "73629_"
  scSuffix: string;    // e.g. "1"
  fields: ReturnType<typeof extractComciganFields>;
}

export interface TimetableCell {
  subject: string;
  teacher: string;
  changed: boolean; // 실시간 보강/결강 등 변경 여부
  group: string;    // 동시수업 그룹 문자 (없으면 '')
}

type Grid = Record<number, Record<number, TimetableCell>>; // weekday(0=월) -> period -> cell

export interface TimetableResult {
  grid: Grid;
  classTimes: string[];
  grades: number[];
  classes: number[];
  schoolName: string;
  stale:boolean;
  fetchedAt:string;
  weekStart:string|null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawData = Record<string, any>;

let metaCache: { meta: SiteMeta; at: number } | null = null;



async function fetchBuffer(url: string, token?:string|null): Promise<Buffer> {
  const res = await fetch(url, { headers: { 'User-Agent': UA,...(token?{'X-Hour-Token':token}:{}) }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} (${url})`);
  if(Number(res.headers.get('content-length')||0)>8_000_000)throw Error('시간표 제공처의 응답이 너무 커요. 잠시 후 다시 조회해 주세요.');
  if(!res.body)return Buffer.alloc(0);
  const reader=res.body.getReader(),chunks:Uint8Array[]=[];let total=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>8_000_000){await reader.cancel();throw Error('시간표 제공처의 응답이 너무 커요. 잠시 후 다시 조회해 주세요.')}chunks.push(value)}}finally{reader.releaseLock()}
  return Buffer.concat(chunks,total);
}

async function fetchEucKr(url: string): Promise<string> {
  return iconv.decode(await fetchBuffer(url), 'euc-kr');
}

async function fetchUtf8(url: string,token?:string|null): Promise<string> {
  return (await fetchBuffer(url,token)).toString('utf-8');
}

function hexEncodeEucKr(text: string): string {
  let hex = '';
  for (const byte of iconv.encode(text, 'euc-kr')) hex += '%' + byte.toString(16);
  return hex;
}

async function loadMeta(): Promise<SiteMeta> {
  const entryHtml = await fetchUtf8(ENTRY_URL);
  const frame = entryHtml.match(/<frame\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i);
  if (!frame) throw new Error('시간표 제공처의 접속 주소를 확인하지 못했어요. 잠시 후 다시 조회해 주세요.');
  const frameUrl = new URL(frame[1], ENTRY_URL);
  if (!['comci.net', 'www.comci.net'].includes(frameUrl.hostname)) throw new Error('시간표 제공처의 주소를 확인하지 못했어요. 잠시 후 다시 조회해 주세요.');
  const pageSource = await fetchEucKr(frameUrl.href);
  return { baseUrl: frameUrl.origin,weekField:extractComciganWeekField(pageSource), timesField:extractComciganTimesField(pageSource), cellKey:extractComciganCellKey(pageSource), request:extractComciganRequest(pageSource), ...extractComciganMetadata(pageSource), fields: extractComciganFields(pageSource), transport: extractComciganTransport(pageSource) };
}

async function getMeta(forceRefresh = false): Promise<SiteMeta> {
  if (!forceRefresh && metaCache && Date.now() - metaCache.at < META_TTL) return metaCache.meta;
  const meta = await loadMeta();
  metaCache = { meta, at: Date.now() };
  return meta;
}

async function searchSchool(meta: SiteMeta, keyword: string) {
  const query=meta.request.base64Search?encodeURIComponent(Buffer.from(meta.extractCode.split('?')[1]+encodeURIComponent(keyword)+meta.transport.suffix).toString('base64')):null;
  const url = meta.baseUrl + (query?meta.extractCode.split('?')[0]+'?'+query:meta.extractCode + hexEncodeEucKr(keyword) + meta.transport.suffix);
  const body = decodeComciganPayload(await fetchUtf8(url,meta.request.token),meta.transport.key,meta.transport.suffix.slice(1));
  const jsonStr = body.slice(0, body.lastIndexOf('}') + 1);
  const list = JSON.parse(jsonStr)?.['학교검색'];
  if (!list?.length) throw new Error('시간표 제공처에서 학교를 찾지 못했어요. 학교 이름과 지역을 확인해 주세요.');
  return extractComciganSchools(list,meta.transport.schoolCodeDivisor,meta.cellKey);
}

async function resolveSchoolCode(meta: SiteMeta,target:ComciganSchoolTarget): Promise<number> {
  if(target.code!==undefined)return target.code;
  const keyword=target.id==='cbsh'&&target.name===SCHOOL_DISPLAY_NAME?SCHOOL_KEYWORD:target.name;
  return selectComciganSchool(await searchSchool(meta,keyword),target);
}

async function fetchRawData(meta: SiteMeta, schoolCode: number): Promise<RawData> {
  const path = meta.extractCode.split('?')[0];
  const payload = `${meta.scPrefix}${schoolCode}_0_${meta.scSuffix}${meta.transport.suffix}`;
  const b64 = Buffer.from(payload).toString('base64');
  const url = meta.baseUrl + path + '?' + b64;
  const body = decodeComciganPayload(await fetchUtf8(url,meta.request.token),meta.transport.key,meta.transport.suffix.slice(1));
  const jsonStr = body.slice(0, body.lastIndexOf('}') + 1);
  const raw = JSON.parse(jsonStr);
  for (const [alias, field] of Object.entries({ '자료481': meta.fields.base, '자료147': meta.fields.daily, '자료446': meta.fields.teachers, '자료492': meta.fields.subjects })) {
    if (!Array.isArray(raw[field])) throw new Error('시간표 제공처의 응답을 확인하지 못했어요. 잠시 후 다시 조회해 주세요.');
    raw[alias] = meta.cellKey&&['자료446','자료492'].includes(alias)
      ? raw[field].map((value:unknown)=>typeof value==='string'?decodeComciganCell(value,meta.cellKey):value)
      : raw[field];
  }
  const week=meta.weekField?raw[meta.weekField]:raw['시작일'];
  raw['시작일']=validateComciganWeek(typeof week==='string'?decodeComciganCell(week,meta.cellKey):week);
  if(meta.timesField&&Array.isArray(raw[meta.timesField]))raw['일과시간']=raw[meta.timesField];
  return raw;
}

function makeLoader(target:ComciganSchoolTarget,legacy=false){
 let code:number|null=null;
 return createTimetableLoader(async()=>{
  try{const meta=await getMeta();code??=await resolveSchoolCode(meta,target);return await fetchRawData(meta,code)}
  catch{metaCache=null;code=null;const meta=await getMeta(true);code=await resolveSchoolCode(meta,target);return await fetchRawData(meta,code)}
 },legacy?fileTimetableStore():schoolTimetableStore(comciganTargetKey(target)));
}
const timetableLoader=makeLoader(LEGACY_COMCIGAN_SCHOOL,true);
const schoolLoaders=new Map<string,ReturnType<typeof makeLoader>>();
function loaderFor(target?:ComciganSchoolTarget){
 if(!target)return timetableLoader;
 const key=comciganTargetKey(target),existing=schoolLoaders.get(key);
 if(existing){schoolLoaders.delete(key);schoolLoaders.set(key,existing);return existing}
 const loader=makeLoader(validateComciganTarget(target));schoolLoaders.set(key,loader);
 if(schoolLoaders.size>64)schoolLoaders.delete(schoolLoaders.keys().next().value!);
 return loader;
}

// ---- 컴시간 웹뷰어 디코딩 로직 포팅 ----

/** 정수를 뒤에서부터 3자리씩 끊어 [마지막청크, 나머지] 형태로 분리한다 (예: 25024 -> [24, 25]) */
function splitDigits(value: number | string): [number, number] {
  const matches = String(value).match(/\d{1,3}(?=(?:\d{3})+(?!\d))|\d{1,3}$/g);
  if (!matches) return [0, 0];
  const nums = matches.reverse().map(Number);
  return [nums[0] ?? 0, nums[1] ?? 0];
}

/** 자료481(기본 시간표)과 자료147(당일 보정값)을 비교해 교사/과목 인덱스와 변경 여부를 구한다 */
function splitDaily(dailyRaw: number | string, defaultRaw: number | string, changeNotify: number) {
  const dailyStr = String(dailyRaw);
  if (changeNotify === 1) {
    if (dailyStr.startsWith('>')) {
      const [teacherIdx, subjectRaw] = splitDigits(dailyStr.slice(1));
      return { teacherIdx, subjectRaw, changed: true };
    }
    const [teacherIdx, subjectRaw] = splitDigits(dailyRaw);
    return { teacherIdx, subjectRaw, changed: false };
  }
  const [teacherIdx, subjectRaw] = splitDigits(dailyRaw);
  return { teacherIdx, subjectRaw, changed: dailyStr !== String(defaultRaw) };
}

/** 같은 교시에 동시수업(분반)이 있으면 그룹 문자(A_, B_ ...)를 반환한다 */
function groupLetter(subjectRaw: number, separator: number): string {
  if (separator === 100) return '';
  const group = Math.floor(subjectRaw / separator);
  return group >= 1 && group <= 26 ? String.fromCharCode(group + 64) : '';
}

function cleanTeacherName(name?: string): string {
  if (!name) return '';
  if ((name.includes('*') && !name.startsWith('*') && !name.endsWith('*')) || (name.length === 2 && name[1] === '*')) {
    return name;
  }
  return name.replace('*', '');
}

function decodeGrid(raw: RawData, grade: number, cls: number,maxPeriod=MAX_PERIOD): Grid {
  const separator: number = raw?.['분리'] ?? 100;
  const changeNotify: number = raw?.['변경알림'] ?? 0;
  const defaultData = raw?.['자료481']?.[grade]?.[cls];
  const dailyData = raw?.['자료147']?.[grade]?.[cls];
  const teacherNames: string[] = raw?.['자료446'] ?? [];
  const subjectNames: string[] = raw?.['자료492'] ?? [];
  const grid: Grid = {};

  if (!dailyData) return grid;

  for (let weekday = 1; weekday <= 5; weekday++) {
    const dailyDay = dailyData[weekday];
    if (!dailyDay) continue;
    const defaultDay = defaultData?.[weekday];

    for (let period = 1; period <= maxPeriod; period++) {
      const dailyRaw = dailyDay[period] ?? 0;
      const defaultRaw = defaultDay?.[period] ?? 0;
      const { teacherIdx, subjectRaw, changed } = splitDaily(dailyRaw, defaultRaw, changeNotify);
      if (teacherIdx <= 0) continue;

      const subjectIdx = subjectRaw % separator;
      const subject = subjectNames[subjectIdx];
      if (!subject || typeof subject !== 'string') continue;

      const wd = weekday - 1; // 0 = 월요일
      if (!grid[wd]) grid[wd] = {};
      grid[wd][period] = {
        subject,
        teacher: cleanTeacherName(teacherNames[teacherIdx]),
        changed,
        group: groupLetter(subjectRaw, separator),
      };
    }
  }
  return grid;
}

export async function getTimetable(grade: number, cls: number, opts?: { forceRefresh?: boolean;school?:ComciganSchoolTarget }): Promise<TimetableResult> {
  const {raw,at,stale} = await loaderFor(opts?.school).get(opts?.forceRefresh);

  const {grades,classes}=timetableChoices(raw?.['학급수'],grade,cls);

  const grid = decodeGrid(raw, grade, cls,opts?.school?12:MAX_PERIOD);
  if (!Object.keys(grid).length) throw new Error('선택한 학년·반의 시간표가 아직 제공되지 않아요.');
  return {
    grid,
    classTimes: raw?.['일과시간'] ?? [],
    grades,
    classes,
    schoolName: opts?.school?.name??SCHOOL_DISPLAY_NAME,
    stale,fetchedAt:new Date(at).toISOString(),weekStart:typeof raw["시작일"]==="string"?raw["시작일"]:null,
  };
}
