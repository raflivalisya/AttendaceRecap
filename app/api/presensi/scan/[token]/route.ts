
function redirectError(
  request: NextRequest,
  token: string,
  message: string,
) {
  const safeToken = token ? encodeURIComponent(token) : "invalid";
  const url = new URL(`/presensi/${safeToken}/error`, request.url);
  url.searchParams.set("message", message);
  return noCache(NextResponse.redirect(url, 303));
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    const code = request.nextUrl.searchParams.get("code");

    if (!token || !code) {
      return redirectError(request, token, "QR tidak valid.");
    }

    const supabase = getSupabase();

    const { data: session, error } = await supabase
      .from("attendance_sessions")
      .select("id,token,starts_at,ends_at,is_active")
      .eq("token", token)
      .maybeSingle();

    if (error || !session) {
      return redirectError(request, token, "Sesi presensi tidak ditemukan.");
    }

    if (!session.is_active) {
      return redirectError(request, token, "Presensi sudah ditutup.");
    }

    const now = Date.now();
    const start = new Date(session.starts_at).getTime();
    const end = new Date(session.ends_at).getTime();

    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      return redirectError(request, token, "Konfigurasi waktu presensi tidak valid.");
    }

    if (now < start) {
      return redirectError(request, token, "Presensi belum dibuka.");
    }

    if (now >= end) {
      return redirectError(request, token, "Waktu presensi sudah berakhir.");
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
      return redirectError(request, token, "QR sudah kedaluwarsa. Scan QR terbaru.");
    }

    /*
     * PENTING:
     * Route scan TIDAK BOLEH mengecek attendance_checkins atau attendance.
     * Device bukan identitas mahasiswa.
     * Mahasiswa baru boleh dinyatakan sudah presensi SETELAH NPM dikirim
     * dan student_id-nya ditemukan di POST /api/presensi/[token].
     */

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

    // Cookie ini hanya menandai browser/perangkat, bukan mahasiswa.
    const existingDevice = request.cookies.get("presensi_device_id")?.value;
    const deviceId = existingDevice || randomUUID();

    // Selalu arahkan ke form NPM. Tidak ada pengecekan "sudah absen" di sini.
    const destination = new URL(
      `/presensi/${encodeURIComponent(token)}/checkin`,
      request.url,
    );

    // Query unik membantu mencegah Safari menampilkan halaman lama dari cache/back-forward cache.
    destination.searchParams.set("scan", String(Date.now()));

    const response = NextResponse.redirect(destination, 303);

    response.cookies.set("presensi_checkin_ticket", ticket, {
      httpOnly: true,
      secure: request.nextUrl.protocol === "https:" || process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.max(
        1,
        Math.min(ticketMinutes * 60, Math.ceil((end - now) / 1000)),
      ),
    });

    response.cookies.set("presensi_device_id", deviceId, {
      httpOnly: true,
      secure: request.nextUrl.protocol === "https:" || process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 365 * 24 * 60 * 60,
    });

    return noCache(response);
  } catch (error) {
    console.error("SCAN QR ERROR:", error);
    return redirectError(
      request,
      "invalid",
      "Terjadi kesalahan saat membaca QR.",
    );
  }
}
