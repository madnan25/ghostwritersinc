import type { ContentPillar, Post, PostStatus } from "@/lib/types";

export type AgentReviewedFilter = "with" | "without" | null;
export const WILDCARD_PILLAR_ID = "__wildcard__";
export const WILDCARD_PILLAR_NAME = "Wildcard";
export const WILDCARD_PILLAR_COLOR = "#94A3B8";

export type PillarFilterOption = Pick<ContentPillar, "id" | "name" | "color"> & {
  count: number;
};

export type DashboardStatusFilter = {
  id:
    | "all"
    | "awaiting_agent"
    | "needs_approval"
    | "draft"
    | "revision"
    | "approved"
    | "scheduled"
    | "published"
    | "rejected"
    | "publish_failed";
  label: string;
  statuses: PostStatus[] | null;
  agentReviewedFilter?: AgentReviewedFilter;
};

export const DASHBOARD_STATUS_FILTERS: DashboardStatusFilter[] = [
  { id: "all", label: "All", statuses: null, agentReviewedFilter: null },
  { id: "awaiting_agent", label: "Awaiting Agent", statuses: ["pending_review"], agentReviewedFilter: "without" },
  { id: "needs_approval", label: "Needs Approval", statuses: ["pending_review"], agentReviewedFilter: "with" },
  { id: "draft", label: "Drafts", statuses: ["draft"], agentReviewedFilter: null },
  { id: "revision", label: "Revision", statuses: ["revision"], agentReviewedFilter: null },
  { id: "approved", label: "Approved", statuses: ["approved"], agentReviewedFilter: null },
  { id: "scheduled", label: "Scheduled", statuses: ["scheduled"], agentReviewedFilter: null },
  { id: "published", label: "Published", statuses: ["published"], agentReviewedFilter: null },
  { id: "rejected", label: "Rejected", statuses: ["rejected"], agentReviewedFilter: null },
  { id: "publish_failed", label: "Failed", statuses: ["publish_failed"], agentReviewedFilter: null },
];

export type DashboardMetrics = {
  totalPosts: number;
  needsReview: number;
  needsApproval: number;
  readyToPublish: number;
  published: number;
};

export type DashboardMetricCard = {
  key: keyof DashboardMetrics;
  label: string;
  detail: string;
};

export const DASHBOARD_METRIC_CARDS: DashboardMetricCard[] = [
  {
    key: "needsApproval",
    label: "Needs Your Approval",
    detail: "Agent-reviewed posts awaiting your decision.",
  },
  {
    key: "readyToPublish",
    label: "Ready To Publish",
    detail: "Approved or scheduled and ready to move.",
  },
  {
    key: "published",
    label: "Published",
    detail: "Already live across your channels.",
  },
];

export function filterPostsByDashboardRule(
  posts: Post[],
  rule: {
    statuses: PostStatus[] | null;
    agentReviewedFilter?: AgentReviewedFilter;
  }
): Post[] {
  let result =
    rule.statuses === null
      ? posts
      : posts.filter((post) => rule.statuses?.includes(post.status));

  if (rule.agentReviewedFilter === "with") {
    result = result.filter((post) => !!post.reviewed_by_agent);
  } else if (rule.agentReviewedFilter === "without") {
    result = result.filter((post) => !post.reviewed_by_agent);
  }

  return result;
}

export function filterPostsByPillars(posts: Post[], selectedPillarIds: Set<string>): Post[] {
  if (selectedPillarIds.size === 0) {
    return posts;
  }

  return posts.filter((post) => {
    if (post.pillar_id) {
      return selectedPillarIds.has(post.pillar_id);
    }

    return selectedPillarIds.has(WILDCARD_PILLAR_ID);
  });
}

export function getDashboardStatusFilterById(
  filterId: DashboardStatusFilter["id"]
): DashboardStatusFilter {
  return (
    DASHBOARD_STATUS_FILTERS.find((filter) => filter.id === filterId) ??
    DASHBOARD_STATUS_FILTERS[0]
  );
}

