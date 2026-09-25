import {
  createHash,
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

import {
  verifyCheckinTicket,
} from "@/lib/presensi-ticket";

export const dynamic =
  "force-dynamic";

export const runtime =
  "nodejs";

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

function getSecret() {
  const secret =
    process.env
      .QR_SIGNING_SECRET;

  if (!secret) {
    throw new Error(
      "QR_SIGNING_SECRET belum tersedia."
    );
  }

  return secret;
}

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
  const earthRadius =
    6371000;

  const dLat =
    toRadians(
      lat2 -
        lat1
    );

  const dLon =
    toRadians(
      lon2 -
        lon1
    );

  const a =
    Math.sin(
      dLat /
        2
    ) ** 2 +
    Math.cos(
      toRadians(
        lat1
      )
    ) *
    Math.cos(
      toRadians(
        lat2
      )
    ) *
    Math.sin(
      dLon /
        2
    ) ** 2;

  const c =
    2 *
    Math.atan2(
      Math.sqrt(
        a
      ),
      Math.sqrt(
        1 -
          a
      )
    );

  return (
    earthRadius *
    c
  );
}

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
  request.cookies
    .get(
      "presensi_device_id"
    )
    ?.value ??
  "";

    /*
     * TICKET SEKARANG DARI COOKIE,
     * BUKAN BODY.
     */
    const ticket =
      request.cookies
        .get(
          "presensi_checkin_ticket"
        )
        ?.value ??
      "";

    if (
      !ticket
    ) {
      return json(
        {
          success:
            false,

          message:
            "Sesi check-in tidak ditemukan. Scan QR terbaru.",
        },
        401
      );
    }

    if (
      !npm ||
      !deviceId
    ) {
      return json(
        {
          success:
            false,

          message:
            "Data presensi tidak lengkap.",
        },
        400
      );
    }

    const supabase =
      getAdminSupabase();

    const {
      data:
        session,

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
        max_accuracy_m,

        meetings!inner (
          id,
          course_id,

          courses!inner (
            id
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
      !session
    ) {
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

    if (
      !session.is_active
    ) {
      return json(
        {
          success:
            false,

          message:
            "Presensi sudah ditutup.",
        },
        410
      );
    }

    if (
      Date.now() >=
      new Date(
        session.ends_at
      ).getTime()
    ) {
      return json(
        {
          success:
            false,

          message:
            "Waktu presensi sudah berakhir.",
        },
        410
      );
    }

    if (
      !verifyCheckinTicket(
        session.id,
        session.token,
        ticket
      )
    ) {
      return json(
        {
          success:
            false,

          message:
            "Sesi check-in sudah berakhir. Scan QR terbaru.",
        },
        410
      );
    }

    const rawMeeting =
      session.meetings as any;

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
      return json(
        {
          success:
            false,

          message:
            "Data kelas tidak ditemukan.",
        },
        404
      );
    }

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
        "id,npm,name"
      )
      .eq(
        "course_id",
        course.id
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

    const {
      data:
        existingAttendance,
    } = await supabase
      .from(
        "attendance"
      )
      .select(
        "id,status"
      )
      .eq(
        "meeting_id",
        meeting.id
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
          success:
            false,

          message:
            `Presensi sudah tercatat dengan status ${existingAttendance.status}.`,
        },
        409
      );
    }

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
        meeting.id
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
          success:
            false,

          message:
            "Perangkat ini sudah digunakan mahasiswa lain pada pertemuan ini.",
        },
        409
      );
    }

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
            "Lokasi GPS tidak valid.",
        },
        400
      );
    }

    const maxAccuracy =
      Number(
        session.max_accuracy_m ||
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
            )} meter). Aktifkan lokasi presisi.`,
        },
        400
      );
    }

    const radius =
      Number(
        session.radius_meters ||
          CAMPUS_LOCATION
            .defaultRadius
      );

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
            `Anda berada ${Math.round(
              distance
            )} meter dari kampus. Batas ${radius} meter.`,
        },
        403
      );
    }

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

    const {
      error:
        checkinError,
    } = await supabase
      .from(
        "attendance_checkins"
      )
      .insert({
        session_id:
          session.id,

        meeting_id:
          meeting.id,

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
            success:
              false,

            message:
              "Mahasiswa atau perangkat sudah digunakan untuk presensi.",
          },
          409
        );
      }

      throw checkinError;
    }

    const {
      error:
        attendanceError,
    } = await supabase
      .from(
        "attendance"
      )
      .insert({
        meeting_id:
          meeting.id,

        student_id:
          student.id,

        status:
          "H",
      });

    if (
      attendanceError
    ) {
      await supabase
        .from(
          "attendance_checkins"
        )
        .delete()
        .eq(
          "meeting_id",
          meeting.id
        )
        .eq(
          "student_id",
          student.id
        );

      throw attendanceError;
    }

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
      "POST PRESENSI ERROR:",
      error
    );

    return json(
      {
        success:
          false,

        message:
          "Terjadi kesalahan saat menyimpan presensi.",
      },
      500
    );
  }
}