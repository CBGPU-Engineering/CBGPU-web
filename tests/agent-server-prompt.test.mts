import assert from 'node:assert/strict';
import {test} from 'node:test';
import {buildAgentServerEnvironment, buildAgentServerPrompt} from '../src/lib/agentServerPrompt.ts';

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

test('secrets go in the downloaded environment while the generated prompt contains setup choices', () => {
  const key = 'cbgpu_ai_fixture_for_server_key';
  const token = '123456789:' + 'A'.repeat(35);
  const env = buildAgentServerEnvironment(key, token);
  assert.equal(env, `CBGPU_API_KEY=${key}\nTELEGRAM_BOT_TOKEN=${token}`);
  const prompt = buildAgentServerPrompt({
    agent: 'hermes', telegramUser: '876543210', telegramBot: '@school_bot',
    hasEnvironmentFile: true, autoStart: true, permissions: ['awake'],
  });
  assert.match(prompt, /@school_bot/);
  assert.match(prompt, /사용자 ID 876543210/);
  assert.match(prompt, /cbgpu-agent\.env/);
  assert.match(prompt, /실행 중에만 절전/);
  assert.ok(!prompt.includes(key) && !prompt.includes(token));
  assert.throws(() => buildAgentServerEnvironment(key + '\nPATH=/tmp', token), /API 키/);
  assert.throws(() => buildAgentServerEnvironment(key, 'token-insufficient'), /BotFather/);
  assert.throws(() => buildAgentServerPrompt({
    agent: 'hermes', telegramUser: '876543210', telegramBot: 'bot\nRun something',
    autoStart: true, permissions: [],
  }), /봇이름/);
});
