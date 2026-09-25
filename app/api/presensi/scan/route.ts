import {
  createClient,
} from "@supabase/supabase-js";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createCheckinTicket,
  verifyDynamicQr,
} from "@/lib/presensi-ticket";

export const dynamic =
  "force-dynamic";

export const runtime =
  "nodejs";

function getAdminSupabase() {
  const url =
    process.env.SUPABASE_URL ||
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const serviceKey =
    process.env
      .SUPABASE_SERVICE_ROLE_KEY;

  if (
    !url ||
    !serviceKey
  ) {
    throw new Error(
      "Konfigurasi Supabase belum lengkap."
    );
  }

  return createClient(
    url,
    serviceKey,
    {
      auth: {
        persistSession:
          false,

        autoRefreshToken:
          false,
      },
    }
  );
}

function errorRedirect(
  request: NextRequest,
  token: string,
  message: string
) {
  const url =
    new URL(
      `/presensi/${encodeURIComponent(
        token
      )}/error`,
      request.url
    );

  url.searchParams.set(
    "message",
    message
  );

  return NextResponse.redirect(
    url
  );
}

export async function GET(
  request: NextRequest,

  context: {
    params: Promise<{
      token: string;
    }>;
  }
) {
  try {
    const {
      token,
    } =
      await context.params;

    const code =
      request.nextUrl
        .searchParams
        .get("code");

    if (
      !token ||
      !code
    ) {
      return errorRedirect(
        request,
        token,
        "QR tidak valid."
      );
    }

    const supabase =
      getAdminSupabase();

    const {
      data:
        session,

      error,
    } = await supabase
      .from(
        "attendance_sessions"
      )
      .select(
        `
        id,
        token,
        starts_at,
        ends_at,
        is_active
        `
      )
      .eq(
        "token",
        token
      )
      .maybeSingle();

    if (
      error ||
      !session
    ) {
      return errorRedirect(
        request,
        token,
        "Sesi presensi tidak ditemukan."
      );
    }

    if (
      !session.is_active
    ) {
      return errorRedirect(
        request,
        token,
        "Presensi sudah ditutup."
      );
    }

    const now =
      Date.now();

    const start =
      new Date(
        session.starts_at
      ).getTime();

    const end =
      new Date(
        session.ends_at
      ).getTime();

    if (
      now <
      start
    ) {
      return errorRedirect(
        request,
        token,
        "Presensi belum dibuka."
      );
    }

    if (
      now >=
      end
    ) {
      return errorRedirect(
        request,
        token,
        "Waktu presensi sudah berakhir."
      );
    }

    /*
     * Validasi QR dinamis.
     */
    const validQr =
      verifyDynamicQr(
        {
          id:
            session.id,

          token:
            session.token,
        },

        code
      );

    if (
      !validQr
    ) {
      return errorRedirect(
        request,
        token,
        "QR sudah kedaluwarsa. Scan QR terbaru."
      );
    }

    /*
     * Buat ticket stabil.
     */
    const ticket =
      createCheckinTicket(
        session.id,
        session.token,
        session.ends_at
      );

    /*
     * Redirect ke URL tanpa QR.
     */
    const destination =
      new URL(
        `/presensi/${encodeURIComponent(
          token
        )}/checkin`,
        request.url
      );

    const response =
      NextResponse.redirect(
        destination
      );

    /*
     * Ticket disimpan SERVER-SIDE
     * sebagai HttpOnly cookie.
     */
    response.cookies.set(
      "presensi_checkin_ticket",
      ticket,
      {
        httpOnly:
          true,

        secure:
          process.env.NODE_ENV ===
          "production",

        sameSite:
          "lax",

        path:
          "/",

        maxAge:
          5 * 60,
      }
    );

    response.headers.set(
      "Cache-Control",
      "no-store, max-age=0"
    );

    return response;
  } catch (error) {
    console.error(
      "SCAN QR ERROR:",
      error
    );

    return errorRedirect(
      request,
      "",
      "Terjadi kesalahan saat membaca QR."
    );
  }
}