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

    const publicPaths = ["/login", "/auth/callback", "/", "/onboarding", "/account-disabled"];
    const isPublicPath = publicPaths.some(
      (path) =>
        request.nextUrl.pathname === path ||
        request.nextUrl.pathname.startsWith("/auth/")
    );
    const isApiPath = request.nextUrl.pathname.startsWith("/api/");

    if (!user && !isPublicPath && !isApiPath) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    // Onboarding redirect: skip if cookie indicates already onboarded (avoids DB queries per nav)
    // Cookie value is tied to user ID to prevent trivial forgery
    const onboardedCookie = request.cookies.get("onboarded");
    const cookieValid = onboardedCookie?.value === user?.id;
    if (
      user &&
      !cookieValid &&
      !isPublicPath &&
      request.nextUrl.pathname !== "/onboarding" &&
      !isApiPath
    ) {
      const { data: dbUser, error: dbUserError } = await supabase
        .from("users")
        .select("organization_id, is_active")
        .eq("id", user.id)
        .maybeSingle();

      if (dbUserError) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("error", "profile_load_failed");
        return NextResponse.redirect(url);
      }

      if (!dbUser || dbUser.is_active === false) {
        const url = request.nextUrl.clone();
        url.pathname = "/account-disabled";
        return NextResponse.redirect(url);
      }

      if (dbUser.organization_id) {
        const { data: org, error: orgError } = await supabase
          .from("organizations")
          .select("onboarded_at")
          .eq("id", dbUser.organization_id)
          .maybeSingle();

        if (orgError) {
          // If org onboarding fields are missing from the live schema,
          // don't block valid sign-ins. Skip the onboarding gate instead.
          return supabaseResponse;
        }

        if (org && !org.onboarded_at) {
          const url = request.nextUrl.clone();
          url.pathname = "/onboarding";
          return NextResponse.redirect(url);
        }

        // Org is onboarded — set cookie to skip future checks
        if (org?.onboarded_at) {
          supabaseResponse.cookies.set("onboarded", user.id, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60 * 24, // 24h
          });
        }
      }
    }

    // Redirect logged-in users from / or /login to /dashboard
    if (user && (request.nextUrl.pathname === "/" || request.nextUrl.pathname === "/login") && !isApiPath) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    return supabaseResponse;
  } catch {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Never silently pass through on auth failure — redirect to login
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
}
