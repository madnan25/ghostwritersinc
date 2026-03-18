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
  const linkedInProfileName = settings.linkedin_profile_name as string | null | undefined;
  const linkedInProfileEmail = settings.linkedin_profile_email as string | null | undefined;
  const linkedInProfileAvatarUrl =
    settings.linkedin_profile_avatar_url as string | null | undefined;
  const displayName = linkedInConnected ? linkedInProfileName ?? profile.name : profile.name;
  const displayEmail = linkedInConnected ? linkedInProfileEmail ?? profile.email : profile.email;
  const displayAvatarUrl = linkedInConnected
    ? linkedInProfileAvatarUrl ?? profile.avatar_url
    : profile.avatar_url;

  const isAdmin = ["owner", "admin"].includes(profile.role);
  const isOwner = profile.role === "owner";

  return (
    <div className="premium-page max-w-6xl space-y-6">
      <div className="dashboard-frame relative overflow-hidden p-7 sm:p-8 lg:p-10">
        <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(145,255,88,0.14)_0%,transparent_70%)] blur-3xl" />
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div>
          <p className="premium-kicker">
            Workspace Preferences
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.055em] text-foreground sm:text-5xl">
            Settings
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-foreground/68 sm:text-base">
            Refine your personal environment, reconnect LinkedIn when needed, and manage who or what can operate inside the workspace.
          </p>
          </div>

          {(isAdmin || isOwner) && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            {isAdmin && (
                <div className="dashboard-rail p-5">
                <p className="premium-kicker text-[0.68rem]">Agent Access</p>
                <p className="mt-3 text-sm leading-7 text-foreground/66">
                  Create and revoke org-scoped bearer keys for Ghostwriters agents like
                  strategist, scribe, and inspector. These keys authenticate calls into
                  your workspace APIs, not model providers.
                </p>
                <Link
                  href="/settings/agents"
                    className="mt-4 inline-flex text-sm font-medium text-primary transition-colors hover:text-primary/80"
                >
                  Manage Agent Keys →
                </Link>
              </div>
            )}
            {isOwner && (
                <div className="dashboard-rail p-5">
                <p className="premium-kicker text-[0.68rem]">Team Access</p>
                <p className="mt-3 text-sm leading-7 text-foreground/66">
                  Invite collaborators, adjust roles, and keep the editorial workspace secure.
                </p>
                <Link
                  href="/settings/users"
                    className="mt-4 inline-flex text-sm font-medium text-primary transition-colors hover:text-primary/80"
                >
                  Manage Users →
                </Link>
              </div>
            )}
          </div>
          )}
        </div>
      </div>

      <div className="dashboard-frame p-6 sm:p-8">
        <SettingsForm
          name={displayName}
          email={displayEmail}
          avatarUrl={displayAvatarUrl}
          timezone={profile.timezone}
          notificationsEnabled={settings.notifications_enabled !== false}
          linkedInConnected={linkedInConnected}
          linkedInExpiresAt={linkedInExpiresAt ?? null}
        />
      </div>
    </div>
  );
}
