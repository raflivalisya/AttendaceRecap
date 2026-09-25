import { NextRequest, NextResponse } from "next/server";
import { createHmac, randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function getSecret() {
  const secret = process.env.QR_SIGNING_SECRET;

  if (!secret) {
    throw new Error(
      "QR_SIGNING_SECRET belum dikonfigurasi."
    );
  }

  return secret;
}

function sign(value: string) {
  return createHmac(
    "sha256",
    getSecret()
  )
    .update(value)
    .digest("base64url");
}

export async function GET(
  request: NextRequest
) {
  try {
    const sessionId =
      request.nextUrl.searchParams.get(
        "sessionId"
      );

    if (!sessionId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Session ID tidak tersedia.",
        },
        {
          status: 400,
        }
      );
    }

    const supabase =
      await createClient();

    const {
      data: { user },
    } =
      await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda belum login.",
        },
        {
          status: 401,
        }
      );
    }

    const {
      data: session,
      error,
    } = await supabase
      .from("attendance_sessions")
      .select(
        `
        id,
        token,
        starts_at,
        ends_at,
        is_active
        `
      )
      .eq("id", sessionId)
      .single();

    if (error || !session) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Session presensi tidak ditemukan.",
        },
        {
          status: 404,
        }
      );
    }

    if (!session.is_active) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Presensi sudah ditutup.",
        },
        {
          status: 410,
        }
      );
    }

    const now = Date.now();

    const sessionEnd =
      new Date(
        session.ends_at
      ).getTime();

    if (now > sessionEnd) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Waktu presensi sudah berakhir.",
        },
        {
          status: 410,
        }
      );
    }

    const issuedAt = now;

    const expiresAt =
      Math.min(
        now + 35_000,
        sessionEnd
      );

    const nonce =
      randomBytes(12).toString(
        "hex"
      );

    const payload =
      `${session.id}:` +
      `${session.token}:` +
      `${issuedAt}:` +
      `${expiresAt}:` +
      `${nonce}`;

    const signature =
      sign(payload);

    const code =
      `${issuedAt}.` +
      `${expiresAt}.` +
      `${nonce}.` +
      `${signature}`;

    return NextResponse.json({
      success: true,
      code,
      expiresAt,
    });
  } catch (error) {
    console.error(
      "QR generation error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal membuat QR dinamis.",
      },
      {
        status: 500,
      }
    );
  }
}