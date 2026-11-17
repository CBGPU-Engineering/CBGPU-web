import {createHash} from 'node:crypto';
import {WindowRateLimiter} from './requestSecurity';
/** Single-instance admission limits; identity/roles are always verified by the upstream. */
export class SchoolRequestLimits {
 private readonly coarse:WindowRateLimiter;
 private readonly anonymous:WindowRateLimiter;
 private readonly sessions:WindowRateLimiter;
 constructor(options:{coarsePerIp?:number;anonymousPerIp?:number;perToken?:number}={}){
  this.coarse=new WindowRateLimiter(options.coarsePerIp??12000,60_000);
  this.anonymous=new WindowRateLimiter(options.anonymousPerIp??2400,60_000);
  this.sessions=new WindowRateLimiter(options.perToken??120,60_000);
 }
 check(ip:string,authorization:string|null,publicRead:boolean,now=Date.now()):'ALLOW'|'AUTH_REQUIRED'|'RATE_LIMITED'{
  const credentials=authorization?.match(/^Bearer ([^\s,]{1,8192})$/i);
  if(!publicRead&&!credentials)return 'AUTH_REQUIRED';
  if(!this.coarse.allow(ip.slice(0,128),now))return 'RATE_LIMITED';
  if(publicRead)return this.anonymous.allow(ip.slice(0,128),now)?'ALLOW':'RATE_LIMITED';
  // Never store a raw credential or trust a client-decoded user/session claim.
  const key=createHash('sha256').update(credentials![1]).digest('hex');
  return this.sessions.allow(key,now)?'ALLOW':'RATE_LIMITED';
 }
}
