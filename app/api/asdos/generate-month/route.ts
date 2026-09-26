import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function isIsoDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime())
  );
}

function isoWeekday(date: Date) {
  const day = date.getUTCDay();
  return day === 0 ? 7 : day; // Senin=1 ... Minggu=7
}

function addUtcDay(date: Date) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  const { data: profile } = await supabase
    .from("assistant_profiles")
    .select("user_id, is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.is_active) {
    return NextResponse.json(
      { error: "Akun Asdos tidak aktif." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));

  const startDate = String(body.start_date ?? "");
  const endDate = String(body.end_date ?? "");

  if (!isIsoDate(startDate) || !isIsoDate(endDate)) {
    return NextResponse.json(
      {
        error:
          "Tanggal mulai dan tanggal akhir wajib berformat YYYY-MM-DD.",
      },
      { status: 400 },
    );
  }

  if (startDate > endDate) {
    return NextResponse.json(
      {
        error:
          "Tanggal mulai tidak boleh lebih besar dari tanggal akhir.",
      },
      { status: 400 },
    );
  }

  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);

  const totalDays =
    Math.floor(
      (end.getTime() - start.getTime()) /
        (24 * 60 * 60 * 1000),
    ) + 1;

  if (totalDays > 92) {
    return NextResponse.json(
      {
        error:
          "Periode rekap terlalu panjang. Maksimal 92 hari.",
      },
      { status: 400 },
    );
  }

  // ---------------------------------------------------------
  // 1. Ambil semua mata kuliah yang memang diasisteni user.
  // ---------------------------------------------------------
  const { data: memberships, error: membershipError } =
    await supabase
      .from("course_members")
      .select("course_id")
      .eq("user_id", user.id)
      .eq("role", "assistant");

  if (membershipError) {
    return NextResponse.json(
      { error: membershipError.message },
      { status: 400 },
    );
  }

  const courseIds = (memberships ?? []).map(
    (item) => item.course_id,
  );

  if (!courseIds.length) {
    return NextResponse.json(
      {
        error:
          "Belum ada mata kuliah yang ditugaskan kepada akun Asdos ini.",
      },
      { status: 400 },
    );
  }

  // ---------------------------------------------------------
  // 2. Jadwal sumber tunggal: course_schedules.
  //    Kalau ada 2 slot/minggu, dua-duanya akan digenerate.
  // ---------------------------------------------------------
  const [
    { data: schedules, error: scheduleError },
    { data: courses, error: courseError },
  ] = await Promise.all([
    supabase
      .from("course_schedules")
      .select(
        "id, course_id, weekday, day_name, start_time, end_time, room",
      )
      .in("course_id", courseIds)
      .order("weekday")
      .order("start_time"),

    supabase
      .from("courses")
      .select(
        "id, name, class_name, lecturer",
      )
      .in("id", courseIds),
  ]);

  if (scheduleError) {
    return NextResponse.json(
      { error: scheduleError.message },
      { status: 400 },
    );
  }

  if (courseError) {
    return NextResponse.json(
      { error: courseError.message },
      { status: 400 },
    );
  }

  if (!schedules?.length) {
    return NextResponse.json(
      {
        error:
          "Belum ada jadwal mata kuliah. Atur jadwal di Pengaturan Kelas atau import Excel.",
      },
      { status: 400 },
    );
  }

  const courseMap = new Map(
    (courses ?? []).map((course) => [
      course.id,
      course,
    ]),
  );

  // ---------------------------------------------------------
  // 3. Refresh:
  //    Hapus HANYA draft hasil generate pada periode terpilih.
  //    Submitted/approved tidak disentuh.
  // ---------------------------------------------------------
  const { error: deleteError } = await supabase
    .from("assistant_activity_logs")
    .delete()
    .eq("assistant_user_id", user.id)
    .eq("status", "draft")
    .gte("activity_date", startDate)
    .lte("activity_date", endDate);

  if (deleteError) {
    return NextResponse.json(
      {
        error:
          `Gagal membersihkan draft lama: ${deleteError.message}`,
      },
      { status: 400 },
    );
  }

  // ---------------------------------------------------------
  // 4. Generate ULANG setiap jadwal mingguan,
  //    dari tanggal mulai SAMPAI tanggal akhir (inklusif).
  //
  //    Contoh:
  //    Senin 17:00-19:00
  //    Kamis 19:00-21:00
  //
  //    periode 26 Agu - 24 Sep
  //    => semua Senin & Kamis di rentang itu dibuat.
  // ---------------------------------------------------------
  const rows: Array<Record<string, unknown>> = [];

  for (const schedule of schedules) {
    const course = courseMap.get(schedule.course_id);

    if (!course) {
      continue;
    }

    let cursor = new Date(start);

    while (cursor <= end) {
      if (
        isoWeekday(cursor) ===
        Number(schedule.weekday)
      ) {
        rows.push({
          assistant_user_id: user.id,

          // Jadwal sekarang berasal dari course_schedules.
          schedule_template_id: null,

          course_id: schedule.course_id,

          activity_date:
            cursor.toISOString().slice(0, 10),

          start_time: schedule.start_time,
          end_time: schedule.end_time,

          class_label: course.class_name,
          room: schedule.room ?? "",

          course_name: course.name,
          material: "",

          lecturer_name:
            course.lecturer ?? "",

          activity_type: "Mengajar",
          notes: "",

          status: "draft",
        });
      }

      cursor = addUtcDay(cursor);
    }
  }

  // Sort supaya hasil di tabel benar-benar kronologis.
  rows.sort((a, b) => {
    const dateA = String(a.activity_date);
    const dateB = String(b.activity_date);

    if (dateA !== dateB) {
      return dateA.localeCompare(dateB);
    }

    const timeA = String(a.start_time);
    const timeB = String(b.start_time);

    if (timeA !== timeB) {
      return timeA.localeCompare(timeB);
    }

    return String(a.course_name).localeCompare(
      String(b.course_name),
    );
  });

  // ---------------------------------------------------------
  // 5. Insert ulang.
  //
  // Constraint project sebelumnya menggunakan kombinasi:
  // assistant_user_id + activity_date + start_time
  // + class_label + course_name.
  // ---------------------------------------------------------
  if (rows.length) {
    const { error: insertError } = await supabase
      .from("assistant_activity_logs")
      .upsert(rows, {
        onConflict:
          "assistant_user_id,activity_date,start_time,class_label,course_name",
        ignoreDuplicates: true,
      });

    if (insertError) {
      return NextResponse.json(
        {
          error:
            `Gagal membuat rekap dari jadwal: ${insertError.message}`,
        },
        { status: 400 },
      );
    }
  }

  // ---------------------------------------------------------
  // 6. Ambil ulang semua log pada periode agar UI refresh.
  // ---------------------------------------------------------
  const { data: logs, error: logsError } =
    await supabase
      .from("assistant_activity_logs")
      .select("*")
      .eq("assistant_user_id", user.id)
      .gte("activity_date", startDate)
      .lte("activity_date", endDate)
      .order("activity_date")
      .order("start_time");

  if (logsError) {
    return NextResponse.json(
      { error: logsError.message },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,

    start_date: startDate,
    end_date: endDate,

    generated: rows.length,
    schedules_used: schedules.length,

    logs: logs ?? [],
  });
}
