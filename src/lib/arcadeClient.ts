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
export interface ArcadeRun {
  random: () => number;
  record: (action: ArcadeAction) => void;
  finish: () => Promise<boolean>;
}
export async function createArcadeRun(game: ArcadeGame, ranked: boolean, config: Record<string, unknown> = {}): Promise<ArcadeRun> {
  let session: { id: string; seed: number } | null = null;
  if (ranked) {
    try {
      const response = await fetch('/api/arcade/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game, params: config }) });
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
    random: session ? seededRandom(session.seed) : Math.random,
    record(action) { if (actions.length < 20000) actions.push(action); else exhausted = true; },
    finish() {
      if (!session || exhausted || !actions.length) return Promise.resolve(false);
      if (submitted) return submitted;
      submitted = fetch(`/api/arcade/sessions/${encodeURIComponent(session.id)}/submit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actions }),
      }).then(response => response.ok).catch(() => false);
      return submitted;
    },
  };
}
