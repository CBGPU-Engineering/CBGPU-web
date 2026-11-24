'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import styles from './SchoolOps.module.css';

type Props = {
  open: boolean;
  title: string;
  children: ReactNode;
  label: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function SchoolOpsConfirm({ open, title, children, label, busy, onCancel, onConfirm }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const description = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} aria-labelledby={heading} aria-describedby={description} className={styles.confirmation}
      onCancel={event => {
        event.preventDefault();
        if (!busy) onCancel();
      }}>
      <h2 id={heading}>{title}</h2>
      <p id={description}>{children}</p>
      <div className={styles.inline}>
        <button type="button" className={styles.secondary} autoFocus disabled={busy} onClick={onCancel}>취소</button>
        <button type="button" className={'pv-primary'} disabled={busy} onClick={onConfirm}>{label}</button>
      </div>
    </dialog>
  );
}
