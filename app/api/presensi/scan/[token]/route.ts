import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  createCheckinTicket,
  verifyDynamicQr,
} from "@/lib/presensi-ticket";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function getSupabase() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY;

  if (!url || !serviceKey) {
    throw new Error("Konfigurasi Supabase belum lengkap.");
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function applyNoCache(response: NextResponse) {
  response.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  );
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set("Surrogate-Control", "no-store");
  return response;
}

function redirectError(
  request: NextRequest,
  token: string,
  message: string,
) {
  const url = new URL(
    `/presensi/${encodeURIComponent(token || "invalid")}/error`,
    request.url,
  );

  url.searchParams.set("message", message);
  url.searchParams.set("_", Date.now().toString());

  return applyNoCache(NextResponse.redirect(url));
}

export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{
      token: string;
    }>;
  },
) {
  try {
    const { token } = await context.params;
    const code = request.nextUrl.searchParams.get("code");

    if (!token || !code) {
      return redirectError(request, token || "", "QR tidak valid.");
    }

    const supabase = getSupabase();

    const { data: session, error } = await supabase
      .from("attendance_sessions")
      .select("id,token,starts_at,ends_at,is_active")
      .eq("token", token)
      .maybeSingle();

    if (error || !session) {
      return redirectError(
        request,
        token,
        "Sesi presensi tidak ditemukan.",
      );
    }

    if (!session.is_active) {
      return redirectError(request, token, "Presensi sudah ditutup.");
    }

    const now = Date.now();
    const start = new Date(session.starts_at).getTime();
    const end = new Date(session.ends_at).getTime();

    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      return redirectError(
        request,
        token,
        "Konfigurasi waktu sesi tidak valid.",
      );
    }

    if (now < start) {
      return redirectError(request, token, "Presensi belum dibuka.");
    }

    if (now >= end) {
      return redirectError(
        request,
        token,
        "Waktu presensi sudah berakhir.",
      );
    }

    if (
      !verifyDynamicQr(
        {
          id: session.id,
          token: session.token,
        },
        code,
      )
    ) {
      return redirectError(
        request,
        token,
        "QR sudah kedaluwarsa. Scan QR terbaru.",
      );
    }

    // Ambil durasi tiket check-in dari system settings.
    let ticketMinutes = 5;

    const { data: ticketSetting } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "checkin_ticket_minutes")
      .maybeSingle();

    const rawTicketMinutes =
      ticketSetting?.value && typeof ticketSetting.value === "object"
        ? (ticketSetting.value as { value?: unknown }).value
        : undefined;

    const parsedTicketMinutes = Number(rawTicketMinutes);

    if (Number.isFinite(parsedTicketMinutes)) {
      ticketMinutes = Math.max(1, Math.min(15, parsedTicketMinutes));
    }

    const ticket = createCheckinTicket(
      session.id,
      session.token,
      session.ends_at,
      ticketMinutes,
    );

    /*
     * DEVICE ID hanya dipakai untuk validasi SETELAH NPM dikirim.
     * Route scan ini TIDAK mengecek attendance_checkins dan TIDAK
     * menyimpulkan mahasiswa sudah presensi hanya berdasarkan device.
     */
    const existingDevice = request.cookies.get("presensi_device_id")?.value;
    const deviceId = existingDevice || randomUUID();

    // Selalu arahkan mahasiswa ke form input NPM setelah QR valid.
    const destination = new URL(
      `/presensi/${encodeURIComponent(token)}/checkin`,
      request.url,
    );

    // Hindari Safari/Vercel menyajikan redirect/form dari cache lama.
    destination.searchParams.set("scan", randomUUID());

    const response = applyNoCache(NextResponse.redirect(destination));

    response.cookies.set("presensi_checkin_ticket", ticket, {
      httpOnly: true,
      secure:
        request.nextUrl.protocol === "https:" ||
        process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.max(
        1,
        Math.min(ticketMinutes * 60, Math.ceil((end - now) / 1000)),
      ),
    });

    response.cookies.set("presensi_device_id", deviceId, {
      httpOnly: true,
      secure:
        request.nextUrl.protocol === "https:" ||
        process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 365 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    console.error("SCAN QR ERROR:", error);

    return redirectError(
      request,
      "",
      "Terjadi kesalahan saat membaca QR.",
    );
  }
}
