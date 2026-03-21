import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrgUser } from "@/lib/server-auth";
import { CommissionedAgentsConsole } from "./_components/commissioned-agents-console";
import { OrgAdminAgentHiringRequestsClient } from "./_components/org-admin-agent-hiring-requests-client";
import { PlatformAgentHiringRequestsPanel } from "./_components/platform-agent-hiring-requests-panel";

export default async function AgentSettingsPage() {
  const result = await getCurrentOrgUser();
  if (result.status === "unauthenticated") redirect("/login");
  if (result.status === "inactive") redirect("/account-disabled");
  if (result.status === "profile_missing" || result.status === "query_error") {
    return (
      <div className="premium-page max-w-4xl space-y-6">
        <div className="dashboard-frame relative overflow-hidden p-7 sm:p-8">
          <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-[radial-gradient(circle,rgba(145,255,88,0.12)_0%,transparent_70%)] blur-3xl" />
          <p className="premium-kicker">Hiring Agents</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.055em] text-foreground">
            Agent Keys
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-foreground/68">
            Your session is active, but your workspace profile could not be loaded for this
            admin screen.
          </p>
          <Link
            href="/settings"
            className="mt-6 inline-flex text-sm font-medium text-primary transition-colors hover:text-primary/80"
          >
            Back to Settings
          </Link>
        </div>
      </div>
    );
  }

  const { context } = result;
  const isPlatformAdmin = context.profile.is_platform_admin;
  const isOrgAdmin = context.profile.role === "admin";

  if (!isPlatformAdmin && !isOrgAdmin) {
    redirect("/settings");
  }

  if (!isPlatformAdmin) {
    const admin = createAdminClient();
    const [{ data: organization }, { data: users }, { data: requests }] = await Promise.all([
      admin
        .from("organizations")
        .select("context_sharing_enabled")
        .eq("id", context.profile.organization_id)
        .maybeSingle(),
      admin
        .from("users")
        .select("id, name, email")
        .eq("organization_id", context.profile.organization_id)
        .order("created_at", { ascending: true }),
      admin
        .from("agent_hiring_requests")
        .select(
          `
            id,
            requested_for_user_id,
            preset_key,
            requested_shared_context,
            status,
            decision_notes,
            reviewed_at,
            created_at
          `
        )
        .eq("organization_id", context.profile.organization_id)
        .order("created_at", { ascending: false }),
    ]);
    const userNameMap = new Map((users ?? []).map((user) => [user.id, user.name]));

    return (
      <div className="premium-page max-w-5xl space-y-6">
        <div className="dashboard-frame relative overflow-hidden p-7 sm:p-8">
          <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-[radial-gradient(circle,rgba(145,255,88,0.12)_0%,transparent_70%)] blur-3xl" />
          <Link
            href="/settings"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "mb-5 w-fit text-foreground/72 hover:text-foreground"
            )}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Settings
          </Link>
          <p className="premium-kicker">Hiring Agents</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.055em] text-foreground">
            Request Agent Team
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-foreground/68">
            Request a preset Ghostwriters team for specific users in your organization.
            Platform admins will review the request and handle the final provisioning flow.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="dashboard-rail p-5">
              <p className="premium-kicker text-[0.68rem]">Preset Team Model</p>
              <p className="mt-3 text-sm leading-7 text-foreground/66">
                Org admins will be able to choose from Ghostwriters-defined agent presets
                instead of configuring low-level keys or permissions directly.
              </p>
            </div>
            <div className="dashboard-rail p-5">
              <p className="premium-kicker text-[0.68rem]">Approval Flow</p>
              <p className="mt-3 text-sm leading-7 text-foreground/66">
                Each request will be reviewed at the platform layer before the assigned
                users receive the commissioned team.
              </p>
            </div>
          </div>
        </div>
        <div className="dashboard-frame p-6 sm:p-8">
          <OrgAdminAgentHiringRequestsClient
            users={users ?? []}
            organizationContextSharingEnabled={organization?.context_sharing_enabled === true}
            initialRequests={
              requests?.map((request) => ({
                ...request,
                requested_for_user_name:
                  userNameMap.get(request.requested_for_user_id) ?? null,
              })) ?? []
            }
          />
        </div>
      </div>
    );
  }

  const admin = createAdminClient();
  const [
    { data: organizations },
    { data: users },
    { data: agents },
    { data: permissions },
    { data: keys },
    { data: requests },
  ] =
    await Promise.all([
    admin
      .from("organizations")
      .select("id, name, context_sharing_enabled")
      .order("name", { ascending: true }),
    admin
      .from("users")
      .select("id, organization_id, name, email")
      .order("created_at", { ascending: true }),
    admin
      .from("agents")
      .select(
        "id, organization_id, user_id, name, slug, provider, provider_agent_ref, agent_type, job_title, status, allow_shared_context, created_at, last_used_at, last_used_by_route"
      )
      .order("created_at", { ascending: false }),
    admin.from("agent_permissions").select("agent_id, permission"),
    admin
      .from("agent_keys")
      .select("id, agent_id, key_prefix, created_at")
      .not("agent_id", "is", null)
      .order("created_at", { ascending: false }),
    admin
      .from("agent_hiring_requests")
      .select(
        `
          id,
          organization_id,
          requested_by,
          requested_for_user_id,
          preset_key,
          requested_shared_context,
          status,
          decision_notes,
          reviewed_at,
          created_at
        `
      )
      .order("created_at", { ascending: false }),
  ]);

  const permissionsByAgent = new Map<string, string[]>();
  for (const permission of permissions ?? []) {
    const existing = permissionsByAgent.get(permission.agent_id) ?? [];
    existing.push(permission.permission);
    permissionsByAgent.set(permission.agent_id, existing);
  }

  const keysByAgent = new Map<
    string,
    Array<{ id: string; key_prefix: string; created_at: string }>
  >();
  for (const key of keys ?? []) {
    if (!key.agent_id) continue;
    const existing = keysByAgent.get(key.agent_id) ?? [];
    existing.push({
      id: key.id,
      key_prefix: key.key_prefix,
      created_at: key.created_at,
    });
    keysByAgent.set(key.agent_id, existing);
  }

  const initialAgents =
    agents?.map((agent) => ({
      ...agent,
      permissions: permissionsByAgent.get(agent.id) ?? [],
      keys: keysByAgent.get(agent.id) ?? [],
    })) ?? [];
  const organizationSharingById = Object.fromEntries(
    (organizations ?? []).map((organization) => [
      organization.id,
      organization.context_sharing_enabled === true,
    ])
  );
  const organizationMap = new Map((organizations ?? []).map((organization) => [organization.id, organization.name]));
  const userNameMap = new Map((users ?? []).map((user) => [user.id, user.name]));
  const initialRequests =
    requests?.map((request) => ({
      ...request,
      organization_name: organizationMap.get(request.organization_id) ?? null,
      requested_by_name: userNameMap.get(request.requested_by) ?? null,
      requested_for_user_name: userNameMap.get(request.requested_for_user_id) ?? null,
      organization_context_sharing_enabled:
        organizationSharingById[request.organization_id] === true,
    })) ?? [];

  return (
    <div className="premium-page max-w-5xl space-y-6">
      <div className="dashboard-frame relative overflow-hidden p-7 sm:p-8">
        <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-[radial-gradient(circle,rgba(145,255,88,0.12)_0%,transparent_70%)] blur-3xl" />
        <Link
          href="/settings"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "mb-5 w-fit text-foreground/72 hover:text-foreground"
          )}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </Link>
        <p className="premium-kicker">Hiring Agents</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.055em] text-foreground">
          Commissioned Agents
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-foreground/68">
          Commission Paperclip, OpenClaw, or internal Ghostwriters agents against one
          organization and one user, then decide exactly what each agent can read,
          write, review, research, or strategize inside the platform.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="dashboard-rail p-5">
            <p className="premium-kicker text-[0.68rem]">How They Work</p>
            <p className="mt-3 text-sm leading-7 text-foreground/66">
              Each commissioned agent is attached to one organization and one user.
              Keys are credentials for that agent identity, not the identity itself.
            </p>
          </div>
          <div className="dashboard-rail p-5">
            <p className="premium-kicker text-[0.68rem]">Permission Model</p>
            <p className="mt-3 text-sm leading-7 text-foreground/66">
              Permission grants live with the commissioned agent profile. You can start
              from presets, then narrow each agent down to the exact read, write, review,
              research, and strategy actions it needs.
            </p>
          </div>
        </div>
      </div>
      <div className="dashboard-frame p-6 sm:p-8">
        <div className="mb-8">
          <PlatformAgentHiringRequestsPanel initialRequests={initialRequests} />
        </div>
        <CommissionedAgentsConsole
          initialAgents={initialAgents}
          organizations={(organizations ?? []).map((organization) => ({
            id: organization.id,
            name: organization.name,
          }))}
          users={users ?? []}
          organizationSharingById={organizationSharingById}
        />
      </div>
    </div>
  );
}
