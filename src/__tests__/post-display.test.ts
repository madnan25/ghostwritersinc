// @vitest-environment node

import { describe, expect, it } from "vitest";
import { computeRotationWarnings, formatPostDate } from "@/lib/post-display";
import type { ContentPillar, Post } from "@/lib/types";

const pillars: ContentPillar[] = [
  {
    id: "pillar-a",
    organization_id: "org-1",
    user_id: "user-1",
    name: "Thought Leadership",
    slug: "thought-leadership",
    description: null,
    color: "#000000",
    weight_pct: 50,
    audience_summary: null,
    example_hooks: [],
    sort_order: 0,
    brief_ref: null,
    created_at: "",
    updated_at: "",
  },
  {
    id: "pillar-b",
    organization_id: "org-1",
    user_id: "user-1",
    name: "Industry Trends",
    slug: "industry-trends",
    description: null,
    color: "#111111",
    weight_pct: 50,
    audience_summary: null,
    example_hooks: [],
    sort_order: 1,
    brief_ref: null,
    created_at: "",
    updated_at: "",
  },
];

function makePost(id: string, pillarId: string | null, suggestedAt: string, scheduledAt?: string | null): Post {
  return {
    id,
    organization_id: "org-1",
    user_id: "user-1",
    content: "Post content",
    content_type: "text",
    media_urls: [],
    pillar: null,
    pillar_id: pillarId,
    brief_ref: null,
    suggested_publish_at: suggestedAt,
    scheduled_publish_at: scheduledAt ?? null,
    published_at: null,
    linkedin_post_urn: null,
    status: "draft",
    rejection_reason: null,
    agent_id: null,
    created_by_agent: null,
    reviewed_by_agent: null,
    review_notes: null,
    content_version: 1,
    revision_count: 0,
    brief_id: null,
    created_at: suggestedAt,
    updated_at: suggestedAt,
  };
}

describe("post display helpers", () => {
  it("detects when a pillar has 3 posts in the same calendar week", () => {
    const warnings = computeRotationWarnings(
      [
        makePost("post-1", "pillar-a", "2026-03-15T10:00:00.000Z"),
        makePost("post-2", "pillar-a", "2026-03-17T10:00:00.000Z"),
        makePost("post-3", "pillar-a", "2026-03-21T10:00:00.000Z"),
        makePost("post-4", "pillar-b", "2026-03-22T10:00:00.000Z"),
      ],
      pillars,
      new Date("2026-03-18T12:00:00.000Z")
    );

    const weeklyWarning = warnings.find((warning) => warning.scope === "week");
    expect(weeklyWarning).toMatchObject({
      pillar_id: "pillar-a",
      pillar_name: "Thought Leadership",
      run_length: 3,
      source: "suggested",
      scope: "week",
    });
  });

  it("flags pillars that exceed their monthly target share", () => {
    const weightedPillars: ContentPillar[] = [
      { ...pillars[0], weight_pct: 25 },
      { ...pillars[1], weight_pct: 75 },
    ];

    const warnings = computeRotationWarnings(
      [
        makePost("post-1", "pillar-a", "2026-03-03T10:00:00.000Z", "2026-03-03T10:00:00.000Z"),
        makePost("post-2", "pillar-a", "2026-03-10T10:00:00.000Z", "2026-03-10T10:00:00.000Z"),
        makePost("post-3", "pillar-b", "2026-03-12T10:00:00.000Z", "2026-03-12T10:00:00.000Z"),
        makePost("post-4", null, "2026-03-18T10:00:00.000Z", "2026-03-18T10:00:00.000Z"),
      ],
      weightedPillars,
      new Date("2026-03-01T12:00:00.000Z")
    );

    const monthlyWarning = warnings.find((warning) => warning.scope === "month");
    expect(monthlyWarning).toMatchObject({
      pillar_id: "pillar-a",
      pillar_name: "Thought Leadership",
      run_length: 2,
      source: "scheduled",
      scope: "month",
      target_pct: 25,
      actual_pct: 67,
    });
  });

  it("formats empty dates safely", () => {
    expect(formatPostDate(null)).toBe("No date set");
    expect(formatPostDate("2026-03-18T10:00:00.000Z")).toContain("March");
  });
});
