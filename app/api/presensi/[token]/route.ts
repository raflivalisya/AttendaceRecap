import {
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";

import {
  createClient,
} from "@supabase/supabase-js";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  CAMPUS_LOCATION,
} from "@/lib/campus";

export const dynamic =
  "force-dynamic";

export const runtime =
  "nodejs";

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

function sign(value: string) {
  return createHmac(
    "sha256",
    getSecret()
  )
    .update(value)
    .digest("base64url");
}

/* =====================================================
   COMPARE
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
   HASH
===================================================== */

function hashValue(
  value: string
) {
  return createHash(
    "sha256"
  )
    .update(
      `${getSecret()}:${value}`
    )
    .digest("hex");
}

/* =====================================================
   SUPABASE ADMIN
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
   FIND SESSION
===================================================== */

async function findSession(
  token: string
) {
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
      meeting_id,
      starts_at,
      ends_at,
      is_active,
      radius_meters,
      max_accuracy_m,

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

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const rawMeeting =
    data.meetings as any;

  const meeting =
    Array.isArray(rawMeeting)
      ? rawMeeting[0]
      : rawMeeting;

  if (!meeting) {
    return null;
  }

  const rawCourse =
    meeting.courses;

  const course =
    Array.isArray(rawCourse)
      ? rawCourse[0]
      : rawCourse;

  if (!course) {
    return null;
  }

  return {
    session: data,
    meeting,
    course,
  };
}

/* =====================================================
   SESSION VALIDATION
===================================================== */

function validateSession(
  session: any
) {
  if (!session.is_active) {
    return "Presensi sudah ditutup.";
  }

  const now =
    Date.now();

  const start =
    new Date(
      session.starts_at
    ).getTime();

  const end =
    new Date(
      session.ends_at
    ).getTime();

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end)
  ) {
    return "Waktu sesi tidak valid.";
  }

  if (now < start) {
    return "Presensi belum dibuka.";
  }

  if (now >= end) {
    return "Waktu presensi sudah berakhir.";
  }

  return null;
}

/* =====================================================
   VERIFY QR
===================================================== */

function verifyQrCode(
  session: any,
  code: string
) {
  const parts =
    code.split(".");

  if (
    parts.length !== 4
  ) {
    return false;
  }

  const [
    issuedAtText,
    expiresAtText,
    nonce,
    signature,
  ] = parts;

  const issuedAt =
    Number(issuedAtText);

  const expiresAt =
    Number(expiresAtText);

  if (
    !Number.isFinite(issuedAt) ||
    !Number.isFinite(expiresAt)
  ) {
    return false;
  }

  const now =
    Date.now();

  if (
    now >
    expiresAt
  ) {
    return false;
  }

  if (
    issuedAt >
    now + 10000
  ) {
    return false;
  }

  if (
    expiresAt -
      issuedAt >
    40000
  ) {
    return false;
  }

  const payload =
    `${session.id}:` +
    `${session.token}:` +
    `${issuedAt}:` +
    `${expiresAt}:` +
    `${nonce}`;

  const expected =
    sign(payload);

  return safeCompare(
    signature,
    expected
  );
}

/* =====================================================
   TICKET

   Tidak lagi tergantung deviceId.
===================================================== */

function createTicket(
  session: any
) {
  const expiresAt =
    Date.now() +
    2 * 60 * 1000;

  const random =
    crypto.randomUUID();

  const payload =
    `${session.id}:` +
    `${expiresAt}:` +
    `${random}:ticket`;

  const signature =
    sign(payload);

  return (
    `${expiresAt}.` +
    `${random}.` +
    `${signature}`
  );
}

function verifyTicket(
  session: any,
  ticket: string
) {
  const parts =
    ticket.split(".");

  if (
    parts.length !== 3
  ) {
    return false;
  }

  const [
    expiresText,
    random,
    signature,
  ] = parts;

  const expiresAt =
    Number(
      expiresText
    );

  if (
    !Number.isFinite(
      expiresAt
    )
  ) {
    return false;
  }

  if (
    Date.now() >
    expiresAt
  ) {
    return false;
  }

  const payload =
    `${session.id}:` +
    `${expiresAt}:` +
    `${random}:ticket`;

  const expected =
    sign(payload);

  return safeCompare(
    signature,
    expected
  );
}

/* =====================================================
   DISTANCE
===================================================== */

function toRadians(
  value: number
) {
  return (
    value *
    Math.PI /
    180
  );
}

function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const radius =
    6371000;

  const dLat =
    toRadians(
      lat2 - lat1
    );

  const dLon =
    toRadians(
      lon2 - lon1
    );

  const a =
    Math.sin(
      dLat / 2
    ) ** 2 +
    Math.cos(
      toRadians(lat1)
    ) *
    Math.cos(
      toRadians(lat2)
    ) *
    Math.sin(
      dLon / 2
    ) ** 2;

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return (
    radius * c
  );
}

