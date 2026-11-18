'use client';
import { useEffect, useState, type ComponentProps } from 'react';
import Link from 'next/link';
import { authFlowHref } from '@/lib/authFlowHref';

/** Preserve a safe return page when switching between account and recovery screens. */
export function AuthFlowLink({ href, ...props }: Omit<ComponentProps<typeof Link>, 'href'> & { href: string }) {
  const [search, setSearch] = useState('');
  useEffect(() => { setSearch(window.location.search); }, []);
  return <Link {...props} href={authFlowHref(href, search)} />;
}
