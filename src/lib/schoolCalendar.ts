export type SchoolCalendarItem={title:string;link:string;pubDate:string;author:string};
function text(html:string){return html.replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&quot;/gi,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim()}
/** The CBE school calendar is an HTML calendar, not an RSS bulletin board. */
export function parseCbeSchoolCalendar(html:string,source:string):SchoolCalendarItem[]{
 if(html.length>2_000_000)throw Error('CALENDAR_RESPONSE_TOO_LARGE');
 const list=html.match(/<ul\b[^>]*class=["'][^"']*\btch-sch-lst\b[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i)?.[1];
 if(list===undefined)throw Error('CALENDAR_FORMAT_CHANGED');
 const items:SchoolCalendarItem[]=[];
 for(const match of list.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)){
  const block=match[1],date=text(block.match(/<dt\b[^>]*>([\s\S]*?)<\/dt>/i)?.[1]??'');
  const day=date.match(/^(\d{2}|\d{4})\.(\d{1,2})\.(\d{1,2})/);if(!day)throw Error('CALENDAR_DATE_INVALID');
  const year=day[1].length===2?2000+Number(day[1]):Number(day[1]),month=Number(day[2]),d=Number(day[3]);
  const instant=new Date(Date.UTC(year,month-1,d));if(instant.getUTCFullYear()!==year||instant.getUTCMonth()+1!==month||instant.getUTCDate()!==d)throw Error('CALENDAR_DATE_INVALID');
  const title=text(block.match(/<dd\b[^>]*class=["'][^"']*\btch-tit\b[^"']*["'][^>]*>([\s\S]*?)<\/dd>/i)?.[1]??'').replace(/^[-·]\s*/,'');
  if(!title)continue;
  items.push({title,link:source,pubDate:`${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}T00:00:00+09:00`,author:''});
 }
 return items.sort((a,b)=>a.pubDate.localeCompare(b.pubDate));
}
