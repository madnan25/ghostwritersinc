'use client'

import { useState } from 'react'
import type { PostComment, PostRevision } from '@/lib/types'
import { VersionSwitcher } from './version-switcher'
import { CommentablePostContent } from './commentable-post-content'
import { RevisionDiff } from './revision-diff'

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

  return (
    <>
      {revisions.length > 0 && (
        <div className="mb-4 flex items-center gap-3">
          <VersionSwitcher
            revisions={revisions}
            currentVersion={currentVersion}
            selectedVersion={selectedVersion}
            onSelect={(v) => { setSelectedVersion(v); setDiffMode(false) }}
          />
          {canShowDiff && (
            <button
              onClick={() => setDiffMode((d) => !d)}
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                diffMode
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-border/80 hover:text-foreground'
              }`}
            >
              {diffMode ? 'Hide diff' : 'View diff'}
            </button>
          )}
        </div>
      )}

      {diffMode ? (
        <RevisionDiff
          oldContent={diffOldContent}
          newContent={content}
          oldLabel={diffOldLabel}
          newLabel={diffNewLabel}
        />
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
