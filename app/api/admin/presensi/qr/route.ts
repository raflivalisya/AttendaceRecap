import {
  createHmac,
  randomBytes,
} from "node:crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@/lib/supabase/server";

export const dynamic =
  "force-dynamic";

export const runtime =
  "nodejs";

function getQrSecret() {
  const secret =
    process.env
      .QR_SIGNING_SECRET;

  if (!secret) {
    throw new Error(
      "QR_SIGNING_SECRET belum dikonfigurasi."
    );
  }

  return secret;
}

function signPayload(
  payload: string
) {
  return createHmac(
    "sha256",
    getQrSecret()
  )
    .update(payload)
    .digest("base64url");
}

export async function GET(
  request: NextRequest
) {
  try {
    const sessionId =
      request.nextUrl
        .searchParams
        .get(
          "sessionId"
        );

    if (!sessionId) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            "Session ID tidak tersedia.",
        },
        {
          status:
            400,

          headers: {
            "Cache-Control":
              "no-store, max-age=0",
          },
        }
      );
    }

    const supabase =
      await createClient();

    const {
      data: {
        user,
      },

      error:
        userError,
    } =
      await supabase.auth.getUser();

    if (
      userError ||
      !user
    ) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            "Anda belum login sebagai admin.",
        },
        {
          status:
            401,

          headers: {
            "Cache-Control":
              "no-store, max-age=0",
          },
        }
      );
    }

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
        "id",
        sessionId
      )
      .single();

    if (
      error ||
      !session
    ) {
      console.error(
        "QR SESSION QUERY:",
        error
      );

      return NextResponse.json(
        {
          success:
            false,

          message:
            "Session presensi tidak ditemukan.",
        },
        {
          status:
            404,

          headers: {
            "Cache-Control":
              "no-store, max-age=0",
          },
        }
      );
    }

    if (
      !session.is_active
    ) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            "Presensi sudah ditutup.",
        },
        {
          status:
            410,

          headers: {
            "Cache-Control":
              "no-store, max-age=0",
          },
        }
      );
    }

    const now =
      Date.now();

    const sessionEnd =
      new Date(
        session.ends_at
      ).getTime();

    if (
      !Number.isFinite(
        sessionEnd
      ) ||
      now >=
        sessionEnd
    ) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            "Waktu presensi sudah berakhir.",
        },
        {
          status:
            410,

          headers: {
            "Cache-Control":
              "no-store, max-age=0",
          },
        }
      );
    }

    /*
     * QR berlaku maksimal
     * sekitar 35 detik.
     */
    const issuedAt =
      now;

    const expiresAt =
      Math.min(
        now +
          35_000,

        sessionEnd
      );

    const nonce =
      randomBytes(
        12
      ).toString(
        "hex"
      );

    const payload =
      `${session.id}:` +
      `${session.token}:` +
      `${issuedAt}:` +
      `${expiresAt}:` +
      `${nonce}`;

    const signature =
      signPayload(
        payload
      );

    const code =
      `${issuedAt}.` +
      `${expiresAt}.` +
      `${nonce}.` +
      `${signature}`;

    return NextResponse.json(
      {
        success:
          true,

        code,

        expiresAt,
      },
      {
        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error(
      "DYNAMIC QR API ERROR:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,

        message:
          "Gagal membuat QR dinamis.",
      },
      {
        status:
          500,

        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      }
    );
  }
}