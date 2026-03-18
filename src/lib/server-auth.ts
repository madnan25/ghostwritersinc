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

export type CurrentOrgUserResult =
  | { status: "unauthenticated" }
  | { status: "profile_missing"; user: { id: string } }
  | { status: "authenticated"; context: AuthenticatedOrgUser };

export async function getCurrentOrgUser(
  profileSelect = DEFAULT_PROFILE_SELECT
): Promise<CurrentOrgUserResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "unauthenticated" };
  }

  const { data: profile } = await supabase
    .from("users")
    .select(profileSelect)
    .eq("id", user.id)
    .single();

  if (!profile) {
    return {
      status: "profile_missing",
      user: { id: user.id },
    };
  }

  return {
    status: "authenticated",
    context: {
      supabase,
      user: { id: user.id },
      profile: profile as unknown as OrgProfile,
    },
  };
}

export async function requireOrgUser(
  allowedRoles?: UserRole[]
): Promise<AuthenticatedOrgUser | NextResponse> {
  const result = await getCurrentOrgUser();

  if (result.status === "unauthenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (result.status === "profile_missing") {
    return NextResponse.json(
      { error: "Workspace profile not found" },
      { status: 403 }
    );
  }

  const { context } = result;

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
