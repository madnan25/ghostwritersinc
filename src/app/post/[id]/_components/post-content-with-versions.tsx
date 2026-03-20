'use client'

import { useState } from 'react'
import { GitCompare, Flag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { PostComment, PostRevision } from '@/lib/types'
import { VersionSwitcher } from './version-switcher'
import { CommentablePostContent } from './commentable-post-content'
import { RevisionDiff } from './revision-diff'
import { AnnotatablePostContent, type FlaggedAnnotation } from './annotatable-post-content'
import { RevisionSidebar } from './revision-sidebar'

const MAX_TARGETED_REVISIONS = 3

interface Props {
  postId: string
  content: string
  currentVersion: number
  comments: PostComment[]
  revisions: PostRevision[]
}

export function PostContentWithVersions({ postId, content, currentVersion, comments, revisions }: Props) {
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null)
  const [diffMode, setDiffMode] = useState(false)
  const [revisionMode, setRevisionMode] = useState(false)
  const [annotations, setAnnotations] = useState<FlaggedAnnotation[]>([])

  const versionContent =
    selectedVersion != null
      ? revisions.find((r) => r.version === selectedVersion)?.content
      : undefined

  // Determine what to diff: selected version vs current, or last revision vs current
  const canShowDiff = revisions.length > 0
  const diffOldContent = selectedVersion != null
    ? versionContent ?? ''
    : (revisions[0]?.content ?? '') // most recent revision (ordered desc)
  const diffOldLabel = selectedVersion != null
    ? `v${selectedVersion}`
    : `v${revisions[0]?.version ?? ''}`
  const diffNewLabel = `v${currentVersion} (current)`

  function handleToggleRevisionMode() {
    if (revisionMode) {
      setRevisionMode(false)
      setAnnotations([])
    } else {
      setRevisionMode(true)
      setDiffMode(false)
      setSelectedVersion(null)
    }
  }

  function handleToggleDiff() {
    setDiffMode((d) => !d)
    if (revisionMode) {
      setRevisionMode(false)
      setAnnotations([])
    }
  }

  return (
    <>
      {(revisions.length > 0 || true) && (
        <div className="mb-5 rounded-[20px] border border-border/60 bg-background/40 p-2 shadow-[0_14px_36px_-30px_rgba(0,0,0,0.5)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {revisions.length > 0 && (
                <VersionSwitcher
                  revisions={revisions}
                  currentVersion={currentVersion}
                  selectedVersion={selectedVersion}
                  onSelect={(v) => { setSelectedVersion(v); setDiffMode(false); setRevisionMode(false); setAnnotations([]) }}
                />
              )}
              {canShowDiff && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleToggleDiff}
                  className={`border-border/70 bg-background/70 shadow-none ${
                    diffMode
                      ? 'border-primary/35 bg-primary/10 text-primary hover:bg-primary/14'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <GitCompare className="size-3.5" />
                  {diffMode ? 'Hide diff' : 'View diff'}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleToggleRevisionMode}
                className={`border-border/70 bg-background/70 shadow-none ${
                  revisionMode
                    ? 'border-amber-400/40 bg-amber-400/10 text-amber-300 hover:bg-amber-400/14'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Flag className="size-3.5" />
                {revisionMode ? 'Cancel revision' : 'Request revision'}
              </Button>
            </div>
            <div className="px-2 text-[0.72rem] uppercase tracking-[0.16em] text-muted-foreground/80">
              {selectedVersion != null ? `Viewing v${selectedVersion}` : `Current v${currentVersion}`}
            </div>
          </div>
        </div>
      )}

      {diffMode ? (
        <RevisionDiff
          oldContent={diffOldContent}
          newContent={content}
          oldLabel={diffOldLabel}
          newLabel={diffNewLabel}
        />
      ) : revisionMode ? (
        <>
          <AnnotatablePostContent
            content={content}
            annotations={annotations}
            maxAnnotations={MAX_TARGETED_REVISIONS}
            onAdd={(ann) => setAnnotations((prev) => [...prev, ann])}
            onRemove={(id) => setAnnotations((prev) => prev.filter((a) => a.id !== id))}
          />
          <div className="mt-5">
            <RevisionSidebar
              postId={postId}
              annotations={annotations}
              maxAnnotations={MAX_TARGETED_REVISIONS}
              onRemove={(id) => setAnnotations((prev) => prev.filter((a) => a.id !== id))}
              onReset={() => setAnnotations([])}
            />
          </div>
        </>
      ) : (
        <CommentablePostContent
          postId={postId}
          content={content}
          comments={comments}
          currentVersion={currentVersion}
          viewingVersion={selectedVersion}
          versionContent={versionContent}
        />
      )}
    </>
  )
}
