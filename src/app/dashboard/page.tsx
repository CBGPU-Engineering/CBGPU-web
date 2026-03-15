'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import GPUCard from '@/components/GPUCard';
import { Button } from '@/components/ui/button';

export default function Dashboard() {
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error) setMyReservations(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchMyReservations();
    const subscription = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => fetchMyReservations())
      .subscribe();
    return () => { supabase.removeChannel(subscription); };
  }, []);

  return (
    <div className="space-y-12 transition-colors duration-500">
      <section>
        <h1 className="text-4xl font-black mb-8 tracking-tighter italic uppercase">GPU Clusters</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {gpus.map((gpu) => (
            <GPUCard key={gpu.id} id={gpu.id} name={gpu.name} />
          ))}
        </div>
      </section>

      <hr className="border-border transition-colors duration-500" />

      <section className="pb-20">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold tracking-tight uppercase italic">My Reservations</h2>
          <Button variant="ghost" size="sm" onClick={fetchMyReservations} className="hover:bg-primary/10 font-bold uppercase text-[10px]">Refresh</Button>
        </div>

        {loading ? (
          <p className="text-muted-foreground animate-pulse font-medium">Loading status...</p>
        ) : myReservations.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed rounded-3xl text-muted-foreground transition-colors duration-500 font-medium">
            No reservation history found.
          </div>
        ) : (
          <div className="grid gap-4">
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
                <div key={res.id} className="flex flex-col md:flex-row items-start md:items-center justify-between p-6 border rounded-2xl bg-card shadow-sm hover:shadow-md transition-all duration-500">
                  <div className="space-y-1 mb-4 md:mb-0">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-primary italic tracking-tighter">GPU #{displayId}</span>
                      {isPending && <span className="bg-amber-500/10 text-amber-600 text-[10px] font-black uppercase px-2 py-0.5 rounded border border-amber-500/20">Pending</span>}
                      {isRejected && <span className="bg-destructive/10 text-destructive text-[10px] font-black uppercase px-2 py-0.5 rounded border border-destructive/20">Rejected</span>}
                      {isApproved && !isStarted && <span className="bg-blue-500/10 text-blue-600 text-[10px] font-black uppercase px-2 py-0.5 rounded border border-blue-500/20">Approved (Wait)</span>}
                      {isApproved && isStarted && !isEnded && <span className="bg-emerald-500/10 text-emerald-600 text-[10px] font-black uppercase px-2 py-0.5 rounded border border-emerald-500/20">Active</span>}
                      {isApproved && isEnded && <span className="bg-slate-500/10 text-slate-600 text-[10px] font-black uppercase px-2 py-0.5 rounded border border-slate-500/20">Finished</span>}
                    </div>
                    <p className="text-sm text-muted-foreground font-medium">
                      {start.toLocaleString('ko-KR')} ~ {end.toLocaleTimeString('ko-KR')}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 w-full md:w-auto">
                    <Button 
                      className="w-full md:w-auto font-black px-8 transition-all duration-300 uppercase italic text-[12px]"
                      variant={canStart ? "default" : "secondary"}
                      disabled={!canStart}
                      onClick={() => window.open(`ssh://user@server-node-${displayId}`, '_blank', 'noopener,noreferrer')}
                    >
                      {isRejected ? "Unavailable" : isApproved && !isStarted ? "Waiting for Start" : isApproved && isEnded ? "Ended" : isApproved ? "Start Session (SSH)" : "Under Review"}
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