'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';

import { RankedGameProps } from '@/lib/arcadeClient';
import { useArcadeRun } from '@/lib/useArcadeRun';

type Cell = { mine: boolean; revealed: boolean; flagged: boolean; adj: number };
type Grid = Cell[][];
type Phase = 'idle' | 'playing' | 'won' | 'lost';

const LEVELS = {
  easy:   { rows: 9,  cols: 9,  mines: 10 },
  medium: { rows: 12, cols: 12, mines: 24 },
  hard:   { rows: 14, cols: 16, mines: 40 },
} as const;
type Level = keyof typeof LEVELS;

function makeGrid(rows: number, cols: number): Grid {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ mine: false, revealed: false, flagged: false, adj: 0 })));
}

function placeMines(grid: Grid, rows: number, cols: number, mines: number, safeR: number, safeC: number, random: () => number): Grid {
  const g = grid.map(r => r.map(c => ({ ...c })));
  let placed = 0;
  while (placed < mines) {
    const r = Math.floor(random() * rows);
    const c = Math.floor(random() * cols);
    if (!g[r][c].mine && (Math.abs(r - safeR) > 1 || Math.abs(c - safeC) > 1)) {
      if (!g[r][c].mine) { g[r][c].mine = true; placed++; }
    }
  }
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      if (g[r][c].mine) continue;
      let cnt = 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && g[nr][nc].mine) cnt++;
      }
      g[r][c].adj = cnt;
    }
  return g;
}

function flood(grid: Grid, r: number, c: number, rows: number, cols: number): Grid {
  const g = grid.map(row => row.map(cell => ({ ...cell })));
  const queue: [number, number][] = [[r, c]];
  while (queue.length) {
    const [cr, cc] = queue.shift()!;
    if (cr < 0 || cr >= rows || cc < 0 || cc >= cols) continue;
    const cell = g[cr][cc];
    if (cell.revealed || cell.flagged || cell.mine) continue;
    cell.revealed = true;
    if (cell.adj === 0)
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++)
        if (dr !== 0 || dc !== 0) queue.push([cr + dr, cc + dc]);
  }
  return g;
}

const ADJ_CLASSES = ['', 'text-blue-700 dark:text-blue-300', 'text-green-700 dark:text-green-300', 'text-red-700 dark:text-red-300', 'text-violet-700 dark:text-violet-300', 'text-orange-800 dark:text-orange-300', 'text-cyan-800 dark:text-cyan-300', 'text-rose-700 dark:text-rose-300', 'text-gray-700 dark:text-gray-300'];

