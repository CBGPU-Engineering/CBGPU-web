/** Navigation only: school/resource APIs remain responsible for authorization. */
type Context = {school_id:string;school:{id:string}};
type ResourceSelection = {status:string;current:Context|null};
export type GpuBookingPath='/compute'|'/dashboard';
export function schoolGpuBookingTarget(path:string,selection:ResourceSelection,singleSchoolLegacy=false):GpuBookingPath|null {
 if(path!=='/compute'&&path!=='/dashboard')return null;
 if(selection.status==='legacy')return singleSchoolLegacy&&path==='/compute'?'/dashboard':null;
 if(selection.status!=='ready'||!selection.current||selection.current.school_id!==selection.current.school.id||!selection.current.school_id)return null;
 const destination=selection.current.school_id==='cbsh'?'/dashboard':'/compute';
 return path===destination?null:destination;
}
/** Keep app context on the same origin, without forwarding action or redirect parameters. */
export function schoolGpuBookingHref(path:GpuBookingPath,search:string){
 if(path!=='/compute'&&path!=='/dashboard')throw Error('Invalid GPU booking destination');
 const current=new URLSearchParams(search),next=new URLSearchParams();
 const mode=current.get('mode');if(mode==='student'||mode==='researcher'||mode==='developer')next.set('mode',mode==='developer'?'researcher':mode);
 if(current.get('native')==='1')next.set('native','1');
 if(current.get('from')==='app')next.set('from','app');
 // This parameter is interpreted only by the loopback-only synthetic demo.
 if(process.env.NEXT_PUBLIC_CBGPU_DEMO==='1'&&current.get('demo-frame')==='web')next.set('demo-frame','web');
 return path+(next.size?'?'+next.toString():'');
}
