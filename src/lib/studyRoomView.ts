import type {Room,Seat,Obstacle,Student,SelfStudyEntry,SelfStudyStatus} from './eduset';
export interface Occupant {label:string;period:number;status:SelfStudyStatus}
export interface OccupancyEntry {roomId:number;roomName:string;seatName:string;period:number;label:string;studentId:number;status:SelfStudyStatus}
export interface RoomData {room:Room;seats:Seat[];obstacles:Obstacle[];occupantsBySeat:Map<number,Occupant[]>;occupancy:OccupancyEntry[];failed?:boolean;failedReason?:string}
export function formatStudentLabel(student:Student):string{
 if(!student||![student.grade,student.classNo,student.number].every(n=>Number.isFinite(n)&&n>0))return student?.name||'학생 정보 확인 불가';
 return `${student.grade*1000+student.classNo*100+student.number} ${student.name}`;
}
export function buildStudyRoom(room:Room,composition:unknown,entries:SelfStudyEntry[]):RoomData{
 const rows=entries.filter(e=>String(e.room.id)===String(room.id)&&e.status!=='REJECTED');
 const data:RoomData={room,seats:[],obstacles:[],occupantsBySeat:new Map(),occupancy:rows.map(e=>({roomId:room.id,roomName:room.name,seatName:e.seat?.name||'',period:e.period,label:formatStudentLabel(e.student),studentId:e.student.id,status:e.status}))};
 if(!room.hasSeats)return data;
 try{
  const value=composition as {seats?:Seat[];obstacles?:Obstacle[]}|null;
  if(!Array.isArray(value?.seats))throw Error('좌석 배치를 불러오지 못했습니다.');
  const seats=value.seats.map(s=>{if(!s||!['number','string'].includes(typeof s.id)||!Number.isFinite(Number(s.x))||!Number.isFinite(Number(s.y)))throw Error('좌석 배치 형식이 올바르지 않습니다.');return {...s,x:Number(s.x),y:Number(s.y),name:typeof s.name==='string'?s.name:String(s.id)}});
  const byId=new Map(seats.map(s=>[String(s.id),s]));if(byId.size!==seats.length)throw Error('중복된 좌석 정보가 있어 빈자리를 확인할 수 없습니다.');
  data.seats=seats;data.obstacles=Array.isArray(value?.obstacles)?value.obstacles.filter(o=>o&&[o.x,o.y,o.w,o.h].every(Number.isFinite)).map(o=>({...o,name:typeof o.name==='string'?o.name:''})):[];
  for(const row of rows){
   const seat=row.seat&&byId.get(String(row.seat.id));
   if(!seat||!['PENDING','APPROVED'].includes(row.status))throw Error('신청 내역과 좌석 배치가 일치하지 않아 빈자리를 확인할 수 없습니다.');
   const occupants=data.occupantsBySeat.get(seat.id)||[];occupants.push({label:formatStudentLabel(row.student),period:row.period,status:row.status});data.occupantsBySeat.set(seat.id,occupants);
  }
 }catch(error){data.failed=true;data.failedReason=error instanceof Error?error.message:'좌석 현황을 확인하지 못했습니다.'}
 return data;
}
/** Partial layout failure is local to its room; concurrent school reads are bounded. */
export async function loadStudyRooms(rooms:Room[],entries:SelfStudyEntry[],layout:(id:number)=>Promise<unknown>,limit=4):Promise<RoomData[]>{
 const result:RoomData[]=Array(rooms.length);let next=0;
 await Promise.all(Array.from({length:Math.min(Math.max(1,limit),rooms.length)},async()=>{while(next<rooms.length){const index=next++,room=rooms[index];let composition:unknown=null;if(room.hasSeats)try{composition=await layout(room.id)}catch{}result[index]=buildStudyRoom(room,composition,entries)}}));
 return result;
}
