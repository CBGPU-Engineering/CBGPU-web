'use client';
import {useLayoutEffect} from 'react';
/** Do not render personalized children in a document that previously executed an ad SDK. */
export default function AdDocumentTransition(){useLayoutEffect(()=>{window.location.reload()},[]);return <p role="status" className="cb-school-page">페이지를 열고 있어요.</p>}
