"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { InviteRequestRecord } from "./types";

function RequestStatusBadge({ status }: { status: InviteRequestRecord["status"] }) {
  const tone =
    status === "approved"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
      : status === "denied"
        ? "border-destructive/20 bg-destructive/10 text-destructive"
        : "border-yellow-500/20 bg-yellow-500/10 text-yellow-300";

  return (
    <span className={`rounded-full border px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.18em] ${tone}`}>
      {status}
    </span>
  );
}

export function OrgAdminInviteRequestsClient({
  initialRequests,
}: {
  initialRequests: InviteRequestRecord[];
}) {
  const [requests, setRequests] = useState(initialRequests);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const response = await fetch("/api/org-admin/invite-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          role,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Failed to submit invite request.");
        return;
      }

      setRequests((prev) => [data, ...prev]);
      setEmail("");
      setRole("member");
    });
  }

  return (
    <div className="space-y-6">
      <div className="dashboard-rail p-5">
        <div className="space-y-2">
          <p className="premium-kicker text-[0.68rem]">Request Invite</p>
          <h2 className="text-xl font-semibold tracking-[-0.03em] text-foreground">
            Ask platform admins to invite a teammate
          </h2>
          <p className="max-w-2xl text-sm leading-7 text-foreground/66">
            Submit the teammate and role you need. Approval will generate the actual invite
            link and route it through the platform-admin flow.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 grid gap-3 md:grid-cols-[1.2fr_0.7fr_auto]">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="colleague@example.com"
            className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-ring/50"
          />
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as "admin" | "member")}
            className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-ring/50"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <Button type="submit" disabled={isPending || !email} className="min-h-[48px]">
            {isPending ? "Submitting…" : "Request Invite"}
          </Button>
        </form>

        {error ? (
          <p className="mt-3 text-sm text-destructive">{error}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        {requests.length === 0 ? (
          <p className="dashboard-rail py-10 text-center text-sm text-muted-foreground">
            No invite requests yet.
          </p>
        ) : (
          requests.map((request) => (
            <div key={request.id} className="editorial-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{request.requested_email}</p>
                    <RequestStatusBadge status={request.status} />
                  </div>
                  <p className="mt-1 text-xs text-foreground/54">
                    Requested role: {request.requested_role}
                  </p>
                  <p className="mt-1 text-xs text-foreground/48">
                    Submitted {new Date(request.created_at).toLocaleString()}
                  </p>
                </div>
                {request.reviewed_at ? (
                  <p className="text-xs text-foreground/48">
                    Reviewed {new Date(request.reviewed_at).toLocaleString()}
                  </p>
                ) : null}
              </div>
              {request.decision_notes ? (
                <p className="mt-3 text-sm leading-6 text-foreground/66">{request.decision_notes}</p>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
