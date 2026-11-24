'use client';

import Link from 'next/link';
import { Dialog } from 'radix-ui';
import { ArrowUpRight, Search, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { serviceGroups } from '@/lib/serviceNavigation';
import { navigation, previewServicePaths } from './navigation';

const destinations = [
  ...navigation.map(item => ({
    href: item.href,
    label: item.href === '/community' ? '공개 커뮤니티' : item.label,
    preview: true,
    terms: item.label,
  })),
  ...serviceGroups.flatMap(group => group.services).map(item => ({
    href: item.href,
    label: item.label,
    preview: previewServicePaths.includes(item.href),
    terms: [item.label, item.description, item.keywords].filter(Boolean).join(' '),
  })),
];

function normalized(value: string) {
  return value.toLocaleLowerCase().replace(/\s/g, '');
}

export function QuickSearch() {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const field = useRef<HTMLInputElement>(null);
  const filter = normalized(query);
  const matches = destinations.filter(item => normalized(item.terms).includes(filter)).slice(0, 8);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k') return;
      event.preventDefault();
      setQuery('');
      setOpen(true);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return <Dialog.Root open={open} onOpenChange={value => { setOpen(value); if (value) setQuery(''); }}>
    <Dialog.Trigger className="pv-quick-trigger" aria-label="빠른 기능 검색" aria-keyshortcuts="Control+K Meta+K">
      <Search size={19} aria-hidden="true" /> <span>기능 검색</span>
    </Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className="pv-quick-backdrop" />
      <Dialog.Content className="pv-quick-dialog" aria-describedby={undefined} onOpenAutoFocus={event => {
        if (!field.current) return;
        event.preventDefault();
        field.current.focus();
      }}>
        <div className="pv-quick-heading">
          <Dialog.Title>빠른 기능 검색</Dialog.Title>
          <Dialog.Close className="pv-quick-close" aria-label="닫기"><X size={19} aria-hidden="true" /></Dialog.Close>
        </div>
        <label className="pv-visually-hidden" htmlFor={id}>기능 이름 검색</label>
        <input ref={field} id={id} type="search" placeholder="이름으로 찾기" value={query} maxLength={65} onChange={event => setQuery(event.currentTarget.value)} />
        {matches.length === 0 ? <p className="pv-quick-empty" role="status">검색 결과가 없어요.</p> : <ul>
          {matches.map(item => <li key={(item.preview ? 'preview:' : 'original:') + item.href}>
            {item.preview
              ? <Link href={item.href} onClick={() => setOpen(false)}>{item.label}</Link>
              : <a href={item.href}>{item.label}<ArrowUpRight size={15} aria-label="기존 CBGPU" /></a>}
          </li>)}
        </ul>}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
