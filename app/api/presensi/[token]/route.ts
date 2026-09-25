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

/*
 * ==========================================
 * SECRET
 * ==========================================
 */

function getQrSecret() {
  const secret =
    process.env
      .QR_SIGNING_SECRET;

  if (!secret) {
    throw new Error(
      "QR_SIGNING_SECRET belum dikonfigurasi."
    );
  }

  return secret;
}

/*
 * ==========================================
 * SIGNATURE
 * ==========================================
 */

function signPayload(
  payload: string
) {
  return createHmac(
    "sha256",
    getQrSecret()
  )
    .update(payload)
    .digest("base64url");
}

/*
 * ==========================================
 * SAFE COMPARE
 * ==========================================
 */

function safeCompare(
  first: string,
  second: string
) {
  try {
    const firstBuffer =
      Buffer.from(
        first
      );

    const secondBuffer =
      Buffer.from(
        second
      );

    if (
      firstBuffer.length !==
      secondBuffer.length
    ) {
      return false;
    }

    return timingSafeEqual(
      firstBuffer,
      secondBuffer
    );
  } catch {
    return false;
  }
}

/*
 * ==========================================
 * HASH
 * ==========================================
 */

function hashValue(
  value: string
) {
  return createHash(
    "sha256"
  )
    .update(
      `${getQrSecret()}:${value}`
    )
    .digest("hex");
}

/*
 * ==========================================
 * SUPABASE SERVER ADMIN
 * ==========================================
 */

function getAdminSupabase() {
  const url =
    process.env
      .SUPABASE_URL ||
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env
      .SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error(
      "URL Supabase server belum dikonfigurasi."
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi."
    );
  }

  return createClient(
    url,
    serviceRoleKey,
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

/*
 * ==========================================
 * FIND SESSION
 * ==========================================
 */

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

  const meetingRaw =
    data.meetings as any;

  const meeting =
    Array.isArray(
      meetingRaw
    )
      ? meetingRaw[0]
      : meetingRaw;

  if (!meeting) {
    return null;
  }

  const courseRaw =
    meeting.courses;

  const course =
    Array.isArray(
      courseRaw
    )
      ? courseRaw[0]
      : courseRaw;

  if (!course) {
    return null;
  }

  return {
    session:
      data,

    meeting,

    course,
  };
}

/*
 * ==========================================
 * VALIDASI SESSION
 * ==========================================
 */

function validateSession(
  session: any
) {
  if (
    !session.is_active
  ) {
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
    !Number.isFinite(
      start
    ) ||
    !Number.isFinite(
      end
    )
  ) {
    return "Waktu sesi presensi tidak valid.";
  }

  if (
    now <
    start
  ) {
    return "Presensi belum dibuka.";
  }

  if (
    now >=
    end
  ) {
    return "Waktu presensi sudah berakhir.";
  }

  return null;
}

/*
 * ==========================================
 * VALIDASI QR DINAMIS
 * ==========================================
 */

function verifyQrCode(
  session: any,
  code: string
) {
  const parts =
    code.split(
      "."
    );

  if (
    parts.length !==
    4
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
    return false;
  }

  if (
    !nonce ||
    !signature
  ) {
    return false;
  }

  const now =
    Date.now();

  /*
   * QR sudah expired.
   */
  if (
    now >
    expiresAt
  ) {
    return false;
  }

  /*
   * Hindari QR timestamp
   * terlalu jauh di masa depan.
   */
  if (
    issuedAt >
    now + 10_000
  ) {
    return false;
  }

  /*
   * QR tidak boleh memiliki
   * masa aktif > 40 detik.
   */
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
    signPayload(
      payload
    );

  return safeCompare(
    signature,
    expected
  );
}

/*
 * ==========================================
 * TICKET
 *
 * Setelah QR valid,
 * mahasiswa diberi waktu 2 menit
 * untuk mengetik NPM.
 * ==========================================
 */

