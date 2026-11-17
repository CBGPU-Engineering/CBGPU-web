'use client';
import {type ReactNode} from 'react';
import {useAuth} from '@/lib/useAuth';
import {usePathname} from 'next/navigation';
import {adDocumentRouteChanged,adDocumentIdentityChanged} from '@/lib/adDocumentBoundary';
import AdDocumentTransition from './AdDocumentTransition';
/** Applies to both the legacy workspace shell and public-browsing shell. */
export default function AdIdentityBoundary({children}:{children:ReactNode}){const path=usePathname(),{user}=useAuth();return adDocumentRouteChanged(path)||adDocumentIdentityChanged(user?.id||'anonymous')?<AdDocumentTransition/>:children}
