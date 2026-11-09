import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {browserAuthLock} from './browserAuthLock';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

declare global { interface Window { __cbgpuAuthClient?:SupabaseClient } }
const existing=typeof window!=='undefined'?window.__cbgpuAuthClient:undefined;
export const supabase = existing ?? createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    lock:browserAuthLock,
  }
});
if(typeof window!=='undefined')window.__cbgpuAuthClient=supabase;
