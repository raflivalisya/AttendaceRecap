import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { CAMPUS_LOCATION } from "@/lib/campus";
import { verifyCheckinTicket } from "@/lib/presensi-ticket";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getAdminSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !serviceKey) throw new Error("Konfigurasi Supabase belum lengkap.");
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function getSecret() {
  const secret = process.env.QR_SIGNING_SECRET;
  if (!secret || secret.length < 24) throw new Error("QR_SIGNING_SECRET belum tersedia atau terlalu pendek.");
  return secret;
}

function hashValue(value: string) {
  return createHash("sha256").update(`${getSecret()}:${value}`).digest("hex");
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const earthRadius = 6_371_000;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
    if (!token || token.length > 256) return json({ success: false, message: "Token presensi tidak valid." }, 400);

    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 8_192) return json({ success: false, message: "Data presensi terlalu besar." }, 413);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ success: false, message: "Data presensi tidak valid." }, 400);

    const npm = String((body as Record<string, unknown>).npm ?? "").trim();
    const deviceId = request.cookies.get("presensi_device_id")?.value ?? "";
    const ticket = request.cookies.get("presensi_checkin_ticket")?.value ?? "";

    if (!ticket) return json({ success: false, message: "Sesi check-in tidak ditemukan. Scan QR terbaru." }, 401);
    if (!deviceId) return json({ success: false, message: "Identitas perangkat tidak tersedia. Scan ulang QR." }, 401);
    if (!/^[A-Za-z0-9._-]{4,32}$/.test(npm)) {
      return json({ success: false, message: "Format NPM tidak valid." }, 400);
    }

    const supabase = getAdminSupabase();
    const { data: session, error: sessionError } = await supabase
      .from("attendance_sessions")
      .select("id,meeting_id,token,starts_at,ends_at,is_active,latitude,longitude,radius_meters,max_accuracy_m,require_location")
      .eq("token", token)
      .maybeSingle();

    if (sessionError || !session) return json({ success: false, message: "Sesi presensi tidak ditemukan." }, 404);
    if (!session.is_active) return json({ success: false, message: "Presensi sudah ditutup." }, 410);

    const now = Date.now();
    const startsAt = new Date(session.starts_at).getTime();
    const endsAt = new Date(session.ends_at).getTime();
    if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt)) return json({ success: false, message: "Konfigurasi waktu sesi tidak valid." }, 500);
    if (now < startsAt) return json({ success: false, message: "Presensi belum dibuka." }, 425);
    if (now >= endsAt) return json({ success: false, message: "Waktu presensi sudah berakhir." }, 410);

    if (!verifyCheckinTicket(session.id, session.token, ticket)) {
      return json({ success: false, message: "Tiket check-in kedaluwarsa. Scan QR terbaru." }, 410);
    }

    const deviceHash = hashValue(`device:${deviceId}`);
    const ip = firstForwardedIp(request);
    const ipHash = ip ? hashValue(`ip:${ip}`) : null;

    // Rate limit persisten: 12 percobaan/perangkat dan 30/IP dalam 2 menit.
    const cutoff = new Date(Date.now() - 2 * 60_000).toISOString();
    const [deviceAttempts, ipAttempts] = await Promise.all([
      supabase
        .from("attendance_checkin_attempts")
        .select("id", { count: "exact", head: true })
        .eq("device_hash", deviceHash)
        .gte("created_at", cutoff),
      ipHash
        ? supabase
            .from("attendance_checkin_attempts")
            .select("id", { count: "exact", head: true })
            .eq("ip_hash", ipHash)
            .gte("created_at", cutoff)
        : Promise.resolve({ count: 0, error: null }),
    ]);

    if ((deviceAttempts.count ?? 0) >= 12 || (ipAttempts.count ?? 0) >= 30) {
      return json({ success: false, message: "Terlalu banyak percobaan presensi. Tunggu sekitar 2 menit lalu coba lagi." }, 429);
    }

    // Best effort; jika migration hardening belum dipasang, alur inti tetap memberi error yang jelas di health check.
    await supabase.from("attendance_checkin_attempts").insert({
      session_id: session.id,
      device_hash: deviceHash,
      ip_hash: ipHash,
    });

    const { data: meeting, error: meetingError } = await supabase
      .from("meetings")
      .select("id,course_id")
      .eq("id", session.meeting_id)
      .maybeSingle();
    if (meetingError || !meeting) return json({ success: false, message: "Data pertemuan tidak ditemukan." }, 404);

    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id,npm,name")
      .eq("course_id", meeting.course_id)
      .eq("npm", npm)
      .maybeSingle();
    if (studentError) throw studentError;
    if (!student) return json({ success: false, message: "NPM tidak terdaftar pada kelas ini." }, 404);

    const { data: existingAttendance } = await supabase
      .from("attendance")
      .select("id,status")
      .eq("meeting_id", meeting.id)
      .eq("student_id", student.id)
      .maybeSingle();
    if (existingAttendance) {
      return json({ success: false, message: `Presensi sudah tercatat dengan status ${existingAttendance.status}.` }, 409);
    }

    const [{ data: existingDevice }, { data: existingStudentCheckin }] = await Promise.all([
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

    if (existingDevice && existingDevice.student_id !== student.id) {
      return json({ success: false, message: "Perangkat ini sudah digunakan mahasiswa lain pada pertemuan ini." }, 409);
    }

    // Bersihkan check-in parsial jika attendance sebelumnya gagal ditulis.
    const staleCheckinIds = new Set<string>();
if (existingDevice && existingDevice.student_id === student.id) {
  staleCheckinIds.add(existingDevice.id);
}
    if (existingStudentCheckin?.id) staleCheckinIds.add(existingStudentCheckin.id);
    if (staleCheckinIds.size) {
      await supabase.from("attendance_checkins").delete().in("id", [...staleCheckinIds]);
    }

    let latitude: number | null = null;
    let longitude: number | null = null;
    let accuracy: number | null = null;
    let distance: number | null = null;

    if (session.require_location) {
      latitude = Number((body as Record<string, unknown>).latitude);
      longitude = Number((body as Record<string, unknown>).longitude);
      accuracy = Number((body as Record<string, unknown>).accuracy);

      if (
        !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
        !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
        !Number.isFinite(accuracy) || accuracy <= 0 || accuracy > 10_000
      ) {
        return json({ success: false, message: "Lokasi GPS tidak valid. Aktifkan lokasi presisi lalu coba lagi." }, 400);
      }

      const maxAccuracy = Number(session.max_accuracy_m || CAMPUS_LOCATION.maxAccuracy);
      if (accuracy > maxAccuracy) {
        return json({
          success: false,
          message: `Akurasi GPS terlalu rendah (±${Math.round(accuracy)} meter). Aktifkan lokasi presisi dan tunggu GPS stabil.`,
        }, 400);
      }

      const centerLat = Number.isFinite(Number(session.latitude)) ? Number(session.latitude) : CAMPUS_LOCATION.latitude;
      const centerLng = Number.isFinite(Number(session.longitude)) ? Number(session.longitude) : CAMPUS_LOCATION.longitude;
      const radius = Number(session.radius_meters || CAMPUS_LOCATION.defaultRadius);
      distance = distanceMeters(centerLat, centerLng, latitude, longitude);

      if (distance > radius) {
        return json({
          success: false,
          message: `Anda berada ${Math.round(distance)} meter dari lokasi presensi. Batas ${radius} meter.`,
        }, 403);
      }
    }

    const userAgent = request.headers.get("user-agent")?.slice(0, 500) ?? null;
    const { error: checkinError } = await supabase.from("attendance_checkins").insert({
      session_id: session.id,
      meeting_id: meeting.id,
      student_id: student.id,
      device_hash: deviceHash,
      ip_hash: ipHash,
      latitude,
      longitude,
      accuracy_m: accuracy,
      distance_m: distance,
      user_agent: userAgent,
    });

    if (checkinError) {
      if (checkinError.code === "23505") {
        return json({ success: false, message: "Mahasiswa atau perangkat sudah digunakan untuk presensi." }, 409);
      }
      throw checkinError;
    }

    const { error: attendanceError } = await supabase.from("attendance").insert({
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
        return json({ success: false, message: "Presensi mahasiswa sudah tercatat." }, 409);
      }
      throw attendanceError;
    }

    const response = json({
      success: true,
      message: "Presensi berhasil. Anda tercatat Hadir.",
      student: { npm: student.npm, name: student.name },
      distance: distance === null ? null : Math.round(distance),
      accuracy: accuracy === null ? null : Math.round(accuracy),
    });

    response.cookies.set("presensi_checkin_ticket", "", {
      httpOnly: true,
      secure: request.nextUrl.protocol === "https:" || process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    // Cleanup best-effort agar tabel rate-limit tidak tumbuh tanpa batas.
    await supabase
      .from("attendance_checkin_attempts")
      .delete()
      .lt("created_at", new Date(Date.now() - 24 * 60 * 60_000).toISOString());

    return response;
  } catch (error) {
    console.error("POST PRESENSI ERROR:", error);
    return json({ success: false, message: "Terjadi kesalahan saat menyimpan presensi. Coba scan ulang QR." }, 500);
  }
}
