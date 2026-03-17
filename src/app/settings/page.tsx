import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./_components/settings-form";

export default async function SettingsPage() {
  // Auth handled by middleware; user needed for profile query
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  const settings = (profile.settings ?? {}) as Record<string, unknown>;
  const linkedInConnected = !!(profile.linkedin_id && settings.linkedin_access_token_encrypted);
  const linkedInExpiresAt = settings.linkedin_token_expires_at as string | null | undefined;

  const isAdmin = ["owner", "admin"].includes(profile.role);
  const isOwner = profile.role === "owner";

  return (
    <div className="container max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Settings</h1>
      <SettingsForm
        name={profile.name}
        email={profile.email}
        avatarUrl={profile.avatar_url}
        timezone={profile.timezone}
        notificationsEnabled={settings.notifications_enabled !== false}
        linkedInConnected={linkedInConnected}
        linkedInExpiresAt={linkedInExpiresAt ?? null}
      />
      {(isAdmin || isOwner) && (
        <div className="mt-8 rounded-xl border border-border bg-card p-5 space-y-3">
          <h2 className="text-sm font-semibold">Admin</h2>
          {isAdmin && (
            <div>
              <p className="mb-1 text-xs text-muted-foreground">
                Manage API keys for automated agents.
              </p>
              <Link
                href="/settings/agents"
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                Manage Agent Keys →
              </Link>
            </div>
          )}
          {isOwner && (
            <div>
              <p className="mb-1 text-xs text-muted-foreground">
                Invite team members and manage user access.
              </p>
              <Link
                href="/settings/users"
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                Manage Users →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
