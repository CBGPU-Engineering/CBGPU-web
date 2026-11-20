'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArcadeRun, ArcadeGame, createArcadeRun, RankedGameProps } from './arcadeClient';

export function useArcadeRun(game: ArcadeGame, { ranked = false, onRecord }: RankedGameProps) {
  const run = useRef<ArcadeRun | null>(null);
  const generation = useRef(0);
  const mounted = useRef(true);
  const finishing = useRef<ArcadeRun | null>(null);
  const [pending, setPending] = useState(false);
  const callback = useRef(onRecord);
  callback.current = onRecord;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; run.current = null; }; }, []);
  const start = useCallback(async (params: Record<string, unknown>, initialize: (random: () => number) => void) => {
    const token = ++generation.current;
    run.current = null;
    setPending(true);
    window.dispatchEvent(new CustomEvent('cbgpu-arcade-variant', { detail: { game, params } }));
    const next = await createArcadeRun(game, ranked, params);
    if (!mounted.current || token !== generation.current) return;
    run.current = next;
    initialize(next.random);
    setPending(false);
  }, [game, ranked]);
  const finish = useCallback(() => {
    const current = run.current;
    if (!current || finishing.current === current) return;
    finishing.current = current;
    void current.finish().then(saved => { if (saved && run.current === current) callback.current?.(); });
  }, []);
  return { run, pending, start, finish };
}
