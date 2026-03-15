'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from './ThemeToggle';
import { toast } from 'sonner';

export default function Navbar() {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const checkAdminStatus = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', userId)
        .single();

      if (data) {
        setIsAdmin(data.is_admin);
      } else {
        setIsAdmin(false);
      }
    } catch (err) {
      console.error("Admin fetch error:", err);
      setIsAdmin(false);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          await checkAdminStatus(currentUser.id);
        }
      } catch (err) {
        console.error("Auth init error:", err);
      } finally {
        setIsLoading(false);
      }
    };
    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      if (currentUser) {
        await checkAdminStatus(currentUser.id);
      } else {
        setIsAdmin(false);
      }
      
      if (event === 'SIGNED_OUT') {
        router.refresh();
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      setUser(null);
      setIsAdmin(false);
      toast.success("로그아웃 되었습니다.");
      router.push('/auth/login');
      router.refresh();
    } catch (err: any) {
      toast.error("로그아웃 중 오류가 발생했습니다.");
      console.error(err);
    }
  };

  return (
    <nav className="flex items-center justify-between px-10 py-4 bg-background/50 border-b border-border sticky top-0 z-50 backdrop-blur-md">
      <Link href="/" className="text-2xl font-black text-primary tracking-tighter italic transition-transform hover:scale-105 active:scale-95">
        CBGPU
      </Link>
      
      <div className="flex gap-4 items-center font-medium">
        <ThemeToggle />
        
        {!isLoading && (
          user ? (
            <>
              <Link href="/dashboard" className={`text-sm transition-all duration-300 font-bold px-3 py-1.5 rounded-lg ${pathname === '/dashboard' ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}>
                Dashboard
              </Link>
              <Link href="/profile" className={`text-sm transition-all duration-300 font-bold px-3 py-1.5 rounded-lg ${pathname === '/profile' ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}>
                My Profile
              </Link>
              
              {isAdmin && (
                <Link href="/admin" className={`text-sm transition-all duration-300 font-black px-3 py-1.5 rounded-lg ${pathname === '/admin' ? 'bg-orange-500/10 text-orange-500' : 'text-orange-400 hover:bg-orange-500/10 hover:text-orange-500'}`}>
                  Admin
                </Link>
              )}
              
              <Button variant="outline" size="sm" onClick={handleLogout} className="ml-2 font-bold hover:bg-destructive hover:text-destructive-foreground transition-all duration-300">
                Logout
              </Button>
            </>
          ) : (
            <div className="flex gap-2">
              <Link href="/auth/login">
                <Button variant="ghost" size="sm" className="font-bold">Login</Button>
              </Link>
              <Link href="/auth/signup">
                <Button size="sm" className="font-bold">Sign Up</Button>
              </Link>
            </div>
          )
        )}
      </div>
    </nav>
  );
}