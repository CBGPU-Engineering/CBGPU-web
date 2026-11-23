'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { RankedGameProps } from '@/lib/arcadeClient';
import { useArcadeRun } from '@/lib/useArcadeRun';
import { Button } from '@/components/ui/button';

const W = 360, H = 480;
const GRAVITY = 0.45, JUMP = -8.5, PIPE_W = 52, GAP = 140, PIPE_SPEED = 2.8, BIRD_X = 70;

interface Pipe { x: number; top: number; id: number }

let _pipeId = 0;
function randTop(random: () => number) { return 60 + random() * (H - GAP - 120); }

export default function FlappyBird(props: RankedGameProps) {
  const arcade = useArcadeRun('flappy', props);
  const randomRef = useRef<() => number>(Math.random);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const s = useRef({
    bird: { y: H / 2, vy: 0 },
    pipes: [] as Pipe[],
    scored: new Set<number>(),
    score: 0,
    frame: 0,
    running: false,
    over: false,
    started: false,
  });
  const flappedFrame = useRef(-1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'running' | 'over'>('idle');

  const draw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d')!;
    const { bird, pipes, score: sc } = s.current;

    // sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#1e3a5f'); sky.addColorStop(1, '#4a90d9');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

    // ground
    ctx.fillStyle = '#5c8a3c'; ctx.fillRect(0, H - 40, W, 40);
    ctx.fillStyle = '#7ab648'; ctx.fillRect(0, H - 40, W, 8);

    // pipes
    pipes.forEach(p => {
      const grad = ctx.createLinearGradient(p.x, 0, p.x + PIPE_W, 0);
      grad.addColorStop(0, '#4caf50'); grad.addColorStop(0.4, '#81c784'); grad.addColorStop(1, '#388e3c');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.roundRect(p.x, 0, PIPE_W, p.top, [0, 0, 6, 6]); ctx.fill();
      ctx.fillRect(p.x - 4, p.top - 22, PIPE_W + 8, 22);
      ctx.beginPath(); ctx.roundRect(p.x, p.top + GAP, PIPE_W, H - p.top - GAP - 40, [6, 6, 0, 0]); ctx.fill();
      ctx.fillRect(p.x - 4, p.top + GAP, PIPE_W + 8, 22);
    });

    // bird body
    const bx = BIRD_X, by = bird.y;
    const angle = Math.max(-0.4, Math.min(1.2, bird.vy * 0.06));
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(angle);
    ctx.fillStyle = '#fdd835';
    ctx.beginPath(); ctx.ellipse(0, 0, 20, 16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f9a825';
    ctx.beginPath(); ctx.ellipse(-4, 4, 14, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(8, -4, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a237e'; ctx.beginPath(); ctx.arc(10, -4, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e53935'; ctx.beginPath(); ctx.moveTo(14, 2); ctx.lineTo(22, -2); ctx.lineTo(22, 6); ctx.closePath(); ctx.fill();
    // wing
    ctx.fillStyle = '#f9a825';
    ctx.beginPath(); ctx.ellipse(-6, 2, 10, 6, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // score HUD
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(W/2 - 30, 12, 60, 32);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 22px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(String(sc), W / 2, 33);
    ctx.textAlign = 'left';
  }, []);

  const flap = useCallback(() => {
    const st = s.current;
    if (st.over) return;
    if (!st.running) {
      if (arcade.pending) return;
      void arcade.start({}, random => {
        randomRef.current = random;
        st.running = true; st.started = true;
        flappedFrame.current = st.frame;
        arcade.run.current?.record('flap');
        st.bird.vy = JUMP;
        setPhase('running');
      });
      return;
    }
    if (flappedFrame.current === st.frame) return;
    flappedFrame.current = st.frame;
    arcade.run.current?.record('flap');
    st.bird.vy = JUMP;
  }, [arcade.start, arcade.pending]);

  const tick = useCallback(() => {
    const st = s.current;
    if (!st.running) { draw(); return; }
    arcade.run.current?.record('tick');

    st.bird.vy += GRAVITY;
    st.bird.y += st.bird.vy;
    st.frame++;

    // spawn pipe
    if (st.frame % 90 === 0) st.pipes.push({ x: W + 10, top: randTop(randomRef.current), id: _pipeId++ });
    st.pipes.forEach(p => { p.x -= PIPE_SPEED; });
    st.pipes = st.pipes.filter(p => p.x > -PIPE_W - 10);

    // score: pipe ID Set으로 중복 없이 카운트
    st.pipes.forEach(p => {
      if (!st.scored.has(p.id) && p.x + PIPE_W < BIRD_X) {
        st.scored.add(p.id);
        st.score++;
        setScore(st.score);
      }
    });

    // collision
    const by = st.bird.y, bx = BIRD_X;
    if (by > H - 56 || by < 10) { endGame(); return; }
    for (const p of st.pipes) {
      if (bx + 16 > p.x + 4 && bx - 16 < p.x + PIPE_W - 4) {
        if (by - 14 < p.top || by + 14 > p.top + GAP) { endGame(); return; }
      }
    }

    draw();
  }, [draw]);

  function endGame() {
    s.current.running = false; s.current.over = true;
    arcade.finish();
    setBest(b => Math.max(b, s.current.score));
    setPhase('over');
    draw();
  }

  const reset = useCallback(() => {
    s.current = { bird: { y: H / 2, vy: 0 }, pipes: [], scored: new Set(), score: 0, frame: 0, running: false, over: false, started: true };
    flappedFrame.current = -1;
    setScore(0); setPhase('idle');
  }, [tick]);

  useEffect(() => {
    let last = performance.now();
    intervalRef.current = setInterval(() => {
      const now = performance.now();
      if (now - last < 1000 / 60) return;
      last = Math.max(last + 1000 / 60, now - 1000 / 60);
      tick();
    }, 8);

    const onKey = (e: KeyboardEvent) => { if (e.code === 'Space') { e.preventDefault(); flap(); } };
    window.addEventListener('keydown', onKey);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); window.removeEventListener('keydown', onKey); };
  }, [tick, flap]);

  return (
    <div className="flex flex-col items-center gap-4">
      <p role="status" className="text-sm text-muted-foreground text-center">{arcade.statusText}</p>
      {arcade.retryButton}
      <div className="flex items-center gap-6">
        <span className="text-sm font-black uppercase tracking-widest">점수: {score}</span>
        <span className="text-sm font-black uppercase tracking-widest text-muted-foreground">최고: {best}</span>
      </div>
      <div className="relative select-none">
        <canvas
          ref={canvasRef} width={W} height={H}
          className="rounded-2xl shadow-xl border border-border/30 touch-none"
          style={{ maxWidth: '100%' }}
          onClick={flap}
          onTouchStart={e => { e.preventDefault(); flap(); }}
        />
        {phase === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/40 rounded-2xl">
            <p className="text-white font-black text-2xl uppercase tracking-tight drop-shadow-lg">Flappy Bird</p>
            <p className="text-white/80 text-sm font-medium">탭 / 스페이스바로 점프</p>
            <Button onClick={flap} className="font-black uppercase tracking-widest">시작하기</Button>
          </div>
        )}
        {phase === 'over' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/50 rounded-2xl">
            <p className="text-white font-black text-2xl uppercase drop-shadow-lg">게임이 끝났어요</p>
            <p className="text-white/80 text-sm font-bold">점수: {score}  ·  최고: {best}</p>
            <Button onClick={reset} className="font-black uppercase tracking-widest">다시 하기</Button>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground font-medium">탭 또는 스페이스바로 점프</p>
    </div>
  );
}
