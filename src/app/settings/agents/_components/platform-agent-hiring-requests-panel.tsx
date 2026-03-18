"use client";

import { useState, useTransition } from "react";
import { getSharedContextGuardMessage } from "@/lib/agent-context-sharing";
import { AGENT_TEAM_PRESETS } from "@/lib/agent-team-presets";
import { Button } from "@/components/ui/button";

interface AgentHiringRequestRecord {
  id: string;
  organization_id: string;
  organization_name?: string | null;
  requested_by: string;
  requested_by_name?: string | null;
  requested_for_user_id: string;
  requested_for_user_name?: string | null;
  preset_key: string;
  requested_shared_context: boolean;
  status: "pending" | "approved" | "denied";
  decision_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  organization_context_sharing_enabled: boolean;
}

function RequestStatusBadge({ status }: { status: AgentHiringRequestRecord["status"] }) {
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

export function PlatformAgentHiringRequestsPanel({
  initialRequests,
}: {
  initialRequests: AgentHiringRequestRecord[];
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
      const response = await fetch(`/api/admin/agent-hiring-requests/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? `Failed to ${action} hiring request.`);
        setPendingId(null);
        setPendingAction(null);
        return;
      }

      const updatedRequest = action === "approve" ? data.request : data;
      setRequests((prev) =>
        prev.map((request) => (request.id === id ? { ...request, ...updatedRequest } : request))
      );
      setPendingId(null);
      setPendingAction(null);
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="premium-kicker text-[0.68rem]">Pending Hiring Requests</p>
        <p className="max-w-3xl text-sm leading-7 text-foreground/66">
          Review org-admin requests for preset agent teams and commission them when the org
          and user are ready.
        </p>
      </div>

      {error ? (
        <div className="rounded-[20px] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {requests.length === 0 ? (
        <p className="dashboard-rail py-10 text-center text-sm text-muted-foreground">
          No hiring requests yet.
        </p>
      ) : (
        <div className="grid gap-3">
          {requests.map((request) => {
            const preset = AGENT_TEAM_PRESETS.find((entry) => entry.key === request.preset_key);
            const sharedContextGuardMessage = getSharedContextGuardMessage({
              allowSharedContext: request.requested_shared_context,
              organizationContextSharingEnabled: request.organization_context_sharing_enabled,
            });

            return (
              <div key={request.id} className="editorial-card p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground">
                        {preset?.label ?? request.preset_key}
                      </p>
                      <RequestStatusBadge status={request.status} />
                    </div>
                    <p className="mt-1 text-xs text-foreground/54">
                      {request.organization_name ?? request.organization_id} · requested by{" "}
                      {request.requested_by_name ?? request.requested_by}
                    </p>
                    <p className="mt-1 text-xs text-foreground/48">
                      User: {request.requested_for_user_name ?? request.requested_for_user_id} ·
                      Submitted {new Date(request.created_at).toLocaleString()}
                    </p>
                    {request.requested_shared_context ? (
                      <p className="mt-1 text-xs text-foreground/48">
                        Shared org context requested.
                      </p>
                    ) : null}
                    {sharedContextGuardMessage ? (
                      <div className="mt-3 rounded-[18px] border border-yellow-500/30 bg-yellow-500/8 px-3 py-2 text-xs leading-5 text-yellow-200">
                        {sharedContextGuardMessage}
                      </div>
                    ) : null}
                    {request.decision_notes ? (
                      <p className="mt-3 text-sm leading-6 text-foreground/66">
                        {request.decision_notes}
                      </p>
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
                        disabled={pendingId === request.id || sharedContextGuardMessage !== null}
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
            );
          })}
        </div>
      )}
    </div>
  );
}
