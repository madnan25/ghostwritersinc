import Link from "next/link";
import { redirect } from "next/navigation";
import { OrgAccessLinks } from "./_components/org-access-links";
import { getCurrentOrgUser } from "@/lib/server-auth";
import { PlatformAdminLinks } from "./_components/platform-admin-links";
import { SettingsForm } from "./_components/settings-form";

export default async function SettingsPage() {
  const result = await getCurrentOrgUser(
    "id, organization_id, linkedin_id, name, email, avatar_url, timezone, settings, role, is_active, is_platform_admin"
  );
  if (result.status === "unauthenticated") redirect("/login");
  if (result.status === "inactive") redirect("/account-disabled");
  if (result.status === "profile_missing" || result.status === "query_error") {
    return (
      <div className="premium-page max-w-4xl space-y-6">
        <div className="dashboard-frame relative overflow-hidden p-7 sm:p-8">
          <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-[radial-gradient(circle,rgba(145,255,88,0.12)_0%,transparent_70%)] blur-3xl" />
          <p className="premium-kicker">Workspace Preferences</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.055em] text-foreground">
            Settings
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-foreground/68">
            Your session is active, but your workspace profile could not be loaded for
            this screen.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-flex text-sm font-medium text-primary transition-colors hover:text-primary/80"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const { context } = result;
  const { profile } = context;
  const { data: organization } = await context.supabase
    .from("organizations")
    .select("context_sharing_enabled")
    .eq("id", profile.organization_id)
    .maybeSingle();

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

  const isAdmin = profile.role === "admin";
  const isPlatformAdmin = profile.is_platform_admin;
  const canManageOrgSettings = isAdmin || isPlatformAdmin;
  const canAccessAdminAreas = isAdmin || isPlatformAdmin;

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

          <OrgAccessLinks disabled={!canAccessAdminAreas} />
        </div>
      </div>

      {isPlatformAdmin && (
        <div className="dashboard-frame p-6 sm:p-8">
          <div className="space-y-2">
            <p className="premium-kicker">Platform Admin</p>
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-foreground">
              Platform Controls
            </h2>
            <p className="max-w-3xl text-sm leading-7 text-foreground/66">
              Manage platform-only operations like commissioned agent infrastructure,
              platform-level user access, and internal product references.
            </p>
          </div>
          <div className="mt-6">
            <PlatformAdminLinks />
          </div>
        </div>
      )}

      <div className="dashboard-frame p-6 sm:p-8">
        <SettingsForm
          name={displayName ?? ""}
          email={displayEmail ?? ""}
          avatarUrl={displayAvatarUrl ?? null}
          timezone={profile.timezone ?? "UTC"}
          notificationsEnabled={settings.notifications_enabled !== false}
          linkedInConnected={linkedInConnected}
          linkedInExpiresAt={linkedInExpiresAt ?? null}
          canManageOrgSettings={canManageOrgSettings}
          contextSharingEnabled={organization?.context_sharing_enabled ?? false}
        />
      </div>
    </div>
  );
}
