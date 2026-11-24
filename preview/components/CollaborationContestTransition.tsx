'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Trophy } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { createContext, type MouseEvent, type ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { productSpring } from '@/lib/motion';
import './collaboration.css';

type Box = { top: number; left: number; width: number; height: number };
type Flight = { id: string; banner?: string; source: Box; target?: Box };
type Navigate = (id: string, banner: string | undefined, event: MouseEvent<HTMLAnchorElement>) => void;
const Navigation = createContext<Navigate | null>(null);

function boxOf(element: Element): Box {
  const { top, left, width, height } = element.getBoundingClientRect();
  return { top, left, width, height };
}

export function ContestCover({ id, banner, destination = false }: { id: string; banner?: string; destination?: boolean }) {
  const [failed, setFailed] = useState<string>();
  const hasPhoto = banner && failed !== banner;
  return <div className="pv-collaboration-contest-cover" data-pv-contest-cover={destination ? id : undefined}>
    {hasPhoto
      // The public model only permits the existing same-origin opaque banner route.
      // eslint-disable-next-line @next/next/no-img-element
      ? <img src={banner} alt="" width={640} height={360} loading={destination ? 'eager' : 'lazy'} decoding="async" onError={() => setFailed(banner)} />
      : <div className="pv-collaboration-contest-fallback" aria-hidden="true"><span><Trophy size={27} strokeWidth={1.7} /></span></div>}
  </div>;
}

export function ContestCoverLink({ id, banner, children }: { id: string; banner?: string; children: ReactNode }) {
  const navigate = useContext(Navigation);
  return <Link href={'/contests/' + encodeURIComponent(id)} className="pv-item" onClick={event => navigate?.(id, banner, event)}>{children}</Link>;
}

export function ContestCoverTransition({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const motionReduced = useReducedMotion();
  const [flight, setFlight] = useState<Flight | null>(null);
  const timeout = useRef<number>(0);

  function navigate(id: string, banner: string | undefined, event: MouseEvent<HTMLAnchorElement>) {
    if (event.defaultPrevented || motionReduced || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const cover = event.currentTarget.querySelector('.pv-collaboration-contest-cover');
    if (!cover) return;
    const source = boxOf(cover);
    if (!source.width || !source.height || source.top + source.height < 0) return;
    event.preventDefault();
    clearTimeout(timeout.current);
    const image = cover.querySelector('img');
    setFlight({ id, source, banner: image?.complete && image.naturalWidth ? banner : undefined });
    timeout.current = window.setTimeout(() => setFlight(null), 1100);
    router.push('/contests/' + encodeURIComponent(id));
  }

  useEffect(() => () => clearTimeout(timeout.current), []);
  useEffect(() => {
    if (!flight || flight.target || motionReduced || pathname !== '/contests/' + encodeURIComponent(flight.id)) return;
    const frame = requestAnimationFrame(() => {
      const target = document.querySelector(`[data-pv-contest-cover="${CSS.escape(flight.id)}"]`);
      if (target) setFlight(current => current?.id === flight.id ? { ...current, target: boxOf(target) } : current);
    });
    return () => cancelAnimationFrame(frame);
  }, [flight, motionReduced, pathname]);

  return <Navigation.Provider value={navigate}>
    {children}
    {!!flight && !motionReduced && <motion.div layoutRoot aria-hidden="true" className="pv-collaboration-contest-flight-root"><motion.div
      className="pv-collaboration-contest-flight"
      layout style={{ ...(flight.target || flight.source), borderRadius: flight.target ? 22 : 10 }} transition={productSpring}
      onLayoutAnimationComplete={() => {
        if (flight.target) {
          clearTimeout(timeout.current);
          setFlight(null);
        }
      }}
    ><ContestCover banner={flight.banner} id={flight.id} /></motion.div></motion.div>}
  </Navigation.Provider>;
}
