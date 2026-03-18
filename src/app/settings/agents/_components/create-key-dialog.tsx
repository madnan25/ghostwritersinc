"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ModalDialog } from "@/components/ui/modal-dialog";

type AgentType = "scribe" | "strategist" | "inspector";

interface AgentKey {
  id: string;
  organization_id: string;
  user_id: string | null;
  agent_name: string;
  key_prefix: string;
  permissions: string[];
  allow_shared_context: boolean;
  commissioned_by: string | null;
  created_at: string;
}

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

interface CreateKeyDialogProps {
  organizations: OrganizationOption[];
  users: UserOption[];
  onCreated: (key: AgentKey & { api_key: string }) => void;
}

const AGENT_DESCRIPTIONS: Record<AgentType, string> = {
  scribe: "Drafting + editing — can read/write posts and comments.",
  strategist: "Planning + structure — can read posts, review comments, and update pillars.",
  inspector: "QA + review — can read posts/comments and write review decisions.",
};

export function CreateKeyDialog({
  organizations,
  users,
  onCreated,
}: CreateKeyDialogProps) {
  const [open, setOpen] = useState(false);
  const [agentType, setAgentType] = useState<AgentType>("scribe");
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? "");
  const [userId, setUserId] = useState("");
  const [allowSharedContext, setAllowSharedContext] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const scopedUsers = useMemo(
    () => users.filter((user) => user.organization_id === organizationId),
    [organizationId, users]
  );

  useEffect(() => {
    if (!scopedUsers.some((user) => user.id === userId)) {
      setUserId(scopedUsers[0]?.id ?? "");
    }
  }, [scopedUsers, userId]);

  function handleOpen() {
    setOpen(true);
    setError(null);
  }

  function handleClose() {
    setOpen(false);
    setError(null);
  }

  function handleSubmit() {
    if (!organizationId || !userId) {
      setError("Select both an organization and a user.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/agent-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_name: agentType,
          organization_id: organizationId,
          user_id: userId,
          allow_shared_context: allowSharedContext,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? "Failed to create agent key");
        return;
      }

      const data = await res.json();
      onCreated(data);
      setOpen(false);
    });
  }

  return (
    <>
      <Button size="sm" onClick={handleOpen}>
        Create Agent Key
      </Button>

      <ModalDialog open={open} onClose={handleClose} titleId="create-agent-key-title">
        <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
          <h2 id="create-agent-key-title" className="mb-4 text-lg font-semibold">Create Agent Key</h2>
          <p className="mb-4 text-sm leading-6 text-muted-foreground">
            Commission an internal bearer token for a Ghostwriters agent. Each key
            is assigned to one org, one user, and one agent type.
          </p>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Organization</label>
                <select
                  value={organizationId}
                  onChange={(e) => setOrganizationId(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                >
                  {organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Assigned User</label>
                <select
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                  disabled={scopedUsers.length === 0}
                >
                  {scopedUsers.length === 0 ? (
                    <option value="">No users in this organization</option>
                  ) : (
                    scopedUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </option>
                    ))
                  )}
                </select>
                <p className="text-xs text-muted-foreground">
                  The agent defaults to this user&apos;s posts, comments, and review
                  context.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Agent Type</label>
                <select
                  value={agentType}
                  onChange={(e) => setAgentType(e.target.value as AgentType)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                >
                  <option value="scribe">Scribe</option>
                  <option value="strategist">Strategist</option>
                  <option value="inspector">Inspector</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  {AGENT_DESCRIPTIONS[agentType]}
                </p>
                <p className="text-xs text-muted-foreground">
                  One key is allowed per org, user, and agent type.
                </p>
              </div>

              <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
                <input
                  type="checkbox"
                  checked={allowSharedContext}
                  onChange={(e) => setAllowSharedContext(e.target.checked)}
                  className="mt-0.5"
                />
                <span className="space-y-1">
                  <span className="block font-medium">Allow shared org context</span>
                  <span className="block text-xs text-muted-foreground">
                    This key can read broader org context only if the organization also
                    enables context sharing in settings.
                  </span>
                </span>
              </label>

              {error && (
                <p className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={handleClose} disabled={isPending}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSubmit} disabled={isPending}>
                {isPending ? "Creating…" : "Create Key"}
              </Button>
            </div>
        </div>
      </ModalDialog>
    </>
  );
}