/* =====================================================
   RESPONSE
===================================================== */

function json(
  data: unknown,
  status = 200
) {
  return NextResponse.json(
    data,
    {
      status,

      headers: {
        "Cache-Control":
          "no-store, max-age=0, must-revalidate",
      },
    }
  );
}

/* =====================================================
   GET - VALIDASI QR
===================================================== */

export async function GET(
  request: NextRequest,

  context: {
    params: Promise<{
      token: string;
    }>;
  }
) {
  try {
    const {
      token,
    } =
      await context.params;

    const code =
      request.nextUrl
        .searchParams
        .get("code");

    if (
      !token ||
      !code
    ) {
      return json(
        {
          success: false,

          message:
            "QR tidak valid. Scan QR terbaru.",
        },
        400
      );
    }

    const result =
      await findSession(
        token
      );

    if (!result) {
      return json(
        {
          success: false,

          message:
            "Sesi presensi tidak ditemukan.",
        },
        404
      );
    }

    const sessionError =
      validateSession(
        result.session
      );

    if (
      sessionError
    ) {
      return json(
        {
          success: false,
          message:
            sessionError,
        },
        410
      );
    }

    if (
      !verifyQrCode(
        result.session,
        code
      )
    ) {
      return json(
        {
          success: false,

          message:
            "QR sudah kedaluwarsa. Scan QR terbaru dari layar dosen.",
        },
        410
      );
    }

    const ticket =
      createTicket(
        result.session
      );

    return json({
      success: true,

      ticket,

      data: {
        meetingNo:
          result.meeting
            .meeting_no,

        meetingDate:
          result.meeting
            .meeting_date,

        courseName:
          result.course
            .name,

        className:
          result.course
            .class_name,

        lecturer:
          result.course
            .lecturer,

        schedule:
          result.course
            .schedule,

        endsAt:
          result.session
            .ends_at,

        radiusMeters:
          Number(
            result.session
              .radius_meters ||
              CAMPUS_LOCATION
                .defaultRadius
          ),

        campusName:
          CAMPUS_LOCATION
            .name,
      },
    });
  } catch (error) {
    console.error(
      "GET PRESENSI ERROR:",
      error
    );

    return json(
      {
        success: false,

        message:
          "Gagal memvalidasi QR.",
      },
      500
    );
  }
}

/* =====================================================
   POST - KIRIM PRESENSI
===================================================== */

