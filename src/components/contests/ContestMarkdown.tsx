'use client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
export default function ContestMarkdown({children}:{children:string}){return <div className="contest-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={{a:({children,href,title})=><a href={href} title={title} target="_blank" rel="noopener noreferrer">{children}</a>,img:({src,alt})=>typeof src==='string'?<img src={src} alt={alt||'대회 소개 이미지'} loading="lazy" decoding="async" referrerPolicy="no-referrer"/>:null}}>{children}</ReactMarkdown></div>;}
