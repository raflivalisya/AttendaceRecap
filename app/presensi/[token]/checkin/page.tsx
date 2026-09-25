import {
  cookies,
} from "next/headers";

import {
  createClient,
} from "@supabase/supabase-js";

import {
  verifyCheckinTicket,
} from "@/lib/presensi-ticket";

import PresensiForm
  from "./presensi-form";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

export const runtime =
  "nodejs";

type SessionInfo = {
  meetingNo: number;

  meetingDate: string;

  courseName: string;

  className: string;

  lecturer: string;

  schedule: string;

  endsAt: string;

  radiusMeters:
    number;

  campusName:
    string;
};

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

function ErrorPage({
  message,
}: {
  message: string;
}) {
  return (
    <section className="page">
      <div
        className="shell"
        style={{
          width:
            "100%",

          maxWidth:
            600,

          margin:
            "0 auto",
        }}
      >
        <div className="panel">
          <div className="panel-body">
            <h2>
              Presensi Tidak Tersedia
            </h2>

            <p>
              {message}
            </p>

            <p className="muted">
              Scan QR terbaru dari
              layar dosen.
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
  params: Promise<{
    token: string;
  }>;
}) {
  const {
    token,
  } =
    await params;

  try {
    /*
     * Ticket diambil dari
     * HttpOnly cookie.
     */
    const cookieStore =
      await cookies();

    const ticket =
      cookieStore
        .get(
          "presensi_checkin_ticket"
        )
        ?.value ??
      "";

    if (!ticket) {
      return (
        <ErrorPage
          message="Sesi check-in tidak ditemukan. Scan QR terbaru."
        />
      );
    }

    const supabase =
      getAdminSupabase();

    const {
      data,
      error,
    } = await supabase
      .from(
        "attendance_sessions"
      )
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
      .eq(
        "token",
        token
      )
      .maybeSingle();

    if (
      error ||
      !data
    ) {
      return (
        <ErrorPage
          message="Sesi presensi tidak ditemukan."
        />
      );
    }

    if (
      !data.is_active
    ) {
      return (
        <ErrorPage
          message="Presensi sudah ditutup."
        />
      );
    }

    if (
      Date.now() >=
      new Date(
        data.ends_at
      ).getTime()
    ) {
      return (
        <ErrorPage
          message="Waktu presensi sudah berakhir."
        />
      );
    }

    /*
     * Validasi cookie ticket.
     */
    const validTicket =
      verifyCheckinTicket(
        data.id,
        data.token,
        ticket
      );

    if (
      !validTicket
    ) {
      return (
        <ErrorPage
          message="Sesi check-in sudah berakhir. Scan QR terbaru."
        />
      );
    }

    const rawMeeting =
      data.meetings as any;

    const meeting =
      Array.isArray(
        rawMeeting
      )
        ? rawMeeting[0]
        : rawMeeting;

    const rawCourse =
      meeting?.courses;

    const course =
      Array.isArray(
        rawCourse
      )
        ? rawCourse[0]
        : rawCourse;

    if (
      !meeting ||
      !course
    ) {
      return (
        <ErrorPage
          message="Data kelas tidak ditemukan."
        />
      );
    }

    const info:
      SessionInfo = {
        meetingNo:
          Number(
            meeting.meeting_no
          ),

        meetingDate:
          String(
            meeting.meeting_date
          ),

        courseName:
          String(
            course.name
          ),

        className:
          String(
            course.class_name
          ),

        lecturer:
          String(
            course.lecturer
          ),

        schedule:
          String(
            course.schedule ||
              ""
          ),

        endsAt:
          String(
            data.ends_at
          ),

        radiusMeters:
          Number(
            data.radius_meters ||
              250
          ),

        campusName:
          "Universitas Teknokrat Indonesia",
      };

    return (
      <PresensiForm
        token={
          token
        }

        initialInfo={
          info
        }
      />
    );
  } catch (error) {
    console.error(
      "CHECKIN PAGE ERROR:",
      error
    );

    return (
      <ErrorPage
        message="Terjadi kesalahan saat membuka presensi."
      />
    );
  }
}