/** Decode the provider's string encoding only. Never execute third-party JavaScript. */
export function decodeComciganSource(html: string): string {
  if (html.length > 2_000_000) throw new Error('시간표 제공처의 응답이 너무 커요. 잠시 후 다시 조회해 주세요.');
  const decoded:string[]=[];const seen=new Set<string>();let layer=html,total=html.length;
  // Nested public wrappers have the same literal encoding. Decode data only;
  // never evaluate the provider's scripts or the functions inside them.
  for(let depth=0;depth<5;depth++){
    const next:string[]=[];
    for(const match of layer.matchAll(/\}\)\(\s*(\[\[)/g)){
      const start=match.index!+match[0].length-2;
      let end=start,level=0,quote='',escaped=false;
      for(;end<layer.length;end++){
        const ch=layer[end];if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue}
        if(ch==='"')quote=ch;else if(ch==='[')level++;else if(ch===']'&&--level===0){end++;break}
      }
      const tail=layer.slice(end).match(/^,\s*(\d+)\s*\);?/);if(!tail)continue;
      const literal=layer.slice(start,end),id=literal+':'+tail[1];if(seen.has(id))continue;seen.add(id);
      let parts:unknown;try{parts=JSON.parse(literal)}catch{throw Error('시간표 응답을 읽지 못했어요. 잠시 후 다시 조회해 주세요.')}
      const key=Number(tail[1]);if(!Array.isArray(parts)||parts.length>10000||!Number.isSafeInteger(key))throw Error('시간표 응답을 읽지 못했어요. 잠시 후 다시 조회해 주세요.');
      let source='';
      for(const part of parts){
        if(!Array.isArray(part)||part.length!==2||![0,1].includes(part[0])||typeof part[1]!=='string')throw Error('시간표 응답을 읽지 못했어요. 잠시 후 다시 조회해 주세요.');
        const [plain,value]=part as [number,string];if(plain){source+=value;continue}
        if(value.length%4||!/^[\da-f]*$/i.test(value))throw Error('시간표 응답을 읽지 못했어요. 잠시 후 다시 조회해 주세요.');
        for(let offset=0;offset<value.length;offset+=4)source+=String.fromCharCode(parseInt(value.slice(offset,offset+4),16)^((key+offset/4*13)&255));
      }
      total+=source.length;if(total>4_000_000)throw Error('시간표 제공처의 응답이 너무 커요. 잠시 후 다시 조회해 주세요.');next.push(source);
    }
    if(!next.length)break;decoded.push(...next);layer=next.join('\n');
  }
  return html+'\n'+decoded.join('\n');
}

