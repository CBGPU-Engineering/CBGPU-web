'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import{safeAuthReturn}from'@/lib/authReturn';
import { LoadingSpinner } from '@/components/ui/spinner';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      // The browser's URL will contain the code if it's a redirect from Supabase
      const { data, error } = await supabase.auth.getSession();
      if (!error) {
        const request=data.session?.user.user_metadata;
        const target=process.env.NEXT_PUBLIC_CBGPU_MULTISCHOOL_V1==='1'?(request?.school_setup_request===true?'/schools/new':request?.school_join_request?'/schools':'/'):'/';
        const requested=new URLSearchParams(window.location.search).get('next');
        router.replace(process.env.NEXT_PUBLIC_CBGPU_PUBLIC_BROWSING_V1==='1'&&requested?safeAuthReturn(requested):target);
      } else {
        console.error('Auth callback error:', error);
        router.push('/auth/login');
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <LoadingSpinner size={56} label="로그인을 확인하고 있어요" />
    </div>
  );
}
