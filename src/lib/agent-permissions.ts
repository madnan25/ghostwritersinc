export type AgentType =
  | "scribe"
  | "strategist"
  | "inspector"
  | "researcher"
  | "reviewer"
  | "custom";

export type AgentProvider =
  | "ghostwriters"
  | "paperclip"
  | "openclaw"
  | "custom";

export const AGENT_PERMISSION_GROUPS = [
  {
    key: "drafts",
    label: "Drafts",
    permissions: ["drafts:read", "drafts:write"] as const,
  },
  {
    key: "comments",
    label: "Comments",
    permissions: ["comments:read", "comments:write"] as const,
  },
  {
    key: "reviews",
    label: "Reviews",
    permissions: ["reviews:read", "reviews:write"] as const,
  },
  {
    key: "pillars",
    label: "Pillars",
    permissions: ["pillars:read", "pillars:write"] as const,
  },
  {
    key: "research",
    label: "Research",
    permissions: ["research:read", "research:write"] as const,
  },
  {
    key: "strategy",
    label: "Strategy",
    permissions: ["strategy:read", "strategy:write"] as const,
  },
] as const;

export const ALL_AGENT_PERMISSIONS = AGENT_PERMISSION_GROUPS.flatMap((group) =>
  [...group.permissions]
);

export const AGENT_TYPE_OPTIONS: Array<{
  value: AgentType;
  label: string;
  description: string;
}> = [
  {
    value: "scribe",
    label: "Scribe",
    description: "Drafting + editing for post creation and iteration.",
  },
  {
    value: "strategist",
    label: "Strategist",
    description: "Planning + structure across pillars, briefs, and strategy docs.",
  },
  {
    value: "inspector",
    label: "Inspector",
    description: "Quality assurance + review decisions for post workflows.",
  },
  {
    value: "researcher",
    label: "Researcher",
    description: "Reads and compiles research material for downstream agents.",
  },
  {
    value: "reviewer",
    label: "Reviewer",
    description: "Specialized review agent with narrower approval access.",
  },
  {
    value: "custom",
    label: "Custom",
    description: "Custom commissioned agent identity for external runners.",
  },
];

export const AGENT_PROVIDER_OPTIONS: Array<{
  value: AgentProvider;
  label: string;
}> = [
  { value: "paperclip", label: "Paperclip" },
  { value: "openclaw", label: "OpenClaw" },
  { value: "ghostwriters", label: "Ghostwriters" },
  { value: "custom", label: "Custom" },
];

export const AGENT_PERMISSION_PRESETS: Record<string, string[]> = {
  writer: ["drafts:read", "drafts:write", "comments:read", "comments:write"],
  reviewer: ["drafts:read", "comments:read", "reviews:read", "reviews:write"],
  strategist: [
    "drafts:read",
    "comments:read",
    "pillars:read",
    "pillars:write",
    "strategy:read",
    "strategy:write",
  ],
  researcher: ["research:read", "research:write", "strategy:read"],
};

export const DEFAULT_AGENT_PERMISSIONS: Record<AgentType, string[]> = {
  scribe: [...AGENT_PERMISSION_PRESETS.writer],
  strategist: [...AGENT_PERMISSION_PRESETS.strategist],
  inspector: [...AGENT_PERMISSION_PRESETS.reviewer],
  reviewer: [...AGENT_PERMISSION_PRESETS.reviewer],
  researcher: [...AGENT_PERMISSION_PRESETS.researcher],
  custom: [],
};

export function normalizeAgentName(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export function titleizeAgentName(value: string) {
  return value
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

