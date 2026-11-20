'use client';
import { supabase } from './supabase';
import type { ArcadeCredential } from './arcadeClient';

export async function getArcadeCredential(): Promise<ArcadeCredential | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token || !data.session.user?.id) return null;
  return { userId: data.session.user.id, accessToken: data.session.access_token };
}
