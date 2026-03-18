// @vitest-environment node

import { describe, expect, it } from "vitest";
import { computeRotationWarnings, formatPostDate } from "@/lib/post-display";
import type { ContentPillar, Post } from "@/lib/types";

const pillars: ContentPillar[] = [
  {
    id: "pillar-a",
    organization_id: "org-1",
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

function makePost(id: string, pillarId: string | null, suggestedAt: string): Post {
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
    scheduled_publish_at: null,
    published_at: null,
    linkedin_post_urn: null,
    status: "draft",
    rejection_reason: null,
    created_by_agent: null,
    reviewed_by_agent: null,
    review_notes: null,
    created_at: suggestedAt,
    updated_at: suggestedAt,
  };
}

describe("post display helpers", () => {
  it("detects long runs of the same pillar", () => {
    const warnings = computeRotationWarnings(
      [
        makePost("post-1", "pillar-a", "2026-03-18T10:00:00.000Z"),
        makePost("post-2", "pillar-a", "2026-03-19T10:00:00.000Z"),
        makePost("post-3", "pillar-a", "2026-03-20T10:00:00.000Z"),
        makePost("post-4", "pillar-b", "2026-03-21T10:00:00.000Z"),
      ],
      pillars
    );

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({
      pillar_id: "pillar-a",
      pillar_name: "Thought Leadership",
      run_length: 3,
    });
  });

  it("formats empty dates safely", () => {
    expect(formatPostDate(null)).toBe("No date set");
    expect(formatPostDate("2026-03-18T10:00:00.000Z")).toContain("March");
  });
});
