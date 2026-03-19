import type { Post, PostStatus } from "@/lib/types";

export type DashboardFilterTab = {
  label: string;
  statuses: PostStatus[] | null;
};

export const DASHBOARD_FILTER_TABS: DashboardFilterTab[] = [
  { label: "All", statuses: null },
  { label: "Needs Review", statuses: ["pending_review"] },
  { label: "Drafts", statuses: ["draft"] },
  { label: "Approved", statuses: ["approved", "scheduled"] },
  { label: "Published", statuses: ["published"] },
  { label: "Rejected", statuses: ["rejected"] },
];

export type DashboardMetrics = {
  totalPosts: number;
  needsReview: number;
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
    key: "needsReview",
    label: "Needs Review",
    detail: "Items waiting for editorial action.",
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
      (post) => post.status === "pending_review"
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

  if (metrics.needsReview > 0) {
    return `${metrics.needsReview} post${metrics.needsReview === 1 ? "" : "s"} need review. Focus the queue and clear editorial decisions first.`;
  }

  return `${metrics.totalPosts} posts are currently in motion. You are caught up and ready to optimize quality over speed.`;
}
