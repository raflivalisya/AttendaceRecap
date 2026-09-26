import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

function applyCookies(
  response: NextResponse,
  cookiesToSet: CookieToSet[],
) {
  for (const cookie of cookiesToSet) {
    response.cookies.set(
      cookie.name,
      cookie.value,
      cookie.options,
    );
  }

  return response;
}

function normalizeUsername(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request
      .json()
      .catch(() => ({}));

    const username = normalizeUsername(
      body.username,
    );

    const password = String(
      body.password ?? "",
    );

    if (!username || !password) {
      return NextResponse.json(
        {
          error:
            "Username dan password wajib diisi.",
        },
        { status: 400 },
      );
    }

    if (
      !/^[a-z0-9._-]{3,32}$/.test(
        username,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Format username tidak valid.",
        },
        { status: 400 },
      );
    }

    const supabaseUrl =
      process.env
        .NEXT_PUBLIC_SUPABASE_URL;

    const publishableKey =
      process.env
        .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env
        .NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (
      !supabaseUrl ||
      !publishableKey
    ) {
      return NextResponse.json(
        {
          error:
            "Konfigurasi Supabase publik belum lengkap.",
        },
        { status: 500 },
      );
    }

    /*
     * =====================================================
     * 1. Cari auth_email ASLI dari assistant_profiles.
     *
     * Penting karena paket Asdos awal pernah membuat:
     *   username@asdos.invalid
     *
     * sedangkan versi baru membuat:
     *   username@asdos.example.com
     *
     * Login tidak boleh menebak satu domain saja.
     * =====================================================
     */

    let storedProfile:
      | {
          user_id: string;
          username: string;
          auth_email: string;
          full_name: string;
          is_active: boolean;
        }
      | null = null;

    try {
      const admin =
        createAdminClient();

      const {
        data,
        error,
      } = await admin
        .from("assistant_profiles")
        .select(
          "user_id, username, auth_email, full_name, is_active",
        )
        .ilike(
          "username",
          username,
        )
        .maybeSingle();

      if (error) {
        console.error(
          "[ASDOS_LOGIN_PROFILE_LOOKUP]",
          error,
        );
      } else if (data) {
        storedProfile = data;
      }
    } catch (error) {
      /*
       * Localhost mungkin tidak punya
       * SUPABASE_SECRET_KEY.
       * Login tetap diberi fallback di bawah.
       */
      console.warn(
        "[ASDOS_LOGIN_PROFILE_LOOKUP_FALLBACK]",
        error,
      );
    }

    if (
      storedProfile &&
      !storedProfile.is_active
    ) {
      return NextResponse.json(
        {
          error:
            "Akun Asisten Dosen sedang dinonaktifkan. Hubungi Super Admin.",
        },
        { status: 403 },
      );
    }

    /*
     * Kandidat email:
     * 1. auth_email asli DB
     * 2. format baru
     * 3. format lama
     *
     * Set menghindari percobaan duplikat.
     */
    const emailCandidates = Array.from(
      new Set(
        [
          storedProfile?.auth_email,
          `${username}@asdos.example.com`,
          `${username}@asdos.invalid`,
        ].filter(
          (value): value is string =>
            Boolean(value),
        ),
      ),
    );

    const pendingCookies: CookieToSet[] =
      [];

    const supabase =
      createServerClient(
        supabaseUrl,
        publishableKey,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },

            setAll(
              cookiesToSet,
            ) {
              pendingCookies.push(
                ...cookiesToSet,
              );
            },
          },
        },
      );

    /*
     * =====================================================
     * 2. Coba login dengan auth_email yang benar.
     * =====================================================
     */

    let signedInUser:
      | {
          id: string;
        }
      | null = null;

    let lastAuthError = "";

    for (
      const email of emailCandidates
    ) {
      const {
        data,
        error,
      } =
        await supabase.auth.signInWithPassword(
          {
            email,
            password,
          },
        );

      if (
        !error &&
        data.user
      ) {
        signedInUser = {
          id: data.user.id,
        };
        break;
      }

      lastAuthError =
        error?.message ??
        "Invalid login credentials";
    }

    if (!signedInUser) {
      console.warn(
        "[ASDOS_LOGIN_FAILED]",
        {
          username,
          tried:
            emailCandidates,
          authError:
            lastAuthError,
        },
      );

      return NextResponse.json(
        {
          error:
            "Username atau password tidak valid. Jika password baru saja diubah oleh Super Admin, gunakan password terbaru.",
        },
        { status: 401 },
      );
    }

    /*
     * Jika profile berhasil ditemukan dengan
     * service key, user Auth harus sama.
     */
    if (
      storedProfile &&
      storedProfile.user_id !==
        signedInUser.id
    ) {
      await supabase.auth.signOut();

      const response =
        NextResponse.json(
          {
            error:
              "Username terhubung ke akun Auth yang berbeda. Hubungi Super Admin.",
          },
          { status: 403 },
        );

      return applyCookies(
        response,
        pendingCookies,
      );
    }

    /*
     * =====================================================
     * 3. Verifikasi role + profile sesudah autentikasi.
     * Sekarang RLS dapat membaca profil sendiri.
     * =====================================================
     */

    const [
      adminProfileResult,
      assistantProfileResult,
    ] = await Promise.all([
      supabase
        .from("admin_profiles")
        .select(
          "role, display_name",
        )
        .eq(
          "user_id",
          signedInUser.id,
        )
        .maybeSingle(),

      supabase
        .from("assistant_profiles")
        .select(
          "username, full_name, is_active, auth_email",
        )
        .eq(
          "user_id",
          signedInUser.id,
        )
        .maybeSingle(),
    ]);

    if (
      adminProfileResult.error
    ) {
      await supabase.auth.signOut();

      const response =
        NextResponse.json(
          {
            error:
              `Gagal membaca role akun: ${adminProfileResult.error.message}`,
          },
          { status: 500 },
        );

      return applyCookies(
        response,
        pendingCookies,
      );
    }

    if (
      assistantProfileResult.error
    ) {
      await supabase.auth.signOut();

      const response =
        NextResponse.json(
          {
            error:
              `Gagal membaca profil Asdos: ${assistantProfileResult.error.message}`,
          },
          { status: 500 },
        );

      return applyCookies(
        response,
        pendingCookies,
      );
    }

    const adminProfile =
      adminProfileResult.data;

    const assistantProfile =
      assistantProfileResult.data;

    if (
      adminProfile?.role !==
        "assistant" ||
      !assistantProfile
    ) {
      await supabase.auth.signOut();

      const response =
        NextResponse.json(
          {
            error:
              "Akun login bukan akun Asisten Dosen.",
          },
          { status: 403 },
        );

      return applyCookies(
        response,
        pendingCookies,
      );
    }

    if (
      !assistantProfile.is_active
    ) {
      await supabase.auth.signOut();

      const response =
        NextResponse.json(
          {
            error:
              "Akun Asisten Dosen sedang dinonaktifkan.",
          },
          { status: 403 },
        );

      return applyCookies(
        response,
        pendingCookies,
      );
    }

    if (
      String(
        assistantProfile.username,
      )
        .trim()
        .toLowerCase() !==
      username
    ) {
      await supabase.auth.signOut();

      const response =
        NextResponse.json(
          {
            error:
              "Username akun tidak sesuai dengan profil Asdos. Hubungi Super Admin.",
          },
          { status: 403 },
        );

      return applyCookies(
        response,
        pendingCookies,
      );
    }

    /*
     * =====================================================
     * 4. Berhasil.
     * Cookies session hasil signIn dikembalikan ke browser.
     * =====================================================
     */

    const response =
      NextResponse.json({
        ok: true,
        full_name:
          assistantProfile.full_name,
      });

    return applyCookies(
      response,
      pendingCookies,
    );
  } catch (error) {
    console.error(
      "[ASDOS_LOGIN_FATAL]",
      error,
    );

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
