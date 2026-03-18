import type { ContentPillar, Post } from "@/lib/types";

export type RotationWarning = {
  pillar_id: string;
  pillar_name: string;
  run_length: number;
  suggestion: string;
};

export const STATUS_STYLES: Record<string, string> = {
  pending_review: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  approved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  rejected: "bg-destructive/15 text-destructive border-destructive/25",
  draft: "bg-muted text-muted-foreground border-border",
  agent_review: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  scheduled: "bg-purple-500/15 text-purple-400 border-purple-500/25",
  published: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
};

export function formatPostDate(dateStr: string | null): string {
  if (!dateStr) {
    return "No date set";
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(dateStr));
}

export function computeRotationWarnings(
  posts: Post[],
  pillars: ContentPillar[]
): RotationWarning[] {
  const ordered = posts
    .filter((post) => post.pillar_id && post.suggested_publish_at)
    .sort(
      (a, b) =>
        new Date(a.suggested_publish_at!).getTime() -
        new Date(b.suggested_publish_at!).getTime()
    );

  const warnings: RotationWarning[] = [];
  let currentPillar: string | null = null;
  let runPosts: string[] = [];

  for (const post of ordered) {
    if (post.pillar_id === currentPillar && currentPillar !== null) {
      runPosts.push(post.id);
      continue;
    }

    if (runPosts.length > 2 && currentPillar) {
      const pillar = pillars.find((candidate) => candidate.id === currentPillar);
      warnings.push({
        pillar_id: currentPillar,
        pillar_name: pillar?.name ?? "Unknown",
        run_length: runPosts.length,
        suggestion: `${runPosts.length} consecutive "${pillar?.name ?? "Unknown"}" posts queued. Mix in other pillars for better variety.`,
      });
    }

    currentPillar = post.pillar_id;
    runPosts = [post.id];
  }

  if (runPosts.length > 2 && currentPillar) {
    const pillar = pillars.find((candidate) => candidate.id === currentPillar);
    warnings.push({
      pillar_id: currentPillar,
      pillar_name: pillar?.name ?? "Unknown",
      run_length: runPosts.length,
      suggestion: `${runPosts.length} consecutive "${pillar?.name ?? "Unknown"}" posts queued. Mix in other pillars for better variety.`,
    });
  }

  return warnings;
}
