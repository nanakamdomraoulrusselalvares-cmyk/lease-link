import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  // Ensure the URL is the base domain without accidental REST or Auth subpaths or trailing slashes
  const supabaseUrl = rawUrl
    .replace(/\/rest\/v1\/?$/, "")
    .replace(/\/auth\/v1\/?$/, "")
    .replace(/\/+$/, "");

  const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();

  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: {
      maxAge: 60 * 60 * 24 * 365, // 1 year persistent session across browser close/reopen
      sameSite: "lax",
      path: "/",
    },
  });
}
