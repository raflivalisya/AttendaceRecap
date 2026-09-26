import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function applyCookies(
  response: NextResponse,
  cookiesToSet: Array<{
    name: string;
    value: string;
    options?: Parameters<NextResponse["cookies"]["set"]>[2];
  }>,
) {
  for (const cookie of cookiesToSet) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }
  return response;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const username = String(body.username ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username dan password wajib diisi." },
        { status: 400 },
      );
    }

    if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
      return NextResponse.json(
        { error: "Format username tidak valid." },
        { status: 400 },
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !publishableKey) {
      return NextResponse.json(
        {
          error:
            "Konfigurasi Supabase publik belum lengkap. Periksa NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
        },
        { status: 500 },
      );
    }

    // Akun Asdos yang dibuat oleh Super Admin menggunakan pola email internal ini.
    // Pengguna tetap login dengan username; email ini tidak perlu diketahui pengguna.
    const authEmail = `${username}@asdos.example.com`;

    const pendingCookies: Array<{
      name: string;
      value: string;
      options?: Parameters<NextResponse["cookies"]["set"]>[2];
    }> = [];

    const supabase = createServerClient(supabaseUrl, publishableKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          pendingCookies.push(...cookiesToSet);
        },
      },
    });

    const {
      data: signInData,
      error: signInError,
    } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password,
    });

    if (signInError || !signInData.user) {
      return NextResponse.json(
        { error: "Username atau password tidak valid." },
        { status: 401 },
      );
    }

    const userId = signInData.user.id;

    const [adminProfileResult, assistantProfileResult] = await Promise.all([
      supabase
        .from("admin_profiles")
        .select("role, display_name")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("assistant_profiles")
        .select("username, full_name, is_active")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    if (adminProfileResult.error) {
      await supabase.auth.signOut();
      const response = NextResponse.json(
        {
          error: `Gagal membaca role akun: ${adminProfileResult.error.message}`,
        },
        { status: 500 },
      );
      return applyCookies(response, pendingCookies);
    }

    if (assistantProfileResult.error) {
      await supabase.auth.signOut();
      const response = NextResponse.json(
        {
          error: `Gagal membaca profil Asdos: ${assistantProfileResult.error.message}`,
        },
        { status: 500 },
      );
      return applyCookies(response, pendingCookies);
    }

    const adminProfile = adminProfileResult.data;
    const assistantProfile = assistantProfileResult.data;

    if (
      adminProfile?.role !== "assistant" ||
      !assistantProfile ||
      !assistantProfile.is_active ||
      assistantProfile.username.toLowerCase() !== username
    ) {
      await supabase.auth.signOut();
      const response = NextResponse.json(
        { error: "Akun bukan Asisten Dosen aktif." },
        { status: 403 },
      );
      return applyCookies(response, pendingCookies);
    }

    const response = NextResponse.json({
      ok: true,
      full_name: assistantProfile.full_name,
    });

    return applyCookies(response, pendingCookies);
  } catch (error) {
    console.error("[ASDOS_LOGIN]", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Login Asdos gagal: ${error.message}`
            : "Login Asdos gagal karena error server.",
      },
      { status: 500 },
    );
  }
}
