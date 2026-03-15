'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from './ThemeToggle';

export default function Navbar() {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
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
        console.log("Admin Check:", data.is_admin);
        setIsAdmin(data.is_admin);
      }
    } catch (err) {
      console.error("Admin fetch error:", err);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        await checkAdminStatus(session.user.id);
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
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAdmin(false);
    router.push('/auth/login');
  };

  return (
    <nav className="flex items-center justify-between px-10 py-4 bg-background/50 border-b border-border sticky top-0 z-50 backdrop-blur-md">
      <Link href="/" className="text-2xl font-black text-primary tracking-tighter">
        CBGPU
      </Link>
      
      <div className="flex gap-4 items-center font-medium">
        <ThemeToggle />
        
        {user ? (
          <>
            <Link href="/dashboard" className={`text-sm transition ${pathname === '/dashboard' ? 'text-primary font-bold' : 'hover:text-primary'}`}>
              Dashboard
            </Link>
            <Link href="/profile" className={`text-sm transition ${pathname === '/profile' ? 'text-primary font-bold' : 'hover:text-primary'}`}>
              My Profile
            </Link>
            
            {isAdmin && (
              <Link href="/admin" className={`text-sm transition font-bold ${pathname === '/admin' ? 'text-orange-500' : 'text-orange-400 hover:text-orange-500'}`}>
                Admin
              </Link>
            )}
            
            <Button variant="outline" size="sm" onClick={handleLogout} className="ml-2">
              Logout
            </Button>
          </>
        ) : (
          <div className="flex gap-2">
            <Link href="/auth/login">
              <Button variant="ghost" size="sm">Login</Button>
            </Link>
            <Link href="/auth/signup">
              <Button size="sm">Sign Up</Button>
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}