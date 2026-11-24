'use client';

import type { ReactNode } from 'react';
import { SchoolScopeProvider } from '@/components/schools/SchoolScope';
import { ProductExperienceProvider } from '@/components/ui/product-motion';
import { AlertProvider } from '@/lib/alert';
import { AuthProvider } from '@/lib/useAuth';
import '../app/feature-utilities.css';

export default function FeatureProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <SchoolScopeProvider>
        <ProductExperienceProvider>
          <AlertProvider>{children}</AlertProvider>
        </ProductExperienceProvider>
      </SchoolScopeProvider>
    </AuthProvider>
  );
}
