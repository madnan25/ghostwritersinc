import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrgUser } from "@/lib/server-auth";
import { UsersManagementClient } from "./_components/users-management-client";

export default async function UsersSettingsPage() {
  const result = await getCurrentOrgUser();
  if (result.status === "unauthenticated") redirect("/login");
  if (result.status === "profile_missing") {
    return (
      <div className="premium-page max-w-4xl space-y-6">
        <div className="dashboard-frame relative overflow-hidden p-7 sm:p-8">
          <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-[radial-gradient(circle,rgba(145,255,88,0.12)_0%,transparent_70%)] blur-3xl" />
          <p className="premium-kicker">Team Access</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.055em] text-foreground">
            User Management
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
  if (context.profile.is_active === false || context.profile.role !== "owner") {
    redirect("/settings");
  }

  const admin = createAdminClient();
  const [{ data: users }, { data: invitations }] = await Promise.all([
    admin
      .from("users")
      .select("id, name, email, avatar_url, role, is_active, created_at")
      .eq("organization_id", context.profile.organization_id)
      .order("created_at", { ascending: true }),
    admin
      .from("user_invitations")
      .select("id, email, role, expires_at, created_at")
      .eq("organization_id", context.profile.organization_id)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="premium-page max-w-5xl space-y-6">
      <div className="dashboard-frame relative overflow-hidden p-7 sm:p-8">
        <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-[radial-gradient(circle,rgba(145,255,88,0.12)_0%,transparent_70%)] blur-3xl" />
        <p className="premium-kicker">Team Access</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.055em] text-foreground">
          User Management
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-foreground/68">
          Invite teammates, manage roles, and keep the editorial workspace tightly controlled.
        </p>
      </div>
      <div className="dashboard-frame p-6 sm:p-8">
        <UsersManagementClient
          currentUserId={context.user.id}
          initialUsers={users ?? []}
          initialInvitations={invitations ?? []}
        />
      </div>
    </div>
  );
}
