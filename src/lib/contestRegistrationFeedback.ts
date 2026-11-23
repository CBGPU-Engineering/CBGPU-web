export const CONTEST_REGISTRATION_BULK_LIMIT=200;
const count=(value:unknown)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:null;
/** A saved status change and its optional email delivery are distinct outcomes. */
export function contestRegistrationFeedback(value:{changed?:unknown;emailed?:unknown;warning?:unknown}){
 const changed=count(value.changed),emailed=count(value.emailed);
 const message=changed===null?'상태 변경 요청을 처리했어요.':changed===0?'변경된 참가자가 없어요.':`${changed}명의 참가자 상태를 변경했어요.`;
 const delivered=emailed!==null&&emailed>0?` ${emailed}명에게 이메일을 보냈어요.`:'';
 const warning=typeof value.warning==='string'&&value.warning.trim()?value.warning.trim():emailed===0&&changed!==null&&changed>0?'상태 변경은 저장했지만 이메일은 보내지 않았어요. 참가자에게 직접 안내해 주세요.':'';
 return{message:message+delivered,warning};
}
