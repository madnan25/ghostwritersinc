"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ModalDialog } from "@/components/ui/modal-dialog";

type AgentType = "scribe" | "strategist" | "inspector";

interface AgentKey {
  id: string;
  agent_name: string;
  key_prefix: string;
  permissions: string[];
  created_at: string;
}

interface CreateKeyDialogProps {
  onCreated: (key: AgentKey & { api_key: string }) => void;
}

const AGENT_DESCRIPTIONS: Record<AgentType, string> = {
  scribe: "Drafting + editing — can read/write posts and comments.",
  strategist: "Planning + structure — can read posts, review comments, and update pillars.",
  inspector: "QA + review — can read posts/comments and write review decisions.",
};

export function CreateKeyDialog({ onCreated }: CreateKeyDialogProps) {
  const [open, setOpen] = useState(false);
  const [agentType, setAgentType] = useState<AgentType>("scribe");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpen() {
    setOpen(true);
    setError(null);
  }

  function handleClose() {
    setOpen(false);
    setError(null);
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/agent-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_name: agentType }),
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
            This creates an internal bearer token for a Ghostwriters agent to call your
            workspace APIs. It does not store or configure any external provider key.
          </p>

            <div className="space-y-4">
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
                  One key is allowed per agent type in each workspace.
                </p>
              </div>

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
