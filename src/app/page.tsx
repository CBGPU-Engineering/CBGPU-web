'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import GPUCard from '@/components/GPUCard';

export default function Dashboard() {
  const [gpus, setGpus] = useState<any[]>([]);

  useEffect(() => {
    const fetchGPUs = async () => {
      const { data } = await supabase.from('gpus').select('*').order('id');
      if (data && data.length > 0) {
        setGpus(data);
      } else {
        setGpus([
          { id: 1, name: "RTX5000-1" },
          { id: 2, name: "RTX5000-2" },
          { id: 3, name: "RTX5000-3" },
          { id: 4, name: "RTX5000-4" },
        ]);
      }
    };
    fetchGPUs();
  }, []);

  return (
    <div className="container mx-auto py-12 px-6">
      <div className="mb-16 flex flex-col items-center text-center">
        <img 
          src="https://i.namu.wiki/i/qMgg10XRSaTorhAnQaV-bKbUWK_xIlq2socc7pVyw1SJmovke8gEWfeofFitiIJ1VBMngGy4o1NuAnjrOA0m1w.webp" 
          alt="충북과학고등학교 로고" 
          className="w-32 h-32 mb-6 object-contain"
        />
        <h1 className="text-5xl font-black tracking-tighter italic uppercase mb-4">
          충북과학고등학교 <br/>
          <span className="text-primary">서버컴퓨터 GPU 대여 시스템</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl font-medium">
          고성능 GPU 자원을 효율적으로 관리하고 연구 및 학습을 위해 예약하세요.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {gpus.map((gpu) => (
          <GPUCard key={gpu.id} id={gpu.id} name={gpu.name} />
        ))}
      </div>
    </div>
  );
}