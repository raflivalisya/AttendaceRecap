import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { verifyCheckinTicket } from "@/lib/presensi-ticket";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getAdminSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

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

function getSecret() {
  const secret = process.env.QR_SIGNING_SECRET;

  if (!secret || secret.length < 24) {
    throw new Error("QR_SIGNING_SECRET belum tersedia atau terlalu pendek.");
  }

  return secret;
}

function hashValue(value: string) {
  return createHash("sha256")
    .update(`${getSecret()}:${value}`)
    .digest("hex");
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function htmlResult(token: string, data: any, status = 200) {
  const success = Boolean(data?.success);
  const title = success ? "Presensi Berhasil" : "Presensi Gagal";

  const message = escapeHtml(
    data?.message ||
      (success ? "Presensi berhasil." : "Presensi gagal."),
  );

  const name = data?.student?.name
    ? `<p class="name">${escapeHtml(data.student.name)}</p>`
    : "";

  const retry = success
    ? ""
    : `<a class="button" href="/presensi/${encodeURIComponent(
        token,
      )}/checkin">Kembali & Coba Lagi</a>`;

  const body = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${title}</title>
<style>
*{box-sizing:border-box}
body{
  margin:0;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  background:#f5f7fb;
  color:#172033;
  min-height:100vh;
  display:grid;
  place-items:center;
  padding:24px
}
.card{
  width:min(100%,480px);
  background:#fff;
  border:1px solid #e5e9f2;
  border-radius:20px;
  padding:28px;
  box-shadow:0 14px 40px rgba(20,35,70,.08);
  text-align:center
}
.icon{
  width:64px;
  height:64px;
  border-radius:50%;
  display:grid;
  place-items:center;
  margin:0 auto 18px;
  font-size:32px;
  font-weight:700;
  background:${success ? "#e9f8ef" : "#fff1f0"};
  color:${success ? "#16834b" : "#c7372f"}
}
h1{
  font-size:24px;
  margin:0 0 10px
}
p{
  line-height:1.55;
  margin:8px 0;
  color:#5c6577
}
.name{
  font-weight:700;
  color:#172033
}
.button{
  display:block;
  margin-top:22px;
  padding:14px 18px;
  background:#172033;
  color:#fff;
  text-decoration:none;
  border-radius:12px;
  font-weight:700
}
.hint{
  font-size:13px;
  margin-top:18px
}
</style>
</head>

<body>
<main class="card">
  <div class="icon">${success ? "✓" : "!"}</div>
  <h1>${title}</h1>
  ${name}
  <p>${message}</p>
  ${retry}
  <p class="hint">
    ${
      success
        ? "Anda dapat menutup halaman ini."
        : "Jika sesi sudah berakhir, scan QR terbaru."
    }
  </p>
</main>
</body>
</html>`;

  return new NextResponse(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function firstForwardedIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    ""
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;

    if (!token || token.length > 256) {
      return json(
        {
          success: false,
          message: "Token presensi tidak valid.",
        },
        400,
      );
    }

    const contentType = request.headers.get("content-type") || "";

    const isNativeForm =
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data");

    const reply = (data: unknown, status = 200) =>
      isNativeForm
        ? htmlResult(token, data, status)
        : json(data, status);

    const contentLength = Number(
      request.headers.get("content-length") || 0,
    );

    if (contentLength > 8192) {
      return reply(
        {
          success: false,
          message: "Data presensi terlalu besar.",
        },
        413,
      );
    }

    let body: Record<string, unknown> | null = null;

    if (isNativeForm) {
      const form = await request.formData().catch(() => null);

      body = form
        ? {
            npm: form.get("npm"),
          }
        : null;
    } else {
      const parsed = await request.json().catch(() => null);

      body =
        parsed && typeof parsed === "object"
          ? (parsed as Record<string, unknown>)
          : null;
    }

    if (!body) {
      return reply(
        {
          success: false,
          message: "Data presensi tidak valid.",
        },
        400,
      );
    }

    const npm = String(body.npm ?? "").trim();

    const deviceId =
      request.cookies.get("presensi_device_id")?.value ?? "";

    const ticket =
      request.cookies.get("presensi_checkin_ticket")?.value ?? "";

    if (!ticket) {
      return reply(
        {
          success: false,
          message:
            "Sesi check-in tidak ditemukan. Scan QR terbaru.",
        },
        401,
      );
    }

    if (!deviceId) {
      return reply(
        {
          success: false,
          message:
            "Identitas perangkat tidak tersedia. Scan ulang QR.",
        },
        401,
      );
    }

    if (!/^[A-Za-z0-9._-]{4,32}$/.test(npm)) {
      return reply(
        {
          success: false,
          message: "Format NPM tidak valid.",
        },
        400,
      );
    }

    const supabase = getAdminSupabase();

    const { data: session, error: sessionError } =
      await supabase
        .from("attendance_sessions")
        .select(
          "id,meeting_id,token,starts_at,ends_at,is_active",
        )
        .eq("token", token)
        .maybeSingle();

    if (sessionError || !session) {
      return reply(
        {
          success: false,
          message: "Sesi presensi tidak ditemukan.",
        },
        404,
      );
    }

    if (!session.is_active) {
      return reply(
        {
          success: false,
          message: "Presensi sudah ditutup.",
        },
        410,
      );
    }

    const now = Date.now();
    const startsAt = new Date(session.starts_at).getTime();
    const endsAt = new Date(session.ends_at).getTime();

    if (
      !Number.isFinite(startsAt) ||
      !Number.isFinite(endsAt)
    ) {
      return reply(
        {
          success: false,
          message: "Konfigurasi waktu sesi tidak valid.",
        },
        500,
      );
    }

    if (now < startsAt) {
      return reply(
        {
          success: false,
          message: "Presensi belum dibuka.",
        },
        425,
      );
    }

    if (now >= endsAt) {
      return reply(
        {
          success: false,
          message: "Waktu presensi sudah berakhir.",
        },
        410,
      );
    }

    if (
      !verifyCheckinTicket(
        session.id,
        session.token,
        ticket,
      )
    ) {
      return reply(
        {
          success: false,
          message:
            "Tiket check-in kedaluwarsa. Scan QR terbaru.",
        },
        410,
      );
    }

    const deviceHash = hashValue(`device:${deviceId}`);

    const ip = firstForwardedIp(request);

    const ipHash = ip
      ? hashValue(`ip:${ip}`)
      : null;

    const cutoff = new Date(
      Date.now() - 2 * 60_000,
    ).toISOString();

    const [deviceAttempts, ipAttempts] =
      await Promise.all([
        supabase
          .from("attendance_checkin_attempts")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq("device_hash", deviceHash)
          .gte("created_at", cutoff),

        ipHash
          ? supabase
              .from("attendance_checkin_attempts")
              .select("id", {
                count: "exact",
                head: true,
              })
              .eq("ip_hash", ipHash)
              .gte("created_at", cutoff)
          : Promise.resolve({
              count: 0,
              error: null,
            }),
      ]);

    if (
      (deviceAttempts.count ?? 0) >= 12 ||
      (ipAttempts.count ?? 0) >= 30
    ) {
      return reply(
        {
          success: false,
          message:
            "Terlalu banyak percobaan presensi. Tunggu sekitar 2 menit lalu coba lagi.",
        },
        429,
      );
    }

    await supabase
      .from("attendance_checkin_attempts")
      .insert({
        session_id: session.id,
        device_hash: deviceHash,
        ip_hash: ipHash,
      });

    const { data: meeting, error: meetingError } =
      await supabase
        .from("meetings")
        .select("id,course_id")
        .eq("id", session.meeting_id)
        .maybeSingle();

    if (meetingError || !meeting) {
      return reply(
        {
          success: false,
          message: "Data pertemuan tidak ditemukan.",
        },
        404,
      );
    }

    const { data: student, error: studentError } =
      await supabase
        .from("students")
        .select("id,npm,name")
        .eq("course_id", meeting.course_id)
        .eq("npm", npm)
        .maybeSingle();

    if (studentError) {
      throw studentError;
    }

    if (!student) {
      return reply(
        {
          success: false,
          message:
            "NPM tidak terdaftar pada kelas ini.",
        },
        404,
      );
    }

    const { data: existingAttendance } =
      await supabase
        .from("attendance")
        .select("id,status")
        .eq("meeting_id", meeting.id)
        .eq("student_id", student.id)
        .maybeSingle();

    if (existingAttendance) {
      return reply(
        {
          success: false,
          message: `Presensi sudah tercatat dengan status ${existingAttendance.status}.`,
        },
        409,
      );
    }

    const [
      { data: existingDevice },
      { data: existingStudentCheckin },
    ] = await Promise.all([
      supabase
        .from("attendance_checkins")
        .select("id,student_id")
        .eq("meeting_id", meeting.id)
        .eq("device_hash", deviceHash)
        .maybeSingle(),

      supabase
        .from("attendance_checkins")
        .select("id,device_hash")
        .eq("meeting_id", meeting.id)
        .eq("student_id", student.id)
        .maybeSingle(),
    ]);

    if (
      existingDevice &&
      existingDevice.student_id !== student.id
    ) {
      return reply(
        {
          success: false,
          message:
            "Perangkat ini sudah digunakan mahasiswa lain pada pertemuan ini.",
        },
        409,
      );
    }

    const staleCheckinIds = new Set<string>();

    if (
      existingDevice &&
      existingDevice.student_id === student.id
    ) {
      staleCheckinIds.add(existingDevice.id);
    }

    if (existingStudentCheckin?.id) {
      staleCheckinIds.add(
        existingStudentCheckin.id,
      );
    }

    if (staleCheckinIds.size) {
      await supabase
        .from("attendance_checkins")
        .delete()
        .in("id", [...staleCheckinIds]);
    }

    const userAgent =
      request.headers
        .get("user-agent")
        ?.slice(0, 500) ?? null;

    const { error: checkinError } =
      await supabase
        .from("attendance_checkins")
        .insert({
          session_id: session.id,
          meeting_id: meeting.id,
          student_id: student.id,
          device_hash: deviceHash,
          ip_hash: ipHash,

          latitude: null,
          longitude: null,
          accuracy_m: null,
          distance_m: null,

          user_agent: userAgent,
        });

    if (checkinError) {
      if (checkinError.code === "23505") {
        return reply(
          {
            success: false,
            message:
              "Mahasiswa atau perangkat sudah digunakan untuk presensi.",
          },
          409,
        );
      }

      throw checkinError;
    }

    const { error: attendanceError } =
      await supabase
        .from("attendance")
        .insert({
          meeting_id: meeting.id,
          student_id: student.id,
          status: "H",
        });

    if (attendanceError) {
      await supabase
        .from("attendance_checkins")
        .delete()
        .eq("meeting_id", meeting.id)
        .eq("student_id", student.id);

      if (attendanceError.code === "23505") {
        return reply(
          {
            success: false,
            message:
              "Presensi mahasiswa sudah tercatat.",
          },
          409,
        );
      }

      throw attendanceError;
    }

    const response = reply({
      success: true,
      message:
        "Presensi berhasil. Anda tercatat Hadir.",
      student: {
        npm: student.npm,
        name: student.name,
      },
    });

    response.cookies.set(
      "presensi_checkin_ticket",
      "",
      {
        httpOnly: true,
        secure:
          request.nextUrl.protocol === "https:" ||
          process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      },
    );

    await supabase
      .from("attendance_checkin_attempts")
      .delete()
      .lt(
        "created_at",
        new Date(
          Date.now() - 24 * 60 * 60_000,
        ).toISOString(),
      );

    return response;
  } catch (error) {
    console.error(
      "POST PRESENSI ERROR:",
      error,
    );

    return json(
      {
        success: false,
        message:
          "Terjadi kesalahan saat menyimpan presensi. Coba scan ulang QR.",
      },
      500,
    );
  }
}