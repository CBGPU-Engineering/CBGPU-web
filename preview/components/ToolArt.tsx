export function ToolArt({ kind }: { kind: 'calendar' | 'meal' | 'study' | 'materials' }) {
  return (
    <svg className={'pv-tool-art pv-art-' + kind} width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden="true">
      {kind === 'calendar' && <>
        <rect x="9" y="13" width="34" height="31" rx="8" fill="#255ab9" />
        <rect x="9" y="10" width="34" height="30" rx="8" fill="#aac8ff" />
        <path d="M9 18a8 8 0 0 1 8-8h18a8 8 0 0 1 8 8v2H9z" fill="#4b82e7" />
        <path d="M18 7v8m16-8v8" stroke="#2155af" strokeWidth="4" strokeLinecap="round" />
        <path d="M18 26h2m6 0h2m6 0h2m-18 7h2m6 0h2m6 0h2" stroke="#245bad" strokeWidth="3" strokeLinecap="round" />
      </>}
      {kind === 'meal' && <>
        <circle cx="28" cy="28" r="17" fill="#e69e61" />
        <circle cx="28" cy="25" r="17" fill="#ffd7a8" />
        <circle cx="28" cy="25" r="10" fill="#fff1dc" stroke="#f8bc82" strokeWidth="2" />
        <path d="M10 17v22m-3-26v7c0 5 6 5 6 0v-7" stroke="#985235" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M24 26c2-5 6-6 9-4-1 4-5 7-9 4Z" fill="#ce7952" />
      </>}
      {kind === 'study' && <>
        <path d="M10 14q9-4 16 3 7-7 16-3v25q-9-4-16 3-7-7-16-3z" fill="#29715f" />
        <path d="M9 11q9-4 17 3 8-7 17-3v25q-9-4-17 3-8-7-17-3z" fill="#a8e3cc" />
        <path d="M26 14v24m-10-19q3 0 5 2m-5 4 5 2m10-6 5-2m-5 8 5-2" stroke="#29715f" strokeWidth="2" strokeLinecap="round" />
      </>}
      {kind === 'materials' && <>
        <path d="M8 15a5 5 0 0 1 5-5h9l4 4h13a5 5 0 0 1 5 5v19a5 5 0 0 1-5 5H13a5 5 0 0 1-5-5z" fill="#8580c9" />
        <rect x="8" y="19" width="36" height="22" rx="6" fill="#c9c1f8" />
        <path d="M20 30h12m-6-6v12" stroke="#55489d" strokeWidth="2.5" strokeLinecap="round" />
      </>}
    </svg>
  );
}
