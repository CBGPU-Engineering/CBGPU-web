import type { ReactNode } from 'react';

export function Notice({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="pv-notice"><strong>{title}</strong>{children}</div>;
}
