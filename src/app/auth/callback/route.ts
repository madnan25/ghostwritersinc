import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { encrypt } from "@/lib/crypto";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

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

      // Check if user exists in our users table
      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("id", user.id)
        .single();

      if (!existingUser) {
        // Auto-create organization and user for new signups
        const name =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split("@")[0] ||
          "User";
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

        const { data: org } = await supabase
          .from("organizations")
          .insert({ name: `${name}'s Workspace`, slug: `${slug}-${Date.now()}` })
          .select("id")
          .single();

        if (org) {
          await supabase.from("users").insert({
            id: user.id,
            organization_id: org.id,
            linkedin_id: user.user_metadata?.sub || null,
            name,
            email: user.email!,
            avatar_url: user.user_metadata?.avatar_url || null,
            role: "owner",
          });
        }
      } else {
        // Update linkedin_id for existing users on every OAuth login
        await supabase
          .from("users")
          .update({ linkedin_id: user.user_metadata?.sub || null })
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
            },
          })
          .eq("id", user.id);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Auth code error — redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
