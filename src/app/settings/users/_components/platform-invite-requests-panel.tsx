"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { Invitation, InviteRequestRecord } from "./types";

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

export function PlatformInviteRequestsPanel({
  initialRequests,
  onInvitationApproved,
}: {
  initialRequests: InviteRequestRecord[];
  onInvitationApproved?: (invitation: Invitation) => void;
}) {
  const [requests, setRequests] = useState(initialRequests);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"approve" | "deny" | null>(null);
  const [, startTransition] = useTransition();

  function handleDecision(id: string, action: "approve" | "deny") {
    setError(null);
    setPendingId(id);
    setPendingAction(action);
    startTransition(async () => {
      const response = await fetch(`/api/admin/invite-requests/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? `Failed to ${action} invite request.`);
        setPendingId(null);
        setPendingAction(null);
        return;
      }

      const updatedRequest = action === "approve" ? data.request : data;
      setRequests((prev) =>
        prev.map((request) => (request.id === id ? updatedRequest : request))
      );

      if (action === "approve" && onInvitationApproved) {
        onInvitationApproved({
          id: data.invitation.id,
          organization_id: data.invitation.organization_id,
          organization_name: updatedRequest.organization_name ?? null,
          email: data.invitation.email,
          role: data.invitation.role,
          expires_at: data.invitation.expires_at,
          created_at: data.invitation.created_at,
        });
      }

      setPendingId(null);
      setPendingAction(null);
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="premium-kicker text-[0.68rem]">Pending Invite Requests</p>
        <p className="max-w-3xl text-sm leading-7 text-foreground/66">
          Review org-admin requests and decide when a real invite should be issued.
        </p>
      </div>

      {error ? (
        <div className="rounded-[20px] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {requests.length === 0 ? (
        <p className="dashboard-rail py-10 text-center text-sm text-muted-foreground">
          No invite requests yet.
        </p>
      ) : (
        <div className="grid gap-3">
          {requests.map((request) => (
            <div key={request.id} className="editorial-card p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-foreground">{request.requested_email}</p>
                    <RequestStatusBadge status={request.status} />
                  </div>
                  <p className="mt-1 text-xs text-foreground/54">
                    {request.organization_name ?? request.organization_id} · requested by{" "}
                    {request.requested_by_name ?? request.requested_by}
                  </p>
                  <p className="mt-1 text-xs text-foreground/48">
                    Role: {request.requested_role} · Submitted{" "}
                    {new Date(request.created_at).toLocaleString()}
                  </p>
                  {request.decision_notes ? (
                    <p className="mt-3 text-sm leading-6 text-foreground/66">{request.decision_notes}</p>
                  ) : null}
                </div>
                {request.status === "pending" ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={pendingId === request.id}
                      onClick={() => handleDecision(request.id, "deny")}
                    >
                      {pendingId === request.id && pendingAction === "deny" ? "Denying…" : "Deny"}
                    </Button>
                    <Button
                      size="sm"
                      disabled={pendingId === request.id}
                      onClick={() => handleDecision(request.id, "approve")}
                    >
                      {pendingId === request.id && pendingAction === "approve"
                        ? "Approving…"
                        : "Approve"}
                    </Button>
                  </div>
                ) : request.reviewed_at ? (
                  <p className="text-xs text-foreground/48">
                    Reviewed {new Date(request.reviewed_at).toLocaleString()}
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
