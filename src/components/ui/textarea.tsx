import * as React from 'react';
import {cn} from '@/lib/utils';

/** Multiline fields share the input focus, invalid and disabled states. Labels belong to the form. */
export function Textarea({className,...props}:React.ComponentProps<'textarea'>){
 return <textarea data-slot="textarea" className={cn('min-h-28 w-full min-w-0 resize-y rounded-lg border border-input bg-transparent px-3 py-2.5 text-base leading-relaxed outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-background/40',className)} {...props}/>;
}
