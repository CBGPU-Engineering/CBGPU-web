'use client';
import {useLayoutEffect} from 'react';
/** Do not render personalized children in a document that previously executed an ad SDK. */
export default function AdDocumentTransition(){useLayoutEffect(()=>{window.location.reload()},[]);return <p role="status" className="cb-school-page">로그인 상태를 안전하게 연결하고 있어요.</p>}
