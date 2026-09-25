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

export const dynamic =
  "force-dynamic";

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

function sign(value: string) {
  return createHmac(
    "sha256",
    getSecret()
  )
    .update(value)
    .digest("base64url");
}

function safeCompare(
  a: string,
  b: string
) {
  const bufferA =
    Buffer.from(a);

  const bufferB =
    Buffer.from(b);

  if (
    bufferA.length !==
    bufferB.length
  ) {
    return false;
  }

  return timingSafeEqual(
    bufferA,
    bufferB
  );
}

function getAdminSupabase() {
  const url =
    process.env.SUPABASE_URL ||
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const serviceKey =
    process.env
      .SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Konfigurasi Supabase server belum lengkap."
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

function hashValue(
  value: string
) {
  return createHash("sha256")
    .update(
      `${getSecret()}:${value}`
    )
    .digest("hex");
}

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
      latitude,
      longitude,
      radius_meters,
      max_accuracy_m,
      require_location,

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

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const meetingRaw =
    data.meetings as any;

  const meeting =
    Array.isArray(
      meetingRaw
    )
      ? meetingRaw[0]
      : meetingRaw;

  const courseRaw =
    meeting?.courses;

  const course =
    Array.isArray(
      courseRaw
    )
      ? courseRaw[0]
      : courseRaw;

  return {
    session: data,
    meeting,
    course,
  };
}

function validateSession(
  session: any
) {
  if (!session.is_active) {
    return "Presensi sudah ditutup.";
  }

  const now = Date.now();

  const start =
    new Date(
      session.starts_at
    ).getTime();

  const end =
    new Date(
      session.ends_at
    ).getTime();

  if (now < start) {
    return "Presensi belum dibuka.";
  }

  if (now > end) {
    return "Waktu presensi sudah berakhir.";
  }

  return null;
}

function verifyQrCode(
  session: any,
  code: string
) {
  const parts =
    code.split(".");

  if (parts.length !== 4) {
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
    !Number.isFinite(
      issuedAt
    ) ||
    !Number.isFinite(
      expiresAt
    )
  ) {
    return false;
  }

  const now = Date.now();

  if (now > expiresAt) {
    return false;
  }

  if (
    expiresAt -
      issuedAt >
    40_000
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

function createTicket(
  session: any,
  deviceHash: string
) {
  /*
   * Setelah QR berhasil discan,
   * mahasiswa diberi waktu 2 menit
   * untuk mengetik NPM.
   */

  const expiresAt =
    Date.now() +
    2 * 60 * 1000;

  const payload =
    `${session.id}:` +
    `${deviceHash}:` +
    `${expiresAt}:ticket`;

  const signature =
    sign(payload);

  return (
    `${expiresAt}.` +
    `${deviceHash}.` +
    `${signature}`
  );
}

function verifyTicket(
  session: any,
  deviceHash: string,
  ticket: string
) {
  const parts =
    ticket.split(".");

  if (parts.length !== 3) {
    return false;
  }

  const [
    expiresText,
    ticketDevice,
    signature,
  ] = parts;

  const expiresAt =
    Number(expiresText);

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

  if (
    ticketDevice !==
    deviceHash
  ) {
    return false;
  }

  const payload =
    `${session.id}:` +
    `${deviceHash}:` +
    `${expiresAt}:ticket`;

  const expected =
    sign(payload);

  return safeCompare(
    signature,
    expected
  );
}

function toRadians(
  value: number
) {
  return (
    value *
    (Math.PI / 180)
  );
}

function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const earthRadius =
    6371000;

  const deltaLat =
    toRadians(
      lat2 - lat1
    );

  const deltaLon =
    toRadians(
      lon2 - lon1
    );

  const a =
    Math.sin(
      deltaLat / 2
    ) ** 2 +
    Math.cos(
      toRadians(lat1)
    ) *
      Math.cos(
        toRadians(lat2)
      ) *
      Math.sin(
        deltaLon / 2
      ) ** 2;

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return (
    earthRadius * c
  );
}

/* ======================================
   VALIDASI QR SETELAH SCAN
====================================== */

export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{
      token: string;
    }>;
  }
) {
  try {
    const { token } =
      await context.params;

    const code =
      request.nextUrl
        .searchParams
        .get("code");

    const deviceId =
      request.nextUrl
        .searchParams
        .get("deviceId");

    if (
      !code ||
      !deviceId
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "QR tidak valid. Silakan scan ulang.",
        },
        {
          status: 400,
        }
      );
    }

    const result =
      await findSession(
        token
      );

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Sesi presensi tidak ditemukan.",
        },
        {
          status: 404,
        }
      );
    }

    const sessionError =
      validateSession(
        result.session
      );

    if (sessionError) {
      return NextResponse.json(
        {
          success: false,
          message:
            sessionError,
        },
        {
          status: 410,
        }
      );
    }

    if (
      !verifyQrCode(
        result.session,
        code
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "QR sudah kedaluwarsa. Silakan scan QR terbaru.",
        },
        {
          status: 410,
        }
      );
    }

    const deviceHash =
      hashValue(
        `device:${deviceId}`
      );

    const ticket =
      createTicket(
        result.session,
        deviceHash
      );

    return NextResponse.json({
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
          result.course.name,

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

        requireLocation:
          result.session
            .require_location,

        radiusMeters:
          result.session
            .radius_meters,
      },
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message:
          "Terjadi kesalahan pada server.",
      },
      {
        status: 500,
      }
    );
  }
}

