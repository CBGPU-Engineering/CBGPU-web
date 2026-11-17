'use client';
import {useLayoutEffect,type ReactNode} from 'react';
import {useAuth} from '@/lib/useAuth';
import {usePathname} from 'next/navigation';
import {adDocumentHasRun,adDocumentRouteChanged,markPersonalDocument} from '@/lib/adDocumentBoundary';
import AdDocumentTransition from './AdDocumentTransition';
/** Applies to both the legacy workspace shell and public-browsing shell. */
export default function AdIdentityBoundary({children}:{children:ReactNode}){const{user}=useAuth(),path=usePathname();useLayoutEffect(()=>{if(user)markPersonalDocument()},[user]);return adDocumentRouteChanged(path)||user&&adDocumentHasRun()?<AdDocumentTransition/>:children}
