export type PostStatus =
  | 'draft'
  | 'pending_review'
  | 'revision'
  | 'approved'
  | 'scheduled'
  | 'published'
  | 'rejected'
  | 'publish_failed'

export type ContentType = 'text' | 'image' | 'document'

export type FreshnessType = 'evergreen' | 'time_sensitive' | 'date_locked'

export type AuthorType = 'user' | 'agent'

export type ReviewAction = 'approved' | 'rejected' | 'escalated' | 'revised'

export type UserRole = 'admin' | 'member'

export type RequestStatus = 'pending' | 'approved' | 'denied'

export interface Organization {
  id: string
  name: string
  slug: string
  onboarded_at: string | null
  linkedin_profile_url: string | null
  content_goals: string | null
  context_sharing_enabled: boolean
  created_at: string
}

export interface Post {
  id: string
  organization_id: string
  user_id: string
  title?: string | null
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
  agent_id: string | null
  created_by_agent: string | null
  reviewed_by_agent: string | null
  review_notes: string | null
  content_version: number
  revision_count: number
  brief_id: string | null
  brief_version_id?: string | null
  freshness_type: FreshnessType
  expiry_date: string | null
  archived_at: string | null
  source?: string | null
  // Populated via brief join for calendar series visualization
  series_id?: string | null
  series_part_number?: number | null
  created_at: string
  updated_at: string
}

export interface PostRevision {
  id: string
  post_id: string
  version: number
  content: string
  revised_by_agent: string | null
  revision_reason: string | null
  brief_version_id?: string | null
  created_at: string
}

export interface PostComment {
  id: string
  post_id: string
  author_type: AuthorType
  author_id: string
  author_name?: string | null
  body: string
  selected_text: string | null
  selection_start: number | null
  selection_end: number | null
  content_version: number | null
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
  agent_id?: string | null
  agent_name: string
  action: ReviewAction
  notes: string | null
  created_at: string
}

export interface Agent {
  id: string
  organization_id: string
  user_id: string
  name: string
  slug: string
  provider: string
  provider_agent_ref: string | null
  agent_type: string
  job_title: string | null
  status: 'active' | 'inactive' | 'revoked'
  allow_shared_context: boolean
  commissioned_by: string | null
  created_at: string
  updated_at: string
  last_used_at: string | null
  last_used_by_route: string | null
  revoked_at: string | null
  revoked_by: string | null
  permissions?: string[]
}

export interface AgentKey {
  id: string
  agent_id: string | null
  organization_id: string
  user_id: string | null
  agent_name: string
  key_prefix: string
  permissions: string[]
  allow_shared_context: boolean
  commissioned_by: string | null
  created_at: string
}

export interface InviteRequest {
  id: string
  organization_id: string
  requested_by: string
  requested_email: string
  requested_role: UserRole
  status: RequestStatus
  decision_notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  fulfilled_invitation_id: string | null
  created_at: string
  updated_at: string
}

export interface AgentHiringRequest {
  id: string
  organization_id: string
  requested_by: string
  requested_for_user_id: string
  preset_key: string
  requested_shared_context: boolean
  status: RequestStatus
  decision_notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  fulfilled_agent_ids: string[]
  created_at: string
  updated_at: string
}

export interface ResearchUpload {
  id: string
  organization_id: string
  uploaded_by: string | null
  agent_id: string | null
  filename: string
  title: string | null
  summary: string | null
  storage_path: string
  source_kind: string
  upload_type: string
  file_size_bytes: number | null
  metadata: Record<string, unknown>
  created_at: string
  last_accessed_at: string | null
}

