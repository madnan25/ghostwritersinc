// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  generateAgentKey,
  getAgentKeyPrefix,
  getAgentRateLimitKey,
  hasAgentPermission,
} from "@/lib/agent-auth";

describe("agent auth helpers", () => {
  it("derives a lookup prefix that includes random key material", () => {
    const key = generateAgentKey();
    const prefix = getAgentKeyPrefix(key);

    expect(prefix).toMatch(/^gw_agent_[a-f0-9]{16}$/);
    expect(prefix).not.toBe("gw_agent");
  });

  it("accepts granular permissions for broad capability checks", () => {
    expect(
      hasAgentPermission(["posts:read", "comments:read"], "read")
    ).toBe(true);
    expect(
      hasAgentPermission(["reviews:write"], "review")
    ).toBe(true);
    expect(
      hasAgentPermission(["comments:write"], "write")
    ).toBe(true);
  });

  it("accepts legacy broad permissions for granular checks", () => {
    expect(hasAgentPermission(["read"], "posts:read")).toBe(true);
    expect(hasAgentPermission(["write"], "comments:write")).toBe(true);
    expect(hasAgentPermission(["review"], "reviews:write")).toBe(true);
  });

  it("keys rate limits by organization, user, and key identity", () => {
    expect(
      getAgentRateLimitKey(
        {
          keyId: "key-123",
          agentId: "agent-123",
          agentName: "scribe",
          agentSlug: "scribe",
          agentType: "scribe",
          provider: "ghostwriters",
          status: "active",
          organizationId: "org-1",
          userId: "user-1",
          permissions: ["posts:read"],
          allowSharedContext: false,
          scopeMode: "user",
        },
        "read"
      )
    ).toBe("read:org-1:user-1:key-123");
  });
});
