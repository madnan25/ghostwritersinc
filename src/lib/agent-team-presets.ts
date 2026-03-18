import type { AgentProvider, AgentType } from "@/lib/agent-permissions";

export interface AgentTeamPresetAgent {
  name: string;
  agent_type: AgentType;
  provider: AgentProvider;
}

export interface AgentTeamPreset {
  key: string;
  label: string;
  description: string;
  agents: AgentTeamPresetAgent[];
}

export const AGENT_TEAM_PRESETS: AgentTeamPreset[] = [
  {
    key: "editorial-core",
    label: "Editorial Core",
    description:
      "A balanced Ghostwriters team for drafting, strategy, and review on behalf of one user.",
    agents: [
      { name: "Brand Writer", agent_type: "scribe", provider: "ghostwriters" },
      { name: "Content Strategist", agent_type: "strategist", provider: "ghostwriters" },
      { name: "Review Inspector", agent_type: "inspector", provider: "ghostwriters" },
    ],
  },
  {
    key: "content-ops",
    label: "Content Ops",
    description:
      "A lighter team focused on drafting plus review for day-to-day publishing operations.",
    agents: [
      { name: "Workflow Writer", agent_type: "scribe", provider: "ghostwriters" },
      { name: "Approval Reviewer", agent_type: "reviewer", provider: "ghostwriters" },
    ],
  },
  {
    key: "strategy-research",
    label: "Strategy + Research",
    description:
      "A planning-heavy team for research gathering, strategic direction, and content structuring.",
    agents: [
      { name: "Research Analyst", agent_type: "researcher", provider: "ghostwriters" },
      { name: "Planning Strategist", agent_type: "strategist", provider: "ghostwriters" },
    ],
  },
];

export const AGENT_TEAM_PRESET_MAP = new Map(
  AGENT_TEAM_PRESETS.map((preset) => [preset.key, preset])
);

export function getAgentTeamPreset(key: string) {
  return AGENT_TEAM_PRESET_MAP.get(key) ?? null;
}
