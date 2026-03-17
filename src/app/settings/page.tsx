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
    <div className="premium-page max-w-6xl">
      <div className="mb-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="premium-panel p-7 sm:p-8">
          <p className="premium-kicker">
            Workspace Preferences
          </p>
          <h1 className="premium-heading mt-4 text-4xl font-semibold tracking-[-0.055em]">
            Settings
          </h1>
          <p className="premium-copy mt-4 max-w-2xl text-sm leading-7 sm:text-base">
            Refine your personal environment, reconnect LinkedIn when needed, and manage who or what can operate inside the workspace.
          </p>
        </div>

        {(isAdmin || isOwner) && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            {isAdmin && (
              <div className="premium-subtle-panel p-5">
                <p className="premium-kicker text-[0.68rem]">Agent Access</p>
                <p className="premium-copy mt-3 text-sm leading-7">
                  Manage API keys for automated agents with tighter control and a cleaner handoff.
                </p>
                <Link
                  href="/settings/agents"
                  className="mt-4 inline-flex text-sm text-primary underline-offset-4 hover:underline"
                >
                  Manage Agent Keys →
                </Link>
              </div>
            )}
            {isOwner && (
              <div className="premium-subtle-panel p-5">
                <p className="premium-kicker text-[0.68rem]">Team Access</p>
                <p className="premium-copy mt-3 text-sm leading-7">
                  Invite collaborators, adjust roles, and keep the editorial workspace secure.
                </p>
                <Link
                  href="/settings/users"
                  className="mt-4 inline-flex text-sm text-primary underline-offset-4 hover:underline"
                >
                  Manage Users →
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="premium-panel p-6 sm:p-8">
        <SettingsForm
          name={profile.name}
          email={profile.email}
          avatarUrl={profile.avatar_url}
          timezone={profile.timezone}
          notificationsEnabled={settings.notifications_enabled !== false}
          linkedInConnected={linkedInConnected}
          linkedInExpiresAt={linkedInExpiresAt ?? null}
        />
      </div>
    </div>
  );
}
