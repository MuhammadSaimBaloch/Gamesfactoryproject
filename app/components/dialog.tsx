import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
export function Panel({
  open,
  onOpenChange,
  title,
  children,
  className = "",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className={`panel ${className}`}>
          <div className="panel-heading">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close className="icon-button" aria-label="Close">
              <X />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            {title}. Press Escape to close.
          </Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
