'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';

import { RankedGameProps } from '@/lib/arcadeClient';
import { useArcadeRun } from '@/lib/useArcadeRun';

type Grid = (number | null)[][];

function createGrid(random = Math.random): Grid {
  return addRandom(addRandom(Array.from({ length: 4 }, () => Array(4).fill(null)), random), random);
}

function addRandom(g: Grid, random = Math.random): Grid {
  const empty: [number, number][] = [];
  g.forEach((row, r) => row.forEach((v, c) => { if (!v) empty.push([r, c]); }));
  if (!empty.length) return g;
  const [r, c] = empty[Math.floor(random() * empty.length)];
  return g.map((row, ri) => row.map((v, ci) => (ri === r && ci === c ? (random() < 0.9 ? 2 : 4) : v)));
}

function slideRow(row: (number | null)[]): { row: (number | null)[]; score: number } {
  const vals = row.filter(Boolean) as number[];
  let score = 0;
  const merged: (number | null)[] = [];
  let i = 0;
  while (i < vals.length) {
    if (i + 1 < vals.length && vals[i] === vals[i + 1]) { merged.push(vals[i] * 2); score += vals[i] * 2; i += 2; }
    else { merged.push(vals[i]); i++; }
  }
  while (merged.length < 4) merged.push(null);
  return { row: merged, score };
}

function applyMove(g: Grid, dir: 'left' | 'right' | 'up' | 'down'): { grid: Grid; score: number } {
  let score = 0;
  const transpose = (m: Grid): Grid => m[0].map((_, i) => m.map(row => row[i]));
  let grid = g.map(row => [...row]);

  if (dir === 'left') {
    grid = grid.map(row => { const r = slideRow(row); score += r.score; return r.row; });
  } else if (dir === 'right') {
    grid = grid.map(row => { const r = slideRow([...row].reverse()); score += r.score; return r.row.reverse(); });
  } else if (dir === 'up') {
    grid = transpose(transpose(grid).map(row => { const r = slideRow(row); score += r.score; return r.row; }));
  } else {
    grid = transpose(transpose(grid).map(row => { const r = slideRow([...row].reverse()); score += r.score; return r.row.reverse(); }));
  }
  return { grid, score };
}

function isOver(g: Grid): boolean {
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    if (!g[r][c]) return false;
    if (c < 3 && g[r][c] === g[r][c + 1]) return false;
    if (r < 3 && g[r][c] === g[r + 1][c]) return false;
  }
  return true;
}

const COLORS: Record<number, string> = {
  2:    'bg-amber-100 text-gray-800',
  4:    'bg-amber-200 text-gray-800',
  8:    'bg-orange-300 text-white',
  16:   'bg-orange-400 text-white',
  32:   'bg-orange-500 text-white',
  64:   'bg-red-500 text-white',
  128:  'bg-yellow-400 text-white',
  256:  'bg-yellow-500 text-white',
  512:  'bg-green-500 text-white',
  1024: 'bg-green-600 text-white',
  2048: 'bg-green-700 text-white',
};

function fontSize(v: number) {
  if (v >= 1024) return 'text-base';
  if (v >= 128) return 'text-lg';
  return 'text-xl';
}

export default function Game2048(props: RankedGameProps = {}) {
  const { run, pending, start, finish, statusText, retryButton } = useArcadeRun('2048', props);
  const initialized = useRef(false);
  const [grid, setGrid] = useState<Grid>(createGrid);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [over, setOver] = useState(false);
  const [won, setWon] = useState(false);

  const reset = useCallback(() => { void start({}, random => { setGrid(createGrid(random)); setScore(0); setOver(false); setWon(false); }); }, [start]);
  useEffect(() => { if (!initialized.current) { initialized.current = true; reset(); } }, [reset]);

  const handleMove = useCallback((dir: 'left' | 'right' | 'up' | 'down') => {
    if (over || pending || !run.current) return;
    const { grid: ng, score: gained } = applyMove(grid, dir);
    if (JSON.stringify(ng) === JSON.stringify(grid)) return;
    run.current.record(dir);
    const final = addRandom(ng, run.current.random);
    setGrid(final);
    const nextScore = score + gained;
    setScore(nextScore); setBest(b => Math.max(b, nextScore));
    if (!won && final.flat().includes(2048)) setWon(true);
    if (isOver(final)) { setOver(true); finish(); }
  }, [over, pending, run, grid, score, won, finish]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, 'left' | 'right' | 'up' | 'down'> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
      if (map[e.key]) { e.preventDefault(); handleMove(map[e.key]); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleMove]);

  const touchOrigin = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchOrigin.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const origin = touchOrigin.current;
    touchOrigin.current = null;
    if (!origin) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - origin.x;
    const dy = t.clientY - origin.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) handleMove(dx > 0 ? 'right' : 'left');
    else handleMove(dy > 0 ? 'down' : 'up');
  };

  return (
    <div className="flex flex-col items-center gap-5">
      <p role="status" className="text-sm text-muted-foreground text-center">{statusText}</p>
      {retryButton}
      <div className="flex flex-wrap justify-center items-center gap-3">
        <div className="text-center bg-muted px-4 py-2 rounded-lg"><p className="text-xs text-muted-foreground uppercase font-black tracking-widest">점수</p><p className="text-xl font-black">{score}</p></div>
        <div className="text-center bg-muted px-4 py-2 rounded-lg"><p className="text-xs text-muted-foreground uppercase font-black tracking-widest">최고</p><p className="text-xl font-black">{best}</p></div>
        {props.ranked && <Button onClick={() => { setOver(true); finish(); }} disabled={pending || score === 0 || over} variant="outline" size="sm">기록 저장하고 끝내기</Button>}
        <Button onClick={reset} disabled={pending} variant="outline" size="sm" className="font-black text-xs uppercase tracking-widest">새 게임</Button>
      </div>

      <div
        className="p-3 bg-muted rounded-2xl shadow-lg touch-none select-none"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="grid grid-cols-4 gap-2" style={{ width: 'min(312px, 80vw)', maxWidth: '100%' }}>
          {grid.flat().map((val, i) => (
            <div
              key={i}
              style={{ aspectRatio: '1 / 1' }}
              className={`flex items-center justify-center rounded-xl font-black transition-all duration-100 ${val ? (COLORS[val] || 'bg-emerald-800 text-white') + ' ' + fontSize(val) : 'bg-muted-foreground/10'}`}
            >
              {val ?? ''}
            </div>
          ))}
        </div>
      </div>

      {won && !over && (
        <div className="flex items-center gap-3 px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-xl">
          <p className="text-green-500 font-black uppercase tracking-widest text-sm">2048 달성!</p>
          <Button onClick={() => setWon(false)} size="sm" variant="outline" className="font-black text-xs">계속하기</Button>
        </div>
      )}
      {over && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-destructive font-black uppercase tracking-widest">게임 종료</p>
          <Button onClick={reset} disabled={pending} className="font-black uppercase tracking-widest">다시 하기</Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground font-medium">화살표 또는 스와이프로 타일 밀기 · 2048을 만들어 보세요!</p>
    </div>
  );
}
