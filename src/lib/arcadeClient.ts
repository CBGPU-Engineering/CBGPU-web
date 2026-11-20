/** Replay protocol: unsigned xorshift32, row-major cells, no client score claims. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
}
export type ArcadeGame = '2048' | 'memory' | 'mines' | 'snake' | 'flappy' | 'tetris';
export type ArcadeAction = string | number | { type: 'reveal' | 'flag'; r: number; c: number };
export interface RankedGameProps { ranked?: boolean; onRecord?: () => void }
export interface ArcadeCredential { userId: string; accessToken: string }
export type ArcadeCredentials = () => Promise<ArcadeCredential | null>;
export type ArcadeStatus = 'local' | 'ranked' | 'saving' | 'saved' | 'failed';
export interface ArcadeRun {
  ranked: boolean;
  random: () => number;
  record: (action: ArcadeAction) => void;
  finish: () => Promise<boolean>;
}
export async function createArcadeRun(game: ArcadeGame, ranked: boolean, config: Record<string, unknown> = {}, credentials: ArcadeCredentials = async () => null): Promise<ArcadeRun> {
  let session: { id: string; seed: number } | null = null;
  let owner: ArcadeCredential | null = null;
  if (ranked) {
    try {
      owner = await credentials();
      if (!owner?.userId || !owner.accessToken) throw new Error('No ranking credentials');
      const response = await fetch('/api/arcade/sessions', { signal: AbortSignal.timeout(8000), method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${owner.accessToken}` }, body: JSON.stringify({ game, params: config }) });
      if (response.ok) {
        const value = await response.json();
        if (typeof value.id === 'string' && Number.isInteger(value.seed)) session = value;
      }
    } catch { /* A failed ranking service must not prevent local play. */ }
  }
  const actions: ArcadeAction[] = [];
  let exhausted = false;
  let submitted: Promise<boolean> | undefined;
  return {
    ranked: session !== null,
    random: session ? seededRandom(session.seed) : Math.random,
    record(action) { if (actions.length < 20000) actions.push(action); else exhausted = true; },
    finish() {
      if (!session || exhausted || !actions.length) return Promise.resolve(false);
      if (submitted) return submitted;
      const target = session;
      const expectedOwner = owner?.userId;
      // Resolve fresh credentials at submit, but never cross the original account boundary.
      submitted = (async () => {
        const current = await credentials();
        if (!current?.accessToken || !expectedOwner || current.userId !== expectedOwner) return false;
        const response = await fetch(`/api/arcade/sessions/${encodeURIComponent(target.id)}/submit`, {
          signal: AbortSignal.timeout(12000), method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${current.accessToken}` }, body: JSON.stringify({ actions }),
        });
        return response.ok;
      })().catch(() => false);
      return submitted;
    },
  };
}
