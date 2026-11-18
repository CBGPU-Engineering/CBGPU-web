const uuid=(value:string|undefined)=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
/** Exhaustive exceptions for existing owner-checked metadata/cleanup and local robot operations.
 * Unknown routes, inference, retries, document preparation, status/infrastructure and model
 * inventory remain resource-gated. This never replaces account or upstream owner checks.
 */
export function aiResourceRequired(path:string[],method:string):boolean{
 const [kind,id,action,child]=path;
 if(method==='GET'){
  if(path.length===1&&['chats','jobs','projects','keys'].includes(kind))return false;
  if(path.length===2&&['chats','jobs','uploads','downloads'].includes(kind)&&uuid(id))return false;
  if(path.length===3&&uuid(id)&&(kind==='jobs'&&action==='artifact'||kind==='uploads'&&action==='text'||kind==='chats'&&action==='events'))return false;
 }
 if(method==='DELETE'){
  if(path.length===2&&['chats','jobs','projects','uploads','keys'].includes(kind)&&uuid(id))return false;
  if(path.length===4&&kind==='projects'&&uuid(id)&&action==='files'&&uuid(child))return false;
 }
 if(method==='POST'){
  if(path.length===1&&['keys','chats','projects'].includes(kind))return false; // empty metadata only
  if(path.length===2&&kind==='chats'&&uuid(id))return false; // title only
  if(path.length===3&&kind==='jobs'&&uuid(id)&&['cancel','download'].includes(action))return false;
 }
 if(kind==='v1'&&id==='robotics'){
  if(action==='devices'){
   if(path.length===3&&['GET','POST'].includes(method))return false;
   if(path.length===4&&uuid(child)&&['GET','DELETE'].includes(method))return false;
   if(path.length===5&&uuid(child)&&['control','goal','stop','pair'].includes(path[4])&&method==='POST')return false;
  }
  if(action==='plans'&&path.length===4&&uuid(child)&&['GET','DELETE'].includes(method))return false;
 }
 return true;
}
