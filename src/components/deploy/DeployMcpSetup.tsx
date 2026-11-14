'use client';
import {useState} from 'react';
import {Check,Copy,Terminal,ExternalLink} from 'lucide-react';
import './mcp.css';
import {run,deploymentMcpPrompt} from '@/lib/deploymentMcp';
export default function DeployMcpSetup(){
 const [copied,setCopied]=useState(''),[error,setError]=useState('');
 async function copy(value:string,label:string){try{await navigator.clipboard.writeText(value);setCopied(label);setError('')}catch{setError('자동 복사가 안 되면 아래 텍스트를 직접 선택해서 복사해 주세요.')}}
 return <section className="cb-mcp-setup" aria-label="배포 MCP 연결">
  <div className="cb-mcp-heading"><span className="cb-mcp-icon"><Terminal size={20}/></span><div><span className="cb-mcp-eyebrow">CODE WITH YOUR AGENT</span><h2>Codex · Claude Code에서 바로 배포</h2><p>아래 프롬프트를 에이전트에게 보내면 설치와 연결을 안내해 줍니다.</p></div></div>
  <div className="cb-mcp-prompt"><div><strong>1. 에이전트에게 설치 맡기기</strong><button type="button" onClick={()=>void copy(deploymentMcpPrompt,'prompt')}>{copied==='prompt'?<Check size={15}/>:<Copy size={15}/>}프롬프트 {copied==='prompt'?'복사됨':'복사'}</button></div><details><summary>설치 프롬프트 보기</summary><pre tabIndex={0}>{deploymentMcpPrompt}</pre></details></div>
  <details className="cb-mcp-manual"><summary>2. 직접 연결하기 · 로그인과 MCP 명령어</summary><p>Node.js 22 이상이 필요합니다. 사용하는 컴퓨터의 터미널에서 로그인한 뒤 에이전트에 등록하세요.</p>{[
   ['로그인',run+' login'],['Codex','codex mcp add cbgpu-deploy -- '+run],['Claude Code','claude mcp add --scope user cbgpu-deploy -- '+run],
  ].map(([label,command])=><div className="cb-mcp-command" key={label}><div><strong>{label}</strong><button type="button" aria-label={label+' 명령어 복사'} onClick={()=>void copy(command,label)}>{copied===label?<Check size={14}/>:<Copy size={14}/>}복사</button></div><pre tabIndex={0}>{command}</pre></div>)}<p>Windows에서 npx 실행이 안 되면 MCP 실행 명령을 cmd /c npx로 설정하세요. 등록 후 에이전트를 다시 열거나 MCP를 재연결하세요.</p></details>
  <footer><span>비밀번호는 내 터미널에만 입력 · 기존 배포 권한 그대로</span><a href="https://github.com/CBGPU-Engineering/CBGPU-mcp#readme" target="_blank" rel="noopener noreferrer">전체 가이드<ExternalLink size={13}/></a></footer>{copied&&<span role="status" className="sr-only">{copied==='prompt'?'프롬프트':copied+' 명령어'}를 복사했습니다.</span>}{error&&<p role="alert">{error}</p>}
 </section>
}
