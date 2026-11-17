/** Deployment identity/project continuity is separate from physical school compute admission. */
export function scopedAccountMode(env:Readonly<Record<string,string|undefined>>=process.env){
 const values=[env.CBGPU_MULTISCHOOL_V1,env.CBGPU_ACCOUNT_V2];
 for(const value of values)if(value!==undefined&&!['','0','false','1','true'].includes(value))throw Error('Account authorization configuration is unavailable');
 return values.some(value=>value==='1'||value==='true');
}
export const deploymentAccessV2=()=>scopedAccountMode();
export function deploymentProfileAllowed(profile:{id?:unknown;account_status?:unknown;is_approved?:unknown}|null,userId:string,v2:boolean){return!!profile&&profile.id===userId&&(v2?['ACTIVE','PENDING_VERIFICATION','REVERIFICATION_REQUIRED'].includes(String(profile.account_status)):profile.is_approved!==false)}
export function serverCreationState(draft:boolean,v2:boolean,now:string){return v2&&draft?{status:'pending',deploy_requested_at:null}:{status:'approved',deploy_requested_at:now}}
export async function canUseDeploymentCompute(client:{rpc:(name:string,args:Record<string,string>)=>PromiseLike<{data:unknown;error:unknown}>},actor:string,owner=actor){for(const user of new Set([actor,owner])){const{data,error}=await client.rpc('cbgpu_service_can_use_resource',{user_id:user,resource:'school_compute',target_school:'cbsh'});if(error)throw Error('DEPLOYMENT_RESOURCE_AUTHORITY_UNAVAILABLE');if(data!==true)return false}return true}
export function frontendExecutionRequested(path:readonly string[],method:string,value:Record<string,unknown>|undefined){return path[0]==='projects'&&method==='POST'&&(path.length===1&&value?.draft!==true||path.length===3&&path[2]==='deploy')}
