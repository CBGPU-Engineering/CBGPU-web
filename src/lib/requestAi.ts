import {aiRequest,waitForAiJob,type AiJob} from './aiClient';
export type AiMode='tags'|'poll_insight'|'daily'|'news'|'study_tags'|'timetable'|'summary'|'improve'|'explain';
export async function requestAi(mode:AiMode,input:string,options:{signal?:AbortSignal;userId?:string;onJob?:(id:string)=>void;onProgress?:(job:AiJob)=>void}={}):Promise<string>{
 const result=await aiRequest('','POST',{mode,input:input.slice(0,12000)},options.signal,options.userId);
 if(result.result)return result.result;
 options.onJob?.(result.job_id);
 const job=await waitForAiJob(result.job_id,options);return job.result?.choices?.[0]?.message.content||job.result?.text||'';
}
