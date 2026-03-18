"use client";

import { useState, useTransition } from "react";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import { CreateKeyDialog } from "./create-key-dialog";

interface AgentKey {
  id: string;
  agent_name: string;
  key_prefix: string;
  permissions: string[];
  created_at: string;
}

interface NewKeyReveal {
  id: string;
  api_key: string;
}

interface AgentKeysTableProps {
  initialKeys: AgentKey[];
}

export function AgentKeysTable({ initialKeys }: AgentKeysTableProps) {
  const [keys, setKeys] = useState<AgentKey[]>(initialKeys);
  const [newKey, setNewKey] = useState<NewKeyReveal | null>(null);
  const [, startDeleteTransition] = useTransition();
  const [deletingKeyId, setDeletingKeyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleCreated(data: AgentKey & { api_key: string }) {
    const { api_key, ...key } = data;
    setKeys((prev) => [...prev, key]);
    setNewKey({ id: key.id, api_key });
    setError(null);
  }

  function handleDismissKey() {
    setNewKey(null);
  }

  function handleDelete(keyId: string) {
    setError(null);
    setDeletingKeyId(keyId);
    startDeleteTransition(async () => {
      const res = await fetch(`/api/admin/agent-keys?id=${keyId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setKeys((prev) => prev.filter((k) => k.id !== keyId));
        if (newKey?.id === keyId) setNewKey(null);
      } else {
        const data = await res.json();
        setError(data.error ?? "Failed to delete key.");
      }
      setDeletingKeyId(null);
    });
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-[20px] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Revealed new key banner */}
      {newKey && (
        <div className="dashboard-rail space-y-3 border-yellow-500/30 bg-yellow-500/8 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-yellow-500">
                Copy this bearer token now — it will not be shown again.
              </p>
              <p className="text-sm text-foreground/68">
                Use it in the <span className="font-mono">Authorization: Bearer</span>{" "}
                header when a Ghostwriters agent calls your workspace APIs.
              </p>
              <p className="font-mono text-sm break-all">{newKey.api_key}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <CopyButton text={newKey.api_key} idleLabel="Copy Key" copiedLabel="Copied!" />
            <Button size="sm" variant="outline" onClick={handleDismissKey}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Header row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h2 className="premium-kicker text-[0.68rem]">
            {keys.length} {keys.length === 1 ? "key" : "keys"}
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-foreground/62">
            These keys authenticate internal Ghostwriters agents against your org. The
            token value is shown only once, while the stored prefix helps you identify
            which key is in use.
          </p>
        </div>
        <CreateKeyDialog onCreated={handleCreated} />
      </div>

      {/* Table */}
      {keys.length === 0 ? (
        <p className="dashboard-rail border-dashed py-10 text-center text-sm text-muted-foreground">
          No agent keys yet. Create one to let a Ghostwriters agent authenticate to
          this workspace.
        </p>
      ) : (
        <div className="dashboard-rail overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border/50 bg-background/30">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Agent</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Key Prefix</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Permissions</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {keys.map((key) => (
                <tr key={key.id} className="transition-colors hover:bg-background/28">
                  <td className="px-4 py-3 font-medium capitalize">{key.agent_name}</td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">
                    {key.key_prefix}••••••••
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {key.permissions.map((p) => (
                        <span
                          key={p}
                          className="rounded-full border border-border/55 bg-background/36 px-2 py-0.5 text-xs font-mono text-muted-foreground"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(key.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(key.id)}
                      disabled={deletingKeyId === key.id}
                      className="text-destructive hover:text-destructive"
                    >
                      {deletingKeyId === key.id ? "Deleting…" : "Delete"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
