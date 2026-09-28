import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { verifyCheckinTicket } from "@/lib/presensi-ticket";
import { CAMPUS_LOCATION } from "@/lib/campus";
import PresensiForm from "./presensi-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !serviceKey) throw new Error("Konfigurasi Supabase server belum lengkap.");
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

function ErrorPage({ message }: { message: string }) {
  return (
    <main className="global-state-page">
      <div className="global-state-card">
        <div className="global-state-icon" aria-hidden="true">!</div>
        <h1>Presensi Tidak Tersedia</h1>
        <p>{message}</p>
        <p className="muted">Silakan scan QR terbaru dari layar dosen.</p>
      </div>
    </main>
  );
}

export default async function CheckinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  try {
    const cookieStore = await cookies();
    const ticket = cookieStore.get("presensi_checkin_ticket")?.value ?? "";
    const deviceId = cookieStore.get("presensi_device_id")?.value ?? "";
    if (!ticket) return <ErrorPage message="Tiket presensi tidak ditemukan atau sudah kedaluwarsa." />;
    if (!deviceId) return <ErrorPage message="Identitas perangkat tidak ditemukan. Scan ulang QR." />;

    const supabase = getSupabase();
    const { data: session, error } = await supabase
      .from("attendance_sessions")
      .select("id,token,starts_at,ends_at,is_active,radius_meters,meetings!inner(id,meeting_no,meeting_date,course_id,courses!inner(id,name,class_name,lecturer,schedule))")
      .eq("token", token)
      .maybeSingle();

    if (error || !session) return <ErrorPage message="Sesi presensi tidak ditemukan." />;
    if (!session.is_active) return <ErrorPage message="Presensi sudah ditutup." />;

    const now = Date.now();
    if (now < new Date(session.starts_at).getTime()) return <ErrorPage message="Presensi belum dibuka." />;
    if (now >= new Date(session.ends_at).getTime()) return <ErrorPage message="Waktu presensi sudah berakhir." />;
    if (!verifyCheckinTicket(session.id, session.token, ticket)) {
      return <ErrorPage message="Tiket check-in sudah berakhir. Scan QR terbaru." />;
    }

    const meeting = Array.isArray(session.meetings) ? session.meetings[0] : session.meetings;
    if (!meeting) return <ErrorPage message="Data pertemuan tidak ditemukan." />;
    const rawCourse = (meeting as { courses?: unknown }).courses;
    const course = Array.isArray(rawCourse) ? rawCourse[0] : rawCourse;
    if (!course || typeof course !== "object") return <ErrorPage message="Data kelas tidak ditemukan." />;

    const { data: settingsRows } = await supabase
      .from("system_settings")
      .select("key,value")
      .in("key", ["campus_name", "support_message"]);
    const settingsMap = new Map((settingsRows ?? []).map((row) => {
      const raw = row.value && typeof row.value === "object"
        ? (row.value as { value?: unknown }).value
        : row.value;
      return [row.key, raw] as const;
    }));
    const campusValue = settingsMap.get("campus_name");
    const supportValue = settingsMap.get("support_message");
    const campusName = typeof campusValue === "string" && campusValue.trim() ? campusValue : CAMPUS_LOCATION.name;
    const supportMessage = typeof supportValue === "string" && supportValue.trim()
      ? supportValue
      : "Jika presensi gagal, pastikan GPS aktif, izin lokasi diberikan, dan gunakan QR terbaru.";
    const typedCourse = course as { name: string; class_name: string; lecturer: string; schedule: string };

    return (
      <PresensiForm
        token={token}
        initialInfo={{
          meetingNo: Number((meeting as { meeting_no: number }).meeting_no),
          meetingDate: String((meeting as { meeting_date: string }).meeting_date),
          courseName: String(typedCourse.name),
          className: String(typedCourse.class_name),
          lecturer: String(typedCourse.lecturer),
          schedule: String(typedCourse.schedule || "-"),
          endsAt: String(session.ends_at),
          radiusMeters: Number(session.radius_meters || CAMPUS_LOCATION.defaultRadius),
          campusName,
          supportMessage,
        }}
      />
    );
  } catch (error) {
    console.error("CHECKIN PAGE ERROR:", error);
    return <ErrorPage message="Terjadi kesalahan saat membuka halaman presensi." />;
  }
}
