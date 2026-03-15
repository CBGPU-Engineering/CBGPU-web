'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
    else router.push('/dashboard');
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-8 bg-card border border-border rounded-2xl shadow-2xl transition-colors duration-500">
      <h2 className="text-3xl font-bold mb-6 text-center text-foreground">Welcome Back</h2>
      <form onSubmit={handleLogin} className="space-y-4">
        <Input 
          type="email" 
          placeholder="Email" 
          className="bg-background border-input text-foreground" 
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} 
          required 
        />
        <Input 
          type="password" 
          placeholder="Password" 
          className="bg-background border-input text-foreground" 
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} 
          required 
        />
        <Button className="w-full bg-primary py-6 text-lg font-bold text-primary-foreground hover:bg-primary/90">
          Login
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        No account? <Link href="/auth/signup" className="text-primary font-bold hover:underline">Sign Up</Link>
      </p>
    </div>
  );
}