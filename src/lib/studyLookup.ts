import type {SelfStudyEntry} from './eduset';

/** EduSet search returns outstay records too; those have no room or period. */
export function selectSelfStudyEntries(value:unknown):SelfStudyEntry[]{
 if(!Array.isArray(value))throw Error('학교 자습 조회 응답의 형식이 올바르지 않습니다.');
 const rows=value.filter(row=>row&&typeof row==='object'&&row.type==='selfstudy');
 const id=(value:unknown)=>typeof value==='number'?Number.isFinite(value)&&value>0:typeof value==='string'&&value.length>0;
 for(const row of rows){
  // Malformed real study records must not be converted into apparently free seats.
  if(!id(row.room?.id)||!Number.isInteger(Number(row.period))||Number(row.period)<1)throw Error('교실·신청자 정보가 없는 자습 내역이 있어 조회를 완료하지 못했습니다.');
 }
 return rows.map(row=>({...row,period:Number(row.period),student:{...row.student,id:id(row.student?.id)?row.student.id:id(row.studentId)?row.studentId:0,name:typeof row.student?.name==='string'?row.student.name:'학생 정보 확인 불가',grade:row.student?.grade??0,classNo:row.student?.classNo??0,number:row.student?.number??0}})) as SelfStudyEntry[];
}

export function selectStudyRooms(value:unknown){
 if(!Array.isArray(value))throw Error('교실 목록을 확인하지 못했습니다.');
 return value.map(room=>{
  if(!room||!['number','string'].includes(typeof room.id)||!String(room.id)||typeof room.hasSeats!=='boolean')throw Error('교실 목록 형식이 올바르지 않습니다.');
  return {...room,name:typeof room.name==='string'?room.name:`교실 ${room.id}`};
 });
}
export function selectStudyStudents(value:unknown){
 if(!Array.isArray(value))throw Error('학생 목록을 확인하지 못했습니다.');
 return value.filter(row=>row&&['number','string'].includes(typeof row.id)&&String(row.id)).map(row=>({...row,name:typeof row.name==='string'?row.name:'학생 정보 확인 불가'}));
}
