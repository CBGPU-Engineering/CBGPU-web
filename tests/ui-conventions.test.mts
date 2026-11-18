// Guardrails for the app's UI conventions. They fail CI when a new screen breaks a rule that was fixed on purpose,
// so a regression is caught in review instead of by users on their phones.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
function* sources(dir = SRC): Generator<string> {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* sources(full);
    else if (/\.(tsx|ts)$/.test(entry.name)) yield full;
  }
}
const rel = (file: string) => path.relative(SRC, file);
const read = (file: string) => fs.readFileSync(file, 'utf8');

test('no browser-native <select>: use the app-styled Dropdown (components/ui/dropdown)', () => {
  const allowed = new Set(['components/ui/time-picker.tsx', 'components/ui/dropdown.tsx', 'components/publications/WorkspaceTheme.tsx']);
  const offenders = [...sources()].filter(file => file.endsWith('.tsx') && !allowed.has(rel(file)) && /<select[\s>]/.test(read(file))).map(rel);
  assert.deepEqual(offenders, [], 'Replace <select> with <Dropdown> in: ' + offenders.join(', '));
});

test('no browser-native confirm/prompt/alert dialogs: use useAlert().confirm/prompt/showAlert', () => {
  const offenders = [...sources()].filter(file => /window\.(confirm|prompt|alert)\(/.test(read(file))).map(rel);
  assert.deepEqual(offenders, [], 'Use the app dialogs (lib/alert) in: ' + offenders.join(', '));
});

test('the app WebView keeps the app admin frame whatever the feature flags are', () => {
  const shell = read(path.join(SRC, 'components/AdminShell.tsx'));
  const line = shell.split('\n').find(text => text.includes('<AppAdminFrame>')) || '';
  assert.ok(line, 'AdminShell must render AppAdminFrame in the app');
  assert.ok(!/process\.env|multi\b/.test(line.split('return')[0]), 'Feature flags must not decide whether the app admin frame is used: ' + line.trim().slice(0, 160));
});

test('app admin navigation labels are short Korean text (they must fit the bottom bar)', () => {
  const frame = read(path.join(SRC, 'components/admin/AppAdminFrame.tsx'));
  const labels = [...frame.matchAll(/label:'([^']+)'/g)].map(match => match[1]);
  assert.ok(labels.length >= 10, 'expected the admin navigation labels');
  const allowed = new Set(['Careers']);
  const bad = labels.filter(label => !allowed.has(label) && !/[가-힣]/.test(label));
  assert.deepEqual(bad, [], 'Use short Korean labels in the app admin navigation: ' + bad.join(', '));
  assert.ok(labels.every(label => label.length <= 12), 'Labels must stay short: ' + labels.filter(label => label.length > 12).join(', '));
});
