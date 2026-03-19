"use client"

import { useState, useEffect, useTransition } from "react"
import { AGENT_TEAM_PRESETS } from "@/lib/agent-team-presets"
import { getSharedContextGuardMessage } from "@/lib/agent-context-sharing"
import { Button } from "@/components/ui/button"

interface OrgMember {
  id: string
  name: string | null
  email: string | null
}

interface AgentHiringRequest {
  id: string
  requested_for_user_id: string
  preset_key: string
  requested_shared_context: boolean
  status: "pending" | "approved" | "denied" | "fulfilled"
  decision_notes: string | null
  reviewed_at: string | null
  created_at: string
}

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "text-yellow-300 bg-yellow-500/10 border-yellow-500/20" },
  approved: { label: "Approved", color: "text-green-400 bg-emerald-500/10 border-emerald-500/20" },
  denied: { label: "Denied", color: "text-destructive bg-destructive/10 border-destructive/20" },
  fulfilled: { label: "Fulfilled", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
}

export function HiringRequestSection({
  organizationContextSharingEnabled,
}: {
  organizationContextSharingEnabled: boolean
}) {
  const [members, setMembers] = useState<OrgMember[]>([])
  const [requests, setRequests] = useState<AgentHiringRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState("")
  const [presetKey, setPresetKey] = useState(AGENT_TEAM_PRESETS[0]?.key ?? "")
  const [requestSharedContext, setRequestSharedContext] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const sharedContextGuardMessage = getSharedContextGuardMessage({
    allowSharedContext: requestSharedContext,
    organizationContextSharingEnabled,
  })

  useEffect(() => {
    Promise.all([
      fetch("/api/org-admin/members").then((r) => r.json()),
      fetch("/api/org-admin/agent-hiring-requests").then((r) => r.json()),
    ]).then(([membersData, requestsData]) => {
      const membersList: OrgMember[] = Array.isArray(membersData) ? membersData : []
      setMembers(membersList)
      if (membersList.length > 0) setUserId(membersList[0].id)
      setRequests(Array.isArray(requestsData) ? requestsData : [])
      setLoading(false)
    }).catch(() => {
      setError("Failed to load data.")
      setLoading(false)
    })
  }, [])

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    startTransition(async () => {
      const response = await fetch("/api/org-admin/agent-hiring-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requested_for_user_id: userId,
          preset_key: presetKey,
          requested_shared_context: requestSharedContext,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error ?? "Failed to submit hiring request.")
        return
      }
      setRequests((prev) => [data, ...prev])
      setRequestSharedContext(false)
    })
  }

  return (
    <div className="mt-10">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Request Agent Team</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Submit a request to provision a preset agent team for a user in your organisation.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              disabled={loading || members.length === 0}
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-ring/50 disabled:opacity-50"
            >
              {loading ? (
                <option>Loading members…</option>
              ) : members.length === 0 ? (
                <option>No members found</option>
              ) : (
                members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name ?? member.email ?? member.id}
                  </option>
                ))
              )}
            </select>
            <select
              value={presetKey}
              onChange={(e) => setPresetKey(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-ring/50"
            >
              {AGENT_TEAM_PRESETS.map((preset) => (
                <option key={preset.key} value={preset.key}>
                  {preset.label} — {preset.description}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-start gap-3 rounded-[20px] border border-border/60 bg-card/52 p-4 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={requestSharedContext}
              onChange={(e) => setRequestSharedContext(e.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="block font-medium">Enable shared org context</span>
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
            disabled={isPending || loading || !userId || sharedContextGuardMessage !== null}
          >
            {isPending ? "Submitting…" : "Submit Hiring Request"}
          </Button>
        </form>
      </div>

      <div className="mt-6 space-y-2">
        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading requests…</p>
        ) : requests.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
            No hiring requests yet.
          </p>
        ) : (
          requests.map((request) => {
            const preset = AGENT_TEAM_PRESETS.find((p) => p.key === request.preset_key)
            const badge = STATUS_BADGES[request.status] ?? {
              label: request.status,
              color: "text-muted-foreground bg-muted border-border",
            }
            const member = members.find((m) => m.id === request.requested_for_user_id)
            return (
              <div
                key={request.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">
                      {preset?.label ?? request.preset_key}
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[0.68rem] uppercase tracking-[0.18em] ${badge.color}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    For: {member?.name ?? member?.email ?? request.requested_for_user_id}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {new Date(request.created_at).toLocaleString()}
                    {request.requested_shared_context ? " · shared context" : ""}
                  </p>
                </div>
                {request.reviewed_at ? (
                  <p className="text-xs text-muted-foreground">
                    Reviewed {new Date(request.reviewed_at).toLocaleString()}
                  </p>
                ) : null}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
