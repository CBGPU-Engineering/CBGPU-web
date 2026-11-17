'use client';
import {useLayoutEffect,type ReactNode} from 'react';
import {useAuth} from '@/lib/useAuth';
import {adDocumentHasRun,markPersonalDocument} from '@/lib/adDocumentBoundary';
import AdDocumentTransition from './AdDocumentTransition';
/** Applies to both the legacy workspace shell and public-browsing shell. */
export default function AdIdentityBoundary({children}:{children:ReactNode}){const{user}=useAuth();useLayoutEffect(()=>{if(user)markPersonalDocument()},[user]);return user&&adDocumentHasRun()?<AdDocumentTransition/>:children}
