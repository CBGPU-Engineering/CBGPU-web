'use client';

import {useId, useRef, useState, type FormEvent} from 'react';
import {Copy} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {
  buildAgentServerEnvironment, buildAgentServerPrompt, permissionAvailable, serverAgentModel, serverAgentPermissions, serverAgents,
  serverPermissionKeys, telegramUserIdPattern, type ServerAgent, type ServerAgentPermission,
} from '@/lib/agentServerPrompt';

export default function AgentServerPrompt() {
  const uid = useId();
  const preview = useRef<HTMLTextAreaElement>(null);
  const editing = useRef(0);
  const [agent, setAgent] = useState<ServerAgent>('openclaw');
  const [apiKey, setApiKey] = useState('');
  const [telegram, setTelegram] = useState(false);
  const [telegramUser, setTelegramUser] = useState('');
  const [telegramBot, setTelegramBot] = useState('');
  const [telegramToken, setTelegramToken] = useState('');
  const [autoStart, setAutoStart] = useState(false);
  const [permissions, setPermissions] = useState<ServerAgentPermission[]>([]);
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  function clearResult() {
    editing.current++;
    setPrompt('');
    setStatus('');
    setError('');
  }

  async function copyPrompt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearResult();
    const submission = editing.current;
    let result: string;
    let environment: string;
    try {
      environment = buildAgentServerEnvironment(apiKey.trim(), telegram ? telegramToken.trim() : '');
      result = buildAgentServerPrompt({
        agent, telegramUser: telegram ? telegramUser.trim() : undefined, telegramBot: telegram ? telegramBot.trim() : undefined,
        hasEnvironmentFile: Boolean(environment), autoStart, permissions,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '선택한 설정을 다시 확인해 주세요.');
      return;
    }
    setPrompt(result);
    if (environment) {
      const file = URL.createObjectURL(new Blob([environment + '\n'], {type: 'application/octet-stream'}));
      const link = document.createElement('a');
      link.href = file;
      link.download = 'cbgpu-agent.env';
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(file), 30_000);
    }
    const fileMessage = environment ? ' 내려받은 cbgpu-agent.env는 설치할 서버의 비공개 경로에 옮기세요.' : '';
    try {
      await navigator.clipboard.writeText(result);
      if (submission === editing.current) setStatus('복사했어요. 서버에 접속한 코딩 에이전트에 붙여 넣으세요.' + fileMessage);
    } catch {
      if (submission !== editing.current) return;
      setStatus('자동으로 복사하지 못했어요. 아래 프롬프트를 복사해 주세요.' + fileMessage);
      requestAnimationFrame(() => {
        if (submission !== editing.current) return;
        preview.current?.focus();
        preview.current?.select();
      });
    }
  }

  return (
    <section id="server-agent-setup" className="scroll-mt-28 space-y-5 rounded-2xl border bg-card p-5 sm:p-7" aria-labelledby={uid + '-heading'}>
      <header>
        <h2 id={uid + '-heading'} className="text-xl font-semibold">서버 설치 프롬프트</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Linux 서버에서 사용할 에이전트와 권한을 선택하세요. 복사한 프롬프트를 서버에 접속한 코딩 에이전트에 붙여 넣으면 돼요.
        </p>
      </header>
      <form className="space-y-5" onSubmit={copyPrompt}>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">에이전트</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(['openclaw', 'hermes'] as const).map(option => (
              <label key={option} className="flex min-h-16 cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 has-checked:border-primary has-checked:bg-primary/5">
                <input type="radio" name={uid + '-agent'} className="mt-1 size-4 shrink-0 accent-primary" checked={agent === option} onChange={() => {setAgent(option); clearResult();}} />
                <span>
                  <span className="block text-sm font-medium">{serverAgents[option].name}</span>
                  <span className="block text-sm leading-5 text-muted-foreground">{serverAgents[option].description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="space-y-2">
          <p className="text-sm"><span className="font-semibold">모델</span><span className="ml-3 text-muted-foreground">{serverAgentModel.name}</span></p>
          <label htmlFor={uid + '-api-key'} className="block text-sm font-medium">CBGPU API 키</label>
          <Input id={uid + '-api-key'} type="password" value={apiKey} autoComplete="off" placeholder="cbgpu_ai_…"
            aria-describedby={uid + '-secrets-help'} onChange={event => {setApiKey(event.target.value); clearResult();}} />
          <p className="text-sm text-muted-foreground">이미 서버에 키를 저장했다면 비워도 돼요.</p>
        </div>
        <fieldset className="space-y-1">
          <legend className="mb-1 text-sm font-semibold">연결 및 실행</legend>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
            <input type="checkbox" className="size-4 shrink-0 accent-primary" checked={telegram} onChange={event => {setTelegram(event.target.checked); clearResult();}} />
            Telegram으로 연결하기
          </label>
          {telegram && (
            <div className="max-w-sm space-y-2 pb-2 pl-7">
              <label htmlFor={uid + '-telegram'} className="block text-sm font-medium">내 Telegram 숫자 사용자 ID</label>
              <Input id={uid + '-telegram'} value={telegramUser} onChange={event => {setTelegramUser(event.target.value); clearResult();}}
                placeholder="예: 123456789" inputMode="numeric" pattern={telegramUserIdPattern} maxLength={16} required />
              <p className="text-xs leading-5 text-muted-foreground">이 사용자만 봇에 개인 메시지를 보낼 수 있어요.</p>
              <label htmlFor={uid + '-telegram-bot'} className="block text-sm font-medium">연결할 봇 이름 또는 숫자 ID <span className="font-normal text-muted-foreground">선택</span></label>
              <Input id={uid + '-telegram-bot'} value={telegramBot} placeholder="@my_bot" autoComplete="off"
                onChange={event => {setTelegramBot(event.target.value); clearResult();}} />
              <label htmlFor={uid + '-telegram-token'} className="block text-sm font-medium">Telegram 봇 토큰</label>
              <Input id={uid + '-telegram-token'} type="password" value={telegramToken} placeholder="BotFather에서 받은 토큰"
                autoComplete="off" aria-describedby={uid + '-secrets-help'} onChange={event => {setTelegramToken(event.target.value); clearResult();}} />
              <p className="text-xs leading-5 text-muted-foreground">이미 서버에 봇 토큰을 저장했다면 비워도 돼요.</p>
            </div>
          )}
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
            <input type="checkbox" className="size-4 shrink-0 accent-primary" checked={autoStart} onChange={event => {setAutoStart(event.target.checked); clearResult();}} />
            서버를 켜면 에이전트도 시작하기
          </label>
        </fieldset>
        <details className="rounded-xl border px-3">
          <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">에이전트 권한 선택</summary>
          <p className="pb-2 text-sm text-muted-foreground">에이전트에게 맡길 작업에 필요한 권한을 선택하세요.</p>
          <div className="grid gap-x-5 pb-2 sm:grid-cols-2">
            {serverPermissionKeys.filter(permission => permissionAvailable(permission, agent, telegram)).map(permission => (
              <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm leading-5" key={permission}>
                <input type="checkbox" className="size-4 shrink-0 accent-primary" checked={permissions.includes(permission)}
                  onChange={event => {
                    const checked = event.target.checked;
                    setPermissions(previous => checked ? [...previous, permission] : previous.filter(value => value !== permission));
                    clearResult();
                  }} />
                {serverAgentPermissions[permission]}
              </label>
            ))}
          </div>
        </details>
        <p id={uid + '-secrets-help'} className="text-sm leading-6 text-muted-foreground">
          입력한 키와 토큰은 이 기기에 설정 파일로만 내려받아요. 복사한 프롬프트에는 비밀값이 들어가지 않아요.
        </p>
        <label className="flex min-h-11 cursor-pointer items-start gap-3 py-2 text-sm leading-6">
          <input type="checkbox" required className="mt-1 size-4 shrink-0 accent-primary" />
          에이전트가 선택한 권한으로 서버의 파일이나 프로그램을 사용할 수 있다는 점을 확인했어요.
        </label>
        <Button type="submit"><Copy aria-hidden="true" />서버 설치 프롬프트 복사</Button>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <p role="status" className={status ? 'text-sm leading-6' : 'sr-only'}>{status}</p>
        {prompt && (
          <div className="space-y-2">
            <label htmlFor={uid + '-preview'} className="text-sm font-medium">내 설치 프롬프트</label>
            <textarea id={uid + '-preview'} ref={preview} readOnly value={prompt} rows={7}
              className="block w-full min-w-0 rounded-xl border bg-muted/30 p-3 text-sm leading-6 focus-visible:outline-2 focus-visible:outline-ring" />
          </div>
        )}
      </form>
    </section>
  );
}
