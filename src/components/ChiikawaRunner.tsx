'use client';

import {useEffect, useRef, useState, useSyncExternalStore} from 'react';
import {createPortal} from 'react-dom';
import {usePathname} from 'next/navigation';
import styles from './ChiikawaRunner.module.css';

const subscribe = () => () => {};
const onClient = () => true;
const onServer = () => false;
const friends = [
  {id: 'chiikawa', height: 186 / 174},
  {id: 'hachiware', height: 193 / 174},
  {id: 'usagi', height: 239 / 174},
];
type Point = {x: number; y: number};
type Platform = {element: HTMLElement; left: number; right: number; top: number};
type Actor = {node: HTMLDivElement; point: Point; height: number; animation?: Animation; platform?: HTMLElement; following?: boolean};

/** Original character art inhabits the visible UI: ledges, little walks and jumps. */
export default function ChiikawaRunner() {
  const mounted = useSyncExternalStore(subscribe, onClient, onServer);
  const pathname = usePathname();
  const nodes = useRef<(HTMLDivElement | null)[]>([]);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!mounted) return;
    let disposed = false, revision = 0, frame = 0, lastLayoutAt = 0, pendingDirection = 0, scrollingUntil = 0;
    let layoutTimer: ReturnType<typeof setTimeout> | undefined;
    const scrollOffsets = new WeakMap<Element, number>();
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const actors: Actor[] = nodes.current.flatMap((node, index) => node ? [{node, point: {x: 0, y: 0}, height: friends[index].height * 38}] : []);
    const width = 38;
    const delay = (ms: number) => new Promise<void>(resolve => {
      const timer = setTimeout(() => {timers.delete(timer); resolve();}, ms);
      timers.add(timer);
    });
    const bounds = () => {
      const viewport = window.visualViewport;
      const left = (viewport?.offsetLeft || 0) + 6;
      const right = left + (viewport?.width || innerWidth) - width - 12;
      let top = (viewport?.offsetTop || 0) + 8;
      let bottom = top + (viewport?.height || innerHeight) - 16;
      for (const element of document.querySelectorAll<HTMLElement>('header, .cb-app-header, .cb-header, .cb-bottom-nav')) {
        const rect = element.getBoundingClientRect();
        if (!rect.width || !rect.height) continue;
        if (element.matches('.cb-bottom-nav')) {
          if (rect.top > top + 80 && rect.top < bottom) bottom = rect.top - 6;
        } else if (['sticky', 'fixed'].includes(getComputedStyle(element).position) && rect.top < innerHeight / 2 && rect.bottom > top) {
          top = Math.max(top, rect.bottom + 4);
        }
      }
      return {left, right: Math.max(left, right), top, bottom: Math.max(top + 64, bottom)};
    };
    const clamp = (point: Point, height: number): Point => {
      const b = bounds();
      return {x: Math.max(b.left, Math.min(b.right, point.x)), y: Math.max(b.top, Math.min(b.bottom - height, point.y))};
    };
    const platforms = (): Platform[] => {
      const b = bounds(), result: Platform[] = [];
      // Read the real geometry, never assume a fixed grid or a footer "floor".
      for (const element of document.querySelectorAll<HTMLElement>('main a[href], main button, main article, main section, main textarea, main [class*="rounded"][class*="border"], [data-companion-platform]')) {
        if (element.closest('nav, header, [role="dialog"], [aria-hidden="true"], [data-chiikawa-runner]')) continue;
        const r = element.getBoundingClientRect();
        if (r.width < width + 18 || r.height < 30 || r.width > innerWidth * .96 || r.top < b.top + 48 || r.top > b.bottom - 12) continue;
        if (r.right < b.left + width || r.left > b.right) continue;
        if (result.some(p => Math.abs(p.top - r.top) < 5 && Math.abs(p.left - r.left) < 12)) continue;
        result.push({element, left: Math.max(b.left, r.left + 6), right: Math.min(b.right, r.right - width - 6), top: r.top});
        if (result.length >= 55) break;
      }
      const valid = result.filter(p => p.right >= p.left);
      const interactive = valid.filter(p => p.element.matches('a[href], button, textarea, [data-companion-platform]'));
      const rank = (p: Platform) => p.element.matches('.cb-directory-tile, .cb-pin-grid a, .cb-discovery-help a') ? 0 : 1;
      return (interactive.length ? interactive : valid).sort((a, b) => rank(a) - rank(b) || a.top - b.top || a.left - b.left);
    };
    const place = (actor: Actor, point: Point) => {
      actor.point = clamp(point, actor.height);
      actor.node.style.transform = `translate3d(${actor.point.x}px,${actor.point.y}px,0)`;
      actor.node.style.opacity = '1';
    };
    const land = (actor: Actor, platform: Platform, fraction = .5) => {
      actor.platform = platform.element;
      actor.node.dataset.platform = platform.element.tagName.toLowerCase();
      place(actor, {x: platform.left + (platform.right - platform.left) * fraction, y: platform.top - actor.height + 1});
      actor.node.dataset.action = 'rest';
    };
    const visualPoint = (actor: Actor): Point => {
      // Sample the in-flight position before cancelling; actor.point is the last landing.
      const rect = actor.node.getBoundingClientRect();
      return clamp({x: rect.left, y: rect.top}, actor.height);
    };
    const relayout = (smooth = false, direction = 0) => {
      const version = ++revision, ledges = platforms();
      actors.forEach((actor, index) => {
        const visible = !!actor.node.style.opacity;
        const start = visible ? visualPoint(actor) : actor.point;
        const continuing = actor.following;
        actor.animation?.cancel(); actor.animation = undefined;
        if (visible) place(actor, start);
        const current = ledges.find(p => p.element === actor.platform);
        let target = current || ledges[index % ledges.length];
        if (direction && (!current || Math.abs(current.top - actor.height + 1 - start.y) > 60)) {
          // Follow the user's reading direction to a nearby newly visible ledge.
          const forward = ledges.filter(p => direction * (p.top - actor.height - start.y) > 18);
          const candidates = forward.length ? forward : ledges;
          target = [...candidates].sort((a, b) => {
            const score = (p: Platform) => Math.abs(p.top - actor.height - (start.y + direction * 110)) + Math.abs((p.left + p.right) / 2 - start.x) * .35;
            return score(a) - score(b);
          })[0];
        }
        if (target) {
          const x = current === target ? Math.max(target.left, Math.min(target.right, start.x)) : target.left + (target.right - target.left) * (.2 + index * .28);
          const end = clamp({x, y: target.top - actor.height + 1}, actor.height);
          if (!smooth || !visible || paused || media.matches || document.hidden) {
            land(actor, target, target.right === target.left ? 0 : (x - target.left) / (target.right - target.left));
            actor.following = false;
            return;
          }
          actor.following = true;
          actor.node.dataset.action = 'jump';
          actor.node.dataset.direction = end.x < start.x ? 'left' : 'right';
          const transform = (p: Point) => `translate3d(${p.x}px,${p.y}px,0)`;
          // Start with a hop, then smoothly retarget the descent during a scroll burst.
          // Repeating a fresh upward impulse on every scroll frame would make them float.
          const keys = continuing ? [{transform: transform(start)}, {transform: transform(end)}] : [
            {transform: transform(start), offset: 0},
            {transform: transform(clamp({x: start.x + (end.x - start.x) * .35, y: Math.min(start.y, end.y) - 26}, actor.height)), offset: .32},
            {transform: transform(end), offset: 1},
          ];
          const distance = Math.hypot(end.x - start.x, end.y - start.y);
          const animation = actor.node.animate(keys, {duration: continuing ? 320 : Math.min(850, 420 + distance), easing: 'cubic-bezier(.25,.1,.4,1)', fill: 'forwards'});
          actor.animation = animation;
          const destination = target;
          void animation.finished.then(() => {
            if (disposed || version !== revision || actor.animation !== animation) return;
            place(actor, end); animation.cancel(); actor.animation = undefined;
            actor.platform = destination.element; actor.node.dataset.platform = destination.element.tagName.toLowerCase();
            actor.following = false; actor.node.dataset.action = 'rest';
          }).catch(() => {});
        } else {
          const b = bounds();
          place(actor, visible ? start : {x: b.left + (b.right - b.left) * (.15 + index * .32), y: b.top + 24 + index * 46});
          actor.platform = undefined; actor.following = false; actor.node.dataset.action = 'rest';
        }
      });
    };
    const scheduleLayout = () => {
      if (frame || layoutTimer) return;
      const wait = 90 - (performance.now() - lastLayoutAt);
      if (wait > 0) {layoutTimer = setTimeout(() => {layoutTimer = undefined; scheduleLayout();}, wait); return;}
      frame = requestAnimationFrame(() => {frame = 0; lastLayoutAt = performance.now(); const direction = pendingDirection; pendingDirection = 0; relayout(true, direction);});
    };
    const followScroll = (event: Event) => {
      const source = event.target instanceof Element ? event.target : document.scrollingElement;
      if (source) {
        const value = source.scrollTop, previous = scrollOffsets.get(source) ?? 0;
        pendingDirection = Math.sign(value - previous) || pendingDirection;
        scrollOffsets.set(source, value);
      }
      scrollingUntil = performance.now() + 450;
      scheduleLayout();
    };
    const move = async (actor: Actor, target: Point, jump: boolean) => {
      if (actor.following || performance.now() < scrollingUntil) return false;
      const version = revision, start = actor.point, end = clamp(target, actor.height);
      const distance = Math.hypot(end.x - start.x, end.y - start.y);
      actor.node.dataset.action = jump ? 'jump' : 'walk';
      actor.node.dataset.direction = end.x < start.x ? 'left' : 'right';
      const transform = (p: Point) => `translate3d(${p.x}px,${p.y}px,0)`;
      const keys = jump ? [
        {transform: transform(start), offset: 0},
        {transform: transform(clamp({x: (start.x + end.x) / 2, y: Math.min(start.y, end.y) - 42}, actor.height)), offset: .48},
        {transform: transform(end), offset: 1},
      ] : [{transform: transform(start)}, {transform: transform(end)}];
      const animation = actor.node.animate(keys, {duration: jump ? Math.min(1100, 550 + distance * 1.2) : Math.max(750, distance * 16), easing: jump ? 'cubic-bezier(.3,.1,.7,1)' : 'linear', fill: 'forwards'});
      actor.animation = animation;
      try {await animation.finished;} catch {return false;}
      if (disposed || version !== revision) return false;
      place(actor, end); animation.cancel(); actor.animation = undefined; actor.node.dataset.action = 'rest';
      return true;
    };
    const roam = async (actor: Actor, index: number) => {
      await delay(350 + index * 700);
      while (!disposed) {
        if (document.hidden || paused || media.matches) {await delay(1200); continue;}
        if (actor.following || performance.now() < scrollingUntil) {await delay(120); continue;}
        const ledges = platforms();
        if (!ledges.length) {place(actor, actor.point); actor.node.dataset.action = 'rest'; await delay(1400); continue;}
        if (!actor.platform || !ledges.some(p => p.element === actor.platform)) land(actor, ledges[index % ledges.length], .2 + .25 * index);
        const current = ledges.find(p => p.element === actor.platform)!;
        const x = current.left + (current.right - current.left) * (Math.random() > .5 ? .85 : .15);
        if (!await move(actor, {x, y: current.top - actor.height + 1}, false)) continue;
        await delay(400 + Math.random() * 1100);
        if (disposed || paused || media.matches || document.hidden || actor.following || performance.now() < scrollingUntil) continue;
        const nearby = platforms().filter(p => p.element !== actor.platform && Math.hypot((p.left + p.right) / 2 - actor.point.x, p.top - actor.point.y) < 560);
        const next = nearby[Math.floor(Math.random() * nearby.length)];
        if (next && await move(actor, {x: next.left + (next.right - next.left) * (.2 + Math.random() * .6), y: next.top - actor.height + 1}, true)) actor.platform = next.element;
        await delay(650 + index * 180 + Math.random() * 1200);
      }
    };
    const visibility = () => {
      actors.forEach(a => {if (document.hidden) a.animation?.pause(); else a.animation?.play();});
      if (!document.hidden) scheduleLayout();
    };
    relayout();
    actors.forEach((actor, index) => {void roam(actor, index);});
    window.addEventListener('scroll', followScroll, {passive: true, capture: true});
    window.addEventListener('resize', scheduleLayout, {passive: true});
    window.visualViewport?.addEventListener('resize', scheduleLayout);
    window.visualViewport?.addEventListener('scroll', scheduleLayout);
    document.addEventListener('visibilitychange', visibility);
    media.addEventListener('change', scheduleLayout);
    const main = document.querySelector('main');
    const observer = new ResizeObserver(scheduleLayout);
    if (main) observer.observe(main);
    return () => {
      disposed = true; revision++;
      actors.forEach(a => a.animation?.cancel());
      timers.forEach(clearTimeout);
      cancelAnimationFrame(frame); if (layoutTimer) clearTimeout(layoutTimer); observer.disconnect();
      window.removeEventListener('scroll', followScroll, true);
      window.removeEventListener('resize', scheduleLayout);
      window.visualViewport?.removeEventListener('resize', scheduleLayout);
      window.visualViewport?.removeEventListener('scroll', scheduleLayout);
      document.removeEventListener('visibilitychange', visibility);
      media.removeEventListener('change', scheduleLayout);
    };
  }, [mounted, pathname, paused]);

  if (!mounted) return null;
  return createPortal(<div className={styles.world} data-chiikawa-runner>
    <div aria-hidden="true">{friends.map((friend, index) => <div key={friend.id} ref={node => {nodes.current[index] = node;}} className={styles.actor} data-character={friend.id} data-paused={paused ? 'true' : undefined}>
      {/* Original transparent character artwork; retaining the exact upstream PNG. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/characters/chiikawa/${friend.id}.png`} width={174} height={Math.round(friend.height * 174)} className={styles.sprite} alt="" draggable={false}/>
    </div>)}</div>
    <button className={styles.pause} onClick={() => setPaused(v => !v)}>{paused ? '치이카와 친구들 움직임 재개' : '치이카와 친구들 움직임 멈추기'}</button>
  </div>, document.body);
}
