'use client';
import {type ReactNode} from 'react';
import {usePathname} from 'next/navigation';
import {adDocumentRouteChanged} from '@/lib/adDocumentBoundary';
import AdDocumentTransition from './AdDocumentTransition';
/** Applies to both the legacy workspace shell and public-browsing shell. */
export default function AdIdentityBoundary({children}:{children:ReactNode}){const path=usePathname();return adDocumentRouteChanged(path)?<AdDocumentTransition/>:children}
