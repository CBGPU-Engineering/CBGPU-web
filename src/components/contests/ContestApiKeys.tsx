'use client';
import Link from'next/link';
import{useCallback,useEffect,useRef,useState}from'react';
import{ArrowLeft,Copy,KeyRound,RefreshCw,Trash2}from'lucide-react';
import{Button}from'@/components/ui/button';
import{Input}from'@/components/ui/input';
import{Dropdown}from'@/components/ui/dropdown';
import{useAuth}from'@/lib/useAuth';
import{useAlert}from'@/lib/alert';
import{supabase}from'@/lib/supabase';
import{contestKeyTarget}from'@/lib/contestKeyTarget';

type Event={id:string;title:string};
type Token={id:string;name:string;scopes:string[];allowed_contest_ids:string[];expires_at:string;revoked_at:string|null;created_at:string};
const scopes=[['contests:read','대회 정보·내 신청 조회'],['contests:register','내 계정으로 참가 신청'],['contests:cancel','내 참가 신청 취소']]as const;
const endpoint='/api/ai/v1/contests';
const message=(error:unknown)=>error instanceof Error?error.message:'요청을 처리하지 못했어요.';
export function ContestApiKeys(){const{user}=useAuth();return <KeysForAccount key={user?.id??'signed-out'}/>}
function KeysForAccount(){
 const{user}=useAuth(),{showError,showSuccess,confirm}=useAlert();
 const owner=useRef(user?.id);owner.current=user?.id;const generation=useRef(0);
 const[events,setEvents]=useState<Event[]>([]),[tokens,setTokens]=useState<Token[]>([]),[selected,setSelected]=useState<string[]>([]);
 const[permissions,setPermissions]=useState<string[]>(['contests:read','contests:register']);
 const[name,setName]=useState('외부 서비스 연동'),[days,setDays]=useState('30'),[target,setTarget]=useState('');
 const[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const[secret,setSecret]=useState<{value:string;expires_at:string;owner:string}|null>(null);
 const api=useCallback(async(path:string,method='GET',body?:unknown)=>{
  const expected=user?.id;if(!expected)throw Error('CBGPU에 로그인해 주세요.');
  const{data,error}=await supabase.auth.getSession();
  if(error||!data.session||data.session.user.id!==expected||owner.current!==expected)throw Error('로그인 상태를 다시 확인해 주세요.');
  const response=await fetch(endpoint+path,{method,headers:{Authorization:'Bearer '+data.session.access_token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(25_000)});
  const value=await response.json();if(owner.current!==expected)throw Error('계정이 변경됐어요. 다시 시도해 주세요.');
  if(!response.ok)throw Error(value.message||'대회 API 요청에 실패했어요.');return value;
 },[user?.id]);
 const load=useCallback(async()=>{
  const mine=++generation.current;setLoading(true);setError('');
  try{const[keys,list]=await Promise.all([api('/tokens'),api('?limit=100')]);if(mine!==generation.current)return;setTokens(keys.tokens??[]);setEvents(previous=>{const merged=new Map<string,Event>(previous.map(item=>[item.id,item]));for(const event of list.contests??[])merged.set(event.id,event);return[...merged.values()]})}
  catch(error){if(mine===generation.current)setError(message(error))}
  finally{if(mine===generation.current)setLoading(false)}
 },[api]);
 useEffect(()=>{setSecret(null);setTokens([]);setEvents([]);setSelected([]);if(user)void load();return()=>{generation.current++}},[load,user?.id]);
 async function addTarget(){
  const id=contestKeyTarget(target);if(!id)return showError('CBGPU 대회 주소 또는 대회 UUID를 입력해 주세요.');
  setBusy(true);try{const value=await api('/'+id);if(!value.contest?.id)throw Error('이 대회를 확인하지 못했어요.');setEvents(items=>items.some(item=>item.id===id)?items:[value.contest,...items]);setSelected(ids=>ids.includes(id)?ids:[...ids,id]);setTarget('')}catch(error){showError(message(error))}finally{setBusy(false)}
 }
 async function create(){
  if(!name.trim()||!selected.length||!permissions.length||secret||busy)return;
  setBusy(true);try{
   const result=await api('/tokens','POST',{name:name.trim(),scopes:permissions,allowed_contest_ids:selected,expires_in_days:Number(days)});
   if(!/^cbgpu_ct_[A-Za-z0-9_-]+$/.test(result.token??'')||!result.record?.expires_at||result.shown_once!==true)throw Error('발급 응답을 확인하지 못했어요. 목록에서 발급 여부를 확인해 주세요.');
   setSecret({value:result.token,expires_at:result.record.expires_at,owner:user!.id});await load();
  }catch(error){showError(message(error))}finally{setBusy(false)}
 }
 async function revoke(token:Token){
  const expected=user?.id;
  if(!await confirm({title:'연동 키를 폐기할까요?',message:`${token.name}에서 이 키를 사용하는 외부 서비스의 접근이 중단됩니다.`,confirmLabel:'폐기하기'})||owner.current!==expected)return;
  setBusy(true);try{await api('/tokens/'+token.id,'DELETE');showSuccess('연동 키를 폐기했어요.');await load()}catch(error){showError(message(error))}finally{setBusy(false)}
 }
 return <div className="contest-shell mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
  <Link href="/contests" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="size-4"/>대회 목록</Link>
  <header className="space-y-3"><p className="flex items-center gap-2 text-sm font-semibold text-primary"><KeyRound className="size-4"/>EXTERNAL INTEGRATIONS</p><h1 className="text-3xl font-bold tracking-tight">대회 API 연동</h1><p className="text-sm leading-7 text-muted-foreground">외부 서비스에 허용할 대회와 기능을 직접 선택하세요. 내 계정의 참가 신청만 처리하며 주최자·관리자 권한은 부여하지 않습니다.</p></header>
  <section className="contest-panel space-y-3"><h2 className="font-semibold">연결 주소</h2><code className="block break-all rounded-lg bg-muted p-3 text-xs">https://cbgpu.com/api/ai/v1/contests/register</code><p className="text-sm text-muted-foreground">CBGPU_CONTEST_ENDPOINT에 위 주소를 넣고, 발급한 키를 Authorization: Bearer 헤더로 전달하세요.</p><Link className="text-sm font-semibold text-primary underline underline-offset-4" href="/docs/contest-api">API 문서 보기</Link></section>
  {error&&<div role="alert" className="rounded-xl border border-destructive/40 p-4"><p className="text-sm text-destructive">{error}</p><Button className="mt-3" variant="outline" onClick={()=>void load()}>다시 불러오기</Button></div>}
  {secret&&secret.owner===user?.id&&<section className="contest-panel space-y-4" aria-label="발급된 API 키"><h2 className="font-semibold">키가 발급됐어요</h2><p className="text-sm text-muted-foreground">이 화면에서 한 번만 확인할 수 있어요. 외부 서비스의 비공개 설정에 저장하세요.</p><textarea aria-label="새 대회 API 키" readOnly value={secret.value} rows={3} className="w-full resize-none rounded-lg border bg-background p-3 font-mono text-xs"/><div className="flex flex-wrap gap-2"><Button onClick={async()=>{try{await navigator.clipboard.writeText(secret.value);showSuccess('API 키를 복사했어요.')}catch{showError('키를 직접 선택해 복사해 주세요.')}}}><Copy className="size-4"/>키 복사</Button><Button variant="outline" onClick={()=>setSecret(null)}>복사했어요 · 표시 닫기</Button></div><p className="text-xs text-muted-foreground">만료: {new Date(secret.expires_at).toLocaleString('ko-KR')}</p></section>}
  <section className="contest-panel space-y-6"><h2 className="text-lg font-bold">새 연동 키</h2><fieldset disabled={busy||loading||!!secret} className="space-y-6"><legend className="sr-only">연동 키 권한 설정</legend>
   <label className="block space-y-2 text-sm font-medium">이름<Input value={name} maxLength={80} onChange={event=>setName(event.target.value)} placeholder="예: ZERO 대회 연동"/></label>
   <fieldset className="space-y-3"><legend className="mb-2 text-sm font-semibold">허용할 대회</legend><p className="text-xs text-muted-foreground">선택한 대회에만 접근합니다. 목록에 없는 대회는 링크로 추가할 수 있어요.</p><div className="flex flex-col gap-2 sm:flex-row"><Input aria-label="대회 링크 또는 UUID" value={target} onChange={event=>setTarget(event.target.value)} placeholder="대회 주소 또는 UUID" maxLength={2048}/><Button variant="outline" disabled={busy||!target.trim()} onClick={()=>void addTarget()}>링크로 추가</Button></div><div className="max-h-64 overflow-y-auto rounded-lg border">{events.map(event=><label key={event.id} className="flex min-h-12 cursor-pointer items-start gap-3 border-b px-3 py-3 text-sm last:border-b-0"><input type="checkbox" className="mt-1 size-4 shrink-0" checked={selected.includes(event.id)} onChange={e=>setSelected(ids=>e.target.checked?[...ids,event.id]:ids.filter(id=>id!==event.id))}/><span className="min-w-0 break-words">{event.title}</span></label>)}{!events.length&&<p className="p-4 text-sm text-muted-foreground">{loading?'대회를 불러오는 중…':'목록에 대회가 없어요. 대회 링크로 추가해 주세요.'}</p>}</div><p className="text-xs text-muted-foreground">{selected.length}개 선택</p></fieldset>
   <fieldset className="space-y-2"><legend className="mb-2 text-sm font-semibold">허용할 기능</legend>{scopes.map(([scope,label])=><label key={scope} className="flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-sm"><input type="checkbox" className="size-4" checked={permissions.includes(scope)} onChange={event=>setPermissions(values=>event.target.checked?[...values,scope]:values.filter(value=>value!==scope))}/>{label}</label>)}</fieldset>
   <label className="flex flex-wrap items-center gap-3 text-sm font-semibold">사용 기간<Dropdown aria-label="API 키 사용 기간" value={days} onChange={event=>setDays(event.target.value)}><option value="7">7일</option><option value="30">30일</option><option value="90">90일</option></Dropdown></label>
   <p className="rounded-lg bg-muted p-3 text-xs leading-6 text-muted-foreground">이 키는 현재 로그인 세션에 연결됩니다. 로그아웃하거나 세션을 회수하면 만료일 전에도 사용할 수 없어요. 대회 신청 기간·필수 질문·정원·승인 규칙은 API에서도 동일하게 적용됩니다.</p>
   <Button disabled={loading||busy||!!error||!name.trim()||!selected.length||!permissions.length||!!secret} onClick={()=>void create()}><KeyRound className="size-4"/>{busy?'처리 중…':'연동 키 발급'}</Button></fieldset>
  </section>
  <section className="contest-panel space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">내 연동 키</h2><Button variant="outline" disabled={busy||loading} onClick={()=>void load()}><RefreshCw className="size-4"/>새로고침</Button></div>{!tokens.length?<p className="text-sm text-muted-foreground">{loading?'키 목록을 불러오는 중…':'발급한 연동 키가 없어요.'}</p>:<div className="divide-y">{tokens.map(token=>{const ended=!!token.revoked_at;return <div key={token.id} className="flex flex-wrap items-start justify-between gap-3 py-4"><div className="min-w-0 space-y-2"><h3 className="break-words font-semibold">{token.name}</h3><p className="text-xs text-muted-foreground">{token.revoked_at?'폐기됨':Date.parse(token.expires_at)<=Date.now()?'만료됨':'발급됨'} · {token.allowed_contest_ids.length}개 대회 · {new Date(token.expires_at).toLocaleDateString('ko-KR')} 만료</p><p className="text-xs text-muted-foreground">{scopes.filter(([scope])=>token.scopes.includes(scope)).map(([,label])=>label).join(' · ')}</p></div><Button variant="outline" disabled={busy||ended} onClick={()=>void revoke(token)}><Trash2 className="size-4"/>키 폐기</Button></div>})}</div>}</section>
 </div>;
}
