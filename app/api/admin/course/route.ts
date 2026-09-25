import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

async function requireSuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { success: false, message: "Anda belum login." },
        { status: 401 },
      ),
    };
  }

  const { data: profile } = await supabase
    .from("admin_profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profile?.role !== "super_admin") {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          success: false,
          message: "Hanya Super Admin yang dapat menambah mata kuliah.",
        },
        { status: 403 },
      ),
    };
  }

  return { ok: true as const };
}

export async function POST(request: NextRequest) {
  let createdCourseId = "";

  try {
    const auth = await requireSuperAdmin();
    if (!auth.ok) return auth.response;

    const body = await request.json();

    const name = String(body.name ?? "").trim();
    const className = String(body.class_name ?? "").trim();
    const schedule = String(body.schedule ?? "").trim();
    const semester = String(body.semester ?? "").trim();
    const academicYear = String(body.academic_year ?? "").trim();
    const startDate = String(body.start_date ?? "").trim();
    const lecturerUserId = String(body.lecturer_user_id ?? "").trim();
    const meetingCount = Number(body.meeting_count ?? 16);
    const minAttendancePct = Number(body.min_attendance_pct ?? 80);

    if (!name || !className || !startDate || !lecturerUserId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Mata kuliah, kelas, dosen pengampu, dan tanggal pertemuan pertama wajib diisi.",
        },
        { status: 400 },
      );
    }

    if (!Number.isInteger(meetingCount) || meetingCount < 1 || meetingCount > 40) {
      return NextResponse.json(
        { success: false, message: "Jumlah pertemuan harus 1–40." },
        { status: 400 },
      );
    }

    if (
      !Number.isFinite(minAttendancePct) ||
      minAttendancePct < 0 ||
      minAttendancePct > 100
    ) {
      return NextResponse.json(
        { success: false, message: "Batas kehadiran harus 0–100%." },
        { status: 400 },
      );
    }

    const admin = createAdminClient();

    const { data: lecturer, error: lecturerError } = await admin
      .from("admin_profiles")
      .select("user_id, display_name, role")
      .eq("user_id", lecturerUserId)
      .eq("role", "lecturer")
      .maybeSingle();

    if (lecturerError || !lecturer) {
      return NextResponse.json(
        { success: false, message: "Dosen pengampu tidak ditemukan." },
        { status: 400 },
      );
    }

    const { data: course, error: courseError } = await admin
      .from("courses")
      .insert({
        name,
        class_name: className,
        lecturer: lecturer.display_name ?? "Dosen",
        schedule,
        semester,
        academic_year: academicYear,
        meeting_count: meetingCount,
        min_attendance_pct: minAttendancePct,
        publish_grades: false,
      })
      .select("*")
      .single();

    if (courseError || !course) {
      throw courseError ?? new Error("Gagal membuat mata kuliah.");
    }

    createdCourseId = course.id;

    const meetingRows = Array.from({ length: meetingCount }, (_, index) => ({
      course_id: course.id,
      meeting_no: index + 1,
      meeting_date: addDays(startDate, index * 7),
    }));

    const assessmentRows = [
      {
        course_id: course.id,
        name: "Tugas",
        category: "Tugas",
        max_score: 100,
        weight: 25,
        sort_order: 1,
      },
      {
        course_id: course.id,
        name: "Quiz",
        category: "Quiz",
        max_score: 100,
        weight: 15,
        sort_order: 2,
      },
      {
        course_id: course.id,
        name: "UTS",
        category: "UTS",
        max_score: 100,
        weight: 25,
        sort_order: 3,
      },
      {
        course_id: course.id,
        name: "UAS",
        category: "UAS",
        max_score: 100,
        weight: 35,
        sort_order: 4,
      },
    ];

    const [meetingsRes, assessmentsRes, membershipRes] = await Promise.all([
      admin.from("meetings").insert(meetingRows).select("*"),
      admin.from("assessments").insert(assessmentRows).select("*"),
      admin.from("course_members").upsert(
        {
          course_id: course.id,
          user_id: lecturer.user_id,
          role: "lecturer",
        },
        { onConflict: "course_id,user_id" },
      ),
    ]);

    const childError =
      meetingsRes.error || assessmentsRes.error || membershipRes.error;

    if (childError) {
      await admin.from("courses").delete().eq("id", course.id);
      throw childError;
    }

    return NextResponse.json({
      success: true,
      message: "Mata kuliah dan akun dosen berhasil dihubungkan.",
      course,
      meetings: meetingsRes.data ?? [],
      assessments: assessmentsRes.data ?? [],
    });
  } catch (error: any) {
    console.error("CREATE COURSE ERROR:", error);

    if (createdCourseId) {
      try {
        const admin = createAdminClient();
        await admin.from("courses").delete().eq("id", createdCourseId);
      } catch {
        // best-effort cleanup
      }
    }

    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Gagal membuat mata kuliah.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin();
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const courseId = String(body.course_id ?? "").trim();
    const lecturerUserId = String(body.lecturer_user_id ?? "").trim();

    if (!courseId || !lecturerUserId) {
      return NextResponse.json(
        {
          success: false,
          message: "Course ID dan dosen pengampu wajib diisi.",
        },
        { status: 400 },
      );
    }

    const admin = createAdminClient();

    const { data: lecturer, error: lecturerError } = await admin
      .from("admin_profiles")
      .select("user_id, display_name, role")
      .eq("user_id", lecturerUserId)
      .eq("role", "lecturer")
      .maybeSingle();

    if (lecturerError || !lecturer) {
      return NextResponse.json(
        { success: false, message: "Dosen pengampu tidak ditemukan." },
        { status: 400 },
      );
    }

    const { error: updateCourseError } = await admin
      .from("courses")
      .update({ lecturer: lecturer.display_name ?? "Dosen" })
      .eq("id", courseId);

    if (updateCourseError) throw updateCourseError;

    const { error: deleteOldError } = await admin
      .from("course_members")
      .delete()
      .eq("course_id", courseId)
      .eq("role", "lecturer");

    if (deleteOldError) throw deleteOldError;

    const { error: membershipError } = await admin.from("course_members").upsert(
      {
        course_id: courseId,
        user_id: lecturer.user_id,
        role: "lecturer",
      },
      { onConflict: "course_id,user_id" },
    );

    if (membershipError) throw membershipError;

    return NextResponse.json({
      success: true,
      message: "Dosen pengampu berhasil diperbarui.",
      lecturer: {
        user_id: lecturer.user_id,
        display_name: lecturer.display_name ?? "Dosen",
      },
    });
  } catch (error: any) {
    console.error("UPDATE COURSE LECTURER ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Gagal mengganti dosen pengampu.",
      },
      { status: 500 },
    );
  }
}
