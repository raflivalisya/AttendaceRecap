import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function getAdminSupabase() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("Supabase URL belum dikonfigurasi.");
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
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

async function findSession(token: string) {
  const supabase = getAdminSupabase();

  const { data, error } = await supabase
    .from("attendance_sessions")
    .select(`
      id,
      token,
      starts_at,
      ends_at,
      is_active,
      meeting_id,
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

  const meetingRaw = data.meetings as any;

  const meeting = Array.isArray(meetingRaw)
    ? meetingRaw[0]
    : meetingRaw;

  const courseRaw = meeting?.courses;

  const course = Array.isArray(courseRaw)
    ? courseRaw[0]
    : courseRaw;

  return {
    session: data,
    meeting,
    course,
  };
}

function validateSession(session: any) {
  if (!session.is_active) {
    return "Presensi sudah ditutup.";
  }

  const now = new Date();
  const start = new Date(session.starts_at);
  const end = new Date(session.ends_at);

  if (now < start) {
    return "Presensi belum dibuka.";
  }

  if (now > end) {
    return "Waktu presensi sudah berakhir.";
  }

  return null;
}

// =======================================================
// GET INFORMASI QR
// =======================================================

export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{
      token: string;
    }>;
  }
) {
  try {
    const { token } = await context.params;

    const result = await findSession(token);

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          message: "QR presensi tidak ditemukan.",
        },
        {
          status: 404,
        }
      );
    }

    const validation =
      validateSession(result.session);

    if (validation) {
      return NextResponse.json(
        {
          success: false,
          message: validation,
        },
        {
          status: 410,
        }
      );
    }

    return NextResponse.json({
      success: true,

      data: {
        meetingNo:
          result.meeting.meeting_no,

        meetingDate:
          result.meeting.meeting_date,

        courseName:
          result.course.name,

        className:
          result.course.class_name,

        lecturer:
          result.course.lecturer,

        schedule:
          result.course.schedule,

        endsAt:
          result.session.ends_at,
      },
    });
  } catch (error: any) {
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

// =======================================================
// KIRIM PRESENSI
// =======================================================

export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{
      token: string;
    }>;
  }
) {
  try {
    const { token } = await context.params;

    const body = await request.json();

    const npm =
      String(body.npm ?? "").trim();

    if (!npm) {
      return NextResponse.json(
        {
          success: false,
          message: "NPM wajib diisi.",
        },
        {
          status: 400,
        }
      );
    }

    // ====================================
    // CEK SESSION
    // ====================================

    const result = await findSession(token);

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          message:
            "QR presensi tidak ditemukan.",
        },
        {
          status: 404,
        }
      );
    }

    const validation =
      validateSession(result.session);

    if (validation) {
      return NextResponse.json(
        {
          success: false,
          message: validation,
        },
        {
          status: 410,
        }
      );
    }

    const supabase =
      getAdminSupabase();

    // ====================================
    // CEK MAHASISWA DI KELAS
    // ====================================

    const { data: student, error: studentError } =
      await supabase
        .from("students")
        .select("*")
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
            "NPM tidak terdaftar pada kelas ini.",
        },
        {
          status: 404,
        }
      );
    }

    // ====================================
    // CEK SUDAH ABSEN
    // ====================================

    const {
      data: existingAttendance,
      error: existingError,
    } = await supabase
      .from("attendance")
      .select("*")
      .eq(
        "meeting_id",
        result.meeting.id
      )
      .eq(
        "student_id",
        student.id
      )
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existingAttendance) {
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

    // ====================================
    // SIMPAN HADIR
    // ====================================

    const { error: attendanceError } =
      await supabase
        .from("attendance")
        .insert({
          meeting_id:
            result.meeting.id,

          student_id:
            student.id,

          status: "H",
        });

    if (attendanceError) {
      throw attendanceError;
    }

    return NextResponse.json({
      success: true,

      message:
        "Presensi berhasil. Anda tercatat Hadir.",

      student: {
        npm: student.npm,
        name: student.name,
      },
    });
  } catch (error: any) {
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