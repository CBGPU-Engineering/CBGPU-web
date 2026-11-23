/** Only shared read requests use this queue. Never retry application writes. */
export function createStudyReadQueue(limit=4,maxQueued=80,maxWaitMs=5_000){
 let active=0,failures=0,blockedUntil=0;const waiting:Array<()=>void>=[];
 return async function run<T extends {status:number}>(read:()=>Promise<T>):Promise<T>{
  if(Date.now()<blockedUntil)throw Error('학교 조회 연결이 잠시 지연되고 있어요.');
  if(active>=limit){
   if(waiting.length>=maxQueued)throw Error('조회 요청이 많아요. 잠시 후 다시 조회해 주세요.');
   await new Promise<void>((resolve,reject)=>{
    let settled=false;
    const admit=()=>{if(settled)return;settled=true;clearTimeout(timer);resolve()};
    const timer=setTimeout(()=>{
     if(settled)return;settled=true;
     const index=waiting.indexOf(admit);if(index>=0)waiting.splice(index,1);
     reject(Error('학교 조회가 지연되고 있어요. 잠시 후 다시 조회해 주세요.'));
    },maxWaitMs);
    waiting.push(admit);
   });
  }else active++;
  try{
   if(Date.now()<blockedUntil)throw Error('학교 조회 연결이 잠시 지연되고 있어요.');
   const value=await read();
   if(value.status===429){blockedUntil=Date.now()+20_000}else if(value.status>=500){failures++;if(failures>=4)blockedUntil=Date.now()+20_000}else{failures=0;blockedUntil=0}
   return value;
  }catch(error){failures++;if(failures>=4)blockedUntil=Date.now()+20_000;throw error}
  finally{const next=waiting.shift();if(next)next();else active--}
 };
}
