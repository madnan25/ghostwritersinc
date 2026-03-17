import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrgUser } from "@/lib/server-auth";
import { UsersManagementClient } from "./_components/users-management-client";

export default async function UsersSettingsPage() {
  const context = await getCurrentOrgUser();
  if (!context) redirect("/login");
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
    <div className="container max-w-2xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold">User Management</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Manage team members and pending invitations.
      </p>
      <UsersManagementClient
        currentUserId={context.user.id}
        initialUsers={users ?? []}
        initialInvitations={invitations ?? []}
      />
    </div>
  );
}
