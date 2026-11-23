'use client';
import {useState} from 'react';
import {supabase} from '@/lib/supabase';
import {useRouter} from 'next/navigation';
import {Input} from '@/components/ui/input';
import {AuthFlowLink as Link} from '@/components/auth/AuthFlowLink';
import {useAlert} from '@/lib/alert';
import {safeWorkspacePath} from '@/lib/workspaces';
import {Eye,EyeOff} from 'lucide-react';
import {AuthFrame,AuthSubmit} from '@/components/auth/AuthFrame';
import {InlineFeedback} from '@/components/ui/product-motion';
import {authErrorMessage} from '@/lib/authCopy';
export default function Login(){
 const[email,setEmail]=useState(''),[password,setPassword]=useState(''),[showPassword,setShowPassword]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const{showSuccess}=useAlert(),router=useRouter();
 async function login(event:React.FormEvent<HTMLFormElement>){event.preventDefault();if(busy)return;setBusy(true);setError('');try{const result=await supabase.auth.signInWithPassword({email:email.trim(),password});if(result.error){setError(authErrorMessage(result.error,'login'));return}showSuccess('로그인했어요.');const next=new URLSearchParams(window.location.search).get('next');router.replace(safeWorkspacePath(next||'/'))}catch{setError('연결을 확인한 뒤 다시 로그인해 주세요. 입력한 내용은 그대로 두었어요.')}finally{setBusy(false)}}
 return <AuthFrame title="다시 만나 반가워요" description="로그인하고 학교생활과 프로젝트를 이어가세요." footer={<>처음 이용하나요?<Link className="cb-auth-link" href="/auth/signup">계정 만들기</Link></>}><form className="cb-auth-form" onSubmit={login} aria-busy={busy} aria-describedby={error?'login-feedback':undefined}><div className="cb-auth-field"><label htmlFor="login-email">이메일</label><Input id="login-email" name="email" type="email" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="가입한 이메일 주소" value={email} onChange={e=>setEmail(e.target.value)} required readOnly={busy}/></div><div className="cb-auth-field"><div className="cb-auth-field-label"><label htmlFor="login-password">비밀번호</label><Link href="/auth/forgot-password" className="cb-auth-link">비밀번호 찾기</Link></div><div className="cb-auth-password"><Input id="login-password" name="password" autoComplete="current-password" type={showPassword?'text':'password'} placeholder="비밀번호 입력" value={password} onChange={e=>setPassword(e.target.value)} required readOnly={busy}/><button className="cb-auth-password-toggle" type="button" aria-label={showPassword?'비밀번호 숨기기':'비밀번호 보기'} aria-pressed={showPassword} onClick={()=>setShowPassword(value=>!value)}>{showPassword?<EyeOff size={19}/>:<Eye size={19}/>}</button></div></div><InlineFeedback id="login-feedback" message={error}/><AuthSubmit busy={busy} busyLabel="로그인 중…">로그인하기</AuthSubmit></form></AuthFrame>;
}
