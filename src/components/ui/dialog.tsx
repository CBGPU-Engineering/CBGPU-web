"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"
import {AnimatePresence,motion,useReducedMotion} from "motion/react"
import {productSpring} from "@/lib/motion"
import {managementChromeEnglish,managementPortalContainer} from "@/lib/managementChrome"
const DialogState=React.createContext(false)

function Dialog(props: React.ComponentProps<typeof DialogPrimitive.Root>) {
  const [internal,setInternal]=React.useState(props.defaultOpen??false);
  const open=props.open??internal;
  return <DialogState.Provider value={open}><DialogPrimitive.Root data-slot="dialog" {...props} open={open} onOpenChange={value=>{if(props.open===undefined)setInternal(value);props.onOpenChange?.(value)}}/></DialogState.Provider>
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" container={managementPortalContainer()} {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-[200] bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  onExitComplete,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
  onExitComplete?:()=>void
}) {
  const open=React.useContext(DialogState),reduce=useReducedMotion();
  return (
    <AnimatePresence onExitComplete={onExitComplete}>
    {open&&<DialogPortal forceMount>
      <DialogOverlay forceMount asChild><motion.div data-motion-dialog initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:reduce?0:.18}}/></DialogOverlay>
      <DialogPrimitive.Content forceMount asChild
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-[201] grid w-full max-w-[calc(100%-2rem)] max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-card border p-4 text-sm shadow-xl duration-100 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
          className
        )}
        {...props}
      >
       <motion.div data-motion-dialog initial={{opacity:0,y:reduce?0:14,scale:reduce?1:.975}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:reduce?0:8,scale:reduce?1:.985}} transition={reduce?{duration:0}:productSpring}>
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close data-slot="dialog-close" asChild>
            <Button
              variant="ghost"
              className="absolute top-2 right-2 min-h-11 min-w-11"
              size="icon-sm"
            >
              <XIcon
              />
              <span className="sr-only">{managementChromeEnglish() ? "Close" : "닫기"}</span>
            </Button>
          </DialogPrimitive.Close>
        )}
       </motion.div>
      </DialogPrimitive.Content>
    </DialogPortal>}
    </AnimatePresence>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 pr-12", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">{managementChromeEnglish() ? "Close" : "닫기"}</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "text-base leading-none font-medium",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
