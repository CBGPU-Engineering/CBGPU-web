'use client';
import { createElement, useCallback, useEffect, useRef, useState } from 'react';
import { ArcadeRun, ArcadeGame, createArcadeRun, RankedGameProps, ArcadeStatus } from './arcadeClient';
import { Button } from '@/components/ui/button';
import { getArcadeCredential } from './arcadeAuth';

export function useArcadeRun(game: ArcadeGame, { ranked = false, onRecord }: RankedGameProps) {
  const run = useRef<ArcadeRun | null>(null);
  const generation = useRef(0);
  const mounted = useRef(true);
  const finishing = useRef<ArcadeRun | null>(null);
  const [status, setStatus] = useState<ArcadeStatus>('local');
  const [pending, setPending] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const callback = useRef(onRecord);
  useEffect(() => { callback.current = onRecord; }, [onRecord]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; run.current = null; }; }, []);
  const start = useCallback(async (params: Record<string, unknown>, initialize: (random: () => number) => void) => {
    const token = ++generation.current;
    run.current = null;
    setPending(true);
    setAttempted(true);
    setStatus('local');
    window.dispatchEvent(new CustomEvent('cbgpu-arcade-variant', { detail: { game, params } }));
    const next = await createArcadeRun(game, ranked, params, getArcadeCredential);
    if (!mounted.current || token !== generation.current) return;
    run.current = next;
    setStatus(next.ranked ? 'ranked' : 'local');
    initialize(next.random);
    setPending(false);
  }, [game, ranked]);
  const finish = useCallback(() => {
    const current = run.current;
    if (!current || finishing.current === current) return;
    finishing.current = current;
    if (!current.ranked) { setStatus('local'); return; }
    setStatus('saving');
    void current.finish().then(saved => {
      if (!mounted.current || run.current !== current) return;
      if (!saved) finishing.current = null;
      setStatus(saved ? 'saved' : 'failed');
      if (saved) callback.current?.();
    });
  }, []);
  const statusText = pending ? '게임을 준비하고 있어요.' : !attempted ? (ranked ? '시작하면 기록 모드를 준비해요.' : '연습 모드 · 기록은 저장하지 않아요.') : ({
    local: ranked ? '기록 서버에 연결하지 못해 연습 모드로 진행해요. 새 게임에서 다시 시도해 주세요.' : '연습 모드 · 기록은 저장하지 않아요.',
    ranked: '기록 모드 · 플레이를 검증한 후 저장해요.',
    saving: '플레이를 검증하고 있어요.',
    saved: '검증한 기록을 저장했어요.',
    failed: '기록을 저장하지 못했어요. 같은 기록으로 다시 시도할 수 있어요.',
  } satisfies Record<ArcadeStatus, string>)[status];
  const retryButton = status === 'failed'
    ? createElement(Button, { onClick: finish, variant: 'outline', size: 'sm' }, '기록 저장 다시 시도')
    : null;
  return { run, pending, start, finish, status, statusText, retryButton };
}
