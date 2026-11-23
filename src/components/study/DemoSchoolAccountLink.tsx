'use client';
import {useState} from 'react';
import {Button} from '@/components/ui/button';
export default function DemoSchoolAccountLink({onConnected}:{onConnected:(token:string)=>Promise<void>}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function connect(){
  setBusy(true);
  try{
   const payload=btoa(JSON.stringify({userId:'demo-school-student',exp:4102444800})).replaceAll('=','').replaceAll('+','-').replaceAll('/','_');
   await onConnected('demo.'+payload+'.not-a-real-signature');
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 return <div className="space-y-3"><p>데모 학생 계정이에요. EduSet 로그인이나 실제 학교 요청은 하지 않아요.</p><Button disabled={busy} onClick={()=>void connect()}>데모 학생 연결</Button>{error&&<p role="alert">{error}</p>}</div>
}
