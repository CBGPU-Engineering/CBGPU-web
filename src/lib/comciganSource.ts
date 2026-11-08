/** Decode the provider's string encoding only. Never execute third-party JavaScript. */
export function decodeComciganSource(html: string): string {
  if (html.length > 2_000_000) throw new Error('시간표 제공처 응답이 너무 큽니다');
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
      let parts:unknown;try{parts=JSON.parse(literal)}catch{throw Error('잘못된 시간표 인코딩')}
      const key=Number(tail[1]);if(!Array.isArray(parts)||parts.length>10000||!Number.isSafeInteger(key))throw Error('잘못된 시간표 인코딩');
      let source='';
      for(const part of parts){
        if(!Array.isArray(part)||part.length!==2||![0,1].includes(part[0])||typeof part[1]!=='string')throw Error('잘못된 시간표 인코딩');
        const [plain,value]=part as [number,string];if(plain){source+=value;continue}
        if(value.length%4||!/^[\da-f]*$/i.test(value))throw Error('잘못된 시간표 인코딩');
        for(let offset=0;offset<value.length;offset+=4)source+=String.fromCharCode(parseInt(value.slice(offset,offset+4),16)^((key+offset/4*13)&255));
      }
      total+=source.length;if(total>4_000_000)throw Error('시간표 제공처 응답이 너무 큽니다');next.push(source);
    }
    if(!next.length)break;decoded.push(...next);layer=next.join('\n');
  }
  return html+'\n'+decoded.join('\n');
}

export function extractComciganMetadata(html: string) {
  const source = decodeComciganSource(html);
  const modern=source.match(/function\s+QAjaxSchool[\s\S]{0,300}?url\s*:\s*['"]\.?(\/\d+\?)['"][\s\S]{0,100}?btoa\(['"](\d+l)['"]/);
  const search = source.match(/function\s+school_ra\s*\(\s*sc\s*\)[\s\S]{0,200}?url\s*:\s*['"]\.?(\/\d+\?[^'"\s]+)['"]/i);
  const data = source.match(/sc_data\(\s*['"](\d+_)['"]\s*,[^,]+,\s*(\d+)/);
  if ((!search&&!modern) || !data) throw new Error('시간표 제공처의 조회 정보를 찾지 못했습니다');
  return { extractCode: search?.[1]||(modern![1]+modern![2]), scPrefix: data[1], scSuffix: data[2] };
}

/** The provider rotates data field numbers too; derive their meaning from its renderer. */
export function extractComciganFields(html: string) {
  const source=decodeComciganSource(html);
  const patterns={
    base:/원자료\s*=\s*Q자료\(자료\.(자료\d+)\[/,
    daily:/일일자료\s*=\s*Q자료\(자료\.(자료\d+)\[/,
    teachers:/성명\s*=\s*Q성명\(자료\.(자료\d+)\[/,
    subjects:/과목명\s*=\s*Q과목명\(자료\.(자료\d+)\[/,
  };
  const fields={} as Record<keyof typeof patterns,string>;
  for(const [name,pattern] of Object.entries(patterns)){
    const match=source.match(pattern);
    if(!match)throw new Error('시간표 제공처의 데이터 구조를 확인하지 못했습니다');
    fields[name as keyof typeof patterns]=match[1];
  }
  return fields;
}

/** Read public transport constants from the viewer without executing its code. */
export function extractComciganTransport(html:string){
 const source=decodeComciganSource(html);
 const suffix=source.match(/btoa\([^;]{0,300}?['"](_enc\d+)['"]\)/)?.[1]||'';
 let key=source.match(/CryptoJS\.enc\.Hex\.parse\(['"]([\da-f]{64})['"]\)/i)?.[1];
 // New viewers concatenate literal key fragments. Accept only indexed literal
 // concatenation, not arbitrary JavaScript expressions.
 if(!key){
  const split=source.match(/Hex\.parse\(\(function\(a\)\{return ([a\[\]\d+]+);\}\)\(\[((?:['"][\da-f]+['"],?)+)\]\)\)/i);
  if(split){const values=[...split[2].matchAll(/['"]([\da-f]+)['"]/gi)].map(m=>m[1]);key=split[1].split('+').map(v=>values[Number(v.match(/a\[(\d+)\]/)?.[1])]).join('')}
 }
 const divisor=source.match(/Math\.floor\(학교명단\[i\]\[0\]\/(\d+)\)\+2/)?.[1];
 if(suffix&&(!key||!/^[\da-f]{64}$/i.test(key)))throw new Error('시간표 제공처의 응답 해석 정보를 찾지 못했습니다');
 return {suffix,key:key||null,schoolCodeDivisor:divisor?Number(divisor):null};
}

export function extractComciganRequest(html:string){
 const source=decodeComciganSource(html);
 return {base64Search:/function\s+QAjaxSchool/.test(source),token:source.match(/window\.__HourRequestToken\s*=\s*['"]([\da-f]+)['"]/i)?.[1]||null};
}

export function extractComciganSchools(value:unknown,divisor:number|null){
 if(!Array.isArray(value))throw new Error('시간표 제공처의 학교 목록이 올바르지 않습니다');
 return value.map(row=>{
  if(!Array.isArray(row)||typeof row[1]!=='string'||typeof row[2]!=='string')throw new Error('시간표 제공처의 학교 목록이 올바르지 않습니다');
  const index=divisor?Math.floor(Number(row[0])/divisor)+2:3;
  const code=row[index];
  if(!Number.isInteger(index)||index<3||!Number.isSafeInteger(code)||code<=0)throw new Error('시간표 제공처의 학교 코드가 올바르지 않습니다');
  return {region:row[1],name:row[2],code:code as number};
 });
}
