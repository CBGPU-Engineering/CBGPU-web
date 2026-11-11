'use client';
import { createContext, useContext, useState, useCallback, ReactNode, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Input } from '@/components/ui/input';

type AlertType = 'success' | 'error' | 'info';

interface AlertState {
  open: boolean;
  title: string;
  message: string;
  type: AlertType;
}

interface Toast {
  id: number;
  message: string;
}

export interface ConfirmOptions { title?: string; message: string; confirmLabel?: string; cancelLabel?: string }

export interface PromptOptions { title?: string; message?: string; defaultValue?: string; placeholder?: string; confirmLabel?: string; cancelLabel?: string }

interface AlertCtx {
  showAlert: (msg: string, type?: AlertType, title?: string) => void;
  showError: (msg: string, title?: string) => void;
  /** 가벼운 자동 닫힘 토스트로 뜬다 — 일상적인 성공 피드백은 "확인"을 누르게 막지 않는다 */
  showSuccess: (msg: string) => void;
  /** window.confirm 대신 쓴다 — 앱 디자인의 확인창이 뜨고, 확인하면 true / 취소하면 false로 이어진다 */
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
  /** window.prompt 대신 쓴다 — 입력창이 있는 확인창. 확인하면 입력값, 취소하면 null */
  prompt: (options: PromptOptions | string) => Promise<string | null>;
}

const Ctx = createContext<AlertCtx | null>(null);

export function AlertProvider({ children, english = false }: { children: ReactNode; english?: boolean }) {
  const [s, setS] = useState<AlertState>({ open: false, title: '', message: '', type: 'info' });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const [ask, setAsk] = useState<{ open: boolean } & ConfirmOptions>({ open: false, message: '' });
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions | string) => new Promise<boolean>(resolve => {
    resolver.current?.(false); // a newer question replaces an unanswered one
    resolver.current = resolve;
    setAsk({ open: true, ...(typeof options === 'string' ? { message: options } : options) });
  }), []);
  const [ask2, setAsk2] = useState<{ open: boolean; value: string } & PromptOptions>({ open: false, value: '' });
  const resolver2 = useRef<((value: string | null) => void) | null>(null);
  const prompt = useCallback((options: PromptOptions | string) => new Promise<string | null>(resolve => {
    resolver2.current?.(null);
    resolver2.current = resolve;
    const o = typeof options === 'string' ? { title: options } : options;
    setAsk2({ open: true, value: o.defaultValue ?? '', ...o });
  }), []);
  const settle2 = (value: string | null) => { resolver2.current?.(value); resolver2.current = null; setAsk2(prev => ({ ...prev, open: false })); };
  const settle = (ok: boolean) => { resolver.current?.(ok); resolver.current = null; setAsk(prev => ({ ...prev, open: false })); };

  const showAlert = useCallback((msg: string, type: AlertType = 'info', title?: string) => {
    const titles = english ? {success:'Done',error:'Error',info:'Notice'} : { success: '완료', error: '오류', info: '알림' };
    if (english && type === 'error' && /[가-힣]/.test(msg)) msg = 'The operation could not be completed. Refresh the page and try again.';
    if (english && title && /[가-힣]/.test(title)) title = titles[type];
    setS({ open: true, message: msg, type, title: title ?? titles[type] });
  }, [english]);

  const showError = useCallback((msg: string, title = '오류') => showAlert(msg, 'error', title), [showAlert]);

  const showSuccess = useCallback((msg: string) => {
    const id = ++toastId.current;
    setToasts(prev => [...prev, { id, message: msg }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2500);
  }, []);

  return (
    <Ctx.Provider value={{ showAlert, showError, showSuccess, confirm, prompt }}>
      {children}
      <ConfirmDialog
        open={ask.open}
        title={ask.title}
        description={ask.message}
        confirmLabel={ask.confirmLabel ?? (english ? 'Confirm' : '확인')}
        cancelLabel={ask.cancelLabel ?? (english ? 'Cancel' : '취소')}
        onConfirm={() => settle(true)}
        onCancel={() => settle(false)}
      />
      <Dialog open={ask2.open} onOpenChange={o => !o && settle2(null)}>
        <DialogContent className="max-w-sm" showCloseButton={false}>
          <form onSubmit={e => { e.preventDefault(); settle2(ask2.value); }} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="font-semibold tracking-tight">{ask2.title ?? (english ? 'Enter a value' : '내용을 입력해 주세요')}</DialogTitle>
              {ask2.message && <DialogDescription className="text-sm">{ask2.message}</DialogDescription>}
            </DialogHeader>
            <Input autoFocus value={ask2.value} placeholder={ask2.placeholder} onChange={e => setAsk2(prev => ({ ...prev, value: e.target.value }))} className="h-12 rounded-lg border-border bg-background px-3.5 text-[15px] font-medium" />
            <DialogFooter className="gap-2 flex-row justify-end">
              <Button type="button" variant="outline" onClick={() => settle2(null)} className="font-semibold text-sm">{ask2.cancelLabel ?? (english ? 'Cancel' : '취소')}</Button>
              <Button type="submit" className="font-semibold text-sm">{ask2.confirmLabel ?? (english ? 'OK' : '확인')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={s.open} onOpenChange={o => !o && setS(p => ({ ...p, open: false }))}>
        <DialogContent className="max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className={`font-semibold tracking-tight ${
              s.type === 'error'   ? 'text-destructive' :
              s.type === 'success' ? 'text-success' : ''
            }`}>
              {s.title}
            </DialogTitle>
            <DialogDescription className="text-sm">{s.message}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => setS(p => ({ ...p, open: false }))}
              variant={s.type === 'error' ? 'destructive' : 'default'}
              className="font-semibold text-sm"
            >
              {english ? 'OK' : '확인'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="fixed bottom-4 left-0 right-0 z-[100] flex flex-col items-center gap-2 px-4 pointer-events-none sm:items-end sm:right-4 sm:left-auto">
        {toasts.map(t => (
          <div
            key={t.id}
            className="flex items-center gap-2 rounded-xl bg-foreground/90 backdrop-blur-xl saturate-150 text-background px-4 py-2.5 text-sm font-bold shadow-lg ring-1 ring-background/10 animate-in fade-in slide-in-from-bottom-4 duration-200 ease-[var(--ease-spring)]"
          >
            <CheckCircle2 className="size-4 text-success shrink-0" />
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useAlert() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAlert must be used within AlertProvider');
  return ctx;
}
