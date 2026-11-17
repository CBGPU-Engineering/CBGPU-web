/** Server-provided school week only: no guessed dates for stale/manual data. */
export function timetableWeekDates(value:string|null|undefined){
 if(!value||!/^\d{4}-\d{2}-\d{2}$/.test(value))return [];
 const [year,month,day]=value.split('-').map(Number),start=new Date(Date.UTC(year,month-1,day));
 if(start.getUTCFullYear()!==year||start.getUTCMonth()!==month-1||start.getUTCDate()!==day||start.getUTCDay()!==1)return [];
 return Array.from({length:5},(_,index)=>{const date=new Date(start.getTime()+index*86400000);return {date:date.toISOString().slice(0,10),label:`${date.getUTCMonth()+1}.${date.getUTCDate()}`,fullLabel:`${date.getUTCFullYear()}년 ${date.getUTCMonth()+1}월 ${date.getUTCDate()}일`}});
}
