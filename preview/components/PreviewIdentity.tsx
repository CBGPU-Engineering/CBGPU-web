'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { accountConfigured } from './session';

type Identity = { signedIn: boolean; name: string | null };
const anonymous: Identity = { signedIn: false, name: null };
const AccountContext = createContext(anonymous);

function identity(user: User | null): Identity {
  if (!user) return anonymous;
  const name: unknown = user.user_metadata.full_name;
  return {
    signedIn: true,
    name: typeof name === 'string' ? Array.from(name.trim()).slice(0, 40).join('') || null : null,
  };
}

export function PreviewIdentity({ children }: { children: ReactNode }) {
  const [value, setValue] = useState(anonymous);

  useEffect(() => {
    if (!accountConfigured) return;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    let generation = 0;
    void import('@/lib/supabase').then(async ({ supabase }) => {
      if (cancelled) return;
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'INITIAL_SESSION' || cancelled) return;
        generation++;
        setValue(identity(session?.user ?? null));
      });
      unsubscribe = () => subscription.unsubscribe();
      const previous = generation;
      const { data } = await supabase.auth.getUser();
      if (!cancelled && previous === generation) setValue(identity(data.user));
    }).catch(() => {});
    return () => { cancelled = true; unsubscribe?.(); };
  }, []);

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function usePreviewIdentity() {
  return useContext(AccountContext);
}

export function HomeGreeting() {
  const { name } = usePreviewIdentity();
  return <h1>{name ? `안녕하세요, ${name} 님` : '오늘의 학교생활'}</h1>;
}
