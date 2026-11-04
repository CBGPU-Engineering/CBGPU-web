import Link from 'next/link';
import {LockKeyhole, ShieldAlert, RefreshCw} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {LoadingSpinner} from '@/components/ui/spinner';
type State = 'loading' | 'sign-in' | 'denied' | 'error';
const content = {
  'sign-in': {Icon: LockKeyhole, title: 'Sign in to continue', description: 'Use the CBGPU account assigned to this equipment workspace.'},
  denied: {Icon: ShieldAlert, title: 'Equipment access required', description: 'Your account is not assigned to this workspace. Ask a site administrator to check your equipment assignment.'},
  error: {Icon: ShieldAlert, title: 'Access check could not finish', description: 'Your account or equipment permissions could not be confirmed. Check your connection and try again.'},
};
export default function EquipmentAccessStatus({state, onRetry}: {state: State; onRetry: () => void}) {
  if (state === 'loading') return <div className="flex min-h-[50vh] items-center justify-center"><LoadingSpinner size={56} label="Checking equipment access…"/></div>;
  const {Icon, title, description} = content[state];
  return <section role={state === 'error' || state === 'denied' ? 'alert' : 'status'} aria-live="polite" className="surface mx-auto mt-6 w-full max-w-xl p-6 sm:p-8">
    <div className="mb-5 flex size-12 items-center justify-center rounded-xl bg-muted text-primary"><Icon aria-hidden="true" className="size-6"/></div>
    <h1 className="text-xl font-semibold">{title}</h1>
    <p className="mt-3 max-w-prose text-sm leading-6 text-muted-foreground">{description}</p>
    <div className="mt-6 flex flex-wrap gap-3">
      {state === 'sign-in' && <Button asChild><Link href="/auth/login">Sign in</Link></Button>}
      {(state === 'error' || state === 'denied') && <Button variant="outline" onClick={onRetry}><RefreshCw aria-hidden="true" className="size-4"/>Try again</Button>}
    </div>
  </section>;
}
