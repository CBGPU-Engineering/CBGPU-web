const MEAL_TYPES = ['조식', '중식', '석식'];

function stripTags(s: string) {
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function removeAllergens(s: string) {
  return s.replace(/\s*\([0-9.]+\)\s*/g, '').trim();
}

export interface MealItem {
  type: string;
  items: string[];
  calories: string;
}

// Parse all <dl> blocks from a day's HTML section
function parseDayHtml(html: string): MealItem[] {
  const meals: MealItem[] = [];
  const dlRegex = /<dl[^>]*>([\s\S]*?)<\/dl>/gi;
  let dlMatch;
  while ((dlMatch = dlRegex.exec(html)) !== null) {
    const dlHtml = dlMatch[1];

    const dtMatch = dlHtml.match(/<dt[^>]*>([\s\S]*?)<\/dt>/i);
    if (!dtMatch) continue;

    const typeText = stripTags(dtMatch[1]).trim();
    if (!MEAL_TYPES.includes(typeText)) continue;

    const ddMatch = dlHtml.match(/<dd[^>]*>([\s\S]*?)<\/dd>/i);
    if (!ddMatch) continue;

    const items: string[] = [];
    const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let liMatch;
    while ((liMatch = liRegex.exec(ddMatch[1])) !== null) {
      const item = removeAllergens(stripTags(liMatch[1]));
      if (item) items.push(item);
    }

    if (items.length > 0) meals.push({ type: typeText, items, calories: '' });
  }
  return meals;
}

// Find the <a href="...?ymd=YYYYMMDD"> cell and extract its contents
export function parseMealPage(html: string, dateYmd: string): MealItem[] {
  const linkIdx = html.indexOf(`?ymd=${dateYmd}`);
  if (linkIdx === -1) return [];

  const before = html.slice(0, linkIdx);
  const aStart = before.lastIndexOf('<a ');
  if (aStart === -1) return [];

  const fromA = html.slice(aStart);
  const aEnd = fromA.indexOf('</a>');
  if (aEnd === -1) return [];

  return parseDayHtml(fromA.slice(0, aEnd));
}

export type MealTarget={schoolId:string;provider:'SCHOOL_WEBSITE'|'NEIS';url:string;allowedHosts:string[];officialId?:string;officeCode?:string;version:number};
export function schoolMealTarget(schoolId:string,value:unknown):MealTarget{const dto=value as Record<string,unknown>;if(!dto||dto.school_id!==schoolId||dto.status!=='READY')throw Error('SCHOOL_SOURCE_NOT_CONFIGURED');const version=Number.isSafeInteger(dto.version)?Number(dto.version):0;if(dto.meal_provider==='NEIS'&&typeof dto.official_id==='string'&&/^\d{7,12}$/.test(dto.official_id)&&typeof dto.education_office_code==='string'&&/^[A-Z]\d{2}$/.test(dto.education_office_code))return{schoolId,provider:'NEIS',url:'https://open.neis.go.kr/hub/mealServiceDietInfo',allowedHosts:['open.neis.go.kr'],officialId:dto.official_id,officeCode:dto.education_office_code,version};if(dto.meal_provider==='SCHOOL_WEBSITE'&&typeof dto.meal_url==='string'&&Array.isArray(dto.allowed_hosts)&&dto.allowed_hosts.every(x=>typeof x==='string'))return{schoolId,provider:'SCHOOL_WEBSITE',url:dto.meal_url,allowedHosts:dto.allowed_hosts as string[],version};throw Error('SCHOOL_SOURCE_NOT_CONFIGURED')}
export function validMealDate(value:string){if(!/^20\d{6}$/.test(value))return false;const date=new Date(value.slice(0,4)+'-'+value.slice(4,6)+'-'+value.slice(6,8)+'T00:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10).replaceAll('-','')===value}
export function parseNeisMeals(value:unknown,target:MealTarget,date:string):MealItem[]{const dto=value as {RESULT?:{CODE?:string};mealServiceDietInfo?:{row?:Record<string,string>[];head?:unknown}[]};if(dto?.RESULT?.CODE==='INFO-200')return[];const rows=dto?.mealServiceDietInfo?.flatMap(section=>section.row||[]);if(!rows)throw Error('MEAL_PROVIDER_INVALID_RESPONSE');return rows.filter(row=>row.ATPT_OFCDC_SC_CODE===target.officeCode&&row.SD_SCHUL_CODE===target.officialId&&row.MLSV_YMD===date).map(row=>({type:MEAL_TYPES[Number(row.MMEAL_SC_CODE)-1]||'',items:String(row.DDISH_NM||'').split(/<br\s*\/?>/i).map(stripTags).filter(Boolean),calories:String(row.CAL_INFO||'')})).filter(row=>!!row.type&&!!row.items.length)}
