import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const supabaseUrl = rawUrl
    .replace(/\/rest\/v1\/?$/, "")
    .replace(/\/auth\/v1\/?$/, "")
    .replace(/\/+$/, "");

  const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();

  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes("your-project-ref")) {
    return supabaseResponse;
  }

  // Performance Optimization: Check if any Supabase session cookie exists
  // If user has no auth cookie (e.g. unauthenticated or public routes), return immediately with 0ms latency
  const allCookies = request.cookies.getAll();
  const hasAuthToken = allCookies.some(
    (c) => c.name.startsWith("sb-") && c.name.includes("-auth-token")
  );

  if (!hasAuthToken) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookieOptions: {
        maxAge: 60 * 60 * 24 * 365, // 1 year persistence
        sameSite: "lax",
        path: "/",
      },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, {
              ...options,
              maxAge: 60 * 60 * 24 * 365,
              sameSite: "lax",
              path: "/",
            })
          );
        },
      },
    }
  );

  await supabase.auth.getUser();

  return supabaseResponse;
}
