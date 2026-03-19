"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useModalPortal } from "@/hooks/use-modal-portal";

interface ModalDialogProps {
  open: boolean;
  onClose: () => void;
  titleId: string;
  children: React.ReactNode;
}

export function ModalDialog({
  open,
  onClose,
  titleId,
  children,
}: ModalDialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const mounted = useModalPortal(open);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div
      ref={overlayRef}
      onClick={(event) => {
        if (event.target === overlayRef.current) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      {children}
    </div>,
    document.body
  );
}