export async function POST(
  request: NextRequest,

  context: {
    params: Promise<{
      token: string;
    }>;
  }
) {
  try {
    const {
      token,
    } =
      await context.params;

    const body =
      await request.json();

    const npm =
      String(
        body.npm || ""
      ).trim();

    const deviceId =
      String(
        body.deviceId || ""
      ).trim();

    const ticket =
      String(
        body.ticket || ""
      ).trim();

    if (!npm) {
      return json(
        {
          success: false,
          message:
            "NPM wajib diisi.",
        },
        400
      );
    }

    if (!deviceId) {
      return json(
        {
          success: false,
          message:
            "Identitas perangkat tidak tersedia.",
        },
        400
      );
    }

    if (!ticket) {
      return json(
        {
          success: false,
          message:
            "Ticket presensi tidak tersedia.",
        },
        400
      );
    }

    const result =
      await findSession(
        token
      );

    if (!result) {
      return json(
        {
          success: false,

          message:
            "Session presensi tidak ditemukan.",
        },
        404
      );
    }

    const sessionError =
      validateSession(
        result.session
      );

    if (
      sessionError
    ) {
      return json(
        {
          success: false,

          message:
            sessionError,
        },
        410
      );
    }

    if (
      !verifyTicket(
        result.session,
        ticket
      )
    ) {
      return json(
        {
          success: false,

          message:
            "Waktu pengisian sudah habis. Scan QR kembali.",
        },
        410
      );
    }

    const supabase =
      getAdminSupabase();

    /* -----------------------------
       MAHASISWA
    ----------------------------- */

    const {
      data: student,
      error: studentError,
    } = await supabase
      .from("students")
      .select(
        "id,npm,name,course_id"
      )
      .eq(
        "course_id",
        result.course.id
      )
      .eq(
        "npm",
        npm
      )
      .maybeSingle();

    if (studentError) {
      throw studentError;
    }

    if (!student) {
      return json(
        {
          success: false,

          message:
            "NPM tidak terdaftar pada kelas ini.",
        },
        404
      );
    }

    /* -----------------------------
       SUDAH ABSEN?
    ----------------------------- */

    const {
      data:
        existingAttendance,
    } = await supabase
      .from("attendance")
      .select(
        "id,status"
      )
      .eq(
        "meeting_id",
        result.meeting.id
      )
      .eq(
        "student_id",
        student.id
      )
      .maybeSingle();

    if (
      existingAttendance
    ) {
      return json(
        {
          success: false,

          message:
            `Presensi sudah tercatat dengan status ${existingAttendance.status}.`,
        },
        409
      );
    }

    /* -----------------------------
       DEVICE HASH
    ----------------------------- */

    const deviceHash =
      hashValue(
        `device:${deviceId}`
      );

    const {
      data:
        existingDevice,
    } = await supabase
      .from(
        "attendance_checkins"
      )
      .select(
        "student_id"
      )
      .eq(
        "meeting_id",
        result.meeting.id
      )
      .eq(
        "device_hash",
        deviceHash
      )
      .maybeSingle();

    if (
      existingDevice &&
      existingDevice.student_id !==
        student.id
    ) {
      return json(
        {
          success: false,

          message:
            "Perangkat ini sudah digunakan untuk presensi mahasiswa lain.",
        },
        409
      );
    }

    /* -----------------------------
       GPS
    ----------------------------- */

    const latitude =
      Number(
        body.latitude
      );

    const longitude =
      Number(
        body.longitude
      );

    const accuracy =
      Number(
        body.accuracy
      );

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      !Number.isFinite(accuracy)
    ) {
      return json(
        {
          success: false,

          message:
            "Lokasi GPS tidak valid.",
        },
        400
      );
    }

    const maxAccuracy =
      Number(
        result.session
          .max_accuracy_m ||
          CAMPUS_LOCATION
            .maxAccuracy
      );

    if (
      accuracy >
      maxAccuracy
    ) {
      return json(
        {
          success: false,

          message:
            `Akurasi GPS terlalu rendah (±${Math.round(
              accuracy
            )} meter). Aktifkan Precise Location lalu coba kembali.`,
        },
        400
      );
    }

    const maxDistance =
      Number(
        result.session
          .radius_meters ||
          CAMPUS_LOCATION
            .defaultRadius
      );

    const distance =
      distanceMeters(
        CAMPUS_LOCATION.latitude,
        CAMPUS_LOCATION.longitude,
        latitude,
        longitude
      );

    if (
      distance >
      maxDistance
    ) {
      return json(
        {
          success: false,

          message:
            `Anda berada ${Math.round(
              distance
            )} meter dari titik kampus. Batas presensi ${maxDistance} meter.`,
        },
        403
      );
    }

    /* -----------------------------
       IP HASH
    ----------------------------- */

    const forwarded =
      request.headers.get(
        "x-forwarded-for"
      );

    const ip =
      forwarded
        ?.split(",")[0]
        ?.trim() ||
      request.headers.get(
        "x-real-ip"
      ) ||
      "";

    const ipHash =
      ip
        ? hashValue(
            `ip:${ip}`
          )
        : null;

    const userAgent =
      request.headers.get(
        "user-agent"
      );

    /* -----------------------------
       CHECKIN
    ----------------------------- */

    const {
      error:
        checkinError,
    } = await supabase
      .from(
        "attendance_checkins"
      )
      .insert({
        session_id:
          result.session.id,

        meeting_id:
          result.meeting.id,

        student_id:
          student.id,

        device_hash:
          deviceHash,

        ip_hash:
          ipHash,

        latitude,

        longitude,

        accuracy_m:
          accuracy,

        distance_m:
          distance,

        user_agent:
          userAgent,
      });

    if (
      checkinError
    ) {
      if (
        checkinError.code ===
        "23505"
      ) {
        return json(
          {
            success: false,

            message:
              "Mahasiswa atau perangkat sudah digunakan untuk presensi pada pertemuan ini.",
          },
          409
        );
      }

      throw checkinError;
    }

    /* -----------------------------
       HADIR
    ----------------------------- */

    const {
      error:
        attendanceError,
    } = await supabase
      .from("attendance")
      .insert({
        meeting_id:
          result.meeting.id,

        student_id:
          student.id,

        status:
          "H",
      });

    if (
      attendanceError
    ) {
      /*
       * Hapus checkin jika
       * attendance gagal.
       */
      await supabase
        .from(
          "attendance_checkins"
        )
        .delete()
        .eq(
          "meeting_id",
          result.meeting.id
        )
        .eq(
          "student_id",
          student.id
        );

      throw attendanceError;
    }

    return json({
      success: true,

      message:
        "Presensi berhasil. Anda tercatat Hadir.",

      student: {
        npm:
          student.npm,

        name:
          student.name,
      },

      distance:
        Math.round(
          distance
        ),

      accuracy:
        Math.round(
          accuracy
        ),
    });
  } catch (error) {
    console.error(
      "POST PRESENSI ERROR:",
      error
    );

    return json(
      {
        success: false,

        message:
          "Gagal menyimpan presensi.",
      },
      500
    );
  }
}