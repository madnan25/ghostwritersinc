export type PostStatus =
  | 'draft'
  | 'agent_review'
  | 'pending_review'
  | 'approved'
  | 'scheduled'
  | 'published'
  | 'rejected'

export type ContentType = 'text' | 'image' | 'document'

export type AuthorType = 'user' | 'agent'

export type ReviewAction = 'approved' | 'rejected' | 'escalated'

export type UserRole = 'owner' | 'admin' | 'member'

export interface Organization {
  id: string
  name: string
  slug: string
  created_at: string
}

export interface Post {
  id: string
  organization_id: string
  user_id: string
  content: string
  content_type: ContentType
  media_urls: string[] | null
  pillar: string | null
  pillar_id: string | null
  brief_ref: string | null
  suggested_publish_at: string | null
  scheduled_publish_at: string | null
  published_at: string | null
  linkedin_post_urn: string | null
  status: PostStatus
  rejection_reason: string | null
  created_by_agent: string | null
  reviewed_by_agent: string | null
  review_notes: string | null
  created_at: string
  updated_at: string
}

export interface PostComment {
  id: string
  post_id: string
  author_type: AuthorType
  author_id: string
  body: string
  selected_text: string | null
  selection_start: number | null
  selection_end: number | null
  created_at: string
}

export interface PostMetrics {
  id: string
  post_id: string
  impressions: number
  likes: number
  comments: number
  shares: number
  entered_at: string
  entered_by: string
}

export interface ReviewEvent {
  id: string
  post_id: string
  agent_name: string
  action: ReviewAction
  notes: string | null
  created_at: string
}

export interface AgentKey {
  id: string
  organization_id: string
  agent_name: string
  key_prefix: string
  permissions: string[]
  created_at: string
}

export interface ResearchUpload {
  id: string
  organization_id: string
  uploaded_by: string | null
  filename: string
  storage_path: string
  upload_type: string
  file_size_bytes: number | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface ContentPillar {
  id: string
  organization_id: string
  name: string
  slug: string
  description: string | null
  color: string
  weight_pct: number
  audience_summary: string | null
  example_hooks: string[]
  sort_order: number
  brief_ref: string | null
  created_at: string
  updated_at: string
}

export interface Notification {
  id: string
  organization_id: string
  user_id: string
  type: string
  title: string
  body: string
  post_id: string | null
  read: boolean
  created_at: string
}
