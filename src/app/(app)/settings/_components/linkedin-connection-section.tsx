"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { startLinkedInOAuth } from "@/lib/linkedin-oauth";

interface LinkedInStatus {
  connected: boolean;
  linkedinMemberId: string | null;
  connectedAt: string | null;
  expiresAt: string | null;
}

type FeedbackState = { type: "success" | "error"; message: string } | null;

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getExpiryLabel(expiresAt: string | null): { text: string; warn: boolean } {
  if (!expiresAt) return { text: "Unknown expiry", warn: false };
  const exp = new Date(expiresAt);
  const now = new Date();
  const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return { text: "Token expired", warn: true };
  if (diffDays <= 7)
    return { text: `Expires in ${diffDays} day${diffDays === 1 ? "" : "s"}`, warn: true };
  return { text: `Expires ${exp.toLocaleDateString()}`, warn: false };
}

export function LinkedInConnectionSection() {
  const [status, setStatus] = useState<LinkedInStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    fetch("/api/linkedin/status")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load LinkedIn status");
        return res.json() as Promise<LinkedInStatus>;
      })
      .then(setStatus)
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : "Failed to load LinkedIn status");
      });
  }, []);

  function handleConnect() {
    startLinkedInOAuth("/settings");
  }

  function handleDisconnect() {
    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/linkedin/disconnect", { method: "POST" });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "Disconnect failed");
        }
        setStatus((prev) =>
          prev ? { ...prev, connected: false, linkedinMemberId: null, connectedAt: null, expiresAt: null } : prev
        );
        setFeedback({ type: "success", message: "LinkedIn disconnected successfully." });
      } catch (err: unknown) {
        setFeedback({
          type: "error",
          message: err instanceof Error ? err.message : "Disconnect failed",
        });
      }
    });
  }

  return (
    <div className="space-y-4">
      {feedback && (
        <p
          className={`text-sm ${
            feedback.type === "success" ? "text-emerald-400" : "text-destructive"
          }`}
        >
          {feedback.message}
        </p>
      )}

      {loadError ? (
        <div className="dashboard-rail flex items-center justify-between p-5 min-h-[72px]">
          <p className="text-sm text-foreground/68">{loadError}</p>
          <Button size="sm" onClick={handleConnect} className="min-h-[40px]">
            Connect LinkedIn
          </Button>
        </div>
      ) : status === null ? (
        /* Loading skeleton */
        <div className="dashboard-rail flex items-center gap-3 p-5 min-h-[72px]">
          <div className="h-3 w-24 animate-pulse rounded-full bg-border/60" />
          <div className="h-3 w-36 animate-pulse rounded-full bg-border/40" />
        </div>
      ) : status.connected ? (
        <div className="dashboard-rail p-5 space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
                <p className="text-sm font-medium text-emerald-400">Connected</p>
              </div>
              {status.linkedinMemberId && (
                <p className="text-xs text-foreground/68">
                  Member ID: <span className="font-mono">{status.linkedinMemberId}</span>
                </p>
              )}
              {status.connectedAt && (
                <p className="text-xs text-foreground/68">
                  Connected {formatDate(status.connectedAt)}
                </p>
              )}
              {(() => {
                const { text, warn } = getExpiryLabel(status.expiresAt);
                return (
                  <p className={`text-xs ${warn ? "text-yellow-300" : "text-foreground/68"}`}>
                    {text}
                  </p>
                );
              })()}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleConnect}
                disabled={isPending}
                className="min-h-[40px]"
              >
                Reconnect
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDisconnect}
                disabled={isPending}
                className="min-h-[40px] text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                {isPending ? "Disconnecting…" : "Disconnect"}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="dashboard-rail flex items-center justify-between p-5 min-h-[72px]">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-foreground/30" aria-hidden="true" />
              <p className="text-sm text-foreground/68">Not connected</p>
            </div>
            <p className="text-xs text-foreground/50">
              Connect your LinkedIn account to enable publishing.
            </p>
          </div>
          <Button size="sm" onClick={handleConnect} className="min-h-[40px]">
            Connect LinkedIn
          </Button>
        </div>
      )}
    </div>
  );
}
