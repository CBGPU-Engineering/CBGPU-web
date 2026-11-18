export type SchoolFeedItem={title:string;link:string;pubDate:string;author:string};
function extract(tag:string,xml:string){return(xml.match(new RegExp(`<${tag}><\\!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`))?.[1]||xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`))?.[1]||'').trim()}
/** Correct only the official Gyo6 RSS producer's missing scheme/repeated site prefix. */
export function schoolFeedLink(value:string,source:string):string|null{
 try{const base=new URL(source),site=base.hostname==='school.gyo6.net'?base.pathname.match(/^\/([a-zA-Z0-9_-]+)\/na\/ntt\/selectRssFeed\.do$/)?.[1]:null;
  let raw=value;if(site&&raw.startsWith('school.gyo6.net/'))raw='https://'+raw;
  const target=new URL(raw,base);if(target.protocol!=='https:'||target.origin!==base.origin||target.username||target.password)return null;
  if(site){const repeated='/'+site+'/'+site+'/';if(target.pathname.startsWith(repeated))target.pathname=target.pathname.slice(site.length+1);if(!target.pathname.startsWith('/'+site+'/'))return null;}
  return target.href;
 }catch{return null}
}
export function parseSchoolRSS(xml:string,source:string):SchoolFeedItem[]{
 if(xml.length>2_000_000)throw Error('SCHOOL_FEED_TOO_LARGE');
 if(!/<(?:rss|rdf:RDF)\b/i.test(xml)||!/<channel\b/i.test(xml))throw Error('UNSUPPORTED_SCHOOL_FEED');
 const items:SchoolFeedItem[]=[];
 for(const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)){const block=match[1],title=extract('title',block),link=schoolFeedLink(extract('link',block)||extract('guid',block),source);if(title&&link)items.push({title,link,pubDate:extract('pubDate',block),author:extract('author',block)});if(items.length>200)throw Error('SCHOOL_FEED_TOO_MANY_ITEMS');}
 return items;
}
