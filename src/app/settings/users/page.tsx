import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrgUser } from "@/lib/server-auth";
import { UsersManagementClient } from "./_components/users-management-client";

export default async function UsersSettingsPage() {
  const result = await getCurrentOrgUser();
  if (result.status === "unauthenticated") redirect("/login");
  if (result.status === "inactive") redirect("/account-disabled");
  if (result.status === "profile_missing" || result.status === "query_error") {
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
  const isPlatformAdmin = context.profile.is_platform_admin;
  const isOrgAdmin = context.profile.role === "admin";

  if (!isPlatformAdmin && !isOrgAdmin) {
    redirect("/settings");
  }

  if (!isPlatformAdmin) {
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
          <p className="premium-kicker">Team Access</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.055em] text-foreground">
            Invite Requests
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-foreground/68">
            Org admins will be able to request new user invites for their workspace.
            Platform admins will approve or deny those requests before an invite link is
            issued.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="dashboard-rail p-5">
              <p className="premium-kicker text-[0.68rem]">Org-Level Access</p>
              <p className="mt-3 text-sm leading-7 text-foreground/66">
                Org admins already control context sharing from settings and will also own
                the request path for adding teammates to their workspace.
              </p>
            </div>
            <div className="dashboard-rail p-5">
              <p className="premium-kicker text-[0.68rem]">Approval Model</p>
              <p className="mt-3 text-sm leading-7 text-foreground/66">
                Invite requests should route to platform admins, who can approve or deny
                them before a user receives access.
              </p>
            </div>
          </div>
        </div>
        <div className="dashboard-frame p-6 sm:p-8">
          <div className="space-y-4">
            <p className="premium-kicker text-[0.68rem]">Coming Soon</p>
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-foreground">
              Org-admin invite requests will live here
            </h2>
            <p className="max-w-3xl text-sm leading-7 text-foreground/66">
              This page is reserved for the approval-based invite workflow. Platform admins
              still control the current direct invitation system.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const admin = createAdminClient();
  const [{ data: users }, { data: invitations }] = await Promise.all([
    admin
      .from("users")
      .select("id, name, email, avatar_url, role, is_active, is_platform_admin, created_at")
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
        <p className="premium-kicker">Team Access</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.055em] text-foreground">
          User Management
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-foreground/68">
          Manage platform-level access for the current organization. Org-admin invite
          requests and org-scoped controls should move into a separate approval workflow.
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
