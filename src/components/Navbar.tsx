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
  const [profile, setProfile] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (data) {
        setProfile(data);
        setIsAdmin(data.is_admin);
      } else {
        setIsAdmin(false);
      }
    } catch (err) {
      console.error("Profile fetch error:", err);
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
          await fetchProfile(currentUser.id);
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
        await fetchProfile(currentUser.id);
      } else {
        setProfile(null);
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
      setProfile(null);
      setIsAdmin(false);
      toast.success("Signed out successfully.");
      router.push('/auth/login');
      router.refresh();
    } catch (err: any) {
      toast.error("Logout failed.");
      console.error(err);
    }
  };

  return (
    <nav className="flex items-center justify-between px-10 py-4 bg-background/50 border-b border-border sticky top-0 z-50 backdrop-blur-md transition-all">
      <div className="flex items-center gap-8">
        <Link href="/" className="flex items-center gap-2 group transition-transform active:scale-95">
          <img 
            src="https://i.namu.wiki/i/qMgg10XRSaTorhAnQaV-bKbUWK_xIlq2socc7pVyw1SJmovke8gEWfeofFitiIJ1VBMngGy4o1NuAnjrOA0m1w.webp" 
            alt="Logo" 
            className="w-8 h-8 object-contain group-hover:rotate-12 transition-transform duration-500"
          />
          <span className="text-2xl font-black text-primary tracking-tighter italic">
            CBGPU
          </span>
        </Link>

        {user && !isLoading && (
          <div className="hidden md:flex gap-1">
            <Link href="/dashboard" className={`text-xs transition-all duration-300 font-black px-3 py-1.5 rounded-lg uppercase tracking-widest ${pathname === '/dashboard' ? 'bg-primary text-primary-foreground shadow-lg' : 'hover:bg-muted text-muted-foreground'}`}>
              Dashboard
            </Link>
            {isAdmin && (
              <Link href="/admin" className={`text-xs transition-all duration-300 font-black px-3 py-1.5 rounded-lg uppercase tracking-widest ${pathname === '/admin' ? 'bg-orange-500 text-white shadow-lg' : 'text-orange-500 hover:bg-orange-500/10'}`}>
                Admin
              </Link>
            )}
          </div>
        )}
      </div>
      
      <div className="flex gap-4 items-center">
        <ThemeToggle />
        
        {!isLoading && (
          user ? (
            <div className="flex items-center gap-4 pl-4 border-l border-border/50">
              <Link href="/profile" className="flex flex-col items-end group transition-all">
                <span className="text-[10px] font-black uppercase text-primary leading-none group-hover:underline">
                  {profile?.full_name || 'My Profile'}
                </span>
                <span className="text-[9px] text-muted-foreground font-medium opacity-70">
                  {user.email}
                </span>
              </Link>
              
              <Button variant="outline" size="xs" onClick={handleLogout} className="font-black text-[10px] uppercase h-8 px-3 border-border hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-all">
                Sign Out
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Link href="/auth/login">
                <Button variant="ghost" size="sm" className="font-black text-[10px] uppercase tracking-widest">Login</Button>
              </Link>
              <Link href="/auth/signup">
                <Button size="sm" className="font-black text-[10px] uppercase tracking-widest shadow-md">Join</Button>
              </Link>
            </div>
          )
        )}
      </div>
    </nav>
  );
}