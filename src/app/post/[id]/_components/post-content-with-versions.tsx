'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { GitCompare, Flag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { PostComment, PostRevision, PostStatus } from '@/lib/types'
import { requestRevision } from '@/app/actions/posts'
import { VersionSwitcher } from './version-switcher'
import { DiffVersionSelectors } from './diff-version-selectors'
import { CommentablePostContent } from './commentable-post-content'
import { RevisionDiff } from './revision-diff'
import { AnnotatablePostContent, type FlaggedAnnotation } from './annotatable-post-content'
import { RevisionSidebar } from './revision-sidebar'

const MAX_TARGETED_REVISIONS = 3

interface Props {
  postId: string
  content: string
  currentVersion: number
  status: PostStatus
  comments: PostComment[]
  revisions: PostRevision[]
}

export function PostContentWithVersions({ postId, content, currentVersion, status, comments, revisions }: Props) {
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null)
  const [diffMode, setDiffMode] = useState(false)
  const [compareFrom, setCompareFrom] = useState<number | null>(null)
  const [compareTo, setCompareTo] = useState<number | null>(null)
  const [revisionMode, setRevisionMode] = useState(status === 'revision')
  const [annotations, setAnnotations] = useState<FlaggedAnnotation[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const versionContent =
    selectedVersion != null
      ? revisions.find((r) => r.version === selectedVersion)?.content
      : undefined

  const canShowDiff = revisions.length > 0

  // Resolve content for diff comparison
  function resolveContent(version: number | null): string {
    if (version === null) return content
    return revisions.find((r) => r.version === version)?.content ?? ''
  }

  function resolveLabel(version: number | null): string {
    if (version === null) return `v${currentVersion} (current)`
    return `v${version}`
  }

  const diffOldContent = resolveContent(compareFrom)
  const diffOldLabel = resolveLabel(compareFrom)
  const diffNewContent = resolveContent(compareTo)
  const diffNewLabel = resolveLabel(compareTo)
  const canRequestRevision = status === 'pending_review'
  const canUseRevisionTools = status === 'revision'

  // Sync revisionMode when post status changes externally (e.g. after approval/rejection)
  useEffect(() => {
    if (status === 'revision') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRevisionMode(true)
      return
    }
    setRevisionMode(false)
    setAnnotations([])
  }, [status])

  function handleToggleRevisionMode() {
    if (canRequestRevision) {
      setError(null)
      setDiffMode(false)
      setSelectedVersion(null)
      setAnnotations([])

      startTransition(async () => {
        try {
          await requestRevision(postId)
          router.refresh()
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to request revision.')
        }
      })
      return
    }

    if (revisionMode) {
      setRevisionMode(false)
      setAnnotations([])
    } else {
      setRevisionMode(true)
      setError(null)
      setDiffMode(false)
      setSelectedVersion(null)
      setAnnotations([])
    }
  }

  function handleToggleDiff() {
    if (!diffMode) {
      // Turning diff on: initialize selectors
      setCompareFrom(selectedVersion ?? revisions[0]?.version ?? null)
      setCompareTo(null)
    }
    setDiffMode((d) => !d)
    if (revisionMode) {
      setRevisionMode(false)
      setAnnotations([])
    }
  }

  return (
    <>
      <div className="mb-5 rounded-[20px] border border-border/60 bg-background/40 p-2 shadow-[0_14px_36px_-30px_rgba(0,0,0,0.5)]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {revisions.length > 0 && !diffMode && (
              <VersionSwitcher
                revisions={revisions}
                currentVersion={currentVersion}
                selectedVersion={selectedVersion}
                onSelect={(v) => { setSelectedVersion(v); setDiffMode(false); setRevisionMode(false); setAnnotations([]) }}
              />
            )}
            {diffMode && (
              <DiffVersionSelectors
                revisions={revisions}
                currentVersion={currentVersion}
                compareFrom={compareFrom}
                compareTo={compareTo}
                onChangeFrom={setCompareFrom}
                onChangeTo={setCompareTo}
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
            {(canRequestRevision || canUseRevisionTools) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleToggleRevisionMode}
                disabled={isPending}
                className={`border-border/70 bg-background/70 shadow-none ${
                  revisionMode
                    ? 'border-amber-400/40 bg-amber-400/10 text-amber-300 hover:bg-amber-400/14'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Flag className="size-3.5" />
                {isPending
                  ? 'Moving to revision…'
                  : canRequestRevision
                    ? 'Set to Revision'
                    : revisionMode
                      ? 'Hide revision tools'
                      : 'Open revision tools'}
              </Button>
            )}
          </div>
          <div className="px-2 text-[0.72rem] uppercase tracking-[0.16em] text-muted-foreground/80">
            {diffMode
              ? `Comparing ${resolveLabel(compareFrom)} → ${resolveLabel(compareTo)}`
              : selectedVersion != null ? `Viewing v${selectedVersion}` : `Current v${currentVersion}`}
          </div>
        </div>
        {error && (
          <p className="px-2 pt-2 text-xs text-destructive">{error}</p>
        )}
      </div>

      {diffMode ? (
        <RevisionDiff
          oldContent={diffOldContent}
          newContent={diffNewContent}
          oldLabel={diffOldLabel}
          newLabel={diffNewLabel}
        />
      ) : canUseRevisionTools && revisionMode ? (
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
