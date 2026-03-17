"use client";

import { createClient } from "@/lib/supabase/client";

export async function startLinkedInOAuth(nextPath = "/dashboard") {
  const supabase = createClient();
  const redirectUrl = new URL("/auth/callback", window.location.origin);
  redirectUrl.searchParams.set("next", nextPath);

  await supabase.auth.signInWithOAuth({
    provider: "linkedin_oidc",
    options: {
      scopes: "openid profile email w_member_social",
      redirectTo: redirectUrl.toString(),
    },
  });
}
