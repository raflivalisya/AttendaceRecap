import {
  randomUUID,
} from "node:crypto";

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

function getSupabase() {
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

function redirectError(
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
        .get(
          "code"
        );

    if (
      !token ||
      !code
    ) {
      return redirectError(
        request,
        token,
        "QR tidak valid."
      );
    }

    const supabase =
      getSupabase();

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
      return redirectError(
        request,
        token,
        "Sesi presensi tidak ditemukan."
      );
    }

    if (
      !session.is_active
    ) {
      return redirectError(
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
      return redirectError(
        request,
        token,
        "Presensi belum dibuka."
      );
    }

    if (
      now >=
      end
    ) {
      return redirectError(
        request,
        token,
        "Waktu presensi sudah berakhir."
      );
    }

    if (
      !verifyDynamicQr(
        {
          id:
            session.id,

          token:
            session.token,
        },

        code
      )
    ) {
      return redirectError(
        request,
        token,
        "QR sudah kedaluwarsa. Scan QR terbaru."
      );
    }

    /*
     * ======================================
     * CHECKIN TICKET
     * ======================================
     */

    const ticket =
      createCheckinTicket(
        session.id,
        session.token,
        session.ends_at
      );

    /*
     * ======================================
     * DEVICE ID
     *
     * Dibuat server.
     * Tidak menggunakan localStorage Safari.
     * ======================================
     */

    const existingDevice =
      request.cookies
        .get(
          "presensi_device_id"
        )
        ?.value;

    const deviceId =
      existingDevice ||
      randomUUID();

    /*
     * ======================================
     * REDIRECT
     * ======================================
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
     * Ticket 5 menit.
     */
    response.cookies.set(
      "presensi_checkin_ticket",
      ticket,
      {
        httpOnly:
          true,

        secure:
          true,

        sameSite:
          "lax",

        path:
          "/",

        maxAge:
          5 * 60,
      }
    );

    /*
     * Device ID 1 tahun.
     */
    response.cookies.set(
      "presensi_device_id",
      deviceId,
      {
        httpOnly:
          true,

        secure:
          true,

        sameSite:
          "lax",

        path:
          "/",

        maxAge:
          365 *
          24 *
          60 *
          60,
      }
    );

    response.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate"
    );

    return response;
  } catch (error) {
    console.error(
      "SCAN QR ERROR:",
      error
    );

    return redirectError(
      request,
      "",
      "Terjadi kesalahan saat membaca QR."
    );
  }
}