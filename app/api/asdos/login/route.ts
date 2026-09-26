import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const username = String(body.username ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!username || !password) return NextResponse.json({ error: "Username dan password wajib diisi." }, { status: 400 });

  const admin = createAdminClient();
  const { data: profile, error: lookupError } = await admin
    .from("assistant_profiles")
    .select("user_id, auth_email, full_name, is_active")
    .ilike("username", username)
    .maybeSingle();

  if (lookupError || !profile || !profile.is_active) return NextResponse.json({ error: "Username atau password tidak valid." }, { status: 401 });

  let response = NextResponse.json({ ok: true, full_name: profile.full_name });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data, error } = await supabase.auth.signInWithPassword({ email: profile.auth_email, password });
  if (error || !data.user || data.user.id !== profile.user_id) return NextResponse.json({ error: "Username atau password tidak valid." }, { status: 401 });
  return response;
}
