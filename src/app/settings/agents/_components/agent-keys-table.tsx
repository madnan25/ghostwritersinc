"use client";

import { useState, useTransition } from "react";
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
  const [copied, setCopied] = useState(false);
  const [, startDeleteTransition] = useTransition();
  const [deletingKeyId, setDeletingKeyId] = useState<string | null>(null);

  function handleCreated(data: AgentKey & { api_key: string }) {
    const { api_key, ...key } = data;
    setKeys((prev) => [...prev, key]);
    setNewKey({ id: key.id, api_key });
    setCopied(false);
  }

  function handleCopy() {
    if (!newKey) return;
    navigator.clipboard.writeText(newKey.api_key);
    setCopied(true);
  }

  function handleDismissKey() {
    setNewKey(null);
    setCopied(false);
  }

  function handleDelete(keyId: string) {
    setDeletingKeyId(keyId);
    startDeleteTransition(async () => {
      const res = await fetch(`/api/admin/agent-keys?id=${keyId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setKeys((prev) => prev.filter((k) => k.id !== keyId));
        if (newKey?.id === keyId) setNewKey(null);
      }
      setDeletingKeyId(null);
    });
  }

  return (
    <div className="space-y-6">
      {/* Revealed new key banner */}
      {newKey && (
        <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-4 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-yellow-500">
                Copy your API key now — it will not be shown again.
              </p>
              <p className="font-mono text-sm break-all">{newKey.api_key}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleCopy}>
              {copied ? "Copied!" : "Copy Key"}
            </Button>
            <Button size="sm" variant="outline" onClick={handleDismissKey}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Header row */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {keys.length} {keys.length === 1 ? "key" : "keys"}
        </h2>
        <CreateKeyDialog onCreated={handleCreated} />
      </div>

      {/* Table */}
      {keys.length === 0 ? (
        <p className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
          No agent keys yet. Create one to get started.
        </p>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Agent</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Key Prefix</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Permissions</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {keys.map((key) => (
                <tr key={key.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium capitalize">{key.agent_name}</td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">
                    {key.key_prefix}••••••••
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {key.permissions.map((p) => (
                        <span
                          key={p}
                          className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground"
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
