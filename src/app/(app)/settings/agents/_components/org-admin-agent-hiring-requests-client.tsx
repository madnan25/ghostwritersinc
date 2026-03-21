"use client";

import { useState, useTransition } from "react";
import { getSharedContextGuardMessage } from "@/lib/agent-context-sharing";
import { AGENT_TEAM_PRESETS } from "@/lib/agent-team-presets";
import { Button } from "@/components/ui/button";

interface UserOption {
  id: string;
  name: string;
  email: string;
}

interface AgentHiringRequestRecord {
  id: string;
  requested_for_user_id: string;
  requested_for_user_name?: string | null;
  preset_key: string;
  requested_shared_context: boolean;
  status: "pending" | "approved" | "denied";
  decision_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
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

export function OrgAdminAgentHiringRequestsClient({
  users,
  initialRequests,
  organizationContextSharingEnabled,
}: {
  users: UserOption[];
  initialRequests: AgentHiringRequestRecord[];
  organizationContextSharingEnabled: boolean;
}) {
  const [requests, setRequests] = useState(initialRequests);
  const [userId, setUserId] = useState(users[0]?.id ?? "");
  const [presetKey, setPresetKey] = useState(AGENT_TEAM_PRESETS[0]?.key ?? "");
  const [requestSharedContext, setRequestSharedContext] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sharedContextGuardMessage = getSharedContextGuardMessage({
    allowSharedContext: requestSharedContext,
    organizationContextSharingEnabled,
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const response = await fetch("/api/org-admin/agent-hiring-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requested_for_user_id: userId,
          preset_key: presetKey,
          requested_shared_context: requestSharedContext,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Failed to submit hiring request.");
        return;
      }

      setRequests((prev) => [data, ...prev]);
      setRequestSharedContext(false);
    });
  }

  return (
    <div className="space-y-6">
      <div className="dashboard-rail p-5">
        <div className="space-y-2">
          <p className="premium-kicker text-[0.68rem]">Request Agent Team</p>
          <h2 className="text-xl font-semibold tracking-[-0.03em] text-foreground">
            Ask Ghostwriters to provision a preset team
          </h2>
          <p className="max-w-2xl text-sm leading-7 text-foreground/66">
            Choose the user, select the preset team, and submit the request for platform
            review.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <select
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-ring/50"
            >
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.email})
                </option>
              ))}
            </select>
            <select
              value={presetKey}
              onChange={(event) => setPresetKey(event.target.value)}
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-ring/50"
            >
              {AGENT_TEAM_PRESETS.map((preset) => (
                <option key={preset.key} value={preset.key}>
                  {preset.label}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-start gap-3 rounded-[20px] border border-border/60 bg-card/52 p-4 text-sm">
            <input
              type="checkbox"
              checked={requestSharedContext}
              onChange={(event) => setRequestSharedContext(event.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="block font-medium">Request shared org context</span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                This requires Agent context sharing to be enabled in your org settings.
              </span>
              {sharedContextGuardMessage ? (
                <span className="mt-2 block text-xs leading-5 text-yellow-300">
                  {sharedContextGuardMessage}
                </span>
              ) : null}
            </span>
          </label>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Button
            type="submit"
            disabled={isPending || !userId || sharedContextGuardMessage !== null}
          >
            {isPending ? "Submitting…" : "Submit Hiring Request"}
          </Button>
        </form>
      </div>

      <div className="space-y-2">
        {requests.length === 0 ? (
          <p className="dashboard-rail py-10 text-center text-sm text-muted-foreground">
            No hiring requests yet.
          </p>
        ) : (
          requests.map((request) => {
            const preset = AGENT_TEAM_PRESETS.find((entry) => entry.key === request.preset_key);
            return (
              <div key={request.id} className="editorial-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground">
                        {preset?.label ?? request.preset_key}
                      </p>
                      <RequestStatusBadge status={request.status} />
                    </div>
                    <p className="mt-1 text-xs text-foreground/54">
                      User: {request.requested_for_user_name ?? request.requested_for_user_id}
                    </p>
                    <p className="mt-1 text-xs text-foreground/48">
                      Submitted {new Date(request.created_at).toLocaleString()}
                      {request.requested_shared_context ? " · shared context requested" : ""}
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
            );
          })
        )}
      </div>
    </div>
  );
}
