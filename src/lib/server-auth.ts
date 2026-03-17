import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";

const DEFAULT_PROFILE_SELECT = "id, organization_id, role, is_active";

type OrgProfile = {
  id: string;
  organization_id: string;
  role: UserRole;
  is_active?: boolean;
};

export type AuthenticatedOrgUser = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: { id: string };
  profile: OrgProfile;
};

export async function getCurrentOrgUser(
  profileSelect = DEFAULT_PROFILE_SELECT
): Promise<AuthenticatedOrgUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("users")
    .select(profileSelect)
    .eq("id", user.id)
    .single();

  if (!profile) {
    return null;
  }

  return {
    supabase,
    user: { id: user.id },
    profile: profile as unknown as OrgProfile,
  };
}

export async function requireOrgUser(
  allowedRoles?: UserRole[]
): Promise<AuthenticatedOrgUser | NextResponse> {
  const context = await getCurrentOrgUser();

  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (context.profile.is_active === false) {
    return NextResponse.json({ error: "Account disabled" }, { status: 403 });
  }

  if (allowedRoles && !allowedRoles.includes(context.profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return context;
}

export function isAuthenticatedOrgUser(
  result: AuthenticatedOrgUser | NextResponse
): result is AuthenticatedOrgUser {
  return !(result instanceof NextResponse);
}
