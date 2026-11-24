import {createDecipheriv,createHash,createHmac,timingSafeEqual} from 'node:crypto';

/** Decode the same authenticated public response as the official browser viewer. */
export function decodeComciganPayload(body:string,keyHex:string|null,format?:string):string{
 if(body.length>8_000_000)throw Error('시간표 제공처의 응답이 너무 커요. 잠시 후 다시 조회해 주세요.');
 body=body.replace(/\x00+$/,'');
 const numberedFormat=typeof format==='string'&&/^\d{1,9}$/.test(format)&&body.startsWith(format+':');
 if(!/^enc\d+:/.test(body)&&!numberedFormat)return body;
 if(!keyHex||!/^\w{64}$/.test(keyHex)||!/^[\da-f]+$/i.test(keyHex))throw Error('시간표 응답을 읽지 못했어요. 잠시 후 다시 조회해 주세요.');
 const parts=body.split(':');if(parts.length!==4)throw Error('시간표 응답 형식을 확인하지 못했어요. 잠시 후 다시 조회해 주세요.');
 const encoding=parts[0]==='enc1'?'hex':'base64';
 const binary=parts.slice(1).map(value=>{
  const bytes=Buffer.from(value,encoding);
  if(!value||bytes.toString(encoding)!==value)throw Error('시간표 응답을 읽지 못했어요. 잠시 후 다시 조회해 주세요.');
  return bytes;
 });
 const [iv,ciphertext,tag]=binary;
 if(iv.length!==16||tag.length!==32||!ciphertext.length||ciphertext.length%16)throw Error('시간표 응답 크기를 확인하지 못했어요. 잠시 후 다시 조회해 주세요.');
 const key=Buffer.from(keyHex,'hex');
 const expected=createHmac('sha256',createHash('sha256').update(key).digest()).update(parts.slice(0,3).join(':')).digest();
 if(!timingSafeEqual(expected,tag))throw Error('시간표 응답을 확인하지 못했어요. 잠시 후 다시 조회해 주세요.');
 const decipher=createDecipheriv('aes-256-cbc',key,iv);
 return new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat([decipher.update(ciphertext),decipher.final()])).replace(/\x00+$/,'');
}
