/** UI intent belongs to the account that confirmed it, not whichever account is current later. */
export async function confirmedAccountSession<T extends {user:{id:string};access_token:string}>(owner:string,current:()=>boolean,read:()=>Promise<{data:{session:T|null}}> ):Promise<T>{
 if(!current())throw new Error('계정이 바뀌었어요. 현재 계정에서 다시 확인해 주세요.');
 const{data:{session}}=await read();
 if(!current()||!session||session.user.id!==owner)throw new Error('계정이 바뀌었거나 로그인이 만료됐어요. 현재 계정에서 다시 확인해 주세요.');
 return session;
}