/* ======================================
   SIMPAN PRESENSI
====================================== */

export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{
      token: string;
    }>;
  }
) {
  try {
    const { token } =
      await context.params;

    const body =
      await request.json();

    const npm =
      String(
        body.npm ?? ""
      ).trim();

    const deviceId =
      String(
        body.deviceId ?? ""
      ).trim();

    const ticket =
      String(
        body.ticket ?? ""
      ).trim();

    if (!npm) {
      return NextResponse.json(
        {
          success: false,
          message:
            "NPM wajib diisi.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !deviceId ||
      !ticket
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Sesi perangkat tidak valid. Scan QR kembali.",
        },
        {
          status: 400,
        }
      );
    }

    const result =
      await findSession(
        token
      );

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Sesi presensi tidak ditemukan.",
        },
        {
          status: 404,
        }
      );
    }

    const sessionError =
      validateSession(
        result.session
      );

    if (sessionError) {
      return NextResponse.json(
        {
          success: false,
          message:
            sessionError,
        },
        {
          status: 410,
        }
      );
    }

    const deviceHash =
      hashValue(
        `device:${deviceId}`
      );

    if (
      !verifyTicket(
        result.session,
        deviceHash,
        ticket
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Waktu pengisian sudah habis. Scan QR kembali.",
        },
        {
          status: 410,
        }
      );
    }

    const supabase =
      getAdminSupabase();

    /* ===========================
       VALIDASI MAHASISWA
    =========================== */

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
      .eq("npm", npm)
      .maybeSingle();

    if (studentError) {
      throw studentError;
    }

    if (!student) {
      return NextResponse.json(
        {
          success: false,
          message:
            "NPM tidak terdaftar di kelas ini.",
        },
        {
          status: 404,
        }
      );
    }

    /* ===========================
       CEK SUDAH ABSEN
    =========================== */

    const {
      data:
        existingAttendance,
    } = await supabase
      .from("attendance")
      .select("id,status")
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
      return NextResponse.json(
        {
          success: false,
          message:
            `Presensi sudah tercatat dengan status ${existingAttendance.status}.`,
        },
        {
          status: 409,
        }
      );
    }

    /* ===========================
       CEK PERANGKAT
    =========================== */

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
      return NextResponse.json(
        {
          success: false,
          message:
            "Perangkat ini sudah digunakan untuk presensi mahasiswa lain pada pertemuan ini.",
        },
        {
          status: 409,
        }
      );
    }

    /* ===========================
       VALIDASI GPS
    =========================== */

    let distance:
      | number
      | null = null;

    let latitude:
      | number
      | null = null;

    let longitude:
      | number
      | null = null;

    let accuracy:
      | number
      | null = null;

    if (
      result.session
        .require_location
    ) {
      latitude =
        Number(
          body.latitude
        );

      longitude =
        Number(
          body.longitude
        );

      accuracy =
        Number(
          body.accuracy
        );

      if (
        !Number.isFinite(
          latitude
        ) ||
        !Number.isFinite(
          longitude
        ) ||
        !Number.isFinite(
          accuracy
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Lokasi tidak dapat dibaca. Aktifkan GPS dan izin lokasi lalu coba kembali.",
          },
          {
            status: 400,
          }
        );
      }

      if (
        accuracy >
        Number(
          result.session
            .max_accuracy_m
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Akurasi lokasi terlalu rendah (±${Math.round(
                accuracy
              )} meter). Aktifkan lokasi presisi lalu coba kembali.`,
          },
          {
            status: 400,
          }
        );
      }

      const centerLat =
        Number(
          result.session
            .latitude
        );

      const centerLon =
        Number(
          result.session
            .longitude
        );

      if (
        !Number.isFinite(
          centerLat
        ) ||
        !Number.isFinite(
          centerLon
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Lokasi kelas belum dikonfigurasi.",
          },
          {
            status: 500,
          }
        );
      }

      distance =
        distanceMeters(
          centerLat,
          centerLon,
          latitude,
          longitude
        );

      if (
        distance >
        Number(
          result.session
            .radius_meters
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Anda berada di luar area presensi (${Math.round(
                distance
              )} meter dari lokasi kelas).`,
          },
          {
            status: 403,
          }
        );
      }
    }

    /* ===========================
       IP HASH
    =========================== */

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

    /* ===========================
       SIMPAN LOG
    =========================== */

    let checkinCreated =
      false;

    if (!existingDevice) {
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
          return NextResponse.json(
            {
              success: false,
              message:
                "Perangkat atau mahasiswa sudah digunakan untuk presensi pada pertemuan ini.",
            },
            {
              status: 409,
            }
          );
        }

        throw checkinError;
      }

      checkinCreated =
        true;
    }

    /* ===========================
       SIMPAN HADIR
    =========================== */

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

        status: "H",
      });

    if (
      attendanceError
    ) {
      if (
        checkinCreated
      ) {
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
      }

      throw attendanceError;
    }

    return NextResponse.json({
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
        distance !== null
          ? Math.round(
              distance
            )
          : null,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal menyimpan presensi.",
      },
      {
        status: 500,
      }
    );
  }
}