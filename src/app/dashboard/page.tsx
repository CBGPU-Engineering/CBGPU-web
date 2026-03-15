'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import GPUCard from '@/components/GPUCard';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/useAuth';
import { toast } from 'sonner';
import { RefreshCw, Trash2 } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const [myReservations, setMyReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  const gpus = [
    { id: 1, name: "RTX5000" },
    { id: 2, name: "RTX5000" },
    { id: 3, name: "RTX5000" },
    { id: 4, name: "RTX5000" },
  ];

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const fetchMyReservations = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error) setMyReservations(data || []);
    setLoading(false);
  };

  const handleCancel = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this reservation?")) return;

    try {
      const { error } = await supabase
        .from('reservations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success("Reservation cancelled.");
      fetchMyReservations();
    } catch (err: any) {
      toast.error("Failed to cancel: " + err.message);
    }
  };

  useEffect(() => {
    if (user) {
      fetchMyReservations();
      const subscription = supabase
        .channel('schema-db-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => fetchMyReservations())
        .subscribe();
      return () => { supabase.removeChannel(subscription); };
    }
  }, [user]);

  if (!user && !loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4">
        <h2 className="text-2xl font-black uppercase italic">Authentication Required</h2>
        <p className="text-muted-foreground">Please sign in to view your reservations.</p>
      </div>
    );
  }

  return (
    <div className="space-y-12 md:space-y-20 transition-colors duration-500">
      <section>
        <div className="flex flex-col items-center md:items-start mb-8 gap-2">
          <h1 className="text-3xl md:text-4xl font-black tracking-tighter italic uppercase">GPU Clusters</h1>
          <div className="h-1 w-20 bg-primary rounded-full"></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {gpus.map((gpu) => (
            <GPUCard key={gpu.id} id={gpu.id} name={gpu.name} />
          ))}
        </div>
      </section>

      <hr className="border-border transition-colors duration-500" />

      <section className="pb-20">
        <div className="flex items-center justify-between mb-8">
          <div className="flex flex-col">
            <h2 className="text-xl md:text-2xl font-black tracking-tight uppercase italic">My Reservations</h2>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Manage your active sessions</p>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchMyReservations} className="hover:bg-primary/10 font-bold uppercase text-[10px] gap-2">
            <RefreshCw className="size-3" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>

        {loading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 w-full bg-muted animate-pulse rounded-2xl"></div>
            ))}
          </div>
        ) : myReservations.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed rounded-3xl text-muted-foreground transition-colors duration-500 font-medium bg-muted/10">
            No active reservations found.
          </div>
        ) : (
          <div className="grid gap-4 md:gap-6">
            {myReservations.map((res) => {
              const start = new Date(res.start_time);
              const end = new Date(res.end_time);
              const isStarted = currentTime >= start;
              const isEnded = currentTime > end;
              const isApproved = res.status === 'approved';
              const isRejected = res.status === 'rejected';
              const isPending = res.status === 'pending';
              const canStart = isApproved && isStarted && !isEnded;

              const displayId = res.gpu_id === 0 ? 1 : res.gpu_id;

              return (
                <div key={res.id} className="group flex flex-col md:flex-row items-start md:items-center justify-between p-5 md:p-6 border rounded-2xl bg-card shadow-sm hover:shadow-xl hover:border-primary/50 transition-all duration-500">
                  <div className="space-y-2 mb-4 md:mb-0 w-full md:w-auto">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-lg md:text-xl font-black text-primary italic tracking-tighter">GPU #{displayId}</span>
                      {isPending && <span className="bg-amber-500/10 text-amber-600 text-[9px] font-black uppercase px-2 py-0.5 rounded border border-amber-500/20">Pending</span>}
                      {isRejected && <span className="bg-destructive/10 text-destructive text-[9px] font-black uppercase px-2 py-0.5 rounded border border-destructive/20">Rejected</span>}
                      {isApproved && !isStarted && <span className="bg-blue-500/10 text-blue-600 text-[9px] font-black uppercase px-2 py-0.5 rounded border border-blue-500/20">Upcoming</span>}
                      {isApproved && isStarted && !isEnded && <span className="bg-emerald-500/10 text-emerald-600 text-[9px] font-black uppercase px-2 py-0.5 rounded border border-emerald-500/20">Active Now</span>}
                      {isApproved && isEnded && <span className="bg-slate-500/10 text-slate-600 text-[9px] font-black uppercase px-2 py-0.5 rounded border border-slate-500/20">Finished</span>}
                    </div>
                    <p className="text-xs md:text-sm text-muted-foreground font-bold bg-muted/50 inline-block px-2 py-1 rounded-md">
                      {start.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 
                      <span className="mx-2 opacity-30">→</span>
                      {end.toLocaleString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 w-full md:w-auto">
                    {isPending && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleCancel(res.id)}
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                    <Button 
                      className="flex-grow md:flex-grow-0 min-w-[140px] md:min-w-[180px] font-black px-8 transition-all duration-300 uppercase italic text-[11px] h-11"
                      variant={canStart ? "default" : "secondary"}
                      disabled={!canStart}
                      onClick={() => window.open(`ssh://user@server-node-${displayId}`, '_blank', 'noopener,noreferrer')}
                    >
                      {isRejected ? "Access Denied" : isApproved && !isStarted ? "Waiting" : isApproved && isEnded ? "Session Ended" : isApproved ? "Start SSH" : "Under Review"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}