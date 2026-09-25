import {
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

import {
  createClient,
} from "@supabase/supabase-js";

import PresensiForm from "./presensi-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type SessionInfo = {
  meetingNo: number;
  meetingDate: string;
  courseName: string;
  className: string;
  lecturer: string;
  schedule: string;
  endsAt: string;
  radiusMeters: number;
  campusName: string;
};

const CAMPUS_NAME =
  "Universitas Teknokrat Indonesia";

/* =====================================================
   SECRET
===================================================== */

function getSecret() {
  const secret =
    process.env.QR_SIGNING_SECRET;

  if (!secret) {
    throw new Error(
      "QR_SIGNING_SECRET belum tersedia."
    );
  }

  return secret;
}

/* =====================================================
   SIGN
===================================================== */

function sign(
  value: string
) {
  return createHmac(
    "sha256",
    getSecret()
  )
    .update(value)
    .digest("base64url");
}

/* =====================================================
   SAFE COMPARE
===================================================== */

function safeCompare(
  first: string,
  second: string
) {
  try {
    const a =
      Buffer.from(first);

    const b =
      Buffer.from(second);

    if (
      a.length !==
      b.length
    ) {
      return false;
    }

    return timingSafeEqual(
      a,
      b
    );
  } catch {
    return false;
  }
}

/* =====================================================
   SUPABASE SERVER
===================================================== */

function getAdminSupabase() {
  const url =
    process.env.SUPABASE_URL ||
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const serviceKey =
    process.env
      .SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error(
      "Supabase URL belum tersedia."
    );
  }

  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY belum tersedia."
    );
  }

  return createClient(
    url,
    serviceKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

/* =====================================================
   VALIDASI QR
===================================================== */

async function validateQr(
  token: string,
  code: string
): Promise<
  | {
      success: true;
      info: SessionInfo;
      ticket: string;
    }
  | {
      success: false;
      message: string;
    }
> {
  try {
    if (
      !token ||
      !code
    ) {
      return {
        success: false,
        message:
          "QR tidak valid. Scan QR terbaru dari layar dosen.",
      };
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
      console.error(
        "SESSION ERROR:",
        error
      );

      return {
        success: false,
        message:
          "Sesi presensi tidak ditemukan.",
      };
    }

    /* ===============================
       SESSION
    =============================== */

    if (
      !data.is_active
    ) {
      return {
        success: false,
        message:
          "Presensi sudah ditutup.",
      };
    }

    const now =
      Date.now();

    const start =
      new Date(
        data.starts_at
      ).getTime();

    const end =
      new Date(
        data.ends_at
      ).getTime();

    if (
      now <
      start
    ) {
      return {
        success: false,
        message:
          "Presensi belum dibuka.",
      };
    }

    if (
      now >=
      end
    ) {
      return {
        success: false,
        message:
          "Waktu presensi sudah berakhir.",
      };
    }

    /* ===============================
       QR CODE
    =============================== */

    const parts =
      code.split(".");

    if (
      parts.length !==
      4
    ) {
      return {
        success: false,
        message:
          "Format QR tidak valid.",
      };
    }

    const [
      issuedAtText,
      expiresAtText,
      nonce,
      signature,
    ] = parts;

    const issuedAt =
      Number(
        issuedAtText
      );

    const expiresAt =
      Number(
        expiresAtText
      );

    if (
      !Number.isFinite(
        issuedAt
      ) ||
      !Number.isFinite(
        expiresAt
      )
    ) {
      return {
        success: false,
        message:
          "QR tidak valid.",
      };
    }

    /*
     * QR expired.
     */
    if (
      now >
      expiresAt
    ) {
      return {
        success: false,
        message:
          "QR sudah kedaluwarsa. Scan QR terbaru.",
      };
    }

    /*
     * QR maksimal ~40 detik.
     */
    if (
      expiresAt -
        issuedAt >
      40_000
    ) {
      return {
        success: false,
        message:
          "QR tidak valid.",
      };
    }

    /*
     * Timestamp tidak boleh
     * terlalu jauh ke depan.
     */
    if (
      issuedAt >
      now + 10_000
    ) {
      return {
        success: false,
        message:
          "QR tidak valid.",
      };
    }

    const payload =
      `${data.id}:` +
      `${data.token}:` +
      `${issuedAt}:` +
      `${expiresAt}:` +
      `${nonce}`;

    const expected =
      sign(payload);

    if (
      !safeCompare(
        signature,
        expected
      )
    ) {
      return {
        success: false,
        message:
          "QR tidak sah. Scan QR terbaru.",
      };
    }

    /* ===============================
       MEETING
    =============================== */

    const rawMeeting =
      data.meetings as any;

    const meeting =
      Array.isArray(
        rawMeeting
      )
        ? rawMeeting[0]
        : rawMeeting;

    if (!meeting) {
      return {
        success: false,
        message:
          "Data pertemuan tidak ditemukan.",
      };
    }

    /* ===============================
       COURSE
    =============================== */

    const rawCourse =
      meeting.courses;

    const course =
      Array.isArray(
        rawCourse
      )
        ? rawCourse[0]
        : rawCourse;

    if (!course) {
      return {
        success: false,
        message:
          "Data kelas tidak ditemukan.",
      };
    }

    /* ===============================
       TICKET

       Berlaku 2 menit setelah
       QR berhasil discan.
    =============================== */

    const ticketExpiresAt =
      Date.now() +
      2 *
        60 *
        1000;

    const random =
      randomUUID();

    const ticketPayload =
      `${data.id}:` +
      `${ticketExpiresAt}:` +
      `${random}:ticket`;

    const ticketSignature =
      sign(
        ticketPayload
      );

    const ticket =
      `${ticketExpiresAt}.` +
      `${random}.` +
      `${ticketSignature}`;

    /* ===============================
       SUCCESS
    =============================== */

    return {
      success: true,

      ticket,

      info: {
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
          CAMPUS_NAME,
      },
    };
  } catch (
    error
  ) {
    console.error(
      "SERVER QR VALIDATION:",
      error
    );

    return {
      success: false,

      message:
        "Terjadi kesalahan saat memvalidasi QR.",
    };
  }
}

/* =====================================================
   ERROR PAGE
===================================================== */

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
              Scan QR terbaru yang sedang
              tampil di layar dosen.
            </p>

          </div>
        </div>
      </div>
    </section>
  );
}

/* =====================================================
   PAGE
===================================================== */

export default async function PresensiPage({
  params,
  searchParams,
}: {
  params: Promise<{
    token: string;
  }>;

  searchParams: Promise<{
    code?:
      | string
      | string[];
  }>;
}) {
  const {
    token,
  } =
    await params;

  const query =
    await searchParams;

  const code =
    Array.isArray(
      query.code
    )
      ? query.code[0]
      : query.code ??
        "";

  const validation =
    await validateQr(
      token,
      code
    );

  if (
    !validation.success
  ) {
    return (
      <ErrorPage
        message={
          validation.message
        }
      />
    );
  }

  return (
    <PresensiForm
      token={
        token
      }

      initialInfo={
        validation.info
      }

      initialTicket={
        validation.ticket
      }
    />
  );
}