'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function Profile() {
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [fullName, setFullName] = useState('');

  useEffect(() => {
    getProfile();
  }, []);

  async function getProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        let { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (error) throw error;
        if (data) {
          setStudentId(data.student_id);
          setFullName(data.full_name);
        }
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function updateProfile() {
    setIsUpdating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Authentication required.");

      const { error } = await supabase.from('profiles').update({
        student_id: studentId,
        full_name: fullName,
      }).eq('id', user.id);

      if (error) throw error;
      toast.success('Profile updated successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Update failed');
    } finally {
      setIsUpdating(false);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="animate-pulse text-muted-foreground font-black uppercase tracking-tighter">Loading Profile...</div>
    </div>
  );

  return (
    <div className="max-w-md mx-auto mt-10 p-8 bg-card border border-border rounded-2xl shadow-xl transition-colors duration-500">
      <h2 className="text-3xl font-black mb-8 italic uppercase tracking-tighter">My Profile</h2>
      <div className="space-y-6">
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">이름 (Name)</label>
          <Input 
            value={fullName} 
            onChange={(e: any) => setFullName(e.target.value)} 
            className="bg-background border-input font-bold"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">학번 (Student ID)</label>
          <Input 
            value={studentId} 
            onChange={(e: any) => setStudentId(e.target.value)} 
            className="bg-background border-input font-bold"
          />
        </div>
        <Button 
          onClick={updateProfile} 
          disabled={isUpdating}
          className="w-full py-6 font-black text-lg uppercase tracking-widest transition-all active:scale-95"
        >
          {isUpdating ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}