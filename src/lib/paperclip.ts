// ---------------------------------------------------------------------------
// Paperclip API integration — creates review tasks for Strategist when users
// comment on posts.
// ---------------------------------------------------------------------------

const PAPERCLIP_API_URL = process.env.PAPERCLIP_API_URL
const PAPERCLIP_API_KEY = process.env.PAPERCLIP_API_KEY
const PAPERCLIP_COMPANY_ID = process.env.PAPERCLIP_COMPANY_ID

// Strategist agent ID in Paperclip
const STRATEGIST_AGENT_ID = '39c96717-4704-4ac7-864d-bfd2382ecfda'
// Parent issue for review tasks (LIN-207)
const REVIEW_PARENT_ISSUE_ID = '462cb945-808a-4821-b17b-80284c7f1637'
// Project ID for LinkedIn Automation
const PROJECT_ID = 'a4e1064c-ef9f-4f2c-b4b6-237fc4291d22'

function isConfigured(): boolean {
  return !!(PAPERCLIP_API_URL && PAPERCLIP_API_KEY && PAPERCLIP_COMPANY_ID)
}

async function paperclipFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${PAPERCLIP_API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${PAPERCLIP_API_KEY}`,
      ...options.headers,
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Paperclip API error (${res.status}): ${body}`)
  }
  return res.json()
}

/**
 * Search for an existing review task for a given post that is still active.
 * Returns the issue ID if found, null otherwise.
 */
async function findExistingReviewTask(
  postId: string,
): Promise<string | null> {
  const issues = await paperclipFetch(
    `/api/companies/${PAPERCLIP_COMPANY_ID}/issues?` +
      `assigneeAgentId=${STRATEGIST_AGENT_ID}` +
      `&status=todo,in_progress` +
      `&parentId=${REVIEW_PARENT_ISSUE_ID}` +
      `&q=${encodeURIComponent(`post:${postId}`)}`,
  )

  if (Array.isArray(issues) && issues.length > 0) {
    return issues[0].id as string
  }

  // Also check the data wrapper pattern
  const list = issues?.data ?? issues
  if (Array.isArray(list) && list.length > 0) {
    return list[0].id as string
  }

  return null
}

/**
 * Create a Paperclip review task for Strategist, or append a comment to an
 * existing one if a task for this post already exists.
 */
export async function createStrategyReviewTask(opts: {
  postId: string
  postTitle: string
  commentId: string
  commentBody: string
  selectedText?: string | null
}): Promise<void> {
  if (!isConfigured()) {
    console.warn(
      '[paperclip] Skipping review task — missing env vars:',
      !PAPERCLIP_API_URL && 'PAPERCLIP_API_URL',
      !PAPERCLIP_API_KEY && 'PAPERCLIP_API_KEY',
      !PAPERCLIP_COMPANY_ID && 'PAPERCLIP_COMPANY_ID',
    )
    return
  }

  const { postId, postTitle, commentId, commentBody, selectedText } = opts
  const truncatedTitle = postTitle.slice(0, 40)

  try {
    const existingId = await findExistingReviewTask(postId)

    if (existingId) {
      // Append a comment to the existing review task
      await paperclipFetch(`/api/issues/${existingId}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          body:
            `New user comment on post \`${postId}\`:\n\n` +
            `> ${commentBody}\n\n` +
            (selectedText ? `Selected text: "${selectedText}"\n\n` : '') +
            `Comment ID: \`${commentId}\``,
        }),
      })
    } else {
      // Create a new review task
      await paperclipFetch(`/api/companies/${PAPERCLIP_COMPANY_ID}/issues`, {
        method: 'POST',
        body: JSON.stringify({
          title: `Review user comment on: ${truncatedTitle}`,
          description:
            `A user left a comment on a post that needs Strategist review.\n\n` +
            `**Post ID:** \`${postId}\`\n` +
            `**Post title:** ${postTitle}\n` +
            `**Comment ID:** \`${commentId}\`\n` +
            `**Comment:** ${commentBody}\n` +
            (selectedText
              ? `**Selected text (inline comment):** "${selectedText}"\n`
              : '') +
            `**Link:** /post/${postId}\n\n` +
            `Search key — post:${postId}`,
          status: 'todo',
          priority: 'medium',
          assigneeAgentId: STRATEGIST_AGENT_ID,
          parentId: REVIEW_PARENT_ISSUE_ID,
          projectId: PROJECT_ID,
        }),
      })
    }
  } catch (err) {
    // Best-effort — don't fail the user's comment if Paperclip is unreachable
    console.error(
      '[paperclip] Failed to create/update review task:',
      err instanceof Error ? err.message : err,
    )
  }
}
