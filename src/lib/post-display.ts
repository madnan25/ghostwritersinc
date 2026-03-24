import type { ContentPillar, Post } from "@/lib/types";

export type RotationWarning = {
  pillar_id: string;
  pillar_name: string;
  run_length: number;
  source?: "suggested" | "scheduled";
  scope?: "week" | "month";
  period_label?: string;
  target_pct?: number;
  actual_pct?: number;
  actual_count?: number;
  target_count?: number;
  total_posts?: number;
  direction?: "over" | "under";
  suggestion: string;
};

export const STATUS_STYLES: Record<string, string> = {
  pending_review: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  revision: "bg-orange-500/15 text-orange-400 border-orange-500/25",
  approved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  rejected: "bg-destructive/15 text-destructive border-destructive/25",
  draft: "bg-muted text-muted-foreground border-border",
  scheduled: "bg-purple-500/15 text-purple-400 border-purple-500/25",
  published: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  publish_failed: "bg-destructive/15 text-destructive border-destructive/25",
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

export function getCalendarDate(post: Pick<Post, "scheduled_publish_at" | "suggested_publish_at">): string | null {
  return post.scheduled_publish_at ?? post.suggested_publish_at;
}

export function startOfCalendarWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function formatWeekLabel(weekStart: Date): string {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${weekStart.toLocaleDateString("en-US", opts)} - ${weekEnd.toLocaleDateString("en-US", { ...opts, year: "numeric" })}`;
}

function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function computeRotationWarnings(
  posts: Pick<Post, "id" | "pillar_id" | "suggested_publish_at" | "scheduled_publish_at">[],
  pillars: ContentPillar[],
  referenceDate: Date = new Date(),
): RotationWarning[] {
  const pillarMap = new Map(pillars.map((pillar) => [pillar.id, pillar]));
  const earliestRelevantDate = startOfCalendarWeek(referenceDate);
  const suggestedQueue = posts
    .map((post) => ({
      ...post,
      calendar_date: post.suggested_publish_at,
    }))
    .filter(
      (post): post is Pick<Post, "id" | "pillar_id" | "suggested_publish_at" | "scheduled_publish_at"> & { calendar_date: string } =>
        !!post.calendar_date &&
        !post.scheduled_publish_at &&
        !!post.pillar_id &&
        pillarMap.has(post.pillar_id) &&
        new Date(post.calendar_date) >= earliestRelevantDate
    )
    .sort(
      (a, b) =>
        new Date(a.calendar_date).getTime() -
        new Date(b.calendar_date).getTime()
    );

  const scheduled = posts
    .map((post) => ({
      ...post,
      calendar_date: post.scheduled_publish_at,
    }))
    .filter(
      (post): post is Pick<Post, "id" | "pillar_id" | "suggested_publish_at" | "scheduled_publish_at"> & { calendar_date: string } =>
        !!post.calendar_date &&
        !!post.pillar_id &&
        pillarMap.has(post.pillar_id) &&
        new Date(post.calendar_date) >= earliestRelevantDate
    )
    .sort(
      (a, b) =>
        new Date(a.calendar_date).getTime() -
        new Date(b.calendar_date).getTime()
    );

  const warnings: RotationWarning[] = [];

  const postsByWeekAndPillar = new Map<string, { pillarId: string; pillarName: string; weekStart: Date; count: number }>();
  for (const post of suggestedQueue) {
    const pillarId = post.pillar_id!;
    const pillar = pillarMap.get(pillarId);
    if (!pillar) continue;

    const weekStart = startOfCalendarWeek(new Date(post.calendar_date));
    const key = `${pillarId}:${weekStart.toISOString()}`;
    const existing = postsByWeekAndPillar.get(key);

    if (existing) {
      existing.count += 1;
    } else {
      postsByWeekAndPillar.set(key, {
        pillarId,
        pillarName: pillar.name,
        weekStart,
        count: 1,
      });
    }
  }

  for (const entry of [...postsByWeekAndPillar.values()].sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime())) {
    if (entry.count < 3) continue;

    const periodLabel = formatWeekLabel(entry.weekStart);
    warnings.push({
      pillar_id: entry.pillarId,
      pillar_name: entry.pillarName,
      run_length: entry.count,
      source: "suggested",
      scope: "week",
      period_label: periodLabel,
      suggestion: `${entry.pillarName} is crowded in the suggested queue for ${periodLabel} with ${entry.count} posts.`,
    });
  }

  type ScheduledPost = Pick<Post, "id" | "pillar_id" | "suggested_publish_at" | "scheduled_publish_at"> & { calendar_date: string };
  const postsByMonth = new Map<string, Array<ScheduledPost>>();
  for (const post of scheduled) {
    const date = new Date(post.calendar_date);
    const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
    if (!postsByMonth.has(monthKey)) postsByMonth.set(monthKey, []);
    postsByMonth.get(monthKey)!.push(post);
  }

  for (const [, monthPosts] of [...postsByMonth.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const totalAssigned = monthPosts.length;
    if (totalAssigned === 0) continue;

    const sampleDate = new Date(monthPosts[0].calendar_date);
    const periodLabel = formatMonthLabel(sampleDate);
    const countByPillar = new Map<string, number>();
    for (const post of monthPosts) {
      countByPillar.set(post.pillar_id!, (countByPillar.get(post.pillar_id!) ?? 0) + 1);
    }

    // Collect under-target pillar names for actionable suggestions
    const overPillars: { name: string; excess: number }[] = [];
    const underPillars: { name: string; deficit: number }[] = [];

    for (const pillar of pillars) {
      if (!pillarMap.has(pillar.id)) continue;
      const count = countByPillar.get(pillar.id) ?? 0;
      const targetCount = Math.round(totalAssigned * pillar.weight_pct / 100);
      if (count > targetCount) overPillars.push({ name: pillar.name, excess: count - targetCount });
      if (count < targetCount) underPillars.push({ name: pillar.name, deficit: targetCount - count });
    }

    const underNames = underPillars.map((p) => p.name);

    for (const pillar of pillars) {
      if (!pillarMap.has(pillar.id)) continue;
      const count = countByPillar.get(pillar.id) ?? 0;
      const targetCount = Math.round(totalAssigned * pillar.weight_pct / 100);
      const actualPct = totalAssigned > 0 ? Math.round((count / totalAssigned) * 100) : 0;

      if (count > targetCount) {
        const excess = count - targetCount;
        const reassignTo = underNames.length > 0
          ? ` — reassign to ${underNames.join(" or ")}`
          : "";
        warnings.push({
          pillar_id: pillar.id,
          pillar_name: pillar.name,
          run_length: count,
          source: "scheduled",
          scope: "month",
          period_label: periodLabel,
          target_pct: pillar.weight_pct,
          actual_pct: actualPct,
          actual_count: count,
          target_count: targetCount,
          total_posts: totalAssigned,
          direction: "over",
          suggestion: `${excess} post${excess !== 1 ? "s" : ""} over target${reassignTo}.`,
        });
      } else if (count < targetCount) {
        const deficit = targetCount - count;
        const overNames = overPillars.map((p) => p.name);
        const stealFrom = overNames.length > 0
          ? ` — reassign from ${overNames.join(" or ")}`
          : "";
        warnings.push({
          pillar_id: pillar.id,
          pillar_name: pillar.name,
          run_length: count,
          source: "scheduled",
          scope: "month",
          period_label: periodLabel,
          target_pct: pillar.weight_pct,
          actual_pct: actualPct,
          actual_count: count,
          target_count: targetCount,
          total_posts: totalAssigned,
          direction: "under",
          suggestion: `Needs ${deficit} more post${deficit !== 1 ? "s" : ""}${stealFrom}.`,
        });
      }
    }
  }

  return warnings;
}
