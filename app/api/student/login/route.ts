import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type CookieToSet = {
  name: string;
  value: string;
  options?: any;
};

function applyCookies(response: NextResponse, cookies: CookieToSet[]) {
  for (const cookie of cookies) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }
  return response;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const npm = String(body.npm ?? "").trim();
    const password = String(body.password ?? "");

    if (!npm || !password) {
      return NextResponse.json(
        { error: "NPM dan password wajib diisi." },
        { status: 400 },
      );
    }

    const admin = createAdminClient();

    const { data: profile, error: profileError } = await admin
      .from("student_portal_profiles")
      .select("user_id, npm, full_name, auth_email, is_active")
      .eq("npm", npm)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    if (!profile) {
      return NextResponse.json(
        { error: "Akun mahasiswa belum dibuat oleh Super Admin." },
        { status: 404 },
      );
    }

    if (!profile.is_active) {
      return NextResponse.json(
        { error: "Akun mahasiswa sedang dinonaktifkan." },
        { status: 403 },
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      return NextResponse.json(
        { error: "Konfigurasi Supabase publik belum lengkap." },
        { status: 500 },
      );
    }

    const pendingCookies: CookieToSet[] = [];

    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          pendingCookies.push(...cookiesToSet);
        },
      },
    });

    const { data: login, error: loginError } =
      await supabase.auth.signInWithPassword({
        email: profile.auth_email,
        password,
      });

    if (loginError || !login.user) {
      return NextResponse.json(
        { error: "NPM atau password tidak valid." },
        { status: 401 },
      );
    }

    if (login.user.id !== profile.user_id) {
      await supabase.auth.signOut();
      const response = NextResponse.json(
        { error: "Akun Auth tidak sesuai dengan profil mahasiswa." },
        { status: 403 },
      );
      return applyCookies(response, pendingCookies);
    }

    const response = NextResponse.json({
      ok: true,
      npm: profile.npm,
      full_name: profile.full_name,
    });

    return applyCookies(response, pendingCookies);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Login mahasiswa gagal.",
      },
      { status: 500 },
    );
  }
}
