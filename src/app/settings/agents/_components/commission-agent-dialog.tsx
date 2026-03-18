"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  AGENT_PERMISSION_GROUPS,
  AGENT_PERMISSION_PRESETS,
  AGENT_PROVIDER_OPTIONS,
  AGENT_TYPE_OPTIONS,
} from "@/lib/agent-permissions";
import { Button } from "@/components/ui/button";
import { ModalDialog } from "@/components/ui/modal-dialog";

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
  status: "active" | "inactive" | "revoked";
  allow_shared_context: boolean;
  created_at: string;
  last_used_at: string | null;
  last_used_by_route: string | null;
  permissions: string[];
  keys: Array<{ id: string; key_prefix: string; created_at: string }>;
}

interface CommissionAgentDialogProps {
  organizations: OrganizationOption[];
  users: UserOption[];
  onCreated: (agent: CommissionedAgent, apiKey: string) => void;
}

export function CommissionAgentDialog({
  organizations,
  users,
  onCreated,
}: CommissionAgentDialogProps) {
  const [open, setOpen] = useState(false);
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? "");
  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [agentType, setAgentType] = useState("scribe");
  const [provider, setProvider] = useState("paperclip");
  const [providerAgentRef, setProviderAgentRef] = useState("");
  const [allowSharedContext, setAllowSharedContext] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState("writer");
  const [permissions, setPermissions] = useState<string[]>(
    AGENT_PERMISSION_PRESETS.writer
  );
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

  function handlePresetChange(preset: string) {
    setSelectedPreset(preset);
    setPermissions(AGENT_PERMISSION_PRESETS[preset] ?? []);
  }

  function togglePermission(permission: string) {
    setSelectedPreset("custom");
    setPermissions((prev) =>
      prev.includes(permission)
        ? prev.filter((entry) => entry !== permission)
        : [...prev, permission]
    );
  }

  function handleSubmit() {
    if (!organizationId || !userId || !name.trim()) {
      setError("Select an organization, an assigned user, and a display name.");
      return;
    }

    if (permissions.length === 0) {
      setError("Choose at least one permission.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/admin/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_id: organizationId,
          user_id: userId,
          name,
          agent_type: agentType,
          provider,
          provider_agent_ref: providerAgentRef || null,
          allow_shared_context: allowSharedContext,
          permissions,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Failed to commission agent.");
        return;
      }

      onCreated(
        {
          id: data.id,
          organization_id: data.organization_id,
          user_id: data.user_id,
          name: data.name,
          slug: data.slug,
          provider: data.provider,
          provider_agent_ref: data.provider_agent_ref,
          agent_type: data.agent_type,
          status: data.status,
          allow_shared_context: data.allow_shared_context,
          created_at: data.created_at,
          last_used_at: data.last_used_at,
          last_used_by_route: data.last_used_by_route,
          permissions: data.permissions ?? [],
          keys: (data.agent_keys ?? []).map(
            (key: { id: string; key_prefix: string; created_at: string }) => key
          ),
        },
        data.revealed_key
      );
      setOpen(false);
    });
  }

  return (
    <>
      <Button size="sm" onClick={handleOpen}>
        Commission Agent
      </Button>

      <ModalDialog open={open} onClose={handleClose} titleId="commission-agent-title">
        <div className="w-full max-w-2xl rounded-[28px] border border-border/60 bg-background/95 p-6 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.55)]">
          <h2 id="commission-agent-title" className="text-xl font-semibold tracking-[-0.03em]">
            Commission Agent
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Attach a commissioned agent to one organization and one user, choose the
            provider, then grant only the capabilities it needs.
          </p>

          <div className="mt-6 grid gap-6">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Display Name</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Brand Writer"
                  className="w-full rounded-[18px] border border-border/70 bg-card/70 px-4 py-3 text-sm"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-sm font-medium">Agent Type</span>
                <select
                  value={agentType}
                  onChange={(event) => setAgentType(event.target.value)}
                  className="w-full rounded-[18px] border border-border/70 bg-card/70 px-4 py-3 text-sm"
                >
                  {AGENT_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Provider</span>
                <select
                  value={provider}
                  onChange={(event) => setProvider(event.target.value)}
                  className="w-full rounded-[18px] border border-border/70 bg-card/70 px-4 py-3 text-sm"
                >
                  {AGENT_PROVIDER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-sm font-medium">Provider Ref</span>
                <input
                  value={providerAgentRef}
                  onChange={(event) => setProviderAgentRef(event.target.value)}
                  placeholder="paperclip:brand-writer-01"
                  className="w-full rounded-[18px] border border-border/70 bg-card/70 px-4 py-3 text-sm"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Organization</span>
                <select
                  value={organizationId}
                  onChange={(event) => setOrganizationId(event.target.value)}
                  className="w-full rounded-[18px] border border-border/70 bg-card/70 px-4 py-3 text-sm"
                >
                  {organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-sm font-medium">Assigned User</span>
                <select
                  value={userId}
                  onChange={(event) => setUserId(event.target.value)}
                  disabled={scopedUsers.length === 0}
                  className="w-full rounded-[18px] border border-border/70 bg-card/70 px-4 py-3 text-sm disabled:opacity-50"
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
              </label>
            </div>

            <label className="flex items-start gap-3 rounded-[20px] border border-border/60 bg-card/52 p-4 text-sm">
              <input
                type="checkbox"
                checked={allowSharedContext}
                onChange={(event) => setAllowSharedContext(event.target.checked)}
                className="mt-1"
              />
              <span>
                <span className="block font-medium">Allow shared org context</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  When enabled, this agent can read broader org context if the
                  organization also enables context sharing in Settings.
                </span>
              </span>
            </label>

            <div className="rounded-[24px] border border-border/60 bg-card/52 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Permission Preset</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Start from a preset, then fine-tune below.
                  </p>
                </div>
                <select
                  value={selectedPreset}
                  onChange={(event) => handlePresetChange(event.target.value)}
                  className="rounded-full border border-border/70 bg-background/55 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em]"
                >
                  <option value="writer">Writer</option>
                  <option value="reviewer">Reviewer</option>
                  <option value="strategist">Strategist</option>
                  <option value="researcher">Researcher</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {AGENT_PERMISSION_GROUPS.map((group) => (
                  <div
                    key={group.key}
                    className="rounded-[20px] border border-border/60 bg-background/36 p-4"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/76">
                      {group.label}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {group.permissions.map((permission) => {
                        const selected = permissions.includes(permission);
                        return (
                          <button
                            key={permission}
                            type="button"
                            onClick={() => togglePermission(permission)}
                            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                              selected
                                ? "border-primary/30 bg-primary/12 text-primary"
                                : "border-border/60 bg-background/32 text-foreground/68 hover:border-primary/18 hover:text-foreground"
                            }`}
                          >
                            {permission}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {error ? (
              <div className="rounded-[18px] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={handleClose} disabled={isPending}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={isPending}>
              {isPending ? "Commissioning…" : "Commission Agent"}
            </Button>
          </div>
        </div>
      </ModalDialog>
    </>
  );
}
