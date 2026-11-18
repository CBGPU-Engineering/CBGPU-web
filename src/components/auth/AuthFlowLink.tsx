'use client';
import { useEffect, useState, type ComponentProps, type MouseEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authFlowHref } from '@/lib/authFlowHref';

/** Preserve a safe return page when switching between account and recovery screens. */
export function AuthFlowLink({ href, onClick, onAuxClick, onContextMenu, ...props }: Omit<ComponentProps<typeof Link>, 'href'> & { href: string }) {
  const [search, setSearch] = useState('');
  const router = useRouter();
  useEffect(() => { setSearch(window.location.search); }, []);
  const renderedHref = authFlowHref(href, search);
  // Refresh the native anchor too: modified clicks, downloads and a context menu
  // must retain context without turning into a client-side navigation.
  const refreshHref = (event: MouseEvent<HTMLAnchorElement>) => {
    const currentHref = authFlowHref(href, window.location.search);
    if (currentHref !== renderedHref) event.currentTarget.setAttribute('href', currentHref);
    return currentHref;
  };
  return <Link {...props} href={renderedHref} onClick={event => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    const currentHref = refreshHref(event);
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.currentTarget.hasAttribute('download') || (props.target && props.target !== '_self')) return;
    // A fast click can precede the passive hydration effect.
    if (currentHref === renderedHref) return;
    event.preventDefault();
    router.push(currentHref);
  }} onAuxClick={event => {
    onAuxClick?.(event);
    if (!event.defaultPrevented) refreshHref(event);
  }} onContextMenu={event => {
    onContextMenu?.(event);
    if (!event.defaultPrevented) refreshHref(event);
  }} />;
}
