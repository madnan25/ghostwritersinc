"use client";

import { useEffect, useState } from "react";

export function useCopyFeedback(resetAfterMs = 2000) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCopied(false);
    }, resetAfterMs);

    return () => window.clearTimeout(timeoutId);
  }, [copied, resetAfterMs]);

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
  }

  return {
    copied,
    copy,
    reset: () => setCopied(false),
  };
}
