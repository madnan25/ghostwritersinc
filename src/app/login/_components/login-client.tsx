"use client";

import { useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { startLinkedInOAuth } from "@/lib/linkedin-oauth";

export function LoginClient() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const errorMessage =
    error === "no_invitation"
      ? "You need an invitation to join. Contact the organization owner."
      : error === "invalid_invitation"
        ? "This invitation is invalid or has expired. Ask the organization owner for a new invite."
        : error === "invite_email_mismatch"
          ? "Sign in with the same email address that received the invitation."
          : null;

  async function handleLinkedInLogin() {
    await startLinkedInOAuth("/dashboard");
  }

  return (
    <AuthShell
      eyebrow="Private Access"
      title="Welcome back"
      description="Sign in to review drafts, shape approvals, and keep your publishing system moving with editorial clarity."
      footer={
        <p className="text-xs leading-6 text-muted-foreground">
          Access is invitation-only and tailored for internal teams managing executive content.
        </p>
      }
    >
      <div className="space-y-6">
        {errorMessage && (
          <div className="rounded-[22px] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </div>
        )}
        <div className="premium-subtle-panel p-5">
          <p className="text-sm leading-7 text-muted-foreground">
            Continue with LinkedIn OAuth to access your organization workspace and publishing controls.
          </p>
        </div>
        <Button
          size="lg"
          className="w-full justify-center text-sm"
          onClick={handleLinkedInLogin}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
          </svg>
          Sign in with LinkedIn
        </Button>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="premium-subtle-panel p-4">
            <p className="text-[0.68rem] uppercase tracking-[0.3em] text-primary/70">Editorial Reviews</p>
            <p className="mt-2 text-sm text-muted-foreground">Move through draft, agent review, and client approval with less clutter.</p>
          </div>
          <div className="premium-subtle-panel p-4">
            <p className="text-[0.68rem] uppercase tracking-[0.3em] text-primary/70">Premium Workspace</p>
            <p className="mt-2 text-sm text-muted-foreground">A darker, calmer environment built for focused content decisions.</p>
          </div>
        </div>
      </div>
    </AuthShell>
  );
}
