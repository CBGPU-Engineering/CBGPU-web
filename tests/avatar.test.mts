import test from 'node:test';
import assert from 'node:assert/strict';
import { avatarSrc, uploadedPhoto, AVATAR_PROFILE_COLUMNS } from '../src/lib/avatar.ts';
import { studyMemberProfiles } from '../src/lib/scopedProfiles.ts';

const photo = 'https://cbgpu.com/backend/storage/v1/object/public/avatars/u/avatar.jpg?v=1';
const fallback = 'https://api.dicebear.com/9.x/thumbs/png?seed=2fb88268-1ec6-4729-b66f-a5ae130703cb&size=256';

test('clients draw exactly the URL the server sends: photo, default, and deleted-photo cases', () => {
  assert.equal(avatarSrc({ display_avatar_url: photo, profile_image_url: photo }), photo);
  assert.equal(avatarSrc({ display_avatar_url: fallback, profile_image_url: null }), fallback);
  assert.equal(uploadedPhoto({ display_avatar_url: photo, profile_image_url: photo }), photo);
  assert.equal(uploadedPhoto({ display_avatar_url: fallback, profile_image_url: null }), null, 'no "delete photo" for a default avatar');
  assert.equal(uploadedPhoto({ display_avatar_url: fallback, profile_image_url: '   ' }), null);
  assert.equal(avatarSrc(null), null);
});

test('a server without the avatar migration still works with the old column', () => {
  assert.equal(avatarSrc({ avatar_url: photo }), photo);
  assert.equal(avatarSrc({ avatar_url: null }), null);
  assert.equal(uploadedPhoto({ avatar_url: photo }), photo);
});

test('the web app never builds avatar-provider URLs itself', async () => {
  const { readdirSync, readFileSync, statSync } = await import('node:fs');
  const files: string[] = [];
  const walk = (dir: string) => { for (const entry of readdirSync(dir)) { const path = `${dir}/${entry}`; statSync(path).isDirectory() ? walk(path) : /\.(tsx?|mts)$/.test(entry) && files.push(path); } };
  walk(new URL('../src', import.meta.url).pathname);
  const offenders = files.filter(file => /dicebear\.com\/\d+\.x\//.test(readFileSync(file, 'utf8')));
  assert.deepEqual(offenders, [], 'default avatar URLs must come from the server');
});

test('the profile query asks for the server-built avatar columns', () => {
  assert.equal(AVATAR_PROFILE_COLUMNS, 'display_avatar_url,profile_image_url');
});

test('study profiles in legacy mode request the display avatar and tolerate an older database', async () => {
  const asked: string[] = [];
  const row = { id: 'u1', full_name: 'A', student_id: null, avatar_url: null, display_avatar_url: fallback };
  const client = {
    rpc: async () => { throw Error('scoped RPC must not run in legacy mode'); },
    from: () => ({ select: (columns: string) => ({ in: async () => { asked.push(columns); return columns.includes('display_avatar_url') ? { data: [row], error: null } : { data: [{ ...row, display_avatar_url: undefined }], error: null }; } }) }),
  };
  const result = await studyMemberProfiles(client as any, ['u1'], false);
  assert.equal(result.data?.[0].display_avatar_url, fallback);
  assert.ok(asked[0].includes('display_avatar_url'));
  const old = { rpc: client.rpc, from: () => ({ select: (columns: string) => ({ in: async () => columns.includes('display_avatar_url') ? { data: null, error: { message: 'column profiles.display_avatar_url does not exist' } } : { data: [{ id: 'u1', full_name: 'A', student_id: null, avatar_url: photo }], error: null } }) }) };
  const fallbackResult = await studyMemberProfiles(old as any, ['u1'], false);
  assert.equal(avatarSrc(fallbackResult.data?.[0]), photo);
});
