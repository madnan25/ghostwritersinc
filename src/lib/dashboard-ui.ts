import type { Post, PostStatus } from "@/lib/types";

export type DashboardFilterTab = {
  label: string;
  statuses: PostStatus[] | null;
  /** When set, further filter by whether reviewed_by_agent is present */
  agentReviewedFilter?: 'with' | 'without' | null;
};

export const DASHBOARD_FILTER_TABS: DashboardFilterTab[] = [
  { label: "All", statuses: null },
  { label: "Awaiting Agent", statuses: ["pending_review"], agentReviewedFilter: 'without' },
  { label: "Needs Approval", statuses: ["pending_review"], agentReviewedFilter: 'with' },
  { label: "Drafts", statuses: ["draft"] },
  { label: "Approved", statuses: ["approved", "scheduled"] },
  { label: "Published", statuses: ["published"] },
  { label: "Rejected", statuses: ["rejected"] },
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
