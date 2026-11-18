'use client';
import { useEffect, useState, type ComponentProps } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authFlowHref } from '@/lib/authFlowHref';

/** Preserve a safe return page when switching between account and recovery screens. */
export function AuthFlowLink({ href, onClick, ...props }: Omit<ComponentProps<typeof Link>, 'href'> & { href: string }) {
  const [search, setSearch] = useState('');
  const router = useRouter();
  useEffect(() => { setSearch(window.location.search); }, []);
  const renderedHref = authFlowHref(href, search);
  return <Link {...props} href={renderedHref} onClick={event => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.currentTarget.hasAttribute('download') || (props.target && props.target !== '_self')) return;
    // A fast click can precede the hydration effect. Resolve context at the
    // interaction too, without making server/client initial hrefs disagree.
    const currentHref = authFlowHref(href, window.location.search);
    if (currentHref === renderedHref) return;
    event.preventDefault();
    router.push(currentHref);
  }} />;
}
