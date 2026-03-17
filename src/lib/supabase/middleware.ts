import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  try {
    let supabaseResponse = NextResponse.next({
      request,
    });

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return supabaseResponse;
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const publicPaths = ["/login", "/auth/callback", "/", "/onboarding"];
    const isPublicPath = publicPaths.some(
      (path) =>
        request.nextUrl.pathname === path ||
        request.nextUrl.pathname.startsWith("/auth/")
    );
    const isAgentApiPath =
      request.nextUrl.pathname.startsWith("/api/drafts") ||
      request.nextUrl.pathname.startsWith("/api/health");

    if (!user && !isPublicPath && !isAgentApiPath) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    // Onboarding redirect: skip if cookie indicates already onboarded (avoids 2 DB queries per nav)
    const onboardedCookie = request.cookies.get("onboarded");
    if (
      user &&
      !onboardedCookie &&
      !isPublicPath &&
      request.nextUrl.pathname !== "/onboarding" &&
      !request.nextUrl.pathname.startsWith("/api/")
    ) {
      const { data: dbUser } = await supabase
        .from("users")
        .select("organization_id")
        .eq("id", user.id)
        .single();

      if (dbUser) {
        const { data: org } = await supabase
          .from("organizations")
          .select("onboarded_at")
          .eq("id", dbUser.organization_id)
          .single();

        if (org && !org.onboarded_at) {
          const url = request.nextUrl.clone();
          url.pathname = "/onboarding";
          return NextResponse.redirect(url);
        }

        // Org is onboarded — set cookie to skip future checks
        if (org?.onboarded_at) {
          supabaseResponse.cookies.set("onboarded", "1", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60 * 24, // 24h
          });
        }
      }
    }

    // Redirect logged-in users from / to /dashboard
    if (user && request.nextUrl.pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    return supabaseResponse;
  } catch {
    return NextResponse.next();
  }
}
