'use client'

import { useState } from 'react'
import type { PostComment, PostRevision } from '@/lib/types'
import { VersionSwitcher } from './version-switcher'
import { CommentablePostContent } from './commentable-post-content'

interface Props {
  postId: string
  content: string
  currentVersion: number
  comments: PostComment[]
  revisions: PostRevision[]
}

export function PostContentWithVersions({ postId, content, currentVersion, comments, revisions }: Props) {
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null)

  const versionContent =
    selectedVersion != null
      ? revisions.find((r) => r.version === selectedVersion)?.content
      : undefined

  return (
    <>
      {revisions.length > 0 && (
        <VersionSwitcher
          revisions={revisions}
          currentVersion={currentVersion}
          selectedVersion={selectedVersion}
          onSelect={setSelectedVersion}
        />
      )}
      <CommentablePostContent
        postId={postId}
        content={content}
        comments={comments}
        currentVersion={currentVersion}
        viewingVersion={selectedVersion}
        versionContent={versionContent}
      />
    </>
  )
}
