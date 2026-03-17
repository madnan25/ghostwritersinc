import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AgentKeysTable } from "./_components/agent-keys-table";

export default async function AgentSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || !["owner", "admin"].includes(profile.role)) {
    redirect("/settings");
  }

  const admin = createAdminClient();
  const { data: agentKeys } = await admin
    .from("agent_keys")
    .select("id, agent_name, key_prefix, permissions, created_at")
    .eq("organization_id", profile.organization_id)
    .order("created_at", { ascending: true });

  return (
    <div className="container max-w-2xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold">Agent Keys</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Manage API keys for automated agents (Scribe, Strategist, Inspector).
      </p>
      <AgentKeysTable initialKeys={agentKeys ?? []} />
    </div>
  );
}
