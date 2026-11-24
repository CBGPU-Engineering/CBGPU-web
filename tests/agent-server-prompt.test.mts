import assert from 'node:assert/strict';
import {test} from 'node:test';
import {buildAgentServerPrompt} from '../src/lib/agentServerPrompt.ts';

test('only the selected agent, connection and permissions appear in the generated instructions', () => {
  const hermes = buildAgentServerPrompt({
    agent: 'hermes', telegramUser: '123456789', autoStart: true, permissions: ['shell', 'browser', 'send'],
  });
  assert.match(hermes, /Hermes Agent/);
  assert.match(hermes, /model\.default는 cbgpu-qwen38/);
  assert.match(hermes, /TELEGRAM_BOT_TOKEN.*123456789/);
  assert.match(hermes, /터미널 명령 실행, 브라우저 조작, Telegram 메시지 전송/);
  assert.match(hermes, /재부팅된 뒤에도/);

  const openclaw = buildAgentServerPrompt({
    agent: 'openclaw', autoStart: false, permissions: ['vault', 'sudo', 'send'],
  });
  assert.match(openclaw, /cbgpu\/cbgpu-qwen38/);
  assert.match(openclaw, /권한은 없음/);
  assert.match(openclaw, /수동 실행/);
  assert.doesNotMatch(openclaw, /TELEGRAM_BOT_TOKEN|재부팅된 뒤에도/);
});

test('invalid Telegram input and permission dependency gaps are rejected before copying', () => {
  assert.throws(() => buildAgentServerPrompt({
    agent: 'hermes', telegramUser: '123456789:invalid-secret', autoStart: false, permissions: [],
  }), /사용자 ID/);
  assert.throws(() => buildAgentServerPrompt({
    agent: 'hermes', autoStart: false, permissions: ['browser'],
  }), /터미널 명령 실행/);
});
