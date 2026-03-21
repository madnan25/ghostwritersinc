'use client'

import { useMemo, useState } from 'react'
import { FileText, GitCompare, Sparkles, Target, StickyNote, CalendarDays, Link2 } from 'lucide-react'
import type { BriefVersionWithContext } from '@/lib/types'
import { formatBriefVersionDocument, getBriefStatusLabel, getBriefVersionLabel } from '@/lib/brief-documents'
import { VersionSwitcher } from './version-switcher'
import { RevisionDiff } from './revision-diff'

interface BriefDocumentsPanelProps {
  briefRef: string | null
  versions: BriefVersionWithContext[]
  currentBriefVersionId?: string | null
  currentPostVersion: number
}

function formatVersionDate(isoDate: string): string {
  return new Date(isoDate).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function BriefDocumentsPanel({
  briefRef,
  versions,
  currentBriefVersionId,
  currentPostVersion,
}: BriefDocumentsPanelProps) {
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null)
  const [diffMode, setDiffMode] = useState(false)

  const currentVersionRecord = useMemo(
    () => versions.find((version) => version.id === currentBriefVersionId) ?? versions[0] ?? null,
    [versions, currentBriefVersionId],
  )
  const selectedRecord =
    selectedVersion != null
      ? versions.find((version) => version.version === selectedVersion) ?? currentVersionRecord
      : currentVersionRecord
  const defaultDiffBase =
    currentVersionRecord ? versions.find((version) => version.id !== currentVersionRecord.id) ?? null : null
  const diffBaseRecord =
    selectedVersion != null && selectedRecord?.id !== currentVersionRecord?.id
      ? selectedRecord
      : defaultDiffBase
  const canShowDiff = Boolean(currentVersionRecord && diffBaseRecord)

  return (
    <div className="dashboard-frame overflow-hidden p-0">
      <div className="border-b border-border/60 bg-gradient-to-br from-primary/[0.08] via-transparent to-transparent px-5 py-4 sm:px-6">
        <div className="flex items-center gap-2 text-primary/80">
          <Sparkles className="size-4 shrink-0" />
          <span className="text-sm font-medium uppercase tracking-[0.24em]">Editorial Process</span>
        </div>
        <h2 className="mt-2 text-lg font-semibold tracking-tight">Brief Drafts</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Review the strategist brief files that shaped this draft and compare revisions side by side.
        </p>
      </div>

      {versions.length === 0 ? (
        <div className="px-5 py-5 sm:px-6">
          <div className="rounded-[20px] border border-dashed border-border/70 bg-background/40 p-5">
            <p className="text-sm text-foreground">
              {briefRef
                ? 'This post has a legacy brief reference, but no full strategist brief draft was stored for it.'
                : 'No strategist brief draft has been recorded for this post yet.'}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              New briefs and revisions will appear here automatically as versioned documents with diffs and post-version links.
            </p>
            {briefRef ? (
              <div className="mt-4 rounded-xl border border-border/50 bg-background/50 p-4">
                <p className="text-[0.72rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Legacy reference
                </p>
                <p className="mt-2 text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap break-words">
                  {briefRef}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="px-5 py-5 sm:px-6">
          {currentVersionRecord ? (
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <VersionSwitcher
                revisions={versions}
                currentVersion={currentVersionRecord.version}
                selectedVersion={selectedVersion}
                onSelect={(version) => {
                  setSelectedVersion(version)
                  setDiffMode(false)
                }}
              />
              {canShowDiff ? (
                <button
                  onClick={() => setDiffMode((value) => !value)}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    diffMode
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-border/70 bg-card text-muted-foreground hover:border-border hover:text-foreground'
                  }`}
                >
                  <GitCompare className="size-3.5" />
                  {diffMode ? 'Hide diff' : 'View diff'}
                </button>
              ) : null}
            </div>
          ) : null}

          {diffMode && currentVersionRecord && diffBaseRecord ? (
            <RevisionDiff
              oldContent={formatBriefVersionDocument(diffBaseRecord)}
              newContent={formatBriefVersionDocument(currentVersionRecord)}
              oldLabel={getBriefVersionLabel(diffBaseRecord.version)}
              newLabel={`${getBriefVersionLabel(currentVersionRecord.version)} (current)`}
            />
          ) : selectedRecord ? (
            <div className="rounded-[24px] border border-border/70 bg-card/70 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/50 pb-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[0.68rem] font-medium uppercase tracking-[0.16em] text-primary">
                      {getBriefVersionLabel(selectedRecord.version)}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-border bg-background/80 px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">
                      {getBriefStatusLabel(selectedRecord.status)}
                    </span>
                    {selectedRecord.id === currentBriefVersionId ? (
                      <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.16em] text-emerald-300">
                        Used for post v{currentPostVersion}
                      </span>
                    ) : null}
                    {selectedRecord.linked_post_versions.length > 0 ? (
                      <span className="inline-flex items-center rounded-full border border-border/70 bg-background/80 px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">
                        Linked to post v{selectedRecord.linked_post_versions.join(', v')}
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-3 text-base font-semibold leading-tight">{selectedRecord.angle}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Created {formatVersionDate(selectedRecord.created_at)}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3 text-right">
                  <div className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">Assigned to</div>
                  <div className="mt-1 text-sm font-medium">
                    {selectedRecord.assigned_agent_name ?? 'Unassigned'}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-4">
                <section className="rounded-2xl border border-border/60 bg-background/40 p-4">
                  <div className="flex items-center gap-2 text-[0.72rem] font-medium uppercase tracking-[0.18em] text-sky-300">
                    <Target className="size-4" />
                    Angle
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-foreground">{selectedRecord.angle}</p>
                </section>

                <section className="rounded-2xl border border-border/60 bg-background/40 p-4">
                  <div className="flex items-center gap-2 text-[0.72rem] font-medium uppercase tracking-[0.18em] text-amber-300">
                    <StickyNote className="size-4" />
                    Strategist Notes
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {selectedRecord.voice_notes?.trim() || 'No strategist notes added for this brief draft.'}
                  </p>
                </section>

                <div className="grid gap-4 lg:grid-cols-2">
                  <section className="rounded-2xl border border-border/60 bg-background/40 p-4">
                    <div className="flex items-center gap-2 text-[0.72rem] font-medium uppercase tracking-[0.18em] text-primary/80">
                      <CalendarDays className="size-4" />
                      Publish Target
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {selectedRecord.publish_at
                        ? new Date(selectedRecord.publish_at).toLocaleString()
                        : 'No publish target set'}
                    </p>
                  </section>

                  <section className="rounded-2xl border border-border/60 bg-background/40 p-4">
                    <div className="flex items-center gap-2 text-[0.72rem] font-medium uppercase tracking-[0.18em] text-primary/80">
                      <FileText className="size-4" />
                      Revision Request
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                      {selectedRecord.revision_notes?.trim() || 'No revision request attached to this draft.'}
                    </p>
                  </section>
                </div>

                <section className="rounded-2xl border border-border/60 bg-background/40 p-4">
                  <div className="flex items-center gap-2 text-[0.72rem] font-medium uppercase tracking-[0.18em] text-primary/80">
                    <Link2 className="size-4" />
                    Research Inputs
                  </div>
                  {selectedRecord.research_items.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedRecord.research_items.map((item) => (
                        <span
                          key={item.id}
                          className="inline-flex rounded-full border border-border bg-background/80 px-3 py-1 text-xs text-muted-foreground"
                        >
                          {item.title}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      No research items were attached to this brief draft.
                    </p>
                  )}
                </section>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
