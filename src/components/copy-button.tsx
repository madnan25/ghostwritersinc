"use client";

import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCopyFeedback } from "@/hooks/use-copy-feedback";

interface CopyButtonProps {
  text: string;
  idleLabel?: string;
  copiedLabel?: string;
  className?: string;
}

export function CopyButton({
  text,
  idleLabel = "Copy",
  copiedLabel = "Copied",
  className,
}: CopyButtonProps) {
  const { copied, copy } = useCopyFeedback();

  async function handleCopy() {
    await copy(text);
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className={className}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? copiedLabel : idleLabel}
    </Button>
  );
}
