import * as React from "react";
import {Dialog as DialogPrimitive} from "@base-ui/react/dialog";
import {cn} from "cn";

import {Button} from "@pkg/ui/src/components/base/button.tsx";
import {XIcon} from "lucide-react";

const Dialog = ({...props}: DialogPrimitive.Root.Props) => <DialogPrimitive.Root data-slot="dialog" {...props} />;

const DialogTrigger = ({...props}: DialogPrimitive.Trigger.Props) => (
  <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
);

const DialogPortal = ({...props}: DialogPrimitive.Portal.Props) => (
  <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
);

const DialogClose = ({...props}: DialogPrimitive.Close.Props) => (
  <DialogPrimitive.Close data-slot="dialog-close" {...props} />
);

const DialogOverlay = ({className, ...props}: DialogPrimitive.Backdrop.Props) => (
  <DialogPrimitive.Backdrop
    data-slot="dialog-overlay"
    className={cn(
      "fixed inset-0 isolate z-50 bg-black/45 backdrop-blur-sm transition-opacity duration-200 ease-out data-starting-style:opacity-0 data-ending-style:opacity-0",
      className
    )}
    {...props}
  />
);

const DialogContent = ({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean;
}) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Popup
      data-slot="dialog-content"
      className={cn(
        "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[min(24rem,calc(100%-1.5rem))] -translate-x-1/2 -translate-y-1/2 grid-cols-[minmax(0,1fr)] gap-4 rounded-2xl bg-level [--level:1] p-4 text-sm text-popover-foreground shadow-[0_24px_64px_-16px_var(--brand-glow),0_12px_32px_-12px_rgb(0_0_0/0.6)] ring-1 ring-brand/35 outline-none before:pointer-events-none before:absolute before:inset-x-8 before:top-0 before:h-px before:bg-linear-to-r before:from-brand before:via-brand-end before:to-transparent transition-[opacity,scale] duration-200 ease-out data-starting-style:opacity-0 data-ending-style:opacity-0 motion-ok:data-starting-style:scale-95 motion-ok:data-ending-style:scale-95",
        className
      )}
      {...props}>
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close
          data-slot="dialog-close"
          render={<Button variant="ghost" className="absolute top-2 right-2" size="icon-sm" />}>
          <XIcon />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Popup>
  </DialogPortal>
);

const DialogHeader = ({className, ...props}: React.ComponentProps<"div">) => (
  <div data-slot="dialog-header" className={cn("flex flex-col gap-2", className)} {...props} />
);

const DialogFooter = ({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean;
}) => (
  <div
    data-slot="dialog-footer"
    className={cn(
      "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
      className
    )}
    {...props}>
    {children}
    {showCloseButton && <DialogPrimitive.Close render={<Button variant="outline" />}>Close</DialogPrimitive.Close>}
  </div>
);

const DialogTitle = ({className, ...props}: DialogPrimitive.Title.Props) => (
  <DialogPrimitive.Title
    data-slot="dialog-title"
    className={cn("text-base leading-none font-medium", className)}
    {...props}
  />
);

const DialogDescription = ({className, ...props}: DialogPrimitive.Description.Props) => (
  <DialogPrimitive.Description
    data-slot="dialog-description"
    className={cn(
      "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
      className
    )}
    {...props}
  />
);

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
  DialogTrigger
};
