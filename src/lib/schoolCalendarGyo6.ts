import type{SchoolCalendarItem}from'./schoolCalendar';
function attribute(html:string,name:string){return html.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`,'i'))?.[2]}
function text(value:string){return value.replace(/<[^>]*>/g,' ').replace(/&(?:nbsp|#160);/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&#(x[\da-f]+|\d+);/gi,(_,n:string)=>{const code=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return code>0&&code<=0x10ffff?String.fromCodePoint(code):''}).replace(/\s+/g,' ').trim()}
export function isGyo6CalendarSource(source:string){try{const url=new URL(source);return url.protocol==='https:'&&url.hostname==='school.gyo6.net'&&!url.username&&!url.password&&/^\/[a-zA-Z0-9_-]+\/schl\/sv\/schdulView\/schdulCalendarView\.do$/.test(url.pathname)}catch{return false}}
/** Parse the official calendar's rendered day IDs, not unrelated menu/script text. */
export function parseGyo6SchoolCalendar(html:string,source:string):SchoolCalendarItem[]{
 if(html.length>2_000_000)throw Error('CALENDAR_RESPONSE_TOO_LARGE');if(!isGyo6CalendarSource(source))throw Error('CALENDAR_SOURCE_INVALID');
 const month=new URL(source).searchParams.get('selectYearMonth');if(!month||!/^20\d{2}(?:0[1-9]|1[0-2])$/.test(month))throw Error('CALENDAR_MONTH_REQUIRED');
 const selected=[...html.matchAll(/<input\b([^>]*)>/gi)].find(m=>attribute(m[1],'name')==='selectYearMonth');if(!selected||attribute(selected[1],'value')!==month)throw Error('CALENDAR_MONTH_MISMATCH');
 const cells=[...html.matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi)].filter(m=>/\bselectDay\b/.test(attribute(m[1],'class')||''));if(!cells.length)throw Error('CALENDAR_FORMAT_CHANGED');
 const items:SchoolCalendarItem[]=[];
 for(const cell of cells){const date=attribute(cell[1],'id');if(!date||!/^20\d{6}$/.test(date))throw Error('CALENDAR_DATE_INVALID');const year=Number(date.slice(0,4)),m=Number(date.slice(4,6)),day=Number(date.slice(6)),instant=new Date(Date.UTC(year,m-1,day));if(instant.getUTCFullYear()!==year||instant.getUTCMonth()+1!==m||instant.getUTCDate()!==day)throw Error('CALENDAR_DATE_INVALID');if(!date.startsWith(month))continue;
  for(const event of cell[2].matchAll(/<p\b([^>]*)>/gi)){const title=text(attribute(event[1],'data-schdulTitle')||'');if(!title)continue;items.push({title,link:source,pubDate:`${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6)}T00:00:00+09:00`,author:''});if(items.length>200)throw Error('CALENDAR_TOO_MANY_EVENTS');}
 }
 return items.sort((a,b)=>a.pubDate.localeCompare(b.pubDate));
}
