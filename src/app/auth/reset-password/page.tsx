'use client';
import {useState} from 'react';
import {supabase} from '@/lib/supabase';
import {signOutEverywhere} from '@/lib/signOutEverywhere';
import {useRouter} from 'next/navigation';
import {AuthFlowLink as Link} from '@/components/auth/AuthFlowLink';
import {Input} from '@/components/ui/input';
import {useAlert} from '@/lib/alert';
import {AuthFrame,AuthSubmit} from '@/components/auth/AuthFrame';
import {InlineFeedback} from '@/components/ui/product-motion';
import {authFlowHref} from '@/lib/authFlowHref';
import {authErrorMessage} from '@/lib/authCopy';
export default function ResetPassword(){
 const[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');const{showSuccess}=useAlert(),router=useRouter();
 async function submit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();if(busy)return;if(password.length<6){setError('새 비밀번호를 6자 이상 입력해 주세요.');document.getElementById('reset-password')?.focus();return}if(password!==confirmation){setError('두 비밀번호가 달라요. 다시 확인해 주세요.');document.getElementById('reset-confirmation')?.focus();return}setBusy(true);setError('');try{const result=await supabase.auth.updateUser({password});if(result.error){setError(authErrorMessage(result.error,'reset'));return}showSuccess('비밀번호를 바꿨어요. 새 비밀번호로 로그인해 주세요.');await signOutEverywhere();router.push(authFlowHref('/auth/login',window.location.search))}catch{setError('변경 결과를 확인하지 못했어요. 로그인하거나 새 재설정 링크로 다시 시도해 주세요.')}finally{setBusy(false)}}
 return <AuthFrame title="새 비밀번호를 정해 주세요" description="다른 서비스에서 쓰지 않는 긴 비밀번호가 좋아요." footer={<Link href="/auth/forgot-password" className="cb-auth-link">재설정 링크 다시 받기</Link>}><form className="cb-auth-form" onSubmit={submit} aria-busy={busy} aria-describedby={error?'reset-feedback':undefined}><div className="cb-auth-field"><label htmlFor="reset-password">새 비밀번호</label><Input id="reset-password" type="password" name="new-password" autoComplete="new-password" placeholder="6자 이상 입력" minLength={6} value={password} onChange={e=>setPassword(e.target.value)} required readOnly={busy}/></div><div className="cb-auth-field"><label htmlFor="reset-confirmation">새 비밀번호 확인</label><Input id="reset-confirmation" type="password" name="confirm-password" autoComplete="new-password" placeholder="한 번 더 입력" value={confirmation} onChange={e=>setConfirmation(e.target.value)} required readOnly={busy}/></div><InlineFeedback id="reset-feedback" message={error}/><AuthSubmit busy={busy} busyLabel="비밀번호 바꾸는 중…">비밀번호 바꾸기</AuthSubmit></form></AuthFrame>;
}