function createTicket(
  session: any,
  deviceHash: string
) {
  const expiresAt =
    Date.now() +
    2 *
      60 *
      1000;

  const payload =
    `${session.id}:` +
    `${deviceHash}:` +
    `${expiresAt}:ticket`;

  const signature =
    signPayload(
      payload
    );

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
    ticket.split(
      "."
    );

  if (
    parts.length !==
    3
  ) {
    return false;
  }

  const [
    expiresText,
    ticketDeviceHash,
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

  if (
    ticketDeviceHash !==
    deviceHash
  ) {
    return false;
  }

  const payload =
    `${session.id}:` +
    `${deviceHash}:` +
    `${expiresAt}:ticket`;

  const expected =
    signPayload(
      payload
    );

  return safeCompare(
    signature,
    expected
  );
}

/*
 * ==========================================
 * GPS DISTANCE
 * ==========================================
 */

function toRadians(
  value: number
) {
  return (
    value *
    (Math.PI /
      180)
  );
}

function distanceMeters(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number
) {
  const earthRadius =
    6_371_000;

  const deltaLatitude =
    toRadians(
      latitude2 -
        latitude1
    );

  const deltaLongitude =
    toRadians(
      longitude2 -
        longitude1
    );

  const first =
    Math.sin(
      deltaLatitude /
        2
    ) ** 2;

  const second =
    Math.cos(
      toRadians(
        latitude1
      )
    ) *
    Math.cos(
      toRadians(
        latitude2
      )
    ) *
    Math.sin(
      deltaLongitude /
        2
    ) ** 2;

  const a =
    first +
    second;

  const c =
    2 *
    Math.atan2(
      Math.sqrt(
        a
      ),
      Math.sqrt(
        1 - a
      )
    );

  return (
    earthRadius *
    c
  );
}

/*
 * ==========================================
 * JSON RESPONSE
 * ==========================================
 */

function json(
  data: unknown,
  status =
    200
) {
  return NextResponse.json(
    data,
    {
      status,

      headers: {
        "Cache-Control":
          "no-store, max-age=0",
      },
    }
  );
}

/*
 * =========================================================
 * GET
 *
 * Dijalankan setelah mahasiswa scan QR.
 *
 * Belum meminta GPS.
 *
 * Jika QR valid:
 * server memberi ticket selama 2 menit.
 * =========================================================
 */

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
        .get(
          "code"
        );

    const deviceId =
      request.nextUrl
        .searchParams
        .get(
          "deviceId"
        );

    if (
      !token ||
      !code ||
      !deviceId
    ) {
      return json(
        {
          success:
            false,

          message:
            "QR tidak valid. Silakan scan QR terbaru dari layar dosen.",
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
          success:
            false,

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
          success:
            false,

          message:
            sessionError,
        },
        410
      );
    }

    /*
     * Validasi QR.
     */
    if (
      !verifyQrCode(
        result.session,
        code
      )
    ) {
      return json(
        {
          success:
            false,

          message:
            "QR sudah kedaluwarsa. Silakan scan QR terbaru dari layar dosen.",
        },
        410
      );
    }

    /*
     * Hash device.
     */
    const deviceHash =
      hashValue(
        `device:${deviceId}`
      );

    /*
     * Ticket 2 menit.
     */
    const ticket =
      createTicket(
        result.session,
        deviceHash
      );

    return json({
      success:
        true,

      ticket,

      data: {
        meetingNo:
          result
            .meeting
            .meeting_no,

        meetingDate:
          result
            .meeting
            .meeting_date,

        courseName:
          result
            .course
            .name,

        className:
          result
            .course
            .class_name,

        lecturer:
          result
            .course
            .lecturer,

        schedule:
          result
            .course
            .schedule,

        endsAt:
          result
            .session
            .ends_at,

        requireLocation:
          true,

        radiusMeters:
          Number(
            result
              .session
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
      "PRESENSI GET ERROR:",
      error
    );

    return json(
      {
        success:
          false,

        message:
          "Terjadi kesalahan saat memvalidasi QR.",
      },
      500
    );
  }
}

/*
 * =========================================================
 * POST
 *
 * Dijalankan ketika mahasiswa
 * klik KIRIM PRESENSI.
 * =========================================================
 */

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
        body.npm ??
          ""
      ).trim();

    const deviceId =
      String(
        body.deviceId ??
          ""
      ).trim();

    const ticket =
      String(
        body.ticket ??
          ""
      ).trim();

    /*
     * ===============================
     * VALIDASI INPUT
     * ===============================
     */

    if (!npm) {
      return json(
        {
          success:
            false,

          message:
            "NPM wajib diisi.",
        },
        400
      );
    }

    if (
      !deviceId ||
      !ticket
    ) {
      return json(
        {
          success:
            false,

          message:
            "Sesi perangkat tidak valid. Scan QR kembali.",
        },
        400
      );
    }

    /*
     * ===============================
     * SESSION
     * ===============================
     */

    const result =
      await findSession(
        token
      );

    if (!result) {
      return json(
        {
          success:
            false,

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
          success:
            false,

          message:
            sessionError,
        },
        410
      );
    }

    /*
     * ===============================
     * DEVICE
     * ===============================
     */

    const deviceHash =
      hashValue(
        `device:${deviceId}`
      );

    /*
     * ===============================
     * TICKET
     * ===============================
     */

    if (
      !verifyTicket(
        result.session,
        deviceHash,
        ticket
      )
    ) {
      return json(
        {
          success:
            false,

          message:
            "Waktu pengisian sudah habis. Scan QR terbaru kembali.",
        },
        410
      );
    }

    const supabase =
      getAdminSupabase();

    /*
     * ===============================
     * CEK MAHASISWA
     * ===============================
     */

    const {
      data:
        student,

      error:
        studentError,
    } = await supabase
      .from(
        "students"
      )
      .select(
        "id,npm,name,course_id"
      )
      .eq(
        "course_id",
        result
          .course
          .id
      )
      .eq(
        "npm",
        npm
      )
      .maybeSingle();

    if (
      studentError
    ) {
      throw studentError;
    }

    if (
      !student
    ) {
      return json(
        {
          success:
            false,

          message:
            "NPM tidak terdaftar pada kelas ini.",
        },
        404
      );
    }

    /*
     * ===============================
     * CEK SUDAH ABSEN
     * ===============================
     */

    const {
      data:
        existingAttendance,

      error:
        existingAttendanceError,
    } = await supabase
      .from(
        "attendance"
      )
      .select(
        "id,status"
      )
      .eq(
        "meeting_id",
        result
          .meeting
          .id
      )
      .eq(
        "student_id",
        student.id
      )
      .maybeSingle();

    if (
      existingAttendanceError
    ) {
      throw existingAttendanceError;
    }

    if (
      existingAttendance
    ) {
      return json(
        {
          success:
            false,

          message:
            `Presensi sudah tercatat dengan status ${existingAttendance.status}.`,
        },
        409
      );
    }

    /*
     * ===============================
     * CEK DEVICE SUDAH DIPAKAI
     * ===============================
     */

    const {
      data:
        existingDevice,

      error:
        existingDeviceError,
    } = await supabase
      .from(
        "attendance_checkins"
      )
      .select(
        "student_id"
      )
      .eq(
        "meeting_id",
        result
          .meeting
          .id
      )
      .eq(
        "device_hash",
        deviceHash
      )
      .maybeSingle();

    if (
      existingDeviceError
    ) {
      throw existingDeviceError;
    }

    if (
      existingDevice &&
      existingDevice.student_id !==
        student.id
    ) {
      return json(
        {
          success:
            false,

          message:
            "Perangkat ini sudah digunakan untuk presensi mahasiswa lain pada pertemuan ini.",
        },
        409
      );
    }

    /*
     * ===============================
     * GPS
     * ===============================
     */

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
      return json(
        {
          success:
            false,

          message:
            "Lokasi tidak dapat dibaca. Aktifkan GPS dan izinkan akses lokasi pada browser.",
        },
        400
      );
    }

    if (
      latitude <
        -90 ||
      latitude >
        90 ||
      longitude <
        -180 ||
      longitude >
        180 ||
      accuracy <=
        0
    ) {
      return json(
        {
          success:
            false,

          message:
            "Data lokasi perangkat tidak valid.",
        },
        400
      );
    }

    /*
     * ===============================
     * AKURASI GPS
     * ===============================
     */

    const maxAccuracy =
      Number(
        result
          .session
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
          success:
            false,

          message:
            `Akurasi GPS terlalu rendah (±${Math.round(
              accuracy
            )} meter). Aktifkan lokasi presisi lalu coba kembali.`,
        },
        400
      );
    }

    /*
     * ===============================
     * RADIUS
     * ===============================
     */

    const radius =
      Number(
        result
          .session
          .radius_meters ||
          CAMPUS_LOCATION
            .defaultRadius
      );

    /*
     * Titik pusat SELALU
     * kampus Teknokrat.
     */
    const distance =
      distanceMeters(
        CAMPUS_LOCATION
          .latitude,

        CAMPUS_LOCATION
          .longitude,

        latitude,

        longitude
      );

    if (
      distance >
      radius
    ) {
      return json(
        {
          success:
            false,

          message:
            `Anda berada di luar area kampus (${Math.round(
              distance
            )} meter dari titik presensi). Batas ${radius} meter.`,
        },
        403
      );
    }

    /*
     * ===============================
     * IP
     * ===============================
     */

    const forwarded =
      request.headers.get(
        "x-forwarded-for"
      );

    const ip =
      forwarded
        ?.split(
          ","
        )[0]
        ?.trim() ||
      request.headers.get(
        "x-real-ip"
      ) ||
      "";

    /*
     * IP tidak disimpan asli.
     */
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

    /*
     * ===============================
     * SIMPAN CHECKIN
     * ===============================
     */

    let checkinCreated =
      false;

    if (
      !existingDevice
    ) {
      const {
        error:
          checkinError,
      } = await supabase
        .from(
          "attendance_checkins"
        )
        .insert({
          session_id:
            result
              .session
              .id,

          meeting_id:
            result
              .meeting
              .id,

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
        /*
         * Unique violation.
         */
        if (
          checkinError.code ===
          "23505"
        ) {
          return json(
            {
              success:
                false,

              message:
                "Mahasiswa atau perangkat ini sudah digunakan untuk presensi pada pertemuan ini.",
            },
            409
          );
        }

        throw checkinError;
      }

      checkinCreated =
        true;
    }

    /*
     * ===============================
     * SIMPAN HADIR
     * ===============================
     */

    const {
      error:
        attendanceError,
    } = await supabase
      .from(
        "attendance"
      )
      .insert({
        meeting_id:
          result
            .meeting
            .id,

        student_id:
          student.id,

        status:
          "H",
      });

    if (
      attendanceError
    ) {
      /*
       * Rollback checkin
       * jika attendance gagal.
       */
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
            result
              .meeting
              .id
          )
          .eq(
            "student_id",
            student.id
          );
      }

      if (
        attendanceError.code ===
        "23505"
      ) {
        return json(
          {
            success:
              false,

            message:
              "Presensi mahasiswa sudah tercatat.",
          },
          409
        );
      }

      throw attendanceError;
    }

    /*
     * ===============================
     * BERHASIL
     * ===============================
     */

    return json({
      success:
        true,

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
      "PRESENSI POST ERROR:",
      error
    );

    return json(
      {
        success:
          false,

        message:
          "Gagal menyimpan presensi.",
      },
      500
    );
  }
}