export function getPillarFilterOptions(
  pillars: ContentPillar[],
  posts: Post[],
  activeFilterId: DashboardStatusFilter["id"]
): PillarFilterOption[] {
  const statusFilteredPosts = filterPostsByDashboardRule(
    posts,
    getDashboardStatusFilterById(activeFilterId)
  );

  const options: PillarFilterOption[] = pillars.map((pillar) => ({
    ...pillar,
    count: statusFilteredPosts.filter((post) => post.pillar_id === pillar.id).length,
  }));

  const wildcardCount = statusFilteredPosts.filter((post) => !post.pillar_id).length;

  if (wildcardCount > 0) {
    options.push({
      id: WILDCARD_PILLAR_ID,
      name: WILDCARD_PILLAR_NAME,
      color: WILDCARD_PILLAR_COLOR,
      count: wildcardCount,
    });
  }

  return options;
}

export function getStatusFilterCount(
  posts: Post[],
  filter: DashboardStatusFilter,
  selectedPillarIds: Set<string>
): number {
  return filterPostsByPillars(
    filterPostsByDashboardRule(posts, filter),
    selectedPillarIds
  ).length;
}

function getDashboardPriority(post: Post): number {
  if (post.status === "pending_review" && post.reviewed_by_agent) return 0;
  if (post.status === "pending_review") return 1;
  if (post.status === "revision") return 2;
  if (post.status === "approved") return 3;
  if (post.status === "scheduled") return 4;
  if (post.status === "draft") return 5;
  if (post.status === "publish_failed") return 6;
  if (post.status === "published") return 7;
  if (post.status === "rejected") return 8;
  return 99;
}

function getDashboardSortTimestamp(post: Post): number {
  const relevantDate =
    post.status === "scheduled"
      ? post.scheduled_publish_at ?? post.suggested_publish_at ?? post.updated_at
      : post.status === "published"
        ? post.published_at ?? post.updated_at
        : post.suggested_publish_at ?? post.updated_at;

  return new Date(relevantDate).getTime();
}

export function sortDashboardPosts(posts: Post[], activeFilterId: DashboardStatusFilter["id"]): Post[] {
  const sorted = [...posts];

  sorted.sort((a, b) => {
    if (activeFilterId === "all") {
      const priorityDiff = getDashboardPriority(a) - getDashboardPriority(b);
      if (priorityDiff !== 0) return priorityDiff;
    }

    if (activeFilterId === "published") {
      return getDashboardSortTimestamp(b) - getDashboardSortTimestamp(a);
    }

    return getDashboardSortTimestamp(a) - getDashboardSortTimestamp(b);
  });

  return sorted;
}

export function getDashboardMetrics(posts: Post[]): DashboardMetrics {
  return {
    totalPosts: posts.length,
    needsReview: posts.filter(
      (post) => post.status === "pending_review" && !post.reviewed_by_agent
    ).length,
    needsApproval: posts.filter(
      (post) => post.status === "pending_review" && !!post.reviewed_by_agent
    ).length,
    readyToPublish: posts.filter(
      (post) => post.status === "approved" || post.status === "scheduled"
    ).length,
    published: posts.filter((post) => post.status === "published").length,
  };
}

export function getDashboardNarrative(metrics: DashboardMetrics): string {
  if (metrics.totalPosts === 0) {
    return "No posts are live yet. Your queue is empty and ready for the next publishing sprint.";
  }

  if (metrics.needsApproval > 0) {
    return `${metrics.needsApproval} post${metrics.needsApproval === 1 ? "" : "s"} are agent-reviewed and waiting for your approval.`;
  }

  if (metrics.needsReview > 0) {
    return `${metrics.needsReview} post${metrics.needsReview === 1 ? "" : "s"} are queued for agent review.`;
  }

  return `${metrics.totalPosts} posts are currently in motion. You are caught up and ready to optimize quality over speed.`;
}
