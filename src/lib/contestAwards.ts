export const DEFAULT_AWARD_CATEGORIES=[
 {name:'Best Vibe Build',description:'가장 뛰어난 서비스'},
 {name:'Best Agentic Connection',description:'서비스 간 연결과 협업'},
 {name:'Most Creative Idea',description:'가장 창의적인 아이디어'},
 {name:"People's Choice",description:'참가자 인기상'},
] as const;
export type AwardCategory={id:string;name:string;description:string;position?:number};
export type AwardSettings={enabled:boolean;starts_at:string|null;closes_at:string|null;results_published:boolean};
/** Public fields are intentionally separate from private contest answers and uploaded files. */
export type ShowcaseCard={id:string;title:string;summary:string;demo_url:string|null;is_own:boolean};
export type OwnShowcase=Omit<ShowcaseCard,'is_own'>&{submission_user_id:string;team_id:string|null;enabled:boolean};
export type AwardsState={settings:AwardSettings;categories:AwardCategory[];showcases:ShowcaseCard[];my_showcases:OwnShowcase[];my_votes:{category_id:string;showcase_id:string}[];can_vote:boolean;can_manage:boolean;server_time:string|number;results_available:boolean;vote_reason?:string};
export type AwardResultEntry={showcase_id:string;title:string;votes:number;is_winner:boolean};
export type AwardResults={categories:{id:string;name:string;description:string;total_votes:number;entries:AwardResultEntry[];tied:boolean}[];server_time:string|number};
export function awardVotingPhase(settings:AwardSettings,now:number|null):'disabled'|'checking'|'pending'|'open'|'closed'{if(now!==null&&settings.closes_at&&new Date(settings.closes_at).getTime()<=now)return 'closed';if(!settings.enabled)return 'disabled';if(now===null)return 'checking';if(settings.starts_at&&new Date(settings.starts_at).getTime()>now)return 'pending';return 'open';}
export function rankedAwardEntries(entries:AwardResultEntry[]):(AwardResultEntry&{rank:number;tied:boolean})[]{const sorted=[...entries].sort((a,b)=>b.votes-a.votes||a.title.localeCompare(b.title));const counts=new Map<number,number>();for(const entry of entries)counts.set(entry.votes,(counts.get(entry.votes)||0)+1);let rank=0;return sorted.map((entry,index)=>{if(index===0||entry.votes!==sorted[index-1].votes)rank=index+1;return {...entry,rank,tied:(counts.get(entry.votes)||0)>1}})}
export function safeShowcaseUrl(value:string|null):string|null{if(!value)return null;try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password?url.toString():null}catch{return null}}
export function awardsServerMillis(value:string|number):number|null{const parsed=typeof value==='number'?value*1000:new Date(value).getTime();return Number.isFinite(parsed)?parsed:null}