export interface ContentPillar {
  id: string
  organization_id: string
  user_id: string
  name: string
  slug: string
  active?: boolean
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

export interface StrategyDocument {
  id: string
  organization_id: string
  user_id: string | null
  title: string
  body: string
  summary: string | null
  pillar_id: string | null
  created_by_agent_id: string | null
  updated_by_agent_id: string | null
  created_at: string
  updated_at: string
}

export type AgentActionType =
  | 'draft_created'
  | 'draft_updated'
  | 'review_submitted'
  | 'status_changed'
  | 'comment_added'

export interface AgentActivityLog {
  id: string
  organization_id: string
  agent_id: string
  post_id: string | null
  action_type: AgentActionType
  metadata: Record<string, unknown>
  created_at: string
}

export interface LearnedPreferenceEntry {
  observation_id: string
  observation: string
  confidence: number
  source_post_ids: string[]
  applied_at: string
}

export interface UserWritingProfile {
  id: string
  user_id: string
  organization_id: string
  tone: string | null
  voice_notes: string | null
  sample_post_ids: string[]
  avoid_topics: string[]
  preferred_formats: string[]
  learned_preferences: LearnedPreferenceEntry[] | null
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

export type ResearchPoolStatus = 'new' | 'consumed'

export interface ResearchPoolItem {
  id: string
  organization_id: string
  title: string
  source_url: string | null
  source_type: string
  pillar_id: string | null
  relevance_score: number | null
  raw_content: string | null
  status: ResearchPoolStatus
  created_by_agent_id: string | null
  created_at: string
  updated_at: string
}

export type BriefStatus = 'pending' | 'in_review' | 'revision_requested' | 'done'

export type BriefSource = 'ai_generated' | 'human_request'

export type BriefPriority = 'normal' | 'urgent'

export interface Brief {
  id: string
  organization_id: string
  pillar_id: string | null
  angle: string
  research_refs: string[]
  voice_notes: string | null
  publish_at: string | null
  status: BriefStatus
  source: BriefSource
  priority: BriefPriority
  current_version?: number
  revision_count: number
  revision_notes: string | null
  assigned_agent_id: string | null
  created_at: string
  updated_at: string
}

export interface BriefVersion {
  id: string
  brief_id: string
  organization_id: string
  version: number
  pillar_id: string | null
  angle: string
  research_refs: string[]
  voice_notes: string | null
  publish_at: string | null
  status: BriefStatus
  source: BriefSource
  priority: BriefPriority
  revision_count: number
  revision_notes: string | null
  assigned_agent_id: string | null
  created_at: string
}

export interface BriefVersionResearchItem {
  id: string
  title: string
  source_type: string
}

export interface BriefVersionWithContext extends BriefVersion {
  assigned_agent_name: string | null
  research_items: BriefVersionResearchItem[]
  linked_post_versions: number[]
}

export interface LinkedInConnection {
  connected: boolean
  linkedinMemberId: string | null
  connectedAt: string | null
  expiresAt: string | null
}

export interface StrategyConfig {
  id: string
  user_id: string
  organization_id: string
  monthly_post_target: number
  intel_score_threshold: number
  default_publish_hour: number
  wildcard_count: number
  posting_days: number[]
  voice_notes: string | null
  scout_context: string | null
  whats_working: Record<string, unknown> | null
  whats_working_updated_at: string | null
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Sprint 6 — Content Series
// ---------------------------------------------------------------------------

export type SeriesStatus = 'planning' | 'active' | 'paused' | 'cancelled' | 'completed'

export type SeriesCadence = 'weekly' | 'biweekly' | 'monthly'

export interface ContentSeries {
  id: string
  organization_id: string
  user_id: string
  title: string
  description: string | null
  total_parts: number
  cadence: SeriesCadence
  status: SeriesStatus
  created_at: string
  updated_at: string
  completed_at: string | null
}

export interface SeriesBrief {
  id: string
  series_id: string
  series_part_number: number
  angle: string
  status: string
  post_id?: string | null
  post_status?: string | null
}

export interface SeriesWithBriefs extends ContentSeries {
  briefs: SeriesBrief[]
}

export interface SeriesBriefWithPost {
  id: string
  series_id: string
  series_part_number: number
  angle: string
  status: BriefStatus
  priority: BriefPriority
  pillar_id: string | null
  research_refs: string[]
  voice_notes: string | null
  publish_at: string | null
  post_id: string | null
  post_content: string | null
  post_status: string | null
  post_published_at: string | null
}

export interface SeriesDebrief {
  generated_at: string
  series_id: string
  series_title: string
  total_parts: number
  parts_with_data: number
  parts: Array<{
    part_number: number
    brief_id: string
    post_id: string | null
    status: string
    impressions: number
    reactions: number
    comments_count: number
    reposts: number
    engagement: number
  }>
  best_performing_part: number | null
  worst_performing_part: number | null
  avg_engagement: number
  engagement_trend: 'increasing' | 'decreasing' | 'stable'
}

// ---------------------------------------------------------------------------
// Sprint 5 — Voice Profile Learning
// ---------------------------------------------------------------------------

export type DiffEditType = 'no_edit' | 'minor_edit' | 'major_edit'

export interface PostDiff {
  id: string
  post_id: string
  organization_id: string
  user_id: string
  original_content: string
  published_content: string
  edit_type: DiffEditType
  change_summary: string | null
  created_at: string
}

export type ObservationStatus = 'pending' | 'confirmed' | 'dismissed'

export interface VoiceObservation {
  id: string
  organization_id: string
  user_id: string
  observation: string
  confidence: number
  status: ObservationStatus
  source_post_ids: string[]
  created_by_agent_id: string | null
  confirmed_at: string | null
  dismissed_at: string | null
  created_at: string
  updated_at: string
}
