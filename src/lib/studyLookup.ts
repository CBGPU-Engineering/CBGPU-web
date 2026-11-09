import type {SelfStudyEntry} from './eduset';

/** EduSet search returns outstay records too; those have no room or period. */
export function selectSelfStudyEntries(value:unknown):SelfStudyEntry[]{
 if(!Array.isArray(value))throw Error('학교 자습 조회 응답의 형식이 올바르지 않습니다.');
 const rows=value.filter(row=>row&&typeof row==='object'&&row.type==='selfstudy');
 const id=(value:unknown)=>typeof value==='number'?Number.isFinite(value)&&value>0:typeof value==='string'&&value.length>0;
 for(const row of rows){
  // Malformed real study records must not be converted into apparently free seats.
  if(!id(row.room?.id)||!id(row.student?.id)||!Number.isInteger(Number(row.period))||Number(row.period)<1)throw Error('교실·신청자 정보가 없는 자습 내역이 있어 조회를 완료하지 못했습니다.');
 }
 return rows.map(row=>({...row,period:Number(row.period)})) as SelfStudyEntry[];
}
