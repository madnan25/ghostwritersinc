"use client";

import { useMemo, useState, useTransition } from "react";
import { getSharedContextGuardMessage } from "@/lib/agent-context-sharing";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import { CommissionAgentDialog } from "./commission-agent-dialog";

interface OrganizationOption {
  id: string;
  name: string;
}

interface UserOption {
  id: string;
  organization_id: string;
  name: string;
  email: string;
}

interface CommissionedAgent {
  id: string;
  organization_id: string;
  user_id: string;
  name: string;
  slug: string;
  provider: string;
  provider_agent_ref: string | null;
  agent_type: string;
  job_title: string | null;
  status: "active" | "inactive" | "revoked";
  allow_shared_context: boolean;
  created_at: string;
  last_used_at: string | null;
  last_used_by_route: string | null;
  permissions: string[];
  keys: Array<{ id: string; key_prefix: string; created_at: string }>;
}

interface NewKeyReveal {
  agentId: string;
  value: string;
}

export function CommissionedAgentsConsole({
  initialAgents,
  organizations,
  users,
  organizationSharingById,
}: {
  initialAgents: CommissionedAgent[];
  organizations: OrganizationOption[];
  users: UserOption[];
  organizationSharingById: Record<string, boolean>;
}) {
  const [agents, setAgents] = useState(initialAgents);
  const [newKey, setNewKey] = useState<NewKeyReveal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingKeyAction, setPendingKeyAction] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const organizationMap = useMemo(
    () => new Map(organizations.map((organization) => [organization.id, organization.name])),
    [organizations]
  );
  const userMap = useMemo(
    () =>
      new Map(
        users.map((user) => [
          user.id,
          { name: user.name, email: user.email, organization_id: user.organization_id },
        ])
      ),
    [users]
  );

  function handleCreated(agent: CommissionedAgent, apiKey: string) {
    setAgents((prev) => [agent, ...prev]);
    setNewKey({ agentId: agent.id, value: apiKey });
    setError(null);
  }

  function handleIssueKey(agentId: string) {
    setError(null);
    setPendingKeyAction(agentId);
    startTransition(async () => {
      const response = await fetch(`/api/admin/agents/${agentId}/keys`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Failed to issue agent key.");
        setPendingKeyAction(null);
        return;
      }

      setAgents((prev) =>
        prev.map((agent) =>
          agent.id === agentId
            ? {
                ...agent,
                keys: [
                  ...agent.keys,
                  {
                    id: data.id,
                    key_prefix: data.key_prefix,
                    created_at: data.created_at,
                  },
                ],
              }
            : agent
        )
      );
      setNewKey({ agentId, value: data.api_key });
      setPendingKeyAction(null);
    });
  }

  function handleDeleteKey(agentId: string, keyId: string) {
    setError(null);
    setPendingKeyAction(keyId);
    startTransition(async () => {
      const response = await fetch(`/api/admin/agent-keys?id=${keyId}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Failed to delete key.");
        setPendingKeyAction(null);
        return;
      }

      setAgents((prev) =>
        prev.map((agent) =>
          agent.id === agentId
            ? {
                ...agent,
                keys: agent.keys.filter((key) => key.id !== keyId),
              }
            : agent
        )
      );
      if (newKey?.agentId === agentId) {
        setNewKey(null);
      }
      setPendingKeyAction(null);
    });
  }

  function handleToggleStatus(agent: CommissionedAgent) {
    const nextStatus = agent.status === "active" ? "inactive" : "active";
    setError(null);
    setPendingStatusId(agent.id);
    startTransition(async () => {
      const response = await fetch(`/api/admin/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Failed to update agent status.");
        setPendingStatusId(null);
        return;
      }

      setAgents((prev) =>
        prev.map((entry) =>
          entry.id === agent.id
            ? { ...entry, status: nextStatus }
            : entry
        )
      );
      setPendingStatusId(null);
    });
  }

  function handleDeleteAgent(agentId: string) {
    setError(null);
    setPendingDeleteId(agentId);
    startTransition(async () => {
      const response = await fetch(`/api/admin/agents/${agentId}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Failed to delete commissioned agent.");
        setPendingDeleteId(null);
        return;
      }

      setAgents((prev) => prev.filter((agent) => agent.id !== agentId));
      if (newKey?.agentId === agentId) {
        setNewKey(null);
      }
      setPendingDeleteId(null);
    });
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-[20px] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {newKey ? (
        <div className="dashboard-rail space-y-3 border-yellow-500/30 bg-yellow-500/8 p-4">
          <p className="text-sm font-semibold text-yellow-500">
            Copy this bearer token now — it will not be shown again.
          </p>
          <p className="font-mono text-sm break-all">{newKey.value}</p>
          <div className="flex gap-2">
            <CopyButton text={newKey.value} idleLabel="Copy Key" copiedLabel="Copied!" />
            <Button size="sm" variant="outline" onClick={() => setNewKey(null)}>
              Dismiss
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h2 className="premium-kicker text-[0.68rem]">
            {agents.length} {agents.length === 1 ? "commissioned agent" : "commissioned agents"}
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-foreground/62">
            Attach agents to one org and one user, choose their provider, grant explicit
            permissions, and issue additional credentials when needed.
          </p>
        </div>
        <CommissionAgentDialog
          organizations={organizations}
          users={users}
          organizationSharingById={organizationSharingById}
          onCreated={handleCreated}
        />
      </div>

      {agents.length === 0 ? (
        <p className="dashboard-rail border-dashed py-10 text-center text-sm text-muted-foreground">
          No commissioned agents yet. Start by attaching one to an org and user.
        </p>
      ) : (
        <div className="grid gap-4">
          {agents.map((agent) => {
            const assignedUser = userMap.get(agent.user_id);
            const orgName = organizationMap.get(agent.organization_id) ?? agent.organization_id;
            const statusTone =
              agent.status === "active"
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                : agent.status === "inactive"
                  ? "border-yellow-500/20 bg-yellow-500/10 text-yellow-300"
                  : "border-destructive/20 bg-destructive/10 text-destructive";
            const sharedContextGuardMessage = getSharedContextGuardMessage({
              allowSharedContext: agent.allow_shared_context,
              organizationContextSharingEnabled:
                organizationSharingById[agent.organization_id] === true,
            });

            return (
              <div key={agent.id} className="editorial-card p-5 sm:p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-semibold tracking-[-0.03em] text-foreground">
                        {agent.name}
                        {agent.job_title ? (
                          <span className="font-normal text-foreground/58"> · {agent.job_title}</span>
                        ) : null}
                      </p>
                      <span className="rounded-full border border-border/55 bg-background/36 px-2.5 py-1 text-[0.7rem] uppercase tracking-[0.18em] text-foreground/58">
                        {agent.provider}
                      </span>
                      <span className={`rounded-full border px-2.5 py-1 text-[0.7rem] uppercase tracking-[0.18em] ${statusTone}`}>
                        {agent.status}
                      </span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <p className="editorial-meta">Assigned User</p>
                        <p className="mt-1 text-sm text-foreground/82">
                          {assignedUser?.name ?? "Unknown user"}
                        </p>
                        <p className="text-xs text-foreground/52">
                          {assignedUser?.email ?? agent.user_id}
                        </p>
                      </div>
                      <div>
                        <p className="editorial-meta">Organization</p>
                        <p className="mt-1 text-sm text-foreground/82">{orgName}</p>
                      </div>
                      <div>
                        <p className="editorial-meta">Scope</p>
                        <p className="mt-1 text-sm text-foreground/82">
                          {agent.allow_shared_context ? "Shared org eligible" : "User only"}
                        </p>
                      </div>
                    </div>

                    {agent.provider_agent_ref ? (
                      <p className="text-xs text-foreground/58">
                        Provider ref: <span className="font-mono">{agent.provider_agent_ref}</span>
                      </p>
                    ) : null}

                    {sharedContextGuardMessage ? (
                      <div className="rounded-[18px] border border-yellow-500/30 bg-yellow-500/8 px-3 py-2 text-xs leading-5 text-yellow-200">
                        {sharedContextGuardMessage}
                      </div>
                    ) : null}

                    <div>
                      <p className="editorial-meta">Permissions</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {agent.permissions.map((permission) => (
                          <span
                            key={permission}
                            className="rounded-full border border-border/55 bg-background/36 px-2 py-0.5 text-xs font-mono text-foreground/64"
                          >
                            {permission}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:max-w-[15rem] lg:justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleIssueKey(agent.id)}
                      disabled={pendingKeyAction === agent.id}
                    >
                      {pendingKeyAction === agent.id ? "Issuing…" : "Issue Key"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggleStatus(agent)}
                      disabled={pendingStatusId === agent.id}
                    >
                      {pendingStatusId === agent.id
                        ? "Saving…"
                        : agent.status === "active"
                          ? "Deactivate"
                          : "Activate"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDeleteAgent(agent.id)}
                      disabled={pendingDeleteId === agent.id}
                    >
                      {pendingDeleteId === agent.id ? "Deleting…" : "Delete"}
                    </Button>
                  </div>
                </div>

                <div className="editorial-rule my-5" />

                <div className="grid gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="editorial-meta">Credentials</p>
                    <p className="text-xs text-foreground/48">
                      {agent.last_used_at
                        ? `Last used ${new Date(agent.last_used_at).toLocaleString()}`
                        : "No runtime activity yet"}
                    </p>
                  </div>
                  {agent.keys.length === 0 ? (
                    <p className="text-sm text-foreground/54">No active keys yet.</p>
                  ) : (
                    <div className="grid gap-2">
                      {agent.keys.map((key) => (
                        <div
                          key={key.id}
                          className="dashboard-rail flex items-center justify-between gap-3 px-4 py-3"
                        >
                          <div>
                            <p className="font-mono text-sm text-foreground/82">
                              {key.key_prefix}••••••••
                            </p>
                            <p className="text-xs text-foreground/48">
                              Issued {new Date(key.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDeleteKey(agent.id, key.id)}
                            disabled={pendingKeyAction === key.id}
                          >
                            {pendingKeyAction === key.id ? "Removing…" : "Delete"}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
