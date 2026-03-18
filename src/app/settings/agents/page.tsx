import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrgUser } from "@/lib/server-auth";
import { AgentKeysTable } from "./_components/agent-keys-table";

export default async function AgentSettingsPage() {
  const result = await getCurrentOrgUser();
  if (result.status === "unauthenticated") redirect("/login");
  if (result.status === "profile_missing") {
    return (
      <div className="premium-page max-w-4xl space-y-6">
        <div className="dashboard-frame relative overflow-hidden p-7 sm:p-8">
          <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-[radial-gradient(circle,rgba(145,255,88,0.12)_0%,transparent_70%)] blur-3xl" />
          <p className="premium-kicker">Agent Access</p>
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
  if (
    context.profile.is_active === false ||
    !["owner", "admin"].includes(context.profile.role)
  ) {
    redirect("/settings");
  }

  const admin = createAdminClient();
  const { data: agentKeys } = await admin
    .from("agent_keys")
    .select("id, agent_name, key_prefix, permissions, created_at")
    .eq("organization_id", context.profile.organization_id)
    .order("created_at", { ascending: true });

  return (
    <div className="premium-page max-w-5xl space-y-6">
      <div className="dashboard-frame relative overflow-hidden p-7 sm:p-8">
        <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-[radial-gradient(circle,rgba(145,255,88,0.12)_0%,transparent_70%)] blur-3xl" />
        <p className="premium-kicker">Agent Access</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.055em] text-foreground">
          Agent Keys
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-foreground/68">
          Create org-scoped bearer tokens for Ghostwriters agents like strategist,
          scribe, and inspector. Use them when internal agents call your workspace
          APIs. They are not model-provider credentials.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="dashboard-rail p-5">
            <p className="premium-kicker text-[0.68rem]">How They Work</p>
            <p className="mt-3 text-sm leading-7 text-foreground/66">
              Each key is bound to one workspace and one agent type. The plaintext token
              is revealed once, then stored only as a hash.
            </p>
          </div>
          <div className="dashboard-rail p-5">
            <p className="premium-kicker text-[0.68rem]">What They Are Not</p>
            <p className="mt-3 text-sm leading-7 text-foreground/66">
              These do not connect OpenAI, Anthropic, Paperclip, OpenClaw, or any other
              external provider. They only authenticate inbound Ghostwriters agent calls.
            </p>
          </div>
        </div>
      </div>
      <div className="dashboard-frame p-6 sm:p-8">
        <AgentKeysTable initialKeys={agentKeys ?? []} />
      </div>
    </div>
  );
}
