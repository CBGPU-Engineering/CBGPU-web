'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { toast } from 'sonner';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error("로그인 실패: " + error.message);
      } else {
        toast.success("반갑습니다!");
        router.push('/dashboard');
      }
    } catch (err: any) {
      toast.error("오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-8 bg-card border border-border rounded-2xl shadow-2xl transition-colors duration-500">
      <h2 className="text-3xl font-bold mb-6 text-center text-foreground italic uppercase tracking-tighter">Welcome Back</h2>
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
        <Button 
          disabled={isSubmitting}
          className="w-full bg-primary py-6 text-lg font-bold text-primary-foreground hover:bg-primary/90 transition-all active:scale-95"
        >
          {isSubmitting ? "로그인 중..." : "Login"}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        No account? <Link href="/auth/signup" className="text-primary font-bold hover:underline">Sign Up</Link>
      </p>
    </div>
  );
}