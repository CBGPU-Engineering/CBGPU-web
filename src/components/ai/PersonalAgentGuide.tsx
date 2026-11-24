import Link from 'next/link';
import {ArrowRight, Bot, Download, Server} from 'lucide-react';
import AgentServerPrompt from './AgentServerPrompt';

export default function PersonalAgentGuide() {
  return (
    <div className="cb-page-content mx-auto max-w-4xl space-y-7 pb-10">
      <header>
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary"><Bot size={19} aria-hidden="true" />CBGPU AI</p>
        <h1 className="cb-page-title">개인 에이전트</h1>
        <p className="mt-3 leading-7 text-muted-foreground">
          OpenClaw나 Hermes Agent를 CBGPU AI에 연결해 내 컴퓨터나 서버에서 작업을 맡기세요.
        </p>
      </header>
      <section className="space-y-4 rounded-2xl border bg-card p-5 sm:p-7" aria-labelledby="personal-agent-heading">
        <h2 id="personal-agent-heading" className="text-xl font-semibold">내 컴퓨터에 설치</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Windows는 .exe, macOS는 압축을 푼 앱, Linux는 .AppImage를 실행하세요. 설치가 끝나면 도우미 파일은 지워도 돼요.
        </p>
        <p className="text-sm leading-6 text-muted-foreground">
          브라우저와 앱을 오가는 작업에는 OpenClaw, 긴 작업을 이어가거나 반복 작업을 저장할 때는 Hermes를 골라 보세요. 둘 다 Telegram으로 연결할 수 있어요.
        </p>
        <div className="flex flex-wrap gap-3">
          <a href="https://github.com/CBGPU-Engineering/CBGPU-agent-setup/releases" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground">
            <Download size={16} aria-hidden="true" />실행파일 받기
          </a>
          <a href="#server-agent-setup" className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-medium">
            <Server size={16} aria-hidden="true" />서버에 설치하기
          </a>
        </div>
      </section>
      <AgentServerPrompt />
      <div className="flex flex-wrap gap-4">
        <Link href="/ai?tool=api" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary">
          API 키 만들기 <ArrowRight size={16} aria-hidden="true" />
        </Link>
        <Link href="/ai" className="inline-flex min-h-11 items-center text-sm font-medium text-muted-foreground">AI 대화로 돌아가기</Link>
      </div>
    </div>
  );
}
