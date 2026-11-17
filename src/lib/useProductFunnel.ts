'use client';
import {createUseFunnel,type AnyFunnelState} from '@use-funnel/core';
import {useCallback,useState} from 'react';
/** Modal-local flow. No personal answers or credentials are put in a URL/storage. */
export const useProductFunnel=createUseFunnel<Record<string,never>>(function useMemoryRouter({initialState}) {
 const[state,setState]=useState<{history:AnyFunnelState[];currentIndex:number}>(()=>({history:[initialState],currentIndex:0}));
 const push=useCallback((next:AnyFunnelState)=>setState(old=>({history:[...old.history.slice(0,old.currentIndex+1),next],currentIndex:old.currentIndex+1})),[]);
 const replace=useCallback((next:AnyFunnelState)=>setState(old=>({history:old.history.map((item,i)=>i===old.currentIndex?next:item),currentIndex:old.currentIndex})),[]);
 const go=useCallback((delta:number)=>setState(old=>({...old,currentIndex:Math.max(0,Math.min(old.history.length-1,old.currentIndex+delta))})),[]);
 const cleanup=useCallback(()=>{},[]); // React owns this flow's lifetime.
 return {...state,push,replace,go,cleanup};
});
