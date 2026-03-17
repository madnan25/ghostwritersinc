import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./_components/settings-form";

export default async function SettingsPage() {
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
      {isAdmin && (
        <div className="mt-8 rounded-lg border p-4">
          <h2 className="mb-1 text-sm font-semibold">Admin</h2>
          <p className="mb-3 text-xs text-muted-foreground">
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
    </div>
  );
}
