export type AgentScopeMode = "user" | "shared_org";

export function resolveAgentScopeMode({
  allowSharedContext,
  organizationContextSharingEnabled,
}: {
  allowSharedContext: boolean;
  organizationContextSharingEnabled: boolean;
}): AgentScopeMode {
  return allowSharedContext && organizationContextSharingEnabled ? "shared_org" : "user";
}

export function getSharedContextGuardMessage({
  allowSharedContext,
  organizationContextSharingEnabled,
}: {
  allowSharedContext: boolean;
  organizationContextSharingEnabled: boolean;
}) {
  if (!allowSharedContext) {
    return null;
  }

  if (!organizationContextSharingEnabled) {
    return "Turn on Agent context sharing in Settings before enabling shared org context for agents.";
  }

  return null;
}
