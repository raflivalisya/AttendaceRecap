import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { verifyCheckinTicket } from "@/lib/presensi-ticket";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function getSupabase() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("SUPABASE URL belum tersedia.");
  }

  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY belum tersedia.");
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function ErrorPage({ message }: { message: string }) {
  return (
    <section className="page">
      <div
        className="shell"
        style={{
          width: "100%",
          maxWidth: 600,
          margin: "0 auto",
        }}
      >
        <div className="panel">
          <div className="panel-body">
            <h2>Presensi Tidak Tersedia</h2>
            <p>{message}</p>
            <p className="muted">
              Silakan scan QR terbaru dari layar dosen.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default async function CheckinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  try {
    const cookieStore = await cookies();

    const ticket =
      cookieStore.get("presensi_checkin_ticket")?.value ?? "";

    const deviceId =
      cookieStore.get("presensi_device_id")?.value ?? "";

    if (!ticket) {
      return (
        <ErrorPage message="Ticket presensi tidak ditemukan. Scan QR terbaru." />
      );
    }

    if (!deviceId) {
      return (
        <ErrorPage message="Identitas perangkat tidak ditemukan. Scan QR terbaru." />
      );
    }

    const supabase = getSupabase();

    const { data, error } = await supabase
      .from("attendance_sessions")
      .select(`
        id,
        token,
        starts_at,
        ends_at,
        is_active,
        radius_meters,
        meetings!inner (
          id,
          meeting_no,
          meeting_date,
          course_id,
          courses!inner (
            id,
            name,
            class_name,
            lecturer,
            schedule
          )
        )
      `)
      .eq("token", token)
      .maybeSingle();

    if (error || !data) {
      console.error("CHECKIN SESSION:", error);
      return <ErrorPage message="Sesi presensi tidak ditemukan." />;
    }

    if (!data.is_active) {
      return <ErrorPage message="Presensi sudah ditutup." />;
    }

    const sessionEnd = new Date(data.ends_at).getTime();

    if (Date.now() >= sessionEnd) {
      return <ErrorPage message="Waktu presensi sudah berakhir." />;
    }

    const validTicket = verifyCheckinTicket(
      data.id,
      data.token,
      ticket,
    );

    if (!validTicket) {
      return (
        <ErrorPage message="Sesi check-in sudah berakhir. Scan QR terbaru." />
      );
    }

    const rawMeeting = data.meetings as any;
    const meeting = Array.isArray(rawMeeting)
      ? rawMeeting[0]
      : rawMeeting;

    if (!meeting) {
      return <ErrorPage message="Data pertemuan tidak ditemukan." />;
    }

    const rawCourse = meeting.courses;
    const course = Array.isArray(rawCourse)
      ? rawCourse[0]
      : rawCourse;

    if (!course) {
      return <ErrorPage message="Data kelas tidak ditemukan." />;
    }

    return (
      <section className="page">
        <div
          className="shell"
          style={{
            width: "100%",
            maxWidth: 600,
            margin: "0 auto",
          }}
        >
          <div className="hero">
            <div>
              <div className="eyebrow">Presensi Mahasiswa</div>

              <h1>{String(course.name)}</h1>

              <p>
                Pertemuan {String(meeting.meeting_no)}
              </p>
            </div>
          </div>

          <div className="panel">
            <div className="panel-body">
              <div
                id="presensi-checkin-root"
                data-token={token}
              >
                <p>
                  <strong>Kelas:</strong>{" "}
                  {String(course.class_name)}
                </p>

                <p>
                  <strong>Dosen:</strong>{" "}
                  {String(course.lecturer)}
                </p>

                <p>
                  <strong>Jadwal:</strong>{" "}
                  {String(course.schedule || "-")}
                </p>

                <div
                  style={{
                    marginTop: 15,
                    marginBottom: 20,
                    padding: 14,
                    background: "#f1f5f9",
                    borderRadius: 10,
                  }}
                >
                  📍 <strong>Universitas Teknokrat Indonesia</strong>
                  <br />
                  GPS wajib
                  <br />
                  Radius maksimal{" "}
                  <strong>
                    {Number(data.radius_meters || 250)} meter
                  </strong>
                </div>

                <div
                  style={{
                    fontSize: 13,
                    marginBottom: 15,
                    padding: 10,
                    borderRadius: 8,
                    background: "#f8fafc",
                  }}
                >
                  Status tombol:{" "}
                  <strong
                    id="presensi-js-status"
                    style={{ color: "#dc2626" }}
                  >
                    Menunggu JavaScript...
                  </strong>
                </div>

                <div className="field">
                  <label htmlFor="npm-presensi">
                    NPM
                  </label>

                  <input
                    id="npm-presensi"
                    type="text"
                    className="input"
                    placeholder="Masukkan NPM"
                    inputMode="numeric"
                    autoComplete="off"
                    style={{
                      fontSize: 16,
                      width: "100%",
                    }}
                  />
                </div>

                <button
                  id="btn-kirim-presensi"
                  type="button"
                  className="btn btn-primary"
                  style={{
                    width: "100%",
                    minHeight: 54,
                    marginTop: 16,
                    fontSize: 16,
                    cursor: "pointer",
                    touchAction: "manipulation",
                    WebkitAppearance: "none",
                  }}
                >
                  Kirim Presensi
                </button>

                <div
                  id="presensi-message"
                  style={{
                    display: "none",
                    marginTop: 16,
                    padding: 12,
                    borderRadius: 8,
                  }}
                />

                <div
                  id="presensi-result"
                  style={{
                    display: "none",
                    marginTop: 16,
                    padding: 16,
                    borderRadius: 10,
                    background: "#dcfce7",
                    color: "#166534",
                  }}
                />

                <noscript>
                  <div
                    style={{
                      marginTop: 16,
                      padding: 12,
                      background: "#fee2e2",
                      color: "#991b1b",
                      borderRadius: 8,
                    }}
                  >
                    JavaScript dinonaktifkan. Aktifkan JavaScript pada browser
                    untuk menggunakan presensi.
                  </div>
                </noscript>
              </div>
            </div>
          </div>
        </div>

        <script
          src="/presensi-checkin-v8.js?v=20260928-8"
          defer
        />
      </section>
    );
  } catch (error) {
    console.error("CHECKIN PAGE ERROR:", error);

    return (
      <ErrorPage message="Terjadi kesalahan saat membuka halaman presensi." />
    );
  }
}
