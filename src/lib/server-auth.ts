import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";

const DEFAULT_PROFILE_SELECT =
  "id, organization_id, role, is_active, is_platform_admin";

type OrgProfile = {
  id: string;
  organization_id: string;
  role: UserRole;
  is_active: boolean;
  is_platform_admin: boolean;
  linkedin_id?: string | null;
  name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  timezone?: string | null;
  settings?: Record<string, unknown> | null;
};

export type AuthenticatedOrgUser = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: { id: string };
  profile: OrgProfile;
};

export type CurrentOrgUserResult =
  | { status: "unauthenticated" }
  | { status: "profile_missing"; user: { id: string } }
  | { status: "inactive"; user: { id: string }; profile: OrgProfile }
  | { status: "query_error"; user: { id: string }; message: string }
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

  const { data: profile, error } = await supabase
    .from("users")
    .select(profileSelect)
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return {
      status: "query_error",
      user: { id: user.id },
      message: error.message,
    };
  }

  if (!profile) {
    return {
      status: "profile_missing",
      user: { id: user.id },
    };
  }

  const typedProfile = profile as unknown as OrgProfile;

  if (typedProfile.is_active === false) {
    return {
      status: "inactive",
      user: { id: user.id },
      profile: typedProfile,
    };
  }

  return {
    status: "authenticated",
    context: {
      supabase,
      user: { id: user.id },
      profile: typedProfile,
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

  if (result.status === "query_error") {
    return NextResponse.json(
      { error: "Failed to load workspace profile" },
      { status: 500 }
    );
  }

  if (result.status === "inactive") {
    return NextResponse.json({ error: "Account disabled" }, { status: 403 });
  }

  const { context } = result;

  if (allowedRoles && !allowedRoles.includes(context.profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return context;
}

export async function requirePlatformAdmin(): Promise<AuthenticatedOrgUser | NextResponse> {
  const auth = await requireOrgUser();
  if (!isAuthenticatedOrgUser(auth)) {
    return auth;
  }

  if (!auth.profile.is_platform_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return auth;
}

export function isAuthenticatedOrgUser(
  result: AuthenticatedOrgUser | NextResponse
): result is AuthenticatedOrgUser {
  return !(result instanceof NextResponse);
}
