'use client';
import {useState} from 'react';
import {supabase} from '@/lib/supabase';
import {Input} from '@/components/ui/input';
import {Button} from '@/components/ui/button';
import {AuthFlowLink as Link} from '@/components/auth/AuthFlowLink';
import {getURL} from '@/lib/utils';
import {AuthFrame,AuthSubmit} from '@/components/auth/AuthFrame';
import {InlineFeedback,SuccessFeedback} from '@/components/ui/product-motion';
import {authFlowHref} from '@/lib/authFlowHref';
import {authErrorMessage} from '@/lib/authCopy';
export default function ForgotPassword(){
 const[email,setEmail]=useState(''),[busy,setBusy]=useState(false),[sent,setSent]=useState(false),[error,setError]=useState('');
 async function submit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();if(busy)return;setBusy(true);setError('');try{const result=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:getURL().replace(/\/$/,'')+authFlowHref('/auth/reset-password',window.location.search)});if(result.error){setError(authErrorMessage(result.error,'recovery'));return}setSent(true)}catch{setError('연결을 확인하고 다시 시도해 주세요. 이메일 주소는 그대로 두었어요.')}finally{setBusy(false)}}
 if(sent)return <AuthFrame title="받은편지함을 확인해 주세요"><SuccessFeedback title="재설정 링크를 요청했어요" description={<>가입한 이메일이 맞으면 비밀번호를 바꿀 수 있는 링크를 받을 수 있어요.<span className="cb-auth-email">{email}</span>메일이 없다면 스팸함이나 입력한 주소를 확인해 주세요.</>}><Button asChild><Link href="/auth/login">로그인하기</Link></Button><Button variant="outline" onClick={()=>setSent(false)}>이메일 다시 입력</Button></SuccessFeedback></AuthFrame>;
 return <AuthFrame title="비밀번호를 잊었나요?" description="가입한 이메일로 비밀번호를 바꿀 수 있는 링크를 요청해요." footer={<Link href="/auth/login" className="cb-auth-link">로그인으로 돌아가기</Link>}><form className="cb-auth-form" onSubmit={submit} aria-busy={busy} aria-describedby={error?'recovery-feedback':undefined}><div className="cb-auth-field"><label htmlFor="recovery-email">이메일</label><Input id="recovery-email" type="email" name="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="가입한 이메일 주소" value={email} onChange={e=>setEmail(e.target.value)} required readOnly={busy}/></div><InlineFeedback id="recovery-feedback" message={error}/><AuthSubmit busy={busy} busyLabel="링크 요청 중…">재설정 링크 받기</AuthSubmit></form></AuthFrame>;
}
