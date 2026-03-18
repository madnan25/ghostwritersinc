import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { encrypt } from "@/lib/crypto";
import {
  clearInviteCookie,
  decodeInviteCookie,
  getPendingInvitationByToken,
  INVITE_COOKIE_NAME,
  normalizeInviteEmail,
} from "@/lib/invitations";
import { createAdminClient } from "@/lib/supabase/admin";

function getLinkedInProfile(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}) {
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const email =
    typeof user.email === "string"
      ? user.email
      : typeof metadata.email === "string"
        ? metadata.email
        : null;
  const name =
    typeof metadata.full_name === "string"
      ? metadata.full_name
      : typeof metadata.name === "string"
        ? metadata.name
        : email?.split("@")[0] ?? "User";
  const avatarUrl =
    typeof metadata.avatar_url === "string"
      ? metadata.avatar_url
      : typeof metadata.picture === "string"
        ? metadata.picture
        : null;
  const linkedinId = typeof metadata.sub === "string" ? metadata.sub : null;

  return {
    linkedinId,
    email,
    name,
    avatarUrl,
  };
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/dashboard";
  // Prevent open redirect: only allow relative paths, block protocol-relative URLs
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

  function redirectWithInviteClear(path: string) {
    const response = NextResponse.redirect(`${origin}${path}`);
    clearInviteCookie(response.cookies);
    return response;
  }

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.session) {
      const user = data.session.user;
      const linkedInProfile = getLinkedInProfile(user);
      const inviteCookie = cookieStore.get(INVITE_COOKIE_NAME)?.value;
      const inviteToken = inviteCookie ? decodeInviteCookie(inviteCookie) : null;

      // Check if user exists in our users table
      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("id", user.id)
        .single();

      if (!existingUser) {
        if (!inviteToken) {
          await supabase.auth.signOut();
          return redirectWithInviteClear("/login?error=no_invitation");
        }

        const adminClient = createAdminClient();
        const invitation = await getPendingInvitationByToken(adminClient, inviteToken);

        if (!invitation) {
          await supabase.auth.signOut();
          return redirectWithInviteClear("/login?error=invalid_invitation");
        }

        const normalizedUserEmail = normalizeInviteEmail(user.email ?? "");
        if (!normalizedUserEmail || normalizedUserEmail !== invitation.email) {
          await supabase.auth.signOut();
          return redirectWithInviteClear("/login?error=invite_email_mismatch");
        }

        // Atomically claim the invitation first to prevent double-spend.
        // The `.is("accepted_at", null)` condition ensures only one concurrent
        // request can claim it — the loser gets zero rows updated.
        const acceptedAt = new Date().toISOString();
        const { data: claimed } = await adminClient
          .from("user_invitations")
          .update({ accepted_at: acceptedAt })
          .eq("id", invitation.id)
          .is("accepted_at", null)
          .select("id");

        if (!claimed || claimed.length === 0) {
          // Another request already claimed this token
          await supabase.auth.signOut();
          return redirectWithInviteClear("/login?error=invalid_invitation");
        }

        // Create user in the invitation's org with the invited role
        const { error: insertError } = await adminClient
          .from("users")
          .insert({
            id: user.id,
            organization_id: invitation.organization_id,
            linkedin_id: linkedInProfile.linkedinId,
            name: linkedInProfile.name,
            email: linkedInProfile.email!,
            avatar_url: linkedInProfile.avatarUrl,
            role: invitation.role,
            is_active: true,
          });

        if (insertError) {
          // Rollback invitation claim so it can be retried
          await adminClient
            .from("user_invitations")
            .update({ accepted_at: null })
            .eq("id", invitation.id);
          await supabase.auth.signOut();
          return redirectWithInviteClear("/login?error=auth_callback_failed");
        }
      } else {
        // Keep the stored profile aligned with the connected LinkedIn account.
        await supabase
          .from("users")
          .update({
            linkedin_id: linkedInProfile.linkedinId,
            name: linkedInProfile.name,
            email: linkedInProfile.email,
            avatar_url: linkedInProfile.avatarUrl,
          })
          .eq("id", user.id);
      }

      // Store LinkedIn provider token (encrypted) for posting
      if (data.session.provider_token) {
        const encryptedToken = encrypt(data.session.provider_token);
        // LinkedIn access tokens expire in 60 days
        const expiresAt = new Date(
          Date.now() + 60 * 24 * 60 * 60 * 1000
        ).toISOString();

        // Fetch current settings to merge (avoid overwriting existing settings like notifications_enabled)
        const { data: currentUser } = await supabase
          .from("users")
          .select("settings")
          .eq("id", user.id)
          .single();
        const existingSettings =
          (currentUser?.settings as Record<string, unknown>) || {};

        await supabase
          .from("users")
          .update({
            settings: {
              ...existingSettings,
              linkedin_access_token_encrypted: encryptedToken,
              linkedin_token_updated_at: new Date().toISOString(),
              linkedin_token_expires_at: expiresAt,
              linkedin_profile_email: linkedInProfile.email,
              linkedin_profile_name: linkedInProfile.name,
              linkedin_profile_avatar_url: linkedInProfile.avatarUrl,
            },
          })
          .eq("id", user.id);
      }

      return redirectWithInviteClear(next);
    }
  }

  // Auth code error — redirect to login with error
  return redirectWithInviteClear("/login?error=auth_callback_failed");
}