const modernSearch = /\burl\s*:\s*['"]\.?(\/\d+\?)['"]\s*\+\s*(?:encodeURIComponent\(\s*)?btoa\(\s*['"](\d+l)['"]\s*\+\s*encodeURIComponent\(/;
const viewerField = '(자료\\d{1,6}|[A-Z]{2,8}\\d{1,6}|시작일)';

export function extractComciganMetadata(html: string) {
  const source = decodeComciganSource(html);
  const modern=source.match(modernSearch)
    ||source.match(/function\s+QAjaxSchool[\s\S]{0,300}?url\s*:\s*['"]\.?(\/\d+\?)['"][\s\S]{0,100}?btoa\(['"](\d+l)['"]/);
  const search = source.match(/function\s+school_ra\s*\(\s*sc\s*\)[\s\S]{0,200}?url\s*:\s*['"]\.?(\/\d+\?[^'"\s]+)['"]/i);
  const data = source.match(/sc_data\(\s*['"](\d+_)['"]\s*,[^,]+,\s*(\d+)/)
    ||(modern&&source.match(/\b[A-Za-z_$][\w$]*\(\s*['"](\d+_)['"]\s*,\s*(?:storage\.)?sc\s*,\s*(\d+)\s*,\s*['"][01]['"]\s*\)/));
  if ((!search&&!modern) || !data) throw new Error('시간표 제공처의 조회 정보를 확인하지 못했어요. 잠시 후 다시 조회해 주세요.');
  return { extractCode: modern?modern[1]+modern[2]:search![1], scPrefix: data[1], scSuffix: data[2] };
}

/** The provider rotates data field numbers too; derive their meaning from its renderer. */
export function extractComciganFields(html: string) {
  const source=decodeComciganSource(html);
  const patterns={
    base:new RegExp('원자료\\s*=\\s*Q자료\\(\\s*자료\\.'+viewerField+'\\['),
    daily:new RegExp('일일자료\\s*=\\s*Q자료\\(\\s*자료\\.'+viewerField+'\\['),
    teachers:new RegExp('성명\\s*=\\s*[\\w$가-힣]+\\(\\s*자료\\.'+viewerField+'\\['),
    subjects:new RegExp('과목명\\s*=\\s*[\\w$가-힣]+\\(\\s*자료\\.'+viewerField+'\\['),
  };
  const fields={} as Record<keyof typeof patterns,string>;
  for(const [name,pattern] of Object.entries(patterns)){
    const match=source.match(pattern);
    if(!match)throw new Error('시간표 제공처의 응답 형식을 확인하지 못했어요. 잠시 후 다시 조회해 주세요.');
    fields[name as keyof typeof patterns]=match[1];
  }
  return fields;
}

/** Read public transport constants from the viewer without executing its code. */
export function extractComciganTransport(html:string){
 const source=decodeComciganSource(html);
 const suffix=source.match(/btoa\([^;]{0,300}?['"](_(?:enc)?\d{1,9})['"]\s*\)/)?.[1]||'';
 let key=source.match(/CryptoJS\.enc\.Hex\.parse\(['"]([\da-f]{64})['"]\)/i)?.[1];
 // New viewers concatenate literal key fragments. Accept only indexed literal
 // concatenation, not arbitrary JavaScript expressions.
 if(!key){
  const split=source.match(/Hex\.parse\(\(function\(a\)\{return ([a\[\]\d+]+);\}\)\(\[((?:['"][\da-f]+['"],?)+)\]\)\)/i);
  if(split){const values=[...split[2].matchAll(/['"]([\da-f]+)['"]/gi)].map(m=>m[1]);key=split[1].split('+').map(v=>values[Number(v.match(/a\[(\d+)\]/)?.[1])]).join('')}
 }
 const divisor=source.match(/Math\.floor\(학교명단\[i\]\[0\]\/(\d+)\)\+2/)?.[1];
 if(suffix&&(!key||!/^[\da-f]{64}$/i.test(key)))throw new Error('시간표 제공처의 응답을 읽지 못했어요. 잠시 후 다시 조회해 주세요.');
 return {suffix,key:key||null,schoolCodeDivisor:divisor?Number(divisor):null};
}

export function extractComciganRequest(html:string){
 const source=decodeComciganSource(html);
 return {base64Search:modernSearch.test(source)||/function\s+QAjaxSchool/.test(source),token:source.match(/window\.__HourRequestToken\s*=\s*['"]([\da-f]+)['"]/i)?.[1]||null};
}

/** Literal byte keys in the public viewer are data, never executable code. */
export function extractComciganCellKey(html:string):number[]|null{
 const source=decodeComciganSource(html);
 const legacy=/function\s+QnmsbChange\(/.test(source);
 const match=legacy
  ?source.match(/function\s+QnmsbChange\([^)]*\)\s*\{[\s\S]{0,300}?String\.fromCharCode\(([\d,\s]+)\)/)
  :source.match(/function\s+[\w$]+\([^)]*\)\s*\{[^{}]{0,300}?String\.fromCharCode\(([\d,\s]+)\)[^{}]{0,150}?\batob\(/);
 if(!match){
  if(legacy)throw new Error('시간표 제공처의 응답을 읽지 못했어요. 잠시 후 다시 조회해 주세요.');
  return null;
 }
 const key=match[1].split(',').map(value=>Number(value.trim()));
 if(key.length<2||key.length>128||key.some(value=>!Number.isInteger(value)||value<0||value>255)){
  throw new Error('시간표 응답 형식을 확인하지 못했어요. 잠시 후 다시 조회해 주세요.');
 }
 return key;
}

export function decodeComciganCell(value:string,key:readonly number[]|null):string{
 if(!key||!value)return value;
 const bytes=Buffer.from(value,'base64');
 if(value.length>100000||!bytes.length||bytes.toString('base64')!==value)throw new Error('시간표 응답을 읽지 못했어요. 잠시 후 다시 조회해 주세요.');
 for(let index=0;index<bytes.length;index++)bytes[index]^=key[index%key.length];
 return new TextDecoder('euc-kr',{fatal:true}).decode(bytes);
}

export function extractComciganSchools(value:unknown,divisor:number|null,key:readonly number[]|null=null){
 if(!Array.isArray(value))throw new Error('시간표 제공처의 학교 목록을 확인하지 못했어요. 잠시 후 다시 조회해 주세요.');
 return value.flatMap(row=>{
  if(!Array.isArray(row)||typeof row[1]!=='string'||typeof row[2]!=='string')throw new Error('시간표 제공처의 학교 목록을 확인하지 못했어요. 잠시 후 다시 조회해 주세요.');
  const index=divisor?Math.floor(Number(row[0])/divisor)+2:3;
  if(divisor&&row[0]===0)return [];
  const encoded=row[index];
  const code=key&&typeof encoded==='string'?Number(decodeComciganCell(encoded,key)):encoded;
  if(!Number.isInteger(index)||index<3||!Number.isSafeInteger(code)||code<=0)throw new Error('시간표 제공처의 학교 정보를 확인하지 못했어요. 잠시 후 다시 조회해 주세요.');
  return [{region:decodeComciganCell(row[1],key),name:decodeComciganCell(row[2],key),code:code as number}];
 });
}

/** The provider's weekday renderer defines the selected week's first date. Data only. */
export function extractComciganWeekField(html:string):string|null{
 const source=decodeComciganSource(html),fields=new Set<string>();
 const identifier='[A-Za-z_$가-힣][\\w$가-힣]*',value='(?:'+identifier+'\\s*\\(\\s*)?(?:자료|H시간표)\\.'+viewerField+'\\s*\\)?';
 for(const expression of [new RegExp('(?:var|let|const)\\s+시작일\\s*=\\s*new\\s+Date\\s*\\(\\s*'+value+'\\s*\\)','g'),new RegExp('요일출력하기\\s*\\(\\s*'+value+'\\s*\\)','g')]){
  for(const match of source.matchAll(expression)){fields.add(match[1]);if(fields.size>1)throw Error('시간표 제공처의 주간 날짜 정보가 서로 달라요. 잠시 후 다시 조회해 주세요.');}
 }
 return fields.values().next().value??null;
}

export function extractComciganTimesField(html:string):string|null{
 return decodeComciganSource(html).match(new RegExp('자료\\.'+viewerField+'\\[\\s*교시\\s*-\\s*1\\s*\\]'))?.[1]??null;
}
