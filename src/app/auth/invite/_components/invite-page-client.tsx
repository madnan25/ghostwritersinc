"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { startLinkedInOAuth } from "@/lib/linkedin-oauth";

export function InvitePageClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "valid" | "invalid">(
    token ? "loading" : "invalid"
  );
  const [orgName, setOrgName] = useState("");

  useEffect(() => {
    if (!token) return;

    let active = true;

    fetch(`/api/auth/invite/validate?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        if (data.organization_name) {
          setOrgName(data.organization_name);
          setStatus("valid");
        } else {
          setStatus("invalid");
        }
      })
      .catch(() => {
        if (active) {
          setStatus("invalid");
        }
      });

    return () => {
      active = false;
    };
  }, [token]);

  async function handleSignIn() {
    if (!token) return;

    const sessionResponse = await fetch("/api/auth/invite/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    if (!sessionResponse.ok) {
      setStatus("invalid");
      return;
    }

    await startLinkedInOAuth("/dashboard");
  }

  if (status === "loading") {
    return (
      <AuthShell
        eyebrow="Invitation Access"
        title="Preparing your invitation"
        description="Validating your workspace access and getting your sign-in flow ready."
      >
        <div className="space-y-4">
          <div className="h-8 w-32 animate-pulse rounded-full bg-muted" />
          <div className="h-4 w-full animate-pulse rounded-full bg-muted" />
          <div className="h-4 w-4/5 animate-pulse rounded-full bg-muted" />
          <div className="h-14 w-full animate-pulse rounded-full bg-muted" />
        </div>
      </AuthShell>
    );
  }

  if (status === "invalid") {
    return (
      <AuthShell
        eyebrow="Invitation Access"
        title="Invalid invitation"
        description="This invitation link is invalid or has expired. Contact your organization administrator for a new one."
      >
        <div className="space-y-5">
          <div className="editorial-card p-5">
            <p className="premium-copy text-sm leading-7">
              Invitations are time-bound and tied to your workspace. If this was sent recently, ask the owner to issue a fresh link.
            </p>
          </div>
          <Link
            href="/login"
            className="inline-block text-sm text-primary underline-offset-4 hover:underline"
          >
            Back to login
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Invitation Access"
      title="You&apos;re invited"
      description={`Sign in with LinkedIn to join ${orgName} and access the premium editorial workspace.`}
      footer={
        <p className="text-xs leading-6 text-muted-foreground">
          By continuing, you accept this invitation and complete access using the email address that received it.
        </p>
      }
    >
      <div className="space-y-6">
        <div className="editorial-card p-5">
          <p className="premium-kicker text-[0.64rem]">Organization</p>
          <p className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-foreground">{orgName}</p>
        </div>
        <Button
          size="lg"
          className="w-full shadow-none hover:translate-y-0 hover:shadow-none"
          onClick={handleSignIn}
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
          <div className="editorial-card p-4">
            <p className="premium-kicker text-[0.64rem]">Review Flow</p>
            <p className="premium-copy mt-2 text-sm">
              Collaborate on approvals and refinements in one clean queue.
            </p>
          </div>
          <div className="editorial-card p-4">
            <p className="premium-kicker text-[0.64rem]">Team Access</p>
            <p className="premium-copy mt-2 text-sm">
              Join a private publishing workspace designed for executive teams.
            </p>
          </div>
        </div>
      </div>
    </AuthShell>
  );
}
