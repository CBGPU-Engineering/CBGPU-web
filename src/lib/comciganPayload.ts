import {createDecipheriv,createHash,createHmac,timingSafeEqual} from 'node:crypto';

/** Decode the same authenticated public response as the official browser viewer. */
export function decodeComciganPayload(body:string,keyHex:string|null):string{
 if(body.length>8_000_000)throw Error('시간표 제공처 응답이 너무 큽니다');
 body=body.replace(/\x00+$/,'');
 if(!/^enc[12]:/.test(body))return body;
 if(!keyHex||!/^\w{64}$/.test(keyHex)||!/^[\da-f]+$/i.test(keyHex))throw Error('시간표 응답 해석 정보가 없습니다');
 const parts=body.split(':');if(parts.length!==4)throw Error('잘못된 시간표 응답 형식');
 const encoding=parts[0]==='enc2'?'base64':'hex';
 const binary=parts.slice(1).map(value=>{
  const bytes=Buffer.from(value,encoding);
  if(!value||bytes.toString(encoding)!==value)throw Error('잘못된 시간표 응답 인코딩');
  return bytes;
 });
 const [iv,ciphertext,tag]=binary;
 if(iv.length!==16||tag.length!==32||!ciphertext.length||ciphertext.length%16)throw Error('잘못된 시간표 응답 크기');
 const key=Buffer.from(keyHex,'hex');
 const expected=createHmac('sha256',createHash('sha256').update(key).digest()).update(parts.slice(0,3).join(':')).digest();
 if(!timingSafeEqual(expected,tag))throw Error('시간표 응답 무결성 확인 실패');
 const decipher=createDecipheriv('aes-256-cbc',key,iv);
 return new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat([decipher.update(ciphertext),decipher.final()])).replace(/\x00+$/,'');
}
