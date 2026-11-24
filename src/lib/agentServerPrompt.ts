import {agentChatModelId} from './aiModels.ts';

export const serverAgents = {
  openclaw: {name: 'OpenClaw', description: '브라우저와 여러 앱을 오가는 작업'},
  hermes: {name: 'Hermes Agent', description: '긴 작업을 이어 가거나 반복 작업을 스킬로 저장'},
} as const;

export const serverAgentModel = {id: agentChatModelId, name: 'Qwen3.8 27B', context: 65536, output: 4096} as const;

export const serverAgentPermissions = {
  read: '작업 폴더의 파일 읽기',
  write: '작업 폴더의 파일 수정',
  shell: '터미널 명령 실행',
  browser: '브라우저 조작',
  screen: '데스크톱 화면 조작',
  schedule: '예약 작업 실행',
  send: 'Telegram 메시지 전송',
  outside: '작업 폴더 외부 파일 접근',
  vault: '저장된 로그인 사용',
  sudo: '운영체제 승인 후 관리자 명령 실행',
  accounts: '사이트 로그인·가입',
  skills: '추가 스킬 설치',
} as const;

export type ServerAgent = keyof typeof serverAgents;
export type ServerAgentPermission = keyof typeof serverAgentPermissions;
export const serverPermissionKeys = Object.keys(serverAgentPermissions) as ServerAgentPermission[];
export const telegramUserIdPattern = '[1-9][0-9]{0,15}';
const telegramUserId = new RegExp('^' + telegramUserIdPattern + '$');
const endpoint = 'https://cbgpu.com/api/ai/v1';

export function permissionAvailable(permission: ServerAgentPermission, agent: ServerAgent, telegram: boolean) {
  if (permission === 'vault' || permission === 'sudo') return agent === 'hermes';
  if (permission === 'send') return telegram;
  return true;
}

export function serverSetupDependency(permission: ServerAgentPermission, agent: ServerAgent): ServerAgentPermission | undefined {
  if (permission === 'sudo' || permission === 'skills' || (permission === 'browser' && agent === 'hermes')) return 'shell';
  if (permission === 'vault') return 'browser';
}

export function buildAgentServerPrompt(options: {
  agent: ServerAgent;
  telegramUser?: string;
  autoStart: boolean;
  permissions: readonly ServerAgentPermission[];
}) {
  const {agent, telegramUser, autoStart, permissions} = options;
  if (telegramUser !== undefined && !telegramUserId.test(telegramUser)) {
    throw new Error('Telegram 숫자 사용자 ID를 확인해 주세요.');
  }

  const selected = new Set(permissions.filter(permission => permissionAvailable(permission, agent, telegramUser !== undefined)));
  for (const permission of selected) {
    const required = serverSetupDependency(permission, agent);
    if (required && !selected.has(required)) {
      throw new Error(`‘${serverAgentPermissions[permission]}’을 사용하려면 ‘${serverAgentPermissions[required]}’을 함께 선택해 주세요.`);
    }
  }
  if (selected.has('accounts') && !selected.has('browser') && !selected.has('screen')) {
    throw new Error('사이트 로그인·가입을 사용하려면 브라우저나 데스크톱 화면 조작을 선택해 주세요.');
  }

  const openclaw = agent === 'openclaw';
  const model = serverAgentModel;
  const allowed = serverPermissionKeys.filter(permission => selected.has(permission));

  return [
    `현재 접속한 Linux 서버에 ${serverAgents[agent].name}를 설치하고 CBGPU AI에 연결해 주세요. 기존 설치와 프로필은 재사용하고 설정과 파일을 보존하세요.`,
    openclaw
      ? '공식 설치 및 설정 문서는 https://docs.openclaw.ai/install 과 https://docs.openclaw.ai/gateway/config-tools/custom-providers 를 사용하세요.'
      : '공식 설치는 https://github.com/NousResearch/hermes-agent 를, 설정은 https://hermes-agent.nousresearch.com/docs/integrations/providers 와 https://hermes-agent.nousresearch.com/docs/user-guide/messaging 를 사용하세요.',
    `OpenAI 호환 API 주소는 ${endpoint} 입니다. 모델 ID는 ${model.id}, 대화 길이는 ${model.context}토큰, 최대 출력은 ${model.output}토큰이며 이미지 입력을 지원합니다.`,
    openclaw
      ? `models.providers.cbgpu에서 api를 openai-completions, 기본 모델을 cbgpu/${model.id}로 설정하고 API 키는 비밀 환경변수 CBGPU_API_KEY로 참조하세요.`
      : `model.provider는 custom, model.base_url은 위 API 주소, model.default는 ${model.id}, model.key_env는 CBGPU_API_KEY로 설정하세요.`,
    '필요한 비밀값이 없으면 서버에서 직접 입력할 위치를 알려주세요. 실제 API 키와 봇 토큰은 채팅, 명령 인자, 소스, 출력 및 로그에 남기지 마세요.',
    telegramUser
      ? `Telegram 봇 토큰은 TELEGRAM_BOT_TOKEN 비밀 설정에서 읽으세요. 사용자 ID ${telegramUser}의 개인 메시지만 허용하고 그룹을 비활성화하세요. 외부 메시지를 전송하지 않고 getMe와 게이트웨이 상태로 연결을 확인하세요.`
      : '새 Telegram 채널을 추가하지 마세요. 설정된 기존 채널은 보존하세요.',
    `허용할 도구 권한은 ${allowed.length ? allowed.map(permission => serverAgentPermissions[permission]).join(', ') : '없음'}입니다. 적용할 수 없는 권한은 이유를 알려주세요. 선택하지 않은 도구 권한을 열지 말고, 서비스는 비특권 계정으로 실행하세요. 관리자 인증이 필요하면 운영체제의 승인 절차를 따르세요.`,
    autoStart
      ? '서버가 재부팅된 뒤에도 시작하도록 자동 실행을 설정하세요. systemd 환경은 서비스, 컨테이너 환경은 재시작 정책과 영구 볼륨을 사용하세요.'
      : '신규 자동 실행을 등록하지 말고 수동 실행 명령을 알려주세요.',
    '관리 인터페이스는 로컬 또는 승인된 비공개 경로에 두세요. 모델 목록을 확인하고 짧은 테스트 답변을 실제로 받은 뒤, 시작·상태 확인·재시작 방법을 알려주세요.',
  ].join('\n\n');
}