export default function Minesweeper(props: RankedGameProps = {}) {
  const { run, pending, start, finish, statusText, retryButton } = useArcadeRun('mines', props);
  const initialized = useRef(false);
  const [level, setLevel] = useState<Level>('easy');
  const [grid, setGrid] = useState<Grid>(() => makeGrid(9, 9));
  const [phase, setPhase] = useState<Phase>('idle');
  const [flagMode, setFlagMode] = useState(false);
  const [flags, setFlags] = useState(0);
  const [time, setTime] = useState(0);
  const [firstClick, setFirstClick] = useState(true);

  const cfg = LEVELS[level];

  const reset = useCallback((lv: Level = level) => {
    void start({ level: lv }, () => setGrid(makeGrid(LEVELS[lv].rows, LEVELS[lv].cols)));
    setPhase('idle'); setFlags(0); setTime(0); setFirstClick(true); setFlagMode(false);
  }, [level, start]);

  useEffect(() => { if (!initialized.current) { initialized.current = true; reset(); } }, [reset]);

  useEffect(() => {
    if (phase !== 'playing') return;
    const t = setInterval(() => setTime(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const reveal = useCallback((r: number, c: number) => {
    if (pending || !run.current || phase === 'won' || phase === 'lost') return;
    if (grid[r][c].revealed || grid[r][c].flagged) return;
    run.current.record({ type: 'reveal', r, c });
    let g = grid;
    if (firstClick) {
      g = placeMines(grid, cfg.rows, cfg.cols, cfg.mines, r, c, run.current.random);
      setFirstClick(false);
      setPhase('playing');
    }
    const cell = g[r][c];
    if (cell.revealed || cell.flagged) return;
    if (cell.mine) {
      const ng = g.map(row => row.map(cl => ({ ...cl, revealed: cl.mine ? true : cl.revealed })));
      setGrid(ng); setPhase('lost'); return;
    }
    const ng = flood(g, r, c, cfg.rows, cfg.cols);
    setGrid(ng);
    const unrevealed = ng.flat().filter(cl => !cl.mine && !cl.revealed).length;
    if (unrevealed === 0) { setPhase('won'); finish(); }
  }, [grid, phase, firstClick, cfg, pending, run, finish]);

  const flag = useCallback((r: number, c: number) => {
    if (pending || !run.current || phase === 'won' || phase === 'lost') return;
    const cell = grid[r][c];
    if (cell.revealed) return;
    run.current.record({ type: 'flag', r, c });
    const ng = grid.map((row, ri) => row.map((cl, ci) =>
      ri === r && ci === c ? { ...cl, flagged: !cl.flagged } : cl
    ));
    setGrid(ng);
    setFlags(f => cell.flagged ? f - 1 : f + 1);
  }, [grid, phase, pending, run]);

  const handleCell = useCallback((e: React.MouseEvent | React.TouchEvent, r: number, c: number) => {
    e.preventDefault();
    if (flagMode) flag(r, c);
    else reveal(r, c);
  }, [flagMode, flag, reveal]);

  const cellSize = 44;

  return (
    <div className="flex flex-col items-center gap-4">
      <p role="status" className="text-sm text-muted-foreground text-center">{statusText}</p>
      {retryButton}
      {/* difficulty + hud */}
      <div className="flex items-center gap-2 flex-wrap justify-center">
        {(Object.keys(LEVELS) as Level[]).map(lv => (
          <button key={lv} type="button" aria-pressed={level === lv} onClick={() => { setLevel(lv); reset(lv); }}
            className={`min-h-11 px-3 py-2 rounded-lg font-black text-sm uppercase tracking-widest transition-all ${
              level === lv ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}>{lv === 'easy' ? '쉬움' : lv === 'medium' ? '보통' : '어려움'}</button>
        ))}
        <span className="text-sm font-black text-muted-foreground ml-1">💣 {cfg.mines - flags}</span>
        <span className="text-sm font-black text-muted-foreground">⏱ {time}s</span>
        <Button variant="outline" size="sm" className="font-black text-sm uppercase" onClick={() => reset()}>다시 하기</Button>
      </div>

      {/* flag toggle (touch mode) */}
      <button
        type="button" aria-pressed={flagMode} onClick={() => setFlagMode(f => !f)}
        className={`min-h-11 px-4 py-2 rounded-xl font-black text-sm uppercase tracking-widest transition-all ${
          flagMode ? 'bg-amber-300 text-gray-900 shadow-md' : 'bg-muted text-muted-foreground'
        }`}
      >
        {flagMode ? '🚩 깃발 모드 ON' : '👆 클릭 모드'}
      </button>

      <p className="w-full text-sm text-muted-foreground">밀어서 이동 · 탭으로 열기 · 깃발 모드로 표시</p>
      {/* Keep cells tappable; larger boards scroll inside the playfield. */}
      <div role="region" aria-label="지뢰찾기 보드, 가로세로 스크롤 가능" tabIndex={0} className="max-h-[55dvh] w-full max-w-full overflow-auto overscroll-contain rounded-xl border-2 border-border/50 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"><div
        className="grid w-max touch-auto"
        style={{ gridTemplateColumns: `repeat(${cfg.cols}, ${cellSize}px)` }}
        onContextMenu={e => e.preventDefault()}
      >
        {grid.map((row, r) => row.map((cell, c) => {
          let bg = 'bg-muted hover:bg-accent';
          if (cell.revealed) bg = cell.mine ? 'bg-red-500/80' : 'bg-card';

          return (
            <Button
              type="button"
              variant="ghost"
              aria-label={`${r + 1}행 ${c + 1}열 · ${cell.revealed ? (cell.mine ? '지뢰' : `열림 ${cell.adj}`) : cell.flagged ? '깃발' : '닫힘'}`}
              key={`${r}-${c}`}
              style={{ width: cellSize, height: cellSize, fontSize: 18 }}
              className={`h-auto min-h-0 min-w-0 w-full p-0 rounded-none flex items-center justify-center font-black border border-border cursor-pointer select-none transition-colors touch-auto ${bg}`}
              onClick={e => handleCell(e, r, c)}
              onContextMenu={e => { e.preventDefault(); flag(r, c); }}
            >
              {cell.flagged && !cell.revealed ? '🚩' :
               cell.revealed && cell.mine ? '💣' :
               cell.revealed && cell.adj > 0 ? (
                 <span className={ADJ_CLASSES[cell.adj]}>{cell.adj}</span>
               ) : null}
            </Button>
          );
        }))}
      </div></div>

      {(phase === 'won' || phase === 'lost') && (
        <div className={`text-center p-4 rounded-2xl border ${phase === 'won' ? 'bg-green-500/10 border-green-500/30' : 'bg-destructive/10 border-destructive/30'}`}>
          <p className={`font-black uppercase tracking-widest text-lg ${phase === 'won' ? 'text-green-700 dark:text-green-400' : 'text-destructive'}`}>
            {phase === 'won' ? '🎉 클리어!' : '💥 폭발!'}
          </p>
          <p className="text-sm text-muted-foreground mt-1 font-medium">{time}초</p>
          <Button onClick={() => reset()} className="mt-2 font-black uppercase tracking-widest">다시 하기</Button>
        </div>
      )}

      <p className="text-sm text-muted-foreground font-medium">
        숫자는 이웃한 지뢰 수예요. 우클릭으로도 깃발을 표시할 수 있어요.
      </p>
    </div>
  );
}
